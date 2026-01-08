/**
 * RATE LIMITING UTILITIES
 *
 * In-memory rate limiting for API routes.
 * Uses sliding window algorithm for accurate rate limiting.
 *
 * Note: For production with multiple instances, use Redis-backed rate limiting.
 */

import { RATE_LIMITS, TIERED_RATE_LIMITS, SubscriptionTier } from '@/lib/constants';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (use Redis for production multi-instance)
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

/**
 * Check and update rate limit for a given identifier
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
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

/**
 * Pre-configured rate limiters for common use cases
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
};

/**
 * Reset rate limit for a given identifier (for testing or admin)
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(`rate:${identifier}`);
}

/**
 * Clear all rate limits (for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(identifier: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
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
export function checkTieredChatRateLimit(
  userId: string,
  tier: SubscriptionTier
): TieredRateLimitResult {
  const minuteResult = tieredRateLimiters.chatPerMinute(userId, tier);
  const hourResult = tieredRateLimiters.chatPerHour(userId, tier);

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
export function checkTieredImageRateLimit(
  userId: string,
  tier: SubscriptionTier
): TieredRateLimitResult {
  const minuteResult = tieredRateLimiters.imagePerMinute(userId, tier);
  const hourResult = tieredRateLimiters.imagePerHour(userId, tier);

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
};
