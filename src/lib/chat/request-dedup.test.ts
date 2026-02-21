/**
 * TEST-002: Request Deduplication Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { isDuplicateRequest, clearRequest, getDedupStats } from './request-dedup';

describe('Request Deduplication', () => {
  beforeEach(() => {
    // Clear state between tests
    clearRequest('test-user', 'any message');
  });

  describe('isDuplicateRequest', () => {
    it('should allow first request', () => {
      expect(isDuplicateRequest('user-1', 'Hello world')).toBe(false);
    });

    it('should detect duplicate within dedup window', () => {
      isDuplicateRequest('user-1', 'duplicate message');
      expect(isDuplicateRequest('user-1', 'duplicate message')).toBe(true);
    });

    it('should allow different messages from same user', () => {
      isDuplicateRequest('user-1', 'message one');
      expect(isDuplicateRequest('user-1', 'message two')).toBe(false);
    });

    it('should allow same message from different users', () => {
      isDuplicateRequest('user-1', 'same message');
      expect(isDuplicateRequest('user-2', 'same message')).toBe(false);
    });

    it('should allow same message after dedup window expires', async () => {
      isDuplicateRequest('user-1', 'test message');
      // Wait past the 500ms dedup window
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(isDuplicateRequest('user-1', 'test message')).toBe(false);
    });

    it('should normalize content (case-insensitive, trimmed)', () => {
      isDuplicateRequest('user-1', '  Hello World  ');
      expect(isDuplicateRequest('user-1', 'hello world')).toBe(true);
    });

    it('should only use first 500 chars for hash', () => {
      const longMessage = 'a'.repeat(1000);
      const differentSuffix = 'a'.repeat(500) + 'b'.repeat(500);
      isDuplicateRequest('user-1', longMessage);
      // Should be duplicate since first 500 chars are the same
      expect(isDuplicateRequest('user-1', differentSuffix)).toBe(true);
    });
  });

  describe('clearRequest', () => {
    it('should clear a tracked request', () => {
      isDuplicateRequest('user-1', 'cleared message');
      clearRequest('user-1', 'cleared message');
      expect(isDuplicateRequest('user-1', 'cleared message')).toBe(false);
    });
  });

  describe('getDedupStats', () => {
    it('should return current cache stats', () => {
      isDuplicateRequest('user-1', 'message 1');
      isDuplicateRequest('user-2', 'message 2');
      const stats = getDedupStats();
      expect(stats.size).toBeGreaterThanOrEqual(2);
      expect(stats.oldestAge).toBeGreaterThanOrEqual(0);
    });
  });
});
