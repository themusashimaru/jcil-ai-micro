/**
 * STRIPE CHECKOUT API
 * PURPOSE: Create Stripe checkout sessions for subscription purchases
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
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

const log = logger('StripeCheckout');

const checkoutSchema = z.object({
  tier: z.enum(['plus', 'pro', 'executive']),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    // Rate limit by user
    const rateLimitResult = await checkRequestRateLimit(
      `stripe:checkout:${auth.user.id}`,
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
    const { data: userData, error: userError } = await auth.supabase
      .from('users')
      .select('email')
      .eq('id', auth.user.id)
      .single();

    if (userError || !userData) {
      log.error('[Stripe Checkout] Error fetching user:', userError);
      return errors.notFound('User');
    }

    // Create checkout session
    const session = await createCheckoutSession(auth.user.id, priceId, tier, userData.email);

    return successResponse({ sessionId: session.id, url: session.url });
  } catch (error) {
    log.error('[Stripe Checkout] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
