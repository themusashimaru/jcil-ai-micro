/**
 * API INTEGRATION FOR MULTI-PROVIDER SYSTEM
 *
 * Helpers for integrating multi-provider AI into Next.js API routes.
 * Handles streaming responses, error formatting, and provider switching.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ProviderId, UnifiedMessage, UnifiedTool } from './types';
import { UnifiedAIError } from './types';
import { ProviderService, createProviderService, type ProviderChatOptions } from './service';
import { parseProviderError, getUserFriendlyMessage } from './errors';
import { logger } from '@/lib/logger';

const log = logger('ProviderAPI');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Request body for multi-provider chat endpoint
 */
export interface MultiProviderChatRequest {
  messages: UnifiedMessage[];
  providerId?: ProviderId;
  model?: string;
  tools?: UnifiedTool[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  enableFallback?: boolean;
}

/**
 * Non-streaming response
 */
export interface MultiProviderChatResponse {
  content: string;
  provider: ProviderId;
  model: string;
  usedFallback: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Error response
 */
export interface MultiProviderErrorResponse {
  error: {
    code: string;
    message: string;
    provider: ProviderId;
    retryable: boolean;
    retryAfterMs?: number;
  };
}

// ============================================================================
// STREAMING HELPERS
// ============================================================================

/**
 * Create a streaming response from the provider service
 */
export async function createStreamingResponse(
  service: ProviderService,
  messages: UnifiedMessage[],
  options: ProviderChatOptions = {}
): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const chatGenerator = service.chat(messages, options);
        let result: { providerId: ProviderId; model: string; usedFallback: boolean } | undefined;

        for await (const chunk of chatGenerator) {
          // Send chunk as Server-Sent Event
          const data = JSON.stringify(chunk);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // Handle message_end to get result
          if (chunk.type === 'message_end' && chunk.usage) {
            // Usage info is in the chunk
          }
        }

        // Try to get the return value
        try {
          result = await chatGenerator.next().then((r) => r.value as typeof result);
        } catch {
          // Generator already closed
        }

        // Send done event with metadata
        const doneData = JSON.stringify({
          type: 'done',
          provider: result?.providerId ?? options.providerId,
          model: result?.model ?? options.model,
          usedFallback: result?.usedFallback ?? false,
        });
        controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));

        controller.close();
      } catch (err) {
        const error =
          err instanceof UnifiedAIError
            ? err
            : parseProviderError(err, options.providerId ?? 'claude');

        // Send error event
        const errorData = JSON.stringify({
          type: 'error',
          error: {
            code: error.code,
            message: getUserFriendlyMessage(error),
            provider: error.provider,
            retryable: error.retryable,
            retryAfterMs: error.retryAfterMs,
          },
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Create a non-streaming response
 */
export async function createChatResponse(
  service: ProviderService,
  messages: UnifiedMessage[],
  options: ProviderChatOptions = {}
): Promise<MultiProviderChatResponse> {
  let content = '';
  let usage: { inputTokens: number; outputTokens: number } | undefined;
  const providerId: ProviderId = options.providerId ?? 'claude';
  const model = options.model ?? 'unknown';
  const usedFallback = false;

  const chatGenerator = service.chat(messages, options);

  for await (const chunk of chatGenerator) {
    if (chunk.type === 'text' && chunk.text) {
      content += chunk.text;
    }
    if (chunk.type === 'message_end' && chunk.usage) {
      usage = chunk.usage;
    }
  }

  return {
    content,
    provider: providerId,
    model,
    usedFallback,
    usage,
  };
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

/**
 * Create a multi-provider chat API handler
 *
 * Usage in route.ts:
 * ```typescript
 * import { createMultiProviderHandler } from '@/lib/ai/providers/api-integration';
 *
 * export const POST = createMultiProviderHandler({
 *   defaultProvider: 'claude',
 *   enableFallback: true,
 *   beforeChat: async (req, messages) => {
 *     // Validate, modify messages, etc.
 *     return messages;
 *   },
 * });
 * ```
 */
export interface MultiProviderHandlerOptions {
  /** Default provider if not specified in request */
  defaultProvider?: ProviderId;
  /** Fallback provider on failure */
  fallbackProvider?: ProviderId;
  /** Enable automatic fallback */
  enableFallback?: boolean;
  /** Enable retry on transient errors */
  enableRetry?: boolean;
  /** Hook called before chat, can modify messages */
  beforeChat?: (
    req: NextRequest,
    messages: UnifiedMessage[]
  ) => Promise<UnifiedMessage[]> | UnifiedMessage[];
  /** Hook called after successful chat */
  afterChat?: (req: NextRequest, response: MultiProviderChatResponse) => Promise<void> | void;
  /** Hook for handling errors */
  onError?: (
    req: NextRequest,
    error: UnifiedAIError
  ) => Promise<NextResponse | null> | NextResponse | null;
}

export function createMultiProviderHandler(handlerOptions: MultiProviderHandlerOptions = {}) {
  return async function handler(req: NextRequest): Promise<Response> {
    const {
      defaultProvider = 'claude',
      fallbackProvider = 'openai',
      enableFallback = true,
      enableRetry = true,
      beforeChat,
      afterChat,
      onError,
    } = handlerOptions;

    try {
      const body = (await req.json()) as MultiProviderChatRequest;

      let messages = body.messages;
      const providerId = body.providerId ?? defaultProvider;
      const shouldStream = body.stream ?? true;

      // Create service
      const service = createProviderService(providerId, fallbackProvider);

      // Run before hook
      if (beforeChat) {
        messages = await beforeChat(req, messages);
      }

      const chatOptions: ProviderChatOptions = {
        providerId,
        fallbackProviderId: body.enableFallback !== false ? fallbackProvider : undefined,
        enableFallback: body.enableFallback ?? enableFallback,
        enableRetry,
        model: body.model,
        tools: body.tools,
        systemPrompt: body.systemPrompt,
        maxTokens: body.maxTokens,
        temperature: body.temperature,
        onProviderSwitch: (from, to, reason) => {
          log.info('Provider switched during request', { from, to, reason });
        },
      };

      if (shouldStream) {
        return createStreamingResponse(service, messages, chatOptions);
      }

      const response = await createChatResponse(service, messages, chatOptions);

      // Run after hook
      if (afterChat) {
        await afterChat(req, response);
      }

      return NextResponse.json(response);
    } catch (err) {
      const error = err instanceof UnifiedAIError ? err : parseProviderError(err, defaultProvider);

      log.error('Multi-provider chat error', {
        code: error.code,
        message: error.message,
        provider: error.provider,
      });

      // Let custom handler try first
      if (onError) {
        const customResponse = await onError(req, error);
        if (customResponse) return customResponse;
      }

      // Default error response
      const errorResponse: MultiProviderErrorResponse = {
        error: {
          code: error.code,
          message: getUserFriendlyMessage(error),
          provider: error.provider,
          retryable: error.retryable,
          retryAfterMs: error.retryAfterMs,
        },
      };

      const status = error.code === 'rate_limited' ? 429 : error.code === 'auth_failed' ? 401 : 500;

      return NextResponse.json(errorResponse, { status });
    }
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract provider from request (query param, header, or body)
 */
export function extractProviderFromRequest(
  req: NextRequest,
  body?: { providerId?: ProviderId }
): ProviderId | undefined {
  // Check query param first
  const urlProvider = req.nextUrl.searchParams.get('provider');
  if (urlProvider && isValidProvider(urlProvider)) {
    return urlProvider as ProviderId;
  }

  // Check header
  const headerProvider = req.headers.get('X-AI-Provider');
  if (headerProvider && isValidProvider(headerProvider)) {
    return headerProvider as ProviderId;
  }

  // Check body
  if (body?.providerId && isValidProvider(body.providerId)) {
    return body.providerId;
  }

  return undefined;
}

/**
 * Validate provider ID
 */
function isValidProvider(id: string): id is ProviderId {
  return ['claude', 'openai', 'xai', 'deepseek'].includes(id);
}

/**
 * Format unified messages from standard chat format
 */
export function formatMessagesForProvider(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  fromProvider?: ProviderId
): UnifiedMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    metadata: fromProvider ? { provider: fromProvider } : undefined,
  }));
}

/**
 * Convert unified messages back to simple format
 */
export function simplifyMessages(
  messages: UnifiedMessage[]
): Array<{ role: string; content: string }> {
  return messages.map((m) => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : extractTextContent(m.content),
  }));
}

/**
 * Extract text content from content blocks
 */
function extractTextContent(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('');
}
