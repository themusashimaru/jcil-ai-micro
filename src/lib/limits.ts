/**
 * Usage Limits & Monthly Token Ceilings
 *
 * Tracks per-user token usage and enforces monthly limits
 * Warns at 80%, hard stops at 100%
 *
 * Plan Configuration:
 * - free: $0/mo, 100,000 tokens/month, 0 images/month (legacy users only)
 * - basic: $12/mo, 1,000,000 tokens/month, 25 images/month
 * - pro: $30/mo, 3,000,000 tokens/month, 75 images/month
 * - executive: $150/mo, 5,000,000 tokens/month, 100 images/month
 */

// ========================================
// TOKEN LIMITS (Monthly)
// ========================================

// Plan limits (tokens per month)
const TOKEN_LIMITS: Record<string, number> = {
  free: 100_000,       // 100K tokens - legacy users only
  basic: 1_000_000,    // 1M tokens
  pro: 3_000_000,      // 3M tokens
  executive: 5_000_000, // 5M tokens
};

// Image limits per month
const IMAGE_LIMITS: Record<string, number> = {
  free: 0,
  basic: 25,
  pro: 75,
  executive: 100,
};

// Redis client (optional - graceful fallback if not configured)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis: any = null;

// In-memory fallback for token tracking
const memoryTokens = new Map<string, number>();
const memoryImages = new Map<string, number>();

async function getRedis() {
  if (redis) return redis;

  // Try to load Upstash Redis if configured
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import('@upstash/redis');
      redis = Redis.fromEnv();
      return redis;
    } catch {
      console.warn('[Limits] Upstash Redis not available, using in-memory fallback');
    }
  }

  // In-memory fallback
  redis = {
    incrby: async (key: string, amount: number) => {
      const current = memoryTokens.get(key) || 0;
      const newValue = current + amount;
      memoryTokens.set(key, newValue);
      return newValue;
    },
    incr: async (key: string) => {
      const current = memoryImages.get(key) || 0;
      const newValue = current + 1;
      memoryImages.set(key, newValue);
      return newValue;
    },
    get: async (key: string) => memoryTokens.get(key) || memoryImages.get(key) || 0,
    set: async (key: string, value: number) => {
      memoryTokens.set(key, value);
      return 'OK';
    },
    expire: async () => true,
  };
  return redis;
}

/**
 * Get the current month key (YYYY-MM)
 */
function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Get user's token limit for their plan
 */
export function getTokenLimit(planKey: string): number {
  return TOKEN_LIMITS[planKey] || TOKEN_LIMITS.free;
}

/**
 * Get user's image limit for their plan
 */
export function getImageLimit(planKey: string): number {
  return IMAGE_LIMITS[planKey] || IMAGE_LIMITS.free;
}

export interface TokenUsageResult {
  used: number;
  limit: number;
  remaining: number;
  warn: boolean;      // at 80%
  stop: boolean;      // at 100%
  percentage: number;
}

export interface ImageUsageResult {
  used: number;
  limit: number;
  remaining: number;
  warn: boolean;
  stop: boolean;
  percentage: number;
}

// ========================================
// TOKEN USAGE FUNCTIONS
// ========================================

/**
 * Increment token usage and check limits
 *
 * @param userId - User ID
 * @param planKey - User's plan (free, basic, pro, executive)
 * @param tokensUsed - Number of tokens to add (input + output)
 * @returns Token usage status
 */
export async function incrementTokenUsage(
  userId: string,
  planKey: string = 'free',
  tokensUsed: number = 0
): Promise<TokenUsageResult> {
  const limit = getTokenLimit(planKey);
  const monthKey = getMonthKey();
  const key = `tokens:${userId}:${monthKey}`;

  try {
    const r = await getRedis();
    const used = await r.incrby(key, tokensUsed);

    // Set expiry on first use (35 days for safety - covers month boundary)
    if (used === tokensUsed) {
      await r.expire(key, 60 * 60 * 24 * 35);
    }

    const percentage = Math.round((used / limit) * 100);
    const warn = percentage >= 80 && percentage < 100;
    const stop = used > limit;
    const remaining = Math.max(0, limit - used);

    return { used, limit, remaining, warn, stop, percentage };
  } catch (error) {
    console.error('[Limits] Error incrementing token usage:', error);
    // On error, allow the request
    return {
      used: 0,
      limit,
      remaining: limit,
      warn: false,
      stop: false,
      percentage: 0,
    };
  }
}

/**
 * Get current token usage without incrementing
 */
export async function getTokenUsage(userId: string, planKey: string = 'free'): Promise<TokenUsageResult> {
  const limit = getTokenLimit(planKey);
  const monthKey = getMonthKey();
  const key = `tokens:${userId}:${monthKey}`;

  try {
    const r = await getRedis();
    const used = (await r.get(key)) || 0;

    const percentage = Math.round((used / limit) * 100);
    const warn = percentage >= 80 && percentage < 100;
    const stop = used > limit;
    const remaining = Math.max(0, limit - used);

    return { used, limit, remaining, warn, stop, percentage };
  } catch (error) {
    console.error('[Limits] Error getting token usage:', error);
    return {
      used: 0,
      limit,
      remaining: limit,
      warn: false,
      stop: false,
      percentage: 0,
    };
  }
}

/**
 * Check if user can make a request (based on token limits)
 */
export async function canMakeRequest(userId: string, planKey: string = 'free'): Promise<boolean> {
  const usage = await getTokenUsage(userId, planKey);
  return !usage.stop;
}

/**
 * Reset token usage for a user (admin function)
 */
export async function resetTokenUsage(userId: string): Promise<void> {
  const monthKey = getMonthKey();
  const key = `tokens:${userId}:${monthKey}`;

  try {
    const r = await getRedis();
    await r.set(key, 0);
  } catch (error) {
    console.error('[Limits] Error resetting token usage:', error);
  }
}

/**
 * Format token limit warning message
 */
export function getTokenLimitWarningMessage(usage: TokenUsageResult): string | null {
  if (usage.stop) {
    return `You've reached your monthly token limit. To continue chatting, please visit Settings and upgrade to a higher tier plan. Your limit will reset at the start of next month.`;
  }
  if (usage.warn) {
    const remainingFormatted = formatTokenCount(usage.remaining);
    return `Heads up: You're at ${usage.percentage}% of your monthly token limit (${remainingFormatted} remaining). Consider upgrading your plan for more capacity.`;
  }
  return null;
}

/**
 * Format token count for display (e.g., 1,000,000 -> "1M")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return tokens.toString();
}

// ========================================
// IMAGE USAGE FUNCTIONS
// ========================================

/**
 * Increment image usage counter and check limits
 */
export async function incrementImageUsage(
  userId: string,
  planKey: string = 'free'
): Promise<ImageUsageResult> {
  const limit = getImageLimit(planKey);
  const monthKey = getMonthKey();
  const key = `images:${userId}:${monthKey}`;

  try {
    const r = await getRedis();
    const used = await r.incr(key);

    // Set expiry on first use (35 days for safety)
    if (used === 1) {
      await r.expire(key, 60 * 60 * 24 * 35);
    }

    const percentage = limit > 0 ? Math.round((used / limit) * 100) : 100;
    const warn = percentage >= 80 && percentage < 100;
    const stop = limit === 0 || used > limit;
    const remaining = Math.max(0, limit - used);

    return { used, limit, remaining, warn, stop, percentage };
  } catch (error) {
    console.error('[Limits] Error incrementing image usage:', error);
    return {
      used: 0,
      limit,
      remaining: limit,
      warn: false,
      stop: limit === 0,
      percentage: 0,
    };
  }
}

/**
 * Get current image usage without incrementing
 */
export async function getImageUsage(
  userId: string,
  planKey: string = 'free'
): Promise<ImageUsageResult> {
  const limit = getImageLimit(planKey);
  const monthKey = getMonthKey();
  const key = `images:${userId}:${monthKey}`;

  try {
    const r = await getRedis();
    const used = (await r.get(key)) || 0;

    const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;
    const warn = percentage >= 80 && percentage < 100;
    const stop = limit === 0 || used > limit;
    const remaining = Math.max(0, limit - used);

    return { used, limit, remaining, warn, stop, percentage };
  } catch (error) {
    console.error('[Limits] Error getting image usage:', error);
    return {
      used: 0,
      limit,
      remaining: limit,
      warn: false,
      stop: limit === 0,
      percentage: 0,
    };
  }
}

/**
 * Format image limit warning message
 */
export function getImageLimitWarningMessage(usage: ImageUsageResult): string | null {
  if (usage.limit === 0) {
    return `Image generation is not available on your current plan. Please upgrade to Basic or higher to create images.`;
  }
  if (usage.stop) {
    return `You've reached your monthly limit of ${usage.limit} image generations. To create more images, please visit Settings and upgrade to a higher tier plan.`;
  }
  if (usage.warn) {
    return `Heads up: You're at ${usage.percentage}% of your monthly image limit (${usage.remaining} images remaining). Consider upgrading your plan for more image generations.`;
  }
  return null;
}

// ========================================
// LEGACY COMPATIBILITY (for transition period)
// ========================================

// Keep old function names working during transition
export const incrementUsage = incrementTokenUsage;
export const getUsage = getTokenUsage;
export const resetUsage = resetTokenUsage;
export const getLimitWarningMessage = getTokenLimitWarningMessage;
export const getPlanLimit = getTokenLimit;

// Legacy interface alias
export type UsageResult = TokenUsageResult;
