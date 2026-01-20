/**
 * MULTI-PROVIDER SERVICE
 *
 * High-level service for AI provider operations.
 * Provides a simple interface for chat routes to use multi-provider features.
 */

import type {
  ProviderId,
  UnifiedMessage,
  UnifiedTool,
  UnifiedStreamChunk,
  ChatOptions,
  ProviderConfig,
  HandoffResult,
  HandoffOptions,
} from './types';
import { UnifiedAIError } from './types';
import {
  getProvider,
  getDefaultModel,
  isProviderAvailable as checkProviderAvailable,
} from './registry';
import { getAdapter } from './adapters';
import { parseProviderError, canRecoverWithFallback } from './errors';
import { prepareProviderHandoff, canHandoff } from './context';
import { logger } from '@/lib/logger';

const log = logger('ProviderService');

// ============================================================================
// SERVICE TYPES
// ============================================================================

/**
 * Options for provider service chat
 */
export interface ProviderChatOptions extends ChatOptions {
  /** Provider to use */
  providerId?: ProviderId;
  /** Fallback provider if primary fails */
  fallbackProviderId?: ProviderId;
  /** Enable automatic retry on failure */
  enableRetry?: boolean;
  /** Enable automatic fallback on unrecoverable error */
  enableFallback?: boolean;
  /** Callback for provider switch events */
  onProviderSwitch?: (from: ProviderId, to: ProviderId, reason: string) => void;
}

/**
 * Result of a provider chat operation
 */
export interface ProviderChatResult {
  /** The provider that was used */
  providerId: ProviderId;
  /** Model that was used */
  model: string;
  /** Whether a fallback was used */
  usedFallback: boolean;
  /** Reason for fallback if used */
  fallbackReason?: string;
}

/**
 * Provider availability status
 */
export interface ProviderStatus {
  providerId: ProviderId;
  configured: boolean;
  available: boolean;
  defaultModel: string | null;
  error?: string;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * Multi-provider service for AI operations
 */
export class ProviderService {
  private currentProviderId: ProviderId;
  private fallbackProviderId: ProviderId | null;

  constructor(
    defaultProvider: ProviderId = 'claude',
    fallbackProvider: ProviderId | null = 'openai'
  ) {
    this.currentProviderId = defaultProvider;
    this.fallbackProviderId = fallbackProvider;
  }

  /**
   * Get the current provider ID
   */
  getCurrentProvider(): ProviderId {
    return this.currentProviderId;
  }

  /**
   * Set the current provider
   */
  setProvider(providerId: ProviderId): void {
    if (!checkProviderAvailable(providerId)) {
      log.warn('Provider not configured, keeping current provider', {
        requested: providerId,
        current: this.currentProviderId,
      });
      return;
    }
    this.currentProviderId = providerId;
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(providerId?: ProviderId): ProviderConfig | null {
    return getProvider(providerId ?? this.currentProviderId);
  }

  /**
   * Check availability of all providers
   */
  getProviderStatuses(): ProviderStatus[] {
    const providers: ProviderId[] = ['claude', 'openai', 'xai', 'deepseek'];
    return providers.map((id) => {
      const configured = checkProviderAvailable(id);
      const modelConfig = configured ? getDefaultModel(id) : undefined;
      return {
        providerId: id,
        configured,
        available: configured,
        defaultModel: modelConfig?.id ?? null,
      };
    });
  }

  /**
   * Get configured providers
   */
  getConfiguredProviders(): ProviderId[] {
    return this.getProviderStatuses()
      .filter((s) => s.configured)
      .map((s) => s.providerId);
  }

  /**
   * Stream a chat completion with automatic retry and fallback
   */
  async *chat(
    messages: UnifiedMessage[],
    options: ProviderChatOptions = {}
  ): AsyncGenerator<UnifiedStreamChunk, ProviderChatResult, unknown> {
    const {
      providerId = this.currentProviderId,
      fallbackProviderId = this.fallbackProviderId,
      enableRetry = true,
      enableFallback = true,
      onProviderSwitch,
      ...chatOptions
    } = options;

    let currentProvider = providerId;
    let usedFallback = false;
    let fallbackReason: string | undefined;

    // Try primary provider
    try {
      const adapter = getAdapter(currentProvider);
      if (!adapter) {
        throw new UnifiedAIError(
          'model_unavailable',
          `Provider ${currentProvider} is not configured`,
          currentProvider,
          false
        );
      }

      const model = chatOptions.model ?? getDefaultModel(currentProvider)?.id ?? undefined;

      const executeChat = async function* () {
        yield* adapter.chat(messages, { ...chatOptions, model });
      };

      if (enableRetry) {
        // With retry logic
        const retryableChat = async function* () {
          let lastError: UnifiedAIError | null = null;

          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              yield* adapter.chat(messages, { ...chatOptions, model });
              return;
            } catch (err) {
              lastError = parseProviderError(err, currentProvider);
              if (!lastError.shouldRetry()) {
                throw lastError;
              }
              const delay = lastError.getRetryDelay() * Math.pow(2, attempt);
              log.info('Retrying chat after error', {
                provider: currentProvider,
                attempt: attempt + 1,
                delay,
              });
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }

          if (lastError) throw lastError;
        };

        yield* retryableChat();
      } else {
        yield* executeChat();
      }
    } catch (err) {
      const error = err instanceof UnifiedAIError ? err : parseProviderError(err, currentProvider);

      // Try fallback if enabled and applicable
      if (enableFallback && fallbackProviderId && canRecoverWithFallback(error)) {
        log.info('Switching to fallback provider', {
          from: currentProvider,
          to: fallbackProviderId,
          reason: error.message,
        });

        onProviderSwitch?.(currentProvider, fallbackProviderId, error.message);

        const fallbackAdapter = getAdapter(fallbackProviderId);
        if (fallbackAdapter) {
          currentProvider = fallbackProviderId;
          usedFallback = true;
          fallbackReason = error.message;

          const fallbackModel =
            chatOptions.model ?? getDefaultModel(fallbackProviderId)?.id ?? undefined;

          try {
            yield* fallbackAdapter.chat(messages, { ...chatOptions, model: fallbackModel });
          } catch (fallbackErr) {
            // Fallback also failed
            throw parseProviderError(fallbackErr, fallbackProviderId);
          }
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    return {
      providerId: currentProvider,
      model: chatOptions.model ?? getDefaultModel(currentProvider)?.id ?? 'unknown',
      usedFallback,
      fallbackReason,
    };
  }

  /**
   * Switch provider mid-conversation with context handoff
   */
  async switchProvider(
    conversation: UnifiedMessage[],
    toProvider: ProviderId,
    options: Partial<HandoffOptions> = {}
  ): Promise<HandoffResult> {
    const fromProvider = this.currentProviderId;

    const handoffCheck = canHandoff(fromProvider, toProvider, conversation);
    if (!handoffCheck.possible) {
      throw new UnifiedAIError(
        'invalid_request',
        `Cannot handoff from ${fromProvider} to ${toProvider}: ${handoffCheck.warnings.join(', ')}`,
        fromProvider,
        false
      );
    }

    const result = await prepareProviderHandoff(conversation, fromProvider, toProvider, options);

    // Update current provider
    this.currentProviderId = toProvider;

    log.info('Provider switched', {
      from: fromProvider,
      to: toProvider,
      messagesConverted: result.metadata.preparedMessageCount,
      wasSummarized: result.metadata.wasSummarized,
      warnings: result.warnings,
    });

    return result;
  }

  /**
   * Format tools for the current provider
   */
  formatTools(tools: UnifiedTool[], providerId?: ProviderId): unknown {
    const adapter = getAdapter(providerId ?? this.currentProviderId);
    if (!adapter) {
      throw new Error(`Provider ${providerId ?? this.currentProviderId} not configured`);
    }
    return adapter.formatTools(tools);
  }

  /**
   * Check if current provider has a capability
   */
  hasCapability(
    capability:
      | 'vision'
      | 'parallelToolCalls'
      | 'streaming'
      | 'systemMessages'
      | 'jsonMode'
      | 'toolCalling',
    providerId?: ProviderId
  ): boolean {
    const adapter = getAdapter(providerId ?? this.currentProviderId);
    return adapter?.hasCapability(capability) ?? false;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let _defaultService: ProviderService | null = null;

/**
 * Get the default provider service instance
 */
export function getProviderService(): ProviderService {
  if (!_defaultService) {
    _defaultService = new ProviderService();
  }
  return _defaultService;
}

/**
 * Create a new provider service with custom settings
 */
export function createProviderService(
  defaultProvider?: ProviderId,
  fallbackProvider?: ProviderId | null
): ProviderService {
  return new ProviderService(defaultProvider, fallbackProvider ?? undefined);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick check if a provider is available
 */
export function isProviderAvailable(providerId: ProviderId): boolean {
  return checkProviderAvailable(providerId);
}

/**
 * Get list of available providers
 */
export function getAvailableProviders(): ProviderId[] {
  return getProviderService().getConfiguredProviders();
}

/**
 * Simple chat with the default provider
 */
export async function* chat(
  messages: UnifiedMessage[],
  options: ProviderChatOptions = {}
): AsyncGenerator<UnifiedStreamChunk, ProviderChatResult, unknown> {
  const service = getProviderService();
  const result = yield* service.chat(messages, options);
  return result;
}
