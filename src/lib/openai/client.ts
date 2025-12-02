/**
 * OpenAI Client
 * Wrapper for OpenAI API using Vercel AI SDK
 *
 * Implements:
 * - GPT-4o for complex tasks, images, coding, web search
 * - GPT-4o-mini for lightweight chat (default)
 * - DALL-E 3 for image generation
 * - Web search via OpenAI Responses API
 * - Streaming support
 * - Retry logic with exponential backoff
 * - Timeouts (30s request, 5s connect)
 * - Structured logging with telemetry
 * - Web search caching (30 min TTL)
 */

import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import {
  getModelForTool,
  getRecommendedTemperature,
  getMaxTokens,
  shouldUseGPT4o,
  isImageGenerationRequest,
} from './models';
import { getSystemPromptForTool } from './tools';
import type { ToolType, OpenAIModel } from './types';
import { httpWithTimeout } from '../http';
import { logEvent, logImageGeneration } from '../log';
import { cachedWebSearch } from '../cache';

// Retry configuration
const RETRY_DELAYS = [250, 1000, 3000]; // Exponential backoff
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

// Timeout configuration (per directive §0)
const REQUEST_TIMEOUT_MS = 30_000; // 30 seconds
const CONNECT_TIMEOUT_MS = 5_000;  // 5 seconds

// Tools that should use web search
const WEB_SEARCH_TOOLS: ToolType[] = ['research', 'shopper', 'data'];

/**
 * Check if tool type should use web search
 */
function shouldUseWebSearch(tool?: ToolType): boolean {
  if (!tool) return false;
  return WEB_SEARCH_TOOLS.includes(tool);
}

interface ChatOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  tool?: ToolType;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  userId?: string; // For logging and usage tracking
}

/**
 * Get OpenAI API key from environment
 */
function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * Get configured OpenAI provider
 */
function getOpenAIProvider() {
  const apiKey = getOpenAIApiKey();
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  return createOpenAI({
    apiKey,
    baseURL,
  });
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get current time context string to inject into system prompt
 */
function getCurrentTimeContext(): string {
  const now = new Date();

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
  const utcTime = now.toUTCString();

  return `CURRENT DATE AND TIME (ACCURATE - USE THIS):
Today is ${estTime}
Other US timezones: ${cstTime} | ${pstTime}
UTC: ${utcTime}

IMPORTANT: Use these times as your reference for any time-related questions.`;
}

/**
 * Convert message format for OpenAI (handle image URLs)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertMessageForOpenAI(message: any): any {
  if (!Array.isArray(message.content)) {
    return message;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convertedContent = message.content.map((part: any) => {
    // Convert Vercel AI SDK image format to OpenAI format
    if (part.type === 'image' && part.image) {
      return {
        type: 'image_url',
        image_url: {
          url: part.image,
          detail: 'high',
        },
      };
    }
    return part;
  });

  return {
    ...message,
    content: convertedContent,
  };
}

/**
 * Check if messages contain images
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasImageContent(messages: any[]): boolean {
  return messages.some(msg =>
    Array.isArray(msg.content) &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    msg.content.some((item: any) =>
      item.type === 'image_url' || item.type === 'image'
    )
  );
}

/**
 * Extract text content from last user message
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLastUserMessageText(messages: any[]): string {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUserMessage) return '';

  if (typeof lastUserMessage.content === 'string') {
    return lastUserMessage.content;
  }

  if (Array.isArray(lastUserMessage.content)) {
    return lastUserMessage.content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((part: any) => part.type === 'text')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((part: any) => part.text || '')
      .join(' ');
  }

  return '';
}

/**
 * Determine the best model based on content and tool
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function determineModel(messages: any[], tool?: ToolType): OpenAIModel {
  // First check tool-based routing
  const toolBasedModel = getModelForTool(tool);

  // If tool already routes to gpt-4o, use it
  if (toolBasedModel === 'gpt-4o' || toolBasedModel === 'dall-e-3') {
    return toolBasedModel;
  }

  // Check content-based routing
  const hasImages = hasImageContent(messages);
  const messageText = getLastUserMessageText(messages);

  if (shouldUseGPT4o(hasImages, false, false, messageText)) {
    return 'gpt-4o';
  }

  // Default to mini
  return 'gpt-4o-mini';
}

/**
 * Create a chat completion with streaming support
 */
export async function createChatCompletion(options: ChatOptions) {
  const { messages, tool, temperature, maxTokens, stream = true } = options;

  // Determine the best model
  const modelName = determineModel(messages, tool);

  // Check if we should use web search
  const useWebSearch = shouldUseWebSearch(tool);

  console.log('[OpenAI] Using model:', modelName, 'stream:', stream, 'webSearch:', useWebSearch);

  // Use Responses API with web search for research/shopper/data tools
  if (useWebSearch) {
    console.log('[OpenAI] Using Responses API with web search for tool:', tool);
    return createWebSearchCompletion(options, 'gpt-4o'); // Always use gpt-4o for web search
  }

  // Use non-streaming for image analysis or when explicitly requested
  if (!stream || hasImageContent(messages)) {
    return createDirectOpenAICompletion(options, modelName);
  }

  // Streaming mode
  const openai = getOpenAIProvider();
  const model = openai(modelName);

  // Get system prompt and settings
  const systemPrompt = getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();
  const fullSystemPrompt = `${timeContext}\n\n${systemPrompt}`;

  const effectiveTemperature = temperature ?? getRecommendedTemperature(modelName, tool);
  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  const requestConfig = {
    model,
    messages,
    system: fullSystemPrompt,
    temperature: effectiveTemperature,
    maxTokens: effectiveMaxTokens,
  };

  console.log('[OpenAI Streaming] Starting with model:', modelName);

  return streamText(requestConfig);
}

/**
 * Create completion with web search using OpenAI Responses API
 * Uses gpt-4o with web_search tool enabled
 * Includes caching for repeated queries (30 min TTL)
 */
async function createWebSearchCompletion(
  options: ChatOptions,
  modelName: OpenAIModel
) {
  const { messages, tool, temperature, maxTokens, userId } = options;
  const apiKey = getOpenAIApiKey();
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const startTime = Date.now();

  // Get configuration
  const baseSystemPrompt = getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();
  const systemPrompt = `${timeContext}\n\n${baseSystemPrompt}`;

  const effectiveTemperature = temperature ?? getRecommendedTemperature(modelName, tool);
  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Convert messages to OpenAI format
  const convertedMessages = messages.map(convertMessageForOpenAI);

  // Add system message at the beginning
  const messagesWithSystem = [
    { role: 'system', content: systemPrompt },
    ...convertedMessages
  ];

  // Extract query for caching (last user message)
  const lastUserMessage = getLastUserMessageText(messages);

  // Define the fetch function for caching
  const fetchWebSearch = async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        console.log('[OpenAI Web Search] Attempt', attempt + 1, 'with model:', modelName);

        // Use the Responses API with web_search tool (with timeouts)
        const response = await httpWithTimeout(`${baseURL}/responses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            input: messagesWithSystem,
            tools: [{ type: 'web_search' }],
            temperature: effectiveTemperature,
            max_output_tokens: effectiveMaxTokens,
          }),
          timeoutMs: REQUEST_TIMEOUT_MS,
          connectTimeoutMs: CONNECT_TIMEOUT_MS,
        });

        if (!response.ok) {
          const errorText = await response.text();
          const statusCode = response.status;

          console.error('[OpenAI Web Search] Error response:', statusCode, errorText);

          if (RETRYABLE_STATUS_CODES.includes(statusCode) && attempt < RETRY_DELAYS.length) {
            const delay = RETRY_DELAYS[attempt];
            console.log(`[OpenAI Web Search] Retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }

          throw new Error(`OpenAI Responses API error (${statusCode}): ${errorText}`);
        }

        const data = await response.json();

        // Extract text and citations from response
        let responseText = '';
        const citations: Array<{ url: string; title: string }> = [];

        // Parse the response output
        if (data.output) {
          for (const item of data.output) {
            if (item.type === 'message' && item.content) {
              for (const content of item.content) {
                if (content.type === 'output_text') {
                  responseText += content.text;
                }
                // Extract annotations/citations
                if (content.annotations) {
                  for (const annotation of content.annotations) {
                    if (annotation.type === 'url_citation') {
                      citations.push({
                        url: annotation.url,
                        title: annotation.title || annotation.url,
                      });
                    }
                  }
                }
              }
            }
          }
        }

        console.log('[OpenAI Web Search] Success, citations found:', citations.length);

        return {
          text: responseText,
          finishReason: 'stop',
          usage: data.usage || {},
          citations: citations,
          numSourcesUsed: citations.length,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error('[OpenAI Web Search] Error:', lastError.message);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statusCode = (error as any)?.status || (error as any)?.statusCode;

        if (statusCode && RETRYABLE_STATUS_CODES.includes(statusCode) && attempt < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[attempt];
          console.log(`[OpenAI Web Search] Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  };

  try {
    // Try to get cached result first (30 min TTL)
    const { data: result, cached } = await cachedWebSearch(lastUserMessage, fetchWebSearch, 1800);

    // Log the request
    logEvent({
      user_id: userId,
      model: modelName,
      tool_name: tool,
      tokens_in: result.usage?.prompt_tokens,
      tokens_out: result.usage?.completion_tokens,
      latency_ms: Date.now() - startTime,
      ok: true,
      web_search: true,
      cached,
    });

    return result;
  } catch (error) {
    // Log the error
    logEvent({
      user_id: userId,
      model: modelName,
      tool_name: tool,
      latency_ms: Date.now() - startTime,
      ok: false,
      err_code: 'WEB_SEARCH_FAILED',
      err_message: error instanceof Error ? error.message : String(error),
      web_search: true,
    });

    // Fall back to regular completion without web search
    console.log('[OpenAI Web Search] Falling back to regular completion');
    return createDirectOpenAICompletion(options, modelName);
  }
}

/**
 * Direct OpenAI API call for non-streaming requests
 * Includes retry logic with exponential backoff
 */
async function createDirectOpenAICompletion(
  options: ChatOptions,
  modelName: OpenAIModel
) {
  const { messages, tool, temperature, maxTokens } = options;

  const openai = getOpenAIProvider();
  const model = openai(modelName);

  // Get configuration
  const baseSystemPrompt = getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();
  const systemPrompt = `${timeContext}\n\n${baseSystemPrompt}`;

  const effectiveTemperature = temperature ?? getRecommendedTemperature(modelName, tool);
  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Convert messages to OpenAI format
  const convertedMessages = messages.map(convertMessageForOpenAI);

  // Retry loop
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      console.log('[OpenAI API] Attempt', attempt + 1, 'with model:', modelName);

      const result = await generateText({
        model,
        messages: convertedMessages,
        system: systemPrompt,
        temperature: effectiveTemperature,
        maxTokens: effectiveMaxTokens,
      });

      return {
        text: result.text,
        finishReason: result.finishReason,
        usage: result.usage,
        citations: [], // OpenAI doesn't have built-in citations
        numSourcesUsed: 0,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error('[OpenAI API] Error:', lastError.message);

      // Check if we should retry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statusCode = (error as any)?.status || (error as any)?.statusCode;

      if (statusCode && RETRYABLE_STATUS_CODES.includes(statusCode) && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`[OpenAI API] Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      // If it's a 4o error, try falling back to mini (only for text-only requests)
      if (modelName === 'gpt-4o' && !hasImageContent(messages)) {
        console.log('[OpenAI API] Falling back to gpt-4o-mini');
        return createDirectOpenAICompletion(
          options,
          'gpt-4o-mini'
        );
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Generate an image using DALL-E 3
 * Logs image generation separately for billing
 */
export async function generateImage(
  prompt: string,
  size: '1024x1024' | '512x512' | '256x256' = '1024x1024',
  userId?: string
): Promise<string> {
  const apiKey = getOpenAIApiKey();
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const startTime = Date.now();

  // Image costs (approximate)
  const imageCosts: Record<string, number> = {
    '1024x1024': 0.04,
    '512x512': 0.018,
    '256x256': 0.016,
  };

  // Retry loop
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await httpWithTimeout(`${baseURL}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size,
        }),
        timeoutMs: 60_000, // 60s for image generation
        connectTimeoutMs: CONNECT_TIMEOUT_MS,
      });

      if (!response.ok) {
        const error = await response.text();
        const statusCode = response.status;

        if (RETRYABLE_STATUS_CODES.includes(statusCode) && attempt < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[attempt];
          console.log(`[DALL-E 3] Retrying in ${delay}ms... (status: ${statusCode})`);
          await sleep(delay);
          continue;
        }

        throw new Error(`DALL-E 3 error (${statusCode}): ${error}`);
      }

      const data = await response.json();
      const imageUrl = data.data[0]?.url || null;

      // Log successful image generation
      logImageGeneration(
        userId || 'anonymous',
        'dall-e-3',
        size,
        imageCosts[size] || 0.04,
        true,
        Date.now() - startTime
      );

      return imageUrl;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error('[DALL-E 3] Error:', lastError.message);

      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        await sleep(delay);
        continue;
      }
    }
  }

  // Log failed image generation
  logImageGeneration(
    userId || 'anonymous',
    'dall-e-3',
    size,
    0,
    false,
    Date.now() - startTime
  );

  throw lastError || new Error('Image generation failed after retries');
}

/**
 * Analyze an image using GPT-4o vision
 */
export async function analyzeImage(imageUrl: string, question: string) {
  const openai = getOpenAIProvider();
  const model = openai('gpt-4o');

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

// Re-export helper functions
export { isImageGenerationRequest } from './models';
