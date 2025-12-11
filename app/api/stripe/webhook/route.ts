/**
 * STRIPE WEBHOOK API
 * PURPOSE: Handle Stripe webhook events for subscription lifecycle
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe/client';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Runtime configuration
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Use service role key for webhook operations
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('[Stripe Webhook] No signature found');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('[Stripe Webhook] Received event:', event.type);

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
        console.log('[Stripe Webhook] Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing webhook:', error);
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
    console.error('[Stripe Webhook] Missing metadata in checkout session');
    return;
  }

  if (!customerId) {
    console.error('[Stripe Webhook] Missing customer ID in checkout session');
    return;
  }

  console.log('[Stripe Webhook] Checkout completed for user:', userId, 'tier:', tier);

  // SECURITY: Verify the user exists and doesn't already have a different Stripe customer ID
  // This prevents malicious users from hijacking another user's subscription
  const supabase = getSupabaseAdmin();
  const { data: existingUser, error: lookupError } = await supabase
    .from('users')
    .select('id, stripe_customer_id')
    .eq('id', userId)
    .single();

  if (lookupError || !existingUser) {
    console.error('[Stripe Webhook] User not found for ID:', userId);
    return;
  }

  // If user already has a different Stripe customer ID, this is suspicious
  if (existingUser.stripe_customer_id && existingUser.stripe_customer_id !== customerId) {
    console.error('[Stripe Webhook] SECURITY: User already has different Stripe customer ID!', {
      userId,
      existingCustomerId: existingUser.stripe_customer_id,
      newCustomerId: customerId,
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
    console.error('[Stripe Webhook] Error updating user:', updateError);
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
    console.error('[Stripe Webhook] Missing metadata in subscription');
    return;
  }

  console.log('[Stripe Webhook] Subscription updated for user:', userId);

  // SECURITY: Verify the user's stripe_customer_id matches this subscription's customer
  const supabase = getSupabaseAdmin();
  const { data: existingUser, error: lookupError } = await supabase
    .from('users')
    .select('id, stripe_customer_id')
    .eq('id', userId)
    .single();

  if (lookupError || !existingUser) {
    console.error('[Stripe Webhook] User not found for ID:', userId);
    return;
  }

  // Verify customer ID matches (if user already has one set)
  if (existingUser.stripe_customer_id && existingUser.stripe_customer_id !== customerId) {
    console.error('[Stripe Webhook] SECURITY: Customer ID mismatch in subscription update!', {
      userId,
      existingCustomerId: existingUser.stripe_customer_id,
      subscriptionCustomerId: customerId,
    });
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
    console.error('[Stripe Webhook] Error updating subscription:', updateError);
    return;
  }

  // Log subscription history
  const priceId = subscription.items.data[0]?.price.id;
  const amount = subscription.items.data[0]?.price.unit_amount
    ? subscription.items.data[0].price.unit_amount / 100
    : 0;

  const { error: historyError } = await supabase
    .from('subscription_history')
    .insert({
      user_id: userId,
      tier: tier,
      status: status,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      amount: amount,
      currency: subscription.currency?.toUpperCase() || 'USD',
      billing_cycle_start: new Date(subscription.current_period_start * 1000).toISOString(),
      billing_cycle_end: new Date(subscription.current_period_end * 1000).toISOString(),
    });

  if (historyError) {
    console.error('[Stripe Webhook] Error logging subscription history:', historyError);
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  const customerId = subscription.customer as string;

  if (!userId) {
    console.error('[Stripe Webhook] Missing user_id in subscription metadata');
    return;
  }

  console.log('[Stripe Webhook] Subscription deleted for user:', userId);

  // SECURITY: Verify the user's stripe_customer_id matches before downgrading
  const supabase = getSupabaseAdmin();
  const { data: existingUser, error: lookupError } = await supabase
    .from('users')
    .select('id, stripe_customer_id')
    .eq('id', userId)
    .single();

  if (lookupError || !existingUser) {
    console.error('[Stripe Webhook] User not found for ID:', userId);
    return;
  }

  // Verify customer ID matches
  if (existingUser.stripe_customer_id && existingUser.stripe_customer_id !== customerId) {
    console.error('[Stripe Webhook] SECURITY: Customer ID mismatch in subscription deletion!', {
      userId,
      existingCustomerId: existingUser.stripe_customer_id,
      subscriptionCustomerId: customerId,
    });
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
    console.error('[Stripe Webhook] Error downgrading user:', updateError);
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('[Stripe Webhook] Payment succeeded for invoice:', invoice.id);
  // Payment tracking could be added here if needed
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  console.log('[Stripe Webhook] Payment failed for customer:', customerId);

  // Find user by Stripe customer ID and update status
  const { error: updateError } = await getSupabaseAdmin()
    .from('users')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  if (updateError) {
    console.error('[Stripe Webhook] Error updating payment failed status:', updateError);
  }
}
