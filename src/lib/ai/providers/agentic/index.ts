/**
 * AGENTIC MULTI-PROVIDER INTERFACE
 *
 * Simple, provider-agnostic functions for agent use.
 * User picks a provider → everything works the same.
 *
 * This module provides two main functions:
 * 1. agentChat() - Simple chat completion (for brain modules)
 * 2. agentChatWithTools() - Chat with tool calling (for ToolOrchestrator)
 */

import { getAdapter } from '../adapters';
import { getProvider, getDefaultModel } from '../registry';
import type {
  ProviderId,
  UnifiedMessage,
  UnifiedTool,
  UnifiedContentBlock,
  ChatOptions,
} from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for agent chat calls
 */
export interface AgentChatOptions {
  /** Provider to use (defaults to claude) */
  provider?: ProviderId;
  /** Specific model ID (defaults to provider's default) */
  model?: string;
  /** System prompt */
  systemPrompt?: string;
  /** Max tokens for response */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
}

/**
 * Simple chat response (no tools)
 */
export interface AgentChatResponse {
  /** The text response */
  text: string;
  /** Provider that handled the request */
  provider: ProviderId;
  /** Model used */
  model: string;
  /** Token usage */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Tool call from the model
 */
export interface AgentToolCall {
  /** Unique ID for this tool call */
  id: string;
  /** Name of the tool to call */
  name: string;
  /** Arguments for the tool */
  arguments: Record<string, unknown>;
}

/**
 * Response from chat with tools
 */
export interface AgentToolResponse {
  /** Text response (may be empty if tool calls) */
  text: string;
  /** Tool calls requested by the model */
  toolCalls: AgentToolCall[];
  /** Whether the model wants to stop (no more tool calls) */
  done: boolean;
  /** Provider that handled the request */
  provider: ProviderId;
  /** Model used */
  model: string;
  /** Token usage */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Tool result to send back to the model
 */
export interface AgentToolResult {
  /** ID of the tool call this is responding to */
  toolCallId: string;
  /** Result content */
  content: string;
  /** Whether this is an error result */
  isError?: boolean;
}

// ============================================================================
// SIMPLE CHAT (for brain modules)
// ============================================================================

/**
 * Simple chat completion - no tools, just text in/out.
 * Use this for brain modules that just need text responses.
 *
 * @example
 * ```typescript
 * const response = await agentChat([
 *   { role: 'user', content: 'Analyze this code...' }
 * ], { provider: 'openai' });
 * console.log(response.text);
 * ```
 */
export async function agentChat(
  messages: UnifiedMessage[],
  options: AgentChatOptions = {}
): Promise<AgentChatResponse> {
  const providerId = options.provider || 'claude';
  const adapter = getAdapter(providerId);
  const model = options.model || getDefaultModel(providerId)?.id;

  if (!model) {
    throw new Error(`No default model found for provider: ${providerId}`);
  }

  const chatOptions: ChatOptions = {
    model,
    systemPrompt: options.systemPrompt,
    maxTokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 0.7,
  };

  let text = '';
  let usage: { inputTokens: number; outputTokens: number } | undefined;

  // Collect streaming response
  for await (const chunk of adapter.chat(messages, chatOptions)) {
    if (chunk.type === 'text' && chunk.text) {
      text += chunk.text;
    }
    if (chunk.type === 'message_end' && chunk.usage) {
      usage = chunk.usage;
    }
    if (chunk.type === 'error') {
      throw new Error(chunk.error?.message || 'Chat failed');
    }
  }

  return {
    text,
    provider: providerId,
    model,
    usage,
  };
}

// ============================================================================
// CHAT WITH TOOLS (for ToolOrchestrator)
// ============================================================================

/**
 * Chat completion with tool calling support.
 * Use this for agentic loops that need to call tools.
 *
 * @example
 * ```typescript
 * const tools = [
 *   { name: 'read_file', description: '...', parameters: {...} }
 * ];
 *
 * const response = await agentChatWithTools(messages, tools, { provider: 'xai' });
 *
 * if (response.toolCalls.length > 0) {
 *   // Execute tools and continue loop
 * } else if (response.done) {
 *   // Model is done, use response.text
 * }
 * ```
 */
export async function agentChatWithTools(
  messages: UnifiedMessage[],
  tools: UnifiedTool[],
  options: AgentChatOptions = {}
): Promise<AgentToolResponse> {
  const providerId = options.provider || 'claude';
  const adapter = getAdapter(providerId);
  const model = options.model || getDefaultModel(providerId)?.id;

  if (!model) {
    throw new Error(`No default model found for provider: ${providerId}`);
  }

  // Check if provider supports tool calling
  const providerConfig = getProvider(providerId);
  if (!providerConfig?.capabilities.toolCalling) {
    throw new Error(`Provider ${providerId} does not support tool calling`);
  }

  const chatOptions: ChatOptions = {
    model,
    systemPrompt: options.systemPrompt,
    maxTokens: options.maxTokens || 8192,
    temperature: options.temperature ?? 0.7,
    tools,
  };

  let text = '';
  const toolCalls: AgentToolCall[] = [];
  let currentToolCall: Partial<AgentToolCall> | null = null;
  let argumentsBuffer = '';
  let usage: { inputTokens: number; outputTokens: number } | undefined;
  let hasToolCalls = false;

  // Collect streaming response
  for await (const chunk of adapter.chat(messages, chatOptions)) {
    switch (chunk.type) {
      case 'text':
        if (chunk.text) {
          text += chunk.text;
        }
        break;

      case 'tool_call_start':
        if (chunk.toolCall) {
          hasToolCalls = true;
          currentToolCall = {
            id: chunk.toolCall.id,
            name: chunk.toolCall.name,
            arguments: {},
          };
          argumentsBuffer = '';
        }
        break;

      case 'tool_call_delta':
        if (chunk.toolCall?.arguments) {
          // Accumulate arguments
          argumentsBuffer += JSON.stringify(chunk.toolCall.arguments);
        }
        break;

      case 'tool_call_end':
        if (currentToolCall && currentToolCall.id && currentToolCall.name) {
          // Parse accumulated arguments
          let args: Record<string, unknown> = {};
          if (argumentsBuffer) {
            try {
              args = JSON.parse(argumentsBuffer);
            } catch {
              // Arguments might be streamed in partial JSON
              args = currentToolCall.arguments || {};
            }
          }

          toolCalls.push({
            id: currentToolCall.id,
            name: currentToolCall.name,
            arguments: args,
          });
          currentToolCall = null;
          argumentsBuffer = '';
        }
        break;

      case 'message_end':
        if (chunk.usage) {
          usage = chunk.usage;
        }
        break;

      case 'error':
        throw new Error(chunk.error?.message || 'Chat failed');
    }
  }

  return {
    text,
    toolCalls,
    done: !hasToolCalls && toolCalls.length === 0,
    provider: providerId,
    model,
    usage,
  };
}

// ============================================================================
// HELPER: Build tool result message
// ============================================================================

/**
 * Create a message containing tool results to send back to the model.
 *
 * @example
 * ```typescript
 * const toolResultMessage = buildToolResultMessage([
 *   { toolCallId: 'call_123', content: 'File contents here...' }
 * ]);
 * messages.push(toolResultMessage);
 * ```
 */
export function buildToolResultMessage(results: AgentToolResult[]): UnifiedMessage {
  const content: UnifiedContentBlock[] = results.map((result) => ({
    type: 'tool_result' as const,
    toolUseId: result.toolCallId,
    content: result.content,
    isError: result.isError,
  }));

  return {
    role: 'tool',
    content,
  };
}

/**
 * Create a message containing tool calls (assistant's tool use).
 * Use this to add the assistant's tool calls to the message history.
 */
export function buildToolCallMessage(toolCalls: AgentToolCall[]): UnifiedMessage {
  const content: UnifiedContentBlock[] = toolCalls.map((call) => ({
    type: 'tool_use' as const,
    id: call.id,
    name: call.name,
    arguments: call.arguments,
  }));

  return {
    role: 'assistant',
    content,
  };
}

// ============================================================================
// HELPER: Convert existing tool definitions
// ============================================================================

/**
 * Convert Anthropic-style tool definitions to unified format.
 * Use this when migrating existing agents.
 */
export function convertAnthropicTools(
  tools: Array<{
    name: string;
    description: string;
    input_schema: {
      type: string;
      properties: Record<
        string,
        {
          type: string;
          description?: string;
          enum?: string[];
          items?: { type: string };
          default?: unknown;
        }
      >;
      required?: string[];
    };
  }>
): UnifiedTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object' as const,
      properties: tool.input_schema.properties,
      required: tool.input_schema.required || [],
    },
  }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { ProviderId, UnifiedMessage, UnifiedTool, UnifiedContentBlock } from '../types';
