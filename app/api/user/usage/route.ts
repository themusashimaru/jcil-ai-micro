/**
 * USER USAGE API
 *
 * PURPOSE:
 * - Fetch current user's message usage and limits
 * - Returns usage counts, tier limits, and upgrade eligibility
 *
 * ROUTES:
 * - GET /api/user/usage - Get usage statistics
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

// Tier limits configuration - per Master Directive
// Plan Configuration:
// - free: $0/mo, 10 daily chat, 0 monthly images, no realtime voice
// - basic: $12/mo, 40 daily chat, 50 monthly images, realtime voice enabled
// - pro: $30/mo, 100 daily chat, 200 monthly images, realtime voice enabled
// - executive: $150/mo, 400 daily chat, 500 monthly images, realtime voice enabled
const TIER_LIMITS = {
  free: { messages: 10, images: 0, realtime_voice: false },
  basic: { messages: 40, images: 50, realtime_voice: true },
  pro: { messages: 100, images: 200, realtime_voice: true },
  executive: { messages: 400, images: 500, realtime_voice: true },
} as const;

export async function GET() {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required',
        message: 'Please sign in to view your usage statistics.',
        code: 'AUTH_REQUIRED'
      }, { status: 401 });
    }

    // Fetch user's usage and tier from database
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('subscription_tier, messages_used_today, images_generated_today')
      .eq('id', user.id)
      .single();

    if (dbError) {
      console.error('[API] Error fetching usage:', dbError);
      return NextResponse.json(
        {
          error: 'Unable to load usage data',
          message: 'We encountered an issue loading your usage statistics. Please try again later.',
          code: 'DATABASE_ERROR'
        },
        { status: 500 }
      );
    }

    const tier = (userData.subscription_tier || 'free') as keyof typeof TIER_LIMITS;
    const limits = TIER_LIMITS[tier];

    return NextResponse.json({
      tier,
      messages: {
        used: userData.messages_used_today || 0,
        limit: limits.messages,
        remaining: Math.max(0, limits.messages - (userData.messages_used_today || 0)),
      },
      images: {
        used: userData.images_generated_today || 0,
        limit: limits.images,
        remaining: Math.max(0, limits.images - (userData.images_generated_today || 0)),
      },
      realtime_voice: limits.realtime_voice,
      hasReachedLimit: (userData.messages_used_today || 0) >= limits.messages,
    });
  } catch (error) {
    console.error('[API] Usage fetch error:', error);
    return NextResponse.json(
      {
        error: 'Service temporarily unavailable',
        message: 'We are having trouble loading your usage data. Please try again in a moment.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
