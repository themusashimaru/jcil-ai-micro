/**
 * API RETRY UTILITY - MEDIUM-011 FIX
 *
 * Provides retry logic for failed API requests with:
 * - Exponential backoff
 * - Configurable retry conditions
 * - Abort controller support
 * - Error type handling
 */

import { TIMEOUTS } from '@/lib/constants';

// ============================================================================
// TYPES
// ============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in ms between retries (default: 30000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Custom function to determine if error should trigger retry */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback called before each retry */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

export interface FetchWithRetryOptions extends RetryOptions, Omit<RequestInit, 'signal'> {
  /** Optional abort signal from parent */
  signal?: AbortSignal;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  timeout: TIMEOUTS.API_REQUEST,
};

// ============================================================================
// RETRY STATUS CODES
// ============================================================================

/**
 * HTTP status codes that should trigger a retry
 * - 408: Request Timeout
 * - 429: Too Many Requests (rate limited)
 * - 500: Internal Server Error
 * - 502: Bad Gateway
 * - 503: Service Unavailable
 * - 504: Gateway Timeout
 */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Error names that should trigger a retry
 */
const RETRYABLE_ERROR_NAMES = new Set([
  'TypeError', // Network errors
  'AbortError', // Timeouts (from our abort controller)
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNREFUSED',
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Default retry condition checker
 */
function defaultShouldRetry(error: unknown, _attempt: number): boolean {
  // Check for network errors
  if (error instanceof TypeError) {
    return true;
  }

  // Check for specific error names
  if (error instanceof Error) {
    if (RETRYABLE_ERROR_NAMES.has(error.name)) {
      return true;
    }
  }

  // Check for response-based errors
  if (error instanceof Response) {
    return RETRYABLE_STATUS_CODES.has(error.status);
  }

  // Check for error objects with status
  if (typeof error === 'object' && error !== null && 'status' in error) {
    return RETRYABLE_STATUS_CODES.has((error as { status: number }).status);
  }

  return false;
}

/**
 * Calculate delay for exponential backoff with jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep for specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// RETRY WRAPPER
// ============================================================================

/**
 * Wraps an async function with retry logic
 *
 * @example
 * const result = await retry(
 *   async () => {
 *     const res = await fetch('/api/data');
 *     if (!res.ok) throw res;
 *     return res.json();
 *   },
 *   { maxRetries: 3 }
 * );
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    initialDelay = DEFAULT_OPTIONS.initialDelay,
    maxDelay = DEFAULT_OPTIONS.maxDelay,
    backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt <= maxRetries && shouldRetry(error, attempt)) {
        const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
        onRetry?.(error, attempt, delay);
        await sleep(delay);
        continue;
      }

      // No more retries, throw the error
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

// ============================================================================
// FETCH WITH RETRY
// ============================================================================

/**
 * Fetch with automatic retry and timeout
 *
 * @example
 * const response = await fetchWithRetry('/api/data', {
 *   method: 'POST',
 *   body: JSON.stringify({ data }),
 *   maxRetries: 3,
 *   timeout: 30000,
 * });
 */
export async function fetchWithRetry(
  url: string | URL,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    initialDelay = DEFAULT_OPTIONS.initialDelay,
    maxDelay = DEFAULT_OPTIONS.maxDelay,
    backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
    timeout = DEFAULT_OPTIONS.timeout,
    shouldRetry = defaultShouldRetry,
    onRetry,
    signal: parentSignal,
    ...fetchOptions
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Link parent signal if provided
    if (parentSignal) {
      if (parentSignal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('Aborted', 'AbortError');
      }
      parentSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check for retryable status codes
      if (!response.ok && RETRYABLE_STATUS_CODES.has(response.status)) {
        if (attempt <= maxRetries && shouldRetry(response, attempt)) {
          const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);

          // For 429 responses, respect Retry-After header if present
          const retryAfter = response.headers.get('Retry-After');
          const retryDelay = retryAfter
            ? Math.min(parseInt(retryAfter, 10) * 1000, maxDelay)
            : delay;

          onRetry?.(response, attempt, retryDelay);
          await sleep(retryDelay);
          continue;
        }
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      // Don't retry if explicitly aborted by parent
      if (parentSignal?.aborted) {
        throw error;
      }

      // Check if we should retry
      if (attempt <= maxRetries && shouldRetry(error, attempt)) {
        const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
        onRetry?.(error, attempt, delay);
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

// ============================================================================
// JSON FETCH WITH RETRY
// ============================================================================

/**
 * Fetch JSON with automatic retry and parsing
 *
 * @example
 * const data = await fetchJsonWithRetry<User>('/api/user', {
 *   method: 'GET',
 *   maxRetries: 3,
 * });
 */
export async function fetchJsonWithRetry<T>(
  url: string | URL,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw Object.assign(new Error(errorData.error || `HTTP ${response.status}`), {
      status: response.status,
      data: errorData,
    });
  }

  return response.json();
}

// ============================================================================
// EXPORTS
// ============================================================================

export { RETRYABLE_STATUS_CODES, RETRYABLE_ERROR_NAMES, defaultShouldRetry, calculateDelay };
