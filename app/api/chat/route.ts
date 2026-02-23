/**
 * CHAT API ROUTE — Thin Orchestrator
 *
 * This file is the entry point for the /api/chat POST endpoint.
 * All domain logic has been extracted into focused modules:
 *
 *   auth.ts           — Authentication, admin cache, user data
 *   rate-limiting.ts  — Chat, research, and per-tool rate limits
 *   helpers.ts        — Message truncation, content extraction, sanitization
 *   system-prompt.ts  — System prompt construction + context injection
 *   documents.ts      — Document intent detection + schema prompts
 *   document-routes.ts — Document & resume generation route handlers
 *   image-routes.ts   — BFL/FLUX image creation & editing
 *   chat-tools.ts     — Tool loading (lazy + MCP + Composio) + executor
 *   streaming.ts      — Multi-provider routing + stream wrapping
 *
 * This orchestrator handles:
 *   1. CSRF, request parsing, validation
 *   2. Auth + rate limiting
 *   3. Context loading (memory, learning, RAG)
 *   4. Route selection (image → analytics → docs → chat)
 *   5. Final streaming response
 */

import { NextRequest } from 'next/server';
import { CoreMessage } from 'ai';
import { acquireSlot, releaseSlot, generateRequestId } from '@/lib/queue';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';
import { chatRequestSchema } from '@/lib/validation/schemas';
import { chatErrorResponse } from '@/lib/api/utils';
import { ERROR_CODES, HTTP_STATUS } from '@/lib/constants';
import { validateRequestSize, SIZE_LIMITS } from '@/lib/security/request-size';
import { canMakeRequest, getTokenUsage, getTokenLimitWarningMessage } from '@/lib/limits';
import { getMemoryContext } from '@/lib/memory';
import { getLearningContext, observeAndLearn } from '@/lib/learning';
import { searchUserDocuments } from '@/lib/documents/userSearch';

// Local modules
import { authenticateRequest } from './auth';
import { checkChatRateLimit } from './rate-limiting';
import { getLastUserContent, truncateMessages, clampMaxTokens } from './helpers';
import { buildFullSystemPrompt } from './system-prompt';
import {
  tryImageCreation,
  tryImageEditWithAttachment,
  tryConversationalImageEdit,
} from './image-routes';
import {
  handleExplicitDocumentGeneration,
  handleResumeGeneration,
  handleAutoDetectedDocument,
} from './document-routes';
import { loadAllTools, createToolExecutor } from './chat-tools';
import {
  resolveProvider,
  createStreamPendingRequest,
  handleNonClaudeProvider,
  handleClaudeProvider,
} from './streaming';

const log = logger('ChatRoute');

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();

  // ── CSRF Protection ──
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  const requestId = generateRequestId();
  let slotAcquired = false;
  let isStreamingResponse = false;

  try {
    // ── Queue Slot ──
    slotAcquired = await acquireSlot(requestId);
    if (!slotAcquired) {
      return chatErrorResponse(HTTP_STATUS.SERVICE_UNAVAILABLE, {
        error: 'Server busy',
        code: ERROR_CODES.SERVICE_UNAVAILABLE,
        message: 'Please try again in a few seconds.',
        retryAfter: 5,
        action: 'retry',
      });
    }

    // ── Parse & Validate Request ──
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return chatErrorResponse(HTTP_STATUS.BAD_REQUEST, {
        error: 'Invalid JSON body',
        code: ERROR_CODES.INVALID_JSON,
        action: 'validate',
      });
    }

    const sizeCheck = validateRequestSize(rawBody, SIZE_LIMITS.XLARGE);
    if (!sizeCheck.valid) return sizeCheck.response!;

    const validation = chatRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      return chatErrorResponse(HTTP_STATUS.BAD_REQUEST, {
        error: 'Validation failed',
        code: ERROR_CODES.VALIDATION_ERROR,
        action: 'validate',
        details: validation.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const { messages, temperature, max_tokens, searchMode, conversationId, provider, thinking } =
      validation.data;

    // ── Authentication ──
    const authResult = await authenticateRequest();
    if (!authResult.authenticated) {
      return new Response(JSON.stringify(authResult.body), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { userId, isAdmin, userPlanKey, customInstructions } = authResult;

    // ── Context Loading (memory, learning, RAG) ──
    let memoryContext = '';
    let learningContext = '';
    let documentContext = '';

    try {
      const memory = await getMemoryContext(userId);
      if (memory.loaded) {
        memoryContext = memory.contextString;
        log.debug('Loaded user memory', { userId });
      }
    } catch (error) {
      log.warn('Failed to load user memory', error as Error);
    }

    try {
      const learning = await getLearningContext(userId);
      if (learning.loaded) {
        learningContext = learning.contextString;
        log.debug('Loaded user learning', { userId, prefs: learning.preferences.length });
      }
    } catch (error) {
      log.warn('Failed to load user learning', error as Error);
    }

    // Fire-and-forget: observe message for learning signals
    const lastUserMsg = messages.filter((m: { role: string }) => m.role === 'user').pop();
    if (lastUserMsg) {
      const msgText =
        typeof lastUserMsg.content === 'string'
          ? lastUserMsg.content
          : JSON.stringify(lastUserMsg.content);
      observeAndLearn(userId, msgText).catch((err: unknown) =>
        log.error('observeAndLearn failed', err instanceof Error ? err : undefined)
      );
    }

    // RAG document search
    try {
      const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
      if (lastUserMessage) {
        const messageContent =
          typeof lastUserMessage.content === 'string'
            ? lastUserMessage.content
            : JSON.stringify(lastUserMessage.content);
        const docSearch = await searchUserDocuments(userId, messageContent, { matchCount: 5 });
        if (docSearch.contextString) {
          documentContext = docSearch.contextString;
          log.debug('Found relevant documents', {
            userId,
            resultCount: docSearch.results.length,
          });
        }
      }
    } catch (error) {
      log.warn('Failed to search user documents', error as Error);
    }

    // ── Rate Limiting & Quota ──
    if (!isAdmin) {
      const rateLimit = await checkChatRateLimit(userId, true);
      if (!rateLimit.allowed) {
        return chatErrorResponse(HTTP_STATUS.TOO_MANY_REQUESTS, {
          error: 'Rate limit exceeded',
          code: ERROR_CODES.RATE_LIMITED,
          message: `Please wait ${Math.ceil(rateLimit.resetIn / 60)} minutes before continuing.`,
          retryAfter: rateLimit.resetIn,
          action: 'retry',
        });
      }

      const canProceed = await canMakeRequest(userId, userPlanKey);
      if (!canProceed) {
        const usage = await getTokenUsage(userId, userPlanKey);
        const isFreeUser = userPlanKey === 'free';
        const warningMessage = getTokenLimitWarningMessage(usage, isFreeUser);

        log.warn('Token quota exceeded', { userId, plan: userPlanKey, usage: usage.percentage });

        return chatErrorResponse(402, {
          error: 'Token quota exceeded',
          code: ERROR_CODES.QUOTA_EXCEEDED,
          message:
            warningMessage ||
            'You have exceeded your token limit. Please upgrade your plan to continue.',
          usage: { used: usage.used, limit: usage.limit, percentage: usage.percentage },
          action: 'upgrade',
          actionUrl: '/settings?tab=subscription',
        });
      }
    }

    // ── Request Deduplication ──
    const lastUserContent = getLastUserContent(messages as CoreMessage[]);
    log.debug('Processing request', { contentPreview: lastUserContent.substring(0, 50) });

    const { isDuplicateRequest } = await import('@/lib/chat/request-dedup');
    if (isDuplicateRequest(userId, lastUserContent)) {
      log.warn('Duplicate request detected', { userId: userId.substring(0, 8) });
      if (slotAcquired) {
        await releaseSlot(requestId);
        slotAcquired = false;
      }
      return chatErrorResponse(HTTP_STATUS.TOO_MANY_REQUESTS, {
        error: 'Duplicate request',
        code: ERROR_CODES.DUPLICATE_REQUEST,
        message: 'Please wait a moment before sending the same message again.',
        action: 'retry',
      });
    }

    // ── Tool Mode Determination ──
    type ToolMode =
      | 'none'
      | 'search'
      | 'factcheck'
      | 'research'
      | 'doc_word'
      | 'doc_excel'
      | 'doc_pdf'
      | 'doc_pptx'
      | 'resume_generator';
    const effectiveToolMode: ToolMode = (searchMode as ToolMode) || 'none';

    const docModeToType: Record<string, 'xlsx' | 'docx' | 'pdf' | 'pptx' | null> = {
      doc_word: 'docx',
      doc_excel: 'xlsx',
      doc_pdf: 'pdf',
      doc_pptx: 'pptx',
    };
    const explicitDocType = docModeToType[effectiveToolMode] || null;

    const imageRouteCtx = {
      messages: messages as CoreMessage[],
      lastUserContent,
      userId,
      conversationId,
      isAuthenticated: true,
    };

    const docRouteCtx = {
      messages: messages as CoreMessage[],
      lastUserContent,
      userId,
      userPlanKey,
      conversationId,
      isAuthenticated: true,
      memoryContext,
      requestId,
      slotAcquired,
    };

    // ── ROUTE 0: Image Generation (natural language) ──
    if (effectiveToolMode === 'none') {
      const imageResult = await tryImageCreation(imageRouteCtx);
      if (imageResult) {
        if (slotAcquired) {
          await releaseSlot(requestId);
          slotAcquired = false;
        }
        return imageResult;
      }

      // ── ROUTE 0.5: Image Edit (with attachment) ──
      const editResult = await tryImageEditWithAttachment(imageRouteCtx);
      if (editResult) {
        if (slotAcquired) {
          await releaseSlot(requestId);
          slotAcquired = false;
        }
        return editResult;
      }

      // ── ROUTE 0.6: Conversational Image Edit ──
      const convEditResult = await tryConversationalImageEdit(imageRouteCtx);
      if (convEditResult) {
        if (slotAcquired) {
          await releaseSlot(requestId);
          slotAcquired = false;
        }
        return convEditResult;
      }
    }

    // ── ROUTE 0.7: Data Analytics ──
    if (effectiveToolMode === 'none') {
      const analyticsResult = await tryDataAnalytics(
        lastUserContent,
        request,
        slotAcquired,
        requestId
      );
      if (analyticsResult) {
        slotAcquired = false;
        return analyticsResult;
      }
    }

    // ── ROUTE 1: Search Mode (falls through to regular chat with web search) ──
    if (effectiveToolMode === 'search' || effectiveToolMode === 'factcheck') {
      log.info('Search mode activated - using native web search via Claude', {
        toolMode: effectiveToolMode,
      });
    }

    // ── ROUTE 3: Explicit Document Generation ──
    if (explicitDocType) {
      const docResult = await handleExplicitDocumentGeneration(docRouteCtx, explicitDocType);
      if (docResult) {
        if (slotAcquired) {
          await releaseSlot(requestId);
          slotAcquired = false;
        }
        return docResult;
      }
    }

    // ── ROUTE 3.5: Resume Generator ──
    if (effectiveToolMode === 'resume_generator') {
      const resumeResult = await handleResumeGeneration(docRouteCtx);
      if (resumeResult) {
        isStreamingResponse = true; // resume can return streaming
        slotAcquired = false;
        return resumeResult;
      }
    }

    // ── ROUTE 3.9: Auto-Detected Document Requests ──
    if (!explicitDocType) {
      const autoDocResult = await handleAutoDetectedDocument(docRouteCtx);
      if (autoDocResult) {
        slotAcquired = false;
        return autoDocResult;
      }
    }

    // ── ROUTE 4: Claude Chat (main conversational flow) ──
    const truncatedMessages = truncateMessages(messages as CoreMessage[]);
    const clampedMaxTokens = clampMaxTokens(max_tokens);

    // Build system prompt with all context
    const { tools, composioToolContext } = await loadAllTools(userId);

    const fullSystemPrompt = buildFullSystemPrompt({
      customInstructions,
      memoryContext,
      learningContext,
      documentContext,
      composioAddition: composioToolContext?.systemPromptAddition,
    });

    log.debug('Available chat tools', { toolCount: tools.length });

    // Resolve provider
    const { selectedModel, selectedProviderId, error: providerError } = resolveProvider(provider);
    if (providerError) return providerError;

    const sessionId = conversationId || `chat_${userId}_${Date.now()}`;
    const toolExecutor = createToolExecutor(userId, sessionId);

    // Pending request for stream recovery
    const pendingRequestId = await createStreamPendingRequest({
      userId,
      conversationId,
      messages: truncatedMessages,
      model: selectedModel,
    });

    const streamConfig = {
      messages: truncatedMessages,
      systemPrompt: fullSystemPrompt,
      tools,
      toolExecutor,
      selectedModel,
      selectedProviderId,
      provider,
      temperature,
      maxTokens: clampedMaxTokens,
      thinking,
      requestId,
      conversationId,
      userId,
      userPlanKey,
      isAuthenticated: true,
      requestStartTime,
      request,
    };

    // Non-Claude providers use adapter directly
    if (selectedProviderId !== 'claude') {
      isStreamingResponse = true;
      slotAcquired = false;
      return handleNonClaudeProvider(streamConfig);
    }

    // Claude provider with full tool support
    isStreamingResponse = true;
    slotAcquired = false;
    return await handleClaudeProvider({ ...streamConfig, pendingRequestId });
  } finally {
    if (slotAcquired && !isStreamingResponse) {
      releaseSlot(requestId).catch((err) => log.error('Error releasing slot', err));
    }
  }
}

// ── Data Analytics Helper (kept inline — small, tightly coupled to request) ──
async function tryDataAnalytics(
  lastUserContent: string,
  request: NextRequest,
  slotAcquired: boolean,
  requestId: string
): Promise<Response | null> {
  try {
    const spreadsheetMatch = lastUserContent.match(
      /\[(Spreadsheet|File):\s*([^\]\n]+\.(csv|xlsx?|xls))(?:\s*-[^\]]+)?\]/i
    );

    if (!spreadsheetMatch) return null;

    const fileName = spreadsheetMatch[2].trim();
    const isCSV = fileName.toLowerCase().endsWith('.csv');

    const fileHeaderIndex = lastUserContent.indexOf(spreadsheetMatch[0]);
    const contentStart = lastUserContent.indexOf('\n\n', fileHeaderIndex);
    if (contentStart === -1) return null;

    let fileContent = lastUserContent.substring(contentStart + 2);
    const delimiterIndex = fileContent.indexOf('\n\n---\n\n');
    if (delimiterIndex !== -1) {
      fileContent = fileContent.substring(0, delimiterIndex);
    }

    const userQuery =
      delimiterIndex !== -1
        ? lastUserContent.substring(lastUserContent.indexOf('\n\n---\n\n') + 7)
        : '';
    const wantsAnalysis =
      !userQuery.trim() ||
      /\b(analyze|analysis|chart|graph|visualize|show|insights?|stats?|statistics?|summarize|breakdown|trends?|patterns?|data)\b/i.test(
        userQuery
      );

    const hasDataStructure =
      fileContent.includes('\t') || fileContent.includes(',') || fileContent.includes('|');

    if (!wantsAnalysis || !hasDataStructure || fileContent.length <= 50) return null;

    log.info('Data analytics detected from embedded content', {
      fileName,
      isCSV,
      contentLength: fileContent.length,
    });

    const analyticsResponse = await fetch(new URL('/api/analytics', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        fileType: isCSV ? 'text/csv' : 'text/tab-separated-values',
        content: fileContent,
      }),
    });

    if (!analyticsResponse.ok) return null;

    const { analytics } = await analyticsResponse.json();
    if (!analytics) return null;

    if (slotAcquired) {
      await releaseSlot(requestId);
    }

    let responseText = `## Data Analysis: ${fileName}\n\n`;
    responseText += analytics.summary + '\n\n';

    if (analytics.insights?.length > 0) {
      responseText += '### Key Insights\n';
      for (const insight of analytics.insights) {
        responseText += `- **${insight.title}**: ${insight.value}\n`;
      }
      responseText += '\n';
    }

    if (analytics.suggestedQueries?.length > 0) {
      responseText += '*Ask me to:* ' + analytics.suggestedQueries.join(' | ');
    }

    return new Response(
      JSON.stringify({
        type: 'analytics',
        content: responseText,
        analytics,
        model: 'analytics-engine',
        provider: 'internal',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    log.debug('Analytics detection failed', { error });
    return null;
  }
}

export const runtime = 'nodejs';
