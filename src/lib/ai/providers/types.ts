/**
 * UNIFIED AI PROVIDER TYPES
 *
 * Provider-agnostic type definitions that normalize differences between:
 * - Anthropic (Claude)
 * - OpenAI (GPT-5 series)
 * - xAI (Grok)
 * - DeepSeek
 *
 * These types allow the core machine to work identically regardless of provider.
 */

// ============================================================================
// PROVIDER IDENTIFIERS
// ============================================================================

/**
 * Supported AI provider identifiers
 */
export type ProviderId = 'claude' | 'openai' | 'xai' | 'deepseek' | 'google';

/**
 * Provider API family - determines which adapter to use
 * - anthropic: Claude (unique message/tool format)
 * - openai-compatible: OpenAI, xAI, DeepSeek (shared format)
 * - google: Gemini (future)
 */
export type ProviderFamily = 'anthropic' | 'openai-compatible' | 'google';

/**
 * Pricing tier for cost-aware model selection
 */
export type PricingTier = 'premium' | 'standard' | 'budget';

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

/**
 * Model configuration within a provider
 */
export interface ModelConfig {
  /** Model identifier for API calls (e.g., 'gpt-4o', 'claude-opus-4-20250514') */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Price per 1M input tokens (USD) */
  inputPricePer1M: number;
  /** Price per 1M output tokens (USD) */
  outputPricePer1M: number;
  /** Pricing tier classification */
  tier: PricingTier;
  /** Whether this is the default model for the provider */
  isDefault?: boolean;
  /** Model-specific capability overrides */
  capabilities?: Partial<ProviderCapabilities>;
}

/**
 * Provider capability flags
 */
export interface ProviderCapabilities {
  /** Supports image/vision input */
  vision: boolean;
  /** Supports parallel tool calls in single response */
  parallelToolCalls: boolean;
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports system messages */
  systemMessages: boolean;
  /** Supports JSON mode output */
  jsonMode: boolean;
  /** Supports function/tool calling */
  toolCalling: boolean;
}

/**
 * Full provider configuration
 */
export interface ProviderConfig {
  /** Unique provider identifier */
  id: ProviderId;
  /** Human-readable provider name */
  name: string;
  /** Provider family (determines adapter) */
  family: ProviderFamily;
  /** Base URL for API (for OpenAI-compatible providers) */
  baseURL?: string;
  /** Environment variable name for API key */
  apiKeyEnv: string;
  /** Available models */
  models: ModelConfig[];
  /** Provider-level capabilities */
  capabilities: ProviderCapabilities;
  /** Provider icon/logo identifier */
  icon?: string;
  /** Provider description */
  description?: string;
}

// ============================================================================
// UNIFIED MESSAGE TYPES
// ============================================================================

/**
 * Unified message role (superset of all provider roles)
 */
export type UnifiedMessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Unified text content block
 */
export interface UnifiedTextBlock {
  type: 'text';
  text: string;
}

/**
 * Unified image content block
 */
export interface UnifiedImageBlock {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    mediaType?: string;
    data?: string; // For base64
    url?: string; // For URL
  };
}

/**
 * Unified tool use block (AI requesting to use a tool)
 */
export interface UnifiedToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Unified tool result block (result of tool execution)
 */
export interface UnifiedToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

/**
 * All possible content block types
 */
export type UnifiedContentBlock =
  | UnifiedTextBlock
  | UnifiedImageBlock
  | UnifiedToolUseBlock
  | UnifiedToolResultBlock;

/**
 * Unified message format that works across all providers
 */
export interface UnifiedMessage {
  /** Message role */
  role: UnifiedMessageRole;
  /** Message content - string or array of content blocks */
  content: string | UnifiedContentBlock[];
  /** Optional message metadata */
  metadata?: {
    /** Provider that generated this message */
    provider?: ProviderId;
    /** Model that generated this message */
    model?: string;
    /** Timestamp */
    timestamp?: string;
    /** Token usage */
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
    };
    /** Whether this is a summary message (from context handoff) */
    isSummary?: boolean;
    /** Number of messages that were summarized */
    summarizedMessageCount?: number;
    /** Whether aggressive summarization was used */
    aggressive?: boolean;
    /** Whether the message was truncated */
    truncated?: boolean;
    /** Original provider if converted */
    convertedFrom?: ProviderId;
    /** Target provider if converted */
    convertedTo?: ProviderId;
  };
}

// ============================================================================
// UNIFIED TOOL TYPES
// ============================================================================

/**
 * JSON Schema for tool parameters
 */
export interface ToolParameterSchema {
  type: 'object';
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
}

/**
 * Unified tool definition
 */
export interface UnifiedTool {
  /** Tool name (must be unique) */
  name: string;
  /** Tool description for the AI */
  description: string;
  /** Parameter schema */
  parameters: ToolParameterSchema;
}

/**
 * Unified tool call (AI's request to execute a tool)
 */
export interface UnifiedToolCall {
  /** Unique ID for this tool call */
  id: string;
  /** Tool name to execute */
  name: string;
  /** Arguments for the tool */
  arguments: Record<string, unknown>;
}

/**
 * Unified tool result (response after executing a tool)
 */
export interface UnifiedToolResult {
  /** ID of the tool call this is responding to */
  toolCallId: string;
  /** Result content */
  content: string;
  /** Whether the tool execution failed */
  isError?: boolean;
}

// ============================================================================
// UNIFIED STREAMING TYPES
// ============================================================================

/**
 * Stream chunk types
 */
export type StreamChunkType =
  | 'message_start'
  | 'text'
  | 'tool_call_start'
  | 'tool_call_delta'
  | 'tool_call_end'
  | 'message_end'
  | 'error';

/**
 * Unified stream chunk that all providers emit
 */
export interface UnifiedStreamChunk {
  /** Chunk type */
  type: StreamChunkType;
  /** Text content (for text chunks) */
  text?: string;
  /** Tool call data (for tool_call_* chunks) */
  toolCall?: Partial<UnifiedToolCall>;
  /** Error data (for error chunks) */
  error?: {
    code: string;
    message: string;
  };
  /** Usage data (for message_end chunks) */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ============================================================================
// UNIFIED ERROR TYPES
// ============================================================================

/**
 * Normalized error codes across all providers
 */
export type UnifiedErrorCode =
  | 'rate_limited'
  | 'context_too_long'
  | 'auth_failed'
  | 'model_unavailable'
  | 'content_filtered'
  | 'invalid_request'
  | 'network_error'
  | 'timeout'
  | 'server_error'
  | 'unknown';

/**
 * Unified AI error class
 */
export class UnifiedAIError extends Error {
  constructor(
    /** Normalized error code */
    public readonly code: UnifiedErrorCode,
    /** Human-readable error message */
    message: string,
    /** Provider that threw the error */
    public readonly provider: ProviderId,
    /** Whether this error is retryable */
    public readonly retryable: boolean,
    /** Milliseconds to wait before retry (if retryable) */
    public readonly retryAfterMs?: number,
    /** Original error from provider SDK */
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'UnifiedAIError';
  }

  /**
   * Check if we should retry this request
   */
  shouldRetry(): boolean {
    return this.retryable && this.code !== 'auth_failed' && this.code !== 'content_filtered';
  }

  /**
   * Get suggested wait time before retry
   */
  getRetryDelay(): number {
    return this.retryAfterMs ?? 5000;
  }
}

// ============================================================================
// CHAT OPTIONS
// ============================================================================

/**
 * Options for chat completion requests
 */
export interface ChatOptions {
  /** Model to use (defaults to provider's default) */
  model?: string;
  /** Tools available to the AI */
  tools?: UnifiedTool[];
  /** System prompt (prepended to messages) */
  systemPrompt?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

/**
 * Interface that all provider adapters must implement
 */
export interface AIAdapter {
  /** Provider identifier */
  readonly providerId: ProviderId;
  /** Provider family */
  readonly family: ProviderFamily;

  /**
   * Stream a chat completion
   */
  chat(messages: UnifiedMessage[], options?: ChatOptions): AsyncIterable<UnifiedStreamChunk>;

  /**
   * Convert unified tools to provider-specific format
   */
  formatTools(tools: UnifiedTool[]): unknown;

  /**
   * Convert unified messages to provider-specific format
   */
  toProviderMessages(messages: UnifiedMessage[]): unknown[];

  /**
   * Convert provider messages to unified format
   */
  fromProviderMessages(messages: unknown[]): UnifiedMessage[];

  /**
   * Format tool result for provider
   */
  formatToolResult(result: UnifiedToolResult): unknown;

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities;

  /**
   * Check if a specific capability is supported
   */
  hasCapability(capability: keyof ProviderCapabilities): boolean;
}

// ============================================================================
// CONTEXT HANDOFF TYPES
// ============================================================================

/**
 * Result of preparing a provider handoff
 */
export interface HandoffResult {
  /** Converted messages for new provider */
  messages: UnifiedMessage[];
  /** Source provider */
  fromProvider: ProviderId;
  /** Target provider */
  toProvider: ProviderId;
  /** Warnings about capability loss or other issues */
  warnings: string[];
  /** System prompt to inject for continuity */
  systemPrompt?: string;
  /** Handoff metadata */
  metadata: {
    /** When the handoff occurred */
    handoffTime: string;
    /** Original message count before conversion */
    originalMessageCount: number;
    /** Prepared message count after conversion */
    preparedMessageCount: number;
    /** Whether context was summarized to fit */
    wasSummarized: boolean;
    /** Processing time in milliseconds */
    processingTimeMs: number;
  };
}

/**
 * Options for context handoff
 */
export interface HandoffOptions {
  /** Summarize if context exceeds this fraction of window (0-1, default 0.8) */
  summarizeIfExceeds?: number;
  /** Include handoff system prompt for continuity */
  includeSystemPrompt?: boolean;
  /** Preserve tool call history in summary */
  preserveToolHistory?: boolean;
  /** Warn when capabilities will be lost */
  warnOnCapabilityLoss?: boolean;
}
