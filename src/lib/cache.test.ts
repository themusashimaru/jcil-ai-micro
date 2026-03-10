/**
 * Cache Layer Tests
 *
 * Tests for Redis-backed caching with in-memory fallback:
 * - cachedWebSearch: cache hit/miss, TTL, error handling
 * - cached: generic cache operations
 * - invalidateCache: key removal
 * - clearMemoryCache: full clear
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// We need to control the redis module state between tests
// Since cache.ts uses a module-level `redis` variable, we reset modules each test
describe('Cache Layer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Ensure no Redis env vars (use in-memory fallback)
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  // ===========================================================================
  // cachedWebSearch
  // ===========================================================================
  describe('cachedWebSearch', () => {
    it('should return fresh data on cache miss', async () => {
      const { cachedWebSearch } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue({ results: ['a', 'b'] });

      const result = await cachedWebSearch('test query', fetchFn);

      expect(result.cached).toBe(false);
      expect(result.data).toEqual({ results: ['a', 'b'] });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should return cached data on cache hit', async () => {
      const { cachedWebSearch } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue({ results: ['a', 'b'] });

      // First call - cache miss
      await cachedWebSearch('test query', fetchFn);
      // Second call - cache hit
      const result = await cachedWebSearch('test query', fetchFn);

      expect(result.cached).toBe(true);
      expect(result.data).toEqual({ results: ['a', 'b'] });
      expect(fetchFn).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should normalize query for cache key (case insensitive)', async () => {
      const { cachedWebSearch } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue({ results: ['x'] });

      await cachedWebSearch('Test Query', fetchFn);
      const result = await cachedWebSearch('test query', fetchFn);

      expect(result.cached).toBe(true);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should normalize query for cache key (trim whitespace)', async () => {
      const { cachedWebSearch } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue({ results: ['x'] });

      await cachedWebSearch('  test query  ', fetchFn);
      const result = await cachedWebSearch('test query', fetchFn);

      expect(result.cached).toBe(true);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should use default TTL of 1800 seconds', async () => {
      const { cachedWebSearch } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue({ data: 1 });

      const result = await cachedWebSearch('query', fetchFn);

      expect(result.cached).toBe(false);
      expect(result.data).toEqual({ data: 1 });
    });

    it('should accept custom TTL', async () => {
      const { cachedWebSearch } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue({ data: 1 });

      const result = await cachedWebSearch('query', fetchFn, 60);

      expect(result.cached).toBe(false);
      expect(result.data).toEqual({ data: 1 });
    });

    it('should treat different queries as different cache keys', async () => {
      const { cachedWebSearch } = await import('./cache');
      const fetchFn1 = vi.fn().mockResolvedValue({ q: 'first' });
      const fetchFn2 = vi.fn().mockResolvedValue({ q: 'second' });

      await cachedWebSearch('query one', fetchFn1);
      const result = await cachedWebSearch('query two', fetchFn2);

      expect(result.cached).toBe(false);
      expect(result.data).toEqual({ q: 'second' });
      expect(fetchFn2).toHaveBeenCalledTimes(1);
    });

    it('should handle fetchFn that throws', async () => {
      const { cachedWebSearch } = await import('./cache');
      const fetchFn = vi.fn().mockRejectedValue(new Error('Network failure'));

      await expect(cachedWebSearch('query', fetchFn)).rejects.toThrow('Network failure');
    });

    it('should handle complex data types', async () => {
      const { cachedWebSearch } = await import('./cache');
      const complexData = {
        results: [{ id: 1, nested: { deep: true } }],
        meta: { total: 100, page: 1 },
      };
      const fetchFn = vi.fn().mockResolvedValue(complexData);

      await cachedWebSearch('complex query', fetchFn);
      const result = await cachedWebSearch('complex query', fetchFn);

      expect(result.cached).toBe(true);
      expect(result.data).toEqual(complexData);
    });
  });

  // ===========================================================================
  // cached (generic)
  // ===========================================================================
  describe('cached', () => {
    it('should return fresh data on cache miss', async () => {
      const { cached } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue({ value: 42 });

      const result = await cached('my-key', fetchFn);

      expect(result.cached).toBe(false);
      expect(result.data).toEqual({ value: 42 });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should return cached data on cache hit', async () => {
      const { cached } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue({ value: 42 });

      await cached('my-key', fetchFn);
      const result = await cached('my-key', fetchFn);

      expect(result.cached).toBe(true);
      expect(result.data).toEqual({ value: 42 });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should use the exact key provided (no hashing)', async () => {
      const { cached } = await import('./cache');
      const fetchFn1 = vi.fn().mockResolvedValue('val1');
      const fetchFn2 = vi.fn().mockResolvedValue('val2');

      await cached('key-a', fetchFn1);
      await cached('key-b', fetchFn2);

      const result1 = await cached('key-a', vi.fn());
      const result2 = await cached('key-b', vi.fn());

      expect(result1.data).toBe('val1');
      expect(result2.data).toBe('val2');
    });

    it('should use default TTL of 300 seconds', async () => {
      const { cached } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue('data');

      const result = await cached('key', fetchFn);
      expect(result.cached).toBe(false);
    });

    it('should accept custom TTL', async () => {
      const { cached } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue('data');

      const result = await cached('key', fetchFn, 60);
      expect(result.cached).toBe(false);
    });

    it('should handle fetchFn errors', async () => {
      const { cached } = await import('./cache');
      const fetchFn = vi.fn().mockRejectedValue(new Error('DB down'));

      await expect(cached('key', fetchFn)).rejects.toThrow('DB down');
    });

    it('should handle null data', async () => {
      const { cached } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue(null);

      const result = await cached('null-key', fetchFn);
      expect(result.data).toBeNull();
      expect(result.cached).toBe(false);
    });

    it('should handle array data', async () => {
      const { cached } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue([1, 2, 3]);

      await cached('arr-key', fetchFn);
      const result = await cached('arr-key', fetchFn);

      expect(result.cached).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });
  });

  // ===========================================================================
  // invalidateCache
  // ===========================================================================
  describe('invalidateCache', () => {
    it('should remove a cached key so next access is a miss', async () => {
      const { cached, invalidateCache } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue('original');

      // Populate cache
      await cached('inv-key', fetchFn);
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Invalidate
      await invalidateCache('inv-key');

      // Next access should be a miss
      const fetchFn2 = vi.fn().mockResolvedValue('refreshed');
      const result = await cached('inv-key', fetchFn2);

      expect(result.cached).toBe(false);
      expect(result.data).toBe('refreshed');
    });

    it('should not throw when invalidating non-existent key', async () => {
      const { invalidateCache } = await import('./cache');

      await expect(invalidateCache('non-existent-key')).resolves.not.toThrow();
    });

    it('should only invalidate the specified key', async () => {
      const { cached, invalidateCache } = await import('./cache');

      await cached('keep-key', vi.fn().mockResolvedValue('keep'));
      await cached('remove-key', vi.fn().mockResolvedValue('remove'));

      await invalidateCache('remove-key');

      const result = await cached('keep-key', vi.fn().mockResolvedValue('new'));
      expect(result.cached).toBe(true);
      expect(result.data).toBe('keep');
    });
  });

  // ===========================================================================
  // clearMemoryCache
  // ===========================================================================
  describe('clearMemoryCache', () => {
    it('should clear all cached entries', async () => {
      const { cached, clearMemoryCache } = await import('./cache');

      await cached('key1', vi.fn().mockResolvedValue('v1'));
      await cached('key2', vi.fn().mockResolvedValue('v2'));

      clearMemoryCache();

      const fetchFn1 = vi.fn().mockResolvedValue('new-v1');
      const fetchFn2 = vi.fn().mockResolvedValue('new-v2');
      const result1 = await cached('key1', fetchFn1);
      const result2 = await cached('key2', fetchFn2);

      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(false);
    });

    it('should not throw when cache is already empty', async () => {
      const { clearMemoryCache } = await import('./cache');
      expect(() => clearMemoryCache()).not.toThrow();
    });
  });

  // ===========================================================================
  // Expiry behavior
  // ===========================================================================
  describe('cache expiry', () => {
    it('should return null for expired entries', async () => {
      const { cached } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue('data');

      // Cache with 1-second TTL (0 is falsy so falls through to default)
      await cached('expiring-key', fetchFn, 1);

      // Advance time past expiry (>1 second)
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + 2000);

      const fetchFn2 = vi.fn().mockResolvedValue('fresh');
      const result = await cached('expiring-key', fetchFn2);

      // Should be a miss since the entry expired
      expect(result.cached).toBe(false);
      expect(result.data).toBe('fresh');

      vi.restoreAllMocks();
    });
  });

  // ===========================================================================
  // Redis fallback behavior
  // ===========================================================================
  describe('in-memory fallback', () => {
    it('should work without Redis configuration', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const { cached } = await import('./cache');
      const fetchFn = vi.fn().mockResolvedValue('fallback-data');

      const result = await cached('fb-key', fetchFn);
      expect(result.data).toBe('fallback-data');

      const result2 = await cached('fb-key', fetchFn);
      expect(result2.cached).toBe(true);
    });
  });
});
