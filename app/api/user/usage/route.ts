/**
 * USER USAGE API
 *
 * PURPOSE:
 * - Fetch current user's token usage and limits
 * - Returns usage counts, tier limits, and upgrade eligibility
 *
 * ROUTES:
 * - GET /api/user/usage - Get usage statistics
 */

import {
  getTokenUsage,
  getImageUsage,
  getTokenLimit,
  getImageLimit,
  formatTokenCount,
} from '@/lib/limits';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';
import { requireUser } from '@/lib/auth/user-guard';

export const dynamic = 'force-dynamic';

// Plan features (not limits - those come from limits.ts)
const TIER_FEATURES = {
  free: { realtime_voice: false, image_generation: false },
  plus: { realtime_voice: true, image_generation: true },
  basic: { realtime_voice: true, image_generation: true }, // Legacy alias for plus
  pro: { realtime_voice: true, image_generation: true },
  executive: { realtime_voice: true, image_generation: true },
} as const;

const log = logger('UserUsage');

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;
    const { user, supabase } = auth;

    // Rate limit by user
    const rateLimitResult = await checkRequestRateLimit(
      `usage:get:${user.id}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Fetch user's tier from database
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (dbError) {
      log.error('[API] Error fetching usage:', dbError instanceof Error ? dbError : { dbError });
      return errors.serverError();
    }

    const tier = (userData.subscription_tier || 'free') as keyof typeof TIER_FEATURES;
    const features = TIER_FEATURES[tier];

    // Get token and image usage from Redis/memory
    const tokenUsage = await getTokenUsage(user.id, tier);
    const imageUsage = await getImageUsage(user.id, tier);

    return successResponse({
      tier,
      // Token usage (monthly)
      tokens: {
        used: tokenUsage.used,
        limit: tokenUsage.limit,
        remaining: tokenUsage.remaining,
        percentage: tokenUsage.percentage,
        usedFormatted: formatTokenCount(tokenUsage.used),
        limitFormatted: formatTokenCount(tokenUsage.limit),
        remainingFormatted: formatTokenCount(tokenUsage.remaining),
      },
      // Image usage (monthly)
      images: {
        used: imageUsage.used,
        limit: imageUsage.limit,
        remaining: imageUsage.remaining,
        percentage: imageUsage.percentage,
      },
      // Features
      features: {
        realtime_voice: features.realtime_voice,
        image_generation: features.image_generation,
      },
      // Status flags
      hasReachedTokenLimit: tokenUsage.stop,
      hasReachedImageLimit: imageUsage.stop,
      tokenWarning: tokenUsage.warn,
      imageWarning: imageUsage.warn,
      // Plan info for upgrade prompts
      planInfo: {
        tokenLimit: getTokenLimit(tier),
        imageLimit: getImageLimit(tier),
        nextTier:
          tier === 'free'
            ? 'basic'
            : tier === 'basic'
              ? 'pro'
              : tier === 'pro'
                ? 'executive'
                : null,
        nextTierTokenLimit:
          tier === 'free'
            ? getTokenLimit('basic')
            : tier === 'basic'
              ? getTokenLimit('pro')
              : tier === 'pro'
                ? getTokenLimit('executive')
                : null,
      },
    });
  } catch (error) {
    log.error('[API] Usage fetch error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
