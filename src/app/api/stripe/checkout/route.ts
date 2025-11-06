export const runtime = 'nodejs';

import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

// Price IDs from Stripe Dashboard
const PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_ID_BASIC!,
  pro: process.env.STRIPE_PRICE_ID_PRO!,
  executive: process.env.STRIPE_PRICE_ID_EXECUTIVE!,
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }

    // Parse request body
    const { tier } = await req.json();

    // Validate tier
    if (!tier || !['basic', 'pro', 'executive'].includes(tier)) {
      return new Response(
        JSON.stringify({ error: 'Invalid subscription tier' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const priceId = PRICE_IDS[tier as keyof typeof PRICE_IDS];

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'Price ID not configured for this tier' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to database
      await supabase
        .from('user_profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
        subscription_tier: tier,
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to create checkout session',
        details: error?.message
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
