/**
 * GEMINI CLIENT
 *
 * PURPOSE:
 * - Provide Google Gemini AI chat completion functionality
 * - Support streaming responses
 * - Native vision/image support
 * - Native Google Search grounding (automatic search when needed)
 * - Full document generation support
 *
 * FEATURES:
 * - Dual-pool round-robin API key system (same as other providers)
 * - Dynamic key detection (GEMINI_API_KEY_1, _2, _3, ... unlimited)
 * - Fallback pool (GEMINI_API_KEY_FALLBACK_1, _2, ... unlimited)
 * - Rate limit handling with automatic key rotation
 * - Native Google Search grounding (model decides when to search)
 * - Streaming text responses
 * - Native multimodal support (images, files)
 */

import { GoogleGenAI } from '@google/genai';
import { CoreMessage } from 'ai';
import { getSystemPromptForTool } from '../openai/tools';
import type { ToolType } from '../openai/types';

// Default model: Gemini 2.0 Flash (fast, cost-effective, supports grounding)
const DEFAULT_MODEL = 'gemini-2.0-flash';

// ========================================
// DUAL-POOL API KEY SYSTEM (DYNAMIC)
// ========================================
// Primary Pool: Round-robin load distribution (GEMINI_API_KEY_1, _2, _3, ... unlimited)
// Fallback Pool: Emergency reserve (GEMINI_API_KEY_FALLBACK_1, _2, _3, ... unlimited)
// Backward Compatible: Single GEMINI_API_KEY still works
// NO HARDCODED LIMITS - just add keys and they're automatically detected!

interface ApiKeyState {
  key: string;
  rateLimitedUntil: number; // Timestamp when rate limit expires (0 = not limited)
  pool: 'primary' | 'fallback';
  index: number; // Position within its pool
  client: GoogleGenAI | null; // Cached client instance for this key
}

// Separate pools for better management
const primaryPool: ApiKeyState[] = [];
const fallbackPool: ApiKeyState[] = [];
let primaryKeyIndex = 0; // Round-robin index for primary pool
let fallbackKeyIndex = 0; // Round-robin index for fallback pool
let initialized = false;

/**
 * Initialize all available Gemini API keys into their pools
 * FULLY DYNAMIC: Automatically detects ALL configured keys - no limits!
 */
function initializeApiKeys(): void {
  if (initialized) return;
  initialized = true;

  // Dynamically detect ALL numbered primary keys (no limit!)
  // Try both naming conventions: GOOGLE_GENERATIVE_AI_API_KEY_X and GEMINI_API_KEY_X
  let i = 1;
  while (true) {
    const key = process.env[`GOOGLE_GENERATIVE_AI_API_KEY_${i}`] || process.env[`GEMINI_API_KEY_${i}`];
    if (!key) break; // Stop when we hit a gap

    primaryPool.push({
      key,
      rateLimitedUntil: 0,
      pool: 'primary',
      index: i,
      client: null,
    });
    i++;
  }

  // If no numbered keys found, fall back to single key (try both naming conventions)
  if (primaryPool.length === 0) {
    const singleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (singleKey) {
      primaryPool.push({
        key: singleKey,
        rateLimitedUntil: 0,
        pool: 'primary',
        index: 0,
        client: null,
      });
    }
  }

  // Dynamically detect ALL fallback keys (no limit!)
  let j = 1;
  while (true) {
    const key = process.env[`GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK_${j}`] || process.env[`GEMINI_API_KEY_FALLBACK_${j}`];
    if (!key) break; // Stop when we hit a gap

    fallbackPool.push({
      key,
      rateLimitedUntil: 0,
      pool: 'fallback',
      index: j,
      client: null,
    });
    j++;
  }

  // Log the detected configuration
  const totalKeys = primaryPool.length + fallbackPool.length;
  if (totalKeys > 0) {
    console.log(`[Gemini] Initialized dual-pool system (dynamic detection):`);
    console.log(`[Gemini]   Primary pool: ${primaryPool.length} key(s) (round-robin load distribution)`);
    console.log(`[Gemini]   Fallback pool: ${fallbackPool.length} key(s) (emergency reserve)`);
  }
}

/**
 * Get an available key state from the primary pool (round-robin)
 */
function getAvailablePrimaryKey(): ApiKeyState | null {
  initializeApiKeys();

  if (primaryPool.length === 0) return null;

  const now = Date.now();
  const startIndex = primaryKeyIndex;

  // Try round-robin through primary pool
  do {
    const keyState = primaryPool[primaryKeyIndex];
    primaryKeyIndex = (primaryKeyIndex + 1) % primaryPool.length;

    // Check if not rate limited
    if (keyState.rateLimitedUntil <= now) {
      return keyState;
    }
  } while (primaryKeyIndex !== startIndex);

  return null; // All primary keys are rate limited
}

/**
 * Get an available key state from the fallback pool (round-robin)
 */
function getAvailableFallbackKey(): ApiKeyState | null {
  if (fallbackPool.length === 0) return null;

  const now = Date.now();
  const startIndex = fallbackKeyIndex;

  // Try round-robin through fallback pool
  do {
    const keyState = fallbackPool[fallbackKeyIndex];
    fallbackKeyIndex = (fallbackKeyIndex + 1) % fallbackPool.length;

    // Check if not rate limited
    if (keyState.rateLimitedUntil <= now) {
      return keyState;
    }
  } while (fallbackKeyIndex !== startIndex);

  return null; // All fallback keys are rate limited
}

/**
 * Get the current API key (tries primary first, then fallback)
 */
function getCurrentApiKey(): string | null {
  const primaryKey = getAvailablePrimaryKey();
  if (primaryKey) return primaryKey.key;

  const fallbackKey = getAvailableFallbackKey();
  if (fallbackKey) return fallbackKey.key;

  return null;
}

/**
 * Get a Gemini client with the current API key
 */
function getGeminiClient(): GoogleGenAI {
  initializeApiKeys();

  // Try primary pool first
  const primaryKey = getAvailablePrimaryKey();
  if (primaryKey) {
    if (!primaryKey.client) {
      primaryKey.client = new GoogleGenAI({ apiKey: primaryKey.key });
    }
    return primaryKey.client;
  }

  // Fall back to fallback pool
  const fallbackKey = getAvailableFallbackKey();
  if (fallbackKey) {
    if (!fallbackKey.client) {
      fallbackKey.client = new GoogleGenAI({ apiKey: fallbackKey.key });
    }
    return fallbackKey.client;
  }

  throw new Error('No Gemini API key available');
}

/**
 * Mark a key as rate limited
 */
function markKeyRateLimited(key: string, retryAfterSeconds: number): void {
  const allKeys = [...primaryPool, ...fallbackPool];
  const keyState = allKeys.find(k => k.key === key);
  if (keyState) {
    keyState.rateLimitedUntil = Date.now() + retryAfterSeconds * 1000;
    console.log(`[Gemini] Key ${keyState.pool}[${keyState.index}] rate limited for ${retryAfterSeconds}s`);
  }
}

/**
 * Get current time context for system prompt
 */
function getCurrentTimeContext(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  };
  return `Current date and time: ${now.toLocaleDateString('en-US', options)}`;
}

// Content types for the new SDK
interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/**
 * Convert CoreMessage to Gemini Content format (new SDK)
 */
function convertToGeminiMessages(messages: CoreMessage[], systemPrompt: string): { contents: GeminiContent[]; systemInstruction: string } {
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      // System messages go into systemInstruction
      continue;
    }

    const role: 'user' | 'model' = message.role === 'assistant' ? 'model' : 'user';
    const parts: GeminiPart[] = [];

    if (typeof message.content === 'string') {
      parts.push({ text: message.content });
    } else if (Array.isArray(message.content)) {
      // Handle multimodal content
      for (const part of message.content) {
        if (part.type === 'text') {
          parts.push({ text: part.text });
        } else if (part.type === 'image') {
          // Handle image content
          const imageUrl = typeof part.image === 'string' ? part.image : '';
          if (imageUrl.startsWith('data:')) {
            // Base64 image
            const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              parts.push({
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2],
                },
              });
            }
          } else if (imageUrl) {
            // URL image - include as text reference for now
            parts.push({ text: `[Image: ${imageUrl}]` });
          }
        }
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  return { contents, systemInstruction: systemPrompt };
}

// ========================================
// CHAT COMPLETION INTERFACES
// ========================================

export interface GeminiChatOptions {
  messages: CoreMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
  tool?: ToolType;
  userId?: string;
  planKey?: string;
  enableSearch?: boolean; // Enable Google Search grounding
}

/**
 * Create a non-streaming chat completion using Gemini
 * With optional Google Search grounding for real-time information
 */
export async function createGeminiCompletion(options: GeminiChatOptions): Promise<{
  text: string;
  model: string;
  groundingMetadata?: {
    searchEntryPoint?: { renderedContent?: string };
    groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    webSearchQueries?: string[];
  };
}> {
  const {
    messages,
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt,
    tool,
    enableSearch = false, // Default to false for document generation
  } = options;

  const selectedModel = model || DEFAULT_MODEL;

  const client = getGeminiClient();
  const currentKey = getCurrentApiKey();

  // Build system prompt
  const baseSystemPrompt = systemPrompt || getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();
  const fullSystemPrompt = `${baseSystemPrompt}\n\n---\n\n${timeContext}`;

  // Convert messages
  const { contents, systemInstruction } = convertToGeminiMessages(messages, fullSystemPrompt);

  console.log('[Gemini] Creating completion with model:', selectedModel, 'search:', enableSearch);

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Gemini] Retry attempt ${attempt + 1}/${maxRetries}`);
      }

      // Build config with optional Google Search grounding and safety settings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = {
        maxOutputTokens: maxTokens,
        temperature,
        systemInstruction,
        // Native safety settings - replaces OpenAI moderation for Gemini
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      };

      // Enable built-in tools (multi-tool use supported)
      // - Google Search: real-time web info, news, facts
      // - Code Execution: runs Python for math, data analysis, charts
      if (enableSearch) {
        config.tools = [
          { googleSearch: {} },
          { codeExecution: {} },
        ];
      }

      const response = await client.models.generateContent({
        model: selectedModel,
        contents,
        config,
      });

      const text = response.text || '';

      // Extract grounding metadata if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candidate = (response as any).candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;

      if (groundingMetadata?.webSearchQueries?.length > 0) {
        console.log('[Gemini] Used Google Search for:', groundingMetadata.webSearchQueries);
      }

      return {
        text,
        model: selectedModel,
        groundingMetadata,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check for rate limit error
      const isRateLimit = lastError.message.includes('rate_limit') ||
                          lastError.message.includes('429') ||
                          lastError.message.includes('RESOURCE_EXHAUSTED') ||
                          lastError.message.toLowerCase().includes('too many requests');

      if (isRateLimit && currentKey) {
        // Extract retry-after if available, default to 60 seconds
        const retryMatch = lastError.message.match(/retry.?after[:\s]*(\d+)/i);
        const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 60;

        markKeyRateLimited(currentKey, retryAfter);

        if (attempt < maxRetries - 1) {
          console.log(`[Gemini] Rate limited, trying next key...`);
          continue;
        }
      }

      // For non-rate-limit errors or last attempt, throw
      if (attempt === maxRetries - 1) {
        console.error('[Gemini] Chat completion error (all retries exhausted):', lastError);
        throw lastError;
      }

      console.error(`[Gemini] Error on attempt ${attempt + 1}, retrying:`, lastError.message);
    }
  }

  throw lastError || new Error('All Gemini API keys exhausted');
}

/**
 * Create a streaming chat completion using Gemini
 * With optional Google Search grounding for real-time information
 */
export async function createGeminiStreamingCompletion(options: GeminiChatOptions): Promise<{
  stream: ReadableStream<Uint8Array>;
  model: string;
}> {
  const {
    messages,
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt,
    tool,
    enableSearch = true, // Default to true for chat - auto search when needed
  } = options;

  const selectedModel = model || DEFAULT_MODEL;

  const client = getGeminiClient();

  // Build system prompt
  const baseSystemPrompt = systemPrompt || getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();

  // If search is enabled, add guidance about using it
  const searchGuidance = enableSearch ? `
You have access to Google Search to find current information. Use it when:
- User asks about recent events, news, or current information
- User needs to fact-check something
- User asks about topics that may have changed since your knowledge cutoff
- User explicitly asks you to search or look something up

When you use search, naturally incorporate the information into your response.` : '';

  const fullSystemPrompt = `${baseSystemPrompt}${searchGuidance}\n\n---\n\n${timeContext}`;

  // Convert messages
  const { contents, systemInstruction } = convertToGeminiMessages(messages, fullSystemPrompt);

  console.log('[Gemini] Creating streaming completion with model:', selectedModel, 'search:', enableSearch);

  // Build config with optional Google Search grounding and safety settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    maxOutputTokens: maxTokens,
    temperature,
    systemInstruction,
    // Native safety settings - replaces OpenAI moderation for Gemini
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  // Enable built-in tools (multi-tool use supported)
  // - Google Search: real-time web info, news, facts
  // - Code Execution: runs Python for math, data analysis, charts
  if (enableSearch) {
    config.tools = [
      { googleSearch: {} },
      { codeExecution: {} },
    ];
  }

  const response = await client.models.generateContentStream({
    model: selectedModel,
    contents,
    config,
  });

  // Create a TransformStream to convert Gemini stream to text stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of response) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        console.error('[Gemini] Streaming error:', error);
        // Send a graceful error message to the user instead of crashing
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isRateLimit = errorMessage.includes('rate_limit') ||
                           errorMessage.includes('429') ||
                           errorMessage.includes('RESOURCE_EXHAUSTED');
        const userMessage = isRateLimit
          ? '\n\n*[Response interrupted: Rate limit reached. Please try again in a moment.]*'
          : '\n\n*[Response interrupted: Connection error. Please try again.]*';
        controller.enqueue(encoder.encode(userMessage));
        controller.close();
      }
    }
  });

  return {
    stream,
    model: selectedModel,
  };
}

/**
 * Check if Gemini is configured
 */
export function isGeminiConfigured(): boolean {
  initializeApiKeys();
  return primaryPool.length > 0 || fallbackPool.length > 0;
}

// ========================================
// STRUCTURED OUTPUTS (JSON Schema)
// ========================================

/**
 * Create a structured output completion using Gemini
 * Uses response_mime_type: "application/json" for guaranteed valid JSON
 */
export async function createGeminiStructuredCompletion<T>(options: {
  messages: CoreMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  schema: object; // JSON Schema
  schemaDescription?: string;
}): Promise<{
  data: T;
  model: string;
}> {
  const {
    messages,
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    temperature = 0.5, // Lower temperature for more consistent structured output
    systemPrompt,
    schema,
    schemaDescription,
  } = options;

  const selectedModel = model || DEFAULT_MODEL;
  const client = getGeminiClient();
  const currentKey = getCurrentApiKey();

  // Build system prompt with schema context
  const timeContext = getCurrentTimeContext();
  const schemaContext = schemaDescription
    ? `\n\n${schemaDescription}\n\nGenerate a response that matches the provided JSON schema.`
    : '\n\nGenerate a response that matches the provided JSON schema.';

  const fullSystemPrompt = systemPrompt
    ? `${systemPrompt}${schemaContext}\n\n---\n\n${timeContext}`
    : `You are a helpful assistant that generates structured JSON output.${schemaContext}\n\n---\n\n${timeContext}`;

  // Convert messages
  const { contents, systemInstruction } = convertToGeminiMessages(messages, fullSystemPrompt);

  console.log('[Gemini] Creating structured completion with model:', selectedModel);

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Gemini] Structured output retry attempt ${attempt + 1}/${maxRetries}`);
      }

      // Build config with JSON response format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = {
        maxOutputTokens: maxTokens,
        temperature,
        systemInstruction,
        // Enable structured output - guarantees valid JSON
        responseMimeType: 'application/json',
        responseSchema: schema,
        // Native safety settings
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      };

      const response = await client.models.generateContent({
        model: selectedModel,
        contents,
        config,
      });

      const text = response.text || '';

      // Parse the JSON response
      let data: T;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('[Gemini] Failed to parse structured output:', parseError);
        console.error('[Gemini] Raw response:', text.substring(0, 500));
        throw new Error('Failed to parse structured output as JSON');
      }

      console.log('[Gemini] Structured output generated successfully');

      return {
        data,
        model: selectedModel,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check for rate limit error
      const isRateLimit = lastError.message.includes('rate_limit') ||
                          lastError.message.includes('429') ||
                          lastError.message.includes('RESOURCE_EXHAUSTED') ||
                          lastError.message.toLowerCase().includes('too many requests');

      if (isRateLimit && currentKey) {
        const retryMatch = lastError.message.match(/retry.?after[:\s]*(\d+)/i);
        const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 60;
        markKeyRateLimited(currentKey, retryAfter);

        if (attempt < maxRetries - 1) {
          console.log(`[Gemini] Rate limited, trying next key...`);
          continue;
        }
      }

      if (attempt === maxRetries - 1) {
        console.error('[Gemini] Structured completion error (all retries exhausted):', lastError);
        throw lastError;
      }

      console.error(`[Gemini] Structured error on attempt ${attempt + 1}, retrying:`, lastError.message);
    }
  }

  throw lastError || new Error('All Gemini API keys exhausted');
}

// ========================================
// DOCUMENT GENERATION SCHEMAS
// ========================================

/**
 * JSON Schema for Resume document generation
 */
export const RESUME_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['resume'] },
    name: { type: 'string', description: 'Full name of the person' },
    contact: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        email: { type: 'string' },
        linkedin: { type: 'string' },
        website: { type: 'string' },
        location: { type: 'string', description: 'City and State only' },
      },
    },
    summary: { type: 'string', description: 'Professional summary (2-3 sentences)' },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          company: { type: 'string' },
          location: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'company', 'bullets'],
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          degree: { type: 'string' },
          school: { type: 'string' },
          location: { type: 'string' },
          graduationDate: { type: 'string' },
          gpa: { type: 'string' },
          honors: { type: 'array', items: { type: 'string' } },
        },
        required: ['degree', 'school'],
      },
    },
    skills: { type: 'array', items: { type: 'string' } },
    certifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          issuer: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  required: ['type', 'name', 'experience', 'education'],
};

/**
 * JSON Schema for Spreadsheet document generation
 */
export const SPREADSHEET_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['spreadsheet'] },
    title: { type: 'string' },
    sheets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                isHeader: { type: 'boolean' },
                cells: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      value: { type: ['string', 'number', 'null'] },
                      bold: { type: 'boolean' },
                      italic: { type: 'boolean' },
                      currency: { type: 'boolean' },
                      percent: { type: 'boolean' },
                      formula: { type: 'string' },
                      backgroundColor: { type: 'string' },
                      textColor: { type: 'string' },
                      alignment: { type: 'string', enum: ['left', 'center', 'right'] },
                    },
                  },
                },
              },
              required: ['cells'],
            },
          },
          freezeRow: { type: 'integer' },
          columnWidths: { type: 'array', items: { type: 'number' } },
        },
        required: ['name', 'rows'],
      },
    },
    format: {
      type: 'object',
      properties: {
        alternatingRowColors: { type: 'boolean' },
        headerColor: { type: 'string' },
      },
    },
  },
  required: ['type', 'title', 'sheets'],
};

/**
 * JSON Schema for Word Document generation
 */
export const DOCUMENT_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['document'] },
    title: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['paragraph', 'table', 'pageBreak', 'horizontalRule'] },
          content: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              style: { type: 'string', enum: ['normal', 'heading1', 'heading2', 'heading3', 'title', 'subtitle'] },
              bold: { type: 'boolean' },
              italic: { type: 'boolean' },
              alignment: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
              bulletLevel: { type: 'integer' },
              headers: { type: 'array', items: { type: 'string' } },
              rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
        required: ['type'],
      },
    },
    format: {
      type: 'object',
      properties: {
        fontFamily: { type: 'string' },
        fontSize: { type: 'number' },
        headerText: { type: 'string' },
        footerText: { type: 'string' },
      },
    },
  },
  required: ['type', 'title', 'sections'],
};

/**
 * JSON Schema for Invoice document generation
 */
export const INVOICE_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['invoice'] },
    invoiceNumber: { type: 'string' },
    date: { type: 'string' },
    dueDate: { type: 'string' },
    from: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: { type: 'array', items: { type: 'string' } },
        phone: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['name'],
    },
    to: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: { type: 'array', items: { type: 'string' } },
        phone: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['name'],
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          total: { type: 'number' },
        },
        required: ['description', 'quantity', 'unitPrice'],
      },
    },
    subtotal: { type: 'number' },
    taxRate: { type: 'number' },
    tax: { type: 'number' },
    total: { type: 'number' },
    notes: { type: 'string' },
    paymentTerms: { type: 'string' },
    format: {
      type: 'object',
      properties: {
        primaryColor: { type: 'string' },
        currency: { type: 'string' },
      },
    },
  },
  required: ['type', 'invoiceNumber', 'date', 'from', 'to', 'items', 'total'],
};

/**
 * Get the appropriate schema for a document type
 */
export function getDocumentSchema(docType: 'resume' | 'spreadsheet' | 'document' | 'invoice'): object {
  const schemas: Record<string, object> = {
    resume: RESUME_SCHEMA,
    spreadsheet: SPREADSHEET_SCHEMA,
    document: DOCUMENT_SCHEMA,
    invoice: INVOICE_SCHEMA,
  };
  return schemas[docType] || DOCUMENT_SCHEMA;
}

/**
 * Get schema description/prompt for a document type
 */
export function getDocumentSchemaDescription(docType: 'resume' | 'spreadsheet' | 'document' | 'invoice'): string {
  const descriptions: Record<string, string> = {
    resume: `Generate a professional resume. Use strong action verbs (Led, Developed, Increased, Managed).
Quantify achievements where possible (e.g., "increased sales by 40%").
Keep bullet points concise and impactful. Location should be City, State only (no full address for privacy).`,

    spreadsheet: `Generate a spreadsheet with appropriate data, headers, and formatting.
Use formulas for calculations (=SUM, =AVERAGE, etc.).
Include totals rows for financial data.
Use currency formatting for money values.`,

    document: `Generate a well-formatted document with appropriate headings, paragraphs, and sections.
Use proper heading hierarchy (title, heading1, heading2, etc.).
Include appropriate formatting (bold, italic) for emphasis.`,

    invoice: `Generate a professional invoice with accurate calculations.
Calculate totals correctly (subtotal, tax, total).
Include clear item descriptions and quantities.
Specify payment terms.`,
  };
  return descriptions[docType] || descriptions.document;
}

// ========================================
// NATIVE IMAGE GENERATION (Nano Banana)
// ========================================

/**
 * Default image generation model - Gemini native image generation
 */
const DEFAULT_IMAGE_MODEL = 'gemini-2.0-flash-exp-image-generation';

/**
 * Create an image using Gemini's native image generation (Nano Banana)
 * Returns base64 image data
 */
export async function createGeminiImageGeneration(options: {
  prompt: string;
  systemPrompt?: string;
  model?: string; // Custom image model from admin settings
}): Promise<{
  imageData: string; // Base64 encoded image data
  mimeType: string;
  model: string;
}> {
  const { prompt, systemPrompt, model } = options;
  const imageModel = model || DEFAULT_IMAGE_MODEL;

  const client = getGeminiClient();
  const currentKey = getCurrentApiKey();

  const maxRetries = 3;
  let lastError: Error | null = null;

  console.log('[Gemini] Creating image with Nano Banana:', imageModel);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Gemini] Image generation retry attempt ${attempt + 1}/${maxRetries}`);
      }

      // Build the full prompt
      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\nUser request: ${prompt}`
        : prompt;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = {
        responseModalities: ['TEXT', 'IMAGE'],
        // Safety settings for image generation
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      };

      const response = await client.models.generateContent({
        model: imageModel,
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config,
      });

      // Extract image from response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candidates = (response as any).candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No response candidates from image generation');
      }

      const parts = candidates[0]?.content?.parts;
      if (!parts || parts.length === 0) {
        throw new Error('No parts in image generation response');
      }

      // Find the image part
      for (const part of parts) {
        if (part.inlineData) {
          console.log('[Gemini] Image generated successfully');
          return {
            imageData: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
            model: imageModel,
          };
        }
      }

      throw new Error('No image data in response');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check for rate limit error
      const isRateLimit = lastError.message.includes('rate_limit') ||
                          lastError.message.includes('429') ||
                          lastError.message.includes('RESOURCE_EXHAUSTED') ||
                          lastError.message.toLowerCase().includes('too many requests');

      if (isRateLimit && currentKey) {
        const retryMatch = lastError.message.match(/retry.?after[:\s]*(\d+)/i);
        const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 60;
        markKeyRateLimited(currentKey, retryAfter);

        if (attempt < maxRetries - 1) {
          console.log(`[Gemini] Image generation rate limited, trying next key...`);
          continue;
        }
      }

      if (attempt === maxRetries - 1) {
        console.error('[Gemini] Image generation error (all retries exhausted):', lastError);
        throw lastError;
      }

      console.error(`[Gemini] Image generation error on attempt ${attempt + 1}, retrying:`, lastError.message);
    }
  }

  throw lastError || new Error('All Gemini API keys exhausted for image generation');
}

// Export types
export type GeminiModel = string;
