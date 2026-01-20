/**
 * AI ADAPTERS MODULE
 *
 * Exports all provider adapters for the multi-provider system.
 * Each adapter wraps a specific AI provider's API to implement
 * the unified AIAdapter interface.
 */

// Base adapter class
export { BaseAIAdapter } from './base';

// Provider-specific adapters
export { AnthropicAdapter, createAnthropicAdapter } from './anthropic';
export {
  OpenAICompatibleAdapter,
  createOpenAIAdapter,
  createXAIAdapter,
  createDeepSeekAdapter,
  createGroqAdapter,
} from './openai-compatible';

// Adapter factory
export {
  createAdapter,
  getAdapter,
  clearAdapterCache,
  hasAdapterCached,
  isOpenAICompatible,
  isAnthropicProvider,
} from './factory';

// Re-export types used by adapters
export type { AIAdapter, ChatOptions, UnifiedStreamChunk } from '../types';
