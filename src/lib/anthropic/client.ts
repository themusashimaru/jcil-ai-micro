/**
 * ANTHROPIC CLIENT
 *
 * PURPOSE:
 * - Provide Claude AI chat completion functionality
 * - Support streaming responses
 * - Handle tool calls (web search via Brave)
 *
 * FEATURES:
 * - Streaming text responses
 * - Non-streaming for image analysis
 * - Web search integration via Brave
 * - Multiple API key support with automatic failover
 * - Prompt caching for cost savings
 */

import Anthropic from '@anthropic-ai/sdk';
import { CoreMessage } from 'ai';

// Default model: Claude Sonnet 4.5
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

// ========================================
// DUAL-POOL API KEY SYSTEM (DYNAMIC)
// ========================================
// Primary Pool: Round-robin load distribution (ANTHROPIC_API_KEY_1, _2, _3, ... unlimited)
// Fallback Pool: Emergency reserve (ANTHROPIC_API_KEY_FALLBACK_1, _2, _3, ... unlimited)
// Backward Compatible: Single ANTHROPIC_API_KEY still works
// NO HARDCODED LIMITS - just add keys in Vercel and they're automatically detected!

interface ApiKeyState {
  key: string;
  client: Anthropic;
  rateLimitedUntil: number; // Timestamp when rate limit expires (0 = not limited)
  pool: 'primary' | 'fallback';
  index: number; // Position within its pool
}

// Separate pools for better management
const primaryPool: ApiKeyState[] = [];
const fallbackPool: ApiKeyState[] = [];
let primaryKeyIndex = 0; // Round-robin index for primary pool
let fallbackKeyIndex = 0; // Round-robin index for fallback pool
let initialized = false;

/**
 * Initialize all available Anthropic API keys into their pools
 * FULLY DYNAMIC: Automatically detects ALL configured keys - no limits!
 * Just add ANTHROPIC_API_KEY_N in Vercel and it's automatically picked up
 */
function initializeApiKeys(): void {
  if (initialized) return;
  initialized = true;

  // Dynamically detect ALL numbered primary keys (no limit!)
  // Keeps looking for ANTHROPIC_API_KEY_1, _2, _3, etc. until one is missing
  let i = 1;
  while (true) {
    const key = process.env[`ANTHROPIC_API_KEY_${i}`];
    if (!key) break; // Stop when we hit a gap

    primaryPool.push({
      key,
      client: new Anthropic({ apiKey: key }),
      rateLimitedUntil: 0,
      pool: 'primary',
      index: i,
    });
    i++;
  }

  // If no numbered keys found, fall back to single ANTHROPIC_API_KEY
  if (primaryPool.length === 0) {
    const singleKey = process.env.ANTHROPIC_API_KEY;
    if (!singleKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured. Set either ANTHROPIC_API_KEY or ANTHROPIC_API_KEY_1, _2, _3, etc.');
    }
    primaryPool.push({
      key: singleKey,
      client: new Anthropic({ apiKey: singleKey }),
      rateLimitedUntil: 0,
      pool: 'primary',
      index: 0,
    });
  }

  // Dynamically detect ALL fallback keys (no limit!)
  let j = 1;
  while (true) {
    const key = process.env[`ANTHROPIC_API_KEY_FALLBACK_${j}`];
    if (!key) break; // Stop when we hit a gap

    fallbackPool.push({
      key,
      client: new Anthropic({ apiKey: key }),
      rateLimitedUntil: 0,
      pool: 'fallback',
      index: j,
    });
    j++;
  }

  // Log the detected configuration
  const totalKeys = primaryPool.length + fallbackPool.length;
  const estimatedRPM = totalKeys * 60;
  console.log(`[Anthropic] Initialized dual-pool system (dynamic detection):`);
  console.log(`[Anthropic]   Primary pool: ${primaryPool.length} key(s) (round-robin load distribution)`);
  console.log(`[Anthropic]   Fallback pool: ${fallbackPool.length} key(s) (emergency reserve)`);
  console.log(`[Anthropic]   Estimated capacity: ~${estimatedRPM} RPM (${totalKeys} keys × 60 RPM)`);
}

/**
 * Get an available key from the primary pool (round-robin)
 * Returns null if all primary keys are rate limited
 */
function getPrimaryClient(): Anthropic | null {
  const now = Date.now();

  // Round-robin through primary pool
  for (let i = 0; i < primaryPool.length; i++) {
    const keyIndex = (primaryKeyIndex + i) % primaryPool.length;
    const keyState = primaryPool[keyIndex];

    if (keyState.rateLimitedUntil <= now) {
      // Advance round-robin for next request (load distribution)
      primaryKeyIndex = (keyIndex + 1) % primaryPool.length;
      return keyState.client;
    }
  }

  return null; // All primary keys are rate limited
}

/**
 * Get an available key from the fallback pool
 * Returns null if all fallback keys are rate limited
 */
function getFallbackClient(): Anthropic | null {
  if (fallbackPool.length === 0) return null;

  const now = Date.now();

  for (let i = 0; i < fallbackPool.length; i++) {
    const keyIndex = (fallbackKeyIndex + i) % fallbackPool.length;
    const keyState = fallbackPool[keyIndex];

    if (keyState.rateLimitedUntil <= now) {
      fallbackKeyIndex = (keyIndex + 1) % fallbackPool.length;
      console.log(`[Anthropic] Using FALLBACK key ${keyState.index} (primary pool exhausted)`);
      return keyState.client;
    }
  }

  return null; // All fallback keys are also rate limited
}

/**
 * Get the next available Anthropic client
 * Priority: Primary pool (round-robin) → Fallback pool → Wait for soonest available
 */
function getAnthropicClient(): Anthropic {
  initializeApiKeys();

  // Try primary pool first (round-robin for load distribution)
  const primaryClient = getPrimaryClient();
  if (primaryClient) {
    return primaryClient;
  }

  // Primary pool exhausted - try fallback pool
  const fallbackClient = getFallbackClient();
  if (fallbackClient) {
    return fallbackClient;
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

  return soonestKey.client;
}

/**
 * Mark a specific API key as rate limited
 */
function markKeyRateLimited(client: Anthropic, retryAfterSeconds: number = 60): void {
  const allKeys = [...primaryPool, ...fallbackPool];
  const keyState = allKeys.find(k => k.client === client);

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

// Track current client for rate limit marking
let lastUsedClient: Anthropic | null = null;

/**
 * Check if an error is a rate limit error and handle it
 */
function handleRateLimitError(error: unknown): boolean {
  if (error instanceof Anthropic.RateLimitError) {
    if (lastUsedClient) {
      markKeyRateLimited(lastUsedClient, 60);
    }
    return true;
  }

  if (error instanceof Error && error.message.toLowerCase().includes('rate limit')) {
    if (lastUsedClient) {
      markKeyRateLimited(lastUsedClient, 60);
    }
    return true;
  }

  return false;
}

/**
 * Get stats about API key usage
 */
export function getApiKeyStats(): {
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
 * Get total number of API keys (for retry logic)
 */
function getTotalKeyCount(): number {
  initializeApiKeys();
  return primaryPool.length + fallbackPool.length;
}

export interface AnthropicChatOptions {
  messages: CoreMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
  // Web search function (injected from Brave Search module)
  webSearchFn?: (query: string) => Promise<BraveSearchResult>;
  // For token tracking
  userId?: string;
  planKey?: string;
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

  for (const msg of messages) {
    // Skip system messages - they go in the system parameter
    if (msg.role === 'system') continue;

    if (msg.role === 'user' || msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
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
        }
      }
    }
  }

  return { system, messages: anthropicMessages };
}

/**
 * Create a chat completion using Claude
 * Uses prompt caching for the system prompt (90% cost savings on cached tokens)
 * Automatically retries with fallback API keys on rate limit errors
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

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const client = getAnthropicClient();
    lastUsedClient = client; // Track for rate limit marking

    try {
      // Non-streaming mode with prompt caching on system prompt
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        // Use array format with cache_control for prompt caching
        system: [
          {
            type: 'text',
            text: system,
            cache_control: { type: 'ephemeral' },
          },
        ],
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
      // Check if this is a rate limit error
      if (handleRateLimitError(error) && attempt < maxRetries - 1) {
        console.log(`[Anthropic] Rate limited on attempt ${attempt + 1}, retrying with different key...`);
        continue; // Try again with next available key
      }

      console.error('[Anthropic] Chat completion error:', error);
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new Error('All API keys exhausted');
}

/**
 * Create a streaming chat completion using Claude
 * Uses prompt caching for the system prompt (90% cost savings on cached tokens)
 * Handles rate limits by rotating to fallback API keys
 */
export async function createAnthropicStreamingCompletion(options: AnthropicChatOptions): Promise<{
  toTextStreamResponse: (opts?: { headers?: Record<string, string> }) => Response;
  model: string;
}> {
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 4096;
  const temperature = options.temperature ?? 0.7;

  const { system, messages } = convertMessages(options.messages, options.systemPrompt);

  // Create a TransformStream to convert Anthropic stream to text stream
  const { readable, writable } = new TransformStream<string, string>();
  const writer = writable.getWriter();

  // Start streaming in the background with prompt caching on system prompt
  (async () => {
    const maxRetries = Math.max(1, getTotalKeyCount());

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const client = getAnthropicClient();
      lastUsedClient = client; // Track for rate limit marking

      try {
        const stream = await client.messages.stream({
          model,
          max_tokens: maxTokens,
          temperature,
          // Use array format with cache_control for prompt caching
          system: [
            {
              type: 'text',
              text: system,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
        });

        for await (const event of stream) {
          if (event.type === 'content_block_delta') {
            const delta = event.delta;
            if ('text' in delta) {
              await writer.write(delta.text);
            }
          }
        }

        // Success - exit the retry loop
        return;
      } catch (error) {
        // Check if this is a rate limit error and we can retry
        if (handleRateLimitError(error) && attempt < maxRetries - 1) {
          console.log(`[Anthropic] Streaming rate limited on attempt ${attempt + 1}, retrying with different key...`);
          continue; // Try again with next available key
        }

        console.error('[Anthropic] Streaming error:', error);
        await writer.write('\n\n[Error: Stream interrupted. Please try again.]');
        return;
      }
    }
  })().finally(() => {
    writer.close();
  });

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
 * Create a chat completion with PERPLEXITY web search + Claude formatting
 *
 * PERPLEXITY-ONLY SEARCH:
 * 1. Perplexity handles ALL web searches (accurate real-time data)
 * 2. Claude formats and presents the results (conversational style)
 * 3. NO Anthropic native search fallback (it was inaccurate)
 *
 * Perplexity uses the same dual-pool round-robin system as Anthropic:
 * - PERPLEXITY_API_KEY_1, _2, _3, ... (primary pool)
 * - PERPLEXITY_API_KEY_FALLBACK_1, _2, ... (fallback pool)
 * - Or single PERPLEXITY_API_KEY for backward compatibility
 */
export async function createAnthropicCompletionWithSearch(
  options: AnthropicChatOptions
): Promise<{
  text: string;
  model: string;
  citations: Array<{ title: string; url: string }>;
  numSourcesUsed: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { webSearchFn, ...rest } = options;

  const model = rest.model || DEFAULT_MODEL;
  const maxTokens = rest.maxTokens || 4096;

  const { system, messages } = convertMessages(rest.messages, rest.systemPrompt);

  // Get the user's query from the last message
  const lastMessage = messages[messages.length - 1];
  const userQuery = typeof lastMessage.content === 'string'
    ? lastMessage.content
    : Array.isArray(lastMessage.content)
      ? lastMessage.content.map(c => 'text' in c ? c.text : '').join(' ')
      : '';

  // Import Perplexity client
  const { perplexitySearch, isPerplexityConfigured } = await import('@/lib/perplexity/client');

  // Check if Perplexity is configured
  if (!isPerplexityConfigured()) {
    console.error('[Search] Perplexity not configured - web search unavailable');
    // Return a helpful message instead of failing silently
    return {
      text: "I apologize, but web search is currently unavailable. Please configure a Perplexity API key (PERPLEXITY_API_KEY or PERPLEXITY_API_KEY_1, _2, etc.) to enable real-time search capabilities.",
      model,
      citations: [],
      numSourcesUsed: 0,
    };
  }

  // Use Perplexity for the search (with its own round-robin + fallback system)
  console.log('[Perplexity] Executing web search...');
  const perplexityResult = await perplexitySearch({ query: userQuery });
  console.log(`[Perplexity] Search complete. ${perplexityResult.sources.length} sources found.`);

  const citations = perplexityResult.sources.map(s => ({
    title: s.title,
    url: s.url,
  }));

  // Create a prompt for Claude to format the Perplexity results
  // Build clickable markdown links for sources
  const sourceLinks = perplexityResult.sources
    .filter(s => s.url && s.url.startsWith('http'))
    .map(s => `- [${s.title || new URL(s.url).hostname}](${s.url})`)
    .join('\n');

  const formattingPrompt = `Format these search results for the user.

SEARCH RESULTS:
${perplexityResult.answer}

USER'S QUESTION: ${userQuery}

FORMATTING RULES:
1. Present the information conversationally but concisely
2. Keep ALL data EXACTLY as provided: times, dates, temperatures, timestamps
3. NO em dashes (—). Use commas, periods, or hyphens only
4. NO numbered references like [1] or [2]
5. At the end, add "**Sources:**" followed by the clickable links below

SOURCES TO INCLUDE AT END:
${sourceLinks}

Do not modify the source links. Copy them exactly as shown above.`;

  const formattedMessages = [
    ...messages.slice(0, -1), // Previous conversation context
    { role: 'user' as const, content: formattingPrompt },
  ];

  const maxRetries = Math.max(1, getTotalKeyCount());

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const client = getAnthropicClient();
    lastUsedClient = client;

    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: 0.3, // Lower temperature for more accurate formatting
        system: [
          {
            type: 'text',
            text: system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: formattedMessages,
      });

      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      console.log('[Perplexity+Claude] Successfully formatted search results');

      return {
        text: textContent,
        model,
        citations,
        numSourcesUsed: citations.length,
      };
    } catch (error) {
      if (handleRateLimitError(error) && attempt < maxRetries - 1) {
        console.log(`[Claude] Rate limited on attempt ${attempt + 1}, retrying...`);
        continue;
      }
      throw error;
    }
  }

  // This should never be reached due to the retry logic above
  throw new Error('All Anthropic API keys exhausted while formatting search results');
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
