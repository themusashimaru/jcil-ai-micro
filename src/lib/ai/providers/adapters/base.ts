/**
 * BASE AI ADAPTER
 *
 * Abstract base class that all provider adapters must extend.
 * Defines the contract for provider-agnostic AI interactions.
 */

import type {
  ProviderId,
  ProviderFamily,
  ProviderCapabilities,
  UnifiedMessage,
  UnifiedTool,
  UnifiedToolCall,
  UnifiedToolResult,
  UnifiedStreamChunk,
  ChatOptions,
  AIAdapter,
} from '../types';
import { getProvider, getModelCapabilities, getDefaultModel } from '../registry';

// ============================================================================
// BASE ADAPTER CLASS
// ============================================================================

/**
 * Abstract base class for AI provider adapters
 *
 * All provider-specific adapters (Anthropic, OpenAI, etc.) must extend this class
 * and implement the abstract methods.
 */
export abstract class BaseAIAdapter implements AIAdapter {
  /**
   * Provider identifier (e.g., 'claude', 'openai', 'xai')
   */
  abstract readonly providerId: ProviderId;

  /**
   * Provider family determines the API format
   */
  abstract readonly family: ProviderFamily;

  /**
   * Stream a chat completion
   *
   * @param messages - Conversation messages in unified format
   * @param options - Chat options (model, tools, etc.)
   * @returns AsyncIterable of unified stream chunks
   */
  abstract chat(
    messages: UnifiedMessage[],
    options?: ChatOptions
  ): AsyncIterable<UnifiedStreamChunk>;

  /**
   * Convert unified tools to provider-specific format
   *
   * @param tools - Tools in unified format
   * @returns Tools in provider-specific format
   */
  abstract formatTools(tools: UnifiedTool[]): unknown;

  /**
   * Convert unified messages to provider-specific format
   *
   * @param messages - Messages in unified format
   * @returns Messages in provider-specific format
   */
  abstract toProviderMessages(messages: UnifiedMessage[]): unknown[];

  /**
   * Convert provider-specific messages to unified format
   *
   * @param messages - Messages in provider-specific format
   * @returns Messages in unified format
   */
  abstract fromProviderMessages(messages: unknown[]): UnifiedMessage[];

  /**
   * Format a tool result for the provider
   *
   * @param result - Tool result in unified format
   * @returns Tool result in provider-specific format
   */
  abstract formatToolResult(result: UnifiedToolResult): unknown;

  // ============================================================================
  // SHARED IMPLEMENTATIONS
  // ============================================================================

  /**
   * Get the provider's capabilities
   */
  getCapabilities(): ProviderCapabilities {
    const provider = getProvider(this.providerId);
    return provider.capabilities;
  }

  /**
   * Check if the provider has a specific capability
   */
  hasCapability(capability: keyof ProviderCapabilities): boolean {
    return this.getCapabilities()[capability];
  }

  /**
   * Get the default model for this provider
   */
  getDefaultModelId(): string {
    const model = getDefaultModel(this.providerId);
    if (!model) {
      throw new Error(`No default model found for provider: ${this.providerId}`);
    }
    return model.id;
  }

  /**
   * Get capabilities for a specific model
   */
  getModelCapabilities(modelId: string): ProviderCapabilities {
    return getModelCapabilities(this.providerId, modelId);
  }

  /**
   * Validate that a model supports required capabilities
   */
  validateModelCapabilities(
    modelId: string,
    required: Partial<Record<keyof ProviderCapabilities, boolean>>
  ): { valid: boolean; missing: string[] } {
    const capabilities = this.getModelCapabilities(modelId);
    const missing: string[] = [];

    for (const [capability, isRequired] of Object.entries(required)) {
      if (isRequired && !capabilities[capability as keyof ProviderCapabilities]) {
        missing.push(capability);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Extract text content from a unified message
   */
  protected extractTextContent(message: UnifiedMessage): string {
    if (typeof message.content === 'string') {
      return message.content;
    }

    return message.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }

  /**
   * Extract tool calls from a unified message
   */
  protected extractToolCalls(message: UnifiedMessage): UnifiedToolCall[] {
    if (typeof message.content === 'string') {
      return [];
    }

    return message.content
      .filter(
        (
          block
        ): block is {
          type: 'tool_use';
          id: string;
          name: string;
          arguments: Record<string, unknown>;
        } => block.type === 'tool_use'
      )
      .map((block) => ({
        id: block.id,
        name: block.name,
        arguments: block.arguments,
      }));
  }

  /**
   * Check if a message contains images
   */
  protected hasImages(message: UnifiedMessage): boolean {
    if (typeof message.content === 'string') {
      return false;
    }
    return message.content.some((block) => block.type === 'image');
  }

  /**
   * Check if any message in the conversation contains images
   */
  protected conversationHasImages(messages: UnifiedMessage[]): boolean {
    return messages.some((msg) => this.hasImages(msg));
  }

  /**
   * Generate a unique tool call ID
   */
  protected generateToolCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// ============================================================================
// ADAPTER FACTORY TYPE
// ============================================================================

/**
 * Factory function type for creating adapters
 */
export type AdapterFactory = (providerId: ProviderId) => BaseAIAdapter;
