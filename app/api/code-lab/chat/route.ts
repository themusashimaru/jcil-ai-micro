/**
 * CODE LAB CHAT API
 *
 * The unified chat endpoint that handles:
 * - Regular chat with Claude Opus 4.6
 * - Code generation via Code Agent V2
 * - Web search via Perplexity
 *
 * Opus decides which tool to use based on the request.
 */

import { NextRequest } from 'next/server';
import { CoreMessage } from 'ai';
import Anthropic from '@anthropic-ai/sdk';
import { requireUser } from '@/lib/auth/user-guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { chatErrorResponse } from '@/lib/api/utils';
import { ERROR_CODES, HTTP_STATUS } from '@/lib/constants';
import {
  executeCodeAgent,
  shouldUseCodeAgent as checkCodeAgentIntent,
} from '@/agents/code/integration';
import { perplexitySearch, isPerplexityConfigured } from '@/lib/perplexity/client';
import { orchestrateStream, shouldUseMultiAgent, getSuggestedAgents } from '@/lib/multi-agent';
import { executeWorkspaceAgent } from '@/lib/workspace/chat-integration';
import {
  processSlashCommand,
  isSlashCommand,
  parseSlashCommand,
} from '@/lib/workspace/slash-commands';
import { detectCodeLabIntent } from '@/lib/workspace/intent-detector';
import {
  createSecureServiceClient,
  extractRequestContext,
} from '@/lib/supabase/secure-service-role';
import { untypedFrom } from '@/lib/supabase/workspace-client';
import { logger } from '@/lib/logger';
import { safeDecrypt as decryptToken } from '@/lib/security/crypto';
import { getProviderForModel, getProviderAndModel } from '@/lib/ai/providers/registry';
import { getAdapter } from '@/lib/ai/providers/adapters/factory';
import type {
  UnifiedMessage,
  UnifiedToolCall,
  UnifiedTool,
  ProviderId,
} from '@/lib/ai/providers/types';
import { routeChatWithTools, type ToolExecutor } from '@/lib/ai/chat-router';
import { getMemoryContext, processConversationForMemory } from '@/lib/memory';
import { getLearningContext, observeAndLearn } from '@/lib/learning';
import { searchUserDocuments } from '@/lib/documents/userSearch';
import { getAvailableChatTools, executeChatTool } from '@/lib/ai/tools';
import {
  getComposioToolsForUser,
  executeComposioTool,
  isComposioTool,
  isComposioConfigured,
} from '@/lib/composio';
import { trackTokenUsage } from '@/lib/usage/track';
import {
  canMakeRequest,
  getTokenUsage,
  getTokenLimitWarningMessage,
  incrementTokenUsage,
} from '@/lib/limits';

// Decomposed modules
import { shouldUseSearch } from './search-detection';
import { getUserBYOKConfig } from './byok';
import {
  generateConversationSummary,
  getAnthropicClient,
  SUMMARY_THRESHOLD,
  RECENT_MESSAGES_AFTER_SUMMARY,
} from './conversation-summary';
import { checkRateLimit } from './chat-rate-limit';
import { executeActionCommand } from './action-commands';
import {
  generateId,
  STREAM_HEADERS,
  CHUNK_TIMEOUT_MS,
  createKeepalive,
  saveAssistantMessage,
  createAgentStreamResponse,
  formatProviderErrorMessage,
} from './stream-utils';

const log = logger('CodeLabChat');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export async function POST(request: NextRequest) {
  // Centralized auth with built-in CSRF protection
  const auth = await requireUser(request);
  if (!auth.authorized) return auth.response;
  const { user, supabase } = auth;

  try {
    // Rate limiting to prevent abuse
    const { allowed } = checkRateLimit(user.id);
    if (!allowed) {
      log.warn('Rate limit exceeded', { userId: user.id });
      return chatErrorResponse(HTTP_STATUS.TOO_MANY_REQUESTS, {
        error: 'Rate limit exceeded',
        code: ERROR_CODES.RATE_LIMITED,
        message: 'Please wait a moment before sending more messages.',
        retryAfter: 60,
        action: 'retry',
      });
    }

    const body = await request.json();
    const { sessionId, content, repo, attachments, forceSearch, modelId, thinking } = body;

    // Input validation - max content length to prevent abuse
    const MAX_CONTENT_LENGTH = 100000;
    if (content && typeof content === 'string' && content.length > MAX_CONTENT_LENGTH) {
      return chatErrorResponse(HTTP_STATUS.BAD_REQUEST, {
        error: 'Message too long',
        code: ERROR_CODES.REQUEST_TOO_LARGE,
        message: `Message exceeds maximum length of ${MAX_CONTENT_LENGTH} characters.`,
        action: 'validate',
      });
    }

    // Model selection - default to Opus 4.6
    const selectedModel = modelId || 'claude-opus-4-6';
    const thinkingEnabled = thinking?.enabled === true;
    const thinkingBudget = thinking?.budgetTokens || 10000;

    if (!sessionId || (!content && (!attachments || attachments.length === 0))) {
      return chatErrorResponse(HTTP_STATUS.BAD_REQUEST, {
        error: 'Missing sessionId or content',
        code: ERROR_CODES.INVALID_INPUT,
        action: 'validate',
      });
    }

    // Load user's GitHub token and subscription tier
    let userGitHubToken: string | undefined;
    let userPlanKey = 'free';
    try {
      const adminClient = createServiceRoleClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userData } = await (adminClient as any)
        .from('users')
        .select('github_token, subscription_tier, is_admin')
        .eq('id', user.id)
        .single();
      if (userData?.github_token) {
        const decrypted = decryptToken(userData.github_token);
        if (decrypted) {
          userGitHubToken = decrypted;
        }
      }
      userPlanKey = userData?.subscription_tier || 'free';
    } catch {
      // User data loading should never block chat
    }

    // Token quota enforcement
    const canProceed = await canMakeRequest(user.id, userPlanKey);
    if (!canProceed) {
      const usage = await getTokenUsage(user.id, userPlanKey);
      const isFreeUser = userPlanKey === 'free';
      const warningMessage = getTokenLimitWarningMessage(usage, isFreeUser);

      log.warn('Token quota exceeded', {
        userId: user.id,
        plan: userPlanKey,
        usage: usage.percentage,
      });

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

    // Process attachments for Claude vision
    interface AttachmentData {
      name: string;
      type: string;
      data: string;
    }
    const imageAttachments = ((attachments as AttachmentData[]) || []).filter((a: AttachmentData) =>
      a.type.startsWith('image/')
    );
    const documentAttachments = ((attachments as AttachmentData[]) || []).filter(
      (a: AttachmentData) => !a.type.startsWith('image/')
    );

    // Build content with document info
    let enhancedContent = content || '';
    if (documentAttachments.length > 0) {
      enhancedContent +=
        '\n\n[Attached documents: ' +
        documentAttachments.map((d: AttachmentData) => d.name).join(', ') +
        ']';
    }

    // Process slash commands
    let slashCommandFailed = false;
    let slashCommandError = '';
    let isActionCommand = false;
    let actionResponse = '';

    if (isSlashCommand(enhancedContent)) {
      const parsed = parseSlashCommand(enhancedContent);
      if (parsed) {
        const processedPrompt = processSlashCommand(enhancedContent, {
          userId: user.id,
          sessionId,
          repo: repo
            ? {
                owner: repo.owner,
                name: repo.name,
                branch: repo.branch || 'main',
              }
            : undefined,
        });
        if (processedPrompt) {
          log.debug('Slash command detected', { command: content?.substring(0, 50) });

          if (processedPrompt === '[CLEAR_HISTORY]') {
            isActionCommand = true;
            actionResponse = '**History cleared.** Starting fresh conversation.';
          } else if (processedPrompt.startsWith('[RESET_SESSION]')) {
            isActionCommand = true;
            actionResponse = '**Session reset.** All preferences restored to defaults.';
          } else if (processedPrompt.startsWith('[COMPACT_CONTEXT]')) {
            isActionCommand = true;
            actionResponse = '**Context compacted.** Older messages summarized to free up space.';
          } else {
            enhancedContent = processedPrompt;
          }
        }
      } else {
        const commandName = enhancedContent.split(' ')[0];
        slashCommandFailed = true;
        slashCommandError = `Unknown command: ${commandName}. Try /help to see available commands.`;
        log.debug('Unknown slash command', { command: commandName });
      }
    }

    // Verify session ownership
    const { data: currentSession, error: sessionFetchError } = await (
      supabase.from('code_lab_sessions') as AnySupabase
    )
      .select('message_count, user_id')
      .eq('id', sessionId)
      .single();

    if (sessionFetchError) {
      log.warn('Failed to get session', { error: sessionFetchError.message });
      return chatErrorResponse(HTTP_STATUS.NOT_FOUND, {
        error: 'Session not found',
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (currentSession.user_id !== user.id) {
      log.warn('Session ownership violation attempt', {
        sessionId,
        requestingUser: user.id,
        sessionOwner: currentSession.user_id,
      });
      return chatErrorResponse(HTTP_STATUS.FORBIDDEN, {
        error: 'Access denied',
        code: ERROR_CODES.FORBIDDEN,
        message: 'You do not have access to this session.',
      });
    }

    // Handle action commands (ownership verified)
    if (isActionCommand) {
      return executeActionCommand(actionResponse, sessionId, supabase);
    }

    // Intent detection
    const intentResult = detectCodeLabIntent(enhancedContent);
    log.debug('Intent detected', {
      type: intentResult.type,
      confidence: intentResult.confidence,
      workspace: intentResult.shouldUseWorkspace,
    });

    // Save user message
    const userMessageId = generateId();
    const { error: msgError } = await (supabase.from('code_lab_messages') as AnySupabase).insert({
      id: userMessageId,
      session_id: sessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    });

    if (msgError) {
      log.warn('Failed to save user message', { error: msgError.message });
    }

    // Update session timestamp and message count
    const { error: updateError } = await (supabase.from('code_lab_sessions') as AnySupabase)
      .update({
        updated_at: new Date().toISOString(),
        message_count: (currentSession?.message_count || 0) + 1,
      })
      .eq('id', sessionId);

    if (updateError) {
      log.warn('Failed to update session', { error: updateError.message });
    }

    // Get conversation history with auto-summarization
    const { data: allMessages } = await (supabase.from('code_lab_messages') as AnySupabase)
      .select('id, role, content, type')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    const existingSummary = (allMessages || []).find((m: { type: string }) => m.type === 'summary');
    let history: Array<{ role: string; content: string }> = [];
    const messageCount = currentSession?.message_count || 0;

    if (messageCount > SUMMARY_THRESHOLD && !existingSummary) {
      log.info('Auto-summarizing conversation', { messageCount });

      const messagesToSummarize = (allMessages || [])
        .filter((m: { type: string }) => m.type !== 'summary')
        .slice(0, -RECENT_MESSAGES_AFTER_SUMMARY);

      if (messagesToSummarize.length > 0) {
        try {
          const summary = await generateConversationSummary(
            messagesToSummarize.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            }))
          );

          const { error: insertError } = await (
            supabase.from('code_lab_messages') as AnySupabase
          ).insert({
            id: generateId(),
            session_id: sessionId,
            role: 'system',
            content: summary,
            created_at: new Date().toISOString(),
            type: 'summary',
          });

          if (insertError) {
            log.error('Failed to save summary', { error: insertError.message });
            history = (allMessages || [])
              .slice(-20)
              .map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              }));
          } else {
            await (supabase.from('code_lab_sessions') as AnySupabase)
              .update({ has_summary: true, last_summary_at: new Date().toISOString() })
              .eq('id', sessionId);

            history = [
              { role: 'system', content: `[Previous conversation summary]\n${summary}` },
              ...(allMessages || [])
                .filter((m: { type: string }) => m.type !== 'summary')
                .slice(-RECENT_MESSAGES_AFTER_SUMMARY)
                .map((m: { role: string; content: string }) => ({
                  role: m.role,
                  content: m.content,
                })),
            ];
          }
        } catch (err) {
          log.error('Summary generation failed', err as Error);
          history = (allMessages || []).slice(-20).map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          }));
        }
      }
    } else if (existingSummary) {
      const summaryIndex = (allMessages || []).findIndex(
        (m: { id: string }) => m.id === existingSummary.id
      );
      history = [
        { role: 'system', content: `[Previous conversation summary]\n${existingSummary.content}` },
        ...(allMessages || [])
          .slice(summaryIndex + 1)
          .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
      ];
    } else {
      history = (allMessages || []).slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }));
    }

    // Handle slash command failures
    if (slashCommandFailed) {
      const errorMessageId = generateId();
      const errorContent = `**${slashCommandError}**\n\nAvailable commands:\n- \`/fix\` - Fix errors in the codebase\n- \`/test\` - Run tests\n- \`/build\` - Run build\n- \`/commit\` - Commit changes\n- \`/push\` - Push to remote\n- \`/review\` - Code review\n- \`/explain\` - Explain code\n- \`/workspace\` - Enable sandbox mode\n- \`/help\` - Show all commands`;

      await (supabase.from('code_lab_messages') as AnySupabase).insert({
        id: errorMessageId,
        session_id: sessionId,
        role: 'assistant',
        content: errorContent,
        created_at: new Date().toISOString(),
      });

      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(errorContent));
            controller.close();
          },
        }),
        {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Message-Id': errorMessageId,
          },
        }
      );
    }

    // Detect intent routing
    const useCodeAgent = checkCodeAgentIntent(enhancedContent);
    const useSearch = forceSearch || shouldUseSearch(enhancedContent);
    const useMultiAgent = shouldUseMultiAgent(enhancedContent);
    const useWorkspaceAgent = intentResult.shouldUseWorkspace;

    // ========================================
    // WORKSPACE AGENT - E2B Sandbox Execution
    // ========================================
    const { data: workspaceData, error: workspaceError } = await (
      supabase.from('code_lab_workspaces') as AnySupabase
    )
      .select('id, sandbox_id, status')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (workspaceError) {
      log.warn('Failed to query workspace', { error: workspaceError.message, sessionId });
    }

    const forceWorkspace =
      body.useWorkspace === true ||
      enhancedContent.toLowerCase().includes('/workspace') ||
      enhancedContent.toLowerCase().includes('/sandbox') ||
      enhancedContent.toLowerCase().includes('/execute');

    const shouldActivateWorkspace =
      (workspaceData?.id && useWorkspaceAgent && intentResult.confidence >= 50) || forceWorkspace;

    if (shouldActivateWorkspace) {
      log.info('Using Workspace Agent (E2B sandbox mode)');

      let workspaceId = workspaceData?.id;
      const sandboxId = workspaceData?.sandbox_id;

      if (!workspaceId) {
        const newSandboxId = `sandbox-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const { data: newWorkspace, error: wsError } = await (
          supabase.from('code_lab_workspaces') as AnySupabase
        )
          .insert({
            user_id: user.id,
            session_id: sessionId,
            sandbox_id: sandboxId || newSandboxId,
            template: 'nodejs',
            status: 'active',
            created_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (wsError) {
          log.error('Failed to create workspace', { error: wsError ?? 'Unknown error' });
        }
        workspaceId = newWorkspace?.id;
      }

      if (workspaceId) {
        const { error: activityError } = await (supabase.from('code_lab_workspaces') as AnySupabase)
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', workspaceId);

        if (activityError) {
          log.warn('Failed to update workspace activity', { error: activityError.message });
        }

        const workspaceStream = await executeWorkspaceAgent(content, {
          workspaceId: sessionId,
          userId: user.id,
          sessionId,
          history: (history || []).map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        });

        return createAgentStreamResponse(
          workspaceStream,
          supabase,
          sessionId,
          'workspace',
          'Workspace Agent'
        );
      }
    }

    // ========================================
    // CODE AGENT V2 - Full Project Generation
    // ========================================
    if (useCodeAgent) {
      const secureClient = createSecureServiceClient(
        { id: user.id, email: user.email || undefined },
        extractRequestContext(request, '/api/code-lab/chat')
      );

      const encryptedToken = await secureClient.getUserGitHubToken(user.id);
      let githubToken: string | undefined;
      if (encryptedToken) {
        const decrypted = decryptToken(encryptedToken);
        if (decrypted) {
          githubToken = decrypted;
        } else {
          log.warn('GitHub token decryption failed - proceeding without GitHub access');
        }
      }

      const codeAgentStream = await executeCodeAgent(content, {
        userId: user.id,
        conversationId: sessionId,
        previousMessages: (history || []).map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
        githubToken,
        selectedRepo: repo
          ? { owner: repo.owner, repo: repo.name, fullName: repo.fullName }
          : undefined,
        skipClarification:
          content.toLowerCase().includes('just build') ||
          content.toLowerCase().includes('proceed') ||
          content.toLowerCase().includes('go ahead'),
      });

      return createAgentStreamResponse(codeAgentStream, supabase, sessionId, 'code', 'Code Agent');
    }

    // ========================================
    // MULTI-AGENT MODE - Specialized Agents
    // ========================================
    if (useMultiAgent) {
      const suggestedAgents = getSuggestedAgents(enhancedContent);
      log.info('Multi-Agent mode activated', { agents: suggestedAgents });

      const encoder = new TextEncoder();
      let fullContent = '';
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const agentStream = orchestrateStream(enhancedContent, {
              userId: user.id,
              sessionId,
              repo: repo
                ? {
                    owner: repo.owner,
                    name: repo.name,
                    branch: repo.branch || 'main',
                    fullName: repo.fullName,
                  }
                : undefined,
              previousMessages: (history || []).map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              })),
            });

            for await (const chunk of agentStream) {
              fullContent += chunk;
              controller.enqueue(encoder.encode(chunk));
            }

            await saveAssistantMessage(supabase, sessionId, fullContent, 'multi-agent');
            controller.close();
          } catch (error) {
            log.error('Multi-Agent error', error as Error);
            const errorContent =
              '\n\nI encountered an error with the multi-agent system. Please try again.';
            fullContent += errorContent;
            await saveAssistantMessage(supabase, sessionId, fullContent || errorContent, 'error');
            controller.enqueue(encoder.encode(errorContent));
            controller.close();
          }
        },
      });

      return new Response(stream, { headers: STREAM_HEADERS });
    }

    // ========================================
    // PERPLEXITY SEARCH - Real-time Web Search
    // ========================================
    if (useSearch && isPerplexityConfigured()) {
      const encoder = new TextEncoder();
      let fullContent = '';
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const searchResult = await perplexitySearch({
              query: content,
              systemPrompt: `You are a developer-focused search assistant. Provide accurate, technical information.
Format your response with:
1. Direct answer to the question
2. Code examples if relevant (with language tags)
3. Best practices or tips
Keep it professional and focused on development.`,
            });

            fullContent = searchResult.answer;

            if (searchResult.sources && searchResult.sources.length > 0) {
              fullContent += '\n\n---\n\n**Sources:**\n';
              searchResult.sources.slice(0, 5).forEach((source, i) => {
                fullContent += `${i + 1}. [${source.title || 'Source'}](${source.url})\n`;
              });
            }

            controller.enqueue(encoder.encode(fullContent));

            await (supabase.from('code_lab_messages') as AnySupabase).insert({
              id: generateId(),
              session_id: sessionId,
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
              type: 'search',
              search_output: JSON.stringify({
                query: content,
                sources: searchResult.sources,
                model: searchResult.model,
              }),
            });

            controller.close();
          } catch (error) {
            log.error('Perplexity search error', error as Error);
            controller.enqueue(encoder.encode('`Search unavailable, using knowledge base...`\n\n'));

            try {
              const anthropic = getAnthropicClient();
              const fallbackModelInfo = getProviderAndModel(selectedModel);
              const fallbackResponse = await anthropic.messages.create({
                model: selectedModel,
                max_tokens: fallbackModelInfo?.model.maxOutputTokens || 16384,
                system: `You are Claude in Code Lab. The user asked a search question but web search failed.
Provide the best answer you can from your training knowledge.
Be honest about knowledge cutoff limitations when relevant.`,
                messages: [{ role: 'user', content }],
              });

              let fallbackContent = '';
              for (const block of fallbackResponse.content) {
                if (block.type === 'text') {
                  fallbackContent += block.text;
                  controller.enqueue(encoder.encode(block.text));
                }
              }

              await saveAssistantMessage(supabase, sessionId, fallbackContent, 'search');
            } catch (fallbackError) {
              log.error('Fallback error', fallbackError as Error);
              const errorContent = '\n\nI encountered an error. Please try again.';
              await saveAssistantMessage(supabase, sessionId, errorContent, 'error');
              controller.enqueue(encoder.encode(errorContent));
            }

            controller.close();
          }
        },
      });

      return new Response(stream, { headers: STREAM_HEADERS });
    }

    // ========================================
    // REGULAR CHAT - Multi-Provider Support
    // ========================================
    const providerId = getProviderForModel(selectedModel);
    const providerInfo = getProviderAndModel(selectedModel);

    log.info('Chat request', {
      model: selectedModel,
      provider: providerId || 'unknown',
      modelName: providerInfo?.model.name || 'unknown',
    });

    // Build system prompt
    const hasRepo = repo && repo.fullName;
    const hasImages = imageAttachments.length > 0;

    let systemPrompt = buildSystemPrompt(hasRepo, hasImages, repo, imageAttachments);

    // Inject CLAUDE.md memory
    const { data: sessionWithSettings } = await untypedFrom(supabase, 'code_lab_sessions')
      .select('settings')
      .eq('id', sessionId)
      .single();

    const memoryContent = sessionWithSettings?.settings?.memory_content;
    if (memoryContent && memoryContent.trim()) {
      systemPrompt += `\n\n---\n# Project Memory\n\nThe user has defined the following project-specific context and instructions:\n\n${memoryContent}\n\n---\nIMPORTANT: Follow the instructions above. They represent the user's preferences for this project.`;
      log.info('Injected memory context', { length: memoryContent.length });
    }

    // Persistent memory
    try {
      const memoryCtx = await getMemoryContext(user.id);
      if (memoryCtx.loaded && memoryCtx.contextString) {
        systemPrompt += `\n\n${memoryCtx.contextString}`;
        log.info('Injected persistent user memory');
      }
    } catch (memErr) {
      log.warn('Failed to load persistent memory', { error: memErr });
    }

    // Learned style preferences
    try {
      const learning = await getLearningContext(user.id);
      if (learning.loaded && learning.contextString) {
        systemPrompt += `\n\n${learning.contextString}`;
        log.info('Injected learned style preferences');
      }
    } catch (learnErr) {
      log.warn('Failed to load learning context', { error: learnErr });
    }

    // Fire-and-forget: observe current message for learning signals
    observeAndLearn(user.id, content).catch((err: unknown) =>
      log.error('observeAndLearn failed', err instanceof Error ? err : undefined)
    );

    // RAG - Document Context
    try {
      const docSearch = await searchUserDocuments(user.id, content, { matchCount: 3 });
      if (docSearch?.contextString) {
        systemPrompt += `\n\n${docSearch.contextString}`;
        log.info('Injected document context (RAG)', { length: docSearch.contextString.length });
      }
    } catch (ragErr) {
      log.warn('Failed to search user documents', { error: ragErr });
    }

    // Follow-up suggestions
    systemPrompt += `\n\nFOLLOW-UP SUGGESTIONS:\nAt the end of substantive responses (NOT greetings, NOT simple yes/no answers), include exactly 2-3 intelligent follow-up questions the user might want to ask next. Format them as:\n<suggested-followups>\n["Question 1?", "Question 2?", "Question 3?"]\n</suggested-followups>\nRules:\n- Questions should feel natural and insightful, like what a smart developer would ask next\n- They should deepen the conversation, not repeat what was already covered\n- Keep each question under 60 characters\n- Do NOT include follow-ups for greetings or one-word answers\n- The follow-ups tag must be the VERY LAST thing in your response`;

    // Load tools
    let chatTools: Awaited<ReturnType<typeof getAvailableChatTools>> = [];
    try {
      chatTools = await getAvailableChatTools();
      log.info('Loaded chat tools for Code Lab', { count: chatTools.length });
    } catch (toolErr) {
      log.warn('Failed to load chat tools', { error: toolErr });
    }

    // Composio / Connectors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let composioToolContext: any = null;
    if (isComposioConfigured()) {
      try {
        composioToolContext = await getComposioToolsForUser(user.id);
        if (composioToolContext?.tools?.length > 0) {
          for (const composioTool of composioToolContext.tools) {
            chatTools.push({
              name: composioTool.name,
              description: composioTool.description,
              parameters: composioTool.input_schema,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
          }
          log.info('Loaded Composio tools for Code Lab', {
            count: composioToolContext.tools.length,
            hasGitHub: composioToolContext.hasGitHub,
          });

          if (composioToolContext.systemPromptAddition) {
            systemPrompt += composioToolContext.systemPromptAddition;
          }
        }
      } catch (composioErr) {
        log.warn('Failed to load Composio tools', { error: composioErr });
      }
    }

    // Deduplicate tools by name — Anthropic rejects duplicate tool names
    const seenToolNames = new Set<string>();
    chatTools = chatTools.filter((t) => {
      if (seenToolNames.has(t.name)) {
        log.warn('Skipped duplicate tool name in Code Lab', { tool: t.name });
        return false;
      }
      seenToolNames.add(t.name);
      return true;
    });

    const encoder = new TextEncoder();

    // ========================================
    // NON-CLAUDE PROVIDERS (OpenAI, xAI, DeepSeek, Google)
    // For BYOK users, pass tools so they get full capability parity.
    // ========================================
    if (providerId && providerId !== 'claude') {
      return handleNonClaudeProvider(
        providerId,
        selectedModel,
        providerInfo,
        supabase,
        user,
        history,
        enhancedContent,
        imageAttachments,
        systemPrompt,
        sessionId,
        encoder,
        chatTools
      );
    }

    // ========================================
    // CLAUDE PROVIDER (Anthropic) - Default
    // ========================================
    return handleClaudeProvider(
      supabase,
      user,
      history,
      enhancedContent,
      imageAttachments,
      systemPrompt,
      chatTools,
      selectedModel,
      modelId,
      thinkingEnabled,
      thinkingBudget,
      sessionId,
      content,
      userPlanKey,
      userGitHubToken,
      useSearch,
      encoder
    );
  } catch (error) {
    log.error('Request error', error as Error);
    return chatErrorResponse(HTTP_STATUS.INTERNAL_ERROR, {
      error: 'Internal server error',
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
}

// ========================================
// SYSTEM PROMPT BUILDER
// ========================================
function buildSystemPrompt(
  hasRepo: boolean,
  hasImages: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repo: any,
  imageAttachments: Array<{ name: string; type: string; data: string }>
): string {
  return `You are a highly capable AI assistant in Code Lab - a professional developer workspace.

You help developers with:
- Building code and applications
- Debugging and fixing issues
- Searching documentation
- Explaining concepts
- Code review and best practices
${hasImages ? '- Analyzing screenshots and images (you have vision capabilities)' : ''}

## CURRENT SESSION CONTEXT

${
  hasRepo
    ? `**Repository Connected:** ${repo.fullName} (branch: ${repo.branch || 'main'})
You can reference this repository and help with code within it.`
    : `**No Repository Connected**
The user has not connected a repository to this session. Do NOT assume you have access to any codebase or project files. If the user asks about code, ask them to either:
1. Paste the relevant code in the chat
2. Upload files as attachments
3. Connect a repository from the sidebar`
}

${
  hasImages
    ? `**Files Attached:** ${imageAttachments.length} image(s)
Analyze the attached images carefully and provide helpful feedback.`
    : ''
}

## BEHAVIOR GUIDELINES

- **Only work with what you have.** Do not assume access to files, repos, or code that hasn't been explicitly shared with you.
- **Ask clarifying questions** when the user's request is ambiguous or when you need more context.
- **Don't over-analyze.** If the user asks a simple question, give a simple answer. Don't volunteer to analyze non-existent code.
- **Be direct and helpful.** Focus on what the user actually asked for.
- **When the user shares code**, work with that specific code - don't ask to see their whole project unless necessary.

## FORMATTING

- Keep responses clear, professional, and focused
- Use markdown for formatting
- Use code blocks with language tags
- When showing terminal commands, use \`\`\`bash blocks
- Be concise but thorough
- Provide working, tested code
- Explain your reasoning briefly`;
}

// ========================================
// NON-CLAUDE PROVIDER HANDLER
// ========================================
async function handleNonClaudeProvider(
  providerId: string,
  selectedModel: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providerInfo: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any,
  history: Array<{ role: string; content: string }>,
  enhancedContent: string,
  imageAttachments: Array<{ name: string; type: string; data: string }>,
  systemPrompt: string,
  sessionId: string,
  encoder: TextEncoder,
  chatTools: Awaited<ReturnType<typeof getAvailableChatTools>> = []
): Promise<Response> {
  log.info('Using non-Claude provider', { providerId, model: selectedModel });

  // Check for BYOK early — if present, route through the full chat router with tools
  const byokConfig = await getUserBYOKConfig(supabase, user.id, providerId);
  const userApiKey = byokConfig?.apiKey || null;
  const effectiveModel = byokConfig?.model || selectedModel;

  // BYOK users get routed through routeChatWithTools for full tool support
  if (userApiKey && chatTools.length > 0) {
    log.info('BYOK detected — routing through full chat router with tools', {
      providerId,
      model: effectiveModel,
      toolCount: chatTools.length,
    });

    // Build CoreMessage array from history + current message
    const coreMessages: CoreMessage[] = (history || []).map(
      (m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })
    );
    if (enhancedContent) {
      coreMessages.push({ role: 'user', content: enhancedContent });
    }

    // Convert tools to unified format
    const unifiedTools: UnifiedTool[] = chatTools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: 'object' as const, properties: {} },
    }));

    // Create tool executor (single tool call → single result)
    const toolExec: ToolExecutor = async (toolCall) => {
      try {
        const result = await executeChatTool(toolCall);
        return {
          toolCallId: toolCall.id,
          content:
            typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
          isError: result.isError || false,
        };
      } catch (err) {
        return {
          toolCallId: toolCall.id,
          content: `Tool error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          isError: true,
        };
      }
    };

    const routeResult = await routeChatWithTools(
      coreMessages,
      {
        providerId: providerId as ProviderId,
        model: effectiveModel,
        systemPrompt,
        maxTokens: providerInfo?.model.maxOutputTokens || 8192,
        temperature: 0.7,
        tools: unifiedTools,
        userApiKey,
        onUsage: (usage) => {
          trackTokenUsage({
            userId: user.id,
            modelName: effectiveModel,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            source: 'code-lab',
            conversationId: sessionId,
          }).catch((err: unknown) =>
            log.error('Token tracking failed', err instanceof Error ? err : undefined)
          );
        },
      },
      toolExec
    );

    // Wrap the stream to capture content for DB save
    const wrappedStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        ctrl.enqueue(chunk);
      },
      flush() {
        // Content is saved via usage callback; no extra action needed
      },
    });

    const finalStream = routeResult.stream.pipeThrough(wrappedStream);
    return new Response(finalStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Model-Used': routeResult.model,
        'X-Provider': routeResult.providerId,
        'X-Used-Tools': routeResult.usedTools ? 'true' : 'false',
        'X-Tools-Used': routeResult.toolsUsed.join(',') || 'none',
      },
    });
  }

  // Server-keyed non-Claude providers — simple adapter path (no tools)
  const stream = new ReadableStream({
    async start(controller) {
      const keepalive = createKeepalive(controller, encoder);
      let fullContent = '';

      try {
        // Validate API key availability (no BYOK at this point)
        if (!userApiKey) {
          const apiKeyEnvMap: Record<string, string[]> = {
            openai: ['OPENAI_API_KEY', 'OPENAI_API_KEY_1'],
            xai: ['XAI_API_KEY', 'XAI_API_KEY_1'],
            deepseek: ['DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY_1'],
            google: ['GEMINI_API_KEY', 'GEMINI_API_KEY_1'],
          };
          const requiredEnvVars = apiKeyEnvMap[providerId];
          if (requiredEnvVars) {
            const hasAnyKey = requiredEnvVars.some((envVar) => process.env[envVar]);
            if (!hasAnyKey) {
              const primaryKey = requiredEnvVars[0];
              throw new Error(
                `${primaryKey} is not configured. Add your own API key in Settings, or contact the administrator.`
              );
            }
          }
        }

        const adapter = getAdapter(providerId as ProviderId);

        const unifiedMessages: UnifiedMessage[] = (history || []).map(
          (m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })
        );

        // Build user message with vision
        const userContentBlocks: Array<
          | { type: 'text'; text: string }
          | { type: 'image'; source: { type: 'base64'; mediaType: string; data: string } }
        > = [];

        if (enhancedContent) {
          userContentBlocks.push({ type: 'text', text: enhancedContent });
        }

        for (const img of imageAttachments) {
          const base64Data = img.data.split(',')[1] || img.data;
          userContentBlocks.push({
            type: 'image',
            source: { type: 'base64', mediaType: img.type, data: base64Data },
          });
        }

        if (userContentBlocks.length > 0) {
          unifiedMessages.push({
            role: 'user',
            content:
              userContentBlocks.length === 1 && userContentBlocks[0].type === 'text'
                ? userContentBlocks[0].text
                : userContentBlocks,
          });
        }

        keepalive.start();

        let inputTokens = 0;
        let outputTokens = 0;

        const chatStream = adapter.chat(unifiedMessages, {
          model: effectiveModel,
          maxTokens: providerInfo?.model.maxOutputTokens || 8192,
          temperature: 0.7,
          systemPrompt,
        });

        for await (const chunk of chatStream) {
          keepalive.touch();

          if (chunk.type === 'text') {
            fullContent += chunk.text;
            controller.enqueue(encoder.encode(chunk.text));
          } else if (chunk.type === 'error' && chunk.error) {
            log.error('Adapter stream error', {
              code: chunk.error.code,
              message: chunk.error.message,
            });
            throw new Error(chunk.error.message);
          } else if (chunk.type === 'message_end' && chunk.usage) {
            inputTokens = chunk.usage.inputTokens || 0;
            outputTokens = chunk.usage.outputTokens || 0;
          }
        }

        // Send token usage marker
        if (inputTokens > 0 || outputTokens > 0) {
          const usageMarker = `\n<!--USAGE:${JSON.stringify({
            input: inputTokens,
            output: outputTokens,
            cacheRead: 0,
            cacheWrite: 0,
            model: selectedModel,
          })}-->`;
          controller.enqueue(encoder.encode(usageMarker));
        }

        await saveAssistantMessage(supabase, sessionId, fullContent, 'chat', selectedModel);
        controller.close();
      } catch (error) {
        log.error('Stream error', error as Error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const userMessage = formatProviderErrorMessage(errorMessage, providerId);

        fullContent += userMessage;
        await saveAssistantMessage(
          supabase,
          sessionId,
          fullContent || userMessage,
          'error',
          selectedModel
        );
        controller.enqueue(encoder.encode(userMessage));
        controller.close();
      } finally {
        keepalive.stop();
      }
    },
  });

  return new Response(stream, { headers: STREAM_HEADERS });
}

// ========================================
// CLAUDE PROVIDER HANDLER
// ========================================
async function handleClaudeProvider(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any,
  history: Array<{ role: string; content: string }>,
  enhancedContent: string,
  imageAttachments: Array<{ name: string; type: string; data: string }>,
  systemPrompt: string,
  chatTools: Awaited<ReturnType<typeof getAvailableChatTools>>,
  selectedModel: string,
  modelId: string | undefined,
  thinkingEnabled: boolean,
  thinkingBudget: number,
  sessionId: string,
  content: string,
  userPlanKey: string,
  userGitHubToken: string | undefined,
  useSearch: boolean,
  encoder: TextEncoder
): Promise<Response> {
  const anthropic = getAnthropicClient();

  const messages: Anthropic.MessageParam[] = (history || []).map(
    (m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })
  );

  // Build user message with vision
  type MessageContent = Anthropic.TextBlockParam | Anthropic.ImageBlockParam;
  const userContent: MessageContent[] = [];

  if (enhancedContent) {
    userContent.push({ type: 'text', text: enhancedContent });
  }

  for (const img of imageAttachments) {
    const base64Data = img.data.split(',')[1] || img.data;
    const mediaType = img.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64Data },
    });
  }

  if (userContent.length > 0) {
    messages.push({ role: 'user', content: userContent });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const keepalive = createKeepalive(controller, encoder);
      let fullContent = '';

      try {
        // BYOK check
        const claudeByokConfig = await getUserBYOKConfig(supabase, user.id, 'claude');
        const anthropicClient = claudeByokConfig?.apiKey
          ? new Anthropic({ apiKey: claudeByokConfig.apiKey })
          : anthropic;

        // Model routing
        let effectiveModel: string;
        if (claudeByokConfig?.model) {
          effectiveModel = claudeByokConfig.model;
          log.info('Using BYOK custom model', { model: effectiveModel });
        } else if (modelId) {
          effectiveModel = modelId;
          log.info('Using user-selected model', { model: effectiveModel });
        } else {
          effectiveModel = 'claude-opus-4-6';
          log.info('Using default Opus 4.6 for Code Lab', { model: effectiveModel });
        }

        // Build API parameters — use the model's actual output limit
        const modelInfo = getProviderAndModel(effectiveModel);
        const modelMaxTokens = modelInfo?.model.maxOutputTokens || 16384;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apiParams: any = {
          model: effectiveModel,
          max_tokens: modelMaxTokens,
          system: systemPrompt,
          messages,
          stream: true,
        };

        if (chatTools.length > 0) {
          apiParams.tools = chatTools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters || { type: 'object', properties: {} },
          }));
          log.info('Added tools to Code Lab Claude request', { count: chatTools.length });
        }

        // Extended thinking
        if (
          thinkingEnabled &&
          (effectiveModel.includes('sonnet') || effectiveModel.includes('opus'))
        ) {
          apiParams.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
          apiParams.max_tokens = Math.max(modelMaxTokens, thinkingBudget + modelMaxTokens);
          log.info('Extended thinking enabled', {
            budget: thinkingBudget,
            model: effectiveModel,
            byok: !!claudeByokConfig?.apiKey,
          });
        }

        const response = await anthropicClient.messages.create(
          apiParams as Anthropic.MessageCreateParamsStreaming
        );

        keepalive.start();

        let inputTokens = 0;
        let outputTokens = 0;
        let cacheReadTokens = 0;
        let cacheWriteTokens = 0;

        // Tool execution loop
        const currentMessages = [...messages];
        let currentResponse = response;
        let toolLoopCount = 0;
        const MAX_TOOL_LOOPS = 10;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          let stopReason = '';
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pendingToolCalls: Array<{ id: string; name: string; input: any }> = [];
          let currentToolIndex = -1;
          let currentToolInput = '';

          const iterator = (currentResponse as AsyncIterable<Anthropic.MessageStreamEvent>)[
            Symbol.asyncIterator
          ]();

          while (true) {
            const timeoutPromise = new Promise<{ done: true; value: undefined }>((_, reject) => {
              setTimeout(() => reject(new Error('Stream chunk timeout')), CHUNK_TIMEOUT_MS);
            });

            try {
              const result = await Promise.race([iterator.next(), timeoutPromise]);
              if (result.done) break;

              keepalive.touch();
              const event = result.value;

              // Token usage from message events
              if (event.type === 'message_start' && event.message?.usage) {
                inputTokens += event.message.usage.input_tokens || 0;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const usageObj = event.message.usage as any;
                cacheReadTokens += usageObj.cache_read_input_tokens || 0;
                cacheWriteTokens += usageObj.cache_creation_input_tokens || 0;
              }

              if (event.type === 'message_delta') {
                if (event.usage) {
                  outputTokens += event.usage.output_tokens || 0;
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const delta = event.delta as any;
                if (delta.stop_reason) {
                  stopReason = delta.stop_reason;
                }
              }

              if (event.type === 'content_block_start') {
                const block = event.content_block;
                if (block && block.type === 'thinking') {
                  controller.enqueue(encoder.encode('\n<!--THINKING_START-->'));
                }
                if (block && block.type === 'tool_use') {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const toolBlock = block as any;
                  currentToolIndex = pendingToolCalls.length;
                  currentToolInput = '';
                  pendingToolCalls.push({ id: toolBlock.id, name: toolBlock.name, input: {} });
                  controller.enqueue(encoder.encode(`\n<!--TOOL_START:${toolBlock.name}-->`));
                }
              }

              if (event.type === 'content_block_stop') {
                if (
                  fullContent.includes('<!--THINKING_START-->') &&
                  !fullContent.includes('<!--THINKING_END-->')
                ) {
                  controller.enqueue(encoder.encode('<!--THINKING_END-->\n'));
                }
                if (currentToolIndex >= 0 && currentToolInput) {
                  try {
                    pendingToolCalls[currentToolIndex].input = JSON.parse(currentToolInput);
                  } catch {
                    // Partial JSON - leave as empty object
                  }
                  controller.enqueue(encoder.encode('<!--TOOL_END-->'));
                  currentToolIndex = -1;
                  currentToolInput = '';
                }
              }

              if (event.type === 'content_block_delta') {
                const delta = event.delta;
                if ('text' in delta) {
                  fullContent += delta.text;
                  controller.enqueue(encoder.encode(delta.text));
                }
                if ('thinking' in delta && typeof delta.thinking === 'string') {
                  fullContent += delta.thinking;
                  controller.enqueue(encoder.encode(delta.thinking));
                }
                if ('partial_json' in delta && typeof delta.partial_json === 'string') {
                  currentToolInput += delta.partial_json;
                }
              }
            } catch (error) {
              if (error instanceof Error && error.message === 'Stream chunk timeout') {
                log.error('Stream chunk timeout - no data for 60s');
                controller.enqueue(
                  encoder.encode(
                    '\n\n*[Response interrupted: Connection timed out. Please try again.]*'
                  )
                );
              }
              throw error;
            }
          }

          // Tool execution
          if (
            stopReason === 'tool_use' &&
            pendingToolCalls.length > 0 &&
            toolLoopCount < MAX_TOOL_LOOPS
          ) {
            toolLoopCount++;
            log.info('Executing tools', { count: pendingToolCalls.length, loop: toolLoopCount });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const assistantContent: any[] = [];
            if (fullContent) {
              assistantContent.push({ type: 'text', text: fullContent });
            }
            for (const tc of pendingToolCalls) {
              assistantContent.push({
                type: 'tool_use',
                id: tc.id,
                name: tc.name,
                input: tc.input,
              });
            }
            currentMessages.push({ role: 'assistant', content: assistantContent });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolResults: any[] = [];
            for (const tc of pendingToolCalls) {
              try {
                let resultContent: string;
                let resultIsError = false;

                if (isComposioTool(tc.name)) {
                  log.info('Executing Composio tool', { tool: tc.name });
                  const composioResult = await executeComposioTool(user.id, tc.name, tc.input);
                  resultContent =
                    typeof composioResult === 'string'
                      ? composioResult
                      : JSON.stringify(composioResult);
                } else {
                  let toolArgs = tc.input;
                  if (tc.name === 'github' && userGitHubToken) {
                    const parsedArgs =
                      typeof toolArgs === 'string' ? JSON.parse(toolArgs) : { ...toolArgs };
                    parsedArgs._githubToken = userGitHubToken;
                    toolArgs = parsedArgs;
                  }
                  const toolCall: UnifiedToolCall = {
                    id: tc.id,
                    name: tc.name,
                    arguments: toolArgs,
                  };
                  const result = await executeChatTool(toolCall);
                  resultContent =
                    typeof result.content === 'string'
                      ? result.content
                      : JSON.stringify(result.content);
                  resultIsError = result.isError || false;
                }

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: tc.id,
                  content: resultContent,
                  is_error: resultIsError,
                });
                controller.enqueue(
                  encoder.encode(
                    `\n<!--TOOL_RESULT:${tc.name}:${resultIsError ? 'error' : 'ok'}-->`
                  )
                );
              } catch (toolErr) {
                log.error('Tool execution error', { tool: tc.name, error: toolErr });
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: tc.id,
                  content: `Error: ${toolErr instanceof Error ? toolErr.message : 'Unknown error'}`,
                  is_error: true,
                });
              }
            }
            currentMessages.push({ role: 'user', content: toolResults });

            fullContent = '';

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const continueParams: any = {
              model: effectiveModel,
              max_tokens: modelMaxTokens,
              system: systemPrompt,
              messages: currentMessages,
              stream: true,
            };
            if (chatTools.length > 0) {
              continueParams.tools = apiParams.tools;
            }

            currentResponse = await anthropicClient.messages.create(
              continueParams as Anthropic.MessageCreateParamsStreaming
            );

            continue;
          }

          break;
        }

        // Token usage marker
        if (inputTokens > 0 || outputTokens > 0) {
          const usageMarker = `\n<!--USAGE:${JSON.stringify({
            input: inputTokens,
            output: outputTokens,
            cacheRead: cacheReadTokens,
            cacheWrite: cacheWriteTokens,
            model: effectiveModel,
          })}-->`;
          controller.enqueue(encoder.encode(usageMarker));
        }

        // Track token usage (fire and forget)
        trackTokenUsage({
          userId: user.id,
          modelName: effectiveModel,
          inputTokens,
          outputTokens,
          cachedInputTokens: cacheReadTokens,
          source: 'code-lab',
          conversationId: sessionId,
        }).catch((err: unknown) =>
          log.error('logTokenUsage failed', err instanceof Error ? err : undefined)
        );

        const totalTokens = (inputTokens || 0) + (outputTokens || 0);
        incrementTokenUsage(user.id, userPlanKey, totalTokens).catch((err: unknown) =>
          log.error('incrementTokenUsage failed', err instanceof Error ? err : undefined)
        );

        await saveAssistantMessage(
          supabase,
          sessionId,
          fullContent,
          useSearch ? 'search' : 'chat',
          effectiveModel
        );

        // Process conversation for persistent memory (fire and forget)
        processConversationForMemory(
          user.id,
          [...history, { role: 'user', content }, { role: 'assistant', content: fullContent }].map(
            (m) => ({
              role: m.role,
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            })
          ),
          sessionId
        ).catch((err) => log.warn('Memory processing failed', { error: err }));

        controller.close();
      } catch (error) {
        log.error('Stream error', error as Error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isTimeout = errorMessage.includes('timeout');
        const userMessage = isTimeout
          ? '\n\n*[Response interrupted: Connection timed out. Please try again.]*'
          : '\n\nI encountered an error. Please try again.';

        fullContent += userMessage;
        await saveAssistantMessage(
          supabase,
          sessionId,
          fullContent || userMessage,
          'error',
          selectedModel
        );
        controller.enqueue(encoder.encode(userMessage));
        controller.close();
      } finally {
        keepalive.stop();
      }
    },
  });

  return new Response(stream, { headers: STREAM_HEADERS });
}

// Vercel serverless configuration
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for complex code generation
