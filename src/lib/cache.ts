/**
 * Caching Layer
 *
 * Redis-backed caching for web search results and expensive operations
 * TTL: 30-60 minutes for web search queries
 */

import { createHash } from 'crypto';

// Redis client (optional - graceful fallback if not configured)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis: any = null;

// In-memory cache fallback
const memoryCache = new Map<string, { value: string; expiry: number }>();

async function getRedis() {
  if (redis) return redis;

  // Try to load Upstash Redis if configured
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import('@upstash/redis');
      redis = Redis.fromEnv();
      return redis;
    } catch {
      console.warn('[Cache] Upstash Redis not available, using in-memory fallback');
    }
  }

  // In-memory fallback
  redis = {
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
  };
  return redis;
}

/**
 * Generate cache key from query string
 */
function generateCacheKey(prefix: string, query: string): string {
  const normalized = query.toLowerCase().trim();
  const hash = createHash('sha1').update(normalized).digest('hex');
  return `${prefix}:${hash}`;
}

/**
 * Cached web search
 *
 * @param query - Search query
 * @param fetchFn - Function to fetch results if not cached
 * @param ttlSec - Time to live in seconds (default 30 minutes)
 */
export async function cachedWebSearch<T>(
  query: string,
  fetchFn: () => Promise<T>,
  ttlSec: number = 1800
): Promise<{ data: T; cached: boolean }> {
  const key = generateCacheKey('webq', query);

  try {
    const r = await getRedis();
    if (r) {
      const hit = await r.get(key);
      if (hit) {
        console.log('[Cache] Web search cache HIT for query');
        return { data: JSON.parse(hit as string), cached: true };
      }
    }
  } catch (error) {
    console.error('[Cache] Redis get error:', error);
  }

  // Cache miss - fetch fresh data
  console.log('[Cache] Web search cache MISS, fetching fresh');
  const data = await fetchFn();

  // Store in cache
  try {
    const r = await getRedis();
    if (r) {
      await r.set(key, JSON.stringify(data), { ex: ttlSec });
    }
  } catch (error) {
    console.error('[Cache] Redis set error:', error);
  }

  return { data, cached: false };
}

/**
 * Generic cached operation
 */
export async function cached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSec: number = 300
): Promise<{ data: T; cached: boolean }> {
  try {
    const r = await getRedis();
    if (r) {
      const hit = await r.get(key);
      if (hit) {
        return { data: JSON.parse(hit as string), cached: true };
      }
    }
  } catch (error) {
    console.error('[Cache] Redis get error:', error);
  }

  const data = await fetchFn();

  try {
    const r = await getRedis();
    if (r) {
      await r.set(key, JSON.stringify(data), { ex: ttlSec });
    }
  } catch (error) {
    console.error('[Cache] Redis set error:', error);
  }

  return { data, cached: false };
}

/**
 * Invalidate a cache key
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    const r = await getRedis();
    if (r && 'del' in r) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (r as { del: (key: string) => Promise<any> }).del(key);
    }
    memoryCache.delete(key);
  } catch (error) {
    console.error('[Cache] Invalidation error:', error);
  }
}

/**
 * Clear all cached web search results
 */
export function clearMemoryCache(): void {
  memoryCache.clear();
}
