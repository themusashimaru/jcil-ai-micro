/**
 * Chat Route Rate Limiting
 *
 * In-memory rate limiting for chat, research, and per-tool operations.
 * Falls back to in-memory when Supabase is unavailable.
 *
 * NOTE (Task 2.1.7): These in-memory Maps are unreliable on serverless
 * (state doesn't persist across invocations). Should be migrated to Redis
 * via src/lib/security/rate-limit.ts. Keeping as-is during decomposition
 * to avoid behavior changes.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const log = logger('ChatRateLimit');

// Rate limits per hour
const RATE_LIMIT_AUTHENTICATED = parseInt(process.env.RATE_LIMIT_AUTH || '120', 10);
const RATE_LIMIT_ANONYMOUS = parseInt(process.env.RATE_LIMIT_ANON || '30', 10);
// Web search rate limit - separate from chat to allow Claude search autonomy
// Set high (500/hr) since Brave Pro plan allows 50 req/sec
// Main constraint is Claude API costs, not Brave limits
const RATE_LIMIT_RESEARCH = parseInt(process.env.RATE_LIMIT_RESEARCH || '500', 10);

// In-memory fallback rate limiter
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();
const MEMORY_RATE_LIMIT = 10;
const MEMORY_WINDOW_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean up every 5 minutes
const MAX_RATE_LIMIT_ENTRIES = 50000; // Maximum entries to prevent memory leak
let lastCleanup = Date.now();

// Research-specific rate limiting (separate from regular chat)
const researchRateLimits = new Map<string, { count: number; resetAt: number }>();
const RESEARCH_WINDOW_MS = 60 * 60 * 1000; // 1 hour window

// CHAT-016: Per-tool rate limiting for expensive operations
const toolRateLimits = new Map<string, { count: number; resetAt: number }>();
export const TOOL_RATE_LIMITS: Record<string, number> = {
  run_code: 100, // code executions per hour
  browser_visit: 50, // browser visits per hour
  generate_image: 30, // image generations per hour
  generate_video: 10, // video generations per hour
  extract_pdf: 60, // PDF extractions per hour
  analyze_image: 60, // image analyses per hour
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Clean up expired entries from the in-memory rate limit maps
 * Prevents memory leak from unbounded growth
 */
function cleanupExpiredEntries(force = false): void {
  const now = Date.now();
  const totalSize = memoryRateLimits.size + researchRateLimits.size + toolRateLimits.size;

  // Force cleanup if we're over the size limit, otherwise respect the interval
  const shouldCleanup =
    force || totalSize > MAX_RATE_LIMIT_ENTRIES || now - lastCleanup >= CLEANUP_INTERVAL_MS;
  if (!shouldCleanup) return;

  lastCleanup = now;
  let cleaned = 0;

  // Cleanup regular chat rate limits
  for (const [key, value] of memoryRateLimits.entries()) {
    if (value.resetAt < now) {
      memoryRateLimits.delete(key);
      cleaned++;
    }
  }

  // Cleanup research rate limits
  for (const [key, value] of researchRateLimits.entries()) {
    if (value.resetAt < now) {
      researchRateLimits.delete(key);
      cleaned++;
    }
  }

  // Cleanup tool rate limits
  for (const [key, value] of toolRateLimits.entries()) {
    if (value.resetAt < now) {
      toolRateLimits.delete(key);
      cleaned++;
    }
  }

  // If still over limit after cleanup, evict oldest entries (LRU-style)
  if (memoryRateLimits.size > MAX_RATE_LIMIT_ENTRIES / 2) {
    const entriesToEvict = memoryRateLimits.size - MAX_RATE_LIMIT_ENTRIES / 2;
    let evicted = 0;
    for (const key of memoryRateLimits.keys()) {
      if (evicted >= entriesToEvict) break;
      memoryRateLimits.delete(key);
      evicted++;
      cleaned++;
    }
    log.warn('Force-evicted rate limit entries due to size limit', { evicted });
  }

  if (cleaned > 0) {
    log.debug('Rate limit cleanup', {
      cleaned,
      remaining: memoryRateLimits.size,
      researchRemaining: researchRateLimits.size,
    });
  }
}

/**
 * Check research-specific rate limit
 * Research agent uses external search API so has stricter limits
 */
export function checkResearchRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
} {
  cleanupExpiredEntries();

  const now = Date.now();
  const entry = researchRateLimits.get(identifier);

  if (!entry || entry.resetAt < now) {
    researchRateLimits.set(identifier, { count: 1, resetAt: now + RESEARCH_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_RESEARCH - 1 };
  }

  if (entry.count >= RATE_LIMIT_RESEARCH) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_RESEARCH - entry.count };
}

/**
 * CHAT-016: Check per-tool rate limit for expensive operations
 */
export function checkToolRateLimit(
  identifier: string,
  toolName: string
): { allowed: boolean; limit?: number } {
  const maxPerHour = TOOL_RATE_LIMITS[toolName];
  if (!maxPerHour) return { allowed: true }; // No limit for this tool

  const key = `${identifier}:${toolName}`;
  const now = Date.now();
  const entry = toolRateLimits.get(key);

  if (!entry || entry.resetAt < now) {
    toolRateLimits.set(key, { count: 1, resetAt: now + RESEARCH_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= maxPerHour) {
    return { allowed: false, limit: maxPerHour };
  }

  entry.count++;
  return { allowed: true };
}

function checkMemoryRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  // Periodically clean up expired entries to prevent memory leak
  cleanupExpiredEntries();

  const now = Date.now();
  const entry = memoryRateLimits.get(identifier);

  if (!entry || entry.resetAt < now) {
    memoryRateLimits.set(identifier, { count: 1, resetAt: now + MEMORY_WINDOW_MS });
    return { allowed: true, remaining: MEMORY_RATE_LIMIT - 1 };
  }

  if (entry.count >= MEMORY_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MEMORY_RATE_LIMIT - entry.count };
}

export async function checkChatRateLimit(
  identifier: string,
  isAuthenticated: boolean
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { allowed: true, remaining: -1, resetIn: 0 };

  const limit = isAuthenticated ? RATE_LIMIT_AUTHENTICATED : RATE_LIMIT_ANONYMOUS;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    const { count, error } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('action', 'chat_message')
      .gte('created_at', oneHourAgo);

    if (error) {
      const memoryCheck = checkMemoryRateLimit(identifier);
      return { allowed: memoryCheck.allowed, remaining: memoryCheck.remaining, resetIn: 3600 };
    }

    const currentCount = count || 0;
    const remaining = Math.max(0, limit - currentCount - 1);

    if (currentCount >= limit) {
      return { allowed: false, remaining: 0, resetIn: 3600 };
    }

    await supabase.from('rate_limits').insert({ identifier, action: 'chat_message' });
    return { allowed: true, remaining, resetIn: 0 };
  } catch {
    const memoryCheck = checkMemoryRateLimit(identifier);
    return { allowed: memoryCheck.allowed, remaining: memoryCheck.remaining, resetIn: 3600 };
  }
}
