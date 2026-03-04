/**
 * STRIPE BILLING PORTAL API
 * PURPOSE: Redirect users to Stripe's billing portal to manage subscriptions
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { createBillingPortalSession } from '@/lib/stripe/client';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';
import { stripePortalSchema } from '@/lib/validation/schemas';

const log = logger('StripePortal');

export async function POST(request: NextRequest) {
  try {
    // Auth + CSRF protection for POST
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;
    const { user, supabase } = auth;

    // Rate limit by user
    const rateLimitResult = await checkRequestRateLimit(
      `stripe:portal:${user.id}`,
      rateLimits.strict
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Get user's Stripe customer ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.stripe_customer_id) {
      return errors.notFound('Subscription');
    }

    // Parse and validate return URL from request body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      rawBody = {};
    }

    const validation = stripePortalSchema.safeParse(rawBody);
    const returnUrl = validation.success ? validation.data.returnUrl : undefined;

    // Create billing portal session
    const session = await createBillingPortalSession(userData.stripe_customer_id, returnUrl);

    return successResponse({ url: session.url });
  } catch (error) {
    log.error('[Stripe Portal] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
