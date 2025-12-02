/**
 * OpenAI Model Routing
 * Determines which model to use based on tool type, content, and request
 *
 * Routing Strategy:
 * - gpt-4o-mini: Default for most conversations (fast, cheap)
 * - gpt-4o: Complex tasks, images, coding, research
 * - dall-e-3: Image generation
 */

import { OpenAIModel, ToolType } from './types';

/**
 * Get the appropriate OpenAI model based on tool type
 */
export function getModelForTool(tool?: ToolType): OpenAIModel {
  if (!tool) {
    // Default chat model - gpt-4o-mini for cost efficiency
    return 'gpt-4o-mini';
  }

  switch (tool) {
    case 'code':
      // Coding tasks need the full model
      return 'gpt-4o';

    case 'image':
    case 'video':
      // Image generation uses DALL-E 3
      return 'dall-e-3';

    case 'research':
      // Research may need web browsing (gpt-4o)
      return 'gpt-4o';

    case 'data':
      // Data analysis benefits from stronger reasoning
      return 'gpt-4o';

    case 'email':
    case 'essay':
    case 'sms':
    case 'translate':
    case 'shopper':
    case 'scripture':
    default:
      // General tasks use mini for cost efficiency
      return 'gpt-4o-mini';
  }
}

/**
 * Determine if request should use gpt-4o based on content analysis
 * This is called in addition to tool-based routing
 */
export function shouldUseGPT4o(
  hasImages: boolean,
  hasFiles: boolean,
  hasAudio: boolean,
  messageContent: string
): boolean {
  // Images require gpt-4o
  if (hasImages || hasFiles || hasAudio) {
    return true;
  }

  const lowerContent = messageContent.toLowerCase();

  // Coding/infrastructure keywords
  const codingPatterns = [
    'deploy', 'github', 'typescript', 'javascript', 'python',
    'rewrite function', 'sql', 'supabase', 'vercel', 'upstash',
    'resend', 'pull request', 'pr', 'commit', 'merge',
    'debug', 'refactor', 'implement', 'create file', 'update file',
    'api', 'endpoint', 'database', 'schema', 'migration'
  ];

  for (const pattern of codingPatterns) {
    if (lowerContent.includes(pattern)) {
      return true;
    }
  }

  // Complex reasoning indicators
  const complexPatterns = [
    'analyze', 'compare', 'evaluate', 'explain in detail',
    'step by step', 'comprehensive', 'research', 'investigate'
  ];

  for (const pattern of complexPatterns) {
    if (lowerContent.includes(pattern)) {
      return true;
    }
  }

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
 */
export function getRecommendedTemperature(model: OpenAIModel, tool?: ToolType): number {
  // Code generation should be more deterministic
  if (tool === 'code') {
    return 0.3;
  }

  // Creative tasks can be more varied
  if (tool === 'essay' || tool === 'email' || tool === 'sms') {
    return 0.7;
  }

  // Research and factual tasks should be balanced
  if (tool === 'research' || tool === 'scripture' || tool === 'translate') {
    return 0.5;
  }

  // Image generation
  if (model === 'dall-e-3') {
    return 1.0; // DALL-E doesn't use temperature the same way
  }

  // Default balanced temperature
  return 0.6;
}

/**
 * Get max tokens for model/tool combination
 * Following directive: mini=900, 4o=1200-1800
 */
export function getMaxTokens(model: OpenAIModel, tool?: ToolType): number {
  // For gpt-4o-mini, cap at 900 tokens
  if (model === 'gpt-4o-mini') {
    if (tool === 'sms') return 256;
    if (tool === 'email') return 700;
    return 900;
  }

  // For gpt-4o, allow more tokens
  if (model === 'gpt-4o') {
    if (tool === 'code') return 1800;
    if (tool === 'essay') return 1800;
    if (tool === 'research') return 1500;
    if (tool === 'data') return 1500;
    return 1200;
  }

  // Default
  return 900;
}

/**
 * Check if a model supports vision/images
 */
export function supportsVision(model: OpenAIModel): boolean {
  return model === 'gpt-4o' || model === 'gpt-4o-mini';
}

/**
 * Check if a model supports tool/function calling
 */
export function supportsToolCalling(model: OpenAIModel): boolean {
  return model === 'gpt-4o' || model === 'gpt-4o-mini';
}
