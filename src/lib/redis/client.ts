/**
 * REDIS CLIENT (Upstash)
 * PURPOSE: Rate limiting, caching, queues
 * Graceful fallback - if Redis not configured, functions return null/true
 */

import { Redis } from '@upstash/redis';

// Check if Redis is configured
const isRedisConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Only create client if configured
export const redis = isRedisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/**
 * Get a cached value by key
 * Returns null if not found, not configured, or on error
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    const value = await redis.get<T>(key);
    return value;
  } catch (error) {
    console.warn('[Redis] Cache get error:', error);
    return null;
  }
}

/**
 * Set a cached value with TTL (time-to-live in seconds)
 * Fails silently if not configured or on error
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.set(key, value, { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.warn('[Redis] Cache set error:', error);
    return false;
  }
}

/**
 * Delete a cached value by key
 * Fails silently if not configured or on error
 */
export async function cacheDelete(key: string): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.warn('[Redis] Cache delete error:', error);
    return false;
  }
}

/**
 * Delete all cached values matching a pattern
 * Useful for invalidating related caches
 */
export async function cacheDeletePattern(pattern: string): Promise<boolean> {
  if (!redis) return false;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return true;
  } catch (error) {
    console.warn('[Redis] Cache delete pattern error:', error);
    return false;
  }
}

/**
 * Check rate limit using sliding window
 * Returns true if within limit, false if exceeded
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!redis) return true; // Allow if Redis not configured

  try {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // Use sorted set for sliding window
    const multi = redis.multi();
    multi.zremrangebyscore(key, 0, windowStart); // Remove old entries
    multi.zadd(key, { score: now, member: `${now}` }); // Add current request
    multi.zcard(key); // Count requests in window
    multi.expire(key, windowSeconds); // Set expiry

    const results = await multi.exec();
    const count = results[2] as number;

    return count <= limit;
  } catch (error) {
    console.warn('[Redis] Rate limit check error:', error);
    return true; // Allow on error
  }
}

/**
 * Check if Redis is available and configured
 */
export function isRedisAvailable(): boolean {
  return isRedisConfigured;
}
