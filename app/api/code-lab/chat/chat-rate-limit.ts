/**
 * In-Memory Rate Limiter for Code Lab Chat
 *
 * Per-user rate limiting with automatic cleanup of expired entries
 * to prevent memory leaks in long-running serverless instances.
 */

import { logger } from '@/lib/logger';

const log = logger('CodeLabChat:RateLimit');

// In-memory rate limit store (per user, resets every minute)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_REQUESTS = 30; // 30 requests per minute
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 minutes
let lastCleanupTime = Date.now();

/**
 * Clean up expired rate limit entries to prevent memory leaks.
 * Called periodically during rate limit checks.
 */
function cleanupExpiredRateLimits(): void {
  const now = Date.now();

  // Only run cleanup every CLEANUP_INTERVAL_MS
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupTime = now;
  let cleanedCount = 0;

  for (const [userId, limit] of rateLimitStore.entries()) {
    if (now > limit.resetTime) {
      rateLimitStore.delete(userId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    log.debug('Cleaned up expired rate limit entries', {
      count: cleanedCount,
      remaining: rateLimitStore.size,
    });
  }
}

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();

  // MEMORY LEAK FIX: Periodically clean up expired entries
  cleanupExpiredRateLimits();

  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize
    rateLimitStore.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1 };
  }

  if (userLimit.count >= RATE_LIMIT_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_REQUESTS - userLimit.count };
}
