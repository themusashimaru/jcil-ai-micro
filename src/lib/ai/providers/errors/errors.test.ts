// @ts-nocheck - Test file with extensive mocking
/**
 * ERROR HANDLING MODULE TESTS
 *
 * Comprehensive tests for the AI provider error handling module.
 * Tests error parsing, retry logic, recovery strategies, and utility functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
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
  DEFAULT_RETRY_CONFIG,
  UnifiedAIError,
} from './index';
import type { RetryConfig } from './index';

// ============================================================================
// MOCK HELPERS
// ============================================================================

/**
 * Create a mock Headers object that satisfies both SDK constructors.
 */
function createMockHeaders(): Headers {
  return new Headers();
}

/**
 * Create a mock Anthropic API error.
 * The Anthropic SDK's APIError constructor requires specific params.
 */
function createAnthropicError(
  status: number,
  message: string,
  errorType?: string
): Anthropic.APIError {
  const headers = createMockHeaders();
  const error = new Anthropic.APIError(status, { type: 'error', message }, message, headers);
  // Set the nested error type if provided
  if (errorType) {
    Object.defineProperty(error, 'error', {
      value: { type: errorType },
      writable: true,
    });
  }
  return error;
}

/**
 * Create a mock OpenAI API error.
 */
function createOpenAIError(status: number, message: string, code?: string): OpenAI.APIError {
  const headers = createMockHeaders();
  const error = new OpenAI.APIError(status, { message, code }, message, headers);
  if (code) {
    Object.defineProperty(error, 'code', {
      value: code,
      writable: true,
    });
  }
  return error;
}

// ============================================================================
// parseAnthropicError
// ============================================================================

describe('parseAnthropicError', () => {
  it('should parse rate_limit_error correctly', () => {
    const err = createAnthropicError(429, 'Rate limit exceeded', 'rate_limit_error');
    const result = parseAnthropicError(err);
    expect(result).toBeInstanceOf(UnifiedAIError);
    expect(result.code).toBe('rate_limited');
    expect(result.provider).toBe('claude');
    expect(result.retryable).toBe(true);
  });

  it('should parse authentication_error correctly', () => {
    const err = createAnthropicError(401, 'Invalid API key', 'authentication_error');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('auth_failed');
    expect(result.retryable).toBe(false);
  });

  it('should parse overloaded_error as rate_limited', () => {
    const err = createAnthropicError(529, 'Overloaded', 'overloaded_error');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('rate_limited');
    expect(result.retryable).toBe(true);
  });

  it('should detect context/token errors in message', () => {
    const err = createAnthropicError(400, 'Request exceeds maximum context length');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('context_too_long');
  });

  it('should detect token keyword in message', () => {
    const err = createAnthropicError(400, 'Too many tokens in request');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('context_too_long');
  });

  it('should detect content policy errors', () => {
    const err = createAnthropicError(400, 'Request violates content policy guidelines');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('content_filtered');
  });

  it('should fall back to HTTP status code mapping', () => {
    const err = createAnthropicError(503, 'Service unavailable');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('server_error');
    expect(result.retryable).toBe(true);
  });

  it('should handle network errors (non-API errors)', () => {
    const err = new Error('ECONNREFUSED');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('network_error');
    expect(result.retryable).toBe(true);
    expect(result.retryAfterMs).toBe(5000);
  });

  it('should handle ETIMEDOUT errors', () => {
    const err = new Error('ETIMEDOUT');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('network_error');
  });

  it('should handle ENOTFOUND errors', () => {
    const err = new Error('ENOTFOUND api.anthropic.com');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('network_error');
  });

  it('should handle timeout errors from message text', () => {
    const err = new Error('Request timeout after 30s');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('should handle unknown errors gracefully', () => {
    const err = new Error('Something unexpected happened');
    const result = parseAnthropicError(err);
    expect(result.code).toBe('unknown');
    expect(result.retryable).toBe(false);
  });

  it('should handle non-Error objects', () => {
    const result = parseAnthropicError('string error');
    expect(result.code).toBe('unknown');
    expect(result.message).toBe('string error');
  });

  it('should handle null/undefined', () => {
    const result = parseAnthropicError(null);
    expect(result.code).toBe('unknown');
  });

  it('should accept a custom provider ID', () => {
    const err = new Error('fail');
    const result = parseAnthropicError(err, 'claude');
    expect(result.provider).toBe('claude');
  });
});

// ============================================================================
// parseOpenAIError
// ============================================================================

describe('parseOpenAIError', () => {
  it('should parse rate_limit_exceeded correctly', () => {
    const err = createOpenAIError(429, 'Rate limit exceeded', 'rate_limit_exceeded');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('rate_limited');
    expect(result.retryable).toBe(true);
    expect(result.provider).toBe('openai');
  });

  it('should parse insufficient_quota as rate_limited', () => {
    const err = createOpenAIError(429, 'Insufficient quota', 'insufficient_quota');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('rate_limited');
  });

  it('should parse invalid_api_key correctly', () => {
    const err = createOpenAIError(401, 'Invalid API key', 'invalid_api_key');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('auth_failed');
    expect(result.retryable).toBe(false);
  });

  it('should parse context_length_exceeded correctly', () => {
    const err = createOpenAIError(400, 'Context too long', 'context_length_exceeded');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('context_too_long');
  });

  it('should parse model_not_found correctly', () => {
    const err = createOpenAIError(404, 'Model not found', 'model_not_found');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('model_unavailable');
  });

  it('should detect context_length in message', () => {
    const err = createOpenAIError(400, 'Exceeded context_length limit');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('context_too_long');
  });

  it('should detect maximum context in message', () => {
    const err = createOpenAIError(400, 'Request exceeds maximum context window');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('context_too_long');
  });

  it('should detect content_filter in message', () => {
    const err = createOpenAIError(400, 'Blocked by content_filter');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('content_filtered');
  });

  it('should detect content policy in message', () => {
    const err = createOpenAIError(400, 'Violates content policy');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('content_filtered');
  });

  it('should fall back to HTTP status code mapping', () => {
    const err = createOpenAIError(503, 'Service unavailable');
    const result = parseOpenAIError(err, 'xai');
    expect(result.code).toBe('server_error');
    expect(result.provider).toBe('xai');
  });

  it('should handle network errors', () => {
    const err = new Error('fetch failed');
    const result = parseOpenAIError(err, 'deepseek');
    expect(result.code).toBe('network_error');
    expect(result.provider).toBe('deepseek');
  });

  it('should handle AbortError as timeout', () => {
    const err = new Error('AbortError: signal timed out');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('timeout');
  });

  it('should handle unknown Error objects', () => {
    const err = new Error('Something weird');
    const result = parseOpenAIError(err, 'openai');
    expect(result.code).toBe('unknown');
    expect(result.retryable).toBe(false);
  });

  it('should handle non-Error objects', () => {
    const result = parseOpenAIError(42, 'openai');
    expect(result.code).toBe('unknown');
    expect(result.message).toBe('42');
  });
});

// ============================================================================
// parseProviderError
// ============================================================================

describe('parseProviderError', () => {
  it('should route claude errors to parseAnthropicError', () => {
    const err = new Error('ECONNREFUSED');
    const result = parseProviderError(err, 'claude');
    expect(result.code).toBe('network_error');
    expect(result.provider).toBe('claude');
  });

  it('should route openai errors to parseOpenAIError', () => {
    const err = new Error('fetch failed');
    const result = parseProviderError(err, 'openai');
    expect(result.code).toBe('network_error');
  });

  it('should route xai errors to parseOpenAIError', () => {
    const err = new Error('timeout');
    const result = parseProviderError(err, 'xai');
    expect(result.code).toBe('timeout');
  });

  it('should route deepseek errors to parseOpenAIError', () => {
    const result = parseProviderError(new Error('generic'), 'deepseek');
    expect(result.provider).toBe('deepseek');
  });

  it('should route google errors to parseOpenAIError', () => {
    const result = parseProviderError(new Error('generic'), 'google');
    expect(result.provider).toBe('google');
  });
});

// ============================================================================
// RETRY LOGIC
// ============================================================================

describe('DEFAULT_RETRY_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(1000);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(30000);
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
    expect(DEFAULT_RETRY_CONFIG.jitter).toBe(true);
  });
});

describe('calculateRetryDelay', () => {
  const noJitterConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    jitter: false,
  };

  it('should calculate exponential backoff without jitter', () => {
    expect(calculateRetryDelay(0, noJitterConfig)).toBe(1000); // 1000 * 2^0
    expect(calculateRetryDelay(1, noJitterConfig)).toBe(2000); // 1000 * 2^1
    expect(calculateRetryDelay(2, noJitterConfig)).toBe(4000); // 1000 * 2^2
    expect(calculateRetryDelay(3, noJitterConfig)).toBe(8000); // 1000 * 2^3
  });

  it('should cap delay at maxDelayMs', () => {
    const config: RetryConfig = { ...noJitterConfig, maxDelayMs: 5000 };
    expect(calculateRetryDelay(10, config)).toBe(5000);
  });

  it('should respect server retry-after if reasonable', () => {
    expect(calculateRetryDelay(0, noJitterConfig, 15000)).toBe(15000);
  });

  it('should ignore server retry-after if it exceeds maxDelayMs', () => {
    expect(calculateRetryDelay(0, noJitterConfig, 999999)).toBe(1000);
  });

  it('should ignore server retry-after if zero or negative', () => {
    expect(calculateRetryDelay(0, noJitterConfig, 0)).toBe(1000);
    expect(calculateRetryDelay(0, noJitterConfig, -100)).toBe(1000);
  });

  it('should apply jitter within +-25% range', () => {
    const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, jitter: true };
    // Run multiple times to test jitter range
    for (let i = 0; i < 20; i++) {
      const delay = calculateRetryDelay(0, config);
      // Base is 1000, jitter +-25% => 750 to 1250
      expect(delay).toBeGreaterThanOrEqual(750);
      expect(delay).toBeLessThanOrEqual(1250);
    }
  });

  it('should return an integer', () => {
    const delay = calculateRetryDelay(0, DEFAULT_RETRY_CONFIG);
    expect(Number.isInteger(delay)).toBe(true);
  });
});

describe('sleep', () => {
  it('should resolve after the specified duration', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow small timing variance
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, 'claude', { maxRetries: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce('recovered');

    // Run withRetry but we need to handle the sleep inside
    vi.useRealTimers();
    // Use a short retry config to speed up test
    const result = await withRetry(fn, 'claude', {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 50,
      jitter: false,
    });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw immediately on non-retryable errors', async () => {
    vi.useRealTimers();
    const fn = vi.fn().mockRejectedValue(new Error('Invalid API key'));

    await expect(withRetry(fn, 'claude', { maxRetries: 3, initialDelayMs: 10 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after exhausting all retries', async () => {
    vi.useRealTimers();
    const fn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      withRetry(fn, 'claude', {
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 20,
        jitter: false,
      })
    ).rejects.toThrow();
    // 1 initial + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('createRetryWrapper', () => {
  it('should create a wrapper that retries with the given config', async () => {
    const wrapper = createRetryWrapper('openai', {
      maxRetries: 1,
      initialDelayMs: 10,
      jitter: false,
    });
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await wrapper(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// ERROR RECOVERY STRATEGIES
// ============================================================================

describe('canRecoverWithFallback', () => {
  it('should return true for rate_limited', () => {
    const err = new UnifiedAIError('rate_limited', 'Rate limited', 'claude', true);
    expect(canRecoverWithFallback(err)).toBe(true);
  });

  it('should return true for server_error', () => {
    const err = new UnifiedAIError('server_error', 'Server error', 'openai', true);
    expect(canRecoverWithFallback(err)).toBe(true);
  });

  it('should return true for model_unavailable', () => {
    const err = new UnifiedAIError('model_unavailable', 'Not found', 'xai', false);
    expect(canRecoverWithFallback(err)).toBe(true);
  });

  it('should return true for timeout', () => {
    const err = new UnifiedAIError('timeout', 'Timed out', 'deepseek', true);
    expect(canRecoverWithFallback(err)).toBe(true);
  });

  it('should return false for auth_failed', () => {
    const err = new UnifiedAIError('auth_failed', 'Bad key', 'claude', false);
    expect(canRecoverWithFallback(err)).toBe(false);
  });

  it('should return false for content_filtered', () => {
    const err = new UnifiedAIError('content_filtered', 'Filtered', 'openai', false);
    expect(canRecoverWithFallback(err)).toBe(false);
  });

  it('should return false for context_too_long', () => {
    const err = new UnifiedAIError('context_too_long', 'Too long', 'claude', false);
    expect(canRecoverWithFallback(err)).toBe(false);
  });

  it('should return false for unknown', () => {
    const err = new UnifiedAIError('unknown', 'Unknown', 'claude', false);
    expect(canRecoverWithFallback(err)).toBe(false);
  });
});

// ============================================================================
// getUserFriendlyMessage
// ============================================================================

describe('getUserFriendlyMessage', () => {
  const testCases: Array<{ code: string; contains: string }> = [
    { code: 'rate_limited', contains: 'busy' },
    { code: 'context_too_long', contains: 'too long' },
    { code: 'auth_failed', contains: 'Authentication' },
    { code: 'model_unavailable', contains: 'unavailable' },
    { code: 'content_filtered', contains: 'filtered' },
    { code: 'network_error', contains: 'Network' },
    { code: 'timeout', contains: 'timed out' },
    { code: 'server_error', contains: 'error' },
    { code: 'unknown', contains: 'unexpected' },
  ];

  for (const { code, contains } of testCases) {
    it(`should return a user-friendly message for ${code}`, () => {
      const err = new UnifiedAIError(code as never, 'test', 'claude', false);
      const msg = getUserFriendlyMessage(err);
      expect(msg.toLowerCase()).toContain(contains.toLowerCase());
    });
  }

  it('should never expose raw error details', () => {
    const err = new UnifiedAIError('server_error', 'Internal stack trace here', 'claude', true);
    const msg = getUserFriendlyMessage(err);
    expect(msg).not.toContain('stack trace');
  });
});

// ============================================================================
// shouldReportError
// ============================================================================

describe('shouldReportError', () => {
  it('should NOT report rate_limited errors', () => {
    const err = new UnifiedAIError('rate_limited', 'test', 'claude', true);
    expect(shouldReportError(err)).toBe(false);
  });

  it('should NOT report context_too_long errors', () => {
    const err = new UnifiedAIError('context_too_long', 'test', 'claude', false);
    expect(shouldReportError(err)).toBe(false);
  });

  it('should NOT report content_filtered errors', () => {
    const err = new UnifiedAIError('content_filtered', 'test', 'openai', false);
    expect(shouldReportError(err)).toBe(false);
  });

  it('should report auth_failed errors', () => {
    const err = new UnifiedAIError('auth_failed', 'test', 'claude', false);
    expect(shouldReportError(err)).toBe(true);
  });

  it('should report server_error errors', () => {
    const err = new UnifiedAIError('server_error', 'test', 'openai', true);
    expect(shouldReportError(err)).toBe(true);
  });

  it('should report unknown errors', () => {
    const err = new UnifiedAIError('unknown', 'test', 'xai', false);
    expect(shouldReportError(err)).toBe(true);
  });

  it('should NOT report network_error, timeout, model_unavailable, invalid_request', () => {
    for (const code of [
      'network_error',
      'timeout',
      'model_unavailable',
      'invalid_request',
    ] as const) {
      const err = new UnifiedAIError(code, 'test', 'claude', false);
      expect(shouldReportError(err)).toBe(false);
    }
  });
});

// ============================================================================
// UnifiedAIError (re-exported from types)
// ============================================================================

describe('UnifiedAIError', () => {
  it('should be an instance of Error', () => {
    const err = new UnifiedAIError('unknown', 'msg', 'claude', false);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('UnifiedAIError');
  });

  it('shouldRetry returns true for retryable errors', () => {
    const err = new UnifiedAIError('server_error', 'msg', 'claude', true);
    expect(err.shouldRetry()).toBe(true);
  });

  it('shouldRetry returns false for auth_failed even if retryable flag set', () => {
    const err = new UnifiedAIError('auth_failed', 'msg', 'claude', true);
    expect(err.shouldRetry()).toBe(false);
  });

  it('shouldRetry returns false for content_filtered even if retryable flag set', () => {
    const err = new UnifiedAIError('content_filtered', 'msg', 'claude', true);
    expect(err.shouldRetry()).toBe(false);
  });

  it('getRetryDelay returns retryAfterMs when set', () => {
    const err = new UnifiedAIError('rate_limited', 'msg', 'claude', true, 10000);
    expect(err.getRetryDelay()).toBe(10000);
  });

  it('getRetryDelay returns 5000 when retryAfterMs is not set', () => {
    const err = new UnifiedAIError('server_error', 'msg', 'claude', true);
    expect(err.getRetryDelay()).toBe(5000);
  });

  it('should preserve original error', () => {
    const original = new Error('original');
    const err = new UnifiedAIError('unknown', 'wrapped', 'claude', false, undefined, original);
    expect(err.originalError).toBe(original);
  });
});
