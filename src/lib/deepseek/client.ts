/**
 * DEEPSEEK CLIENT
 *
 * PURPOSE:
 * - Provide DeepSeek AI chat completion functionality
 * - Support streaming responses
 * - Support reasoning mode (DeepSeek-R1)
 * - OpenAI-compatible API format
 *
 * FEATURES:
 * - Dual-pool round-robin API key system (same as Anthropic/OpenAI/xAI)
 * - Dynamic key detection (DEEPSEEK_API_KEY_1, _2, _3, ... unlimited)
 * - Fallback pool (DEEPSEEK_API_KEY_FALLBACK_1, _2, ... unlimited)
 * - Rate limit handling with automatic key rotation
 * - Streaming text responses
 * - Reasoning mode with chain-of-thought output
 */

import OpenAI from 'openai';
import { CoreMessage } from 'ai';
import { getSystemPromptForTool } from '../openai/tools';
import type { ToolType } from '../openai/types';
import type { DeepSeekModel } from './types';

// Default model: DeepSeek Chat (fast, cost-effective)
const DEFAULT_MODEL: DeepSeekModel = 'deepseek-chat';
const REASONING_MODEL: DeepSeekModel = 'deepseek-reasoner';

// DeepSeek API base URL
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

// ========================================
// DUAL-POOL API KEY SYSTEM (DYNAMIC)
// ========================================
// Primary Pool: Round-robin load distribution (DEEPSEEK_API_KEY_1, _2, _3, ... unlimited)
// Fallback Pool: Emergency reserve (DEEPSEEK_API_KEY_FALLBACK_1, _2, _3, ... unlimited)
// Backward Compatible: Single DEEPSEEK_API_KEY still works
// NO HARDCODED LIMITS - just add keys and they're automatically detected!

interface ApiKeyState {
  key: string;
  rateLimitedUntil: number; // Timestamp when rate limit expires (0 = not limited)
  pool: 'primary' | 'fallback';
  index: number; // Position within its pool
  client: OpenAI | null; // Cached client instance for this key
}

// Separate pools for better management
const primaryPool: ApiKeyState[] = [];
const fallbackPool: ApiKeyState[] = [];
let primaryKeyIndex = 0; // Round-robin index for primary pool
let fallbackKeyIndex = 0; // Round-robin index for fallback pool
let initialized = false;

/**
 * Initialize all available DeepSeek API keys into their pools
 * FULLY DYNAMIC: Automatically detects ALL configured keys - no limits!
 */
function initializeApiKeys(): void {
  if (initialized) return;
  initialized = true;

  // Dynamically detect ALL numbered primary keys (no limit!)
  let i = 1;
  while (true) {
    const key = process.env[`DEEPSEEK_API_KEY_${i}`];
    if (!key) break; // Stop when we hit a gap

    primaryPool.push({
      key,
      rateLimitedUntil: 0,
      pool: 'primary',
      index: i,
      client: null,
    });
    i++;
  }

  // If no numbered keys found, fall back to single DEEPSEEK_API_KEY
  if (primaryPool.length === 0) {
    const singleKey = process.env.DEEPSEEK_API_KEY;
    if (singleKey) {
      primaryPool.push({
        key: singleKey,
        rateLimitedUntil: 0,
        pool: 'primary',
        index: 0,
        client: null,
      });
    }
  }

  // Dynamically detect ALL fallback keys (no limit!)
  let j = 1;
  while (true) {
    const key = process.env[`DEEPSEEK_API_KEY_FALLBACK_${j}`];
    if (!key) break; // Stop when we hit a gap

    fallbackPool.push({
      key,
      rateLimitedUntil: 0,
      pool: 'fallback',
      index: j,
      client: null,
    });
    j++;
  }

  // Log the detected configuration
  const totalKeys = primaryPool.length + fallbackPool.length;
  if (totalKeys > 0) {
    console.log(`[DeepSeek] Initialized dual-pool system (dynamic detection):`);
    console.log(`[DeepSeek]   Primary pool: ${primaryPool.length} key(s) (round-robin load distribution)`);
    console.log(`[DeepSeek]   Fallback pool: ${fallbackPool.length} key(s) (emergency reserve)`);
  }
}

/**
 * Get an available key state from the primary pool (round-robin)
 * Returns null if all primary keys are rate limited
 */
function getPrimaryKeyState(): ApiKeyState | null {
  const now = Date.now();

  // Round-robin through primary pool
  for (let i = 0; i < primaryPool.length; i++) {
    const keyIndex = (primaryKeyIndex + i) % primaryPool.length;
    const keyState = primaryPool[keyIndex];

    if (keyState.rateLimitedUntil <= now) {
      // Advance round-robin for next request (load distribution)
      primaryKeyIndex = (keyIndex + 1) % primaryPool.length;
      return keyState;
    }
  }

  return null; // All primary keys are rate limited
}

/**
 * Get an available key state from the fallback pool
 * Returns null if all fallback keys are rate limited
 */
function getFallbackKeyState(): ApiKeyState | null {
  if (fallbackPool.length === 0) return null;

  const now = Date.now();

  for (let i = 0; i < fallbackPool.length; i++) {
    const keyIndex = (fallbackKeyIndex + i) % fallbackPool.length;
    const keyState = fallbackPool[keyIndex];

    if (keyState.rateLimitedUntil <= now) {
      fallbackKeyIndex = (keyIndex + 1) % fallbackPool.length;
      console.log(`[DeepSeek] Using FALLBACK key ${keyState.index} (primary pool exhausted)`);
      return keyState;
    }
  }

  return null; // All fallback keys are also rate limited
}

/**
 * Get the next available API key state
 * Priority: Primary pool (round-robin) -> Fallback pool -> Wait for soonest available
 */
function getApiKeyState(): ApiKeyState | null {
  initializeApiKeys();

  // No keys configured at all
  if (primaryPool.length === 0 && fallbackPool.length === 0) {
    return null;
  }

  // Try primary pool first (round-robin for load distribution)
  const primaryKeyState = getPrimaryKeyState();
  if (primaryKeyState) {
    return primaryKeyState;
  }

  // Primary pool exhausted - try fallback pool
  const fallbackKeyState = getFallbackKeyState();
  if (fallbackKeyState) {
    return fallbackKeyState;
  }

  // All keys rate limited - find the one available soonest
  const allKeys = [...primaryPool, ...fallbackPool];
  let soonestKey = allKeys[0];

  for (const key of allKeys) {
    if (key.rateLimitedUntil < soonestKey.rateLimitedUntil) {
      soonestKey = key;
    }
  }

  const waitTime = Math.ceil((soonestKey.rateLimitedUntil - Date.now()) / 1000);
  console.log(`[DeepSeek] All ${allKeys.length} keys rate limited. Using ${soonestKey.pool} key ${soonestKey.index} (available in ${waitTime}s)`);

  return soonestKey;
}

/**
 * Mark a specific API key as rate limited
 */
export function markDeepSeekKeyRateLimited(apiKey: string, retryAfterSeconds: number = 60): void {
  const allKeys = [...primaryPool, ...fallbackPool];
  const keyState = allKeys.find(k => k.key === apiKey);

  if (keyState) {
    keyState.rateLimitedUntil = Date.now() + (retryAfterSeconds * 1000);
    console.log(`[DeepSeek] ${keyState.pool.toUpperCase()} key ${keyState.index} rate limited for ${retryAfterSeconds}s`);

    // Log pool status
    const now = Date.now();
    const availablePrimary = primaryPool.filter(k => k.rateLimitedUntil <= now).length;
    const availableFallback = fallbackPool.filter(k => k.rateLimitedUntil <= now).length;
    console.log(`[DeepSeek] Pool status: ${availablePrimary}/${primaryPool.length} primary, ${availableFallback}/${fallbackPool.length} fallback available`);
  }
}

/**
 * Get total number of API keys configured
 */
export function getDeepSeekTotalKeyCount(): number {
  initializeApiKeys();
  return primaryPool.length + fallbackPool.length;
}

/**
 * Check if DeepSeek is configured (has at least one API key)
 */
export function isDeepSeekConfigured(): boolean {
  initializeApiKeys();
  return primaryPool.length > 0 || fallbackPool.length > 0;
}

/**
 * Get stats about API key usage
 */
export function getDeepSeekKeyStats(): {
  primaryKeys: number;
  primaryAvailable: number;
  fallbackKeys: number;
  fallbackAvailable: number;
  totalKeys: number;
  totalAvailable: number;
} {
  initializeApiKeys();
  const now = Date.now();

  const primaryAvailable = primaryPool.filter(k => k.rateLimitedUntil <= now).length;
  const fallbackAvailable = fallbackPool.filter(k => k.rateLimitedUntil <= now).length;

  return {
    primaryKeys: primaryPool.length,
    primaryAvailable,
    fallbackKeys: fallbackPool.length,
    fallbackAvailable,
    totalKeys: primaryPool.length + fallbackPool.length,
    totalAvailable: primaryAvailable + fallbackAvailable,
  };
}

/**
 * Get current API key (for rate limit tracking)
 */
export function getCurrentDeepSeekApiKey(): string | null {
  const keyState = getApiKeyState();
  return keyState?.key || null;
}

/**
 * Get DeepSeek client for current key (with caching)
 * Uses OpenAI SDK with DeepSeek base URL
 */
function getDeepSeekClient(): OpenAI {
  const keyState = getApiKeyState();

  if (!keyState) {
    throw new Error('DEEPSEEK_API_KEY is not configured. Set DEEPSEEK_API_KEY or DEEPSEEK_API_KEY_1, _2, etc.');
  }

  // Cache the client instance for this key
  if (!keyState.client) {
    keyState.client = new OpenAI({
      apiKey: keyState.key,
      baseURL: DEEPSEEK_BASE_URL,
    });
  }

  return keyState.client;
}

// ========================================
// CHAT COMPLETION
// ========================================

export interface DeepSeekChatOptions {
  messages: CoreMessage[];
  model?: DeepSeekModel;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
  tool?: ToolType;
  userId?: string;
  planKey?: string;
  reasoning?: boolean; // Enable reasoning mode (uses deepseek-reasoner)
}

/**
 * Get current time context for the AI
 */
function getCurrentTimeContext(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  };
  return `Current date and time: ${now.toLocaleDateString('en-US', options)}`;
}

/**
 * Convert CoreMessage to OpenAI format
 */
function convertToOpenAIMessages(messages: CoreMessage[], systemPrompt: string): OpenAI.Chat.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      // Handle both string and array content
      if (typeof msg.content === 'string') {
        result.push({ role: 'user', content: msg.content });
      } else if (Array.isArray(msg.content)) {
        // Convert content parts
        const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
        for (const part of msg.content) {
          if (part.type === 'text') {
            parts.push({ type: 'text', text: part.text });
          } else if (part.type === 'image') {
            // Handle image content
            const imageData = typeof part.image === 'string' ? part.image : '';
            parts.push({
              type: 'image_url',
              image_url: { url: imageData }
            });
          }
        }
        result.push({ role: 'user', content: parts });
      }
    } else if (msg.role === 'assistant') {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      result.push({ role: 'assistant', content });
    }
  }

  return result;
}

/**
 * Create a chat completion using DeepSeek
 */
export async function createDeepSeekCompletion(options: DeepSeekChatOptions): Promise<{
  text: string;
  reasoningContent?: string;
  model: DeepSeekModel;
}> {
  const {
    messages,
    model,
    maxTokens = 4096,
    temperature = 0.7,
    stream = false,
    systemPrompt,
    tool,
    reasoning = false,
  } = options;

  // Use passed model if provided, otherwise fall back to reasoning/default model
  // This allows the chat API to specify exact models from settings
  const selectedModel = model || (reasoning ? REASONING_MODEL : DEFAULT_MODEL);

  const client = getDeepSeekClient();
  const currentKey = getCurrentDeepSeekApiKey();

  // Build system prompt
  const baseSystemPrompt = systemPrompt || getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();
  const fullSystemPrompt = `${baseSystemPrompt}\n\n---\n\n${timeContext}`;

  // Convert messages
  const openaiMessages = convertToOpenAIMessages(messages, fullSystemPrompt);

  console.log('[DeepSeek] Creating completion with model:', selectedModel, 'reasoning:', reasoning, 'stream:', stream);

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[DeepSeek] Retry attempt ${attempt + 1}/${maxRetries}`);
      }

      if (stream) {
        // Streaming mode - collect chunks
        const streamResponse = await client.chat.completions.create({
          model: selectedModel,
          messages: openaiMessages,
          max_tokens: maxTokens,
          temperature,
          stream: true,
        });

        // Collect streamed content
        let fullContent = '';
        for await (const chunk of streamResponse) {
          const content = chunk.choices[0]?.delta?.content || '';
          fullContent += content;
        }

        return {
          text: fullContent,
          model: selectedModel,
        };
      } else {
        // Non-streaming mode
        const response = await client.chat.completions.create({
          model: selectedModel,
          messages: openaiMessages,
          max_tokens: maxTokens,
          temperature,
          stream: false,
        });

        const message = response.choices[0]?.message;
        const content = message?.content || '';

        // DeepSeek reasoner returns reasoning_content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reasoningContent = (message as any)?.reasoning_content;

        return {
          text: content,
          reasoningContent,
          model: selectedModel,
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check for rate limit error
      const isRateLimit = lastError.message.includes('rate_limit') ||
                          lastError.message.includes('429') ||
                          lastError.message.toLowerCase().includes('too many requests');

      if (isRateLimit && currentKey) {
        // Extract retry-after if available, default to 60 seconds
        const retryMatch = lastError.message.match(/retry.?after[:\s]*(\d+)/i);
        const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 60;

        markDeepSeekKeyRateLimited(currentKey, retryAfter);

        if (attempt < maxRetries - 1) {
          console.log(`[DeepSeek] Rate limited, trying next key...`);
          continue;
        }
      }

      // For non-rate-limit errors or last attempt, throw
      if (attempt === maxRetries - 1) {
        console.error('[DeepSeek] Chat completion error (all retries exhausted):', lastError);
        throw lastError;
      }

      console.error(`[DeepSeek] Error on attempt ${attempt + 1}, retrying:`, lastError.message);
    }
  }

  throw lastError || new Error('All DeepSeek API keys exhausted');
}

/**
 * Create a streaming chat completion using DeepSeek
 */
export async function createDeepSeekStreamingCompletion(options: DeepSeekChatOptions): Promise<{
  stream: ReadableStream<Uint8Array>;
  model: DeepSeekModel;
}> {
  const {
    messages,
    model,
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt,
    tool,
    reasoning = false,
  } = options;

  // Use passed model if provided, otherwise fall back to reasoning/default model
  // This allows the chat API to specify exact models from settings
  const selectedModel = model || (reasoning ? REASONING_MODEL : DEFAULT_MODEL);

  const client = getDeepSeekClient();

  // Build system prompt
  const baseSystemPrompt = systemPrompt || getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();
  const fullSystemPrompt = `${baseSystemPrompt}\n\n---\n\n${timeContext}`;

  // Convert messages
  const openaiMessages = convertToOpenAIMessages(messages, fullSystemPrompt);

  console.log('[DeepSeek] Creating streaming completion with model:', selectedModel, 'reasoning:', reasoning);

  const response = await client.chat.completions.create({
    model: selectedModel,
    messages: openaiMessages,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  });

  // Create a TransformStream to convert DeepSeek stream to text stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let reasoningBuffer = '';
        let isInReasoning = false;

        for await (const chunk of response) {
          // Handle reasoning content if present (DeepSeek-R1)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const delta = chunk.choices[0]?.delta as any;

          // Check for reasoning_content in the delta
          if (delta?.reasoning_content) {
            if (!isInReasoning) {
              isInReasoning = true;
              // Start reasoning block
              controller.enqueue(encoder.encode('\n<details>\n<summary>💭 Reasoning</summary>\n\n'));
            }
            reasoningBuffer += delta.reasoning_content;
            controller.enqueue(encoder.encode(delta.reasoning_content));
          }

          // Regular content
          const content = delta?.content || '';
          if (content) {
            if (isInReasoning && reasoningBuffer) {
              // Close reasoning block before regular content
              controller.enqueue(encoder.encode('\n\n</details>\n\n'));
              isInReasoning = false;
            }
            controller.enqueue(encoder.encode(content));
          }
        }

        // Close reasoning block if still open
        if (isInReasoning) {
          controller.enqueue(encoder.encode('\n\n</details>\n\n'));
        }

        controller.close();
      } catch (error) {
        console.error('[DeepSeek] Streaming error:', error);
        controller.error(error);
      }
    }
  });

  return {
    stream,
    model: selectedModel,
  };
}

// Export types
export type { DeepSeekModel } from './types';
