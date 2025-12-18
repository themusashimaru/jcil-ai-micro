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

export interface VideoSegment {
  current: number;
  total: number;
  total_seconds: number;
  seconds_remaining: number;
}

export interface VideoJobError {
  code: string;
  message: string;
}

export interface ImageJobInfo {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  type: 'image' | 'slide';
  model?: string;
  imageUrl?: string; // Available when completed
  error?: string;
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
  segment?: VideoSegment;
  completed_segments?: string[]; // Array of completed video URLs
  error?: VideoJobError;
}

export interface GeneratedFile {
  file_id: string;
  filename: string;
  mime_type: string;
  download_url: string;
  size_bytes?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  attachments?: Attachment[];
  imageUrl?: string; // For AI-generated images
  videoUrl?: string; // For completed video generations
  videoJob?: VideoJobInfo; // For Sora video generation jobs
  imageJob?: ImageJobInfo; // For Nano Banana image generation jobs
  products?: ShopProduct[]; // For Amazon shopping results
  citations?: string[]; // Source URLs from Live Search
  sourcesUsed?: number; // Number of sources used in search
  searchProvider?: string; // Search provider used (e.g., 'perplexity')
  files?: GeneratedFile[]; // Generated documents (Excel, PowerPoint, Word, PDF)
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
