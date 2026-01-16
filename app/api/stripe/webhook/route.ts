/**
 * STRIPE WEBHOOK API
 * PURPOSE: Handle Stripe webhook events for subscription lifecycle
 * IDEMPOTENCY: Events are tracked to prevent duplicate processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe/client';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { logger } from '@/lib/logger';

const log = logger('StripeWebhook');

// Runtime configuration
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Use service role key for webhook operations
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Check if a Stripe event has already been processed (idempotency)
 * Returns true if already processed, false if new
 */
async function isEventAlreadyProcessed(eventId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .single();

  return !!data;
}

/**
 * Mark a Stripe event as processed
 */
async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('stripe_webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
    processed_at: new Date().toISOString(),
  });

  if (error) {
    // Log but don't fail - the event was still processed successfully
    log.warn('Failed to mark event as processed', { eventId, error: error.message });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    log.warn('No signature found in request');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    log.error('Signature verification failed', err as Error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ========================================
  // IDEMPOTENCY CHECK - Prevent duplicate processing
  // ========================================
  try {
    const alreadyProcessed = await isEventAlreadyProcessed(event.id);
    if (alreadyProcessed) {
      log.info('Duplicate event received, skipping', { eventId: event.id, type: event.type });
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (err) {
    // If idempotency check fails, log but continue processing
    // Better to risk duplicate than to lose an event
    log.warn('Idempotency check failed, continuing', {
      eventId: event.id,
      error: (err as Error).message,
    });
  }

  log.info('Received event', { type: event.type, eventId: event.id });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        log.debug('Unhandled event type', { type: event.type });
    }

    // Mark event as processed for idempotency
    await markEventProcessed(event.id, event.type);

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error('Error processing webhook', error as Error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/**
 * Handle checkout session completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const tier = session.metadata?.tier;
  const customerId = session.customer as string;

  if (!userId || !tier) {
    log.warn('Missing metadata in checkout session');
    return;
  }

  if (!customerId) {
    log.warn('Missing customer ID in checkout session');
    return;
  }

  log.info('Checkout completed', { tier });

  // SECURITY: Verify the user exists and doesn't already have a different Stripe customer ID
  // This prevents malicious users from hijacking another user's subscription
  const supabase = getSupabaseAdmin();
  const { data: existingUser, error: lookupError } = await supabase
    .from('users')
    .select('id, stripe_customer_id')
    .eq('id', userId)
    .single();

  if (lookupError || !existingUser) {
    log.warn('User not found during checkout');
    return;
  }

  // If user already has a different Stripe customer ID, this is suspicious
  if (existingUser.stripe_customer_id && existingUser.stripe_customer_id !== customerId) {
    log.error('SECURITY: User already has different Stripe customer ID', {
      existingCustomerId: '[redacted]',
      newCustomerId: '[redacted]',
    });
    return;
  }

  // Update user with Stripe customer ID
  const { error: updateError } = await supabase
    .from('users')
    .update({
      stripe_customer_id: customerId,
      subscription_tier: tier,
      subscription_status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    log.error('Error updating user after checkout', { error: updateError.message });
  }
}

/**
 * Handle subscription creation or update
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  const tier = subscription.metadata?.tier;
  const customerId = subscription.customer as string;

  if (!userId || !tier) {
    log.warn('Missing metadata in subscription');
    return;
  }

  log.info('Subscription updated', { tier });

  // SECURITY: Verify the user's stripe_customer_id matches this subscription's customer
  const supabase = getSupabaseAdmin();
  const { data: existingUser, error: lookupError } = await supabase
    .from('users')
    .select('id, stripe_customer_id')
    .eq('id', userId)
    .single();

  if (lookupError || !existingUser) {
    log.warn('User not found during subscription update');
    return;
  }

  // Verify customer ID matches (if user already has one set)
  if (existingUser.stripe_customer_id && existingUser.stripe_customer_id !== customerId) {
    log.error('SECURITY: Customer ID mismatch in subscription update');
    return;
  }

  // Map Stripe status to our status
  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
  };

  const status = statusMap[subscription.status] || 'active';

  // Update user subscription
  const { error: updateError } = await supabase
    .from('users')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_tier: tier,
      subscription_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    log.error('Error updating subscription', { error: updateError.message });
    return;
  }

  // Log subscription history
  const priceId = subscription.items.data[0]?.price.id;
  const amount = subscription.items.data[0]?.price.unit_amount
    ? subscription.items.data[0].price.unit_amount / 100
    : 0;

  const { error: historyError } = await supabase.from('subscription_history').insert({
    user_id: userId,
    tier: tier,
    status: status,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    amount: amount,
    currency: subscription.currency?.toUpperCase() || 'USD',
    billing_cycle_start: new Date(
      ((subscription as unknown as { current_period_start?: number }).current_period_start ||
        Date.now() / 1000) * 1000
    ).toISOString(),
    billing_cycle_end: new Date(
      ((subscription as unknown as { current_period_end?: number }).current_period_end ||
        Date.now() / 1000) * 1000
    ).toISOString(),
  });

  if (historyError) {
    log.warn('Error logging subscription history', { error: historyError.message });
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  const customerId = subscription.customer as string;

  if (!userId) {
    log.warn('Missing user_id in subscription metadata');
    return;
  }

  log.info('Subscription deleted');

  // SECURITY: Verify the user's stripe_customer_id matches before downgrading
  const supabase = getSupabaseAdmin();
  const { data: existingUser, error: lookupError } = await supabase
    .from('users')
    .select('id, stripe_customer_id')
    .eq('id', userId)
    .single();

  if (lookupError || !existingUser) {
    log.warn('User not found during subscription deletion');
    return;
  }

  // Verify customer ID matches
  if (existingUser.stripe_customer_id && existingUser.stripe_customer_id !== customerId) {
    log.error('SECURITY: Customer ID mismatch in subscription deletion');
    return;
  }

  // Downgrade to free tier
  const { error: updateError } = await supabase
    .from('users')
    .update({
      subscription_tier: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    log.error('Error downgrading user', { error: updateError.message });
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  log.info('Payment succeeded', { invoiceId: invoice.id });
  // Payment tracking could be added here if needed
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  log.warn('Payment failed', { customerId: customerId ? '[set]' : '[missing]' });

  // Find user by Stripe customer ID and update status
  const { error: updateError } = await getSupabaseAdmin()
    .from('users')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  if (updateError) {
    log.error('Error updating payment failed status', { error: updateError.message });
  }
}
