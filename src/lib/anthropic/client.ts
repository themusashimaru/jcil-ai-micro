/**
 * ANTHROPIC CLIENT
 *
 * PURPOSE:
 * - Provide Claude AI chat completion functionality
 * - Support streaming responses
 * - Handle web search using Anthropic's native tool
 *
 * FEATURES:
 * - Streaming text responses
 * - Non-streaming for image analysis
 * - Native web search integration (web_search_20250305)
 * - Token usage tracking
 */

import Anthropic from '@anthropic-ai/sdk';
import { CoreMessage } from 'ai';
import { trackTokenUsage } from '@/lib/openai/usage';

// Default model: Claude Sonnet 4.5
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

// Initialize Anthropic client
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

export interface AnthropicChatOptions {
  messages: CoreMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
  // Web search function (DEPRECATED - now using Anthropic native search)
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
 */
export async function createAnthropicCompletion(options: AnthropicChatOptions): Promise<{
  text: string;
  model: string;
  citations?: Array<{ title: string; url: string }>;
  numSourcesUsed?: number;
}> {
  const client = getAnthropicClient();
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 4096;
  const temperature = options.temperature ?? 0.7;

  const { system, messages } = convertMessages(options.messages, options.systemPrompt);

  try {
    // Non-streaming mode
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages,
    });

    // Track token usage
    if (options.userId && response.usage) {
      trackTokenUsage({
        userId: options.userId,
        model,
        route: 'chat',
        tool: 'generateText',
        inputTokens: response.usage.input_tokens || 0,
        outputTokens: response.usage.output_tokens || 0,
        planKey: options.planKey || 'free',
      });
    }

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
    console.error('[Anthropic] Chat completion error:', error);
    throw error;
  }
}

/**
 * Create a streaming chat completion using Claude
 */
export async function createAnthropicStreamingCompletion(options: AnthropicChatOptions): Promise<{
  toTextStreamResponse: (opts?: { headers?: Record<string, string> }) => Response;
  model: string;
}> {
  const client = getAnthropicClient();
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 4096;
  const temperature = options.temperature ?? 0.7;

  const { system, messages } = convertMessages(options.messages, options.systemPrompt);

  // Create a TransformStream to convert Anthropic stream to text stream
  const { readable, writable } = new TransformStream<string, string>();
  const writer = writable.getWriter();

  // Start streaming in the background
  (async () => {
    try {
      const stream = await client.messages.stream({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
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

      // Track token usage after stream completes
      const finalMessage = await stream.finalMessage();
      if (options.userId && finalMessage.usage) {
        trackTokenUsage({
          userId: options.userId,
          model,
          route: 'chat',
          tool: 'streamText',
          inputTokens: finalMessage.usage.input_tokens || 0,
          outputTokens: finalMessage.usage.output_tokens || 0,
          planKey: options.planKey || 'free',
        });
      }
    } catch (error) {
      console.error('[Anthropic] Streaming error:', error);
      await writer.write('\n\n[Error: Stream interrupted]');
    } finally {
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
 * Uses Anthropic's native web_search_20250305 tool (server-side execution)
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
  const { webSearchFn, ...rest } = options; // webSearchFn is deprecated, using native search

  const client = getAnthropicClient();
  const model = rest.model || DEFAULT_MODEL;
  const maxTokens = rest.maxTokens || 4096;
  const temperature = rest.temperature ?? 0.7;

  const { system, messages } = convertMessages(rest.messages, rest.systemPrompt);

  try {
    console.log('[Anthropic] Using native web search tool (web_search_20250305)');

    // Use Anthropic's native web search tool - it's a server-side tool
    // that Anthropic executes automatically
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: system + '\n\nIMPORTANT: You have access to web search. Use it for ANY question about current events, news, weather, sports, prices, or anything that might have changed recently. Do NOT rely on your training data for current information - ALWAYS search first.',
      messages,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          // Optional: limit searches per request (default is reasonable)
          // max_uses: 3,
        } as unknown as Anthropic.Tool,
      ],
    });

    // Track token usage
    if (rest.userId && response.usage) {
      trackTokenUsage({
        userId: rest.userId,
        model,
        route: 'search',
        tool: 'web_search',
        inputTokens: response.usage.input_tokens || 0,
        outputTokens: response.usage.output_tokens || 0,
        planKey: rest.planKey || 'free',
      });
    }

    // Extract text content and citations from response
    let textContent = '';
    const citations: Array<{ title: string; url: string }> = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;

        // Check for citations in the text block (Anthropic includes them as annotations)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blockAny = block as any;
        if (blockAny.citations) {
          for (const citation of blockAny.citations) {
            citations.push({
              title: citation.title || citation.url,
              url: citation.url,
            });
          }
        }
      } else if (block.type === 'web_search_tool_result') {
        // Handle web search results block if present
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const searchBlock = block as any;
        if (searchBlock.content) {
          for (const result of searchBlock.content) {
            if (result.type === 'web_search_result') {
              citations.push({
                title: result.title || result.url,
                url: result.url,
              });
            }
          }
        }
      }
    }

    console.log('[Anthropic] Web search complete, citations found:', citations.length);

    return {
      text: textContent,
      model,
      citations,
      numSourcesUsed: citations.length,
    };
  } catch (error) {
    console.error('[Anthropic] Web search error:', error);

    // Fall back to regular completion without search
    console.log('[Anthropic] Falling back to regular completion');
    const result = await createAnthropicCompletion(rest);
    return { ...result, citations: [], numSourcesUsed: 0 };
  }
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
