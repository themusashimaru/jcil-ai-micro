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
  getAgenticTools,
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

  // Get agentic tools for the tool type
  const agenticTools = getAgenticTools(tool);

  // Use direct xAI API with intelligent auto-search for all non-streaming requests
  // This enables AI to automatically search when questions need current information
  // No need to click "Research" button - AI decides when search is needed
  if (!stream) {
    return createDirectXAICompletion(options);
  }

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

  // Configuration with agentic tools enabled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestConfig: any = {
    model,
    messages, // Pass messages directly - they're already in the right format
    system: systemPrompt,
    temperature: effectiveTemperature,
    maxTokens: effectiveMaxTokens,
  };

  // Add tools if available (enables web_search, x_search, code_execution)
  // For xAI, tools are automatically used when provided - no need for toolCallMode
  if (agenticTools && agenticTools.length > 0) {
    requestConfig.tools = agenticTools;
  }

  // Return streaming or non-streaming response
  if (stream) {
    return streamText(requestConfig);
  } else {
    return generateText(requestConfig);
  }
}

/**
 * Make direct API call to xAI for tool-enabled requests
 * This ensures web_search and other agentic tools work properly
 */
async function createDirectXAICompletion(options: ChatOptions) {
  const { messages, tool, temperature, maxTokens } = options;
  const apiKey = getXAIApiKey();

  // Get configuration
  const modelName = getModelForTool(tool);
  const systemPrompt = getSystemPromptForTool(tool);
  const effectiveTemperature = temperature ?? getRecommendedTemperature(modelName, tool);
  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Prepare messages with system prompt
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  // Prepare request body with search_parameters (NOT in tools array!)
  // search_parameters enables AI to automatically search when needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestBody: any = {
    model: modelName,
    messages: apiMessages,
    temperature: effectiveTemperature,
    max_tokens: effectiveMaxTokens,
    stream: false,
  };

  // DISABLED: search_parameters is causing API errors
  // The API is returning "An error o..." instead of JSON
  // Need to investigate the correct format for search_parameters with grok-4-1-fast-reasoning
  // if (tool === 'research' || !tool) {
  //   requestBody.search_parameters = {
  //     mode: 'on',
  //     return_citations: true,
  //     sources: [
  //       { type: 'web' },
  //       { type: 'x' },
  //       { type: 'news' }
  //     ]
  //   };
  // }

  // Make direct API call to xAI
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`xAI API error: ${error}`);
  }

  // Parse response with better error handling
  const responseText = await response.text();

  // Log first 200 chars of response for debugging
  console.log('[xAI API] Response preview:', responseText.substring(0, 200));

  // Check if response looks like an error message instead of JSON
  if (responseText.startsWith('An error') || responseText.startsWith('Error') || !responseText.startsWith('{')) {
    console.error('[xAI API] Non-JSON response received:', responseText);
    throw new Error(`xAI API returned error: ${responseText.substring(0, 500)}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown error';
    console.error('[xAI API] Parse error. Full response:', responseText.substring(0, 1000));
    throw new Error(`Failed to parse xAI API response: ${errorMsg}. Full response: ${responseText.substring(0, 300)}`);
  }

  // Return in the same format as generateText
  return {
    text: data.choices[0].message.content,
    finishReason: data.choices[0].finish_reason,
    usage: data.usage,
  };
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

  const model = xai('grok-4-1-fast-reasoning');

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
