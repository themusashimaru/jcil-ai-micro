/**
 * OpenAI Client
 * Wrapper for OpenAI API using Vercel AI SDK
 *
 * Implements (GPT-5 Edition):
 * - gpt-5-nano: Basic chat, greetings, simple Q&A (cost-optimized)
 * - gpt-5-mini: Search, files, complex reasoning, code, AND fallback for nano
 * - DALL-E 3 for image GENERATION only
 * - Web search via OpenAI Responses API
 * - Streaming support
 * - Retry logic with exponential backoff
 * - Auto-escalation: nano errors → retry with mini
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
  shouldEscalateToMini,
  supportsTemperature,
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

// Tools that should always use web search
const WEB_SEARCH_TOOLS: ToolType[] = ['research', 'shopper', 'data'];

// Patterns that indicate need for real-time web information
const WEB_SEARCH_PATTERNS = [
  // Weather - simple location patterns
  /\b(weather|forecast)\s+(in|for|at)\s+\w+/i,
  /\bweather\s+\w+/i,  // "weather LA", "weather london"
  /\b(what'?s|what is|how'?s|how is)\s+(the\s+)?(weather|temp)/i,
  /\b(weather|forecast|temperature|rain|snow|humid|sunny|cloudy)\b.*(today|tomorrow|this week|now|current)/i,

  // News and current events
  /\b(latest|recent|current|today'?s|breaking|new)\s+(news|headlines|updates|events|stories)/i,
  /\b(what'?s|what is)\s+(happening|going on|new)\s+(in|with|at|today)/i,
  /\b(did|has|have)\s+.{0,30}\s+(happen|announce|release|launch)/i,

  // Prices and stocks
  /\b(stock|share|ticker)\s+(price|value)/i,
  /\b(price|cost|how much)\s+(of|is|does|for)\b/i,
  /\b(bitcoin|btc|ethereum|eth|crypto)\s+(price|value)/i,
  /\$[A-Z]{1,5}\b/,  // Stock tickers like $AAPL

  // Sports scores and results
  /\b(score|result|won|lost|win|lose)\s+.{0,20}\s+(game|match|today|yesterday|last night)/i,
  /\b(who won|who'?s winning|final score)/i,

  // Time-sensitive lookups
  /\b(hours|open|closed|schedule|when does|what time)\b.*(today|now|currently)/i,
  /\b(is|are)\s+.{0,20}\s+(open|closed|available)\s*(today|now|right now)?/i,

  // Search intent patterns
  /\b(search|look up|find|google)\s+(for|about)?\s+/i,
  /\b(what'?s|what is|who is|where is)\s+the\s+(latest|newest|current|recent)/i,

  // Real-time data
  /\b(live|real.?time|up.?to.?date|current)\s+(data|info|information|status)/i,
  /\b(exchange rate|currency|convert)\b/i,
  /\b(traffic|delays|road conditions)\b/i,

  // Explicit research requests
  /\b(research|investigate|find out|look into)\b/i,
];

/**
 * Check if content requires web search based on patterns
 */
function contentNeedsWebSearch(content: string): boolean {
  if (!content || content.length < 5) return false;

  return WEB_SEARCH_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Check if tool type or content should use web search
 */
function shouldUseWebSearch(tool?: ToolType, messageContent?: string): boolean {
  // Tool-based check (explicit tool selection)
  if (tool && WEB_SEARCH_TOOLS.includes(tool)) {
    return true;
  }

  // Content-based check (auto-detection for general queries)
  if (messageContent && contentNeedsWebSearch(messageContent)) {
    console.log('[OpenAI] Web search triggered by content pattern');
    return true;
  }

  return false;
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
 * Normalize message format for OpenAI Responses API
 * Responses API expects: 'input_text', 'input_image' (not 'text', 'image')
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeMessageForResponsesAPI(message: any): any {
  const role = message.role;

  // Handle missing or invalid role
  if (!role || !['user', 'assistant', 'system'].includes(role)) {
    return { role: 'user', content: '' };
  }

  // If content is a string, return as input_text format
  if (typeof message.content === 'string') {
    return {
      role,
      content: [{ type: 'input_text', text: message.content }]
    };
  }

  // If content is null/undefined, return empty
  if (!message.content) {
    return { role, content: [{ type: 'input_text', text: '' }] };
  }

  // If content is not an array, convert to string
  if (!Array.isArray(message.content)) {
    return {
      role,
      content: [{ type: 'input_text', text: String(message.content) }]
    };
  }

  // Convert content parts to Responses API format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedContent = message.content.map((part: any) => {
    // Text parts -> input_text
    if (part.type === 'text') {
      return { type: 'input_text', text: part.text || '' };
    }
    // AI SDK image format -> input_image
    if (part.type === 'image' && part.image) {
      // Responses API expects image_url for input_image
      return {
        type: 'input_image',
        image_url: typeof part.image === 'string' ? part.image : part.image.toString(),
      };
    }
    // OpenAI image_url format -> input_image
    if (part.type === 'image_url' && part.image_url?.url) {
      return {
        type: 'input_image',
        image_url: part.image_url.url,
      };
    }
    // input_text already in correct format
    if (part.type === 'input_text') {
      return part;
    }
    // input_image already in correct format
    if (part.type === 'input_image') {
      return part;
    }
    // Try to extract text from unknown parts
    if (part.text) {
      return { type: 'input_text', text: part.text };
    }
    return null;
  }).filter(Boolean);

  if (normalizedContent.length === 0) {
    return { role, content: [{ type: 'input_text', text: '' }] };
  }

  return { role, content: normalizedContent };
}

/**
 * Normalize message format for AI SDK
 * AI SDK expects { type: 'image', image: '...' } - it handles OpenAI conversion internally
 * IMPORTANT: AI SDK is strict - only include role and content, nothing else!
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeMessageForAISDK(message: any): any {
  const role = message.role;

  // Handle missing or invalid role
  if (!role || !['user', 'assistant', 'system'].includes(role)) {
    console.warn('[OpenAI] Invalid message role:', role);
    return { role: 'user', content: '' };
  }

  // If content is a string, return clean message with only role + content
  if (typeof message.content === 'string') {
    return { role, content: message.content };
  }

  // If content is null/undefined, return empty string content
  if (!message.content) {
    return { role, content: '' };
  }

  // If content is not an array, try to convert to string
  if (!Array.isArray(message.content)) {
    return { role, content: String(message.content) };
  }

  // Normalize content parts - ensure images are in AI SDK format
  // AI SDK expects: { type: "image", image: "data:..." or URL or base64 }
  // The SDK will convert to OpenAI format internally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedContent = message.content.map((part: any) => {
    // Handle text parts - only include type and text
    if (part.type === 'text') {
      return { type: 'text', text: part.text || '' };
    }
    // AI SDK image format - pass through data URLs, URLs, or base64
    if (part.type === 'image' && part.image) {
      console.log('[OpenAI] Processing image for AI SDK:', {
        imageType: typeof part.image,
        isDataUrl: typeof part.image === 'string' && part.image.startsWith('data:'),
        isHttpUrl: typeof part.image === 'string' && part.image.startsWith('http'),
        imageLength: typeof part.image === 'string' ? part.image.length : 0,
      });
      // AI SDK handles data URLs, http URLs, and base64 strings
      return {
        type: 'image',
        image: part.image,
      };
    }
    // Convert OpenAI image_url format to AI SDK image format
    if (part.type === 'image_url' && part.image_url?.url) {
      console.log('[OpenAI] Converting image_url to AI SDK format:', {
        urlLength: part.image_url.url?.length || 0,
        isDataUrl: part.image_url.url?.startsWith('data:'),
      });
      return {
        type: 'image',
        image: part.image_url.url,
      };
    }
    // Unknown part type - try to extract text
    if (part.text) {
      return { type: 'text', text: part.text };
    }
    // Skip invalid parts
    return null;
  }).filter(Boolean); // Remove null entries

  // If no valid content parts, return empty string
  if (normalizedContent.length === 0) {
    return { role, content: '' };
  }

  // If only one text part, simplify to string content
  if (normalizedContent.length === 1 && normalizedContent[0].type === 'text') {
    return { role, content: normalizedContent[0].text };
  }

  // Return clean message with only role + content array
  return { role, content: normalizedContent };
}

/**
 * Check if messages contain images
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasImageContent(messages: any[]): boolean {
  const result = messages.some(msg => {
    if (!Array.isArray(msg.content)) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasImage = msg.content.some((item: any) =>
      item.type === 'image_url' || item.type === 'image'
    );
    if (hasImage) {
      console.log('[OpenAI] Found image in message:', {
        role: msg.role,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contentTypes: msg.content.map((c: any) => c.type),
      });
    }
    return hasImage;
  });
  return result;
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
 * GPT-5 Edition routing:
 * - gpt-5-nano: Basic chat, greetings, simple Q&A
 * - gpt-5-mini: Search, files, images, complex reasoning, code
 * - DALL-E 3: Image generation only
 *
 * Escalation triggers (nano → mini):
 * - Images or files present
 * - Search/lookup intent detected
 * - Complex reasoning required
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function determineModel(messages: any[], tool?: ToolType): OpenAIModel {
  const hasImages = hasImageContent(messages);
  const messageText = getLastUserMessageText(messages);

  // First check tool-based routing (includes message content analysis)
  const toolBasedModel = getModelForTool(tool, messageText);

  // If tool routes to DALL-E 3, use it for image generation
  if (toolBasedModel === 'dall-e-3') {
    return toolBasedModel;
  }

  // Check if we need to escalate to mini
  const needsMini = shouldEscalateToMini(hasImages, false, false, messageText);

  console.log('[OpenAI] determineModel:', {
    tool,
    toolBasedModel,
    hasImages,
    needsMini,
    messageTextLength: messageText.length,
  });

  // Images always need mini (vision capability)
  if (hasImages) {
    console.log('[OpenAI] Image content detected - using gpt-5-mini for vision analysis');
    return 'gpt-5-mini';
  }

  // Use content-aware routing result
  if (needsMini) {
    console.log('[OpenAI] Complex content detected - using gpt-5-mini');
    return 'gpt-5-mini';
  }

  // Return the tool-based model (nano for simple, mini for complex)
  return toolBasedModel;
}

/**
 * Create a chat completion with streaming support
 */
export async function createChatCompletion(options: ChatOptions) {
  const { messages, tool, temperature, maxTokens, stream = true } = options;

  // Get the last user message text for routing decisions
  const lastUserText = getLastUserMessageText(messages);

  // Determine the best model
  const modelName = determineModel(messages, tool);

  // Check if we should use web search (tool-based OR content-based)
  const useWebSearch = shouldUseWebSearch(tool, lastUserText);

  console.log('[OpenAI] Using model:', modelName, 'stream:', stream, 'webSearch:', useWebSearch, 'query:', lastUserText?.slice(0, 50));

  // Use Responses API with web search (either tool-based or content-based trigger)
  if (useWebSearch) {
    const triggerReason = tool && WEB_SEARCH_TOOLS.includes(tool) ? `tool: ${tool}` : 'content pattern';
    console.log('[OpenAI] Using Responses API with web search, trigger:', triggerReason);
    return createWebSearchCompletion(options, 'gpt-5-mini'); // Use gpt-5-mini for web search per directive
  }

  // Use non-streaming for image analysis or when explicitly requested
  if (!stream || hasImageContent(messages)) {
    console.log('[OpenAI] Using non-streaming mode for images, model:', modelName);
    return createDirectOpenAICompletion(options, modelName);
  }

  // Streaming mode
  const openai = getOpenAIProvider();
  const model = openai(modelName);

  // Get system prompt and settings
  const systemPrompt = getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();
  const fullSystemPrompt = `${timeContext}\n\n${systemPrompt}`;

  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Convert messages to OpenAI format (handles image URLs)
  const convertedMessages = messages.map(normalizeMessageForAISDK);

  // Build request config - exclude temperature for reasoning models
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestConfig: any = {
    model,
    messages: convertedMessages,
    system: fullSystemPrompt,
    maxTokens: effectiveMaxTokens,
  };

  // Only add temperature for non-reasoning models
  if (supportsTemperature(modelName)) {
    requestConfig.temperature = temperature ?? getRecommendedTemperature(modelName, tool);
  }

  console.log('[OpenAI Streaming] Starting with model:', modelName, 'supportsTemp:', supportsTemperature(modelName));

  return streamText(requestConfig);
}

// Note: Preferred domains for web search are defined in the system prompt
// (see src/lib/openai/tools.ts)
// OpenAI's web_search tool handles domain filtering through system prompts

/**
 * Create completion with web search using OpenAI Responses API
 * Uses gpt-5-mini with web_search tool enabled
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

  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Convert messages to Responses API format (uses input_text, input_image)
  const convertedMessages = messages.map(normalizeMessageForResponsesAPI);

  // Add system message at the beginning (Responses API format)
  const messagesWithSystem = [
    { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
    ...convertedMessages
  ];

  // Extract query for caching (last user message)
  const lastUserMessage = getLastUserMessageText(messages);

  // Build web search tool configuration with preferred domains
  const webSearchTool = {
    type: 'web_search',
    // Note: OpenAI's web_search handles domain preferences through system prompts
    // The domains are included in the system prompt for guidance instead
    // If OpenAI adds domain filtering support, uncomment below:
    // domains: { include: PREFERRED_SEARCH_DOMAINS },
  };

  // Define the fetch function for caching
  const fetchWebSearch = async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        console.log('[OpenAI Web Search] Attempt', attempt + 1, 'with model:', modelName, 'supportsTemp:', supportsTemperature(modelName));

        // Build request body - exclude temperature for reasoning models
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestBody: any = {
          model: modelName,
          input: messagesWithSystem,
          tools: [webSearchTool],
          max_output_tokens: effectiveMaxTokens,
        };

        // Only add temperature for non-reasoning models
        if (supportsTemperature(modelName)) {
          requestBody.temperature = temperature ?? getRecommendedTemperature(modelName, tool);
        }

        // Use the Responses API with web_search tool (with timeouts)
        const response = await httpWithTimeout(`${baseURL}/responses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
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
          model: modelName, // Track actual model used
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

  // Log detailed info about the request for debugging
  const messagesSummary = messages.map((m, i) => ({
    index: i,
    role: m.role,
    hasArrayContent: Array.isArray(m.content),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contentTypes: Array.isArray(m.content) ? m.content.map((c: any) => c.type) : ['string'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    imageDataLength: Array.isArray(m.content) ? m.content.filter((c: any) => c.type === 'image').map((c: any) => c.image?.length || 0) : [],
  }));
  console.log('[OpenAI Direct] Creating completion:', {
    model: modelName,
    tool,
    messageCount: messages.length,
    messagesSummary,
  });

  const openai = getOpenAIProvider();
  const model = openai(modelName);

  // Get configuration
  const baseSystemPrompt = getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();
  const systemPrompt = `${timeContext}\n\n${baseSystemPrompt}`;

  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Convert messages to OpenAI format (handles image URLs)
  const convertedMessages = messages.map(normalizeMessageForAISDK);

  // Log converted messages to verify images are preserved
  const convertedSummary = convertedMessages.map((m, i) => ({
    index: i,
    role: m.role,
    hasArrayContent: Array.isArray(m.content),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contentTypes: Array.isArray(m.content) ? m.content.map((c: any) => c.type) : 'string',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    imageDataLength: Array.isArray(m.content) ? m.content.filter((c: any) => c.type === 'image').map((c: any) => c.image?.length || 0) : [],
  }));
  console.log('[OpenAI Direct] Converted messages:', convertedSummary);

  // Retry loop
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      console.log('[OpenAI API] Attempt', attempt + 1, 'with model:', modelName, 'supportsTemp:', supportsTemperature(modelName));

      // Build request config - exclude temperature for reasoning models
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generateConfig: any = {
        model,
        messages: convertedMessages,
        system: systemPrompt,
        maxOutputTokens: effectiveMaxTokens,
      };

      // Only add temperature for non-reasoning models
      if (supportsTemperature(modelName)) {
        generateConfig.temperature = temperature ?? getRecommendedTemperature(modelName, tool);
      }

      const result = await generateText(generateConfig);

      return {
        text: result.text,
        finishReason: result.finishReason,
        usage: result.usage,
        citations: [], // OpenAI doesn't have built-in citations
        numSourcesUsed: 0,
        model: modelName, // Track actual model used
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

      // If it's a gpt-5-nano error, escalate to gpt-5-mini (our fallback model)
      if (modelName === 'gpt-5-nano') {
        console.log('[OpenAI API] Nano failed - escalating to gpt-5-mini');
        return createDirectOpenAICompletion(
          options,
          'gpt-5-mini'
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
 * Analyze an image using gpt-5-mini vision
 * Per directive: ALL chat tasks use gpt-5-mini, including image analysis
 */
export async function analyzeImage(imageUrl: string, question: string) {
  const openai = getOpenAIProvider();
  const model = openai('gpt-5-mini');

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

// Export routing helpers for accurate model tracking in API routes
export { shouldUseWebSearch, getLastUserMessageText };
