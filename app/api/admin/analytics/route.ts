/**
 * ADMIN ANALYTICS API
 * PURPOSE: Provide analytics data for admin dashboard
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

    // Check authentication and admin status
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!userData?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch analytics data
    const [
      totalUsersResult,
      usersByTierResult,
      onlineUsersResult,
      totalMessagesResult,
    ] = await Promise.all([
      // Total users
      supabase.from('users').select('id', { count: 'exact', head: true }),

      // Users by subscription tier (get ALL users including free/null)
      supabase
        .from('users')
        .select('subscription_tier'),

      // Online users (active in last 15 minutes)
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('last_active_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()),

      // Total messages (as proxy for token usage)
      supabase.from('messages').select('id', { count: 'exact', head: true }),
    ]);

    // Count users by tier
    const tierCounts = {
      free: 0,
      basic: 0,
      pro: 0,
      executive: 0,
    };

    usersByTierResult.data?.forEach((user) => {
      const tier = user.subscription_tier?.toLowerCase() || 'free'; // Default to 'free' if null
      if (tier in tierCounts) {
        tierCounts[tier as keyof typeof tierCounts]++;
      }
    });

    // Get actual token usage by tier from database
    const tokensByTierResult = await supabase
      .from('messages')
      .select('tokens_used, users!inner(subscription_tier)');

    const tokensByTier = {
      free: 0,
      basic: 0,
      pro: 0,
      executive: 0,
    };

    // Sum actual tokens used per tier
    tokensByTierResult.data?.forEach((message) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const users = (message as any).users;
      const tier = (Array.isArray(users) ? users[0]?.subscription_tier : users?.subscription_tier)?.toLowerCase() || 'free';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokens = (message as any).tokens_used || 0; // Use actual tokens, default to 0 for old messages
      if (tier in tokensByTier) {
        tokensByTier[tier as keyof typeof tokensByTier] += tokens;
      }
    });

    // Calculate total tokens
    const totalTokens = Object.values(tokensByTier).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      analytics: {
        totalUsers: totalUsersResult.count || 0,
        onlineUsers: onlineUsersResult.count || 0,
        totalMessages: totalMessagesResult.count || 0,
        usersByTier: tierCounts,
        tokensByTier: tokensByTier,
        totalTokens: totalTokens,
      },
    });
  } catch (error) {
    console.error('[Admin Analytics] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
