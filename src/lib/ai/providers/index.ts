/**
 * AI PROVIDERS MODULE
 *
 * Multi-provider AI abstraction layer for JCIL Code Lab.
 *
 * Usage:
 * ```typescript
 * import { getProvider, getAvailableProviders, hasCapability } from '@/lib/ai/providers';
 *
 * // Get available providers
 * const available = getAvailableProviders();
 *
 * // Get a specific provider
 * const claude = getProvider('claude');
 *
 * // Check capabilities
 * if (hasCapability('deepseek', 'vision')) {
 *   // Can use images with DeepSeek
 * }
 * ```
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Provider identifiers
  ProviderId,
  ProviderFamily,
  PricingTier,
  // Configuration types
  ModelConfig,
  ProviderCapabilities,
  ProviderConfig,
  // Message types
  UnifiedMessageRole,
  UnifiedTextBlock,
  UnifiedImageBlock,
  UnifiedToolUseBlock,
  UnifiedToolResultBlock,
  UnifiedContentBlock,
  UnifiedMessage,
  // Tool types
  ToolParameterSchema,
  UnifiedTool,
  UnifiedToolCall,
  UnifiedToolResult,
  // Streaming types
  StreamChunkType,
  UnifiedStreamChunk,
  // Error types
  UnifiedErrorCode,
  // Options types
  ChatOptions,
  // Adapter interface
  AIAdapter,
  // Handoff types
  HandoffResult,
  HandoffOptions,
} from './types';

// Export error class
export { UnifiedAIError } from './types';

// ============================================================================
// REGISTRY EXPORTS
// ============================================================================

export {
  // Provider registry
  PROVIDERS,
  // Provider functions
  getProvider,
  getProviderSafe,
  isValidProviderId,
  getAllProviders,
  getAvailableProviders,
  getAvailableProviderIds,
  isProviderAvailable,
  // Model functions
  getModel,
  getDefaultModel,
  getModelsForProvider,
  getModelCapabilities,
  // Utility functions
  getProvidersByTier,
  getProvidersWithCapability,
  getCheapestProvider,
  estimateCost,
} from './registry';

// ============================================================================
// CAPABILITY EXPORTS
// ============================================================================

export {
  // Capability checking
  hasCapability,
  supportsVision,
  supportsParallelTools,
  supportsToolCalling,
  supportsStreaming,
  supportsSystemMessages,
  // Capability comparison
  compareCapabilities,
  getCapabilityWarnings,
  // Message analysis
  messageContainsImages,
  conversationContainsImages,
  messageContainsToolCalls,
  conversationContainsToolCalls,
  // Provider selection
  findProvidersForRequirements,
  getBestProviderForConversation,
  // Capability matrix
  getCapabilityMatrix,
  getProvidersWithAllCapabilities,
} from './capabilities';

export type { ProviderRequirements } from './capabilities';

// ============================================================================
// ADAPTER EXPORTS
// ============================================================================

export {
  // Base adapter
  BaseAIAdapter,
  // Provider adapters
  AnthropicAdapter,
  createAnthropicAdapter,
  OpenAICompatibleAdapter,
  createOpenAIAdapter,
  createXAIAdapter,
  createDeepSeekAdapter,
  // Adapter factory
  createAdapter,
  getAdapter,
  clearAdapterCache,
  hasAdapterCached,
  isOpenAICompatible,
  isAnthropicProvider,
} from './adapters';

// ============================================================================
// ERROR HANDLING EXPORTS
// ============================================================================

export {
  // Error parsers
  parseAnthropicError,
  parseOpenAIError,
  parseProviderError,
  // Retry logic
  withRetry,
  createRetryWrapper,
  calculateRetryDelay,
  sleep,
  DEFAULT_RETRY_CONFIG,
  // Error recovery
  canRecoverWithFallback,
  getUserFriendlyMessage,
  shouldReportError,
} from './errors';

export type { RetryConfig, ErrorRecoveryOptions } from './errors';

// ============================================================================
// CONTEXT HANDOFF EXPORTS
// ============================================================================

export {
  // Handoff functions
  prepareProviderHandoff,
  analyzeCapabilityLoss,
  isHandoffSafe,
  prepareMessagesForProvider,
  needsSummarization,
  getMaxContextSize,
  canHandoff,
  getRecommendedHandoffProvider,
  DEFAULT_HANDOFF_OPTIONS,
  // Summarization functions
  summarizeContext,
  estimateTokenCount,
  estimateMessageTokens,
  estimateStringTokens,
  isSummaryMessage,
  getCompressionRatio,
  DEFAULT_SUMMARIZATION_OPTIONS,
} from './context';

export type { SummarizationOptions, SummarizationResult } from './context';

// ============================================================================
// PROVIDER SERVICE EXPORTS
// ============================================================================

export {
  // Service class
  ProviderService,
  // Factory functions
  getProviderService,
  createProviderService,
  // Convenience functions
  isProviderAvailable as checkProviderAvailable,
  getAvailableProviders as listAvailableProviders,
  chat,
} from './service';

export type { ProviderChatOptions, ProviderChatResult, ProviderStatus } from './service';

// ============================================================================
// API INTEGRATION EXPORTS
// ============================================================================

export {
  // Streaming helpers
  createStreamingResponse,
  createChatResponse,
  // Route handler factory
  createMultiProviderHandler,
  // Utility functions
  extractProviderFromRequest,
  formatMessagesForProvider,
  simplifyMessages,
} from './api-integration';

export type {
  MultiProviderChatRequest,
  MultiProviderChatResponse,
  MultiProviderErrorResponse,
  MultiProviderHandlerOptions,
} from './api-integration';

// ============================================================================
// AGENTIC INTERFACE EXPORTS
// ============================================================================

export {
  // Simple chat (for brain modules)
  agentChat,
  // Chat with tools (for ToolOrchestrator)
  agentChatWithTools,
  // Message builders
  buildToolResultMessage,
  buildToolCallMessage,
  // Migration helpers
  convertAnthropicTools,
} from './agentic';

export type {
  AgentChatOptions,
  AgentChatResponse,
  AgentToolCall,
  AgentToolResponse,
  AgentToolResult,
} from './agentic';
