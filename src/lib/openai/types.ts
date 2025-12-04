/**
 * OpenAI API Types
 * Type definitions for OpenAI integration
 */

export type OpenAIModel =
  | 'gpt-5-mini'              // Primary chat and reasoning model (cost-effective)
  | 'gpt-4o'                  // Heavy multimodal - images, complex reasoning, coding
  | 'gpt-4o-mini'             // Lightweight chat - fallback for simple tasks
  | 'gpt-4o-realtime-preview' // Real-time voice conversations
  | 'dall-e-3'                // Image generation
  | 'whisper-1'               // Speech-to-text
  | 'tts-1-hd';               // High-quality text-to-speech

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
  content: string | ContentPart[];
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
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

export interface TokenUsage {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
}

// Routing decision type
export type RouteDecision = 'mini' | '4o' | 'image' | 'speech' | 'code';
