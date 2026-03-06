/**
 * STRIPE CLIENT
 * PURPOSE: Subscription management, billing, webhooks
 */

import Stripe from 'stripe';
import { logger } from '@/lib/logger';

const log = logger('Stripe');

// Lazy-initialize Stripe to avoid build-time errors when env vars aren't set
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get: (_target, prop) => {
    const stripeInstance = getStripe();
    const value = stripeInstance[prop as keyof Stripe];
    return typeof value === 'function' ? value.bind(stripeInstance) : value;
  },
});

// Price ID mapping for subscription tiers
// Note: These are functions to ensure env vars are read at runtime, not build time
export function getPriceIdForTier(tier: string): string {
  const priceIds: Record<string, string | undefined> = {
    plus: process.env.STRIPE_PRICE_ID_PLUS,
    pro: process.env.STRIPE_PRICE_ID_PRO,
    executive: process.env.STRIPE_PRICE_ID_EXECUTIVE,
  };
  return priceIds[tier] || '';
}

// Legacy export for backwards compatibility
export const STRIPE_PRICE_IDS = {
  get plus() {
    return process.env.STRIPE_PRICE_ID_PLUS || '';
  },
  get pro() {
    return process.env.STRIPE_PRICE_ID_PRO || '';
  },
  get executive() {
    return process.env.STRIPE_PRICE_ID_EXECUTIVE || '';
  },
} as const;

export type SubscriptionTier = keyof typeof STRIPE_PRICE_IDS | 'free';

/**
 * Create a Stripe Checkout Session for a subscription
 */
export async function createCheckoutSession(
  userId: string,
  priceId: string,
  tier: SubscriptionTier,
  customerEmail?: string
) {
  // Single coupon for 50% off first month (applies to all tiers)
  const couponId = process.env.STRIPE_COUPON_FIRST_MONTH;

  const baseSessionConfig: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/chat?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/?canceled=true`,
    customer_email: customerEmail,
    client_reference_id: userId,
    metadata: {
      user_id: userId,
      tier: tier,
    },
    subscription_data: {
      metadata: {
        user_id: userId,
        tier: tier,
      },
    },
  };

  // Try with coupon first, fallback to no coupon if it fails
  if (couponId) {
    try {
      const sessionConfig = { ...baseSessionConfig };

      if (couponId.startsWith('promo_')) {
        sessionConfig.discounts = [{ promotion_code: couponId }];
      } else {
        sessionConfig.discounts = [{ coupon: couponId }];
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);
      return session;
    } catch (error) {
      // If coupon fails (e.g., doesn't apply to this product), try without coupon
      log.warn('Coupon failed, proceeding without discount', error as Error);
      const sessionConfig = { ...baseSessionConfig, allow_promotion_codes: true };
      const session = await stripe.checkout.sessions.create(sessionConfig);
      return session;
    }
  }

  // No coupon configured, allow manual promo codes
  const sessionConfig = { ...baseSessionConfig, allow_promotion_codes: true };
  const session = await stripe.checkout.sessions.create(sessionConfig);
  return session;
}

/**
 * Create a billing portal session for managing subscriptions
 */
export async function createBillingPortalSession(customerId: string, returnUrl?: string) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url:
        returnUrl || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/chat`,
    });

    return session;
  } catch (error) {
    log.error('Error creating billing portal session', error as Error);
    throw error;
  }
}

/**
 * Get subscription details
 */
export async function getSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    log.error('Error retrieving subscription', error as Error);
    throw error;
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return subscription;
  } catch (error) {
    log.error('Error canceling subscription', error as Error);
    throw error;
  }
}
