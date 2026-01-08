import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkRateLimit,
  rateLimiters,
  resetRateLimit,
  clearAllRateLimits,
  getRateLimitStatus,
  _internal,
} from './rate-limit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    clearAllRateLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    _internal.stopCleanup();
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    const config = { limit: 5, windowMs: 60_000 };

    it('should allow first request', () => {
      const result = checkRateLimit('test-user', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should decrement remaining on each request', () => {
      checkRateLimit('test-user-2', config);
      const result = checkRateLimit('test-user-2', config);
      expect(result.remaining).toBe(3);
    });

    it('should block after limit exceeded', () => {
      const id = 'test-user-3';
      for (let i = 0; i < 5; i++) {
        checkRateLimit(id, config);
      }
      const result = checkRateLimit(id, config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should reset after window expires', () => {
      const id = 'test-user-4';
      for (let i = 0; i < 5; i++) {
        checkRateLimit(id, config);
      }

      // Advance time past window
      vi.advanceTimersByTime(61_000);

      const result = checkRateLimit(id, config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should track different identifiers separately', () => {
      checkRateLimit('user-a', config);
      checkRateLimit('user-a', config);
      checkRateLimit('user-a', config);

      const resultA = checkRateLimit('user-a', config);
      const resultB = checkRateLimit('user-b', config);

      expect(resultA.remaining).toBe(1);
      expect(resultB.remaining).toBe(4);
    });

    it('should calculate retryAfter correctly', () => {
      const id = 'test-user-5';
      for (let i = 0; i < 5; i++) {
        checkRateLimit(id, config);
      }

      vi.advanceTimersByTime(30_000); // 30 seconds

      const result = checkRateLimit(id, config);
      expect(result.retryAfter).toBeLessThanOrEqual(30);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('rateLimiters', () => {
    describe('chat', () => {
      it('should use lower limit for free users', () => {
        const result = rateLimiters.chat('free-user', false);
        expect(result.remaining).toBe(4); // CHAT_FREE_PER_MINUTE - 1 = 5 - 1 = 4
      });

      it('should use higher limit for paid users', () => {
        const result = rateLimiters.chat('paid-user', true);
        expect(result.remaining).toBe(29); // CHAT_PAID_PER_MINUTE - 1 = 30 - 1 = 29
      });
    });

    describe('api', () => {
      it('should limit API requests', () => {
        const result = rateLimiters.api('api-client');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(59); // API_REQUESTS_PER_MINUTE - 1
      });
    });

    describe('login', () => {
      it('should limit login attempts', () => {
        const result = rateLimiters.login('user@example.com');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9); // LOGIN_ATTEMPTS_PER_HOUR - 1
      });

      it('should block after too many login attempts', () => {
        const email = 'blocked@example.com';
        for (let i = 0; i < 10; i++) {
          rateLimiters.login(email);
        }
        const result = rateLimiters.login(email);
        expect(result.allowed).toBe(false);
      });
    });

    describe('passwordReset', () => {
      it('should limit password reset requests', () => {
        const result = rateLimiters.passwordReset('user@example.com');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2); // PASSWORD_RESET_PER_HOUR - 1
      });
    });

    describe('supportTicket', () => {
      it('should limit support ticket submissions', () => {
        const result = rateLimiters.supportTicket('user-id');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2); // SUPPORT_TICKETS_PER_HOUR - 1
      });
    });

    describe('imageGeneration', () => {
      it('should limit image generation requests', () => {
        const result = rateLimiters.imageGeneration('user-id');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4); // IMAGE_GEN_PER_MINUTE - 1
      });
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for identifier', () => {
      const config = { limit: 2, windowMs: 60_000 };
      const id = 'reset-test';

      checkRateLimit(id, config);
      checkRateLimit(id, config);
      expect(checkRateLimit(id, config).allowed).toBe(false);

      resetRateLimit(id);
      expect(checkRateLimit(id, config).allowed).toBe(true);
    });
  });

  describe('clearAllRateLimits', () => {
    it('should clear all rate limits', () => {
      const config = { limit: 1, windowMs: 60_000 };

      checkRateLimit('user-1', config);
      checkRateLimit('user-2', config);
      checkRateLimit('user-3', config);

      expect(checkRateLimit('user-1', config).allowed).toBe(false);
      expect(checkRateLimit('user-2', config).allowed).toBe(false);

      clearAllRateLimits();

      expect(checkRateLimit('user-1', config).allowed).toBe(true);
      expect(checkRateLimit('user-2', config).allowed).toBe(true);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return status without incrementing', () => {
      const config = { limit: 5, windowMs: 60_000 };
      const id = 'status-test';

      checkRateLimit(id, config);
      checkRateLimit(id, config);

      const status = getRateLimitStatus(id, config);
      expect(status.remaining).toBe(3);

      // Should still be 3 after status check
      const status2 = getRateLimitStatus(id, config);
      expect(status2.remaining).toBe(3);
    });

    it('should return full limit for new identifier', () => {
      const config = { limit: 10, windowMs: 60_000 };
      const status = getRateLimitStatus('new-user', config);
      expect(status.remaining).toBe(10);
      expect(status.allowed).toBe(true);
    });
  });

  describe('window expiration', () => {
    it('should handle expired windows correctly', () => {
      const config = { limit: 3, windowMs: 1000 };
      const id = 'expire-test';

      checkRateLimit(id, config);
      checkRateLimit(id, config);
      checkRateLimit(id, config);

      expect(checkRateLimit(id, config).allowed).toBe(false);

      vi.advanceTimersByTime(1001);

      const result = checkRateLimit(id, config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });

  describe('concurrent requests', () => {
    it('should handle rapid requests correctly', () => {
      const config = { limit: 100, windowMs: 60_000 };
      const id = 'rapid-test';

      for (let i = 0; i < 50; i++) {
        const result = checkRateLimit(id, config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(100 - (i + 1));
      }
    });
  });
});
