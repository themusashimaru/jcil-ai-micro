/**
 * USER SUBSCRIPTION API
 *
 * PURPOSE:
 * - Fetch current user's subscription details
 * - Returns tier, status, and Stripe customer info
 *
 * ROUTES:
 * - GET /api/user/subscription - Get subscription details
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

export async function GET() {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's subscription details from database
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .single();

    if (dbError) {
      console.error('[API] Error fetching subscription:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tier: userData.subscription_tier || 'free',
      status: userData.subscription_status || 'active',
      hasStripeCustomer: !!userData.stripe_customer_id,
      hasActiveSubscription: !!userData.stripe_subscription_id,
    });
  } catch (error) {
    console.error('[API] Subscription fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
