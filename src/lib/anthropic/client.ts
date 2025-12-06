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
 */

import Anthropic from '@anthropic-ai/sdk';
import { CoreMessage } from 'ai';

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
 * Uses Brave Search when available
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

  const client = getAnthropicClient();
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
