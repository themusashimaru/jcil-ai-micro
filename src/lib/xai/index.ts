/**
 * xAI Integration - Main Export
 * Centralized exports for xAI functionality
 */

// Client functions
export { createChatCompletion, generateImage, analyzeImage } from './client';

// API Key Manager (for load distribution across multiple keys)
export {
  discoverApiKeys,
  getApiKeyCount,
  getApiKeyByIndex,
  getNextApiKeyIndex,
  getApiKeyForUser,
  getApiKeyStats,
  validateApiKeyConfiguration,
} from './api-key-manager';

// Model utilities
export {
  getModelForTool,
  supportsAgenticTools,
  supportsImageGeneration,
  getRecommendedTemperature,
  getMaxTokens,
} from './models';

// Tool utilities
export {
  getAgenticTools,
  getClientSideTools,
  shouldUseAgenticTools,
  getSystemPromptForTool,
} from './tools';

// Types
export type {
  XAIModel,
  ToolType,
  ChatMessage,
  ToolCall,
  StreamChunk,
  ChatRequestBody,
  ServerSideToolUsage,
  TokenUsage,
} from './types';
