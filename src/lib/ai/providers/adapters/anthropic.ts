/**
 * ANTHROPIC (CLAUDE) ADAPTER
 *
 * Wraps the existing Anthropic client to implement the unified AIAdapter interface.
 * This adapter allows Claude to be used interchangeably with other providers.
 */

import { NATIVE_WEB_SEARCH_SENTINEL } from '@/lib/ai/tools/web-search';
import Anthropic from '@anthropic-ai/sdk';
import { BaseAIAdapter } from './base';
import type {
  ProviderId,
  ProviderFamily,
  UnifiedMessage,
  UnifiedTool,
  UnifiedToolResult,
  UnifiedStreamChunk,
  UnifiedContentBlock,
  ChatOptions,
} from '../types';

// ============================================================================
// TYPES
// ============================================================================

type AnthropicMessage = Anthropic.MessageParam;

// ============================================================================
// API KEY MANAGEMENT (mirrors existing client.ts pattern)
// ============================================================================

interface ApiKeyState {
  key: string;
  rateLimitedUntil: number;
  client: Anthropic | null;
}

const apiKeys: ApiKeyState[] = [];
let initialized = false;

function initializeApiKeys(): void {
  if (initialized) return;
  initialized = true;

  // Check for numbered keys first
  let i = 1;
  while (true) {
    const key = process.env[`ANTHROPIC_API_KEY_${i}`];
    if (!key) break;
    apiKeys.push({ key, rateLimitedUntil: 0, client: null });
    i++;
  }

  // Fall back to single key
  if (apiKeys.length === 0) {
    const singleKey = process.env.ANTHROPIC_API_KEY;
    if (singleKey) {
      apiKeys.push({ key: singleKey, rateLimitedUntil: 0, client: null });
    }
  }
}

function getAvailableKeyState(): ApiKeyState | null {
  initializeApiKeys();
  if (apiKeys.length === 0) return null;

  const now = Date.now();
  const available = apiKeys.filter((k) => k.rateLimitedUntil <= now);

  if (available.length === 0) {
    // All rate limited, return the one that will be available soonest
    return apiKeys.reduce((a, b) => (a.rateLimitedUntil < b.rateLimitedUntil ? a : b));
  }

  // Random selection for load distribution
  return available[Math.floor(Math.random() * available.length)];
}

function getAnthropicClient(): Anthropic {
  const keyState = getAvailableKeyState();
  if (!keyState) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  if (!keyState.client) {
    keyState.client = new Anthropic({ apiKey: keyState.key });
  }

  return keyState.client;
}

function markKeyRateLimited(client: Anthropic, retryAfterSeconds: number = 60): void {
  const keyState = apiKeys.find((k) => k.client === client);
  if (keyState) {
    keyState.rateLimitedUntil = Date.now() + retryAfterSeconds * 1000;
  }
}

// ============================================================================
// ANTHROPIC ADAPTER
// ============================================================================

/**
 * Adapter for Anthropic's Claude models
 */
export class AnthropicAdapter extends BaseAIAdapter {
  readonly providerId: ProviderId = 'claude';
  readonly family: ProviderFamily = 'anthropic';

  private client: Anthropic;

  constructor() {
    super();
    this.client = getAnthropicClient();
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

    // CRITICAL FIX: Refresh client on EVERY request for proper key rotation
    // The adapter is cached globally, but we need fresh key selection per-request
    // to ensure proper load distribution across multiple API keys
    this.client = getAnthropicClient();

    // Convert messages to Anthropic format
    const { system, messages: anthropicMessages } = this.convertToAnthropicFormat(
      messages,
      options.systemPrompt
    );

    // Convert tools if provided
    const tools = options.tools ? (this.formatTools(options.tools) as Anthropic.Tool[]) : undefined;

    try {
      const stream = await this.client.messages.stream({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: anthropicMessages,
        tools,
      });

      // Track whether current content block is a server tool (web_search)
      // so we can suppress stray tool_call_delta/tool_call_end events for it
      let isServerToolBlock = false;

      for await (const event of stream) {
        const chunk = this.parseStreamEvent(event, isServerToolBlock);

        // Track server tool blocks to suppress stray events
        if (event.type === 'content_block_start') {
          const blockType = (event.content_block as { type: string }).type;
          isServerToolBlock =
            blockType === 'server_tool_use' || blockType === 'web_search_tool_result';
        } else if (event.type === 'content_block_stop') {
          isServerToolBlock = false;
        }

        if (chunk) {
          yield chunk;
        }
      }

      // Emit done chunk
      yield { type: 'message_end' };
    } catch (error) {
      // Handle rate limiting
      if (this.isRateLimitError(error)) {
        markKeyRateLimited(this.client, this.extractRetryAfter(error));
        // Try to get a new client
        this.client = getAnthropicClient();
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
   * Convert unified messages to Anthropic format
   * Returns system as array format to support prompt caching
   */
  private convertToAnthropicFormat(
    messages: UnifiedMessage[],
    systemPrompt?: string,
    enableCaching: boolean = true
  ): {
    system: Anthropic.TextBlockParam[];
    messages: AnthropicMessage[];
  } {
    const systemText = systemPrompt || 'You are a helpful AI assistant.';

    // Use array format with cache_control for prompt caching
    // This can reduce costs by 90% for repeated system prompts
    // Cache TTL is 5 minutes (ephemeral)
    const system: Anthropic.TextBlockParam[] = enableCaching
      ? [
          {
            type: 'text' as const,
            text: systemText,
            cache_control: { type: 'ephemeral' as const },
          },
        ]
      : [{ type: 'text' as const, text: systemText }];

    const anthropicMessages: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue; // System goes in separate param

      const anthropicMsg = this.convertMessage(msg);
      if (anthropicMsg) {
        anthropicMessages.push(anthropicMsg);
      }
    }

    return { system, messages: anthropicMessages };
  }

  /**
   * Convert a single unified message to Anthropic format
   */
  private convertMessage(msg: UnifiedMessage): AnthropicMessage | null {
    if (msg.role === 'system') return null;

    // Handle tool role (tool results)
    if (msg.role === 'tool') {
      // Tool results need to be in a user message with tool_result content
      if (typeof msg.content === 'string') {
        return null; // Invalid format
      }

      const toolResults = msg.content.filter((b) => b.type === 'tool_result');
      if (toolResults.length === 0) return null;

      return {
        role: 'user',
        content: toolResults.map((tr) => ({
          type: 'tool_result' as const,
          tool_use_id: (tr as { toolUseId: string }).toolUseId,
          content: (tr as { content: string }).content,
          is_error: (tr as { isError?: boolean }).isError,
        })),
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

    // Handle content blocks
    const contentBlocks: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
      | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
    > = [];

    for (const block of msg.content) {
      switch (block.type) {
        case 'text':
          contentBlocks.push({ type: 'text', text: block.text });
          break;

        case 'image':
          if (block.source.type === 'base64' && block.source.data) {
            contentBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: block.source.mediaType || 'image/png',
                data: block.source.data,
              },
            });
          }
          break;

        case 'tool_use':
          contentBlocks.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.arguments,
          });
          break;

        case 'tool_result':
          contentBlocks.push({
            type: 'tool_result',
            tool_use_id: block.toolUseId,
            content: block.content,
            is_error: block.isError,
          });
          break;
      }
    }

    if (contentBlocks.length === 0) return null;

    return {
      role: msg.role as 'user' | 'assistant',
      content: contentBlocks as Anthropic.ContentBlockParam[],
    };
  }

  /**
   * Convert unified messages to Anthropic format (public interface)
   */
  toProviderMessages(messages: UnifiedMessage[]): AnthropicMessage[] {
    return messages
      .map((msg) => this.convertMessage(msg))
      .filter((msg): msg is AnthropicMessage => msg !== null);
  }

  /**
   * Convert Anthropic messages to unified format
   */
  fromProviderMessages(messages: unknown[]): UnifiedMessage[] {
    return (messages as AnthropicMessage[]).map((msg) => this.convertFromAnthropic(msg));
  }

  /**
   * Convert a single Anthropic message to unified format
   */
  private convertFromAnthropic(msg: AnthropicMessage): UnifiedMessage {
    const role = msg.role as 'user' | 'assistant';

    if (typeof msg.content === 'string') {
      return { role, content: msg.content };
    }

    const unifiedContent: UnifiedContentBlock[] = [];

    for (const block of msg.content) {
      if (block.type === 'text') {
        unifiedContent.push({ type: 'text', text: block.text });
      } else if (block.type === 'image') {
        const imageBlock = block as {
          type: 'image';
          source: { type: 'base64'; media_type: string; data: string };
        };
        unifiedContent.push({
          type: 'image',
          source: {
            type: 'base64',
            mediaType: imageBlock.source.media_type,
            data: imageBlock.source.data,
          },
        });
      } else if (block.type === 'tool_use') {
        const toolBlock = block as Anthropic.ToolUseBlockParam;
        unifiedContent.push({
          type: 'tool_use',
          id: toolBlock.id,
          name: toolBlock.name,
          arguments: toolBlock.input as Record<string, unknown>,
        });
      } else if (block.type === 'tool_result') {
        const resultBlock = block as Anthropic.ToolResultBlockParam;
        unifiedContent.push({
          type: 'tool_result',
          toolUseId: resultBlock.tool_use_id,
          content:
            typeof resultBlock.content === 'string'
              ? resultBlock.content
              : JSON.stringify(resultBlock.content),
          isError: resultBlock.is_error,
        });
      }
    }

    return { role, content: unifiedContent };
  }

  // ============================================================================
  // TOOL CONVERSION
  // ============================================================================

  /**
   * Convert unified tools to Anthropic format.
   * Handles both custom tools and native server tools (web_search_20260209).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formatTools(tools: UnifiedTool[]): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatted: any[] = [];

    for (const tool of tools) {
      // Native web search tool — pass as server tool type, not custom tool
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (tool.name === NATIVE_WEB_SEARCH_SENTINEL && (tool as any)._nativeConfig) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatted.push((tool as any)._nativeConfig);
        continue;
      }

      // Standard custom tool
      formatted.push({
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object' as const,
          properties: tool.parameters.properties,
          required: tool.parameters.required,
        },
      });
    }

    return formatted;
  }

  /**
   * Format a tool result for Anthropic
   */
  formatToolResult(result: UnifiedToolResult): Anthropic.ToolResultBlockParam {
    return {
      type: 'tool_result',
      tool_use_id: result.toolCallId,
      content: result.content,
      is_error: result.isError,
    };
  }

  // ============================================================================
  // STREAM PARSING
  // ============================================================================

  /**
   * Parse an Anthropic stream event into a unified chunk
   */
  private parseStreamEvent(
    event: Anthropic.MessageStreamEvent,
    isServerToolBlock: boolean
  ): UnifiedStreamChunk | null {
    switch (event.type) {
      case 'message_start': {
        // Extract input token usage from message_start event
        const msgEvent = event as {
          message?: { usage?: { input_tokens?: number; cache_read_input_tokens?: number } };
        };
        const startUsage = msgEvent.message?.usage;
        if (startUsage?.input_tokens) {
          return {
            type: 'message_start',
            usage: {
              inputTokens: startUsage.input_tokens,
              outputTokens: 0,
            },
          };
        }
        return { type: 'message_start' };
      }

      case 'content_block_start':
        if (event.content_block.type === 'text') {
          return null; // Text block start doesn't need a chunk
        }
        if (event.content_block.type === 'tool_use') {
          return {
            type: 'tool_call_start',
            toolCall: {
              id: event.content_block.id,
              name: event.content_block.name,
              arguments: {},
            },
          };
        }
        // Native server tools (web_search) — handled by Anthropic server-side.
        // server_tool_use = Claude's search query, web_search_tool_result = search results
        return null;

      case 'content_block_delta':
        // Suppress deltas from server tool blocks (search query JSON, etc.)
        if (isServerToolBlock) return null;

        if (event.delta.type === 'text_delta') {
          return { type: 'text', text: event.delta.text };
        }
        if (event.delta.type === 'input_json_delta') {
          // Pass the raw partial_json string for accumulation
          // It will be parsed once complete in the chat router
          return {
            type: 'tool_call_delta',
            toolCall: {
              arguments: event.delta.partial_json, // Raw string, not parsed
            },
          };
        }
        return null;

      case 'content_block_stop':
        // Suppress stop events from server tool blocks
        if (isServerToolBlock) return null;
        return { type: 'tool_call_end' };

      case 'message_stop':
        return { type: 'message_end' };

      case 'message_delta':
        if (event.usage) {
          return {
            type: 'message_end',
            usage: {
              inputTokens: 0, // Not available in delta
              outputTokens: event.usage.output_tokens,
            },
          };
        }
        return null;

      default:
        return null;
    }
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  /**
   * Check if an error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Anthropic.APIError) {
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
    if (error instanceof Anthropic.APIError) {
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
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an Anthropic adapter instance
 */
export function createAnthropicAdapter(): AnthropicAdapter {
  return new AnthropicAdapter();
}
