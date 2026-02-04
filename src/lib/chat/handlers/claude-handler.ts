/**
 * CLAUDE CHAT HANDLER
 *
 * Handles chat requests routed to Claude (Anthropic) with:
 * - Full tool support
 * - Streaming optimization
 * - Prompt caching
 * - Context compression
 */

import type { CoreMessage } from 'ai';
import { routeChatWithTools, type ChatRouteOptions, type ToolExecutor } from '@/lib/ai/chat-router';
import { compressContext, needsCompression, type Message } from '../context-compressor';
import { createStreamOptimizer } from '../stream-optimizer';
import { logger } from '@/lib/logger';

const log = logger('ClaudeHandler');

// ============================================================================
// TYPES
// ============================================================================

export interface ClaudeHandlerOptions {
  /** Model to use */
  model: string;
  /** System prompt */
  systemPrompt: string;
  /** Maximum tokens for response */
  maxTokens: number;
  /** Temperature (0-1) */
  temperature: number;
  /** Available tools */
  tools: unknown[];
  /** Tool executor function */
  toolExecutor: ToolExecutor;
  /** Callback when provider switches (fallback) */
  onProviderSwitch?: (from: string, to: string, reason: string) => void;
  /** Enable streaming optimization */
  optimizeStreaming?: boolean;
  /** Enable context compression */
  enableCompression?: boolean;
}

export interface ClaudeHandlerResult {
  /** The response stream */
  stream: ReadableStream<Uint8Array>;
  /** Provider that was used */
  providerId: string;
  /** Model that was used */
  model: string;
  /** Whether fallback was used */
  usedFallback: boolean;
  /** Tools that were used */
  toolsUsed: string[];
}

// ============================================================================
// HANDLER
// ============================================================================

/**
 * Handle a chat request with Claude
 */
export async function handleClaudeChat(
  messages: CoreMessage[],
  options: ClaudeHandlerOptions
): Promise<ClaudeHandlerResult> {
  const {
    model,
    systemPrompt,
    maxTokens,
    temperature,
    tools,
    toolExecutor,
    onProviderSwitch,
    optimizeStreaming = true,
    enableCompression = true,
  } = options;

  // Compress context if needed
  let processedMessages = messages;
  if (enableCompression && needsCompression(convertToSimpleMessages(messages))) {
    log.info('Compressing conversation context');
    const compressed = await compressContext(convertToSimpleMessages(messages));
    processedMessages = convertFromSimpleMessages(compressed);
  }

  // Build route options
  const routeOptions: ChatRouteOptions = {
    providerId: 'claude',
    model,
    systemPrompt,
    maxTokens,
    temperature,
    tools,
    onProviderSwitch,
  };

  // Route the chat with tools
  const routeResult = await routeChatWithTools(processedMessages, routeOptions, toolExecutor);

  log.debug('Claude chat routed', {
    provider: routeResult.providerId,
    model: routeResult.model,
    usedFallback: routeResult.usedFallback,
    usedTools: routeResult.usedTools,
  });

  // Optionally optimize the stream
  let finalStream = routeResult.stream;
  if (optimizeStreaming) {
    finalStream = routeResult.stream.pipeThrough(createStreamOptimizer());
  }

  return {
    stream: finalStream,
    providerId: routeResult.providerId,
    model: routeResult.model,
    usedFallback: routeResult.usedFallback,
    toolsUsed: routeResult.toolsUsed,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert CoreMessage array to simple Message array for compression
 */
function convertToSimpleMessages(messages: CoreMessage[]): Message[] {
  return messages.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }));
}

/**
 * Convert simple Message array back to CoreMessage array
 */
function convertFromSimpleMessages(messages: Message[]): CoreMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}
