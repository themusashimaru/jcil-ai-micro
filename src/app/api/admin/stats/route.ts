import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Pricing constants
const PRICING = {
  free: 0,
  basic: 12,
  pro: 12,
  premium: 30,
  executive: 150,
};

const API_COSTS = {
  inputTokensPerMillion: 0.20,
  outputTokensPerMillion: 0.50,
};

export async function GET(request: Request) {
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
  }

  try {
    // Get URL parameters for date range
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly'; // daily, monthly, quarterly, half, yearly

    // Calculate date ranges
    const now = new Date();
    const ranges = {
      daily: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      monthly: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      quarterly: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      half: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
      yearly: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
    };

    const startDate = ranges[period as keyof typeof ranges] || ranges.monthly;

    // ====================
    // USER STATS
    // ====================
    const { data: usersByTier, error: usersError } = await supabase
      .from('user_profiles')
      .select('subscription_tier, monthly_price')
      .order('subscription_tier');

    if (usersError) throw usersError;

    // Count users by tier
    const tierCounts = usersByTier?.reduce((acc: any, user: any) => {
      const tier = user.subscription_tier || 'free';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {});

    // Calculate total users
    const totalUsers = usersByTier?.length || 0;

    // ====================
    // REVENUE STATS
    // ====================
    const revenueByTier = Object.entries(tierCounts || {}).map(([tier, count]) => ({
      tier,
      count,
      monthlyRevenue: (count as number) * (PRICING[tier as keyof typeof PRICING] || 0),
    }));

    const totalMonthlyRevenue = revenueByTier.reduce((sum, tier) => sum + tier.monthlyRevenue, 0);

    // ====================
    // USAGE STATS
    // ====================
    const { data: usageStats, error: usageError } = await supabase
      .from('daily_usage')
      .select('usage_date, message_count, token_count')
      .gte('usage_date', startDate.toISOString().split('T')[0])
      .order('usage_date', { ascending: false });

    if (usageError) throw usageError;

    // Aggregate usage stats
    const totalMessages = usageStats?.reduce((sum: number, day: any) => sum + (day.message_count || 0), 0) || 0;
    const totalTokens = usageStats?.reduce((sum: number, day: any) => sum + (day.token_count || 0), 0) || 0;

    // Estimate input/output tokens (assume 40/60 split based on typical usage)
    const estimatedInputTokens = Math.floor(totalTokens * 0.4);
    const estimatedOutputTokens = Math.floor(totalTokens * 0.6);

    // Calculate API costs
    const inputCost = (estimatedInputTokens / 1_000_000) * API_COSTS.inputTokensPerMillion;
    const outputCost = (estimatedOutputTokens / 1_000_000) * API_COSTS.outputTokensPerMillion;
    const totalApiCost = inputCost + outputCost;

    // ====================
    // SIGNUP STATS
    // ====================
    const { data: recentSignups, error: signupsError } = await supabase
      .from('user_profiles')
      .select('id, created_at, subscription_tier')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (signupsError) throw signupsError;

    const newSignups = recentSignups?.length || 0;

    // ====================
    // DAILY BREAKDOWN
    // ====================
    const usageByDay = usageStats?.reduce((acc: any, day: any) => {
      const date = day.usage_date;
      if (!acc[date]) {
        acc[date] = { messages: 0, tokens: 0 };
      }
      acc[date].messages += day.message_count || 0;
      acc[date].tokens += day.token_count || 0;
      return acc;
    }, {});

    // ====================
    // RESPONSE
    // ====================
    return NextResponse.json({
      period,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
      },
      users: {
        total: totalUsers,
        byTier: tierCounts,
        newSignups,
      },
      revenue: {
        monthlyRecurring: totalMonthlyRevenue,
        byTier: revenueByTier,
        annualProjection: totalMonthlyRevenue * 12,
      },
      usage: {
        totalMessages,
        totalTokens,
        estimatedInputTokens,
        estimatedOutputTokens,
        byDay: usageByDay,
      },
      costs: {
        totalApiCost: parseFloat(totalApiCost.toFixed(2)),
        inputCost: parseFloat(inputCost.toFixed(2)),
        outputCost: parseFloat(outputCost.toFixed(2)),
        avgCostPerMessage: totalMessages > 0 ? parseFloat((totalApiCost / totalMessages).toFixed(4)) : 0,
      },
      profit: {
        gross: parseFloat((totalMonthlyRevenue - totalApiCost).toFixed(2)),
        margin: totalMonthlyRevenue > 0 ? parseFloat(((1 - totalApiCost / totalMonthlyRevenue) * 100).toFixed(2)) : 0,
      },
    });
  } catch (error: any) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin stats', details: error.message },
      { status: 500 }
    );
  }
}
