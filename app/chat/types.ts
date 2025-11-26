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
  imageUrl?: string; // For AI-generated images
  products?: ShopProduct[]; // For Amazon shopping results
  citations?: string[]; // Source URLs from Live Search
  sourcesUsed?: number; // Number of sources used in search
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

export interface ShopProduct {
  title: string;
  price: string;
  rating?: string;
  image?: string;
  url: string;
}
