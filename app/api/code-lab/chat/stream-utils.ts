/**
 * Stream Utilities for Code Lab Chat
 *
 * Common helpers for creating streaming responses with keepalive
 * heartbeats and standardized error message formatting.
 */

import { logger } from '@/lib/logger';
import crypto from 'crypto';

const log = logger('CodeLabChat:Stream');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// Configuration for reliability
export const CHUNK_TIMEOUT_MS = 60000; // 60s timeout per chunk
export const KEEPALIVE_INTERVAL_MS = 15000; // Send keepalive every 15s

export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Standard streaming response headers
 */
export const STREAM_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;

/**
 * Create a keepalive manager for streaming responses
 */
export function createKeepalive(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): {
  start: () => void;
  stop: () => void;
  touch: () => void;
} {
  let keepaliveInterval: NodeJS.Timeout | null = null;
  let lastActivity = Date.now();

  return {
    start() {
      keepaliveInterval = setInterval(() => {
        const timeSinceActivity = Date.now() - lastActivity;
        if (timeSinceActivity > KEEPALIVE_INTERVAL_MS - 1000) {
          try {
            controller.enqueue(encoder.encode(' ')); // Invisible keepalive
            log.debug('Sent keepalive heartbeat');
          } catch {
            // Controller might be closed
          }
        }
      }, KEEPALIVE_INTERVAL_MS);
    },
    stop() {
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
        keepaliveInterval = null;
      }
    },
    touch() {
      lastActivity = Date.now();
    },
  };
}

/**
 * Save an assistant message to the database
 */
export async function saveAssistantMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sessionId: string,
  content: string,
  type: string,
  modelId?: string
): Promise<void> {
  try {
    await (supabase.from('code_lab_messages') as AnySupabase).insert({
      id: generateId(),
      session_id: sessionId,
      role: 'assistant',
      content,
      created_at: new Date().toISOString(),
      type,
      ...(modelId ? { model_id: modelId } : {}),
    });
  } catch (saveError) {
    log.error('Failed to save assistant message', saveError as Error);
  }
}

/**
 * Create a simple text stream from a ReadableStream and save result to DB
 */
export function createAgentStreamResponse(
  agentStream: ReadableStream,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sessionId: string,
  messageType: string,
  errorLabel: string
): Response {
  const reader = agentStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let fullContent = '';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          fullContent += text;
          controller.enqueue(encoder.encode(text));
        }

        await saveAssistantMessage(supabase, sessionId, fullContent, messageType);
        controller.close();
      } catch (error) {
        log.error(`${errorLabel} error`, error as Error);
        const errorContent = `\n\n\`✕ Error:\` I encountered an error during ${errorLabel.toLowerCase()}. Please try again.`;
        fullContent += errorContent;

        await saveAssistantMessage(supabase, sessionId, fullContent || errorContent, 'error');

        controller.enqueue(encoder.encode(errorContent));
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: STREAM_HEADERS });
}

/**
 * Format error message for non-Claude providers based on error type
 */
export function formatProviderErrorMessage(
  errorMessage: string,
  providerId: string | null
): string {
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
    return `\n\n**API Configuration Error**\n\nThe ${providerId?.toUpperCase() || 'provider'} API key is not configured. Please contact the administrator to set up the API key.`;
  }

  if (
    lowerError.includes('invalid api key') ||
    lowerError.includes('invalid_api_key') ||
    lowerError.includes('incorrect api key') ||
    lowerError.includes('api key') ||
    lowerError.includes('api_key') ||
    lowerError.includes('authentication') ||
    lowerError.includes('unauthorized') ||
    lowerError.includes('401')
  ) {
    return `\n\n**API Authentication Error**\n\nThe ${providerId?.toUpperCase() || 'provider'} API key authentication failed. The key may be invalid, expired, or lacking permissions. Please contact the administrator.`;
  }

  if (lowerError.includes('model') && lowerError.includes('not found')) {
    return `\n\n**Model Error**\n\nThe model was not found. It may be unavailable or incorrectly configured.`;
  }

  if (
    lowerError.includes('429') ||
    lowerError.includes('quota') ||
    lowerError.includes('rate limit') ||
    lowerError.includes('rate_limit') ||
    lowerError.includes('ratelimit') ||
    lowerError.includes('too many requests') ||
    lowerError.includes('resource_exhausted')
  ) {
    return `\n\n**Rate Limit**\n\nThe ${providerId || 'provider'} API rate limit has been reached. Please wait a moment and try again.`;
  }

  if (
    lowerError.includes('400') ||
    lowerError.includes('invalid_argument') ||
    lowerError.includes('invalid argument') ||
    lowerError.includes('invalid value') ||
    lowerError.includes('bad request') ||
    lowerError.includes('malformed')
  ) {
    return '\n\n**Request Error**\n\nThe request format is not supported by this model. This can happen with preview models that have different API requirements. Please try a stable model.';
  }

  if (lowerError.includes('safety') || lowerError.includes('blocked')) {
    return '\n\n**Content Filtered**\n\nThe response was blocked by safety filters. Please rephrase your request.';
  }

  // Include actual error for debugging (sanitized)
  const sanitizedError = errorMessage
    .substring(0, 200)
    .replace(/api[_-]?key[=:][^\s]*/gi, '[REDACTED]');
  return `\n\n**Error**\n\nI encountered an error: ${sanitizedError}\n\nPlease try again or select a different model.`;
}
