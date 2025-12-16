/**
 * xAI (Grok) API Types
 * Type definitions for xAI integration
 */

// xAI Grok models
export type XAIModel =
  | 'grok-3'           // Latest flagship model - complex reasoning, analysis
  | 'grok-3-mini'      // Fast, efficient model - everyday tasks
  | 'grok-2'           // Previous generation flagship
  | 'grok-2-mini';     // Previous generation efficient

// Re-export ToolType from OpenAI (shared across providers)
export type { ToolType } from '../openai/types';
