/**
 * USER SUBSCRIPTION API
 *
 * PURPOSE:
 * - Fetch current user's subscription details
 * - Returns tier, status, and Stripe customer info
 *
 * ROUTES:
 * - GET /api/user/subscription - Get subscription details
 */

import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';
import { requireUser } from '@/lib/auth/user-guard';

const log = logger('UserSubscription');

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;
    const { user, supabase } = auth;

    // Rate limit by user
    const rateLimitResult = await checkRequestRateLimit(
      `subscription:get:${user.id}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Fetch user's subscription details from database
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .single();

    if (dbError) {
      log.error(
        '[API] Error fetching subscription:',
        dbError instanceof Error ? dbError : { dbError }
      );
      return errors.serverError();
    }

    return successResponse({
      tier: userData.subscription_tier || 'free',
      status: userData.subscription_status || 'active',
      hasStripeCustomer: !!userData.stripe_customer_id,
      hasActiveSubscription: !!userData.stripe_subscription_id,
    });
  } catch (error) {
    log.error('[API] Subscription fetch error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
