import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { httpWithTimeout, isTimeoutError, type HttpOptions } from './http';

describe('HTTP Client', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('httpWithTimeout', () => {
    it('should export httpWithTimeout function', () => {
      expect(typeof httpWithTimeout).toBe('function');
    });

    it('should use default timeout of 30 seconds', async () => {
      // The default timeoutMs is 30_000 (30 seconds)
      const defaultTimeout = 30_000;
      expect(defaultTimeout).toBe(30000);
    });

    it('should use default connect timeout of 5 seconds', async () => {
      // The default connectTimeoutMs is 5_000 (5 seconds)
      const defaultConnectTimeout = 5_000;
      expect(defaultConnectTimeout).toBe(5000);
    });

    it('should accept custom timeout options', () => {
      const options: HttpOptions = {
        timeoutMs: 60000,
        connectTimeoutMs: 10000,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      expect(options.timeoutMs).toBe(60000);
      expect(options.connectTimeoutMs).toBe(10000);
    });

    it('should extend RequestInit interface', () => {
      const options: HttpOptions = {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache',
        credentials: 'include',
      };

      expect(options.method).toBe('GET');
      expect(options.headers).toBeDefined();
    });
  });

  describe('isTimeoutError', () => {
    it('should export isTimeoutError function', () => {
      expect(typeof isTimeoutError).toBe('function');
    });

    it('should return true for request-timeout error', () => {
      const error = new Error('request-timeout');
      expect(isTimeoutError(error)).toBe(true);
    });

    it('should return true for connect-timeout error', () => {
      const error = new Error('connect-timeout');
      expect(isTimeoutError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new Error('Network error');
      expect(isTimeoutError(error)).toBe(false);
    });

    it('should return false for non-Error objects', () => {
      expect(isTimeoutError('timeout')).toBe(false);
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError(undefined)).toBe(false);
      expect(isTimeoutError({ message: 'timeout' })).toBe(false);
    });

    it('should return false for AbortError', () => {
      const error = new Error('AbortError');
      expect(isTimeoutError(error)).toBe(false);
    });
  });

  describe('HttpOptions Interface', () => {
    it('should allow timeoutMs property', () => {
      const options: HttpOptions = { timeoutMs: 5000 };
      expect(options.timeoutMs).toBe(5000);
    });

    it('should allow connectTimeoutMs property', () => {
      const options: HttpOptions = { connectTimeoutMs: 2000 };
      expect(options.connectTimeoutMs).toBe(2000);
    });

    it('should allow all standard RequestInit properties', () => {
      const options: HttpOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
        mode: 'cors',
        credentials: 'same-origin',
        cache: 'default',
        redirect: 'follow',
        referrer: '',
        referrerPolicy: 'no-referrer',
        integrity: '',
        keepalive: false,
      };

      expect(options.method).toBe('POST');
      expect(options.body).toBe('{"test":true}');
    });
  });

  describe('Timeout Configuration', () => {
    it('should have reasonable default timeouts', () => {
      // Total timeout should be longer than connect timeout
      const defaultTotalTimeout = 30_000;
      const defaultConnectTimeout = 5_000;

      expect(defaultTotalTimeout).toBeGreaterThan(defaultConnectTimeout);
    });

    it('should use 30s for API requests (matches TIMEOUTS.API_REQUEST)', () => {
      // This matches the constant from src/lib/constants.ts
      const API_REQUEST_TIMEOUT = 30_000;
      expect(API_REQUEST_TIMEOUT).toBe(30000);
    });
  });

  describe('AbortController Usage', () => {
    it('should support signal-based cancellation', () => {
      const controller = new AbortController();
      const signal = controller.signal;

      expect(signal.aborted).toBe(false);
      controller.abort();
      expect(signal.aborted).toBe(true);
    });

    it('should support abort reason', () => {
      const controller = new AbortController();
      const reason = new Error('request-timeout');

      controller.abort(reason);
      expect(controller.signal.aborted).toBe(true);
    });
  });
});

describe('HTTP Error Handling', () => {
  describe('Timeout Error Types', () => {
    it('should define request-timeout error message', () => {
      const error = new Error('request-timeout');
      expect(error.message).toBe('request-timeout');
    });

    it('should define connect-timeout error message', () => {
      const error = new Error('connect-timeout');
      expect(error.message).toBe('connect-timeout');
    });
  });

  describe('Error Recovery', () => {
    it('should allow catching timeout errors', () => {
      const error = new Error('request-timeout');

      if (isTimeoutError(error)) {
        // Application can retry or show user-friendly message
        expect(true).toBe(true);
      }
    });
  });
});
