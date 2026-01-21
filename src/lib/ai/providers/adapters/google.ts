/**
 * GOOGLE GEMINI ADAPTER
 *
 * Adapter for Google's Gemini models using the official @google/generative-ai SDK.
 *
 * Supported models:
 * - Gemini 2.0 Flash (gemini-2.0-flash)
 * - Gemini 1.5 Pro (gemini-1.5-pro)
 * - Gemini 1.5 Flash (gemini-1.5-flash)
 */

import {
  GoogleGenerativeAI,
  Content,
  Part,
  Tool,
  FunctionDeclaration,
  FunctionCallingMode,
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
// API KEY MANAGEMENT
// ============================================================================

interface ApiKeyState {
  key: string;
  rateLimitedUntil: number;
  client: GoogleGenerativeAI | null;
}

const apiKeyPool: ApiKeyState[] = [];
let initialized = false;

function initializeApiKeys(): void {
  if (initialized) return;
  initialized = true;

  // Check for numbered keys first
  let i = 1;
  while (true) {
    const key = process.env[`GOOGLE_API_KEY_${i}`];
    if (!key) break;
    apiKeyPool.push({ key, rateLimitedUntil: 0, client: null });
    i++;
  }

  // Fall back to single key
  if (apiKeyPool.length === 0) {
    const singleKey = process.env.GOOGLE_API_KEY;
    if (singleKey) {
      apiKeyPool.push({ key: singleKey, rateLimitedUntil: 0, client: null });
    }
  }
}

function getAvailableKeyState(): ApiKeyState | null {
  initializeApiKeys();
  if (apiKeyPool.length === 0) return null;

  const now = Date.now();
  const available = apiKeyPool.filter((k) => k.rateLimitedUntil <= now);

  if (available.length === 0) {
    // All rate limited, return the one that will be available soonest
    return apiKeyPool.reduce((a, b) => (a.rateLimitedUntil < b.rateLimitedUntil ? a : b));
  }

  // Random selection for load distribution
  return available[Math.floor(Math.random() * available.length)];
}

function getGoogleClient(): GoogleGenerativeAI {
  const keyState = getAvailableKeyState();
  if (!keyState) {
    throw new Error('GOOGLE_API_KEY is not configured');
  }

  if (!keyState.client) {
    keyState.client = new GoogleGenerativeAI(keyState.key);
  }

  return keyState.client;
}

function markKeyRateLimited(client: GoogleGenerativeAI, retryAfterSeconds: number = 60): void {
  const keyState = apiKeyPool.find((k) => k.client === client);
  if (keyState) {
    keyState.rateLimitedUntil = Date.now() + retryAfterSeconds * 1000;
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

  private client: GoogleGenerativeAI;

  constructor() {
    super();
    this.client = getGoogleClient();
  }

  // ============================================================================
  // MAIN CHAT METHOD
  // ============================================================================

  async *chat(
    messages: UnifiedMessage[],
    options: ChatOptions = {}
  ): AsyncIterable<UnifiedStreamChunk> {
    const modelId = options.model || this.getDefaultModelId();
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.7;

    // Get the model
    const model = this.client.getGenerativeModel({
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
      const result = await chat.sendMessageStream(lastUserMessage);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield { type: 'text', text };
        }

        // Handle function calls
        const functionCalls = chunk.functionCalls();
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
      }

      // Get usage info from the final response
      const response = await result.response;
      const usageMetadata = response.usageMetadata;

      yield {
        type: 'message_end',
        usage: usageMetadata
          ? {
              inputTokens: usageMetadata.promptTokenCount || 0,
              outputTokens: usageMetadata.candidatesTokenCount || 0,
            }
          : undefined,
      };
    } catch (error) {
      // Handle rate limiting
      if (this.isRateLimitError(error)) {
        markKeyRateLimited(this.client, this.extractRetryAfter(error));
        this.client = getGoogleClient();
      }

      yield {
        type: 'error',
        error: {
          code: this.mapErrorCode(error),
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================================
  // MESSAGE CONVERSION
  // ============================================================================

  /**
   * Prepare messages for Google format
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

    return {
      history,
      lastUserMessage,
      systemInstruction: systemText || undefined,
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
          parts.push({
            functionResponse: {
              name: block.toolUseId, // Google uses the function name, not ID
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
   * Convert unified tools to Google format
   */
  formatTools(tools: UnifiedTool[]): Tool[] {
    const functionDeclarations: FunctionDeclaration[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    }));

    return [{ functionDeclarations }];
  }

  /**
   * Format a tool result for Google
   */
  formatToolResult(result: UnifiedToolResult): Part {
    return {
      functionResponse: {
        name: result.toolCallId,
        response: { result: result.content },
      },
    };
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  /**
   * Check if an error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('429') ||
        error.message.toLowerCase().includes('rate') ||
        error.message.toLowerCase().includes('quota')
      );
    }
    return false;
  }

  /**
   * Extract retry-after seconds from an error
   */
  private extractRetryAfter(error: unknown): number {
    if (error instanceof Error) {
      const match = error.message.match(/retry.?after[:\s]*(\d+)/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 60;
  }

  /**
   * Map an error to a unified error code
   */
  private mapErrorCode(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('401') || message.includes('api key')) {
        return 'auth_failed';
      }
      if (message.includes('429') || message.includes('rate') || message.includes('quota')) {
        return 'rate_limited';
      }
      if (message.includes('context') || message.includes('too long')) {
        return 'context_too_long';
      }
      if (message.includes('safety') || message.includes('blocked')) {
        return 'content_filtered';
      }
      if (message.includes('500') || message.includes('503')) {
        return 'server_error';
      }
    }
    return 'unknown';
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
