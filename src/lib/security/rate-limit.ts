/**
 * RATE LIMITING UTILITIES
 *
 * Redis-backed rate limiting for API routes with in-memory fallback.
 * Uses sliding window algorithm for accurate rate limiting.
 *
 * Production: Uses Redis (Upstash) for multi-instance support
 * Development: Falls back to in-memory when Redis not configured
 */

import { RATE_LIMITS, TIERED_RATE_LIMITS, SubscriptionTier } from '@/lib/constants';
import { redis, isRedisAvailable } from '@/lib/redis/client';
import { logger } from '@/lib/logger';

const log = logger('RateLimit');

// ========================================
// TYPES
// ========================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

// ========================================
// IN-MEMORY FALLBACK (Development only)
// ========================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for fallback when Redis unavailable
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60_000); // Clean up every minute
}

/**
 * In-memory rate limit check (fallback)
 */
function checkRateLimitMemory(identifier: string, config: RateLimitConfig): RateLimitResult {
  startCleanup();

  const now = Date.now();
  const key = `rate:${identifier}`;
  const entry = rateLimitStore.get(key);

  // If no entry or entry has expired, create new one
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

// ========================================
// REDIS-BACKED RATE LIMITING
// ========================================

/**
 * Redis-backed rate limit check using sliding window algorithm
 */
async function checkRateLimitRedis(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!redis) {
    // Fallback to memory if Redis somehow became unavailable
    return checkRateLimitMemory(identifier, config);
  }

  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowMs;
  const windowStart = now - windowMs;

  try {
    // Use sorted set for sliding window
    const multi = redis.multi();
    multi.zremrangebyscore(key, 0, windowStart); // Remove old entries
    multi.zadd(key, { score: now, member: `${now}-${Math.random()}` }); // Add current request with unique member
    multi.zcard(key); // Count requests in window
    multi.pexpire(key, windowMs); // Set expiry in milliseconds

    const results = await multi.exec();
    const count = results[2] as number;

    const resetAt = now + windowMs;

    if (count > config.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil(windowMs / 1000),
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, config.limit - count),
      resetAt,
    };
  } catch (error) {
    log.error('Redis rate limit error, falling back to memory', error as Error);
    // Fallback to memory on Redis error
    return checkRateLimitMemory(identifier, config);
  }
}

// ========================================
// MAIN RATE LIMIT FUNCTION
// ========================================

/**
 * Check and update rate limit for a given identifier
 * Uses Redis when available, falls back to in-memory
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (isRedisAvailable()) {
    return checkRateLimitRedis(identifier, config);
  }

  // In development without Redis, use memory
  if (process.env.NODE_ENV === 'development') {
    return checkRateLimitMemory(identifier, config);
  }

  // In production without Redis, log warning and use memory (but this shouldn't happen)
  log.warn('Redis not configured in production - using in-memory rate limiting');
  return checkRateLimitMemory(identifier, config);
}

// ========================================
// PRE-CONFIGURED RATE LIMITERS
// ========================================

/**
 * Pre-configured rate limiters for common use cases
 * All return Promises for consistent async handling
 */
export const rateLimiters = {
  chat: (userId: string, isPaid: boolean) =>
    checkRateLimit(`chat:${userId}`, {
      limit: isPaid ? RATE_LIMITS.CHAT_PAID_PER_MINUTE : RATE_LIMITS.CHAT_FREE_PER_MINUTE,
      windowMs: 60_000, // 1 minute
    }),

  api: (identifier: string) =>
    checkRateLimit(`api:${identifier}`, {
      limit: RATE_LIMITS.API_REQUESTS_PER_MINUTE,
      windowMs: 60_000,
    }),

  login: (identifier: string) =>
    checkRateLimit(`login:${identifier}`, {
      limit: RATE_LIMITS.LOGIN_ATTEMPTS_PER_HOUR,
      windowMs: 60 * 60 * 1000, // 1 hour
    }),

  passwordReset: (identifier: string) =>
    checkRateLimit(`password-reset:${identifier}`, {
      limit: RATE_LIMITS.PASSWORD_RESET_PER_HOUR,
      windowMs: 60 * 60 * 1000,
    }),

  supportTicket: (userId: string) =>
    checkRateLimit(`support:${userId}`, {
      limit: RATE_LIMITS.SUPPORT_TICKETS_PER_HOUR,
      windowMs: 60 * 60 * 1000,
    }),

  imageGeneration: (userId: string) =>
    checkRateLimit(`image:${userId}`, {
      limit: RATE_LIMITS.IMAGE_GEN_PER_MINUTE,
      windowMs: 60_000,
    }),

  // Code Lab rate limiters
  codeLabShell: (userId: string) =>
    checkRateLimit(`codelab:shell:${userId}`, {
      limit: RATE_LIMITS.CODE_LAB_SHELL_PER_MINUTE,
      windowMs: 60_000,
    }),

  codeLabFiles: (userId: string) =>
    checkRateLimit(`codelab:files:${userId}`, {
      limit: RATE_LIMITS.CODE_LAB_FILES_PER_MINUTE,
      windowMs: 60_000,
    }),

  codeLabDebug: (userId: string) =>
    checkRateLimit(`codelab:debug:${userId}`, {
      limit: RATE_LIMITS.CODE_LAB_DEBUG_PER_MINUTE,
      windowMs: 60_000,
    }),

  codeLabEdit: (userId: string) =>
    checkRateLimit(`codelab:edit:${userId}`, {
      limit: RATE_LIMITS.CODE_LAB_EDIT_PER_MINUTE,
      windowMs: 60_000,
    }),

  codeLabLSP: (userId: string) =>
    checkRateLimit(`codelab:lsp:${userId}`, {
      limit: RATE_LIMITS.CODE_LAB_LSP_PER_MINUTE,
      windowMs: 60_000,
    }),

  // HIGH-006: Rate limiter for GET endpoints
  codeLabRead: (userId: string) =>
    checkRateLimit(`codelab:read:${userId}`, {
      limit: RATE_LIMITS.CODE_LAB_READ_PER_MINUTE,
      windowMs: 60_000,
    }),
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Reset rate limit for a given identifier (for testing or admin)
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  const memKey = `rate:${identifier}`;
  const redisKey = `ratelimit:${identifier}`;

  rateLimitStore.delete(memKey);

  if (redis && isRedisAvailable()) {
    try {
      await redis.del(redisKey);
    } catch (error) {
      log.warn('Failed to reset Redis rate limit', error as Error);
    }
  }
}

/**
 * Clear all rate limits (for testing)
 */
export async function clearAllRateLimits(): Promise<void> {
  rateLimitStore.clear();

  if (redis && isRedisAvailable()) {
    try {
      // Delete all rate limit keys
      const keys = await redis.keys('ratelimit:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      log.warn('Failed to clear Redis rate limits', error as Error);
    }
  }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();

  if (redis && isRedisAvailable()) {
    try {
      const key = `ratelimit:${identifier}`;
      const windowStart = now - config.windowMs;

      // Count current entries without adding new one
      await redis.zremrangebyscore(key, 0, windowStart);
      const count = await redis.zcard(key);

      return {
        allowed: count < config.limit,
        remaining: Math.max(0, config.limit - count),
        resetAt: now + config.windowMs,
        retryAfter: count >= config.limit ? Math.ceil(config.windowMs / 1000) : undefined,
      };
    } catch (error) {
      log.warn('Failed to get Redis rate limit status', error as Error);
    }
  }

  // Memory fallback
  const key = `rate:${identifier}`;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: now + config.windowMs,
    };
  }

  return {
    allowed: entry.count < config.limit,
    remaining: Math.max(0, config.limit - entry.count),
    resetAt: entry.resetAt,
    retryAfter: entry.count >= config.limit ? Math.ceil((entry.resetAt - now) / 1000) : undefined,
  };
}

// ========================================
// TIERED RATE LIMITERS (Subscription-based)
// ========================================

/**
 * Get rate limit for a given tier and limit type
 */
function getTieredLimit(
  limitType: keyof typeof TIERED_RATE_LIMITS,
  tier: SubscriptionTier
): number {
  return TIERED_RATE_LIMITS[limitType][tier] || TIERED_RATE_LIMITS[limitType].free;
}

/**
 * Tiered rate limiters that adjust limits based on subscription tier
 */
export const tieredRateLimiters = {
  /**
   * Chat rate limiting by subscription tier (per minute)
   */
  chatPerMinute: (userId: string, tier: SubscriptionTier) =>
    checkRateLimit(`chat:minute:${userId}`, {
      limit: getTieredLimit('CHAT_PER_MINUTE', tier),
      windowMs: 60_000,
    }),

  /**
   * Chat rate limiting by subscription tier (per hour)
   */
  chatPerHour: (userId: string, tier: SubscriptionTier) =>
    checkRateLimit(`chat:hour:${userId}`, {
      limit: getTieredLimit('CHAT_PER_HOUR', tier),
      windowMs: 60 * 60 * 1000,
    }),

  /**
   * API rate limiting by subscription tier
   */
  apiPerMinute: (userId: string, tier: SubscriptionTier) =>
    checkRateLimit(`api:minute:${userId}`, {
      limit: getTieredLimit('API_PER_MINUTE', tier),
      windowMs: 60_000,
    }),

  /**
   * Image generation rate limiting by subscription tier (per minute)
   */
  imagePerMinute: (userId: string, tier: SubscriptionTier) =>
    checkRateLimit(`image:minute:${userId}`, {
      limit: getTieredLimit('IMAGE_PER_MINUTE', tier),
      windowMs: 60_000,
    }),

  /**
   * Image generation rate limiting by subscription tier (per hour)
   */
  imagePerHour: (userId: string, tier: SubscriptionTier) =>
    checkRateLimit(`image:hour:${userId}`, {
      limit: getTieredLimit('IMAGE_PER_HOUR', tier),
      windowMs: 60 * 60 * 1000,
    }),
};

/**
 * Extended rate limit result with tier info
 */
export interface TieredRateLimitResult extends RateLimitResult {
  tier: SubscriptionTier;
  limitType: string;
}

/**
 * Check all applicable rate limits for chat
 * Returns the most restrictive result
 */
export async function checkTieredChatRateLimit(
  userId: string,
  tier: SubscriptionTier
): Promise<TieredRateLimitResult> {
  const minuteResult = await tieredRateLimiters.chatPerMinute(userId, tier);
  const hourResult = await tieredRateLimiters.chatPerHour(userId, tier);

  // Return the most restrictive result
  if (!minuteResult.allowed) {
    return { ...minuteResult, tier, limitType: 'per_minute' };
  }
  if (!hourResult.allowed) {
    return { ...hourResult, tier, limitType: 'per_hour' };
  }

  // Both allowed - return minute result (more frequent check)
  return { ...minuteResult, tier, limitType: 'per_minute' };
}

/**
 * Check all applicable rate limits for image generation
 * Returns the most restrictive result
 */
export async function checkTieredImageRateLimit(
  userId: string,
  tier: SubscriptionTier
): Promise<TieredRateLimitResult> {
  const minuteResult = await tieredRateLimiters.imagePerMinute(userId, tier);
  const hourResult = await tieredRateLimiters.imagePerHour(userId, tier);

  // Return the most restrictive result
  if (!minuteResult.allowed) {
    return { ...minuteResult, tier, limitType: 'per_minute' };
  }
  if (!hourResult.allowed) {
    return { ...hourResult, tier, limitType: 'per_hour' };
  }

  return { ...minuteResult, tier, limitType: 'per_minute' };
}

// Export for testing
export const _internal = {
  rateLimitStore,
  stopCleanup: () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  },
  checkRateLimitMemory,
  checkRateLimitRedis,
};
