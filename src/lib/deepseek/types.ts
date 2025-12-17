/**
 * DeepSeek API Types
 * Type definitions for DeepSeek integration
 */

// DeepSeek models
export type DeepSeekModel =
  | 'deepseek-chat'      // Standard chat model - fast, cost-effective
  | 'deepseek-reasoner'; // Reasoning model (R1) - deep thinking, chain-of-thought

// Re-export ToolType from OpenAI (shared across providers)
export type { ToolType } from '../openai/types';
