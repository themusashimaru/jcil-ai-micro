/**
 * OpenAI Model Routing
 * Determines which model to use based on tool type, content, and request
 *
 * Routing Strategy (GPT-5 Edition):
 * - gpt-5-nano: Basic chat, greetings, simple Q&A (cost-optimized)
 * - gpt-5-mini: Search, files, images, complex reasoning, code (primary workhorse)
 * - gpt-5-mini: Also serves as fallback when nano fails
 * - dall-e-3: Image generation
 * - whisper-1: Speech-to-text
 * - tts-1-hd: Text-to-speech
 * - gpt-4o-realtime-preview: Real-time voice conversations
 */

import { OpenAIModel, ToolType } from './types';

/**
 * Keywords/patterns that indicate a request needs gpt-5-mini (not nano)
 * These require search, file handling, or complex reasoning
 */
const MINI_ESCALATION_PATTERNS = [
  // Search/lookup intent
  /\b(search|look up|find|google|latest|breaking|news|weather|forecast|price|stock|crypto)\b/i,
  /\b(today|yesterday|this week|current|recent|update)\b/i,

  // File/upload handling
  /\b(upload|attached|photo|pdf|spreadsheet|excel|image|file|document)\b/i,
  /\b(analyze|extract|parse|read this|scan)\b/i,

  // Code/technical
  /\b(code|function|debug|refactor|typescript|javascript|python|react|sql|api)\b/i,
  /\b(github|repo|commit|deploy|database)\b/i,

  // Complex reasoning
  /\b(explain|analyze|compare|evaluate|summarize|research)\b.*\b(detail|thorough|comprehensive)\b/i,
  /\b(pros and cons|difference between|step by step)\b/i,

  // Multi-step tasks
  /\b(create|generate|write|draft)\b.*\b(report|essay|document|memo|resume|invoice)\b/i,
];

/**
 * Check if message content requires gpt-5-mini
 */
export function requiresMini(messageContent: string): boolean {
  if (!messageContent || messageContent.length < 3) return false;
  return MINI_ESCALATION_PATTERNS.some(pattern => pattern.test(messageContent));
}

/**
 * Get the appropriate OpenAI model based on tool type
 *
 * Routing rules:
 * - No tool + simple message → gpt-5-nano
 * - No tool + complex/search message → gpt-5-mini
 * - Code/research/data tools → gpt-5-mini
 * - Image generation → dall-e-3
 * - Other tools → gpt-5-nano (simple tasks)
 */
export function getModelForTool(tool?: ToolType, messageContent?: string): OpenAIModel {
  // Image/video generation always uses DALL-E 3
  if (tool === 'image' || tool === 'video') {
    return 'dall-e-3';
  }

  // Tools that always need gpt-5-mini (complex/search capabilities)
  const miniTools: ToolType[] = ['code', 'research', 'data', 'shopper'];
  if (tool && miniTools.includes(tool)) {
    return 'gpt-5-mini';
  }

  // If message content indicates complexity, use mini
  if (messageContent && requiresMini(messageContent)) {
    return 'gpt-5-mini';
  }

  // Simple tools use nano
  const nanoTools: ToolType[] = ['email', 'essay', 'sms', 'translate', 'scripture'];
  if (tool && nanoTools.includes(tool)) {
    return 'gpt-5-nano';
  }

  // Default: nano for basic chat
  return 'gpt-5-nano';
}

/**
 * Determine if request should escalate from nano to mini
 * Based on content analysis for search/complex intent
 */
export function shouldEscalateToMini(
  hasImages: boolean,
  hasFiles: boolean,
  _hasAudio: boolean,
  messageContent: string
): boolean {
  // Images and files always need mini
  if (hasImages || hasFiles) {
    return true;
  }

  // Check content patterns
  return requiresMini(messageContent);
}

/**
 * Check if this is an image generation request
 */
export function isImageGenerationRequest(messageContent: string): boolean {
  const lowerContent = messageContent.toLowerCase();

  const imagePatterns = [
    'draw', 'generate image', 'create image', 'make image',
    'generate a picture', 'create a picture', 'make a picture',
    'generate an image', 'create an image', 'make an image',
    'generate a pic', 'create a pic', 'make a pic',
    'logo', 'thumbnail', 'illustration', 'artwork',
    'design a', 'visualize', 'picture of', 'pic of',
    'create for me a', 'draw for me', 'make for me a'
  ];

  return imagePatterns.some(pattern => lowerContent.includes(pattern));
}

/**
 * Get recommended temperature for model
 */
export function getRecommendedTemperature(model: OpenAIModel, tool?: ToolType): number {
  // Code generation should be more deterministic
  if (tool === 'code') {
    return 0.3;
  }

  // Creative tasks can be more varied
  if (tool === 'essay' || tool === 'email' || tool === 'sms') {
    return 0.8;
  }

  // Research and factual tasks should be balanced
  if (tool === 'research' || tool === 'scripture' || tool === 'translate') {
    return 0.6;
  }

  // Image generation
  if (model === 'dall-e-3') {
    return 1.0;
  }

  // Default temperature
  return 0.7;
}

/**
 * Get max tokens for model/tool combination
 */
export function getMaxTokens(model: OpenAIModel, tool?: ToolType): number {
  // Nano uses fewer tokens (cost optimization)
  if (model === 'gpt-5-nano') {
    if (tool === 'sms') return 256;
    if (tool === 'email') return 800;
    return 1000; // Cap nano responses
  }

  // Mini can use more tokens
  if (model === 'gpt-5-mini') {
    if (tool === 'sms') return 256;
    if (tool === 'email') return 1000;
    if (tool === 'code') return 2000;
    if (tool === 'essay') return 2000;
    if (tool === 'research') return 2000;
    if (tool === 'data') return 2000;
    if (tool === 'scripture') return 4000;
    return 2000;
  }

  // Default
  return 2000;
}

/**
 * Check if a model supports vision/images
 */
export function supportsVision(model: OpenAIModel): boolean {
  return model === 'gpt-5-nano' || model === 'gpt-5-mini';
}

/**
 * Check if a model supports tool/function calling
 */
export function supportsToolCalling(model: OpenAIModel): boolean {
  return model === 'gpt-5-nano' || model === 'gpt-5-mini';
}

/**
 * Check if a model is a reasoning model
 * Reasoning models do NOT support temperature parameter
 */
export function isReasoningModel(model: OpenAIModel): boolean {
  // gpt-5-nano and gpt-5-mini are reasoning models
  return model === 'gpt-5-nano' || model === 'gpt-5-mini';
}

/**
 * Check if a model supports temperature parameter
 * Reasoning models (gpt-5-nano, gpt-5-mini) do NOT support temperature
 */
export function supportsTemperature(model: OpenAIModel): boolean {
  return !isReasoningModel(model);
}
