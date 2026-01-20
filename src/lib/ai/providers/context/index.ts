/**
 * CONTEXT MODULE
 *
 * Handles mid-conversation provider switching with:
 * - Context handoff between providers
 * - Message format conversion
 * - Context summarization
 * - Capability analysis
 */

// Handoff exports
export {
  prepareProviderHandoff,
  analyzeCapabilityLoss,
  isHandoffSafe,
  prepareMessagesForProvider,
  needsSummarization,
  getMaxContextSize,
  canHandoff,
  getRecommendedHandoffProvider,
  DEFAULT_HANDOFF_OPTIONS,
} from './handoff';

// Summarizer exports
export {
  summarizeContext,
  estimateTokenCount,
  estimateMessageTokens,
  estimateStringTokens,
  isSummaryMessage,
  getCompressionRatio,
  DEFAULT_SUMMARIZATION_OPTIONS,
} from './summarizer';

export type { SummarizationOptions, SummarizationResult } from './summarizer';
