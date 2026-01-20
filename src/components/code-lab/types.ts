/**
 * CODE LAB TYPES
 *
 * Type definitions for the Code Lab - a professional developer workspace
 * that combines chat, code generation, and web search in one unified interface.
 */

// ============================================================================
// SHARED CONSTANTS
// ============================================================================

/** Duration to show "Copied!" feedback in UI before resetting */
export const COPY_FEEDBACK_DURATION_MS = 2000;

/** Duration to show refresh indicator in preview panel */
export const PREVIEW_REFRESH_FEEDBACK_MS = 500;

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface CodeLabSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;

  // Associated repository
  repo?: {
    owner: string;
    name: string;
    fullName: string;
    branch: string;
  };

  // Session state
  isActive: boolean;
  messageCount: number;

  // Context management
  hasSummary: boolean;
  lastSummaryAt?: Date;

  // Code changes tracking
  codeChanges?: {
    linesAdded: number;
    linesRemoved: number;
    filesChanged: number;
  };
}

export interface CodeLabMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;

  // Message metadata
  type?: 'chat' | 'code' | 'search' | 'summary';

  // For code generation responses
  codeOutput?: {
    projectName: string;
    files: Array<{
      path: string;
      content: string;
      language: string;
    }>;
    buildSuccess: boolean;
    githubUrl?: string;
  };

  // For search responses
  searchOutput?: {
    query: string;
    sources: Array<{
      title: string;
      url: string;
    }>;
  };

  // For summaries (context continuation)
  summaryOutput?: {
    keyPoints: string[];
    nextSteps: string[];
    continuedFrom: string; // Previous message ID
  };

  // Streaming state
  isStreaming?: boolean;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface CodeLabState {
  // Sessions
  sessions: CodeLabSession[];
  currentSessionId: string | null;

  // Messages for current session
  messages: CodeLabMessage[];

  // UI state
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;

  // Sidebar state
  sidebarCollapsed: boolean;
}

export interface CodeLabContextValue extends CodeLabState {
  // Session actions
  createSession: (title?: string) => Promise<CodeLabSession>;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;

  // Repo actions
  setSessionRepo: (sessionId: string, repo: CodeLabSession['repo']) => Promise<void>;

  // Message actions
  sendMessage: (content: string) => Promise<void>;
  cancelStream: () => void;

  // UI actions
  toggleSidebar: () => void;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface CreateSessionRequest {
  title?: string;
  repo?: CodeLabSession['repo'];
}

export interface CreateSessionResponse {
  session: CodeLabSession;
}

export interface SendMessageRequest {
  sessionId: string;
  content: string;
  repo?: CodeLabSession['repo'];
}

export interface SendMessageResponse {
  message: CodeLabMessage;
}

// ============================================================================
// TOOL TYPES (for Opus integration)
// ============================================================================

export type CodeLabTool =
  | 'code_generation' // Trigger Code Agent V2
  | 'web_search' // Trigger Perplexity
  | 'read_file' // Read from repo
  | 'search_code' // Search codebase
  | 'none'; // Just chat

export interface ToolDecision {
  tool: CodeLabTool;
  confidence: number;
  reasoning: string;
}
