/**
 * STRIPE CLIENT
 * PURPOSE: Subscription management, billing, webhooks
 * TODO: Initialize Stripe, add subscription helpers
 */

import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export async function createCheckoutSession(_userId: string, _priceId: string) {
  // TODO: Implement checkout session creation
  return null;
}
