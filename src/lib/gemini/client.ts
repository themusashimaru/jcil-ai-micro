/**
 * GEMINI CLIENT
 *
 * PURPOSE:
 * - Provide Google Gemini AI chat completion functionality
 * - Support streaming responses
 * - Native vision/image support
 * - Native Google Search grounding (automatic search when needed)
 * - Full document generation support
 *
 * FEATURES:
 * - Dual-pool round-robin API key system (same as other providers)
 * - Dynamic key detection (GEMINI_API_KEY_1, _2, _3, ... unlimited)
 * - Fallback pool (GEMINI_API_KEY_FALLBACK_1, _2, ... unlimited)
 * - Rate limit handling with automatic key rotation
 * - Native Google Search grounding (model decides when to search)
 * - Streaming text responses
 * - Native multimodal support (images, files)
 */

import { GoogleGenAI } from '@google/genai';
import { CoreMessage } from 'ai';
import { getSystemPromptForTool } from '../openai/tools';
import type { ToolType } from '../openai/types';

// Default model: Gemini 2.0 Flash (fast, cost-effective, supports grounding)
const DEFAULT_MODEL = 'gemini-2.0-flash';

// ========================================
// DUAL-POOL API KEY SYSTEM (DYNAMIC)
// ========================================
// Primary Pool: Round-robin load distribution (GEMINI_API_KEY_1, _2, _3, ... unlimited)
// Fallback Pool: Emergency reserve (GEMINI_API_KEY_FALLBACK_1, _2, _3, ... unlimited)
// Backward Compatible: Single GEMINI_API_KEY still works
// NO HARDCODED LIMITS - just add keys and they're automatically detected!

interface ApiKeyState {
  key: string;
  rateLimitedUntil: number; // Timestamp when rate limit expires (0 = not limited)
  pool: 'primary' | 'fallback';
  index: number; // Position within its pool
  client: GoogleGenAI | null; // Cached client instance for this key
}

// Separate pools for better management
const primaryPool: ApiKeyState[] = [];
const fallbackPool: ApiKeyState[] = [];
let primaryKeyIndex = 0; // Round-robin index for primary pool
let fallbackKeyIndex = 0; // Round-robin index for fallback pool
let initialized = false;

/**
 * Initialize all available Gemini API keys into their pools
 * FULLY DYNAMIC: Automatically detects ALL configured keys - no limits!
 */
function initializeApiKeys(): void {
  if (initialized) return;
  initialized = true;

  // Dynamically detect ALL numbered primary keys (no limit!)
  // Try both naming conventions: GOOGLE_GENERATIVE_AI_API_KEY_X and GEMINI_API_KEY_X
  let i = 1;
  while (true) {
    const key = process.env[`GOOGLE_GENERATIVE_AI_API_KEY_${i}`] || process.env[`GEMINI_API_KEY_${i}`];
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

  // If no numbered keys found, fall back to single key (try both naming conventions)
  if (primaryPool.length === 0) {
    const singleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
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
    const key = process.env[`GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK_${j}`] || process.env[`GEMINI_API_KEY_FALLBACK_${j}`];
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
    console.log(`[Gemini] Initialized dual-pool system (dynamic detection):`);
    console.log(`[Gemini]   Primary pool: ${primaryPool.length} key(s) (round-robin load distribution)`);
    console.log(`[Gemini]   Fallback pool: ${fallbackPool.length} key(s) (emergency reserve)`);
  }
}

/**
 * Get an available key state from the primary pool (round-robin)
 */
function getAvailablePrimaryKey(): ApiKeyState | null {
  initializeApiKeys();

  if (primaryPool.length === 0) return null;

  const now = Date.now();
  const startIndex = primaryKeyIndex;

  // Try round-robin through primary pool
  do {
    const keyState = primaryPool[primaryKeyIndex];
    primaryKeyIndex = (primaryKeyIndex + 1) % primaryPool.length;

    // Check if not rate limited
    if (keyState.rateLimitedUntil <= now) {
      return keyState;
    }
  } while (primaryKeyIndex !== startIndex);

  return null; // All primary keys are rate limited
}

/**
 * Get an available key state from the fallback pool (round-robin)
 */
function getAvailableFallbackKey(): ApiKeyState | null {
  if (fallbackPool.length === 0) return null;

  const now = Date.now();
  const startIndex = fallbackKeyIndex;

  // Try round-robin through fallback pool
  do {
    const keyState = fallbackPool[fallbackKeyIndex];
    fallbackKeyIndex = (fallbackKeyIndex + 1) % fallbackPool.length;

    // Check if not rate limited
    if (keyState.rateLimitedUntil <= now) {
      return keyState;
    }
  } while (fallbackKeyIndex !== startIndex);

  return null; // All fallback keys are rate limited
}

/**
 * Get the current API key (tries primary first, then fallback)
 */
function getCurrentApiKey(): string | null {
  const primaryKey = getAvailablePrimaryKey();
  if (primaryKey) return primaryKey.key;

  const fallbackKey = getAvailableFallbackKey();
  if (fallbackKey) return fallbackKey.key;

  return null;
}

/**
 * Get a Gemini client with the current API key
 */
function getGeminiClient(): GoogleGenAI {
  initializeApiKeys();

  // Try primary pool first
  const primaryKey = getAvailablePrimaryKey();
  if (primaryKey) {
    if (!primaryKey.client) {
      primaryKey.client = new GoogleGenAI({ apiKey: primaryKey.key });
    }
    return primaryKey.client;
  }

  // Fall back to fallback pool
  const fallbackKey = getAvailableFallbackKey();
  if (fallbackKey) {
    if (!fallbackKey.client) {
      fallbackKey.client = new GoogleGenAI({ apiKey: fallbackKey.key });
    }
    return fallbackKey.client;
  }

  throw new Error('No Gemini API key available');
}

/**
 * Mark a key as rate limited
 */
function markKeyRateLimited(key: string, retryAfterSeconds: number): void {
  const allKeys = [...primaryPool, ...fallbackPool];
  const keyState = allKeys.find(k => k.key === key);
  if (keyState) {
    keyState.rateLimitedUntil = Date.now() + retryAfterSeconds * 1000;
    console.log(`[Gemini] Key ${keyState.pool}[${keyState.index}] rate limited for ${retryAfterSeconds}s`);
  }
}

/**
 * Get current time context for system prompt
 */
function getCurrentTimeContext(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  };
  return `Current date and time: ${now.toLocaleDateString('en-US', options)}`;
}

// Content types for the new SDK
interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/**
 * Convert CoreMessage to Gemini Content format (new SDK)
 */
function convertToGeminiMessages(messages: CoreMessage[], systemPrompt: string): { contents: GeminiContent[]; systemInstruction: string } {
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      // System messages go into systemInstruction
      continue;
    }

    const role: 'user' | 'model' = message.role === 'assistant' ? 'model' : 'user';
    const parts: GeminiPart[] = [];

    if (typeof message.content === 'string') {
      parts.push({ text: message.content });
    } else if (Array.isArray(message.content)) {
      // Handle multimodal content
      for (const part of message.content) {
        if (part.type === 'text') {
          parts.push({ text: part.text });
        } else if (part.type === 'image') {
          // Handle image content
          const imageUrl = typeof part.image === 'string' ? part.image : '';
          if (imageUrl.startsWith('data:')) {
            // Base64 image
            const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              parts.push({
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2],
                },
              });
            }
          } else if (imageUrl) {
            // URL image - include as text reference for now
            parts.push({ text: `[Image: ${imageUrl}]` });
          }
        }
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  return { contents, systemInstruction: systemPrompt };
}

// ========================================
// CHAT COMPLETION INTERFACES
// ========================================

export interface GeminiChatOptions {
  messages: CoreMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
  tool?: ToolType;
  userId?: string;
  planKey?: string;
  enableSearch?: boolean; // Enable Google Search grounding
}

/**
 * Create a non-streaming chat completion using Gemini
 * With optional Google Search grounding for real-time information
 */
export async function createGeminiCompletion(options: GeminiChatOptions): Promise<{
  text: string;
  model: string;
  groundingMetadata?: {
    searchEntryPoint?: { renderedContent?: string };
    groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    webSearchQueries?: string[];
  };
}> {
  const {
    messages,
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt,
    tool,
    enableSearch = false, // Default to false for document generation
  } = options;

  const selectedModel = model || DEFAULT_MODEL;

  const client = getGeminiClient();
  const currentKey = getCurrentApiKey();

  // Build system prompt
  const baseSystemPrompt = systemPrompt || getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();
  const fullSystemPrompt = `${baseSystemPrompt}\n\n---\n\n${timeContext}`;

  // Convert messages
  const { contents, systemInstruction } = convertToGeminiMessages(messages, fullSystemPrompt);

  console.log('[Gemini] Creating completion with model:', selectedModel, 'search:', enableSearch);

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Gemini] Retry attempt ${attempt + 1}/${maxRetries}`);
      }

      // Build config with optional Google Search grounding
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = {
        maxOutputTokens: maxTokens,
        temperature,
        systemInstruction,
      };

      // Enable Google Search grounding if requested
      if (enableSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await client.models.generateContent({
        model: selectedModel,
        contents,
        config,
      });

      const text = response.text || '';

      // Extract grounding metadata if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candidate = (response as any).candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;

      if (groundingMetadata?.webSearchQueries?.length > 0) {
        console.log('[Gemini] Used Google Search for:', groundingMetadata.webSearchQueries);
      }

      return {
        text,
        model: selectedModel,
        groundingMetadata,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check for rate limit error
      const isRateLimit = lastError.message.includes('rate_limit') ||
                          lastError.message.includes('429') ||
                          lastError.message.includes('RESOURCE_EXHAUSTED') ||
                          lastError.message.toLowerCase().includes('too many requests');

      if (isRateLimit && currentKey) {
        // Extract retry-after if available, default to 60 seconds
        const retryMatch = lastError.message.match(/retry.?after[:\s]*(\d+)/i);
        const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 60;

        markKeyRateLimited(currentKey, retryAfter);

        if (attempt < maxRetries - 1) {
          console.log(`[Gemini] Rate limited, trying next key...`);
          continue;
        }
      }

      // For non-rate-limit errors or last attempt, throw
      if (attempt === maxRetries - 1) {
        console.error('[Gemini] Chat completion error (all retries exhausted):', lastError);
        throw lastError;
      }

      console.error(`[Gemini] Error on attempt ${attempt + 1}, retrying:`, lastError.message);
    }
  }

  throw lastError || new Error('All Gemini API keys exhausted');
}

/**
 * Create a streaming chat completion using Gemini
 * With optional Google Search grounding for real-time information
 */
export async function createGeminiStreamingCompletion(options: GeminiChatOptions): Promise<{
  stream: ReadableStream<Uint8Array>;
  model: string;
}> {
  const {
    messages,
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt,
    tool,
    enableSearch = true, // Default to true for chat - auto search when needed
  } = options;

  const selectedModel = model || DEFAULT_MODEL;

  const client = getGeminiClient();

  // Build system prompt
  const baseSystemPrompt = systemPrompt || getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();

  // If search is enabled, add guidance about using it
  const searchGuidance = enableSearch ? `
You have access to Google Search to find current information. Use it when:
- User asks about recent events, news, or current information
- User needs to fact-check something
- User asks about topics that may have changed since your knowledge cutoff
- User explicitly asks you to search or look something up

When you use search, naturally incorporate the information into your response.` : '';

  const fullSystemPrompt = `${baseSystemPrompt}${searchGuidance}\n\n---\n\n${timeContext}`;

  // Convert messages
  const { contents, systemInstruction } = convertToGeminiMessages(messages, fullSystemPrompt);

  console.log('[Gemini] Creating streaming completion with model:', selectedModel, 'search:', enableSearch);

  // Build config with optional Google Search grounding
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    maxOutputTokens: maxTokens,
    temperature,
    systemInstruction,
  };

  // Enable Google Search grounding if requested
  if (enableSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  const response = await client.models.generateContentStream({
    model: selectedModel,
    contents,
    config,
  });

  // Create a TransformStream to convert Gemini stream to text stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of response) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        console.error('[Gemini] Streaming error:', error);
        // Send a graceful error message to the user instead of crashing
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isRateLimit = errorMessage.includes('rate_limit') ||
                           errorMessage.includes('429') ||
                           errorMessage.includes('RESOURCE_EXHAUSTED');
        const userMessage = isRateLimit
          ? '\n\n*[Response interrupted: Rate limit reached. Please try again in a moment.]*'
          : '\n\n*[Response interrupted: Connection error. Please try again.]*';
        controller.enqueue(encoder.encode(userMessage));
        controller.close();
      }
    }
  });

  return {
    stream,
    model: selectedModel,
  };
}

/**
 * Check if Gemini is configured
 */
export function isGeminiConfigured(): boolean {
  initializeApiKeys();
  return primaryPool.length > 0 || fallbackPool.length > 0;
}

// Export types
export type GeminiModel = string;
