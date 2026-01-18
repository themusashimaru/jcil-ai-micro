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

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

const log = logger('UserSubscription');

// Get authenticated Supabase client
async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently handle cookie errors
          }
        },
      },
    }
  );
}

export async function GET() {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errors.unauthorized();
    }

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
