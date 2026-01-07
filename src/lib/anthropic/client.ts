/**
 * ANTHROPIC CLIENT
 *
 * PURPOSE:
 * - Provide Claude AI chat completion functionality
 * - Support streaming responses
 * - Handle tool calls (web search via Brave)
 *
 * FEATURES:
 * - Dual-pool round-robin API key system (same as Perplexity)
 * - Dynamic key detection (ANTHROPIC_API_KEY_1, _2, _3, ... unlimited)
 * - Fallback pool (ANTHROPIC_API_KEY_FALLBACK_1, _2, ... unlimited)
 * - Rate limit handling with automatic key rotation
 * - Streaming text responses
 * - Non-streaming for image analysis
 * - Web search integration via Brave
 */

import Anthropic from '@anthropic-ai/sdk';
import { CoreMessage } from 'ai';

// Default model: Claude Sonnet 4 (latest stable)
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

// ========================================
// DUAL-POOL API KEY SYSTEM (DYNAMIC)
// ========================================
// Primary Pool: Round-robin load distribution (ANTHROPIC_API_KEY_1, _2, _3, ... unlimited)
// Fallback Pool: Emergency reserve (ANTHROPIC_API_KEY_FALLBACK_1, _2, _3, ... unlimited)
// Backward Compatible: Single ANTHROPIC_API_KEY still works
// NO HARDCODED LIMITS - just add keys and they're automatically detected!

interface ApiKeyState {
  key: string;
  rateLimitedUntil: number; // Timestamp when rate limit expires (0 = not limited)
  pool: 'primary' | 'fallback';
  index: number; // Position within its pool
  client: Anthropic | null; // Cached client instance for this key
}

// Separate pools for better management
const primaryPool: ApiKeyState[] = [];
const fallbackPool: ApiKeyState[] = [];
// Note: Using random key selection instead of round-robin indices
// to avoid race conditions in serverless environments
let initialized = false;

/**
 * Initialize all available Anthropic API keys into their pools
 * FULLY DYNAMIC: Automatically detects ALL configured keys - no limits!
 */
function initializeApiKeys(): void {
  if (initialized) return;
  initialized = true;

  // Dynamically detect ALL numbered primary keys (no limit!)
  let i = 1;
  while (true) {
    const key = process.env[`ANTHROPIC_API_KEY_${i}`];
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

  // If no numbered keys found, fall back to single ANTHROPIC_API_KEY
  if (primaryPool.length === 0) {
    const singleKey = process.env.ANTHROPIC_API_KEY;
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
    const key = process.env[`ANTHROPIC_API_KEY_FALLBACK_${j}`];
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
    console.log(`[Anthropic] Initialized dual-pool system (dynamic detection):`);
    console.log(`[Anthropic]   Primary pool: ${primaryPool.length} key(s) (round-robin load distribution)`);
    console.log(`[Anthropic]   Fallback pool: ${fallbackPool.length} key(s) (emergency reserve)`);
  }
}

/**
 * Get an available key state from the primary pool
 * Uses random selection for serverless-safe load distribution
 * (Round-robin with global indices causes race conditions in concurrent requests)
 */
function getPrimaryKeyState(): ApiKeyState | null {
  const now = Date.now();

  // Get all available (non-rate-limited) keys
  const availableKeys = primaryPool.filter(k => k.rateLimitedUntil <= now);

  if (availableKeys.length === 0) {
    return null; // All primary keys are rate limited
  }

  // Random selection for serverless-safe load distribution
  const randomIndex = Math.floor(Math.random() * availableKeys.length);
  return availableKeys[randomIndex];
}

/**
 * Get an available key state from the fallback pool
 * Uses random selection for serverless-safe load distribution
 */
function getFallbackKeyState(): ApiKeyState | null {
  if (fallbackPool.length === 0) return null;

  const now = Date.now();

  // Get all available (non-rate-limited) fallback keys
  const availableKeys = fallbackPool.filter(k => k.rateLimitedUntil <= now);

  if (availableKeys.length === 0) {
    return null; // All fallback keys are also rate limited
  }

  // Random selection for serverless-safe load distribution
  const randomIndex = Math.floor(Math.random() * availableKeys.length);
  const keyState = availableKeys[randomIndex];
  console.log(`[Anthropic] Using FALLBACK key ${keyState.index} (primary pool exhausted)`);
  return keyState;
}

/**
 * Get the next available API key state
 * Priority: Primary pool (round-robin) → Fallback pool → Wait for soonest available
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
  console.log(`[Anthropic] All ${allKeys.length} keys rate limited. Using ${soonestKey.pool} key ${soonestKey.index} (available in ${waitTime}s)`);

  return soonestKey;
}

/**
 * Mark a specific API key as rate limited
 */
function markKeyRateLimited(apiKey: string, retryAfterSeconds: number = 60): void {
  const allKeys = [...primaryPool, ...fallbackPool];
  const keyState = allKeys.find(k => k.key === apiKey);

  if (keyState) {
    keyState.rateLimitedUntil = Date.now() + (retryAfterSeconds * 1000);
    console.log(`[Anthropic] ${keyState.pool.toUpperCase()} key ${keyState.index} rate limited for ${retryAfterSeconds}s`);

    // Log pool status
    const now = Date.now();
    const availablePrimary = primaryPool.filter(k => k.rateLimitedUntil <= now).length;
    const availableFallback = fallbackPool.filter(k => k.rateLimitedUntil <= now).length;
    console.log(`[Anthropic] Pool status: ${availablePrimary}/${primaryPool.length} primary, ${availableFallback}/${fallbackPool.length} fallback available`);
  }
}

/**
 * Get total number of API keys configured
 */
function getTotalKeyCount(): number {
  initializeApiKeys();
  return primaryPool.length + fallbackPool.length;
}

/**
 * Check if Anthropic is configured (has at least one API key)
 */
export function isAnthropicConfigured(): boolean {
  initializeApiKeys();
  return primaryPool.length > 0 || fallbackPool.length > 0;
}

/**
 * Get stats about API key usage
 */
export function getAnthropicKeyStats(): {
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
 * Request-scoped key and client tracking
 * Returns both client and key together atomically to prevent race conditions
 * in concurrent serverless requests.
 */
interface ClientWithKey {
  client: Anthropic;
  key: string;
  keyIndex: number;
}

/**
 * Get Anthropic client with associated key (request-scoped)
 * Returns both the client AND the key atomically to prevent race conditions.
 *
 * This is the PRIMARY function to use for all API calls.
 * It ensures the client and key are always paired correctly,
 * even when multiple concurrent requests are being processed.
 */
function getAnthropicClientWithKey(): ClientWithKey {
  const keyState = getApiKeyState();

  if (!keyState) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set ANTHROPIC_API_KEY or ANTHROPIC_API_KEY_1, _2, etc.');
  }

  // Cache the client instance for this key
  if (!keyState.client) {
    keyState.client = new Anthropic({ apiKey: keyState.key });
  }

  return {
    client: keyState.client,
    key: keyState.key,
    keyIndex: keyState.index
  };
}

export interface AnthropicChatOptions {
  messages: CoreMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
  userId?: string;
  planKey?: string;
  // Web search function (injected from Brave Search module)
  webSearchFn?: (query: string) => Promise<BraveSearchResult>;
}

export interface BraveSearchResult {
  results: Array<{
    title: string;
    url: string;
    description: string;
    content?: string;
  }>;
  query: string;
}

// Valid image media types for Anthropic API
type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

// Anthropic message content types
type AnthropicMessageContent = string | Array<
  { type: 'text'; text: string } |
  { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }
>;

/**
 * Convert CoreMessage format to Anthropic message format
 */
function convertMessages(messages: CoreMessage[], systemPrompt?: string): {
  system: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: AnthropicMessageContent;
  }>;
} {
  const system = systemPrompt || 'You are a helpful AI assistant.';
  const anthropicMessages: Array<{
    role: 'user' | 'assistant';
    content: AnthropicMessageContent;
  }> = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isLastMessage = i === messages.length - 1;

    // Skip system messages - they go in the system parameter
    if (msg.role === 'system') continue;

    if (msg.role === 'user' || msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        // Claude API requires non-empty content for all messages except optional final assistant
        // Skip empty messages (unless it's the final assistant message)
        if (!msg.content.trim() && !(isLastMessage && msg.role === 'assistant')) {
          console.warn(`[Anthropic] Skipping ${msg.role} message with empty content at index ${i}`);
          continue;
        }
        anthropicMessages.push({
          role: msg.role,
          content: msg.content,
        });
      } else if (Array.isArray(msg.content)) {
        // Handle multimodal content (text + images)
        const parts: Array<
          { type: 'text'; text: string } |
          { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }
        > = [];

        for (const part of msg.content) {
          // Cast to unknown to handle various image formats that may come from different sources
          const partAny = part as unknown as { type: string; text?: string; image?: string };

          if (partAny.type === 'text' && partAny.text) {
            parts.push({ type: 'text', text: partAny.text });
          } else if ((partAny.type === 'image' || partAny.type === 'image_url') && partAny.image) {
            // Extract base64 data from data URL
            const dataUrl = partAny.image;
            const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const [, mediaType, data] = matches;
              // Validate and cast media type to allowed values
              const validMediaTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
              const typedMediaType = validMediaTypes.includes(mediaType as ImageMediaType)
                ? (mediaType as ImageMediaType)
                : 'image/png'; // Default to PNG if unknown
              parts.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: typedMediaType,
                  data,
                },
              });
            }
          }
        }

        if (parts.length > 0) {
          anthropicMessages.push({
            role: msg.role,
            content: parts,
          });
        } else if (!(isLastMessage && msg.role === 'assistant')) {
          // Skip empty array content (except final assistant message)
          console.warn(`[Anthropic] Skipping ${msg.role} message with no valid content parts at index ${i}`);
        }
      }
    }
  }

  return { system, messages: anthropicMessages };
}

/**
 * Create a chat completion using Claude
 * Includes automatic retry with different API keys on rate limit
 *
 * RACE CONDITION FIX: Uses getAnthropicClientWithKey() to ensure
 * the client and key are captured together atomically.
 */
export async function createAnthropicCompletion(options: AnthropicChatOptions): Promise<{
  text: string;
  model: string;
  citations?: Array<{ title: string; url: string }>;
  numSourcesUsed?: number;
}> {
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 4096;
  const temperature = options.temperature ?? 0.7;

  const { system, messages } = convertMessages(options.messages, options.systemPrompt);

  // Retry up to the number of available API keys
  const maxRetries = Math.max(1, getTotalKeyCount());
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // CRITICAL: Get client and key together to prevent race conditions
    const { client, key: currentKey } = getAnthropicClientWithKey();

    try {
      if (attempt > 0) {
        console.log(`[Anthropic] Retry attempt ${attempt + 1}/${maxRetries}`);
      }

      // Non-streaming mode
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages,
      });

      // Extract text from response
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      return {
        text: textContent,
        model,
      };
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

        markKeyRateLimited(currentKey, retryAfter);

        if (attempt < maxRetries - 1) {
          console.log(`[Anthropic] Rate limited, trying next key...`);
          continue;
        }
      }

      // For non-rate-limit errors or last attempt, throw
      if (attempt === maxRetries - 1) {
        console.error('[Anthropic] Chat completion error (all retries exhausted):', lastError);
        throw lastError;
      }

      console.error(`[Anthropic] Error on attempt ${attempt + 1}, retrying:`, lastError.message);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('All Anthropic API keys exhausted');
}

/**
 * Create a streaming chat completion using Claude
 *
 * RELIABILITY FEATURES:
 * - Keepalive heartbeat every 15s to prevent proxy timeouts
 * - 60s timeout per chunk to detect stalled streams
 * - Graceful error handling
 *
 * RACE CONDITION FIX: Uses getAnthropicClientWithKey() to capture
 * client atomically.
 */
export async function createAnthropicStreamingCompletion(options: AnthropicChatOptions): Promise<{
  toTextStreamResponse: (opts?: { headers?: Record<string, string> }) => Response;
  model: string;
}> {
  const { client } = getAnthropicClientWithKey();
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 4096;
  const temperature = options.temperature ?? 0.7;

  const { system, messages } = convertMessages(options.messages, options.systemPrompt);

  // Configuration for reliability
  const CHUNK_TIMEOUT_MS = 60000; // 60s timeout per chunk
  const KEEPALIVE_INTERVAL_MS = 15000; // Send keepalive every 15s

  // Create a TransformStream to convert Anthropic stream to text stream
  const { readable, writable } = new TransformStream<string, string>();
  const writer = writable.getWriter();

  // Start streaming in the background
  (async () => {
    let keepaliveInterval: NodeJS.Timeout | null = null;
    let lastActivity = Date.now();

    // Keepalive function
    const startKeepalive = () => {
      keepaliveInterval = setInterval(async () => {
        const timeSinceActivity = Date.now() - lastActivity;
        if (timeSinceActivity > KEEPALIVE_INTERVAL_MS - 1000) {
          try {
            await writer.write(' ');
            console.log('[Anthropic] Sent keepalive heartbeat');
          } catch {
            // Writer might be closed, ignore
          }
        }
      }, KEEPALIVE_INTERVAL_MS);
    };

    const stopKeepalive = () => {
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
        keepaliveInterval = null;
      }
    };

    try {
      const stream = await client.messages.stream({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages,
      });

      startKeepalive();

      // Wrapper to read stream with timeout
      const iterator = stream[Symbol.asyncIterator]();

      while (true) {
        const timeoutPromise = new Promise<{ done: true; value: undefined }>((_, reject) => {
          setTimeout(() => reject(new Error('Stream chunk timeout')), CHUNK_TIMEOUT_MS);
        });

        try {
          const result = await Promise.race([
            iterator.next(),
            timeoutPromise,
          ]);

          if (result.done) break;

          lastActivity = Date.now();
          const event = result.value;

          if (event.type === 'content_block_delta') {
            const delta = event.delta;
            if ('text' in delta) {
              await writer.write(delta.text);
            }
          }
        } catch (error) {
          if (error instanceof Error && error.message === 'Stream chunk timeout') {
            console.error('[Anthropic] Stream chunk timeout - no data for 60s');
            await writer.write('\n\n*[Response interrupted: Connection timed out. Please try again.]*');
          }
          throw error;
        }
      }
    } catch (error) {
      console.error('[Anthropic] Streaming error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRateLimit = errorMessage.includes('rate_limit') || errorMessage.includes('429');
      const userMessage = isRateLimit
        ? '\n\n*[Response interrupted: High demand. Please try again in a moment.]*'
        : '\n\n*[Response interrupted: Connection error. Please try again.]*';
      try {
        await writer.write(userMessage);
      } catch {
        // Writer might be closed, ignore
      }
    } finally {
      stopKeepalive();
      await writer.close();
    }
  })();

  return {
    toTextStreamResponse: (opts?: { headers?: Record<string, string> }) => {
      return new Response(readable.pipeThrough(new TextEncoderStream()), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          ...opts?.headers,
        },
      });
    },
    model,
  };
}

/**
 * Create a chat completion with web search support
 * Uses Brave Search when available
 *
 * RACE CONDITION FIX: Uses getAnthropicClientWithKey() atomically.
 */
export async function createAnthropicCompletionWithSearch(
  options: AnthropicChatOptions
): Promise<{
  text: string;
  model: string;
  citations: Array<{ title: string; url: string }>;
  numSourcesUsed: number;
}> {
  const { webSearchFn, ...rest } = options;

  if (!webSearchFn) {
    // No search function provided, use regular completion
    const result = await createAnthropicCompletion(rest);
    return { ...result, citations: [], numSourcesUsed: 0 };
  }

  const { client } = getAnthropicClientWithKey();
  const model = rest.model || DEFAULT_MODEL;
  const maxTokens = rest.maxTokens || 4096;
  const temperature = rest.temperature ?? 0.7;

  const { system, messages } = convertMessages(rest.messages, rest.systemPrompt);

  // Define the web search tool
  const tools: Anthropic.Tool[] = [
    {
      name: 'web_search',
      description: 'Search the web for current information. Use this when the user asks about recent events, current data, or information that may have changed since your training.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up',
          },
        },
        required: ['query'],
      },
    },
  ];

  const citations: Array<{ title: string; url: string }> = [];
  const currentMessages = [...messages];
  let iterations = 0;
  const maxIterations = 3; // Prevent infinite loops

  while (iterations < maxIterations) {
    iterations++;

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: system + '\n\nYou have access to web search. Use it when you need current information.',
      messages: currentMessages,
      tools,
    });

    // Check if the model wants to use a tool
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) {
      // No tool use, return the text response
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      return {
        text: textContent,
        model,
        citations,
        numSourcesUsed: citations.length,
      };
    }

    // Process tool calls
    for (const toolUse of toolUseBlocks) {
      if (toolUse.name === 'web_search') {
        const query = (toolUse.input as { query: string }).query;
        console.log('[Anthropic] Executing web search:', query);

        try {
          const searchResults = await webSearchFn(query);

          // Add citations from search results
          for (const result of searchResults.results.slice(0, 5)) {
            citations.push({
              title: result.title,
              url: result.url,
            });
          }

          // Format search results for the model
          const formattedResults = searchResults.results
            .slice(0, 5)
            .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description}${r.content ? '\n' + r.content.slice(0, 500) : ''}`)
            .join('\n\n');

          // Add the assistant's response and tool result to messages
          currentMessages.push({
            role: 'assistant',
            content: response.content.map((block) => {
              if (block.type === 'text') {
                return { type: 'text' as const, text: block.text };
              } else if (block.type === 'tool_use') {
                return {
                  type: 'tool_use' as const,
                  id: block.id,
                  name: block.name,
                  input: block.input,
                };
              }
              // Handle other block types (e.g., thinking) by returning empty text
              return { type: 'text' as const, text: '' };
            }) as Array<{ type: 'text'; text: string }>,
          });

          currentMessages.push({
            role: 'user',
            content: [{
              type: 'tool_result' as unknown as 'text',
              tool_use_id: toolUse.id,
              content: `Search results for "${query}":\n\n${formattedResults}`,
            }] as unknown as Array<{ type: 'text'; text: string }>,
          });
        } catch (error) {
          console.error('[Anthropic] Web search error:', error);
          // Provide error feedback to the model
          currentMessages.push({
            role: 'assistant',
            content: response.content.map((block) => {
              if (block.type === 'text') {
                return { type: 'text' as const, text: block.text };
              } else if (block.type === 'tool_use') {
                return {
                  type: 'tool_use' as const,
                  id: block.id,
                  name: block.name,
                  input: block.input,
                };
              }
              // Handle other block types by returning empty text
              return { type: 'text' as const, text: '' };
            }) as Array<{ type: 'text'; text: string }>,
          });
          currentMessages.push({
            role: 'user',
            content: [{
              type: 'tool_result' as unknown as 'text',
              tool_use_id: toolUse.id,
              content: 'Web search failed. Please provide a response based on your knowledge.',
              is_error: true,
            }] as unknown as Array<{ type: 'text'; text: string }>,
          });
        }
      }
    }
  }

  // If we hit max iterations, return what we have
  return {
    text: 'I apologize, but I was unable to complete the search. Please try again.',
    model,
    citations,
    numSourcesUsed: citations.length,
  };
}

/**
 * Check if image generation is requested
 * (Anthropic doesn't support image generation, so we return unavailable message)
 */
export function isImageGenerationRequest(content: string): boolean {
  const imagePatterns = [
    /\b(create|generate|make|draw|design|produce)\b.*\b(image|picture|photo|illustration|artwork|graphic)\b/i,
    /\b(image|picture|photo|illustration|artwork|graphic)\b.*\b(of|for|showing|depicting)\b/i,
    /\bdall[-\s]?e\b/i,
    /\bmidjourney\b/i,
    /\bstable diffusion\b/i,
  ];

  return imagePatterns.some(pattern => pattern.test(content));
}

/**
 * Detect if user is requesting a document (Excel, PowerPoint, Word, PDF)
 * Returns file extension format to match getDocumentFormattingPrompt expectations
 */
export function detectDocumentRequest(content: string): 'xlsx' | 'pptx' | 'docx' | 'pdf' | null {
  const lowerContent = content.toLowerCase();

  // Excel detection - spreadsheets, budgets, financial documents, trackers
  if (/\b(excel|spreadsheet|xlsx|xls)\b/.test(lowerContent) ||
      /\b(budget|financial|expense|income|tracker|tracking|schedule|calendar|planner)\b.*\b(spreadsheet|sheet)\b/.test(lowerContent) ||
      /\b(create|make|generate|build|give me|can you make|i need)\b.*\b(spreadsheet|budget|tracker|schedule)\b/.test(lowerContent) ||
      /\b(spreadsheet|budget|financial tracker)\b.*\b(create|make|for me|for)\b/.test(lowerContent)) {
    return 'xlsx';
  }

  // PowerPoint detection
  if (/\b(powerpoint|pptx|ppt|presentation|slide deck|slides)\b/.test(lowerContent) ||
      /\b(create|make|generate)\b.*\b(presentation|slides)\b/.test(lowerContent)) {
    return 'pptx';
  }

  // Word detection - documents, resumes, letters, contracts, reports
  if (/\b(word document|docx|doc file|word doc)\b/.test(lowerContent) ||
      /\b(create|make|generate|write|build|give me|can you make|i need)\b.*\b(document|resume|cv|letter|contract|proposal|report|memo|essay)\b/.test(lowerContent) ||
      /\b(resume|cv|cover letter|business letter|contract|proposal|report|memo)\b.*\b(create|make|generate|for me|for)\b/.test(lowerContent) ||
      /\b(professional|formal)\b.*\b(document|letter|resume)\b/.test(lowerContent)) {
    return 'docx';
  }

  // PDF detection - invoices, receipts, formal documents
  if (/\b(pdf)\b/.test(lowerContent) ||
      /\b(invoice|receipt|bill)\b/.test(lowerContent) ||
      /\b(create|make|generate|build|give me)\b.*\b(invoice|receipt|bill|pdf)\b/.test(lowerContent) ||
      /\b(invoice|receipt|bill)\b.*\b(create|make|generate|for)\b/.test(lowerContent)) {
    return 'pdf';
  }

  return null;
}

/**
 * Options for Skills-enabled completion
 */
export interface AnthropicSkillsOptions extends AnthropicChatOptions {
  userId?: string;
  planKey?: string;
  skills?: string[];
}

/**
 * Create Anthropic completion with Skills (agentic loop)
 */
export async function createAnthropicCompletionWithSkills(options: AnthropicSkillsOptions): Promise<{
  text: string;
  model: string;
  files?: Array<{ file_id: string; filename: string; mime_type: string }>;
}> {
  // For now, just use the regular completion
  // Skills/agentic functionality can be added later
  const result = await createAnthropicCompletion(options);
  return {
    text: result.text,
    model: result.model,
    files: [],
  };
}

/**
 * Download an Anthropic file (placeholder for file handling)
 */
export async function downloadAnthropicFile(fileId: string): Promise<{
  data: ArrayBuffer;
  filename: string;
  mimeType: string;
}> {
  console.log('[Anthropic] File download requested:', fileId);
  // Placeholder - throw error for now since we don't have actual file storage
  throw new Error(`File not found: ${fileId}`);
}

// ========================================
// HYBRID ROUTING (Haiku + Sonnet)
// ========================================

// Model IDs - Current Claude 4 models (Claude 3.x retired July 2025)
// See: https://docs.anthropic.com/en/docs/about-claude/models
export const CLAUDE_HAIKU = 'claude-haiku-4-5-20251001';   // Fast, cost-effective
export const CLAUDE_SONNET = 'claude-sonnet-4-20250514';   // Smart, balanced

/**
 * Determine which Claude model to use based on query complexity
 *
 * Returns Haiku for:
 * - Simple greetings, small talk
 * - Basic Q&A (definitions, simple facts)
 * - Short responses under 200 chars expected
 *
 * Returns Sonnet for:
 * - Research queries (multi-step reasoning)
 * - Complex analysis
 * - Code generation/review
 * - Document creation
 * - Faith/theology questions (need nuance)
 * - Long-form content
 */
export function selectClaudeModel(content: string, options?: {
  forceModel?: 'haiku' | 'sonnet';
  isResearch?: boolean;
  isDocumentGeneration?: boolean;
  isFaithTopic?: boolean;
}): string {
  // Force override
  if (options?.forceModel === 'haiku') return CLAUDE_HAIKU;
  if (options?.forceModel === 'sonnet') return CLAUDE_SONNET;

  // Always use Sonnet for these specialized tasks
  if (options?.isResearch) return CLAUDE_SONNET;
  if (options?.isDocumentGeneration) return CLAUDE_SONNET;
  if (options?.isFaithTopic) return CLAUDE_SONNET;

  const lowerContent = content.toLowerCase().trim();

  // Simple greetings → Haiku
  const simplePatterns = [
    /^(hi|hello|hey|howdy|good\s*(morning|afternoon|evening)|what'?s?\s*up)\b/i,
    /^(thanks?|thank\s*you|thx|ty)\b/i,
    /^(ok|okay|sure|got\s*it|sounds?\s*good|perfect|great|nice)\b/i,
    /^(bye|goodbye|see\s*you|later|cya)\b/i,
  ];

  for (const pattern of simplePatterns) {
    if (pattern.test(lowerContent) && lowerContent.length < 50) {
      return CLAUDE_HAIKU;
    }
  }

  // Complex patterns → Sonnet
  const complexPatterns = [
    // Research indicators
    /\b(research|investigate|analyze|compare|evaluate|assess|study)\b/i,
    /\b(in\-depth|comprehensive|detailed|thorough)\b/i,

    // Reasoning indicators
    /\b(explain|why|how\s+does|what\s+causes?|reasoning|logic)\b/i,
    /\b(pros?\s*(and|&)\s*cons?|advantages?|disadvantages?|trade\-?offs?)\b/i,

    // Code indicators
    /\b(code|function|implement|debug|refactor|review\s+my)\b/i,
    /\b(typescript|javascript|python|react|next\.?js)\b/i,

    // Document indicators
    /\b(write|create|draft|generate)\s+(a|an|my)\s+(resume|report|document|essay|article)/i,

    // Faith indicators
    /\b(bible|scripture|verse|god|jesus|faith|pray|christian|church|theology)\b/i,
    /\b(romans?|corinthians?|genesis|matthew|john|psalms?|proverbs?)\b/i,

    // Long-form indicators
    /\b(list\s+(of|all)|multiple|several|many|various)\b/i,
    /\b(step\s*by\s*step|walkthrough|tutorial|guide)\b/i,
  ];

  for (const pattern of complexPatterns) {
    if (pattern.test(lowerContent)) {
      return CLAUDE_SONNET;
    }
  }

  // Length-based: Longer queries typically need Sonnet
  if (content.length > 200) {
    return CLAUDE_SONNET;
  }

  // Default to Haiku for cost optimization
  return CLAUDE_HAIKU;
}

/**
 * Create a streaming chat completion with auto model selection
 * Uses SSE format for streaming responses
 *
 * RELIABILITY FEATURES:
 * - Keepalive heartbeat every 15s to prevent proxy timeouts
 * - 60s timeout per chunk to detect stalled streams
 * - Retry logic with API key rotation on rate limits
 * - Graceful error handling with user-friendly messages
 */
export async function createClaudeStreamingChat(options: {
  messages: CoreMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  forceModel?: 'haiku' | 'sonnet';
  isResearch?: boolean;
  isFaithTopic?: boolean;
}): Promise<{
  stream: ReadableStream<Uint8Array>;
  model: string;
}> {
  const lastUserMessage = options.messages
    .filter(m => m.role === 'user')
    .pop();

  const lastContent = lastUserMessage
    ? (typeof lastUserMessage.content === 'string'
        ? lastUserMessage.content
        : JSON.stringify(lastUserMessage.content))
    : '';

  const model = selectClaudeModel(lastContent, {
    forceModel: options.forceModel,
    isResearch: options.isResearch,
    isFaithTopic: options.isFaithTopic,
  });

  console.log(`[Claude] Streaming with model: ${model} (selected for: ${lastContent.substring(0, 50)}...)`);

  const { system, messages } = convertMessages(options.messages, options.systemPrompt);

  const encoder = new TextEncoder();

  // Configuration for reliability
  const CHUNK_TIMEOUT_MS = 60000; // 60s timeout per chunk (generous for complex reasoning)
  const KEEPALIVE_INTERVAL_MS = 15000; // Send keepalive every 15s
  const MAX_RETRIES = Math.max(1, getTotalKeyCount()); // Retry with different API keys

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let keepaliveInterval: NodeJS.Timeout | null = null;
      let lastActivity = Date.now();
      let streamStarted = false;
      let retryCount = 0;

      // Keepalive function - sends a space to keep connection alive
      // This prevents proxies/Vercel from timing out during long AI computations
      const startKeepalive = () => {
        keepaliveInterval = setInterval(() => {
          const timeSinceActivity = Date.now() - lastActivity;
          // Only send keepalive if we haven't sent data recently
          if (timeSinceActivity > KEEPALIVE_INTERVAL_MS - 1000) {
            // Send an invisible keepalive (empty comment that won't affect content)
            // Using space which is safe and won't disrupt markdown
            try {
              controller.enqueue(encoder.encode(' '));
              console.log('[Claude] Sent keepalive heartbeat');
            } catch {
              // Controller might be closed, ignore
            }
          }
        }, KEEPALIVE_INTERVAL_MS);
      };

      const stopKeepalive = () => {
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
          keepaliveInterval = null;
        }
      };

      // Wrapper to read stream with timeout
      async function* streamWithTimeout(anthropicStream: AsyncIterable<Anthropic.MessageStreamEvent>) {
        const iterator = anthropicStream[Symbol.asyncIterator]();

        while (true) {
          // Create a timeout promise
          const timeoutPromise = new Promise<{ done: true; value: undefined }>((_, reject) => {
            setTimeout(() => reject(new Error('Stream chunk timeout')), CHUNK_TIMEOUT_MS);
          });

          try {
            // Race between next chunk and timeout
            const result = await Promise.race([
              iterator.next(),
              timeoutPromise,
            ]);

            if (result.done) break;

            lastActivity = Date.now();
            yield result.value;
          } catch (error) {
            if (error instanceof Error && error.message === 'Stream chunk timeout') {
              console.error('[Claude] Stream chunk timeout - no data received for 60s');
              throw error;
            }
            throw error;
          }
        }
      }

      // Main streaming logic with retry
      const attemptStream = async (): Promise<boolean> => {
        // CRITICAL: Get client and key together to prevent race conditions
        const { client, key: currentKey } = getAnthropicClientWithKey();

        try {
          console.log(`[Claude] Starting stream attempt ${retryCount + 1}/${MAX_RETRIES}`);

          const anthropicStream = await client.messages.stream({
            model,
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
            system,
            messages,
          });

          // Start keepalive once stream is established
          if (!streamStarted) {
            streamStarted = true;
            startKeepalive();
          }

          for await (const event of streamWithTimeout(anthropicStream)) {
            if (event.type === 'content_block_delta') {
              const delta = event.delta;
              if ('text' in delta) {
                lastActivity = Date.now();
                controller.enqueue(encoder.encode(delta.text));
              }
            }
          }

          return true; // Success
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Claude] Stream error on attempt ${retryCount + 1}:`, errorMessage);

          // Check if rate limited - mark key and potentially retry
          const isRateLimit = errorMessage.includes('rate_limit') ||
                              errorMessage.includes('429') ||
                              errorMessage.toLowerCase().includes('too many requests');

          if (isRateLimit && currentKey) {
            const retryMatch = errorMessage.match(/retry.?after[:\s]*(\d+)/i);
            const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 60;
            markKeyRateLimited(currentKey, retryAfter);
          }

          // Check if we should retry
          const isRetryable = isRateLimit ||
                              errorMessage.includes('timeout') ||
                              errorMessage.includes('ECONNRESET') ||
                              errorMessage.includes('network');

          if (isRetryable && retryCount < MAX_RETRIES - 1) {
            retryCount++;
            console.log(`[Claude] Retrying stream with different key (attempt ${retryCount + 1})`);
            // Small delay before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            return false; // Signal to retry
          }

          // No more retries - send error message to client
          const userMessage = isRateLimit
            ? '\n\n*[Response interrupted: High demand. Please try again in a moment.]*'
            : errorMessage.includes('timeout')
              ? '\n\n*[Response interrupted: Connection timed out. Please try again.]*'
              : '\n\n*[Response interrupted: Connection error. Please try again.]*';

          controller.enqueue(encoder.encode(userMessage));
          return true; // Done (with error)
        }
      };

      try {
        // Attempt stream with retries
        let done = false;
        while (!done) {
          done = await attemptStream();
        }
      } finally {
        stopKeepalive();
        controller.close();
      }
    }
  });

  return { stream, model };
}

/**
 * Create a non-streaming completion with auto model selection
 */
export async function createClaudeChat(options: {
  messages: CoreMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  forceModel?: 'haiku' | 'sonnet';
  isResearch?: boolean;
  isFaithTopic?: boolean;
}): Promise<{
  text: string;
  model: string;
}> {
  const lastUserMessage = options.messages
    .filter(m => m.role === 'user')
    .pop();

  const lastContent = lastUserMessage
    ? (typeof lastUserMessage.content === 'string'
        ? lastUserMessage.content
        : JSON.stringify(lastUserMessage.content))
    : '';

  const model = selectClaudeModel(lastContent, {
    forceModel: options.forceModel,
    isResearch: options.isResearch,
    isFaithTopic: options.isFaithTopic,
  });

  console.log(`[Claude] Non-streaming with model: ${model}`);

  const result = await createAnthropicCompletion({
    messages: options.messages,
    model,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    systemPrompt: options.systemPrompt,
  });

  return { text: result.text, model };
}

/**
 * Create structured output (JSON) with Claude
 * Always uses Sonnet for reliability
 *
 * RACE CONDITION FIX: Uses getAnthropicClientWithKey() atomically.
 */
export async function createClaudeStructuredOutput<T>(options: {
  messages: CoreMessage[];
  systemPrompt: string;
  schema: object;
}): Promise<{
  data: T;
  model: string;
}> {
  const { client } = getAnthropicClientWithKey();
  const { system, messages } = convertMessages(options.messages, options.systemPrompt);

  // Add JSON schema instruction to system prompt
  const jsonSystemPrompt = `${system}

IMPORTANT: You must respond with valid JSON only. No markdown, no explanation, just the JSON object.
The response must match this schema:
${JSON.stringify(options.schema, null, 2)}`;

  const response = await client.messages.create({
    model: CLAUDE_SONNET, // Always use Sonnet for structured output
    max_tokens: 4096,
    temperature: 0.3, // Lower temperature for consistent JSON
    system: jsonSystemPrompt,
    messages,
  });

  const textContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Parse JSON, handling potential markdown wrapper
  let jsonText = textContent.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const data = JSON.parse(jsonText) as T;
    return { data, model: CLAUDE_SONNET };
  } catch (error) {
    console.error('[Claude] Failed to parse structured output:', error);
    console.error('[Claude] Raw response:', textContent.substring(0, 500));
    throw new Error('Failed to parse Claude structured output as JSON');
  }
}
