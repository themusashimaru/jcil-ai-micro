import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock constants
vi.mock('@/lib/constants', () => ({
  TIMEOUTS: {
    API_REQUEST: 30_000,
    LONG_API_REQUEST: 120_000,
  },
}));

import {
  retry,
  fetchWithRetry,
  fetchJsonWithRetry,
  RETRYABLE_STATUS_CODES,
  RETRYABLE_ERROR_NAMES,
  defaultShouldRetry,
  calculateDelay,
} from './retry';

describe('retry utility', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateDelay', () => {
    it('should calculate exponential delay', () => {
      // First attempt: initialDelay * 2^0 = 1000
      const delay1 = calculateDelay(1, 1000, 30000, 2);
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(1300); // With 30% jitter

      // Second attempt: initialDelay * 2^1 = 2000
      const delay2 = calculateDelay(2, 1000, 30000, 2);
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThanOrEqual(2600);
    });

    it('should cap at maxDelay', () => {
      const delay = calculateDelay(10, 1000, 5000, 2);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it('should add jitter', () => {
      // Run multiple times - at least one should differ
      const delays = new Set<number>();
      for (let i = 0; i < 20; i++) {
        delays.add(Math.round(calculateDelay(1, 1000, 30000, 2)));
      }
      // With jitter, we should get varied results
      expect(delays.size).toBeGreaterThan(1);
    });
  });

  describe('defaultShouldRetry', () => {
    it('should retry on TypeError (network errors)', () => {
      expect(defaultShouldRetry(new TypeError('Failed to fetch'), 1)).toBe(true);
    });

    it('should retry on retryable error names', () => {
      for (const name of RETRYABLE_ERROR_NAMES) {
        const error = new Error('test');
        error.name = name;
        expect(defaultShouldRetry(error, 1)).toBe(true);
      }
    });

    it('should retry on retryable status codes', () => {
      for (const status of RETRYABLE_STATUS_CODES) {
        expect(defaultShouldRetry({ status }, 1)).toBe(true);
      }
    });

    it('should NOT retry on 400 Bad Request', () => {
      expect(defaultShouldRetry({ status: 400 }, 1)).toBe(false);
    });

    it('should NOT retry on 401 Unauthorized', () => {
      expect(defaultShouldRetry({ status: 401 }, 1)).toBe(false);
    });

    it('should NOT retry on 403 Forbidden', () => {
      expect(defaultShouldRetry({ status: 403 }, 1)).toBe(false);
    });

    it('should NOT retry on 404 Not Found', () => {
      expect(defaultShouldRetry({ status: 404 }, 1)).toBe(false);
    });

    it('should NOT retry on unknown error types', () => {
      expect(defaultShouldRetry('some string error', 1)).toBe(false);
    });
  });

  describe('RETRYABLE_STATUS_CODES', () => {
    it('should include 408, 429, 500, 502, 503, 504', () => {
      expect(RETRYABLE_STATUS_CODES.has(408)).toBe(true);
      expect(RETRYABLE_STATUS_CODES.has(429)).toBe(true);
      expect(RETRYABLE_STATUS_CODES.has(500)).toBe(true);
      expect(RETRYABLE_STATUS_CODES.has(502)).toBe(true);
      expect(RETRYABLE_STATUS_CODES.has(503)).toBe(true);
      expect(RETRYABLE_STATUS_CODES.has(504)).toBe(true);
    });

    it('should NOT include client errors', () => {
      expect(RETRYABLE_STATUS_CODES.has(400)).toBe(false);
      expect(RETRYABLE_STATUS_CODES.has(401)).toBe(false);
      expect(RETRYABLE_STATUS_CODES.has(403)).toBe(false);
      expect(RETRYABLE_STATUS_CODES.has(404)).toBe(false);
    });
  });

  describe('retry()', () => {
    it('should return result on first successful attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn, { maxRetries: 3, initialDelay: 10 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce('success');

      const result = await retry(fn, { maxRetries: 3, initialDelay: 10 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exhausted', async () => {
      const error = new TypeError('Failed to fetch');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(retry(fn, { maxRetries: 2, initialDelay: 10 })).rejects.toThrow(
        'Failed to fetch'
      );
      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should NOT retry on non-retryable error', async () => {
      const error = new Error('not retryable');
      error.name = 'ValidationError';
      const fn = vi.fn().mockRejectedValue(error);

      await expect(retry(fn, { maxRetries: 3, initialDelay: 10 })).rejects.toThrow('not retryable');
      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should call onRetry callback before each retry', async () => {
      const onRetry = vi.fn();
      const error = new TypeError('network');
      const fn = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('ok');

      await retry(fn, { maxRetries: 3, initialDelay: 10, onRetry });
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(error, 1, expect.any(Number));
      expect(onRetry).toHaveBeenCalledWith(error, 2, expect.any(Number));
    });

    it('should respect custom shouldRetry', async () => {
      const shouldRetry = vi.fn().mockReturnValue(false);
      const fn = vi.fn().mockRejectedValue(new TypeError('network'));

      await expect(retry(fn, { maxRetries: 3, initialDelay: 10, shouldRetry })).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1); // Custom shouldRetry prevented retry
    });
  });

  describe('fetchWithRetry()', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch);
      mockFetch.mockReset();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return response on success', async () => {
      const response = new Response('ok', { status: 200 });
      mockFetch.mockResolvedValueOnce(response);

      const result = await fetchWithRetry('/api/test', {
        maxRetries: 1,
        initialDelay: 10,
        timeout: 5000,
      });
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 500 error', async () => {
      const error500 = new Response('error', { status: 500 });
      const success = new Response('ok', { status: 200 });
      mockFetch.mockResolvedValueOnce(error500).mockResolvedValueOnce(success);

      const result = await fetchWithRetry('/api/test', {
        maxRetries: 2,
        initialDelay: 10,
        timeout: 5000,
      });
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on network error (TypeError)', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const result = await fetchWithRetry('/api/test', {
        maxRetries: 1,
        initialDelay: 10,
        timeout: 5000,
      });
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 400 client error', async () => {
      const response = new Response('bad request', { status: 400 });
      mockFetch.mockResolvedValueOnce(response);

      const result = await fetchWithRetry('/api/test', {
        maxRetries: 3,
        initialDelay: 10,
        timeout: 5000,
      });
      expect(result.status).toBe(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should abort immediately when parent signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        fetchWithRetry('/api/test', {
          signal: controller.signal,
          maxRetries: 3,
          initialDelay: 10,
          timeout: 5000,
        })
      ).rejects.toThrow('Aborted');
    });

    it('should pass fetch options through', async () => {
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      await fetchWithRetry('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' }),
        maxRetries: 0,
        initialDelay: 10,
        timeout: 5000,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"data":"test"}',
        })
      );
    });
  });

  describe('fetchJsonWithRetry()', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch);
      mockFetch.mockReset();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should parse JSON response', async () => {
      const body = JSON.stringify({ name: 'test' });
      mockFetch.mockResolvedValueOnce(
        new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await fetchJsonWithRetry<{ name: string }>('/api/test', {
        maxRetries: 0,
        initialDelay: 10,
        timeout: 5000,
      });
      expect(result).toEqual({ name: 'test' });
    });

    it('should throw on non-ok response with error message', async () => {
      const body = JSON.stringify({ error: 'Not found' });
      mockFetch.mockResolvedValueOnce(
        new Response(body, {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(
        fetchJsonWithRetry('/api/test', { maxRetries: 0, initialDelay: 10, timeout: 5000 })
      ).rejects.toThrow('Not found');
    });

    it('should set JSON content-type headers', async () => {
      const body = JSON.stringify({ data: 'ok' });
      mockFetch.mockResolvedValueOnce(
        new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      await fetchJsonWithRetry('/api/test', {
        maxRetries: 0,
        initialDelay: 10,
        timeout: 5000,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        })
      );
    });
  });
});
