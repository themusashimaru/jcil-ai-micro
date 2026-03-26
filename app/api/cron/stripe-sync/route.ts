/**
 * STRIPE-SUPABASE RECONCILIATION CRON
 *
 * Daily reconciliation of Stripe subscriptions with Supabase users table.
 * Catches cases where webhook delivery failed and subscription state diverged.
 *
 * SCHEDULE: 0 4 * * * (daily at 4 AM UTC)
 * SECURITY: Requires CRON_SECRET in Authorization header
 */

import { stripe } from '@/lib/stripe/client';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('CronStripeSync');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return errors.unauthorized();
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return errors.serverError('Supabase not configured');
  }

  try {
    log.info('Starting Stripe-Supabase reconciliation');

    // Get all users with a stripe_customer_id
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(
        'id, stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status'
      )
      .not('stripe_customer_id', 'is', null);

    if (usersError) {
      log.error('Failed to fetch users', { error: usersError.message });
      return errors.serverError('Failed to fetch users');
    }

    if (!users || users.length === 0) {
      log.info('No users with Stripe customers found');
      return successResponse({ synced: 0, mismatches: 0 });
    }

    let synced = 0;
    let mismatches = 0;
    const fixes: Array<{ userId: string; field: string; from: string; to: string }> = [];

    for (const user of users) {
      if (!user.stripe_customer_id) continue;

      try {
        // Get active subscriptions for this customer from Stripe
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          status: 'all',
          limit: 1,
        });

        const sub = subscriptions.data[0];

        if (!sub) {
          // No subscription in Stripe — user should be free
          if (user.subscription_tier !== 'free') {
            mismatches++;
            fixes.push({
              userId: user.id,
              field: 'tier',
              from: user.subscription_tier || 'null',
              to: 'free',
            });
            await supabase
              .from('users')
              .update({
                subscription_tier: 'free',
                subscription_status: 'canceled',
                stripe_subscription_id: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', user.id);
          }
        } else {
          // Has subscription — check tier matches
          const stripeTier = sub.metadata?.tier || 'free';
          const stripeStatus =
            sub.status === 'active'
              ? 'active'
              : sub.status === 'past_due'
                ? 'past_due'
                : sub.status === 'canceled'
                  ? 'canceled'
                  : 'active';

          if (user.subscription_tier !== stripeTier) {
            mismatches++;
            fixes.push({
              userId: user.id,
              field: 'tier',
              from: user.subscription_tier || 'null',
              to: stripeTier,
            });
          }

          if (user.subscription_status !== stripeStatus) {
            mismatches++;
            fixes.push({
              userId: user.id,
              field: 'status',
              from: user.subscription_status || 'null',
              to: stripeStatus,
            });
          }

          if (mismatches > 0) {
            await supabase
              .from('users')
              .update({
                subscription_tier: stripeTier,
                subscription_status: stripeStatus,
                stripe_subscription_id: sub.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', user.id);
          }
        }

        synced++;
      } catch (stripeError) {
        log.warn('Failed to check Stripe for user', {
          userId: user.id,
          error: (stripeError as Error).message,
        });
      }
    }

    if (fixes.length > 0) {
      log.warn('Stripe-Supabase mismatches fixed', { fixes });
    }

    log.info('Stripe-Supabase reconciliation complete', {
      synced,
      mismatches,
      fixes: fixes.length,
    });

    return successResponse({ synced, mismatches, fixes: fixes.length });
  } catch (error) {
    log.error('Stripe sync cron failed', error as Error);
    return errors.serverError('Reconciliation failed');
  }
}
