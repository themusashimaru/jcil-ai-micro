/**
 * Idempotency Key Management
 *
 * Prevents duplicate write operations (e.g., Git commits, API mutations)
 * Uses Redis/Upstash for distributed deduplication with TTL
 */

import { createHash, randomUUID } from 'crypto';

// Redis client (optional - graceful fallback if not configured)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis: any = null;

async function getRedis() {
  if (redis) return redis;

  // Try to load Upstash Redis if configured
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import('@upstash/redis');
      redis = Redis.fromEnv();
      return redis;
    } catch {
      console.warn('[Idempotency] Upstash Redis not available, using in-memory fallback');
    }
  }

  // In-memory fallback (single instance only - not for production clusters)
  const memoryCache = new Map<string, { value: string; expiry: number }>();
  redis = {
    set: async (key: string, value: string, options?: { nx?: boolean; ex?: number }) => {
      const existing = memoryCache.get(key);
      if (options?.nx && existing && existing.expiry > Date.now()) {
        return null; // Key exists, nx fails
      }
      const expiry = options?.ex ? Date.now() + options.ex * 1000 : Date.now() + 600_000;
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
 * Generate a new idempotency key
 * @param meta - Optional object to hash for deterministic keys
 * @returns UUID or SHA256 hash of meta
 */
export function newIdempotencyKey(meta?: object): string {
  if (meta) {
    return createHash('sha256').update(JSON.stringify(meta)).digest('hex');
  }
  return randomUUID();
}

/**
 * Check if this idempotency key has been seen before
 * If not seen, marks it as seen with 10-minute TTL
 *
 * @param key - Idempotency key to check
 * @returns true if this is the FIRST time seeing this key (proceed with operation)
 *          false if already seen (operation was already performed, skip)
 */
export async function seenIdempotent(key: string): Promise<boolean> {
  try {
    const r = await getRedis();
    if (!r) return true; // No Redis, always proceed

    // setnx with TTL prevents duplicates for 10 minutes
    const result = await r.set(`idem:${key}`, '1', { nx: true, ex: 600 });
    return result === 'OK'; // true if first time (key was set)
  } catch (error) {
    console.error('[Idempotency] Redis error:', error);
    return true; // On error, allow operation to proceed
  }
}

/**
 * Check if an operation was already performed (without marking)
 */
export async function wasAlreadyPerformed(key: string): Promise<boolean> {
  try {
    const r = await getRedis();
    if (!r) return false;

    const exists = await r.get(`idem:${key}`);
    return exists !== null;
  } catch {
    return false;
  }
}
