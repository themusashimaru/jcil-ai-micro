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
