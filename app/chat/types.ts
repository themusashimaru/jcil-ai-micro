/**
 * CHAT TYPES
 *
 * PURPOSE:
 * - Shared type definitions for chat components
 * - Ensures type consistency across the chat interface
 */

export interface ChatFolder {
  id: string;
  name: string;
  color: string | null;
  position: number;
}

export interface Chat {
  id: string;
  title: string;
  summary?: string;
  folder?: ChatFolder | null;
  folderId?: string | null;
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

/**
 * Document download data for preview/download capability
 * Used for native document generation (Excel, Word, PDF)
 */
export interface DocumentDownload {
  filename: string;
  mimeType: string;
  dataUrl: string;
  canPreview: boolean; // True for PDFs that can be previewed in browser
}

export interface CodePreview {
  code: string;
  language: 'html' | 'react' | 'vue' | 'svelte';
  title?: string;
  description?: string;
}

/**
 * MULTI-PAGE WEBSITE SYSTEM
 * Supports full website generation with multiple pages
 */
export interface WebsitePage {
  name: string; // e.g., "Home", "About", "Services"
  slug: string; // e.g., "index", "about", "services"
  code: string; // Full HTML for this page
  icon?: string; // Optional emoji icon
}

export interface MultiPageWebsite {
  pages: WebsitePage[];
  sharedStyles?: string; // Optional shared CSS
  sharedScripts?: string; // Optional shared JS
  title: string;
  description?: string;
  businessName?: string;
  category?: string;
}

/**
 * SITE CLONING SYSTEM
 * Clone and customize existing websites
 */
export interface ClonedSite {
  originalUrl: string;
  analyzedStructure: {
    sections: string[];
    colorScheme: string[];
    fonts: string[];
    layout: string;
  };
  generatedCode: string;
}

/**
 * DATA ANALYTICS SYSTEM
 * Interactive charts and data insights rendered in chat
 */
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number; // For multi-series data
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  title: string;
  data: ChartDataPoint[];
  xKey: string;
  yKeys: string[];
  colors?: string[];
}

export interface DataInsight {
  type: 'stat' | 'trend' | 'outlier' | 'correlation';
  title: string;
  value: string;
  description?: string;
  icon?: string;
}

export interface AnalyticsResult {
  id: string;
  filename: string;
  summary: string;
  insights: DataInsight[];
  charts: ChartConfig[];
  rawDataPreview?: string[][]; // First few rows for context
  totalRows: number;
  totalColumns: number;
  columnNames: string[];
  suggestedQueries?: string[]; // Natural language follow-up suggestions
}

/**
 * Generated image from creative tools (FLUX.2)
 * Stored with full metadata for chat context and iteration
 */
export interface GeneratedImage {
  id: string; // Generation ID from database
  type: 'create' | 'edit';
  imageUrl: string; // Permanent Supabase Storage URL
  prompt: string; // Original user prompt
  enhancedPrompt?: string; // AI-enhanced prompt used
  dimensions: { width: number; height: number };
  model: string;
  seed?: number;
  verification?: {
    matches: boolean;
    feedback: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  attachments?: Attachment[];
  imageUrl?: string; // For AI-generated images (legacy support)
  videoUrl?: string; // For completed video generations
  videoJob?: VideoJobInfo; // For Sora video generation jobs
  products?: ShopProduct[]; // For Amazon shopping results
  citations?: string[]; // Source URLs from Live Search
  sourcesUsed?: number; // Number of sources used in search
  searchProvider?: string; // Search provider used (e.g., 'perplexity')
  files?: GeneratedFile[]; // Generated documents (Excel, PowerPoint, Word, PDF)
  documentDownload?: DocumentDownload; // Native document generation with preview/download
  codePreview?: CodePreview; // For live code previews (landing pages, websites)
  multiPageWebsite?: MultiPageWebsite; // For multi-page website generation
  clonedSite?: ClonedSite; // For cloned/recreated websites
  generatedImage?: GeneratedImage; // For AI-generated/edited images from creative tools
  analytics?: AnalyticsResult; // For data analytics with charts and insights
  suggestedFollowups?: string[]; // AI-generated follow-up questions
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
  rawData?: string; // Raw file data (base64) for analytics processing
}

export interface ShopProduct {
  title: string;
  price: string;
  rating?: string;
  image?: string;
  url: string;
}
