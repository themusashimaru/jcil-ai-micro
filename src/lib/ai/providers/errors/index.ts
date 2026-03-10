/**
 * ERROR HANDLING MODULE
 *
 * Comprehensive error handling for multi-provider AI system:
 * - Provider-specific error parsing
 * - Retry logic with exponential backoff
 * - Error recovery strategies
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ProviderId, UnifiedErrorCode } from '../types';
import { UnifiedAIError } from '../types';

// ============================================================================
// ERROR CODE MAPPINGS
// ============================================================================

/**
 * Anthropic API error code mappings
 */
const ANTHROPIC_ERROR_CODES: Record<string, UnifiedErrorCode> = {
  rate_limit_error: 'rate_limited',
  overloaded_error: 'rate_limited',
  invalid_request_error: 'invalid_request',
  authentication_error: 'auth_failed',
  permission_error: 'auth_failed',
  not_found_error: 'model_unavailable',
  api_error: 'server_error',
};

/**
 * OpenAI API error code mappings (used by OpenAI, xAI, DeepSeek)
 */
const OPENAI_ERROR_CODES: Record<string, UnifiedErrorCode> = {
  rate_limit_exceeded: 'rate_limited',
  insufficient_quota: 'rate_limited',
  context_length_exceeded: 'context_too_long',
  invalid_api_key: 'auth_failed',
  model_not_found: 'model_unavailable',
  server_error: 'server_error',
  service_unavailable: 'server_error',
};

/**
 * HTTP status code mappings (fallback)
 */
const HTTP_STATUS_CODES: Record<number, UnifiedErrorCode> = {
  400: 'invalid_request',
  401: 'auth_failed',
  403: 'auth_failed',
  404: 'model_unavailable',
  408: 'timeout',
  429: 'rate_limited',
  500: 'server_error',
  502: 'server_error',
  503: 'server_error',
  504: 'timeout',
};

// ============================================================================
// PROVIDER-SPECIFIC ERROR PARSERS
// ============================================================================

/**
 * Parse an Anthropic SDK error into a UnifiedAIError
 */
export function parseAnthropicError(
  error: unknown,
  providerId: ProviderId = 'claude'
): UnifiedAIError {
  // Handle Anthropic API errors
  if (error instanceof Anthropic.APIError) {
    const status = error.status;
    const errorType = (error as { error?: { type?: string } }).error?.type;

    // Determine error code
    let code: UnifiedErrorCode = 'unknown';
    if (errorType && errorType in ANTHROPIC_ERROR_CODES) {
      code = ANTHROPIC_ERROR_CODES[errorType];
    } else if (status && status in HTTP_STATUS_CODES) {
      code = HTTP_STATUS_CODES[status];
    }

    // Check for context length error in message
    if (
      error.message.toLowerCase().includes('context') ||
      error.message.toLowerCase().includes('token')
    ) {
      code = 'context_too_long';
    }

    // Check for content filtering
    if (
      error.message.toLowerCase().includes('content') &&
      error.message.toLowerCase().includes('policy')
    ) {
      code = 'content_filtered';
    }

    // Determine retry-ability and delay
    const retryable = code === 'rate_limited' || code === 'server_error' || code === 'timeout';
    const retryAfterMs = extractRetryAfter(error) ?? getDefaultRetryDelay(code);

    return new UnifiedAIError(code, error.message, providerId, retryable, retryAfterMs, error);
  }

  // Handle network/connection errors
  if (error instanceof Error) {
    if (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('network')
    ) {
      return new UnifiedAIError('network_error', error.message, providerId, true, 5000, error);
    }

    if (error.message.includes('timeout')) {
      return new UnifiedAIError('timeout', error.message, providerId, true, 5000, error);
    }

    return new UnifiedAIError('unknown', error.message, providerId, false, undefined, error);
  }

  return new UnifiedAIError('unknown', String(error), providerId, false, undefined, error);
}

/**
 * Parse an OpenAI SDK error into a UnifiedAIError
 * Also works for xAI, DeepSeek (OpenAI-compatible APIs)
 */
export function parseOpenAIError(error: unknown, providerId: ProviderId): UnifiedAIError {
  // Handle OpenAI API errors
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    const errorCode = (error as { code?: string }).code;

    // Determine error code
    let code: UnifiedErrorCode = 'unknown';
    if (errorCode && errorCode in OPENAI_ERROR_CODES) {
      code = OPENAI_ERROR_CODES[errorCode];
    } else if (status && status in HTTP_STATUS_CODES) {
      code = HTTP_STATUS_CODES[status];
    }

    // Check for context length error in message
    if (
      error.message.toLowerCase().includes('context_length') ||
      error.message.includes('maximum context')
    ) {
      code = 'context_too_long';
    }

    // Check for content filtering
    if (
      error.message.toLowerCase().includes('content_filter') ||
      error.message.includes('content policy')
    ) {
      code = 'content_filtered';
    }

    // Determine retry-ability and delay
    const retryable = code === 'rate_limited' || code === 'server_error' || code === 'timeout';
    const retryAfterMs = extractRetryAfter(error) ?? getDefaultRetryDelay(code);

    return new UnifiedAIError(code, error.message, providerId, retryable, retryAfterMs, error);
  }

  // Handle network/connection errors
  if (error instanceof Error) {
    if (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('fetch failed') ||
      error.message.includes('network')
    ) {
      return new UnifiedAIError('network_error', error.message, providerId, true, 5000, error);
    }

    if (error.message.includes('timeout') || error.message.includes('AbortError')) {
      return new UnifiedAIError('timeout', error.message, providerId, true, 5000, error);
    }

    return new UnifiedAIError('unknown', error.message, providerId, false, undefined, error);
  }

  return new UnifiedAIError('unknown', String(error), providerId, false, undefined, error);
}

/**
 * Parse any error based on provider
 */
export function parseProviderError(error: unknown, providerId: ProviderId): UnifiedAIError {
  if (providerId === 'claude') {
    return parseAnthropicError(error, providerId);
  }
  return parseOpenAIError(error, providerId);
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier (e.g., 2 for exponential) */
  backoffMultiplier: number;
  /** Add random jitter to delays */
  jitter: boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  serverRetryAfter?: number
): number {
  // Respect server's retry-after if provided and reasonable
  if (serverRetryAfter && serverRetryAfter > 0 && serverRetryAfter < config.maxDelayMs) {
    return serverRetryAfter;
  }

  // Calculate exponential backoff
  let delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);

  // Cap at maximum
  delay = Math.min(delay, config.maxDelayMs);

  // Add jitter (±25%)
  if (config.jitter) {
    const jitterRange = delay * 0.25;
    delay = delay - jitterRange + Math.random() * jitterRange * 2;
  }

  return Math.floor(delay);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with automatic retry on failure
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  providerId: ProviderId,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: UnifiedAIError | null = null;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = parseProviderError(error, providerId);

      // Don't retry non-retryable errors
      if (!lastError.shouldRetry()) {
        throw lastError;
      }

      // Don't retry if we've exhausted attempts
      if (attempt === finalConfig.maxRetries) {
        throw lastError;
      }

      // Calculate and wait for retry delay
      const delay = calculateRetryDelay(attempt, finalConfig, lastError.retryAfterMs);

      // Log retry attempt (could be replaced with proper logging)
      console.warn(
        `[${providerId}] Request failed with ${lastError.code}, retrying in ${delay}ms (attempt ${attempt + 1}/${finalConfig.maxRetries})`
      );

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError ?? new UnifiedAIError('unknown', 'Retry failed', providerId, false);
}

/**
 * Create a retry wrapper for a specific provider
 */
export function createRetryWrapper(
  providerId: ProviderId,
  config: Partial<RetryConfig> = {}
): <T>(fn: () => Promise<T>) => Promise<T> {
  return <T>(fn: () => Promise<T>) => withRetry(fn, providerId, config);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract retry-after value from error (in milliseconds)
 */
function extractRetryAfter(error: unknown): number | undefined {
  // Check error message for retry-after hints
  if (error instanceof Error) {
    // Match patterns like "retry after 30 seconds" or "retry-after: 30"
    const match = error.message.match(/retry.?after[:\s]*(\d+)/i);
    if (match) {
      const value = parseInt(match[1], 10);
      // If value seems like seconds, convert to ms
      return value < 1000 ? value * 1000 : value;
    }
  }

  // Check for headers (Anthropic errors may have these)
  if (error && typeof error === 'object' && 'headers' in error) {
    const headers = (error as { headers?: Record<string, string> }).headers;
    if (headers?.['retry-after']) {
      const value = parseInt(headers['retry-after'], 10);
      return value < 1000 ? value * 1000 : value;
    }
  }

  return undefined;
}

/**
 * Get default retry delay based on error code
 */
function getDefaultRetryDelay(code: UnifiedErrorCode): number {
  switch (code) {
    case 'rate_limited':
      return 60000; // 1 minute for rate limits
    case 'server_error':
      return 5000; // 5 seconds for server errors
    case 'timeout':
      return 2000; // 2 seconds for timeouts
    case 'network_error':
      return 3000; // 3 seconds for network errors
    default:
      return 5000;
  }
}

// ============================================================================
// ERROR RECOVERY STRATEGIES
// ============================================================================

/**
 * Error recovery options
 */
export interface ErrorRecoveryOptions {
  /** Try a fallback provider on failure */
  fallbackProvider?: ProviderId;
  /** Reduce context and retry on context_too_long */
  reduceContextOnOverflow?: boolean;
  /** Custom recovery function */
  customRecovery?: (error: UnifiedAIError) => Promise<boolean>;
}

/**
 * Determine if an error can be recovered with a fallback
 */
export function canRecoverWithFallback(error: UnifiedAIError): boolean {
  // Can fallback on provider-specific issues
  return (
    error.code === 'rate_limited' ||
    error.code === 'server_error' ||
    error.code === 'model_unavailable' ||
    error.code === 'timeout'
  );
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: UnifiedAIError): string {
  switch (error.code) {
    case 'rate_limited':
      return `The AI service is currently busy. Please wait a moment and try again.`;
    case 'context_too_long':
      return `The conversation is too long. Try starting a new conversation or removing some earlier messages.`;
    case 'auth_failed':
      return `Authentication failed. Please check your API key configuration.`;
    case 'model_unavailable':
      return `The selected model is currently unavailable. Please try a different model.`;
    case 'content_filtered':
      return `Your message was filtered by the AI's content policy. Please rephrase your request.`;
    case 'network_error':
      return `Network error. Please check your internet connection and try again.`;
    case 'timeout':
      return `The request timed out. Please try again.`;
    case 'server_error':
      return `The AI service encountered an error. Please try again in a moment.`;
    default:
      return `An unexpected error occurred. Please try again.`;
  }
}

/**
 * Check if error should be reported to monitoring
 */
export function shouldReportError(error: UnifiedAIError): boolean {
  // Don't report expected/recoverable errors
  if (
    error.code === 'rate_limited' ||
    error.code === 'context_too_long' ||
    error.code === 'content_filtered'
  ) {
    return false;
  }

  // Always report auth failures (potential security issue)
  if (error.code === 'auth_failed') {
    return true;
  }

  // Report server errors and unknowns
  return error.code === 'server_error' || error.code === 'unknown';
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Re-export main error class
  UnifiedAIError,
} from '../types';
