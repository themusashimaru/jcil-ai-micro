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

export interface VideoJobInfo {
  job_id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number; // 0-100
  model?: string;
  size?: string;
  seconds?: number;
  status_url?: string;
  download_url?: string;
  prompt?: string;
  segment?: number;
  error?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  attachments?: Attachment[];
  imageUrl?: string; // For AI-generated images
  videoJob?: VideoJobInfo; // For Sora video generation jobs
  products?: ShopProduct[]; // For Amazon shopping results
  citations?: string[]; // Source URLs from Live Search
  sourcesUsed?: number; // Number of sources used in search
  model?: string; // Model used for this response (gpt-5-nano, gpt-5-mini, etc.)
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
