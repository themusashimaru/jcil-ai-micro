/**
 * xAI Client
 * Wrapper for xAI API using Vercel AI SDK
 */

import { xai } from '@ai-sdk/xai';
import { streamText, generateText, CoreMessage } from 'ai';
import {
  getModelForTool,
  supportsAgenticTools,
  getRecommendedTemperature,
  getMaxTokens,
} from './models';
import {
  getAgenticTools,
  getClientSideTools,
  shouldUseAgenticTools,
  getSystemPromptForTool,
} from './tools';
import type { ToolType } from './types';

interface ChatOptions {
  messages: CoreMessage[];
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
 * Create a chat completion with streaming support
 */
export async function createChatCompletion(options: ChatOptions) {
  const { messages, tool, temperature, maxTokens, stream = true } = options;

  // Ensure API key is available
  getXAIApiKey();

  // Determine the appropriate model
  const modelName = getModelForTool(tool);
  const model = xai(modelName);

  // Get system prompt for tool
  const systemPrompt = getSystemPromptForTool(tool);

  // Get recommended settings
  const effectiveTemperature = temperature ?? getRecommendedTemperature(modelName, tool);
  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Prepare tools configuration
  const useAgenticTools = shouldUseAgenticTools(tool) && supportsAgenticTools(modelName);
  const agenticTools = useAgenticTools ? getAgenticTools(tool) : [];
  const clientTools = getClientSideTools(tool);

  // Configure request parameters
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const requestConfig: any = {
    model,
    messages,
    system: systemPrompt,
    temperature: effectiveTemperature,
    maxTokens: effectiveMaxTokens,
  };

  // Add server-side agentic tools if applicable
  // Note: xAI server-side tools use experimental_toolCallMode
  if (agenticTools.length > 0) {
    requestConfig.experimental_toolCallMode = 'server';
    requestConfig.tools = agenticTools.reduce((acc: any, toolDef: any) => {
      acc[toolDef.type] = {}; // xAI server-side tools don't need parameters
      return acc;
    }, {});
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Add client-side tools if applicable
  if (Object.keys(clientTools).length > 0) {
    requestConfig.tools = { ...requestConfig.tools, ...clientTools };
  }

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
  // Ensure API key is available
  getXAIApiKey();

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
