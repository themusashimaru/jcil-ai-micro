/**
 * USER USAGE API
 *
 * PURPOSE:
 * - Fetch current user's token usage and limits
 * - Returns usage counts, tier limits, and upgrade eligibility
 *
 * ROUTES:
 * - GET /api/user/usage - Get usage statistics
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokenUsage, getImageUsage, getTokenLimit, getImageLimit, formatTokenCount } from '@/lib/limits';

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

// Plan features (not limits - those come from limits.ts)
const TIER_FEATURES = {
  free: { realtime_voice: false, image_generation: false },
  basic: { realtime_voice: true, image_generation: true },
  pro: { realtime_voice: true, image_generation: true },
  executive: { realtime_voice: true, image_generation: true },
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

    // Fetch user's tier from database
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('subscription_tier')
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

    const tier = (userData.subscription_tier || 'free') as keyof typeof TIER_FEATURES;
    const features = TIER_FEATURES[tier];

    // Get token and image usage from Redis/memory
    const tokenUsage = await getTokenUsage(user.id, tier);
    const imageUsage = await getImageUsage(user.id, tier);

    return NextResponse.json({
      tier,
      // Token usage (monthly)
      tokens: {
        used: tokenUsage.used,
        limit: tokenUsage.limit,
        remaining: tokenUsage.remaining,
        percentage: tokenUsage.percentage,
        usedFormatted: formatTokenCount(tokenUsage.used),
        limitFormatted: formatTokenCount(tokenUsage.limit),
        remainingFormatted: formatTokenCount(tokenUsage.remaining),
      },
      // Image usage (monthly)
      images: {
        used: imageUsage.used,
        limit: imageUsage.limit,
        remaining: imageUsage.remaining,
        percentage: imageUsage.percentage,
      },
      // Features
      features: {
        realtime_voice: features.realtime_voice,
        image_generation: features.image_generation,
      },
      // Status flags
      hasReachedTokenLimit: tokenUsage.stop,
      hasReachedImageLimit: imageUsage.stop,
      tokenWarning: tokenUsage.warn,
      imageWarning: imageUsage.warn,
      // Plan info for upgrade prompts
      planInfo: {
        tokenLimit: getTokenLimit(tier),
        imageLimit: getImageLimit(tier),
        nextTier: tier === 'free' ? 'basic' : tier === 'basic' ? 'pro' : tier === 'pro' ? 'executive' : null,
        nextTierTokenLimit: tier === 'free' ? getTokenLimit('basic') : tier === 'basic' ? getTokenLimit('pro') : tier === 'pro' ? getTokenLimit('executive') : null,
      },
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
