/**
 * Chat Route Rate Limiting
 *
 * Delegates to the Redis-backed rate limiter in src/lib/security/rate-limit.ts.
 * All rate limiting uses Redis (sliding window) in production,
 * in-memory fallback in development, and fail-closed when Redis is down.
 *
 * Migrated from in-memory Maps (Task 2.1.7) — serverless-safe.
 */

import { checkRateLimit, type RateLimitResult } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

const log = logger('ChatRateLimit');

// Rate limits per hour
const RATE_LIMIT_AUTHENTICATED = parseInt(process.env.RATE_LIMIT_AUTH || '120', 10);
const RATE_LIMIT_ANONYMOUS = parseInt(process.env.RATE_LIMIT_ANON || '30', 10);
const RATE_LIMIT_RESEARCH = parseInt(process.env.RATE_LIMIT_RESEARCH || '500', 10);
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// CHAT-016: Per-tool rate limiting for expensive operations
export const TOOL_RATE_LIMITS: Record<string, number> = {
  run_code: 100, // code executions per hour
  browser_visit: 50, // browser visits per hour
  generate_image: 30, // image generations per hour
  generate_video: 10, // video generations per hour
  extract_pdf: 60, // PDF extractions per hour
  analyze_image: 60, // image analyses per hour
};

/**
 * Check research-specific rate limit (web search, browser, fetch).
 * Uses Redis-backed sliding window.
 */
export async function checkResearchRateLimit(identifier: string): Promise<{
  allowed: boolean;
  remaining: number;
}> {
  const result = await checkRateLimit(`chat:research:${identifier}`, {
    limit: RATE_LIMIT_RESEARCH,
    windowMs: RATE_WINDOW_MS,
  });
  return { allowed: result.allowed, remaining: result.remaining };
}

/**
 * CHAT-016: Check per-tool rate limit for expensive operations.
 * Uses Redis-backed sliding window.
 */
export async function checkToolRateLimit(
  identifier: string,
  toolName: string
): Promise<{ allowed: boolean; limit?: number }> {
  const maxPerHour = TOOL_RATE_LIMITS[toolName];
  if (!maxPerHour) return { allowed: true }; // No limit for this tool

  const result = await checkRateLimit(`chat:tool:${identifier}:${toolName}`, {
    limit: maxPerHour,
    windowMs: RATE_WINDOW_MS,
  });

  if (!result.allowed) {
    return { allowed: false, limit: maxPerHour };
  }
  return { allowed: true };
}

/**
 * Check chat message rate limit.
 * Uses Redis-backed sliding window.
 */
export async function checkChatRateLimit(
  identifier: string,
  isAuthenticated: boolean
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const limit = isAuthenticated ? RATE_LIMIT_AUTHENTICATED : RATE_LIMIT_ANONYMOUS;

  const result: RateLimitResult = await checkRateLimit(`chat:msg:${identifier}`, {
    limit,
    windowMs: RATE_WINDOW_MS,
  });

  const resetIn = result.retryAfter || 0;

  if (!result.allowed) {
    log.warn('Chat rate limit exceeded', { identifier, limit, resetIn });
  }

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetIn,
  };
}
