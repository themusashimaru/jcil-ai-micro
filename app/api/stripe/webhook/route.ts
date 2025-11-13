/**
 * STRIPE WEBHOOK API
 * PURPOSE: Handle Stripe webhook events for subscription lifecycle
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe/client';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Use service role key for webhook operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  if (!userId || !tier) {
    console.error('[Stripe Webhook] Missing metadata in checkout session');
    return;
  }

  console.log('[Stripe Webhook] Checkout completed for user:', userId, 'tier:', tier);

  // Update user with Stripe customer ID
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      stripe_customer_id: session.customer as string,
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

  if (!userId || !tier) {
    console.error('[Stripe Webhook] Missing metadata in subscription');
    return;
  }

  console.log('[Stripe Webhook] Subscription updated for user:', userId);

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
  const { error: updateError } = await supabaseAdmin
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

  const { error: historyError } = await supabaseAdmin
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

  if (!userId) {
    console.error('[Stripe Webhook] Missing user_id in subscription metadata');
    return;
  }

  console.log('[Stripe Webhook] Subscription deleted for user:', userId);

  // Downgrade to free tier
  const { error: updateError } = await supabaseAdmin
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
  const { error: updateError } = await supabaseAdmin
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
