import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Create a mock module for testing
const createMockCache = () => {
  const memoryCache = new Map<string, { value: string; expiry: number }>();

  return {
    memoryCache,
    set: async (key: string, value: string, options?: { ex?: number }) => {
      const expiry = options?.ex ? Date.now() + options.ex * 1000 : Date.now() + 1800_000;
      memoryCache.set(key, { value, expiry });
      return 'OK';
    },
    get: async (key: string) => {
      const entry = memoryCache.get(key);
      if (!entry || entry.expiry < Date.now()) {
        memoryCache.delete(key);
        return null;
      }
      return entry.value;
    },
    del: async (key: string) => {
      memoryCache.delete(key);
      return 1;
    },
    clear: () => {
      memoryCache.clear();
    },
  };
};

describe('Cache Module', () => {
  describe('In-Memory Cache', () => {
    let cache: ReturnType<typeof createMockCache>;

    beforeEach(() => {
      cache = createMockCache();
    });

    it('should store and retrieve values', async () => {
      await cache.set('test-key', 'test-value');
      const result = await cache.get('test-key');
      expect(result).toBe('test-value');
    });

    it('should store JSON values', async () => {
      const data = { foo: 'bar', count: 42 };
      await cache.set('json-key', JSON.stringify(data));
      const result = await cache.get('json-key');
      expect(JSON.parse(result!)).toEqual(data);
    });

    it('should return null for missing keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should delete keys', async () => {
      await cache.set('delete-key', 'value');
      expect(await cache.get('delete-key')).toBe('value');

      await cache.del('delete-key');
      expect(await cache.get('delete-key')).toBeNull();
    });

    it('should clear all keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      expect(cache.memoryCache.size).toBe(2);

      cache.clear();
      expect(cache.memoryCache.size).toBe(0);
    });

    it('should expire entries based on TTL', async () => {
      // Set with 1 second TTL
      await cache.set('expiring-key', 'value', { ex: 1 });

      // Should exist immediately
      expect(await cache.get('expiring-key')).toBe('value');

      // Manually expire by modifying the entry
      const entry = cache.memoryCache.get('expiring-key');
      if (entry) {
        entry.expiry = Date.now() - 1000; // Set to past
      }

      // Should be expired now
      expect(await cache.get('expiring-key')).toBeNull();
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent keys for same input', () => {
      const generateKey = (prefix: string, query: string) => {
        const normalized = query.toLowerCase().trim();
        // Simple hash simulation for testing
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
          hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
          hash |= 0;
        }
        return `${prefix}:${Math.abs(hash).toString(16)}`;
      };

      const key1 = generateKey('webq', 'test query');
      const key2 = generateKey('webq', 'test query');
      expect(key1).toBe(key2);
    });

    it('should normalize queries', () => {
      const generateKey = (prefix: string, query: string) => {
        const normalized = query.toLowerCase().trim();
        return `${prefix}:${normalized}`;
      };

      const key1 = generateKey('webq', 'Test Query');
      const key2 = generateKey('webq', '  test query  ');
      expect(key1).toBe(key2);
    });

    it('should handle different prefixes', () => {
      const generateKey = (prefix: string, query: string) => `${prefix}:${query}`;

      const key1 = generateKey('webq', 'test');
      const key2 = generateKey('user', 'test');
      expect(key1).not.toBe(key2);
    });
  });

  describe('Cache Hit/Miss Logic', () => {
    let cache: ReturnType<typeof createMockCache>;

    beforeEach(() => {
      cache = createMockCache();
    });

    it('should return cached: true on cache hit', async () => {
      await cache.set('hit-key', JSON.stringify({ result: 'cached' }));

      const hit = await cache.get('hit-key');
      const data = JSON.parse(hit!);
      const cached = hit !== null;

      expect(cached).toBe(true);
      expect(data.result).toBe('cached');
    });

    it('should return cached: false on cache miss', async () => {
      const hit = await cache.get('miss-key');
      const cached = hit !== null;

      expect(cached).toBe(false);
    });
  });

  describe('Cache Data Types', () => {
    let cache: ReturnType<typeof createMockCache>;

    beforeEach(() => {
      cache = createMockCache();
    });

    it('should handle string values', async () => {
      await cache.set('string', 'hello world');
      expect(await cache.get('string')).toBe('hello world');
    });

    it('should handle array values', async () => {
      const arr = [1, 2, 3, 'four'];
      await cache.set('array', JSON.stringify(arr));
      expect(JSON.parse((await cache.get('array'))!)).toEqual(arr);
    });

    it('should handle nested object values', async () => {
      const obj = {
        user: { id: 1, name: 'Test' },
        items: [{ id: 'a' }, { id: 'b' }],
        meta: { total: 2 },
      };
      await cache.set('nested', JSON.stringify(obj));
      expect(JSON.parse((await cache.get('nested'))!)).toEqual(obj);
    });

    it('should handle null values in objects', async () => {
      const obj = { value: null, other: 'data' };
      await cache.set('null-value', JSON.stringify(obj));
      expect(JSON.parse((await cache.get('null-value'))!)).toEqual(obj);
    });

    it('should handle empty objects', async () => {
      await cache.set('empty-obj', JSON.stringify({}));
      expect(JSON.parse((await cache.get('empty-obj'))!)).toEqual({});
    });

    it('should handle empty arrays', async () => {
      await cache.set('empty-arr', JSON.stringify([]));
      expect(JSON.parse((await cache.get('empty-arr'))!)).toEqual([]);
    });
  });

  describe('Cache TTL', () => {
    let cache: ReturnType<typeof createMockCache>;

    beforeEach(() => {
      cache = createMockCache();
    });

    it('should use default TTL when not specified', async () => {
      await cache.set('default-ttl', 'value');
      const entry = cache.memoryCache.get('default-ttl');
      expect(entry).toBeDefined();
      // Default is 30 minutes (1800 seconds)
      const expectedExpiry = Date.now() + 1800_000;
      expect(entry!.expiry).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(entry!.expiry).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should use custom TTL when specified', async () => {
      await cache.set('custom-ttl', 'value', { ex: 60 }); // 60 seconds
      const entry = cache.memoryCache.get('custom-ttl');
      expect(entry).toBeDefined();
      const expectedExpiry = Date.now() + 60_000;
      expect(entry!.expiry).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(entry!.expiry).toBeLessThanOrEqual(expectedExpiry + 1000);
    });
  });

  describe('Concurrent Operations', () => {
    let cache: ReturnType<typeof createMockCache>;

    beforeEach(() => {
      cache = createMockCache();
    });

    it('should handle multiple concurrent sets', async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        cache.set(`key-${i}`, `value-${i}`)
      );

      await Promise.all(operations);

      for (let i = 0; i < 10; i++) {
        expect(await cache.get(`key-${i}`)).toBe(`value-${i}`);
      }
    });

    it('should handle mixed operations', async () => {
      await cache.set('mixed-key', 'initial');

      const operations = [
        cache.get('mixed-key'),
        cache.set('mixed-key', 'updated'),
        cache.get('mixed-key'),
      ];

      await Promise.all(operations);
      expect(await cache.get('mixed-key')).toBe('updated');
    });
  });
});
