/**
 * CHAT UTILITIES
 *
 * Centralized exports for all chat optimization utilities.
 */

// Request deduplication
export {
  isDuplicateRequest,
  clearRequest,
  getDedupStats,
} from './request-dedup';

// Stream optimization
export {
  createOptimizedStream,
  createStreamOptimizer,
  optimizedChunks,
  type StreamOptimizerOptions,
  type StreamController,
} from './stream-optimizer';

// Lazy tool loading
export {
  getTool,
  executeTool,
  getAllToolDefinitions,
  getToolDefinitions,
  preloadTools,
  getRegisteredToolNames,
  isToolRegistered,
  clearToolCache,
  getToolStats,
  CORE_TOOLS,
  DOCUMENT_TOOLS,
  MEDIA_TOOLS,
  DEVELOPER_TOOLS,
  type ToolDefinition,
  type ToolModule,
} from './lazy-tools';

// Context compression
export {
  compressContext,
  needsCompression,
  estimateTokens,
  wouldExceedLimit,
  type Message,
  type CompressedContext,
  type CompressionOptions,
} from './context-compressor';
