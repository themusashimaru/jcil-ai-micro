/**
 * STRIPE CLIENT
 * PURPOSE: Subscription management, billing, webhooks
 */

import Stripe from 'stripe';

// Lazy-initialize Stripe to avoid build-time errors when env vars aren't set
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
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
export const STRIPE_PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_ID_BASIC || '',
  pro: process.env.STRIPE_PRICE_ID_PRO || '',
  executive: process.env.STRIPE_PRICE_ID_EXECUTIVE || '',
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
  try {
    const session = await stripe.checkout.sessions.create({
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
    });

    return session;
  } catch (error) {
    console.error('[Stripe] Error creating checkout session:', error);
    throw error;
  }
}

/**
 * Create a billing portal session for managing subscriptions
 */
export async function createBillingPortalSession(customerId: string, returnUrl?: string) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/chat`,
    });

    return session;
  } catch (error) {
    console.error('[Stripe] Error creating billing portal session:', error);
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
    console.error('[Stripe] Error retrieving subscription:', error);
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
    console.error('[Stripe] Error canceling subscription:', error);
    throw error;
  }
}
