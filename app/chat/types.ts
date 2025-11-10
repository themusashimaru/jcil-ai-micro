/**
 * CHAT TYPES
 *
 * PURPOSE:
 * - Shared type definitions for chat components
 * - Ensures type consistency across the chat interface
 */

export interface Chat {
  id: string;
  title: string;
  summary?: string;
  folder?: string;
  isPinned: boolean;
  lastMessage: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  attachments?: Attachment[];
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  thumbnail?: string;
}
