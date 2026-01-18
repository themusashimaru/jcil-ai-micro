/**
 * STRIPE CHECKOUT API
 * PURPOSE: Create Stripe checkout sessions for subscription purchases
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createCheckoutSession, STRIPE_PRICE_IDS } from '@/lib/stripe/client';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import {
  successResponse,
  errors,
  validateBody,
  checkRequestRateLimit,
  rateLimits,
} from '@/lib/api/utils';
import { validateCSRF } from '@/lib/security/csrf';

const log = logger('StripeCheckout');

const checkoutSchema = z.object({
  tier: z.enum(['plus', 'pro', 'executive']),
});

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
  // CSRF Protection - Critical for payment operations
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
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
    const rateLimitResult = await checkRequestRateLimit(
      `stripe:checkout:${user.id}`,
      rateLimits.strict
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Validate request body
    const validation = await validateBody(request, checkoutSchema);
    if (!validation.success) return validation.response;

    const { tier } = validation.data;

    // Get price ID for the tier
    const priceId = STRIPE_PRICE_IDS[tier as keyof typeof STRIPE_PRICE_IDS];
    log.info(`[Stripe Checkout] Tier: ${tier}, Price ID: ${priceId || 'NOT FOUND'}`);
    log.info(
      `[Stripe Checkout] Env vars - PLUS: ${process.env.STRIPE_PRICE_ID_PLUS ? 'SET' : 'MISSING'}, PRO: ${process.env.STRIPE_PRICE_ID_PRO ? 'SET' : 'MISSING'}, EXECUTIVE: ${process.env.STRIPE_PRICE_ID_EXECUTIVE ? 'SET' : 'MISSING'}`
    );

    if (!priceId) {
      log.error(`[Stripe Checkout] Price ID not configured for tier: ${tier}`);
      return errors.serverError();
    }

    // Get user details from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      log.error('[Stripe Checkout] Error fetching user:', userError);
      return errors.notFound('User');
    }

    // Create checkout session
    const session = await createCheckoutSession(user.id, priceId, tier, userData.email);

    return successResponse({ sessionId: session.id, url: session.url });
  } catch (error) {
    log.error('[Stripe Checkout] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
