/**
 * GEMINI TYPES
 * Type definitions for Gemini AI integration
 */

// Gemini model types
export type GeminiModel =
  | 'gemini-2.0-flash'
  | 'gemini-2.0-flash-lite'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-flash-8b'
  | string; // Allow custom model names

export interface GeminiConfig {
  model: GeminiModel;
  maxTokens?: number;
  temperature?: number;
}
