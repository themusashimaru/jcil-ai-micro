/**
 * GOOGLE GEMINI ADAPTER
 *
 * Adapter for Google's Gemini models using the official @google/generative-ai SDK.
 *
 * Supported models:
 * - Gemini 3 Pro (Preview) (gemini-3-pro-preview) - Deep reasoning, complex coding, multi-file agents
 * - Gemini 3 Flash (Preview) (gemini-3-flash-preview) - Fast general AI, production workloads
 * - Gemini 2.5 Pro (gemini-2.5-pro) - Strong coding + reasoning at lower cost
 * - Gemini 2.5 Flash (gemini-2.5-flash) - Everyday chat, automation, moderate coding
 * - Gemini 2.5 Flash Lite (gemini-2.5-flash-lite) - Ultra-low-cost, lightweight automation
 */

import {
  GoogleGenerativeAI,
  Content,
  Part,
  Tool,
  FunctionDeclaration,
  FunctionCallingMode,
  SchemaType,
} from '@google/generative-ai';
import { BaseAIAdapter } from './base';
import type {
  ProviderId,
  ProviderFamily,
  UnifiedMessage,
  UnifiedTool,
  UnifiedToolResult,
  UnifiedStreamChunk,
  UnifiedContentBlock,
  ChatOptions,
} from '../types';

// ============================================================================
// API KEY MANAGEMENT - DUAL-POOL SYSTEM
// ============================================================================
// Primary Pool: Round-robin load distribution (e.g., GEMINI_API_KEY_1, _2, _3, ...)
// Fallback Pool: Emergency reserve (e.g., GEMINI_API_KEY_FALLBACK_1, _2, _3, ...)
// Backward Compatible: Single key (e.g., GEMINI_API_KEY) still works
// NO HARDCODED LIMITS - just add keys and they're automatically detected!

interface ApiKeyState {
  key: string;
  rateLimitedUntil: number;
  client: GoogleGenerativeAI | null;
  pool: 'primary' | 'fallback';
  index: number;
}

// Separate pools for better management
const primaryKeyPool: ApiKeyState[] = [];
const fallbackKeyPool: ApiKeyState[] = [];
let initialized = false;

/**
 * Initialize all available API keys into their pools
 * FULLY DYNAMIC: Automatically detects ALL configured keys - no limits!
 */
function initializeApiKeys(): void {
  // Always re-check if pool is empty (handles case where env var wasn't available earlier)
  if (initialized && primaryKeyPool.length > 0) {
    return; // Already initialized with keys
  }

  // Clear existing pools if re-initializing
  primaryKeyPool.length = 0;
  fallbackKeyPool.length = 0;

  // Dynamically detect ALL numbered primary keys (no limit!)
  let i = 1;
  while (true) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (!key) break;
    primaryKeyPool.push({
      key,
      rateLimitedUntil: 0,
      client: null,
      pool: 'primary',
      index: i,
    });
    i++;
  }

  // Fall back to single key if no numbered keys found
  if (primaryKeyPool.length === 0) {
    const singleKey = process.env.GEMINI_API_KEY;
    if (singleKey) {
      primaryKeyPool.push({
        key: singleKey,
        rateLimitedUntil: 0,
        client: null,
        pool: 'primary',
        index: 0,
      });
    }
  }

  // Dynamically detect ALL fallback keys (no limit!)
  let j = 1;
  while (true) {
    const key = process.env[`GEMINI_API_KEY_FALLBACK_${j}`];
    if (!key) break;
    fallbackKeyPool.push({
      key,
      rateLimitedUntil: 0,
      client: null,
      pool: 'fallback',
      index: j,
    });
    j++;
  }

  // Log the detected configuration (only in development)
  const totalKeys = primaryKeyPool.length + fallbackKeyPool.length;
  if (totalKeys > 0 && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(
      `[google] Initialized dual-pool system: ${primaryKeyPool.length} primary, ${fallbackKeyPool.length} fallback keys`
    );
  }

  // Only mark as initialized if we found at least one key
  // This allows retry if keys weren't available on first attempt
  if (primaryKeyPool.length > 0) {
    initialized = true;
  }
}

/**
 * Get an available key state from the primary pool
 * Uses random selection for serverless-safe load distribution
 */
function getPrimaryKeyState(): ApiKeyState | null {
  if (primaryKeyPool.length === 0) return null;

  const now = Date.now();
  const available = primaryKeyPool.filter((k) => k.rateLimitedUntil <= now);

  if (available.length === 0) {
    return null; // All primary keys are rate limited
  }

  // Random selection for serverless-safe load distribution
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Get an available key state from the fallback pool
 * Uses random selection for serverless-safe load distribution
 */
function getFallbackKeyState(): ApiKeyState | null {
  if (fallbackKeyPool.length === 0) return null;

  const now = Date.now();
  const available = fallbackKeyPool.filter((k) => k.rateLimitedUntil <= now);

  if (available.length === 0) {
    return null; // All fallback keys are also rate limited
  }

  // Random selection for serverless-safe load distribution
  const keyState = available[Math.floor(Math.random() * available.length)];
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(`[google] Using fallback key (primary pool exhausted), index: ${keyState.index}`);
  }
  return keyState;
}

/**
 * Get the next available API key state
 * Priority: Primary pool → Fallback pool → Wait for soonest available
 */
function getAvailableKeyState(): ApiKeyState | null {
  initializeApiKeys();

  // No keys configured at all
  if (primaryKeyPool.length === 0 && fallbackKeyPool.length === 0) {
    return null;
  }

  // Try primary pool first (random selection for load distribution)
  const primaryKeyState = getPrimaryKeyState();
  if (primaryKeyState) {
    return primaryKeyState;
  }

  // Primary pool exhausted - try fallback pool
  const fallbackKeyState = getFallbackKeyState();
  if (fallbackKeyState) {
    return fallbackKeyState;
  }

  // All keys rate limited - find the one available soonest
  const allKeys = [...primaryKeyPool, ...fallbackKeyPool];
  let soonestKey = allKeys[0];

  for (const key of allKeys) {
    if (key.rateLimitedUntil < soonestKey.rateLimitedUntil) {
      soonestKey = key;
    }
  }

  const waitTime = Math.ceil((soonestKey.rateLimitedUntil - Date.now()) / 1000);
  // eslint-disable-next-line no-console
  console.warn(
    `[google] All keys rate limited (${allKeys.length} total), soonest available in ${waitTime}s from ${soonestKey.pool} pool`
  );

  return soonestKey;
}

function getGoogleClient(): GoogleGenerativeAI {
  const keyState = getAvailableKeyState();
  if (!keyState) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Set GEMINI_API_KEY or GEMINI_API_KEY_1, _2, etc.'
    );
  }

  if (!keyState.client) {
    keyState.client = new GoogleGenerativeAI(keyState.key);
  }

  return keyState.client;
}

/**
 * Mark a specific API key as rate limited
 */
function markKeyRateLimited(client: GoogleGenerativeAI, retryAfterSeconds: number = 60): void {
  const allKeys = [...primaryKeyPool, ...fallbackKeyPool];
  const keyState = allKeys.find((k) => k.client === client);

  if (keyState) {
    keyState.rateLimitedUntil = Date.now() + retryAfterSeconds * 1000;

    // Log pool status
    const now = Date.now();
    const availablePrimary = primaryKeyPool.filter((k) => k.rateLimitedUntil <= now).length;
    const availableFallback = fallbackKeyPool.filter((k) => k.rateLimitedUntil <= now).length;
    // eslint-disable-next-line no-console
    console.warn(
      `[google] Key rate limited (pool: ${keyState.pool}, index: ${keyState.index}), retry after ${retryAfterSeconds}s. Available: ${availablePrimary} primary, ${availableFallback} fallback`
    );
  }
}

// ============================================================================
// GOOGLE GEMINI ADAPTER
// ============================================================================

/**
 * Adapter for Google Gemini models
 */
export class GoogleGeminiAdapter extends BaseAIAdapter {
  readonly providerId: ProviderId = 'google';
  readonly family: ProviderFamily = 'google';

  private client: GoogleGenerativeAI | null = null;
  private initError: string | null = null;
  // CRITICAL-002 FIX: Track tool call IDs to their function names
  // Google API requires function name in functionResponse, but tool_result only has ID
  private toolCallIdToName: Map<string, string> = new Map();

  constructor() {
    super();
    try {
      this.client = getGoogleClient();
    } catch (error) {
      this.initError =
        error instanceof Error ? error.message : 'Failed to initialize Gemini client';
    }
  }

  /**
   * Check if the adapter is properly initialized
   */
  private ensureClient(): GoogleGenerativeAI {
    if (!this.client) {
      throw new Error(
        this.initError || 'Gemini client not initialized. Please check your GEMINI_API_KEY.'
      );
    }
    return this.client;
  }

  // ============================================================================
  // MAIN CHAT METHOD
  // ============================================================================

  async *chat(
    messages: UnifiedMessage[],
    options: ChatOptions = {}
  ): AsyncIterable<UnifiedStreamChunk> {
    // CRITICAL FIX: Refresh client on EVERY request for proper key rotation
    // The adapter is cached globally, but we need fresh key selection per-request
    // to ensure proper load distribution across multiple API keys
    try {
      this.client = getGoogleClient();
    } catch (error) {
      this.initError =
        error instanceof Error ? error.message : 'Failed to initialize Gemini client';
    }

    const client = this.ensureClient();
    const modelId = options.model || this.getDefaultModelId();
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.7;

    // Get the model
    const model = client.getGenerativeModel({
      model: modelId,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
        stopSequences: options.stopSequences,
      },
    });

    // Convert messages to Google format
    const { history, lastUserMessage, systemInstruction } = this.prepareMessages(
      messages,
      options.systemPrompt
    );

    // Setup tools if provided
    const tools = options.tools ? this.formatTools(options.tools) : undefined;

    try {
      // Start chat with history
      const chat = model.startChat({
        history,
        systemInstruction,
        tools,
        toolConfig: tools
          ? {
              functionCallingConfig: {
                mode: FunctionCallingMode.AUTO,
              },
            }
          : undefined,
      });

      // Stream the response
      // Convert lastUserMessage to the format expected by the SDK
      // Ensure we always have a valid message to send
      let messageContent: string | Part[];
      if (lastUserMessage.length === 0) {
        messageContent = 'Continue.';
      } else if (
        lastUserMessage.length === 1 &&
        'text' in lastUserMessage[0] &&
        lastUserMessage[0].text
      ) {
        messageContent = lastUserMessage[0].text;
      } else {
        messageContent = lastUserMessage;
      }

      const result = await chat.sendMessageStream(messageContent);

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      // Iterate over the stream with proper error handling
      try {
        for await (const chunk of result.stream) {
          // Safely extract text from chunk
          try {
            const text = chunk.text?.();
            if (text) {
              fullText += text;
              yield { type: 'text', text };
            }
          } catch {
            // Some chunks may not have text (e.g., function calls)
            // Continue processing
          }

          // Handle function calls
          try {
            const functionCalls = chunk.functionCalls?.();
            if (functionCalls && functionCalls.length > 0) {
              for (const fc of functionCalls) {
                yield {
                  type: 'tool_call_start',
                  toolCall: {
                    id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                    name: fc.name,
                    arguments: fc.args as Record<string, unknown>,
                  },
                };
                yield { type: 'tool_call_end' };
              }
            }
          } catch {
            // Continue even if function call extraction fails
          }

          // Try to get usage metadata from each chunk
          try {
            const metadata = chunk.usageMetadata;
            if (metadata) {
              inputTokens = metadata.promptTokenCount || inputTokens;
              outputTokens = metadata.candidatesTokenCount || outputTokens;
            }
          } catch {
            // Usage metadata may not be available on all chunks
          }
        }
      } catch (streamError) {
        // If streaming fails partway, still try to return what we have
        if (fullText) {
          // We already yielded the text, so just continue to end the message
        } else {
          throw streamError; // Re-throw if no content was received
        }
      }

      // Get final usage info from the response
      try {
        const response = await result.response;
        const usageMetadata = response?.usageMetadata;
        if (usageMetadata) {
          inputTokens = usageMetadata.promptTokenCount || inputTokens;
          outputTokens = usageMetadata.candidatesTokenCount || outputTokens;
        }
      } catch {
        // Continue even if final response fails - we may have streamed content
      }

      yield {
        type: 'message_end',
        usage: {
          inputTokens,
          outputTokens,
        },
      };
    } catch (error) {
      // Handle rate limiting - mark key and try to get a fresh one
      if (this.client && this.isRateLimitError(error)) {
        const retryAfter = this.extractRetryAfter(error);
        markKeyRateLimited(this.client, retryAfter);
        try {
          this.client = getGoogleClient();
        } catch {
          // If we can't get a new client, keep the old one
        }
      }

      const errorCode = this.mapErrorCode(error);
      const rawMessage = error instanceof Error ? error.message : 'Unknown error';
      // Use user-friendly message for better UX
      const userMessage = this.getUserFriendlyMessage(errorCode, rawMessage);

      yield {
        type: 'error',
        error: {
          code: errorCode,
          message: userMessage,
        },
      };
    }
  }

  // ============================================================================
  // MESSAGE CONVERSION
  // ============================================================================

  /**
   * Prepare messages for Google format
   * CRITICAL-002 FIX: Build tool call ID to name mapping for correct functionResponse names
   */
  private prepareMessages(
    messages: UnifiedMessage[],
    systemPrompt?: string
  ): {
    history: Content[];
    lastUserMessage: Part[];
    systemInstruction?: string;
  } {
    const history: Content[] = [];
    let lastUserMessage: Part[] = [];

    // CRITICAL-002 FIX: Build a map of tool call ID -> function name
    // This is needed because tool_result only has toolUseId, but Google API needs function name
    const toolCallIdToName = new Map<string, string>();
    for (const msg of messages) {
      if (typeof msg.content !== 'string') {
        for (const block of msg.content) {
          if (block.type === 'tool_use') {
            toolCallIdToName.set(block.id, block.name);
          }
        }
      }
    }
    // Store the mapping for use in convertToParts
    this.toolCallIdToName = toolCallIdToName;

    // Find system messages and combine with provided system prompt
    const systemMessages = messages.filter((m) => m.role === 'system');
    const systemText = [
      systemPrompt,
      ...systemMessages.map((m) => (typeof m.content === 'string' ? m.content : '')),
    ]
      .filter(Boolean)
      .join('\n\n');

    // Process non-system messages
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    for (let i = 0; i < nonSystemMessages.length; i++) {
      const msg = nonSystemMessages[i];
      const isLast = i === nonSystemMessages.length - 1;
      const parts = this.convertToParts(msg);

      if (isLast && msg.role === 'user') {
        lastUserMessage = parts;
      } else {
        history.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts,
        });
      }
    }

    // If last message wasn't a user message, we need to handle this
    if (lastUserMessage.length === 0) {
      lastUserMessage = [{ text: 'Continue.' }];
    }

    // Ensure systemInstruction is properly formatted:
    // - Trim whitespace
    // - Return undefined if empty (some models don't accept empty strings)
    const trimmedSystemText = systemText?.trim();

    return {
      history,
      lastUserMessage,
      systemInstruction:
        trimmedSystemText && trimmedSystemText.length > 0 ? trimmedSystemText : undefined,
    };
  }

  /**
   * Convert a unified message to Google Parts
   */
  private convertToParts(msg: UnifiedMessage): Part[] {
    if (typeof msg.content === 'string') {
      return [{ text: msg.content }];
    }

    const parts: Part[] = [];

    for (const block of msg.content) {
      switch (block.type) {
        case 'text':
          parts.push({ text: block.text });
          break;

        case 'image':
          if (block.source.type === 'base64' && block.source.data) {
            parts.push({
              inlineData: {
                mimeType: block.source.mediaType || 'image/png',
                data: block.source.data,
              },
            });
          }
          break;

        case 'tool_use':
          parts.push({
            functionCall: {
              name: block.name,
              args: block.arguments,
            },
          });
          break;

        case 'tool_result':
          // CRITICAL-002 FIX: Google API requires function NAME, not call ID
          // Look up the original function name from the tool call ID
          const functionName = this.toolCallIdToName.get(block.toolUseId) || block.toolUseId;
          parts.push({
            functionResponse: {
              name: functionName,
              response: { result: block.content },
            },
          });
          break;
      }
    }

    return parts.length > 0 ? parts : [{ text: '' }];
  }

  /**
   * Convert unified messages to Google format (public interface)
   */
  toProviderMessages(messages: UnifiedMessage[]): Content[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: this.convertToParts(msg),
      }));
  }

  /**
   * Convert Google messages to unified format
   */
  fromProviderMessages(messages: unknown[]): UnifiedMessage[] {
    return (messages as Content[]).map((content) => {
      const unifiedContent: UnifiedContentBlock[] = [];

      for (const part of content.parts) {
        if ('text' in part && part.text) {
          unifiedContent.push({ type: 'text', text: part.text });
        }

        if ('inlineData' in part && part.inlineData) {
          unifiedContent.push({
            type: 'image',
            source: {
              type: 'base64',
              mediaType: part.inlineData.mimeType,
              data: part.inlineData.data,
            },
          });
        }

        if ('functionCall' in part && part.functionCall) {
          unifiedContent.push({
            type: 'tool_use',
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            name: part.functionCall.name,
            arguments: part.functionCall.args as Record<string, unknown>,
          });
        }

        if ('functionResponse' in part && part.functionResponse) {
          unifiedContent.push({
            type: 'tool_result',
            toolUseId: part.functionResponse.name,
            content:
              typeof part.functionResponse.response === 'string'
                ? part.functionResponse.response
                : JSON.stringify(part.functionResponse.response),
          });
        }
      }

      return {
        role: content.role === 'model' ? 'assistant' : 'user',
        content: unifiedContent,
      };
    });
  }

  // ============================================================================
  // TOOL CONVERSION
  // ============================================================================

  /**
   * Convert a unified property type to SchemaType
   */
  private toSchemaType(type: string): SchemaType {
    switch (type.toLowerCase()) {
      case 'string':
        return SchemaType.STRING;
      case 'number':
      case 'integer':
        return SchemaType.NUMBER;
      case 'boolean':
        return SchemaType.BOOLEAN;
      case 'array':
        return SchemaType.ARRAY;
      case 'object':
        return SchemaType.OBJECT;
      default:
        return SchemaType.STRING;
    }
  }

  /**
   * Convert unified tools to Google format
   */
  formatTools(tools: UnifiedTool[]): Tool[] {
    const functionDeclarations = tools.map((tool) => {
      // Convert properties to Google Schema format
      const properties: Record<
        string,
        { type: SchemaType; description?: string; enum?: string[] }
      > = {};
      for (const [key, value] of Object.entries(tool.parameters.properties)) {
        properties[key] = {
          type: this.toSchemaType(value.type),
          description: value.description,
          enum: value.enum,
        };
      }

      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: SchemaType.OBJECT,
          properties,
          required: tool.parameters.required,
        },
      };
    }) as FunctionDeclaration[];

    return [{ functionDeclarations }];
  }

  /**
   * Format a tool result for Google
   * CRITICAL-002 FIX: Use tracked function name instead of call ID
   */
  formatToolResult(result: UnifiedToolResult): Part {
    // Look up the original function name from the tool call ID
    const functionName = this.toolCallIdToName.get(result.toolCallId) || result.toolCallId;
    return {
      functionResponse: {
        name: functionName,
        response: { result: result.content },
      },
    };
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  /**
   * Check if an error is a rate limit error
   * Enhanced detection for various Google API error formats
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('429') ||
        message.includes('rate limit') ||
        message.includes('rate_limit') ||
        message.includes('ratelimit') ||
        message.includes('quota') ||
        message.includes('too many requests') ||
        message.includes('resource_exhausted') ||
        message.includes('resourceexhausted')
      );
    }
    return false;
  }

  /**
   * Extract retry-after seconds from an error
   * Handles various formats from Google API responses
   */
  private extractRetryAfter(error: unknown): number {
    if (error instanceof Error) {
      // Try to match various retry-after patterns
      const patterns = [
        /retry.?after[:\s]*(\d+)/i,
        /wait\s+(\d+)\s*seconds?/i,
        /try again in\s+(\d+)/i,
        /(\d+)\s*seconds?\s*(?:before|until)/i,
      ];

      for (const pattern of patterns) {
        const match = error.message.match(pattern);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    }
    return 60; // Default 60 seconds for rate limits
  }

  /**
   * Map an error to a unified error code
   */
  private mapErrorCode(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message.includes('401') ||
        message.includes('api key') ||
        message.includes('invalid_api_key')
      ) {
        return 'auth_failed';
      }
      if (
        message.includes('429') ||
        message.includes('rate limit') ||
        message.includes('rate_limit') ||
        message.includes('ratelimit') ||
        message.includes('quota') ||
        message.includes('too many requests') ||
        message.includes('resource_exhausted') ||
        message.includes('resourceexhausted')
      ) {
        return 'rate_limited';
      }
      // Context length errors - be specific to avoid false positives
      // Don't match generic "token" (could be auth token) or "too long" (could be timeout)
      if (
        message.includes('context length') ||
        message.includes('context window') ||
        message.includes('max context') ||
        message.includes('input too long') ||
        message.includes('prompt too long') ||
        message.includes('token limit') ||
        message.includes('exceeds the maximum') ||
        message.includes('maximum token') ||
        message.includes('too many tokens') ||
        (message.includes('context') && message.includes('exceed'))
      ) {
        return 'context_too_long';
      }
      if (message.includes('safety') || message.includes('blocked') || message.includes('harm')) {
        return 'content_filtered';
      }
      if (message.includes('500') || message.includes('503') || message.includes('internal')) {
        return 'server_error';
      }
      if (
        message.includes('model') &&
        (message.includes('not found') || message.includes('unavailable'))
      ) {
        return 'model_unavailable';
      }
      // Handle 400 Bad Request / Invalid Argument errors
      // These indicate malformed requests (invalid parameters, unsupported features, etc.)
      if (
        message.includes('400') ||
        message.includes('invalid_argument') ||
        message.includes('invalid argument') ||
        message.includes('invalid value') ||
        message.includes('bad request') ||
        message.includes('malformed')
      ) {
        return 'invalid_request';
      }
    }
    return 'unknown';
  }

  /**
   * Get a user-friendly error message based on error code
   */
  private getUserFriendlyMessage(code: string, originalMessage: string): string {
    switch (code) {
      case 'rate_limited':
        return 'Google Gemini API rate limit reached. Please wait a moment and try again, or switch to a different model.';
      case 'auth_failed':
        return 'Google Gemini API authentication failed. Please check the API key configuration.';
      case 'context_too_long':
        return 'The conversation is too long for this model. Try starting a new conversation or using a model with a larger context window.';
      case 'content_filtered':
        return "The response was blocked by Google's safety filters. Please rephrase your request.";
      case 'server_error':
        return 'Google Gemini service encountered an error. Please try again in a moment.';
      case 'model_unavailable':
        return 'The selected Gemini model is currently unavailable. Please try a different model.';
      case 'invalid_request':
        // Provide more context for invalid request errors (common with preview models)
        return 'The request format is not supported by this Gemini model. This can happen with preview models that have different API requirements. Please try a stable model like Gemini 2.5 Pro or Gemini 2.5 Flash.';
      default:
        // Return sanitized original message for unknown errors
        return originalMessage.length > 200
          ? originalMessage.substring(0, 200) + '...'
          : originalMessage;
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a Google Gemini adapter instance
 */
export function createGoogleAdapter(): GoogleGeminiAdapter {
  return new GoogleGeminiAdapter();
}
