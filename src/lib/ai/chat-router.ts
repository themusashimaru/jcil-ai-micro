/**
 * CHAT ROUTER - Multi-Provider Support
 *
 * Routes chat requests through the unified provider system with:
 * - Primary provider (Claude) with automatic fallback (xAI/Grok)
 * - Message format conversion (CoreMessage <-> UnifiedMessage)
 * - Streaming response formatting
 * - Full capability preservation across providers
 *
 * Usage:
 *   const { stream, provider, model } = await routeChat(messages, options);
 *   return new Response(stream, { headers: { 'X-Provider': provider } });
 */

import type { CoreMessage } from 'ai';
import {
  createProviderService,
  type ProviderChatOptions,
  type ProviderChatResult,
} from './providers/service';
import type {
  ProviderId,
  UnifiedMessage,
  UnifiedStreamChunk,
  UnifiedContentBlock,
  UnifiedTextBlock,
  UnifiedImageBlock,
  UnifiedToolUseBlock,
  UnifiedToolResultBlock,
} from './providers/types';
import { logger } from '@/lib/logger';

const log = logger('ChatRouter');

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Default provider configuration
 * Can be overridden via environment variables
 */
const DEFAULT_PRIMARY_PROVIDER: ProviderId =
  (process.env.DEFAULT_AI_PROVIDER as ProviderId) || 'claude';

const DEFAULT_FALLBACK_PROVIDER: ProviderId =
  (process.env.FALLBACK_AI_PROVIDER as ProviderId) || 'xai';

const ENABLE_FALLBACK = process.env.ENABLE_PROVIDER_FALLBACK !== 'false';

// ============================================================================
// MESSAGE CONVERSION: CoreMessage -> UnifiedMessage
// ============================================================================

/**
 * Convert a single content part from CoreMessage format to UnifiedContentBlock
 */
function convertContentPart(part: unknown): UnifiedContentBlock | null {
  if (!part || typeof part !== 'object') return null;

  const p = part as Record<string, unknown>;

  switch (p.type) {
    case 'text':
      return {
        type: 'text',
        text: String(p.text || ''),
      } as UnifiedTextBlock;

    case 'image':
      // Handle image parts
      if (p.image && typeof p.image === 'object') {
        const img = p.image as Record<string, unknown>;
        if (typeof img === 'string') {
          // URL format
          return {
            type: 'image',
            source: { type: 'url', url: img },
          } as UnifiedImageBlock;
        } else if (img.url) {
          return {
            type: 'image',
            source: { type: 'url', url: String(img.url) },
          } as UnifiedImageBlock;
        } else if (img.base64) {
          return {
            type: 'image',
            source: {
              type: 'base64',
              data: String(img.base64),
              mediaType: String(img.mimeType || 'image/png'),
            },
          } as UnifiedImageBlock;
        }
      }
      return null;

    case 'tool-call':
    case 'tool_use':
      return {
        type: 'tool_use',
        id: String(p.toolCallId || p.id || ''),
        name: String(p.toolName || p.name || ''),
        arguments: (p.args || p.arguments || {}) as Record<string, unknown>,
      } as UnifiedToolUseBlock;

    case 'tool-result':
    case 'tool_result':
      return {
        type: 'tool_result',
        toolUseId: String(p.toolCallId || p.toolUseId || ''),
        content: typeof p.result === 'string' ? p.result : JSON.stringify(p.result || p.content),
        isError: Boolean(p.isError),
      } as UnifiedToolResultBlock;

    default:
      return null;
  }
}

/**
 * Convert CoreMessage array to UnifiedMessage array
 */
export function convertToUnifiedMessages(messages: CoreMessage[]): UnifiedMessage[] {
  return messages.map((msg): UnifiedMessage => {
    // Handle string content
    if (typeof msg.content === 'string') {
      return {
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: msg.content,
      };
    }

    // Handle array content (multimodal)
    if (Array.isArray(msg.content)) {
      const blocks: UnifiedContentBlock[] = [];

      for (const part of msg.content) {
        const converted = convertContentPart(part);
        if (converted) {
          blocks.push(converted);
        } else if (typeof part === 'object' && part !== null) {
          // Fallback: try to extract text
          const p = part as unknown as Record<string, unknown>;
          if (p.text) {
            blocks.push({ type: 'text', text: String(p.text) });
          }
        }
      }

      // If we only have one text block, simplify to string
      if (blocks.length === 1 && blocks[0].type === 'text') {
        return {
          role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
          content: (blocks[0] as UnifiedTextBlock).text,
        };
      }

      return {
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: blocks.length > 0 ? blocks : '',
      };
    }

    // Fallback for unexpected content types
    return {
      role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
      content: String(msg.content || ''),
    };
  });
}

// ============================================================================
// STREAM FORMATTING: UnifiedStreamChunk -> ReadableStream
// ============================================================================

/**
 * Create a ReadableStream from UnifiedStreamChunk generator
 * Formats chunks as plain text for streaming responses
 */
export function createStreamFromChunks(
  chunks: AsyncGenerator<UnifiedStreamChunk, ProviderChatResult, unknown>,
  onComplete?: (result: ProviderChatResult) => void
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let result: ProviderChatResult | undefined;

        for await (const chunk of chunks) {
          // Only emit text chunks to the stream
          if (chunk.type === 'text' && chunk.text) {
            controller.enqueue(encoder.encode(chunk.text));
          }

          // Handle errors
          if (chunk.type === 'error' && chunk.error) {
            log.error('Stream error from provider', {
              code: chunk.error.code,
              message: chunk.error.message,
            });
          }
        }

        // Get the final result from the generator
        // Note: The generator returns the result when it completes
        try {
          const genResult = await chunks.next();
          if (genResult.done && genResult.value) {
            result = genResult.value as ProviderChatResult;
          }
        } catch {
          // Generator already exhausted, that's fine
        }

        // Call completion callback with result
        if (result && onComplete) {
          onComplete(result);
        }

        controller.close();
      } catch (error) {
        log.error('Stream processing error', { error });
        controller.error(error);
      }
    },
  });
}

// ============================================================================
// CHAT ROUTING
// ============================================================================

/**
 * Options for routing a chat request
 */
export interface ChatRouteOptions {
  /** Override primary provider */
  providerId?: ProviderId;
  /** Override fallback provider */
  fallbackProviderId?: ProviderId;
  /** Specific model to use */
  model?: string;
  /** System prompt to prepend */
  systemPrompt?: string;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Temperature for response */
  temperature?: number;
  /** Disable fallback for this request */
  disableFallback?: boolean;
  /** Callback when provider switches */
  onProviderSwitch?: (from: ProviderId, to: ProviderId, reason: string) => void;
}

/**
 * Result of routing a chat request
 */
export interface ChatRouteResult {
  /** ReadableStream for streaming response */
  stream: ReadableStream<Uint8Array>;
  /** Provider that handled the request */
  providerId: ProviderId;
  /** Model used */
  model: string;
  /** Whether fallback was used */
  usedFallback: boolean;
  /** Reason for fallback if used */
  fallbackReason?: string;
}

/**
 * Route a chat request through the multi-provider system
 *
 * @param messages - CoreMessage array from the request
 * @param options - Routing options
 * @returns ChatRouteResult with stream and metadata
 */
export async function routeChat(
  messages: CoreMessage[],
  options: ChatRouteOptions = {}
): Promise<ChatRouteResult> {
  const {
    providerId = DEFAULT_PRIMARY_PROVIDER,
    fallbackProviderId = DEFAULT_FALLBACK_PROVIDER,
    model,
    systemPrompt,
    maxTokens,
    temperature,
    disableFallback = false,
    onProviderSwitch,
  } = options;

  log.debug('Routing chat request', {
    primaryProvider: providerId,
    fallbackProvider: fallbackProviderId,
    messageCount: messages.length,
    hasSystemPrompt: !!systemPrompt,
  });

  // Create provider service with configured providers
  const service = createProviderService(providerId, disableFallback ? null : fallbackProviderId);

  // Convert messages to unified format
  let unifiedMessages = convertToUnifiedMessages(messages);

  // Filter out any existing system messages (we'll use the systemPrompt option instead)
  unifiedMessages = unifiedMessages.filter((m) => m.role !== 'system');

  // Build chat options - CRITICAL: pass systemPrompt here for Anthropic adapter
  const chatOptions: ProviderChatOptions = {
    providerId,
    fallbackProviderId: disableFallback ? undefined : fallbackProviderId,
    enableRetry: true,
    enableFallback: ENABLE_FALLBACK && !disableFallback,
    model,
    maxTokens,
    temperature,
    systemPrompt, // CRITICAL: This passes to the adapter's system parameter
    onProviderSwitch,
  };

  // Track the result for headers
  let finalResult: ProviderChatResult = {
    providerId,
    model: model || 'unknown',
    usedFallback: false,
  };

  // Start streaming
  const chunks = service.chat(unifiedMessages, chatOptions);

  // Create the response stream
  const stream = createStreamFromChunks(chunks, (result) => {
    finalResult = result;
    log.debug('Chat completed', {
      provider: result.providerId,
      model: result.model,
      usedFallback: result.usedFallback,
      fallbackReason: result.fallbackReason,
    });
  });

  return {
    stream,
    providerId: finalResult.providerId,
    model: finalResult.model,
    usedFallback: finalResult.usedFallback,
    fallbackReason: finalResult.fallbackReason,
  };
}

// ============================================================================
// NON-STREAMING CHAT (for title generation, memory extraction, etc.)
// ============================================================================

/**
 * Result of a non-streaming chat completion
 */
export interface ChatCompletionResult {
  /** Generated text content */
  text: string;
  /** Provider that handled the request */
  providerId: ProviderId;
  /** Model used */
  model: string;
  /** Whether fallback was used */
  usedFallback: boolean;
  /** Token usage if available */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Complete a chat request without streaming
 * Useful for title generation, memory extraction, etc.
 *
 * @param messages - CoreMessage array
 * @param options - Routing options
 * @returns ChatCompletionResult with text and metadata
 */
export async function completeChat(
  messages: CoreMessage[],
  options: ChatRouteOptions = {}
): Promise<ChatCompletionResult> {
  const {
    providerId = DEFAULT_PRIMARY_PROVIDER,
    fallbackProviderId = DEFAULT_FALLBACK_PROVIDER,
    model,
    systemPrompt,
    maxTokens,
    temperature,
    disableFallback = false,
    onProviderSwitch,
  } = options;

  log.debug('Completing chat (non-streaming)', {
    primaryProvider: providerId,
    messageCount: messages.length,
  });

  // Create provider service
  const service = createProviderService(providerId, disableFallback ? null : fallbackProviderId);

  // Convert messages
  let unifiedMessages = convertToUnifiedMessages(messages);

  // Prepend system prompt if provided
  if (systemPrompt) {
    unifiedMessages = [
      { role: 'system', content: systemPrompt },
      ...unifiedMessages.filter((m) => m.role !== 'system'),
    ];
  }

  // Build chat options
  const chatOptions: ProviderChatOptions = {
    providerId,
    fallbackProviderId: disableFallback ? undefined : fallbackProviderId,
    enableRetry: true,
    enableFallback: ENABLE_FALLBACK && !disableFallback,
    model,
    maxTokens,
    temperature,
    onProviderSwitch,
  };

  // Collect all text from the stream
  let text = '';
  let usage: { inputTokens: number; outputTokens: number } | undefined;
  let result: ProviderChatResult | undefined;

  const chunks = service.chat(unifiedMessages, chatOptions);

  for await (const chunk of chunks) {
    if (chunk.type === 'text' && chunk.text) {
      text += chunk.text;
    }
    if (chunk.type === 'message_end' && chunk.usage) {
      usage = chunk.usage;
    }
  }

  // Get final result
  try {
    const genResult = await chunks.next();
    if (genResult.done && genResult.value) {
      result = genResult.value as ProviderChatResult;
    }
  } catch {
    // Generator exhausted
  }

  return {
    text,
    providerId: result?.providerId || providerId,
    model: result?.model || model || 'unknown',
    usedFallback: result?.usedFallback || false,
    usage,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a provider is available and configured
 */
export function isProviderConfigured(providerId: ProviderId): boolean {
  const service = createProviderService(providerId, null);
  const statuses = service.getProviderStatuses();
  const status = statuses.find((s) => s.providerId === providerId);
  return status?.configured ?? false;
}

/**
 * Get list of available providers
 */
export function getAvailableProviders(): ProviderId[] {
  const service = createProviderService('claude', null);
  return service.getConfiguredProviders();
}

/**
 * Get the default provider configuration
 */
export function getDefaultProviders(): {
  primary: ProviderId;
  fallback: ProviderId;
} {
  return {
    primary: DEFAULT_PRIMARY_PROVIDER,
    fallback: DEFAULT_FALLBACK_PROVIDER,
  };
}
