/**
 * STRIPE BILLING PORTAL API
 * PURPOSE: Redirect users to Stripe's billing portal to manage subscriptions
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createBillingPortalSession } from '@/lib/stripe/client';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';
import { stripePortalSchema } from '@/lib/validation/schemas';
import { validateCSRF } from '@/lib/security/csrf';

const log = logger('StripePortal');

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

export async function POST(request: NextRequest) {
  try {
    // CSRF Protection
    const csrfCheck = validateCSRF(request);
    if (!csrfCheck.valid) return csrfCheck.response!;

    const supabase = await getSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errors.unauthorized();
    }

    // Rate limit by user
    const rateLimitResult = checkRequestRateLimit(`stripe:portal:${user.id}`, rateLimits.strict);
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
    const session = await createBillingPortalSession(
      userData.stripe_customer_id,
      returnUrl
    );

    return successResponse({ url: session.url });
  } catch (error) {
    log.error('[Stripe Portal] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
