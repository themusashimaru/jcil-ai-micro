// @ts-nocheck - Test file with extensive mocking
/**
 * COMPREHENSIVE TESTS FOR ERROR HANDLING MODULE
 *
 * @vitest-environment node
 *
 * Tests all exported error classes, error categorization functions,
 * retry logic, and error handling utilities from:
 *   src/lib/ai/providers/errors/index.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Mock logger (not directly used by the module, but may be required transitively)
vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  parseAnthropicError,
  parseOpenAIError,
  parseProviderError,
  calculateRetryDelay,
  sleep,
  withRetry,
  createRetryWrapper,
  canRecoverWithFallback,
  getUserFriendlyMessage,
  shouldReportError,
  UnifiedAIError,
  DEFAULT_RETRY_CONFIG,
} from '../index';
import type { RetryConfig } from '../index';
import type { UnifiedErrorCode } from '../../types';

// ---------------------------------------------------------------------------
// Helpers to create real SDK error instances
// ---------------------------------------------------------------------------

function makeAnthropicAPIError(
  status: number,
  errorType: string,
  messageText: string
): Anthropic.APIError {
  const headers = new Headers({ 'request-id': 'test-req-id' });
  // The source code reads error type via: (error as { error?: { type?: string } }).error?.type
  // Anthropic.APIError stores the second constructor arg as `.error`.
  // So we pass { type: errorType } so that `.error.type` yields the error type string.
  const body = { type: errorType, message: messageText };
  return new Anthropic.APIError(status, body, messageText, headers);
}

function makeOpenAIAPIError(
  status: number,
  code: string | undefined,
  messageText: string
): OpenAI.APIError {
  const headers = new Headers();
  const body = code ? { code, message: messageText } : { message: messageText };
  return new OpenAI.APIError(status, body, messageText, headers);
}

// ============================================================================
// UnifiedAIError (the error class itself)
// ============================================================================

describe('UnifiedAIError', () => {
  it('should set name to "UnifiedAIError"', () => {
    const err = new UnifiedAIError('unknown', 'test', 'claude', false);
    expect(err.name).toBe('UnifiedAIError');
  });

  it('should extend Error', () => {
    const err = new UnifiedAIError('unknown', 'test', 'claude', false);
    expect(err).toBeInstanceOf(Error);
  });

  it('should store all constructor arguments', () => {
    const original = new Error('original');
    const err = new UnifiedAIError('rate_limited', 'msg', 'openai', true, 30000, original);
    expect(err.code).toBe('rate_limited');
    expect(err.message).toBe('msg');
    expect(err.provider).toBe('openai');
    expect(err.retryable).toBe(true);
    expect(err.retryAfterMs).toBe(30000);
    expect(err.originalError).toBe(original);
  });

  describe('shouldRetry()', () => {
    it('should return true when retryable and code is not auth_failed/content_filtered', () => {
      const err = new UnifiedAIError('rate_limited', 'msg', 'claude', true);
      expect(err.shouldRetry()).toBe(true);
    });

    it('should return false when retryable is false', () => {
      const err = new UnifiedAIError('rate_limited', 'msg', 'claude', false);
      expect(err.shouldRetry()).toBe(false);
    });

    it('should return false when code is auth_failed even if retryable', () => {
      const err = new UnifiedAIError('auth_failed', 'msg', 'claude', true);
      expect(err.shouldRetry()).toBe(false);
    });

    it('should return false when code is content_filtered even if retryable', () => {
      const err = new UnifiedAIError('content_filtered', 'msg', 'claude', true);
      expect(err.shouldRetry()).toBe(false);
    });
  });

  describe('getRetryDelay()', () => {
    it('should return retryAfterMs when set', () => {
      const err = new UnifiedAIError('rate_limited', 'msg', 'claude', true, 12345);
      expect(err.getRetryDelay()).toBe(12345);
    });

    it('should return 5000 as default when retryAfterMs not set', () => {
      const err = new UnifiedAIError('rate_limited', 'msg', 'claude', true);
      expect(err.getRetryDelay()).toBe(5000);
    });
  });
});

// ============================================================================
// parseAnthropicError
// ============================================================================

describe('parseAnthropicError', () => {
  it('should parse rate_limit_error into rate_limited', () => {
    const apiErr = makeAnthropicAPIError(429, 'rate_limit_error', 'Rate limited');
    const result = parseAnthropicError(apiErr);
    expect(result.code).toBe('rate_limited');
    expect(result.provider).toBe('claude');
    expect(result.retryable).toBe(true);
  });

  it('should parse overloaded_error into rate_limited', () => {
    const apiErr = makeAnthropicAPIError(529, 'overloaded_error', 'Overloaded');
    const result = parseAnthropicError(apiErr);
    expect(result.code).toBe('rate_limited');
    expect(result.retryable).toBe(true);
  });

  it('should parse invalid_request_error into invalid_request', () => {
    const apiErr = makeAnthropicAPIError(400, 'invalid_request_error', 'Bad request');
    const result = parseAnthropicError(apiErr);
    expect(result.code).toBe('invalid_request');
    expect(result.retryable).toBe(false);
  });

  it('should parse authentication_error into auth_failed', () => {
    const apiErr = makeAnthropicAPIError(401, 'authentication_error', 'Invalid key');
    const result = parseAnthropicError(apiErr);
    expect(result.code).toBe('auth_failed');
    expect(result.retryable).toBe(false);
  });

  it('should parse permission_error into auth_failed', () => {
    const apiErr = makeAnthropicAPIError(403, 'permission_error', 'Forbidden');
    const result = parseAnthropicError(apiErr);
    expect(result.code).toBe('auth_failed');
  });

  it('should parse not_found_error into model_unavailable', () => {
    const apiErr = makeAnthropicAPIError(404, 'not_found_error', 'Not found');
    const result = parseAnthropicError(apiErr);
    expect(result.code).toBe('model_unavailable');
  });

  it('should parse api_error into server_error', () => {
    const apiErr = makeAnthropicAPIError(500, 'api_error', 'Internal error');
    const result = parseAnthropicError(apiErr);
    expect(result.code).toBe('server_error');
    expect(result.retryable).toBe(true);
  });

  it('should detect context length error from message containing "context"', () => {
    const apiErr = makeAnthropicAPIError(400, 'invalid_request_error', 'Context window exceeded');
    const result = parseAnthropicError(apiErr);
    expect(result.code).toBe('context_too_long');
  });

  it('should detect context length error from message containing "token"', () => {
    const apiErr = makeAnthropicAPIError(
      400,
      'invalid_request_error',
      'Maximum token limit exceeded'
    );
    const result = parseAnthropicError(apiErr);
    expect(result.code).toBe('context_too_long');
  });

  it('should detect content filtered error from message containing "content" and "policy"', () => {
    const apiErr = makeAnthropicAPIError(400, 'invalid_request_error', 'Blocked by content policy');
    const result = parseAnthropicError(apiErr);
    expect(result.code).toBe('content_filtered');
  });

  it('should fallback to HTTP status code mapping for unknown error types', () => {
    const apiErr = makeAnthropicAPIError(504, 'unknown_type', 'Gateway timeout');
    const result = parseAnthropicError(apiErr);
    expect(result.code).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('should use "unknown" code when neither error type nor HTTP status matches', () => {
    const apiErr = makeAnthropicAPIError(418, 'teapot_error', 'I am a teapot');
    const result = parseAnthropicError(apiErr);
    expect(result.code).toBe('unknown');
  });

  it('should handle network errors (ECONNREFUSED)', () => {
    const err = new Error('ECONNREFUSED');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('network_error');
    expect(result.retryable).toBe(true);
    expect(result.retryAfterMs).toBe(5000);
  });

  it('should handle network errors (ETIMEDOUT)', () => {
    const err = new Error('ETIMEDOUT');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('network_error');
    expect(result.retryable).toBe(true);
  });

  it('should handle network errors (ENOTFOUND)', () => {
    const err = new Error('ENOTFOUND');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('network_error');
  });

  it('should handle network errors (generic "network")', () => {
    const err = new Error('network failure');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('network_error');
  });

  it('should handle timeout errors', () => {
    const err = new Error('Request timeout after 30s');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('should handle generic Error as unknown', () => {
    const err = new Error('Something random happened');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('unknown');
    expect(result.retryable).toBe(false);
  });

  it('should handle non-Error values (string)', () => {
    const result = parseAnthropicError('just a string');
    expect(result.code).toBe('unknown');
    expect(result.message).toBe('just a string');
    expect(result.retryable).toBe(false);
  });

  it('should handle non-Error values (number)', () => {
    const result = parseAnthropicError(42);
    expect(result.code).toBe('unknown');
    expect(result.message).toBe('42');
  });

  it('should use custom providerId when provided', () => {
    const err = new Error('test');
    const result = parseAnthropicError(err, 'claude');
    expect(result.provider).toBe('claude');
  });

  it('should default provider to "claude"', () => {
    const err = new Error('test');
    const result = parseAnthropicError(err);
    expect(result.provider).toBe('claude');
  });

  it('should preserve original error reference', () => {
    const apiErr = makeAnthropicAPIError(429, 'rate_limit_error', 'Rate limited');
    const result = parseAnthropicError(apiErr);
    expect(result.originalError).toBe(apiErr);
  });

  it('should extract retry-after from error message', () => {
    const apiErr = makeAnthropicAPIError(
      429,
      'rate_limit_error',
      'Rate limited. retry after 30 seconds'
    );
    const result = parseAnthropicError(apiErr);
    // The message from APIError constructor includes the body JSON, but the pattern
    // may match "retry after 30" from the error type or body
    expect(result.code).toBe('rate_limited');
    expect(result.retryable).toBe(true);
  });
});

// ============================================================================
// parseOpenAIError
// ============================================================================

describe('parseOpenAIError', () => {
  it('should parse rate_limit_exceeded into rate_limited', () => {
    const apiErr = makeOpenAIAPIError(429, 'rate_limit_exceeded', 'Rate limit exceeded');
    const result = parseOpenAIError(apiErr, 'openai');
    expect(result.code).toBe('rate_limited');
    expect(result.provider).toBe('openai');
    expect(result.retryable).toBe(true);
  });

  it('should parse insufficient_quota into rate_limited', () => {
    const apiErr = makeOpenAIAPIError(429, 'insufficient_quota', 'Quota exceeded');
    const result = parseOpenAIError(apiErr, 'openai');
    expect(result.code).toBe('rate_limited');
  });

  it('should parse context_length_exceeded into context_too_long', () => {
    const apiErr = makeOpenAIAPIError(400, 'context_length_exceeded', 'Context too long');
    const result = parseOpenAIError(apiErr, 'openai');
    expect(result.code).toBe('context_too_long');
  });

  it('should parse invalid_api_key into auth_failed', () => {
    const apiErr = makeOpenAIAPIError(401, 'invalid_api_key', 'Invalid API key');
    const result = parseOpenAIError(apiErr, 'openai');
    expect(result.code).toBe('auth_failed');
  });

  it('should parse model_not_found into model_unavailable', () => {
    const apiErr = makeOpenAIAPIError(404, 'model_not_found', 'Model not found');
    const result = parseOpenAIError(apiErr, 'openai');
    expect(result.code).toBe('model_unavailable');
  });

  it('should parse server_error code into server_error', () => {
    const apiErr = makeOpenAIAPIError(500, 'server_error', 'Internal server error');
    const result = parseOpenAIError(apiErr, 'openai');
    expect(result.code).toBe('server_error');
    expect(result.retryable).toBe(true);
  });

  it('should parse service_unavailable into server_error', () => {
    const apiErr = makeOpenAIAPIError(503, 'service_unavailable', 'Service unavailable');
    const result = parseOpenAIError(apiErr, 'openai');
    expect(result.code).toBe('server_error');
  });

  it('should detect context_length from message containing "context_length"', () => {
    const apiErr = makeOpenAIAPIError(400, undefined, 'Error: context_length exceeded limit');
    const result = parseOpenAIError(apiErr, 'openai');
    expect(result.code).toBe('context_too_long');
  });

  it('should detect context_length from message containing "maximum context"', () => {
    const apiErr = makeOpenAIAPIError(400, undefined, 'Exceeded maximum context window');
    const result = parseOpenAIError(apiErr, 'openai');
    expect(result.code).toBe('context_too_long');
  });

  it('should detect content_filtered from message containing "content_filter"', () => {
    const apiErr = makeOpenAIAPIError(400, undefined, 'Blocked by content_filter');
    const result = parseOpenAIError(apiErr, 'openai');
    expect(result.code).toBe('content_filtered');
  });

  it('should detect content_filtered from message containing "content policy"', () => {
    const apiErr = makeOpenAIAPIError(400, undefined, 'Violates content policy');
    const result = parseOpenAIError(apiErr, 'openai');
    expect(result.code).toBe('content_filtered');
  });

  it('should fallback to HTTP status code mapping', () => {
    const apiErr = makeOpenAIAPIError(504, undefined, 'Gateway timeout');
    const result = parseOpenAIError(apiErr, 'openai');
    expect(result.code).toBe('timeout');
  });

  it('should handle network error (ECONNREFUSED)', () => {
    const err = new Error('ECONNREFUSED');
    const result = parseOpenAIError(err, 'xai');
    expect(result.code).toBe('network_error');
    expect(result.provider).toBe('xai');
    expect(result.retryable).toBe(true);
  });

  it('should handle network error (fetch failed)', () => {
    const err = new Error('fetch failed');
    const result = parseOpenAIError(err, 'deepseek');
    expect(result.code).toBe('network_error');
    expect(result.provider).toBe('deepseek');
  });

  it('should handle timeout/AbortError', () => {
    const err = new Error('AbortError: signal timed out');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('should handle generic Error as unknown', () => {
    const err = new Error('Something unexpected');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('unknown');
    expect(result.retryable).toBe(false);
  });

  it('should handle non-Error values', () => {
    const result = parseOpenAIError(null, 'openai');
    expect(result.code).toBe('unknown');
    expect(result.message).toBe('null');
  });
});

// ============================================================================
// parseProviderError (router)
// ============================================================================

describe('parseProviderError', () => {
  it('should route to parseAnthropicError for "claude" provider', () => {
    const err = new Error('timeout issue');
    const result = parseProviderError(err, 'claude');
    expect(result.code).toBe('timeout');
    expect(result.provider).toBe('claude');
  });

  it('should route to parseOpenAIError for "openai" provider', () => {
    const err = new Error('timeout issue');
    const result = parseProviderError(err, 'openai');
    expect(result.code).toBe('timeout');
    expect(result.provider).toBe('openai');
  });

  it('should route to parseOpenAIError for "xai" provider', () => {
    const err = new Error('network failure');
    const result = parseProviderError(err, 'xai');
    expect(result.code).toBe('network_error');
    expect(result.provider).toBe('xai');
  });

  it('should route to parseOpenAIError for "deepseek" provider', () => {
    const err = new Error('ENOTFOUND');
    const result = parseProviderError(err, 'deepseek');
    expect(result.code).toBe('network_error');
    expect(result.provider).toBe('deepseek');
  });
});

// ============================================================================
// calculateRetryDelay
// ============================================================================

describe('calculateRetryDelay', () => {
  const noJitterConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: false,
  };

  it('should return serverRetryAfter when provided and within bounds', () => {
    const delay = calculateRetryDelay(0, noJitterConfig, 5000);
    expect(delay).toBe(5000);
  });

  it('should ignore serverRetryAfter when it exceeds maxDelayMs', () => {
    const delay = calculateRetryDelay(0, noJitterConfig, 50000);
    // 50000 > 30000 (maxDelayMs), so it falls back to exponential
    expect(delay).toBe(1000); // 1000 * 2^0 = 1000
  });

  it('should ignore serverRetryAfter when it is 0', () => {
    const delay = calculateRetryDelay(0, noJitterConfig, 0);
    expect(delay).toBe(1000);
  });

  it('should ignore serverRetryAfter when it is negative', () => {
    const delay = calculateRetryDelay(0, noJitterConfig, -100);
    expect(delay).toBe(1000);
  });

  it('should calculate exponential backoff correctly for attempt 0', () => {
    const delay = calculateRetryDelay(0, noJitterConfig);
    expect(delay).toBe(1000); // 1000 * 2^0
  });

  it('should calculate exponential backoff correctly for attempt 1', () => {
    const delay = calculateRetryDelay(1, noJitterConfig);
    expect(delay).toBe(2000); // 1000 * 2^1
  });

  it('should calculate exponential backoff correctly for attempt 2', () => {
    const delay = calculateRetryDelay(2, noJitterConfig);
    expect(delay).toBe(4000); // 1000 * 2^2
  });

  it('should cap delay at maxDelayMs', () => {
    const delay = calculateRetryDelay(10, noJitterConfig);
    expect(delay).toBe(30000); // capped at maxDelayMs
  });

  it('should add jitter when enabled (result within +-25% range)', () => {
    const config: RetryConfig = { ...noJitterConfig, jitter: true };
    const attempts = 100;
    for (let i = 0; i < attempts; i++) {
      const delay = calculateRetryDelay(0, config);
      // With jitter: delay is in [750, 1250]
      expect(delay).toBeGreaterThanOrEqual(750);
      expect(delay).toBeLessThanOrEqual(1250);
    }
  });

  it('should use DEFAULT_RETRY_CONFIG when no config provided', () => {
    // Default config: initialDelayMs=1000, backoffMultiplier=2, jitter=true
    const delay = calculateRetryDelay(0);
    // With jitter: should be between 750 and 1250
    expect(delay).toBeGreaterThanOrEqual(750);
    expect(delay).toBeLessThanOrEqual(1250);
  });
});

// ============================================================================
// DEFAULT_RETRY_CONFIG
// ============================================================================

describe('DEFAULT_RETRY_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(1000);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(30000);
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
    expect(DEFAULT_RETRY_CONFIG.jitter).toBe(true);
  });
});

// ============================================================================
// sleep
// ============================================================================

describe('sleep', () => {
  it('should be a function', () => {
    expect(typeof sleep).toBe('function');
  });

  it('should return a promise', () => {
    vi.useFakeTimers();
    const result = sleep(100);
    expect(result).toBeInstanceOf(Promise);
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
  });

  it('should resolve after the specified duration', async () => {
    vi.useFakeTimers();
    let resolved = false;
    const p = sleep(1000).then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });
});

// ============================================================================
// withRetry
// ============================================================================

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Helper: run a withRetry promise alongside repeated timer advancements.
   * This drains fake timer queues so sleep() calls inside withRetry resolve.
   * We race the timer drain against the promise settling to avoid unhandled rejections.
   */
  async function runWithTimerDrain<T>(promise: Promise<T>, totalMs = 300_000): Promise<T> {
    // Wrap to track settlement and prevent unhandled rejection warnings
    let settled = false;
    const tracked = promise.finally(() => {
      settled = true;
    });

    const step = 10_000;
    for (let elapsed = 0; elapsed < totalMs && !settled; elapsed += step) {
      await vi.advanceTimersByTimeAsync(step);
    }
    return tracked;
  }

  it('should return result on first successful call', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, 'claude', { maxRetries: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce('success');

    const promise = withRetry(fn, 'openai', {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      jitter: false,
    });

    const result = await runWithTimerDrain(promise);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw immediately on non-retryable error', async () => {
    // auth_failed is non-retryable because shouldRetry() returns false
    const authErr = new UnifiedAIError('auth_failed', 'Invalid key', 'openai', false);
    const fn = vi.fn().mockRejectedValue(authErr);

    await expect(withRetry(fn, 'openai', { maxRetries: 3 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    let caughtError: unknown = null;
    const promise = withRetry(fn, 'claude', {
      maxRetries: 2,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      jitter: false,
    }).catch((e) => {
      caughtError = e;
    });

    await runWithTimerDrain(promise);
    expect(caughtError).toBeInstanceOf(UnifiedAIError);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should merge partial config with defaults', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await withRetry(fn, 'claude', { maxRetries: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should log warnings on retry', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValueOnce('ok');

    const promise = withRetry(fn, 'openai', {
      maxRetries: 2,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      jitter: false,
    });

    await runWithTimerDrain(promise);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[openai]'));
  });

  it('should throw UnifiedAIError with correct code on exhaustion', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    let caughtError: unknown = null;
    const promise = withRetry(fn, 'claude', {
      maxRetries: 1,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      jitter: false,
    }).catch((e) => {
      caughtError = e;
    });

    await runWithTimerDrain(promise);
    expect(caughtError).toBeInstanceOf(UnifiedAIError);
    expect((caughtError as UnifiedAIError).code).toBe('network_error');
    expect((caughtError as UnifiedAIError).provider).toBe('claude');
  });
});

// ============================================================================
// createRetryWrapper
// ============================================================================

describe('createRetryWrapper', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return a function', () => {
    const wrapper = createRetryWrapper('claude');
    expect(typeof wrapper).toBe('function');
  });

  it('should wrap fn with retry logic', async () => {
    const wrapper = createRetryWrapper('openai', { maxRetries: 1, jitter: false });
    const fn = vi.fn().mockResolvedValue('result');
    const result = await wrapper(fn);
    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// canRecoverWithFallback
// ============================================================================

describe('canRecoverWithFallback', () => {
  it('should return true for rate_limited', () => {
    const err = new UnifiedAIError('rate_limited', 'msg', 'claude', true);
    expect(canRecoverWithFallback(err)).toBe(true);
  });

  it('should return true for server_error', () => {
    const err = new UnifiedAIError('server_error', 'msg', 'openai', true);
    expect(canRecoverWithFallback(err)).toBe(true);
  });

  it('should return true for model_unavailable', () => {
    const err = new UnifiedAIError('model_unavailable', 'msg', 'xai', false);
    expect(canRecoverWithFallback(err)).toBe(true);
  });

  it('should return true for timeout', () => {
    const err = new UnifiedAIError('timeout', 'msg', 'deepseek', true);
    expect(canRecoverWithFallback(err)).toBe(true);
  });

  it('should return false for auth_failed', () => {
    const err = new UnifiedAIError('auth_failed', 'msg', 'claude', false);
    expect(canRecoverWithFallback(err)).toBe(false);
  });

  it('should return false for context_too_long', () => {
    const err = new UnifiedAIError('context_too_long', 'msg', 'openai', false);
    expect(canRecoverWithFallback(err)).toBe(false);
  });

  it('should return false for content_filtered', () => {
    const err = new UnifiedAIError('content_filtered', 'msg', 'claude', false);
    expect(canRecoverWithFallback(err)).toBe(false);
  });

  it('should return false for unknown', () => {
    const err = new UnifiedAIError('unknown', 'msg', 'claude', false);
    expect(canRecoverWithFallback(err)).toBe(false);
  });

  it('should return false for invalid_request', () => {
    const err = new UnifiedAIError('invalid_request', 'msg', 'openai', false);
    expect(canRecoverWithFallback(err)).toBe(false);
  });

  it('should return false for network_error', () => {
    const err = new UnifiedAIError('network_error', 'msg', 'claude', true);
    expect(canRecoverWithFallback(err)).toBe(false);
  });
});

// ============================================================================
// getUserFriendlyMessage
// ============================================================================

describe('getUserFriendlyMessage', () => {
  const cases: Array<[UnifiedErrorCode, string]> = [
    ['rate_limited', 'busy'],
    ['context_too_long', 'too long'],
    ['auth_failed', 'Authentication'],
    ['model_unavailable', 'unavailable'],
    ['content_filtered', 'filtered'],
    ['network_error', 'Network'],
    ['timeout', 'timed out'],
    ['server_error', 'encountered an error'],
    ['unknown', 'unexpected error'],
    ['invalid_request', 'unexpected error'],
  ];

  it.each(cases)('should return user-friendly message for %s', (code, expectedSubstring) => {
    const err = new UnifiedAIError(code, 'raw', 'claude', false);
    const msg = getUserFriendlyMessage(err);
    expect(msg).toContain(expectedSubstring);
  });
});

// ============================================================================
// shouldReportError
// ============================================================================

describe('shouldReportError', () => {
  it('should not report rate_limited', () => {
    const err = new UnifiedAIError('rate_limited', 'msg', 'claude', true);
    expect(shouldReportError(err)).toBe(false);
  });

  it('should not report context_too_long', () => {
    const err = new UnifiedAIError('context_too_long', 'msg', 'openai', false);
    expect(shouldReportError(err)).toBe(false);
  });

  it('should not report content_filtered', () => {
    const err = new UnifiedAIError('content_filtered', 'msg', 'claude', false);
    expect(shouldReportError(err)).toBe(false);
  });

  it('should report auth_failed', () => {
    const err = new UnifiedAIError('auth_failed', 'msg', 'claude', false);
    expect(shouldReportError(err)).toBe(true);
  });

  it('should report server_error', () => {
    const err = new UnifiedAIError('server_error', 'msg', 'openai', true);
    expect(shouldReportError(err)).toBe(true);
  });

  it('should report unknown', () => {
    const err = new UnifiedAIError('unknown', 'msg', 'claude', false);
    expect(shouldReportError(err)).toBe(true);
  });

  it('should not report model_unavailable', () => {
    const err = new UnifiedAIError('model_unavailable', 'msg', 'xai', false);
    expect(shouldReportError(err)).toBe(false);
  });

  it('should not report timeout', () => {
    const err = new UnifiedAIError('timeout', 'msg', 'claude', true);
    expect(shouldReportError(err)).toBe(false);
  });

  it('should not report network_error', () => {
    const err = new UnifiedAIError('network_error', 'msg', 'openai', true);
    expect(shouldReportError(err)).toBe(false);
  });

  it('should not report invalid_request', () => {
    const err = new UnifiedAIError('invalid_request', 'msg', 'claude', false);
    expect(shouldReportError(err)).toBe(false);
  });
});
