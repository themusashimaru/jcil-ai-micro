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
import { getUserBYOKConfig } from '@/lib/ai/byok';
import { getProviderAndModel } from '@/lib/ai/providers/registry';
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
    if (!sizeCheck.valid) {
      return (
        sizeCheck.response ??
        chatErrorResponse(HTTP_STATUS.BAD_REQUEST, {
          error: 'Request too large',
          code: ERROR_CODES.INVALID_INPUT,
          action: 'validate',
        })
      );
    }

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

    const { messages, temperature, max_tokens, searchMode, conversationId, thinking, deviceInfo } =
      validation.data;

    // ── Authentication + CSRF ──
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify(authResult.body), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { userId, isAdmin, userPlanKey, customInstructions, supabase } = authResult;

    // ── Context Loading (memory, learning, RAG) — parallel with timeout ──
    let memoryContext = '';
    let learningContext = '';
    let documentContext = '';
    const contextFailures: string[] = [];

    // Extract last user message once (used by RAG and observeAndLearn)
    const lastUserMsg = messages.filter((m: { role: string }) => m.role === 'user').pop();
    const lastUserMsgText = lastUserMsg
      ? typeof lastUserMsg.content === 'string'
        ? lastUserMsg.content
        : JSON.stringify(lastUserMsg.content)
      : '';

    // Helper: race a promise against a timeout
    const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
        ),
      ]);

    const CONTEXT_TIMEOUT_MS = 3000; // 3s max per context source

    // Load all contexts in parallel with individual timeouts
    const [memoryResult, learningResult, docResult] = await Promise.allSettled([
      withTimeout(getMemoryContext(userId), CONTEXT_TIMEOUT_MS, 'Memory'),
      withTimeout(getLearningContext(userId), CONTEXT_TIMEOUT_MS, 'Learning'),
      lastUserMsgText
        ? withTimeout(
            searchUserDocuments(userId, lastUserMsgText, { matchCount: 5 }),
            CONTEXT_TIMEOUT_MS,
            'RAG'
          )
        : Promise.resolve(null),
    ]);

    if (memoryResult.status === 'fulfilled' && memoryResult.value?.loaded) {
      memoryContext = memoryResult.value.contextString;
      log.debug('Loaded user memory', { userId });
    } else if (memoryResult.status === 'rejected') {
      log.warn('Failed to load user memory', {
        userId,
        error: (memoryResult.reason as Error).message,
      });
      contextFailures.push('saved memory');
    }

    if (learningResult.status === 'fulfilled' && learningResult.value?.loaded) {
      learningContext = learningResult.value.contextString;
      log.debug('Loaded user learning', { userId });
    } else if (learningResult.status === 'rejected') {
      log.warn('Failed to load user learning', {
        userId,
        error: (learningResult.reason as Error).message,
      });
      contextFailures.push('learned preferences');
    }

    if (docResult.status === 'fulfilled' && docResult.value?.contextString) {
      documentContext = docResult.value.contextString;
      log.debug('Found relevant documents', { userId });
    } else if (docResult.status === 'rejected') {
      log.warn('Failed to search user documents', {
        userId,
        error: (docResult.reason as Error).message,
      });
      contextFailures.push('uploaded documents');
    }

    // Fire-and-forget: observe message for learning signals
    if (lastUserMsgText) {
      observeAndLearn(userId, lastUserMsgText).catch((err: unknown) =>
        log.error('observeAndLearn failed', {
          userId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }

    // ── Rate Limiting & Quota ──
    let rateLimitRemaining: number | undefined;
    if (!isAdmin) {
      const rateLimit = await checkChatRateLimit(userId, true);
      rateLimitRemaining = rateLimit.remaining;
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

    // Note: slotAcquired is passed as current value. Slot release for non-streaming
    // doc responses is handled here in route.ts. For streaming (resume conversation),
    // the doc route manages it via ctx.slotAcquired + ctx.requestId.
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

    // Build system prompt with all context (smart tiered tool loading)
    const { tools, composioToolContext } = await loadAllTools(userId, lastUserContent);

    const fullSystemPrompt = buildFullSystemPrompt({
      customInstructions,
      memoryContext,
      learningContext,
      documentContext,
      composioAddition: composioToolContext?.systemPromptAddition,
      deviceInfo,
      contextFailures: contextFailures.length > 0 ? contextFailures : undefined,
    });

    log.debug('Available chat tools', { toolCount: tools.length });

    // Main chat always uses Claude — provider selection is only available in Code Lab via BYOK
    const {
      selectedModel: resolvedModel,
      selectedProviderId,
      error: providerError,
    } = resolveProvider('claude', userPlanKey);
    if (providerError) return providerError;

    // BYOK: Check if user has their own API key for the selected provider
    let userApiKey: string | undefined;
    let selectedModel = resolvedModel;
    const byokConfig = await getUserBYOKConfig(supabase, userId, selectedProviderId);
    if (byokConfig) {
      userApiKey = byokConfig.apiKey;
      if (byokConfig.model) {
        selectedModel = byokConfig.model;
      }
    }

    // Clamp max tokens using the model's actual output limit from the registry
    const modelInfo = getProviderAndModel(selectedModel);
    const clampedMaxTokens = clampMaxTokens(max_tokens, modelInfo?.model.maxOutputTokens);

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
      provider: 'claude' as const,
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
      userApiKey,
      rateLimitRemaining,
    };

    // All providers (Claude + BYOK non-Claude) go through the full chat router
    // with tool support. The chat router already handles multi-provider adapters.
    // Only fall back to the lightweight handleNonClaudeProvider for server-keyed
    // non-Claude providers that don't need tool support.
    const useFullRouter = selectedProviderId === 'claude' || !!userApiKey;

    if (!useFullRouter) {
      const response = handleNonClaudeProvider(streamConfig);
      // Only mark as streaming after the handler returns successfully
      isStreamingResponse = true;
      slotAcquired = false;
      return response;
    }

    // Full tool support for Claude and BYOK providers
    const response = await handleClaudeProvider({ ...streamConfig, pendingRequestId });
    // Only mark as streaming after the handler returns successfully
    isStreamingResponse = true;
    slotAcquired = false;
    return response;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    log.error('Unhandled chat error', {
      message: errMsg,
      stack: errStack?.split('\n').slice(0, 5).join('\n'),
      name: error instanceof Error ? error.name : typeof error,
    });

    // Surface a more specific message for known Anthropic API errors
    const lowerErr = errMsg.toLowerCase();
    let userMessage = 'Something went wrong. Please try again.';
    if (
      lowerErr.includes('tool') &&
      (lowerErr.includes('invalid') || lowerErr.includes('schema'))
    ) {
      userMessage = 'A tool configuration error occurred. The team has been notified.';
    } else if (
      lowerErr.includes('context') ||
      lowerErr.includes('too many tokens') ||
      lowerErr.includes('maximum')
    ) {
      userMessage = 'The conversation is too long. Please start a new chat.';
    } else if (lowerErr.includes('overloaded') || lowerErr.includes('529')) {
      userMessage = 'The AI service is temporarily at capacity. Please try again in a moment.';
    }

    return chatErrorResponse(HTTP_STATUS.INTERNAL_ERROR, {
      error: 'Internal server error',
      code: ERROR_CODES.INTERNAL_ERROR,
      message: userMessage,
      action: 'retry',
    });
  } finally {
    if (slotAcquired && !isStreamingResponse) {
      releaseSlot(requestId).catch((err) => log.error('Error releasing slot', err));
    }
  }
}

// ── Data Analytics Helper (direct call — no HTTP self-fetch) ──
async function tryDataAnalytics(
  lastUserContent: string,
  _request: NextRequest,
  slotAcquired: boolean,
  requestId: string
): Promise<Response | null> {
  try {
    const spreadsheetMatch = lastUserContent.match(
      /\[(Spreadsheet|File):\s*([^\]\n]+\.(csv|xlsx?|xls))(?:\s*-[^\]]+)?\]/i
    );

    if (!spreadsheetMatch) return null;

    const fileName = spreadsheetMatch[2].trim();

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
      contentLength: fileContent.length,
    });

    // Direct call to analytics utils (avoids unreliable HTTP self-fetch in serverless)
    const {
      parseCSV,
      detectColumnType,
      parseValue,
      calculateStats,
      generateInsights,
      generateCharts,
      generateSuggestions,
    } = await import('@/app/api/analytics/analytics-utils');
    const { v4: uuidv4 } = await import('uuid');

    const rows = parseCSV(fileContent);
    if (rows.length < 2) return null;

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const columns = headers.map((name: string, index: number) => {
      const values = dataRows.map((row: string[]) => row[index] || '');
      const type = detectColumnType(values);
      const numericValues: number[] = [];
      for (const val of values) {
        const parsed = parseValue(val, type);
        if (parsed !== null) numericValues.push(parsed);
      }
      return {
        name: name || `Column ${index + 1}`,
        type,
        values,
        numericValues,
        stats: numericValues.length > 0 ? calculateStats(numericValues) : undefined,
      };
    });

    const insights = generateInsights(columns);
    const charts = generateCharts(columns, dataRows);
    const numericColNames = columns
      .filter((c: { stats?: unknown }) => c.stats)
      .map((c: { name: string }) => c.name)
      .slice(0, 3)
      .join(', ');
    const summary = `Analyzed ${dataRows.length.toLocaleString()} records with ${columns.length} columns. ${
      numericColNames ? `Key metrics: ${numericColNames}.` : ''
    } ${charts.length > 0 ? `Generated ${charts.length} visualization(s).` : ''}`;

    const analytics = {
      id: uuidv4(),
      filename: fileName,
      summary,
      insights,
      charts,
      rawDataPreview: dataRows.slice(0, 10),
      totalRows: dataRows.length,
      totalColumns: columns.length,
      columnNames: headers,
      suggestedQueries: generateSuggestions(columns),
    };

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
    log.warn('Analytics detection/processing failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export const runtime = 'nodejs';
