/**
 * xAI Client
 * Wrapper for xAI API using Vercel AI SDK
 *
 * Supports multiple API keys for load distribution.
 * Users are assigned to specific API keys for consistency.
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
import { getApiKeyForUser } from './api-key-manager';

interface ChatOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[]; // Accept any message format, will convert to CoreMessage
  tool?: ToolType;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  apiKeyIndex?: number | null; // User's assigned API key index
}

/**
 * Get API key for a request
 * Uses assigned key index if provided, otherwise falls back to first available
 */
function getXAIApiKey(assignedKeyIndex?: number | null): string {
  return getApiKeyForUser(assignedKeyIndex ?? null);
}

/**
 * Get configured xAI provider with specific API key
 */
function getXAIProvider(apiKeyIndex?: number | null) {
  const apiKey = getXAIApiKey(apiKeyIndex);
  return createXai({
    apiKey,
  });
}

/**
 * Create a chat completion with streaming support
 *
 * Uses Vercel AI SDK streamText for real-time response streaming.
 * If streaming fails, the API route falls back to non-streaming mode
 * which uses the direct xAI Responses API with full search support.
 */
export async function createChatCompletion(options: ChatOptions) {
  const { messages, tool, temperature, maxTokens, stream = true, apiKeyIndex } = options;

  // Use direct xAI API for non-streaming (has better search support)
  if (!stream) {
    return createDirectXAICompletion(options);
  }

  // For streaming, use Vercel AI SDK with xAI provider options for search
  const xai = getXAIProvider(apiKeyIndex);

  // Determine the appropriate model
  const modelName = getModelForTool(tool);
  const model = xai(modelName);

  // Get system prompt for tool
  const systemPrompt = getSystemPromptForTool(tool);

  // Get recommended settings
  const effectiveTemperature = temperature ?? getRecommendedTemperature(modelName, tool);
  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Inject current time context into system prompt for streaming
  const timeContext = getCurrentTimeContext();
  const fullSystemPrompt = `${timeContext}\n\n${systemPrompt}`;

  // Streaming config - keeping it simple first to verify streaming works
  // Search functionality preserved via fallback to non-streaming mode
  const requestConfig = {
    model,
    messages,
    system: fullSystemPrompt,
    temperature: effectiveTemperature,
    maxTokens: effectiveMaxTokens,
  };

  console.log('[xAI Streaming] Using streamText with model:', modelName);

  // Return streaming response
  return streamText(requestConfig);
}

/**
 * Convert Vercel AI SDK image format to xAI/OpenAI compatible format
 * Vercel format: { type: 'image', image: 'data:...' }
 * xAI format: { type: 'image_url', image_url: { url: 'data:...', detail: 'high' } }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertMessageForXAI(message: any): any {
  // If content is not an array, return as-is
  if (!Array.isArray(message.content)) {
    return message;
  }

  // Convert each content part
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convertedContent = message.content.map((part: any) => {
    // Convert Vercel AI SDK image format to OpenAI/xAI format
    if (part.type === 'image' && part.image) {
      return {
        type: 'image_url',
        image_url: {
          url: part.image,
          detail: 'high', // Use high detail for better image understanding
        },
      };
    }
    // Keep other parts (like text) as-is
    return part;
  });

  return {
    ...message,
    content: convertedContent,
  };
}

/**
 * Strip images from older messages in conversation history
 * Only keep images in the most recent user message to avoid:
 * - Request size limits (base64 images are large)
 * - API format issues with multiple images
 * - Context confusion from old images
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripOldImagesFromHistory(messages: any[]): any[] {
  // Find the index of the last user message with images
  let lastImageMessageIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasImage = msg.content.some((part: any) =>
        part.type === 'image' || part.type === 'image_url'
      );
      if (hasImage) {
        lastImageMessageIndex = i;
        break;
      }
    }
  }

  // If no images found, return messages as-is
  if (lastImageMessageIndex === -1) {
    return messages;
  }

  // Process messages: strip images from all but the last image message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return messages.map((msg: any, index: number) => {
    // Keep the last image message intact
    if (index === lastImageMessageIndex) {
      return msg;
    }

    // For other messages with array content, strip images
    if (Array.isArray(msg.content)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredContent = msg.content.filter((part: any) =>
        part.type !== 'image' && part.type !== 'image_url'
      );

      // If we removed images, add a placeholder text
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hadImages = msg.content.some((part: any) =>
        part.type === 'image' || part.type === 'image_url'
      );

      if (hadImages && filteredContent.length === 0) {
        // Message was only images, replace with placeholder
        return {
          ...msg,
          content: '[User shared an image earlier in this conversation]',
        };
      } else if (hadImages) {
        // Message had images and text, keep text only
        return {
          ...msg,
          content: filteredContent,
        };
      }
    }

    return msg;
  });
}

/**
 * Get current time context string to inject into system prompt
 * This ensures the AI always knows the correct current date and time
 */
function getCurrentTimeContext(): string {
  const now = new Date();

  // Format for multiple timezones
  const utcTime = now.toUTCString();
  const estTime = now.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
  const cstTime = now.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  const pstTime = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  return `CURRENT DATE AND TIME (ACCURATE - USE THIS):
Today is ${estTime}
Other US timezones: ${cstTime} | ${pstTime}
UTC: ${utcTime}

IMPORTANT: Use these times as your reference. When users ask about time, use these values and adjust for their requested timezone. Do NOT rely on search results for current time - use this server time.`;
}

/**
 * Make direct API call to xAI using the new Agentic Tool Calling API
 * This uses the /v1/responses endpoint with web_search and x_search tools
 * The model autonomously decides when to search and handles the full research loop
 *
 * NOTE: When images are present, we fall back to /v1/chat/completions
 * because the Responses API doesn't support the image_url format
 */
async function createDirectXAICompletion(options: ChatOptions) {
  const { messages, tool, temperature, maxTokens, apiKeyIndex } = options;
  const apiKey = getXAIApiKey(apiKeyIndex);

  // Get configuration
  const modelName = getModelForTool(tool);
  const baseSystemPrompt = getSystemPromptForTool(tool);
  const effectiveTemperature = temperature ?? getRecommendedTemperature(modelName, tool);
  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Inject current time context into system prompt
  const timeContext = getCurrentTimeContext();
  const systemPrompt = `${timeContext}\n\n${baseSystemPrompt}`;

  // Convert messages to xAI format (handles image format conversion)
  const convertedMessages = messages.map(convertMessageForXAI);

  // Check if any message contains images
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasImages = messages.some((msg: any) =>
    Array.isArray(msg.content) &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    msg.content.some((item: any) => item.type === 'image_url' || item.type === 'image')
  );

  // If images are present, use chat/completions endpoint (Responses API doesn't support images well)
  if (hasImages) {
    console.log('[xAI API] Images detected - using chat/completions endpoint');
    return createChatCompletionWithImages(convertedMessages, systemPrompt, modelName, effectiveTemperature, effectiveMaxTokens, apiKey);
  }

  // Prepare input messages with system prompt for the Responses API
  // The Responses API uses 'input' instead of 'messages'
  const inputMessages = [
    { role: 'system', content: systemPrompt },
    ...convertedMessages,
  ];

  // Build request body for the Agentic Tool Calling API
  // Uses /v1/responses endpoint with tools array (NOT search_parameters)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestBody: any = {
    model: modelName,
    input: inputMessages,
    temperature: effectiveTemperature,
    max_output_tokens: effectiveMaxTokens,
    // Enable agentic search tools - model decides when to use them
    tools: [
      {
        type: 'web_search',
        // Enable image understanding during web searches
        enable_image_understanding: true,
      },
      {
        type: 'x_search',
        // Enable image and video understanding for X posts
        enable_image_understanding: true,
        enable_video_understanding: true,
      },
    ],
  };

  console.log('[xAI API] Using Agentic Tool Calling API with model:', modelName);

  // Make direct API call to xAI Responses endpoint
  const response = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[xAI API] Error response:', error);
    throw new Error(`xAI API error: ${error}`);
  }

  // Parse response
  const responseText = await response.text();
  console.log('[xAI API] Response preview:', responseText.substring(0, 300));

  // Check if response looks like an error
  if (responseText.startsWith('An error') || responseText.startsWith('Error') || !responseText.startsWith('{')) {
    console.error('[xAI API] Non-JSON response:', responseText);
    throw new Error(`xAI API returned error: ${responseText.substring(0, 500)}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown error';
    console.error('[xAI API] Parse error. Response:', responseText.substring(0, 1000));
    throw new Error(`Failed to parse xAI API response: ${errorMsg}`);
  }

  // Extract text content from the Responses API format
  // The response structure has 'output' array with different types
  let textContent = '';
  const citations: string[] = [];
  let toolCallsCount = 0;

  // Process the response output
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      // Extract text from message items
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.type === 'output_text' || content.type === 'text') {
            textContent += content.text || '';
          }
        }
      }
      // Count tool calls for logging
      if (item.type === 'web_search_call' || item.type === 'x_search_call') {
        toolCallsCount++;
      }
    }
  }

  // Fallback: try alternative response structures
  if (!textContent) {
    // Try direct output_text field
    if (data.output_text) {
      textContent = data.output_text;
    }
    // Try choices array (chat completions style)
    else if (data.choices?.[0]?.message?.content) {
      textContent = data.choices[0].message.content;
    }
    // Try content array
    else if (data.content?.[0]?.text) {
      textContent = data.content[0].text;
    }
  }

  // Extract citations from response - check multiple possible locations
  // 1. Direct citations array
  if (data.citations && Array.isArray(data.citations)) {
    citations.push(...data.citations);
  }

  // 2. Look for citations/sources in output items (web_search_call results)
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      // Check for sources in search results
      if (item.sources && Array.isArray(item.sources)) {
        for (const source of item.sources) {
          if (source.url && !citations.includes(source.url)) {
            citations.push(source.url);
          }
        }
      }
      // Check for citations in search results
      if (item.citations && Array.isArray(item.citations)) {
        for (const citation of item.citations) {
          const url = typeof citation === 'string' ? citation : citation.url;
          if (url && !citations.includes(url)) {
            citations.push(url);
          }
        }
      }
      // Check for results with URLs
      if (item.results && Array.isArray(item.results)) {
        for (const result of item.results) {
          if (result.url && !citations.includes(result.url)) {
            citations.push(result.url);
          }
        }
      }
    }
  }

  // 3. Extract URLs from the text content as inline citations
  if (textContent && citations.length === 0) {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const foundUrls = textContent.match(urlRegex) || [];
    for (const url of foundUrls) {
      // Clean up URL (remove trailing punctuation)
      const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
      if (!citations.includes(cleanUrl)) {
        citations.push(cleanUrl);
      }
    }
  }

  // Log search activity
  if (toolCallsCount > 0 || citations.length > 0) {
    console.log(`[xAI API] Agentic search: ${toolCallsCount} tool calls, ${citations.length} citations`);
  }

  // Return in standard format
  return {
    text: textContent || 'I apologize, but I was unable to generate a response. Please try again.',
    finishReason: data.stop_reason || 'stop',
    usage: data.usage || {},
    citations: citations,
    numSourcesUsed: citations.length,
    toolCallsCount: toolCallsCount,
  };
}

/**
 * Handle image requests using /v1/chat/completions endpoint
 * The Responses API doesn't support image_url format, so we use chat/completions for images
 */
async function createChatCompletionWithImages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  convertedMessages: any[],
  systemPrompt: string,
  modelName: string,
  temperature: number,
  maxTokens: number,
  apiKey: string
) {
  // Strip old images from history to avoid API issues with multiple images
  // Only keep images from the most recent user message
  const cleanedMessages = stripOldImagesFromHistory(convertedMessages);

  // Build messages array with system prompt
  const messagesWithSystem = [
    { role: 'system', content: systemPrompt },
    ...cleanedMessages,
  ];

  // Build request body for chat/completions endpoint
  const requestBody = {
    model: modelName,
    messages: messagesWithSystem,
    temperature: temperature,
    max_tokens: maxTokens,
  };

  // Make API call to chat/completions endpoint
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
    console.error('[xAI API] Chat completions error:', error);
    throw new Error(`xAI API error: ${error}`);
  }

  const data = await response.json();

  // Extract text from chat/completions response format
  const textContent = data.choices?.[0]?.message?.content || '';

  // Return in standard format (no citations for image analysis)
  return {
    text: textContent || 'I apologize, but I was unable to analyze the image. Please try again.',
    finishReason: data.choices?.[0]?.finish_reason || 'stop',
    usage: data.usage || {},
    citations: [],
    numSourcesUsed: 0,
    toolCallsCount: 0,
  };
}

/**
 * Generate an image using xAI
 */
export async function generateImage(prompt: string, apiKeyIndex?: number | null) {
  // Ensure API key is available
  const apiKey = getXAIApiKey(apiKeyIndex);

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
export async function analyzeImage(imageUrl: string, question: string, apiKeyIndex?: number | null) {
  // Get configured xAI provider
  const xai = getXAIProvider(apiKeyIndex);

  // grok-4-fast supports vision/image understanding
  const model = xai('grok-4-fast');

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
