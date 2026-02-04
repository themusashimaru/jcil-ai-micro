/**
 * MULTI-PROVIDER CHAT HANDLER
 *
 * Handles chat requests for non-Claude providers (OpenAI, xAI, DeepSeek, Google)
 * Uses the unified adapter system for consistent behavior.
 */

import { getAdapter } from '@/lib/ai/providers/adapters';
import { getProviderAndModel, isProviderAvailable } from '@/lib/ai/providers/registry';
import type { UnifiedMessage, UnifiedContentBlock, ProviderId } from '@/lib/ai/providers/types';
import { createStreamOptimizer } from '../stream-optimizer';
import { logger } from '@/lib/logger';

const log = logger('ProviderHandler');

// ============================================================================
// TYPES
// ============================================================================

export interface ProviderHandlerOptions {
  /** Provider ID (openai, xai, deepseek, google) */
  providerId: ProviderId;
  /** Model to use */
  model: string;
  /** System prompt */
  systemPrompt: string;
  /** Maximum tokens for response */
  maxTokens: number;
  /** Temperature (0-1) */
  temperature: number;
  /** Enable streaming optimization */
  optimizeStreaming?: boolean;
  /** User API key for BYOK */
  userApiKey?: string;
}

export interface ProviderHandlerResult {
  /** The response stream */
  stream: ReadableStream<Uint8Array>;
  /** Provider that was used */
  providerId: string;
  /** Model that was used */
  model: string;
  /** Token usage (if available) */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ============================================================================
// API KEY VALIDATION
// ============================================================================

const API_KEY_ENV_MAP: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY', 'OPENAI_API_KEY_1'],
  xai: ['XAI_API_KEY', 'XAI_API_KEY_1'],
  deepseek: ['DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY_1'],
  google: ['GEMINI_API_KEY', 'GEMINI_API_KEY_1'],
};

function validateApiKey(providerId: string, userApiKey?: string): void {
  if (userApiKey) return; // BYOK user has their own key

  const requiredEnvVars = API_KEY_ENV_MAP[providerId];
  if (!requiredEnvVars) return; // Unknown provider, let adapter handle it

  const hasAnyKey = requiredEnvVars.some((envVar) => process.env[envVar]);
  if (!hasAnyKey) {
    throw new Error(
      `${requiredEnvVars[0]} is not configured. Please set up the API key to use ${providerId} models.`
    );
  }
}

// ============================================================================
// HANDLER
// ============================================================================

/**
 * Handle a chat request with a non-Claude provider
 */
export async function handleProviderChat(
  messages: UnifiedMessage[],
  options: ProviderHandlerOptions
): Promise<ProviderHandlerResult> {
  const {
    providerId,
    model,
    systemPrompt,
    maxTokens,
    temperature,
    optimizeStreaming = true,
    userApiKey,
  } = options;

  // Validate provider availability
  if (!isProviderAvailable(providerId)) {
    throw new Error(`Provider '${providerId}' is not configured or available`);
  }

  // Validate API key
  validateApiKey(providerId, userApiKey);

  // Get provider info
  const providerInfo = getProviderAndModel(model);
  log.info('Using non-Claude provider', {
    providerId,
    model,
    modelName: providerInfo?.model.name,
  });

  // Get the adapter
  const adapter = getAdapter(providerId);

  // Track token usage
  let inputTokens = 0;
  let outputTokens = 0;

  // Create the response stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Stream from the adapter
        const chatStream = adapter.chat(messages, {
          model,
          maxTokens: providerInfo?.model.maxOutputTokens || maxTokens,
          temperature,
          systemPrompt,
          ...(userApiKey ? { userApiKey } : {}),
        });

        for await (const chunk of chatStream) {
          if (chunk.type === 'text' && chunk.text) {
            controller.enqueue(encoder.encode(chunk.text));
          } else if (chunk.type === 'error' && chunk.error) {
            log.error('Provider stream error', {
              code: chunk.error.code,
              message: chunk.error.message,
            });
            throw new Error(chunk.error.message);
          } else if (chunk.type === 'message_end' && chunk.usage) {
            inputTokens = chunk.usage.inputTokens || 0;
            outputTokens = chunk.usage.outputTokens || 0;
          }
        }

        // Send token usage marker if available
        if (inputTokens > 0 || outputTokens > 0) {
          const usageMarker = `\n<!--USAGE:${JSON.stringify({
            input: inputTokens,
            output: outputTokens,
            model,
          })}-->`;
          controller.enqueue(encoder.encode(usageMarker));
        }

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const userMessage = formatErrorMessage(providerId, model, errorMessage);

        controller.enqueue(encoder.encode(userMessage));
        controller.close();
      }
    },
  });

  // Optionally optimize the stream
  const finalStream = optimizeStreaming
    ? stream.pipeThrough(createStreamOptimizer())
    : stream;

  return {
    stream: finalStream,
    providerId,
    model,
    usage: inputTokens > 0 || outputTokens > 0 ? { inputTokens, outputTokens } : undefined,
  };
}

// ============================================================================
// ERROR FORMATTING
// ============================================================================

function formatErrorMessage(providerId: string, model: string, errorMessage: string): string {
  const lowerError = errorMessage.toLowerCase();

  if (lowerError.includes('timeout')) {
    return '\n\n*[Response interrupted: Connection timed out. Please try again.]*';
  }

  if (
    lowerError.includes('not configured') ||
    lowerError.includes('is not set') ||
    lowerError.includes('missing api key') ||
    lowerError.includes('no api key')
  ) {
    return `\n\n**API Configuration Error**\n\nThe ${providerId.toUpperCase()} API key is not configured. Please contact the administrator.`;
  }

  if (
    lowerError.includes('invalid api key') ||
    lowerError.includes('authentication') ||
    lowerError.includes('unauthorized') ||
    lowerError.includes('401')
  ) {
    return `\n\n**API Authentication Error**\n\nThe ${providerId.toUpperCase()} API key authentication failed. Please contact the administrator.`;
  }

  if (lowerError.includes('model') && lowerError.includes('not found')) {
    return `\n\n**Model Error**\n\nThe model "${model}" was not found. It may be unavailable or incorrectly configured.`;
  }

  if (
    lowerError.includes('429') ||
    lowerError.includes('quota') ||
    lowerError.includes('rate limit') ||
    lowerError.includes('too many requests')
  ) {
    return `\n\n**Rate Limit**\n\nThe ${providerId} API rate limit has been reached. Please wait a moment and try again.`;
  }

  if (lowerError.includes('safety') || lowerError.includes('blocked')) {
    return '\n\n**Content Filtered**\n\nThe response was blocked by safety filters. Please rephrase your request.';
  }

  // Generic error with sanitized message
  const sanitizedError = errorMessage
    .substring(0, 200)
    .replace(/api[_-]?key[=:][^\s]*/gi, '[REDACTED]');

  return `\n\n**Error**\n\n${sanitizedError}\n\nPlease try again or select a different model.`;
}

// ============================================================================
// MESSAGE CONVERSION
// ============================================================================

/**
 * Convert simple messages to unified format
 */
export function toUnifiedMessages(
  messages: Array<{ role: string; content: string | unknown }>
): UnifiedMessage[] {
  return messages.map((m) => {
    if (typeof m.content === 'string') {
      return {
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      };
    }

    // Handle array content (images + text)
    const blocks: UnifiedContentBlock[] = [];
    const contentArray = m.content as unknown[];

    for (const part of contentArray) {
      const p = part as Record<string, unknown>;

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
      content: blocks.length > 0 ? blocks : String(m.content),
    };
  });
}
