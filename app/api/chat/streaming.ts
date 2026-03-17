/**
 * Chat Streaming & Provider Routing
 *
 * Handles multi-provider routing (Claude, OpenAI, xAI, DeepSeek, Google),
 * stream wrapping with slot management, and pending request lifecycle.
 */

import { CoreMessage } from 'ai';
import { logger } from '@/lib/logger';
import { routeChatWithTools, type ChatRouteOptions, type ToolExecutor } from '@/lib/ai/chat-router';
import {
  getDefaultModel,
  getDefaultChatModelId,
  getFreeTierModelId,
  isProviderAvailable,
  getProviderAndModel,
  getAvailableProviderIds,
} from '@/lib/ai/providers/registry';
import { getAdapter } from '@/lib/ai/providers/adapters';
import type {
  UnifiedMessage,
  UnifiedContentBlock,
  UnifiedTool,
  ProviderId,
} from '@/lib/ai/providers/types';
import { releaseSlot } from '@/lib/queue';
import { createPendingRequest, completePendingRequest } from '@/lib/pending-requests';
import { chatErrorResponse } from '@/lib/api/utils';
import { ERROR_CODES, HTTP_STATUS } from '@/lib/constants';
import { trackTokenUsage } from '@/lib/usage/track';
import { incrementTokenUsage } from '@/lib/limits';
import { processConversationForMemory } from '@/lib/memory';

const log = logger('ChatStreaming');

export interface StreamConfig {
  messages: CoreMessage[];
  systemPrompt: string;
  tools: UnifiedTool[];
  toolExecutor: ToolExecutor;
  selectedModel: string;
  selectedProviderId: string;
  provider: string | undefined;
  temperature?: number;
  maxTokens: number;
  thinking?: unknown;
  requestId: string;
  conversationId?: string;
  userId: string;
  userPlanKey: string;
  isAuthenticated: boolean;
  requestStartTime: number;
  request: Request;
  /** BYOK: User's own API key for the selected provider (if configured) */
  userApiKey?: string;
}

/**
 * Resolve the model and provider based on user selection and subscription tier.
 * Free users get Haiku 4.5 (cost-effective). Paid users get Opus 4.6.
 */
export function resolveProvider(
  provider: string | undefined,
  userPlanKey?: string
): {
  selectedModel: string;
  selectedProviderId: string;
  error?: Response;
} {
  // Free users get Haiku 4.5, paid users get Opus 4.6
  const isFreeUser = !userPlanKey || userPlanKey === 'free';
  let selectedModel = isFreeUser ? getFreeTierModelId() : getDefaultChatModelId();
  let selectedProviderId = 'claude';

  if (provider && isProviderAvailable(provider as ProviderId)) {
    const providerModel = getDefaultModel(provider as ProviderId);
    if (providerModel) {
      selectedModel = providerModel.id;
      selectedProviderId = provider;
      log.info('Using user-selected provider', { provider, model: selectedModel });
    }
  } else if (provider && !isProviderAvailable(provider as ProviderId)) {
    const availableIds = getAvailableProviderIds();
    log.warn('Selected provider not available', { provider, availableIds });
    return {
      selectedModel,
      selectedProviderId,
      error: chatErrorResponse(HTTP_STATUS.BAD_REQUEST, {
        error: 'The selected provider is not available. Please choose a different provider.',
        code: ERROR_CODES.INVALID_INPUT,
      }),
    };
  }

  return { selectedModel, selectedProviderId };
}

/**
 * Create a pending request for stream recovery.
 */
export async function createStreamPendingRequest(config: {
  userId: string;
  conversationId?: string;
  messages: CoreMessage[];
  model: string;
}): Promise<string | null> {
  if (!config.conversationId) return null;

  const pendingRequestId = await createPendingRequest({
    userId: config.userId,
    conversationId: config.conversationId,
    messages: config.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    model: config.model,
  });

  if (pendingRequestId) {
    log.debug('Created pending request for stream recovery', {
      pendingRequestId,
      conversationId: config.conversationId,
    });
  }

  return pendingRequestId;
}

/**
 * Handle non-Claude provider streaming (OpenAI, xAI, DeepSeek, Google).
 * Uses adapter directly for consistent implementation.
 */
export function handleNonClaudeProvider(config: StreamConfig): Response {
  const {
    selectedProviderId,
    selectedModel,
    messages,
    systemPrompt,
    maxTokens,
    temperature,
    requestId,
    request,
    userApiKey,
    userId,
    userPlanKey,
    conversationId,
  } = config;

  log.info('Using non-Claude provider (direct adapter)', {
    providerId: selectedProviderId,
    model: selectedModel,
  });

  const providerInfo = getProviderAndModel(selectedModel);
  const encoder = new TextEncoder();

  // H8: Timeout safety net for non-Claude streams (matches Claude's 30s slot timeout)
  const NON_CLAUDE_TIMEOUT_MS = 60 * 1000; // 60s — longer than Claude's 30s to account for slower providers

  const nonClaudeStream = new ReadableStream({
    async start(controller) {
      let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        // Validate API key (skip if user has BYOK)
        if (!userApiKey) {
          const apiKeyEnvMap: Record<string, string[]> = {
            openai: ['OPENAI_API_KEY', 'OPENAI_API_KEY_1'],
            xai: ['XAI_API_KEY', 'XAI_API_KEY_1'],
            deepseek: ['DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY_1'],
            google: ['GEMINI_API_KEY', 'GEMINI_API_KEY_1'],
          };
          const requiredEnvVars = apiKeyEnvMap[selectedProviderId];
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

        const adapter = getAdapter(selectedProviderId as ProviderId);

        // Convert messages to unified format
        const unifiedMessages: UnifiedMessage[] = messages.map((m) => {
          if (typeof m.content === 'string') {
            return {
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
            };
          }
          // Guard against null/undefined/non-array content
          if (!Array.isArray(m.content)) {
            return {
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content != null ? String(m.content) : '',
            };
          }
          const blocks: UnifiedContentBlock[] = [];
          for (const part of m.content) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = part as any;
            if (p.type === 'text' && p.text) {
              blocks.push({ type: 'text', text: String(p.text) });
            } else if (p.type === 'image' && p.image) {
              const imageStr = String(p.image);
              if (imageStr.startsWith('data:')) {
                const matches = imageStr.match(/^data:([^;]+);base64,(.+)$/);
                if (matches) {
                  blocks.push({
                    type: 'image',
                    source: {
                      type: 'base64',
                      data: matches[2],
                      mediaType: matches[1],
                    },
                  });
                }
              }
            }
          }
          return {
            role: m.role as 'user' | 'assistant' | 'system',
            content: blocks.length > 0 ? blocks : '',
          };
        });

        const chatStream = adapter.chat(unifiedMessages, {
          model: selectedModel,
          maxTokens: providerInfo?.model.maxOutputTokens || maxTokens,
          temperature,
          systemPrompt,
          ...(userApiKey ? { userApiKey } : {}),
        });

        // H8: Set up stream timeout — if no chunks arrive for NON_CLAUDE_TIMEOUT_MS, abort
        let lastChunkTime = Date.now();
        streamTimeoutId = setInterval(() => {
          if (Date.now() - lastChunkTime > NON_CLAUDE_TIMEOUT_MS) {
            log.warn('Non-Claude stream timeout — no data received', {
              provider: selectedProviderId,
              model: selectedModel,
              requestId,
              timeoutMs: NON_CLAUDE_TIMEOUT_MS,
            });
            try {
              controller.enqueue(
                encoder.encode('\n\n**Error**\n\nThe request timed out. Please try again.')
              );
            } catch {
              // Controller might be closed
            }
            controller.close();
          }
        }, 5000);

        for await (const chunk of chatStream) {
          lastChunkTime = Date.now();

          if (chunk.type === 'text' && chunk.text) {
            controller.enqueue(encoder.encode(chunk.text));
          } else if (chunk.type === 'message_end' && chunk.usage) {
            // H7: Track token usage for non-Claude providers
            const totalTokens = (chunk.usage.inputTokens || 0) + (chunk.usage.outputTokens || 0);

            trackTokenUsage({
              userId,
              modelName: selectedModel,
              inputTokens: chunk.usage.inputTokens,
              outputTokens: chunk.usage.outputTokens,
              source: 'chat',
              conversationId,
            }).catch((err: unknown) =>
              log.error('logTokenUsage failed (non-Claude)', err instanceof Error ? err : undefined)
            );

            incrementTokenUsage(userId, userPlanKey, totalTokens).catch((err: unknown) =>
              log.warn('Token increment failed (non-Claude)', { userId, tokens: totalTokens, error: err instanceof Error ? err.message : String(err) })
            );
          } else if (chunk.type === 'error' && chunk.error) {
            log.error('Adapter stream error', {
              code: chunk.error.code,
              message: chunk.error.message,
            });
            throw new Error(chunk.error.message);
          }
        }

        if (streamTimeoutId) clearInterval(streamTimeoutId);
        controller.close();
      } catch (error) {
        if (streamTimeoutId) clearInterval(streamTimeoutId);
        log.error('Non-Claude provider error', error as Error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const lowerError = errorMessage.toLowerCase();

        let userMessage: string;
        if (
          lowerError.includes('not configured') ||
          lowerError.includes('is not set') ||
          lowerError.includes('missing api key')
        ) {
          userMessage = `\n\n**API Configuration Error**\n\nThe ${selectedProviderId.toUpperCase()} API key is not configured. Please contact the administrator to set up the API key.`;
        } else if (
          lowerError.includes('invalid api key') ||
          lowerError.includes('authentication') ||
          lowerError.includes('unauthorized') ||
          lowerError.includes('401')
        ) {
          userMessage = `\n\n**API Authentication Error**\n\nThe ${selectedProviderId.toUpperCase()} API key authentication failed. The key may be invalid, expired, or lacking permissions.`;
        } else if (
          lowerError.includes('429') ||
          lowerError.includes('rate limit') ||
          lowerError.includes('quota')
        ) {
          userMessage = `\n\n**Rate Limit**\n\nThe ${selectedProviderId} API rate limit has been reached. Please wait a moment and try again.`;
        } else if (lowerError.includes('model') && lowerError.includes('not found')) {
          userMessage = `\n\n**Model Error**\n\nThe model "${selectedModel}" was not found. It may be unavailable or incorrectly configured.`;
        } else {
          log.error('Stream error from provider', {
            provider: selectedProviderId,
            error: errorMessage,
          });
          userMessage = `\n\n**Error**\n\nSomething went wrong processing your request. Please try again.`;
        }

        try {
          controller.enqueue(encoder.encode(userMessage));
        } catch {
          // Controller might be closed
        }
        controller.close();
      }
    },
  });

  // Wrap stream with slot release
  let slotReleased = false;
  const ensureSlotReleased = () => {
    if (!slotReleased) {
      slotReleased = true;
      releaseSlot(requestId).catch((err) => log.error('Error releasing slot', err));
    }
  };

  const wrappedStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
    },
    flush() {
      ensureSlotReleased();
    },
  });

  request.signal.addEventListener('abort', () => {
    ensureSlotReleased();
  });

  const finalStream = nonClaudeStream.pipeThrough(wrappedStream);

  return new Response(finalStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Model-Used': selectedModel,
      'X-Provider': selectedProviderId,
      'X-Used-Fallback': 'false',
      'X-Used-Tools': 'false',
      'X-Tools-Used': 'none',
    },
  });
}

/**
 * Handle Claude provider streaming with full tool support.
 */
export async function handleClaudeProvider(
  config: StreamConfig & { pendingRequestId: string | null }
): Promise<Response> {
  const {
    messages,
    systemPrompt,
    tools,
    toolExecutor,
    selectedModel,
    selectedProviderId,
    temperature,
    maxTokens,
    thinking,
    requestId,
    conversationId,
    userId,
    userPlanKey,
    isAuthenticated,
    requestStartTime,
    request,
    pendingRequestId,
    userApiKey,
  } = config;

  const routeOptions: ChatRouteOptions = {
    providerId: selectedProviderId as ProviderId,
    model: selectedModel,
    systemPrompt,
    maxTokens,
    temperature,
    thinking: thinking as { enabled: boolean; budgetTokens?: number } | undefined,
    tools,
    ...(userApiKey ? { userApiKey } : {}),
    onProviderSwitch: (from, to, reason) => {
      log.info('Provider failover triggered', { from, to, reason });
    },
    onUsage: (usage) => {
      const totalTokens = (usage.inputTokens || 0) + (usage.outputTokens || 0);

      trackTokenUsage({
        userId,
        modelName: selectedModel,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        source: 'chat',
        conversationId,
      }).catch((err: unknown) =>
        log.error('logTokenUsage failed', err instanceof Error ? err : undefined)
      );

      incrementTokenUsage(userId, userPlanKey, totalTokens).catch((err: unknown) =>
        log.warn('Token increment failed', { userId, tokens: totalTokens, error: err instanceof Error ? err.message : String(err) })
      );
    },
  };

  const routeResult = await routeChatWithTools(messages, routeOptions, toolExecutor);

  log.debug('Chat routed', {
    provider: routeResult.providerId,
    model: routeResult.model,
    usedFallback: routeResult.usedFallback,
    fallbackReason: routeResult.fallbackReason,
    usedTools: routeResult.usedTools,
    toolsUsed: routeResult.toolsUsed,
  });

  let slotReleased = false;
  let slotTimeoutId: ReturnType<typeof setTimeout> | null = null;
  const ensureSlotReleased = () => {
    if (!slotReleased) {
      slotReleased = true;
      if (slotTimeoutId) clearTimeout(slotTimeoutId);
      releaseSlot(requestId).catch((err) => log.error('Error releasing slot', err));
    }
  };

  const encoder = new TextEncoder();
  const wrappedStream = new TransformStream<Uint8Array, Uint8Array>(
    {
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
      flush(controller) {
        controller.enqueue(encoder.encode('\n[DONE]\n'));
        ensureSlotReleased();

        log.info('Chat response completed', {
          requestId,
          durationMs: Date.now() - requestStartTime,
          model: routeResult.model,
          provider: routeResult.providerId,
          toolsUsed: routeResult.toolsUsed.length,
        });

        if (pendingRequestId) {
          completePendingRequest(pendingRequestId).catch((err) => {
            log.warn('Failed to complete pending request (non-critical)', err);
          });
        }

        if (isAuthenticated && config.messages.length >= 2) {
          processConversationForMemory(
            userId,
            config.messages.map((m) => ({
              role: m.role,
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            })),
            conversationId
          ).catch((err) => {
            log.warn('Memory extraction failed (non-critical)', err);
          });
        }
      },
    },
    { highWaterMark: 65536 },
    { highWaterMark: 65536 }
  );

  request.signal.addEventListener('abort', () => {
    log.debug('Request aborted (client disconnect)');
    ensureSlotReleased();
  });

  const SLOT_TIMEOUT_MS = 30 * 1000;
  slotTimeoutId = setTimeout(() => {
    if (!slotReleased) {
      log.warn('Queue slot timeout — force releasing after 30s', { requestId });
      ensureSlotReleased();
    }
  }, SLOT_TIMEOUT_MS);

  const finalStream = routeResult.stream.pipeThrough(wrappedStream);

  return new Response(finalStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Model-Used': routeResult.model,
      'X-Provider': routeResult.providerId,
      'X-Used-Fallback': routeResult.usedFallback ? 'true' : 'false',
      'X-Used-Tools': routeResult.usedTools ? 'true' : 'false',
      'X-Tools-Used': routeResult.toolsUsed.join(',') || 'none',
    },
  });
}
