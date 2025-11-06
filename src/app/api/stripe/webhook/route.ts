export const runtime = 'nodejs';

import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Price ID to tier mapping
const PRICE_TO_TIER: Record<string, { tier: string; limit: number; price: number }> = {
  [process.env.STRIPE_PRICE_ID_BASIC!]: { tier: 'basic', limit: 30, price: 20 },
  [process.env.STRIPE_PRICE_ID_PRO!]: { tier: 'pro', limit: 100, price: 60 },
  [process.env.STRIPE_PRICE_ID_EXECUTIVE!]: { tier: 'executive', limit: 200, price: 99 },
};

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = await createClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!userId) {
          console.error('No supabase_user_id in session metadata');
          break;
        }

        // Get subscription details to find the price ID
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;

        const tierInfo = PRICE_TO_TIER[priceId];

        if (!tierInfo) {
          console.error('Unknown price ID:', priceId);
          break;
        }

        // Update user profile with subscription
        await supabase
          .from('user_profiles')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_tier: tierInfo.tier,
            daily_message_limit: tierInfo.limit,
            monthly_price: tierInfo.price,
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        console.log(`✅ User ${userId} upgraded to ${tierInfo.tier} tier`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const subscriptionId = subscription.id;
        const priceId = subscription.items.data[0]?.price.id;
        const status = subscription.status;

        const tierInfo = PRICE_TO_TIER[priceId];

        if (!tierInfo) {
          console.error('Unknown price ID:', priceId);
          break;
        }

        // Find user by Stripe customer ID
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!profile) {
          console.error('User not found for customer:', customerId);
          break;
        }

        // Update subscription status and tier
        await supabase
          .from('user_profiles')
          .update({
            stripe_subscription_id: subscriptionId,
            subscription_tier: status === 'active' ? tierInfo.tier : 'free',
            daily_message_limit: status === 'active' ? tierInfo.limit : 5,
            monthly_price: status === 'active' ? tierInfo.price : 0,
            subscription_status: status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        console.log(`✅ Subscription updated for user ${profile.id}: ${status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!profile) {
          console.error('User not found for customer:', customerId);
          break;
        }

        // Downgrade to free tier
        await supabase
          .from('user_profiles')
          .update({
            stripe_subscription_id: null,
            subscription_tier: 'free',
            daily_message_limit: 5,
            monthly_price: 0,
            subscription_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        console.log(`✅ User ${profile.id} downgraded to free tier (subscription canceled)`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Find user by Stripe customer ID
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!profile) {
          console.error('User not found for customer:', customerId);
          break;
        }

        // Mark subscription as past_due
        await supabase
          .from('user_profiles')
          .update({
            subscription_status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        console.log(`⚠️ Payment failed for user ${profile.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
