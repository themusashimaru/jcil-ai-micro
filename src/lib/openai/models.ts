/**
 * OpenAI Model Routing
 * Determines which model to use based on tool type, content, and request
 *
 * Routing Strategy (per Master Directive):
 * - gpt-5.1: Primary chat and reasoning model (default)
 * - gpt-4o: Vision/image analysis, complex multimodal tasks
 * - gpt-4o-realtime-preview: Real-time voice conversations
 * - dall-e-3: Image generation
 * - whisper-1: Speech-to-text
 * - tts-1-hd: Text-to-speech
 */

import { OpenAIModel, ToolType } from './types';

/**
 * Get the appropriate OpenAI model based on tool type
 */
export function getModelForTool(tool?: ToolType): OpenAIModel {
  if (!tool) {
    // Default chat model - gpt-5.1 per directive
    return 'gpt-5.1';
  }

  switch (tool) {
    case 'code':
      // Coding tasks use GPT-5.1 for reasoning
      return 'gpt-5.1';

    case 'image':
    case 'video':
      // Image generation uses DALL-E 3
      return 'dall-e-3';

    case 'research':
      // Research uses GPT-5.1 for reasoning
      return 'gpt-5.1';

    case 'data':
      // Data analysis uses GPT-5.1 for reasoning
      return 'gpt-5.1';

    case 'email':
    case 'essay':
    case 'sms':
    case 'translate':
    case 'shopper':
    case 'scripture':
    default:
      // General tasks use GPT-5.1 per directive
      return 'gpt-5.1';
  }
}

/**
 * Determine if request should use gpt-4o based on content analysis
 * Per Master Directive: ALL chat tasks use GPT-5.1, including:
 * - Image analysis (vision)
 * - PDF/document processing
 * - File operations
 * - All other tasks
 *
 * GPT-5.1 supports vision natively, so no need to route to GPT-4o
 */
export function shouldUseGPT4o(
  _hasImages: boolean,
  _hasFiles: boolean,
  _hasAudio: boolean,
  _messageContent: string
): boolean {
  // Per directive: ALL chat goes to GPT-5.1
  // GPT-5.1 supports vision/images natively
  return false;
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
    'generate a pic', 'create a pic', 'make a pic', // Added "pic" variants
    'logo', 'thumbnail', 'illustration', 'artwork',
    'design a', 'visualize', 'picture of', 'pic of',
    'create for me a', 'draw for me', 'make for me a' // "for me" patterns
  ];

  return imagePatterns.some(pattern => lowerContent.includes(pattern));
}

/**
 * Get recommended temperature for model
 * Per directive: temperature 0.8 for chat
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
    return 1.0; // DALL-E doesn't use temperature the same way
  }

  // Default temperature per directive
  return 0.8;
}

/**
 * Get max tokens for model/tool combination
 * Per directive: max_tokens 2000 for GPT-5.1 chat
 */
export function getMaxTokens(model: OpenAIModel, tool?: ToolType): number {
  // For gpt-5.1, use 2000 tokens per directive
  if (model === 'gpt-5.1') {
    if (tool === 'sms') return 256;
    if (tool === 'email') return 1000;
    if (tool === 'code') return 2000;
    if (tool === 'essay') return 2000;
    if (tool === 'research') return 2000;
    if (tool === 'data') return 2000;
    return 2000;
  }

  // For gpt-4o (vision/multimodal), allow more tokens
  if (model === 'gpt-4o') {
    if (tool === 'code') return 2000;
    if (tool === 'essay') return 2000;
    if (tool === 'research') return 2000;
    if (tool === 'data') return 2000;
    return 1500;
  }

  // For gpt-4o-mini (fallback), cap at 900 tokens
  if (model === 'gpt-4o-mini') {
    if (tool === 'sms') return 256;
    if (tool === 'email') return 700;
    return 900;
  }

  // Default
  return 2000;
}

/**
 * Check if a model supports vision/images
 */
export function supportsVision(model: OpenAIModel): boolean {
  return model === 'gpt-4o' || model === 'gpt-4o-mini' || model === 'gpt-5.1';
}

/**
 * Check if a model supports tool/function calling
 */
export function supportsToolCalling(model: OpenAIModel): boolean {
  return model === 'gpt-5.1' || model === 'gpt-4o' || model === 'gpt-4o-mini';
}
