/**
 * Usage Limits & Daily Ceilings
 *
 * Tracks per-user usage and enforces daily limits per Master Directive
 * Warns at 80%, hard stops at 100%
 *
 * Plan Configuration (Supabase user_plans table):
 * - free: $0/mo, 10 daily chat, 0 monthly images, no realtime voice
 * - basic: $12/mo, 40 daily chat, 50 monthly images, realtime voice enabled
 * - pro: $30/mo, 100 daily chat, 200 monthly images, realtime voice enabled
 * - executive: $150/mo, 400 daily chat, 500 monthly images, realtime voice enabled
 */

// Plan limits (messages per day) - per directive
const PLAN_LIMITS: Record<string, number> = {
  free: 10,
  basic: 40,
  pro: 100,
  executive: 400,
};

// Redis client (optional - graceful fallback if not configured)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis: any = null;

// In-memory fallback
const memoryUsage = new Map<string, number>();

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
    incr: async (key: string) => {
      const current = memoryUsage.get(key) || 0;
      const newValue = current + 1;
      memoryUsage.set(key, newValue);
      return newValue;
    },
    get: async (key: string) => memoryUsage.get(key) || 0,
    set: async (key: string, value: number) => {
      memoryUsage.set(key, value);
      return 'OK';
    },
    expire: async () => true,
  };
  return redis;
}

/**
 * Get the current date key (YYYY-MM-DD)
 */
function getDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get user's plan limit
 */
export function getPlanLimit(planKey: string): number {
  return PLAN_LIMITS[planKey] || PLAN_LIMITS.free;
}

export interface UsageResult {
  used: number;
  limit: number;
  remaining: number;
  warn: boolean;      // at 80%
  stop: boolean;      // at 100%
  percentage: number;
}

/**
 * Increment usage counter and check limits
 *
 * @param userId - User ID
 * @param planKey - User's plan (free, basic, pro, enterprise)
 * @returns Usage status
 */
export async function incrementUsage(
  userId: string,
  planKey: string = 'free'
): Promise<UsageResult> {
  const limit = getPlanLimit(planKey);
  const dateKey = getDateKey();
  const key = `usage:${userId}:${dateKey}`;

  try {
    const r = await getRedis();
    const used = await r.incr(key);

    // Set expiry on first use (48 hours for safety)
    if (used === 1) {
      await r.expire(key, 60 * 60 * 48);
    }

    const percentage = Math.round((used / limit) * 100);
    const warn = percentage >= 80 && percentage < 100;
    const stop = used > limit;
    const remaining = Math.max(0, limit - used);

    return { used, limit, remaining, warn, stop, percentage };
  } catch (error) {
    console.error('[Limits] Error incrementing usage:', error);
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
 * Get current usage without incrementing
 */
export async function getUsage(userId: string, planKey: string = 'free'): Promise<UsageResult> {
  const limit = getPlanLimit(planKey);
  const dateKey = getDateKey();
  const key = `usage:${userId}:${dateKey}`;

  try {
    const r = await getRedis();
    const used = (await r.get(key)) || 0;

    const percentage = Math.round((used / limit) * 100);
    const warn = percentage >= 80 && percentage < 100;
    const stop = used > limit;
    const remaining = Math.max(0, limit - used);

    return { used, limit, remaining, warn, stop, percentage };
  } catch (error) {
    console.error('[Limits] Error getting usage:', error);
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
 * Reset usage for a user (admin function)
 */
export async function resetUsage(userId: string): Promise<void> {
  const dateKey = getDateKey();
  const key = `usage:${userId}:${dateKey}`;

  try {
    const r = await getRedis();
    await r.set(key, 0);
  } catch (error) {
    console.error('[Limits] Error resetting usage:', error);
  }
}

/**
 * Check if user can make a request (without incrementing)
 */
export async function canMakeRequest(userId: string, planKey: string = 'free'): Promise<boolean> {
  const usage = await getUsage(userId, planKey);
  return !usage.stop;
}

/**
 * Format limit warning message
 */
export function getLimitWarningMessage(usage: UsageResult): string | null {
  if (usage.stop) {
    return `You've reached your daily limit of ${usage.limit} messages. Try again tomorrow or upgrade your plan.`;
  }
  if (usage.warn) {
    return `You're at ${usage.percentage}% of your daily limit. ${usage.remaining} messages remaining.`;
  }
  return null;
}

/**
 * Track token usage for billing
 */
export async function trackTokenUsage(
  userId: string,
  _model: string,
  tokensIn: number,
  tokensOut: number
): Promise<void> {
  const dateKey = getDateKey();
  const key = `tokens:${userId}:${dateKey}`;

  try {
    const r = await getRedis();

    // Get current totals
    const current = (await r.get(key)) as { in: number; out: number } | null;
    const totals = current || { in: 0, out: 0 };

    // Update totals
    totals.in += tokensIn;
    totals.out += tokensOut;

    await r.set(key, JSON.stringify(totals));
    await r.expire(key, 60 * 60 * 48);
  } catch (error) {
    console.error('[Limits] Error tracking tokens:', error);
  }
}

// ========================================
// IMAGE-SPECIFIC LIMITS (Monthly per directive)
// ========================================

// Image limits per month - per directive
const IMAGE_LIMITS: Record<string, number> = {
  free: 0,
  basic: 50,
  pro: 200,
  executive: 500,
};

export interface ImageUsageResult {
  used: number;
  limit: number;
  remaining: number;
  warn: boolean;
  stop: boolean;
  percentage: number;
}

/**
 * Get image generation limit for a plan
 */
export function getImageLimit(planKey: string): number {
  return IMAGE_LIMITS[planKey] || IMAGE_LIMITS.free;
}

/**
 * Increment image usage counter and check limits
 */
export async function incrementImageUsage(
  userId: string,
  planKey: string = 'free'
): Promise<ImageUsageResult> {
  const limit = getImageLimit(planKey);
  const dateKey = getDateKey();
  const key = `images:${userId}:${dateKey}`;

  try {
    const r = await getRedis();
    const used = await r.incr(key);

    // Set expiry on first use (48 hours for safety)
    if (used === 1) {
      await r.expire(key, 60 * 60 * 48);
    }

    const percentage = Math.round((used / limit) * 100);
    const warn = percentage >= 80 && percentage < 100;
    const stop = used > limit;
    const remaining = Math.max(0, limit - used);

    return { used, limit, remaining, warn, stop, percentage };
  } catch (error) {
    console.error('[Limits] Error incrementing image usage:', error);
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
 * Get current image usage without incrementing
 */
export async function getImageUsage(
  userId: string,
  planKey: string = 'free'
): Promise<ImageUsageResult> {
  const limit = getImageLimit(planKey);
  const dateKey = getDateKey();
  const key = `images:${userId}:${dateKey}`;

  try {
    const r = await getRedis();
    const used = (await r.get(key)) || 0;

    const percentage = Math.round((used / limit) * 100);
    const warn = percentage >= 80 && percentage < 100;
    const stop = used > limit;
    const remaining = Math.max(0, limit - used);

    return { used, limit, remaining, warn, stop, percentage };
  } catch (error) {
    console.error('[Limits] Error getting image usage:', error);
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
 * Format image limit warning message
 */
export function getImageLimitWarningMessage(usage: ImageUsageResult): string | null {
  if (usage.stop) {
    return `You've reached your daily limit of ${usage.limit} images. Try again tomorrow or upgrade your plan.`;
  }
  if (usage.warn) {
    return `You're at ${usage.percentage}% of your daily image limit. ${usage.remaining} images remaining.`;
  }
  return null;
}
