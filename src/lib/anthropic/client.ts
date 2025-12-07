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
// MULTI-KEY SUPPORT
// ========================================

// Store all available API keys
interface ApiKeyState {
  key: string;
  client: Anthropic;
  rateLimitedUntil: number; // Timestamp when rate limit expires (0 = not limited)
}

const apiKeys: ApiKeyState[] = [];
let currentKeyIndex = 0;

/**
 * Initialize all available Anthropic API keys
 */
function initializeApiKeys(): void {
  if (apiKeys.length > 0) return; // Already initialized

  // Primary key (required)
  const primaryKey = process.env.ANTHROPIC_API_KEY;
  if (!primaryKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  apiKeys.push({
    key: primaryKey,
    client: new Anthropic({ apiKey: primaryKey }),
    rateLimitedUntil: 0,
  });

  // Fallback keys (optional) - check for ANTHROPIC_API_KEY_FALLBACK_1, _2, etc.
  for (let i = 1; i <= 5; i++) {
    const fallbackKey = process.env[`ANTHROPIC_API_KEY_FALLBACK_${i}`];
    if (fallbackKey) {
      apiKeys.push({
        key: fallbackKey,
        client: new Anthropic({ apiKey: fallbackKey }),
        rateLimitedUntil: 0,
      });
      console.log(`[Anthropic] Loaded fallback API key ${i}`);
    }
  }

  console.log(`[Anthropic] Initialized with ${apiKeys.length} API key(s)`);
}

/**
 * Get the next available Anthropic client
 * Rotates through keys when rate limited
 */
function getAnthropicClient(): Anthropic {
  initializeApiKeys();

  const now = Date.now();

  // Try to find an available key (not rate limited)
  for (let i = 0; i < apiKeys.length; i++) {
    const keyIndex = (currentKeyIndex + i) % apiKeys.length;
    const keyState = apiKeys[keyIndex];

    if (keyState.rateLimitedUntil <= now) {
      // This key is available
      if (keyIndex !== currentKeyIndex) {
        console.log(`[Anthropic] Switching to API key ${keyIndex + 1}/${apiKeys.length}`);
        currentKeyIndex = keyIndex;
      }
      return keyState.client;
    }
  }

  // All keys are rate limited - use the one that will be available soonest
  let soonestIndex = 0;
  let soonestTime = apiKeys[0].rateLimitedUntil;

  for (let i = 1; i < apiKeys.length; i++) {
    if (apiKeys[i].rateLimitedUntil < soonestTime) {
      soonestTime = apiKeys[i].rateLimitedUntil;
      soonestIndex = i;
    }
  }

  console.log(`[Anthropic] All keys rate limited, using key ${soonestIndex + 1} (available in ${Math.ceil((soonestTime - now) / 1000)}s)`);
  currentKeyIndex = soonestIndex;
  return apiKeys[soonestIndex].client;
}

/**
 * Mark the current API key as rate limited
 * @param retryAfterSeconds - How long until the rate limit expires
 */
function markCurrentKeyRateLimited(retryAfterSeconds: number = 60): void {
  if (apiKeys.length === 0) return;

  const expiresAt = Date.now() + (retryAfterSeconds * 1000);
  apiKeys[currentKeyIndex].rateLimitedUntil = expiresAt;

  console.log(`[Anthropic] API key ${currentKeyIndex + 1}/${apiKeys.length} rate limited for ${retryAfterSeconds}s`);

  // Try to rotate to next available key
  const nextAvailable = apiKeys.findIndex((k, i) => i !== currentKeyIndex && k.rateLimitedUntil <= Date.now());
  if (nextAvailable !== -1) {
    currentKeyIndex = nextAvailable;
    console.log(`[Anthropic] Rotated to API key ${currentKeyIndex + 1}/${apiKeys.length}`);
  }
}

/**
 * Check if an error is a rate limit error and handle it
 */
function handleRateLimitError(error: unknown): boolean {
  if (error instanceof Anthropic.RateLimitError) {
    // Extract retry-after from error if available
    const retryAfter = 60; // Default to 60 seconds
    markCurrentKeyRateLimited(retryAfter);
    return true;
  }

  // Check for rate limit in error message
  if (error instanceof Error && error.message.toLowerCase().includes('rate limit')) {
    markCurrentKeyRateLimited(60);
    return true;
  }

  return false;
}

/**
 * Get stats about API key usage
 */
export function getApiKeyStats(): {
  totalKeys: number;
  availableKeys: number;
  currentKeyIndex: number;
} {
  initializeApiKeys();
  const now = Date.now();
  const availableKeys = apiKeys.filter(k => k.rateLimitedUntil <= now).length;

  return {
    totalKeys: apiKeys.length,
    availableKeys,
    currentKeyIndex: currentKeyIndex + 1, // 1-indexed for display
  };
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
  const maxRetries = Math.max(1, apiKeys.length || 1);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const client = getAnthropicClient();

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
    const maxRetries = Math.max(1, apiKeys.length || 1);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const client = getAnthropicClient();

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
 * Create a chat completion with web search support
 * Uses Brave Search when available
 * Uses prompt caching for the system prompt (90% cost savings on cached tokens)
 * Handles rate limits by rotating to fallback API keys
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

  const model = rest.model || DEFAULT_MODEL;
  const maxTokens = rest.maxTokens || 4096;
  const temperature = rest.temperature ?? 0.7;

  const { system, messages } = convertMessages(rest.messages, rest.systemPrompt);

  // System prompt with web search instruction (cached for cost savings)
  const systemWithSearch = system + '\n\nYou have access to web search. Use it when you need current information.';

  // Helper to make API call with retry logic
  const makeApiCall = async (
    client: Anthropic,
    msgs: typeof messages,
    tools: Anthropic.Tool[]
  ): Promise<Anthropic.Message> => {
    const maxKeyRetries = Math.max(1, apiKeys.length || 1);

    for (let attempt = 0; attempt < maxKeyRetries; attempt++) {
      const currentClient = attempt === 0 ? client : getAnthropicClient();

      try {
        return await currentClient.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: [
            {
              type: 'text',
              text: systemWithSearch,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: msgs,
          tools,
        });
      } catch (error) {
        if (handleRateLimitError(error) && attempt < maxKeyRetries - 1) {
          console.log(`[Anthropic] Web search rate limited on attempt ${attempt + 1}, retrying with different key...`);
          continue;
        }
        throw error;
      }
    }

    throw new Error('All API keys exhausted');
  };

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

    const client = getAnthropicClient();
    const response = await makeApiCall(client, currentMessages, tools);

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
