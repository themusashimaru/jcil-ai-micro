/**
 * Rate Limiter for Code Lab Chat
 *
 * Delegates to the shared Redis-backed rate limiter for multi-instance safety.
 * In serverless environments (Vercel), in-memory rate limits reset on every
 * cold start, making them trivially bypassable. This module uses the same
 * Redis-backed sliding window algorithm as the main chat route.
 */

import { checkRateLimit as sharedCheckRateLimit } from '@/lib/security/rate-limit';

const RATE_LIMIT_REQUESTS = 30; // 30 requests per minute
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

export async function checkRateLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const result = await sharedCheckRateLimit(`codelab:chat:${userId}`, {
    limit: RATE_LIMIT_REQUESTS,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  return { allowed: result.allowed, remaining: result.remaining };
}
