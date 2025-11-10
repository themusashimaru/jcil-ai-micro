/**
 * xAI API Types
 * Type definitions for xAI integration
 */

export type XAIModel =
  | 'grok-4-fast-reasoning'  // Main chat model
  | 'grok-4-fast'             // Fast reasoning
  | 'grok-code-fast-1'        // Code generation/debugging
  | 'grok-2-image-1212';      // Image generation

export type ToolType =
  | 'email'
  | 'essay'
  | 'sms'
  | 'research'
  | 'scripture'
  | 'image'
  | 'video'
  | 'data'
  | 'translate'
  | 'shopper'
  | 'code';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface StreamChunk {
  id: string;
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'finish';
  content?: string;
  toolName?: string;
  toolCallId?: string;
  finishReason?: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  tool?: ToolType;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface ServerSideToolUsage {
  SERVER_SIDE_TOOL_WEB_SEARCH?: number;
  SERVER_SIDE_TOOL_X_SEARCH?: number;
  SERVER_SIDE_TOOL_CODE_EXECUTION?: number;
  SERVER_SIDE_TOOL_VIEW_IMAGE?: number;
  SERVER_SIDE_TOOL_VIEW_X_VIDEO?: number;
  SERVER_SIDE_TOOL_COLLECTIONS_SEARCH?: number;
  SERVER_SIDE_TOOL_MCP?: number;
}

export interface TokenUsage {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
  reasoning_tokens?: number;
  cached_prompt_text_tokens?: number;
  prompt_text_tokens?: number;
  prompt_image_tokens?: number;
  server_side_tool_usage?: ServerSideToolUsage;
}
