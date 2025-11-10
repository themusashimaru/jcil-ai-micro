/**
 * xAI Client
 * Wrapper for xAI API using Vercel AI SDK
 */

import { createXai } from '@ai-sdk/xai';
import { streamText, generateText } from 'ai';
import {
  getModelForTool,
  getRecommendedTemperature,
  getMaxTokens,
} from './models';
import {
  getSystemPromptForTool,
} from './tools';
import type { ToolType } from './types';

interface ChatOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[]; // Accept any message format, will convert to CoreMessage
  tool?: ToolType;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * Initialize xAI client with API key
 */
function getXAIApiKey(): string {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * Get configured xAI provider
 */
function getXAIProvider() {
  const apiKey = getXAIApiKey();
  return createXai({
    apiKey,
  });
}

/**
 * Create a chat completion with streaming support
 */
export async function createChatCompletion(options: ChatOptions) {
  const { messages, tool, temperature, maxTokens, stream = true } = options;

  // Get configured xAI provider
  const xai = getXAIProvider();

  // Determine the appropriate model
  const modelName = getModelForTool(tool);
  const model = xai(modelName);

  // Get system prompt for tool
  const systemPrompt = getSystemPromptForTool(tool);

  // Get recommended settings
  const effectiveTemperature = temperature ?? getRecommendedTemperature(modelName, tool);
  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Simple configuration without complex tools for now
  const requestConfig = {
    model,
    messages, // Pass messages directly - they're already in the right format
    system: systemPrompt,
    temperature: effectiveTemperature,
    maxTokens: effectiveMaxTokens,
  };

  // Return streaming or non-streaming response
  if (stream) {
    return streamText(requestConfig);
  } else {
    return generateText(requestConfig);
  }
}

/**
 * Generate an image using xAI
 */
export async function generateImage(prompt: string) {
  // Ensure API key is available
  const apiKey = getXAIApiKey();

  // Use OpenAI-compatible API for image generation
  const response = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-2-image-1212',
      prompt,
      n: 1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Image generation failed: ${error}`);
  }

  const data = await response.json();
  return data.data[0]?.url || null;
}

/**
 * Analyze an image using xAI vision capabilities
 */
export async function analyzeImage(imageUrl: string, question: string) {
  // Get configured xAI provider
  const xai = getXAIProvider();

  const model = xai('grok-4-fast-reasoning');

  const result = await generateText({
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: imageUrl,
          },
          {
            type: 'text',
            text: question,
          },
        ],
      },
    ],
  });

  return result.text;
}
