/**
 * OPENAI-COMPATIBLE ADAPTER
 *
 * Unified adapter for all OpenAI-compatible API providers:
 * - OpenAI (GPT-5 series)
 * - xAI (Grok 4)
 * - DeepSeek (V3.2)
 *
 * These providers all use the same API format, just with different base URLs and API keys.
 */

import OpenAI from 'openai';
import { BaseAIAdapter } from './base';
import type {
  ProviderId,
  ProviderFamily,
  UnifiedMessage,
  UnifiedTool,
  UnifiedToolCall,
  UnifiedToolResult,
  UnifiedStreamChunk,
  UnifiedContentBlock,
  ChatOptions,
} from '../types';

// ============================================================================
// TYPES
// ============================================================================

type OpenAIMessage = OpenAI.ChatCompletionMessageParam;
type OpenAITool = OpenAI.ChatCompletionTool;
type OpenAIStreamChunk = OpenAI.ChatCompletionChunk;

// ============================================================================
// PROVIDER-SPECIFIC CONFIGURATION
// ============================================================================

interface ProviderEndpoint {
  baseURL?: string;
  apiKeyEnv: string;
}

const PROVIDER_ENDPOINTS: Record<string, ProviderEndpoint> = {
  openai: {
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  xai: {
    baseURL: 'https://api.x.ai/v1',
    apiKeyEnv: 'XAI_API_KEY',
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
  },
};

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

interface ApiKeyState {
  key: string;
  rateLimitedUntil: number;
  client: OpenAI | null;
}

const apiKeyPools: Record<string, ApiKeyState[]> = {};
const initialized: Record<string, boolean> = {};

function initializeApiKeys(providerId: ProviderId): void {
  // Always re-check if pool is empty (handles case where env var wasn't available earlier)
  const existingPool = apiKeyPools[providerId];
  if (initialized[providerId] && existingPool && existingPool.length > 0) {
    return; // Already initialized with keys
  }

  const endpoint = PROVIDER_ENDPOINTS[providerId];
  if (!endpoint) {
    initialized[providerId] = true;
    return;
  }

  apiKeyPools[providerId] = [];

  // Check for numbered keys first
  let i = 1;
  while (true) {
    const key = process.env[`${endpoint.apiKeyEnv}_${i}`];
    if (!key) break;
    apiKeyPools[providerId].push({ key, rateLimitedUntil: 0, client: null });
    i++;
  }

  // Fall back to single key
  if (apiKeyPools[providerId].length === 0) {
    const singleKey = process.env[endpoint.apiKeyEnv];
    if (singleKey) {
      apiKeyPools[providerId].push({ key: singleKey, rateLimitedUntil: 0, client: null });
    }
  }

  // Only mark as initialized if we found at least one key
  // This allows retry if keys weren't available on first attempt
  if (apiKeyPools[providerId].length > 0) {
    initialized[providerId] = true;
  }
}

function getAvailableKeyState(providerId: ProviderId): ApiKeyState | null {
  initializeApiKeys(providerId);
  const pool = apiKeyPools[providerId] || [];
  if (pool.length === 0) return null;

  const now = Date.now();
  const available = pool.filter((k) => k.rateLimitedUntil <= now);

  if (available.length === 0) {
    // All rate limited, return the one that will be available soonest
    return pool.reduce((a, b) => (a.rateLimitedUntil < b.rateLimitedUntil ? a : b));
  }

  // Random selection for load distribution
  return available[Math.floor(Math.random() * available.length)];
}

function getOpenAIClient(providerId: ProviderId): OpenAI {
  const keyState = getAvailableKeyState(providerId);
  if (!keyState) {
    const endpoint = PROVIDER_ENDPOINTS[providerId];
    throw new Error(`${endpoint?.apiKeyEnv || 'API_KEY'} is not configured`);
  }

  if (!keyState.client) {
    const endpoint = PROVIDER_ENDPOINTS[providerId];
    keyState.client = new OpenAI({
      apiKey: keyState.key,
      baseURL: endpoint?.baseURL,
    });
  }

  return keyState.client;
}

function markKeyRateLimited(
  providerId: ProviderId,
  client: OpenAI,
  retryAfterSeconds: number = 60
): void {
  const pool = apiKeyPools[providerId] || [];
  const keyState = pool.find((k) => k.client === client);
  if (keyState) {
    keyState.rateLimitedUntil = Date.now() + retryAfterSeconds * 1000;
  }
}

// ============================================================================
// OPENAI-COMPATIBLE ADAPTER
// ============================================================================

/**
 * Adapter for OpenAI-compatible API providers
 */
export class OpenAICompatibleAdapter extends BaseAIAdapter {
  readonly providerId: ProviderId;
  readonly family: ProviderFamily = 'openai-compatible';

  private client: OpenAI;

  constructor(providerId: ProviderId) {
    super();
    this.providerId = providerId;
    this.client = getOpenAIClient(providerId);
  }

  // ============================================================================
  // MAIN CHAT METHOD
  // ============================================================================

  async *chat(
    messages: UnifiedMessage[],
    options: ChatOptions = {}
  ): AsyncIterable<UnifiedStreamChunk> {
    const model = options.model || this.getDefaultModelId();
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.7;

    // Convert messages to OpenAI format
    const openaiMessages = this.convertToOpenAIFormat(messages, options.systemPrompt);

    // Convert tools if provided
    const tools = options.tools ? this.formatTools(options.tools) : undefined;

    try {
      // Newer OpenAI models (GPT-5.x) require max_completion_tokens instead of max_tokens
      // Other providers (xAI, DeepSeek) still use max_tokens
      const isOpenAINewModel = this.providerId === 'openai' && model.startsWith('gpt-5');

      const requestParams: OpenAI.ChatCompletionCreateParamsStreaming = {
        model,
        messages: openaiMessages,
        temperature,
        tools,
        stream: true,
      };

      // Use the appropriate token parameter based on model
      if (isOpenAINewModel) {
        requestParams.max_completion_tokens = maxTokens;
      } else {
        requestParams.max_tokens = maxTokens;
      }

      const stream = await this.client.chat.completions.create(requestParams);

      // Track current tool call being built
      const currentToolCalls: Map<number, Partial<UnifiedToolCall>> = new Map();

      for await (const chunk of stream) {
        const unifiedChunk = this.parseStreamChunk(chunk, currentToolCalls);

        if (unifiedChunk) {
          yield unifiedChunk;
        }
      }

      // Emit done chunk
      yield { type: 'message_end' };
    } catch (error) {
      // Handle rate limiting
      if (this.isRateLimitError(error)) {
        markKeyRateLimited(this.providerId, this.client, this.extractRetryAfter(error));
        // Try to get a new client
        this.client = getOpenAIClient(this.providerId);
      }

      yield {
        type: 'error',
        error: {
          code: this.mapErrorCode(error),
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================================
  // MESSAGE CONVERSION
  // ============================================================================

  /**
   * Convert unified messages to OpenAI format
   */
  private convertToOpenAIFormat(
    messages: UnifiedMessage[],
    systemPrompt?: string
  ): OpenAIMessage[] {
    const openaiMessages: OpenAIMessage[] = [];

    // Add system prompt if provided
    if (systemPrompt) {
      openaiMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      const openaiMsg = this.convertMessage(msg);
      if (openaiMsg) {
        openaiMessages.push(openaiMsg);
      }
    }

    return openaiMessages;
  }

  /**
   * Convert a single unified message to OpenAI format
   */
  private convertMessage(msg: UnifiedMessage): OpenAIMessage | null {
    // Handle system messages
    if (msg.role === 'system') {
      if (typeof msg.content === 'string') {
        return { role: 'system', content: msg.content };
      }
      return null;
    }

    // Handle tool role (tool results)
    if (msg.role === 'tool') {
      if (typeof msg.content === 'string') {
        return null; // Invalid format
      }

      const toolResults = msg.content.filter((b) => b.type === 'tool_result');
      if (toolResults.length === 0) return null;

      // OpenAI expects individual tool messages for each result
      // Return the first one; caller should handle multiple results
      const firstResult = toolResults[0] as { toolUseId: string; content: string };
      return {
        role: 'tool',
        tool_call_id: firstResult.toolUseId,
        content: firstResult.content,
      };
    }

    // Handle string content
    if (typeof msg.content === 'string') {
      if (!msg.content.trim()) return null;
      return {
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      };
    }

    // Handle content blocks for user messages
    if (msg.role === 'user') {
      const contentParts: OpenAI.ChatCompletionContentPart[] = [];

      for (const block of msg.content) {
        switch (block.type) {
          case 'text':
            contentParts.push({ type: 'text', text: block.text });
            break;

          case 'image':
            if (block.source.type === 'base64' && block.source.data) {
              contentParts.push({
                type: 'image_url',
                image_url: {
                  url: `data:${block.source.mediaType || 'image/png'};base64,${block.source.data}`,
                },
              });
            } else if (block.source.type === 'url' && block.source.url) {
              contentParts.push({
                type: 'image_url',
                image_url: { url: block.source.url },
              });
            }
            break;
        }
      }

      if (contentParts.length === 0) return null;
      return { role: 'user', content: contentParts };
    }

    // Handle assistant messages with tool calls
    if (msg.role === 'assistant') {
      const textBlocks = msg.content.filter((b) => b.type === 'text');
      const toolUseBlocks = msg.content.filter((b) => b.type === 'tool_use');

      const textContent = textBlocks.map((b) => (b as { text: string }).text).join('');
      const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = toolUseBlocks.map((block) => {
        const toolBlock = block as { id: string; name: string; arguments: Record<string, unknown> };
        return {
          id: toolBlock.id,
          type: 'function' as const,
          function: {
            name: toolBlock.name,
            arguments: JSON.stringify(toolBlock.arguments),
          },
        };
      });

      if (textContent || toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: textContent || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        };
      }
    }

    return null;
  }

  /**
   * Convert unified messages to OpenAI format (public interface)
   */
  toProviderMessages(messages: UnifiedMessage[]): OpenAIMessage[] {
    return messages
      .flatMap((msg) => {
        // Handle tool messages that may have multiple results
        if (msg.role === 'tool' && typeof msg.content !== 'string') {
          const toolResults = msg.content.filter((b) => b.type === 'tool_result');
          return toolResults.map((result) => {
            const tr = result as { toolUseId: string; content: string };
            return {
              role: 'tool' as const,
              tool_call_id: tr.toolUseId,
              content: tr.content,
            };
          });
        }

        const converted = this.convertMessage(msg);
        return converted ? [converted] : [];
      })
      .filter((msg): msg is OpenAIMessage => msg !== null);
  }

  /**
   * Convert OpenAI messages to unified format
   */
  fromProviderMessages(messages: unknown[]): UnifiedMessage[] {
    return (messages as OpenAIMessage[]).map((msg) => this.convertFromOpenAI(msg));
  }

  /**
   * Convert a single OpenAI message to unified format
   */
  private convertFromOpenAI(msg: OpenAIMessage): UnifiedMessage {
    // Handle different message roles
    if (msg.role === 'system') {
      return {
        role: 'system',
        content: typeof msg.content === 'string' ? msg.content : '',
      };
    }

    if (msg.role === 'tool') {
      return {
        role: 'tool',
        content: [
          {
            type: 'tool_result',
            toolUseId: (msg as { tool_call_id: string }).tool_call_id,
            content: typeof msg.content === 'string' ? msg.content : '',
          },
        ],
      };
    }

    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        return { role: 'user', content: msg.content };
      }

      // Handle content parts
      const unifiedContent: UnifiedContentBlock[] = [];
      for (const part of msg.content || []) {
        if (part.type === 'text') {
          unifiedContent.push({ type: 'text', text: part.text });
        } else if (part.type === 'image_url') {
          const url = part.image_url.url;
          if (url.startsWith('data:')) {
            const match = url.match(/data:([^;]+);base64,(.+)/);
            if (match) {
              unifiedContent.push({
                type: 'image',
                source: {
                  type: 'base64',
                  mediaType: match[1],
                  data: match[2],
                },
              });
            }
          } else {
            unifiedContent.push({
              type: 'image',
              source: { type: 'url', url },
            });
          }
        }
      }
      return { role: 'user', content: unifiedContent };
    }

    // Handle assistant messages
    const assistantMsg = msg as OpenAI.ChatCompletionAssistantMessageParam;
    const unifiedContent: UnifiedContentBlock[] = [];

    // Add text content
    if (assistantMsg.content) {
      if (typeof assistantMsg.content === 'string') {
        unifiedContent.push({ type: 'text', text: assistantMsg.content });
      } else {
        for (const part of assistantMsg.content) {
          if (part.type === 'text') {
            unifiedContent.push({ type: 'text', text: part.text });
          }
        }
      }
    }

    // Add tool calls
    if (assistantMsg.tool_calls) {
      for (const toolCall of assistantMsg.tool_calls) {
        // Only handle function-type tool calls
        if (toolCall.type === 'function') {
          unifiedContent.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: this.safeParseJSON(toolCall.function.arguments),
          });
        }
      }
    }

    return {
      role: 'assistant',
      content: unifiedContent.length > 0 ? unifiedContent : '',
    };
  }

  // ============================================================================
  // TOOL CONVERSION
  // ============================================================================

  /**
   * Convert unified tools to OpenAI format
   */
  formatTools(tools: UnifiedTool[]): OpenAITool[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object' as const,
          properties: tool.parameters.properties,
          required: tool.parameters.required,
        },
      },
    }));
  }

  /**
   * Format a tool result for OpenAI
   */
  formatToolResult(result: UnifiedToolResult): OpenAI.ChatCompletionToolMessageParam {
    return {
      role: 'tool',
      tool_call_id: result.toolCallId,
      content: result.content,
    };
  }

  // ============================================================================
  // STREAM PARSING
  // ============================================================================

  /**
   * Parse an OpenAI stream chunk into a unified chunk
   */
  private parseStreamChunk(
    chunk: OpenAIStreamChunk,
    currentToolCalls: Map<number, Partial<UnifiedToolCall>>
  ): UnifiedStreamChunk | null {
    const delta = chunk.choices[0]?.delta;
    if (!delta) return null;

    // Handle text content
    if (delta.content) {
      return { type: 'text', text: delta.content };
    }

    // Handle tool calls
    if (delta.tool_calls) {
      for (const toolCallDelta of delta.tool_calls) {
        const index = toolCallDelta.index;

        if (toolCallDelta.id) {
          // New tool call starting
          currentToolCalls.set(index, {
            id: toolCallDelta.id,
            name: toolCallDelta.function?.name || '',
            arguments: {},
          });

          return {
            type: 'tool_call_start',
            toolCall: {
              id: toolCallDelta.id,
              name: toolCallDelta.function?.name || '',
              arguments: {},
            },
          };
        }

        if (toolCallDelta.function?.arguments) {
          // Tool call arguments delta
          const current = currentToolCalls.get(index);
          if (current) {
            return {
              type: 'tool_call_delta',
              toolCall: {
                arguments: this.safeParseJSON(toolCallDelta.function.arguments),
              },
            };
          }
        }
      }
    }

    // Handle finish reason
    if (chunk.choices[0]?.finish_reason === 'tool_calls') {
      // Clear tool calls and signal end
      currentToolCalls.clear();
      return { type: 'tool_call_end' };
    }

    // Handle usage
    if (chunk.usage) {
      return {
        type: 'message_end',
        usage: {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
        },
      };
    }

    return null;
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  /**
   * Check if an error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof OpenAI.APIError) {
      return error.status === 429;
    }
    if (error instanceof Error) {
      return (
        error.message.includes('rate_limit') ||
        error.message.includes('429') ||
        error.message.toLowerCase().includes('too many requests')
      );
    }
    return false;
  }

  /**
   * Extract retry-after seconds from an error
   */
  private extractRetryAfter(error: unknown): number {
    if (error instanceof Error) {
      const match = error.message.match(/retry.?after[:\s]*(\d+)/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 60; // Default to 60 seconds
  }

  /**
   * Map an error to a unified error code
   */
  private mapErrorCode(error: unknown): string {
    if (error instanceof OpenAI.APIError) {
      switch (error.status) {
        case 401:
          return 'auth_failed';
        case 429:
          return 'rate_limited';
        case 400:
          if (error.message.includes('context')) {
            return 'context_too_long';
          }
          return 'invalid_request';
        case 500:
        case 502:
        case 503:
          return 'server_error';
        default:
          return 'unknown';
      }
    }
    return 'unknown';
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Safely parse JSON, returning empty object on failure
   */
  private safeParseJSON(json: string): Record<string, unknown> {
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an OpenAI adapter instance
 */
export function createOpenAIAdapter(): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter('openai');
}

/**
 * Create an xAI (Grok) adapter instance
 */
export function createXAIAdapter(): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter('xai');
}

/**
 * Create a DeepSeek adapter instance
 */
export function createDeepSeekAdapter(): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter('deepseek');
}
