/**
 * xAI Model Routing
 * Determines which model to use based on tool type and request
 */

import { XAIModel, ToolType } from './types';

/**
 * Get the appropriate xAI model based on tool type
 */
export function getModelForTool(tool?: ToolType): XAIModel {
  if (!tool) {
    // Default chat model
    return 'grok-4-1-fast-reasoning';
  }

  switch (tool) {
    case 'code':
      // Use specialized coding model
      return 'grok-code-fast-1';

    case 'image':
    case 'video':
      // Use image generation model
      return 'grok-2-image-1212';

    case 'research':
      // Research benefits from reasoning model
      return 'grok-4-1-fast-reasoning';

    case 'email':
    case 'essay':
    case 'sms':
    case 'translate':
    case 'shopper':
    case 'scripture':
    case 'data':
    default:
      // General chat model for other tools
      return 'grok-4-1-fast-reasoning';
  }
}

/**
 * Check if a model supports agentic tool calling
 */
export function supportsAgenticTools(model: XAIModel): boolean {
  return [
    'grok-4-1-fast-reasoning',
    'grok-4-fast',
  ].includes(model);
}

/**
 * Check if a model supports image generation
 */
export function supportsImageGeneration(model: XAIModel): boolean {
  return model === 'grok-2-image-1212';
}

/**
 * Get recommended temperature for model
 */
export function getRecommendedTemperature(model: XAIModel, tool?: ToolType): number {
  // Code generation should be more deterministic
  if (model === 'grok-code-fast-1' || tool === 'code') {
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

  // Default balanced temperature
  return 0.6;
}

/**
 * Get max tokens for model/tool combination
 */
export function getMaxTokens(model: XAIModel, tool?: ToolType): number {
  // Code generation might need more tokens
  if (model === 'grok-code-fast-1' || tool === 'code') {
    return 4096;
  }

  // Essays need more tokens
  if (tool === 'essay') {
    return 8192;
  }

  // Research needs extensive output
  if (tool === 'research') {
    return 6144;
  }

  // SMS should be brief
  if (tool === 'sms') {
    return 512;
  }

  // Default reasonable limit
  return 4096;
}
