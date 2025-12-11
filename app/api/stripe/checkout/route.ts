/**
 * STRIPE CHECKOUT API
 * PURPOSE: Create Stripe checkout sessions for subscription purchases
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createCheckoutSession, STRIPE_PRICE_IDS } from '@/lib/stripe/client';

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
  try {
    const supabase = await getSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { tier } = body;

    // Validate tier
    if (!tier || !['plus', 'pro', 'executive'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid subscription tier' }, { status: 400 });
    }

    // Get price ID for the tier
    const priceId = STRIPE_PRICE_IDS[tier as keyof typeof STRIPE_PRICE_IDS];
    console.log(`[Stripe Checkout] Tier: ${tier}, Price ID: ${priceId || 'NOT FOUND'}`);
    console.log(`[Stripe Checkout] Env vars - PLUS: ${process.env.STRIPE_PRICE_ID_PLUS ? 'SET' : 'MISSING'}, PRO: ${process.env.STRIPE_PRICE_ID_PRO ? 'SET' : 'MISSING'}, EXECUTIVE: ${process.env.STRIPE_PRICE_ID_EXECUTIVE ? 'SET' : 'MISSING'}`);

    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID not configured for tier: ${tier}. Please check STRIPE_PRICE_ID_${tier.toUpperCase()} env var.` },
        { status: 500 }
      );
    }

    // Get user details from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('[Stripe Checkout] Error fetching user:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create checkout session
    const session = await createCheckoutSession(user.id, priceId, tier, userData.email);

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('[Stripe Checkout] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
