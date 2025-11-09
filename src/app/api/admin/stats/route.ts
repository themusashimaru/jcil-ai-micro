import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Pricing constants
const PRICING = {
  free: 0,
  basic: 12,
  pro: 30,
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

    // Calculate fiscal period date ranges (calendar year based)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    const currentQuarter = Math.floor(currentMonth / 3); // 0-3 (Q1-Q4)
    const currentHalf = Math.floor(currentMonth / 6); // 0-1 (H1-H2)

    const ranges: Record<string, Date> = {
      // Today only
      daily: new Date(now.getFullYear(), now.getMonth(), now.getDate()),

      // First day of current month
      monthly: new Date(currentYear, currentMonth, 1),

      // First day of current quarter (Jan/Apr/Jul/Oct)
      quarterly: new Date(currentYear, currentQuarter * 3, 1),

      // First day of current half (Jan or Jul)
      half: new Date(currentYear, currentHalf * 6, 1),

      // First day of current year
      yearly: new Date(currentYear, 0, 1),
    };

    const startDate = ranges[period] || ranges.monthly;

    console.log(`Admin stats: period=${period}, startDate=${startDate.toISOString().split('T')[0]}, endDate=${now.toISOString().split('T')[0]}`);

    // ====================
    // USER STATS
    // ====================
    const { data: usersByTier, error: usersError } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .order('subscription_tier');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    // Count users by tier
    const tierCounts = usersByTier?.reduce((acc: any, user: any) => {
      const tier = user.subscription_tier || 'free';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Calculate total users
    const totalUsers = usersByTier?.length || 0;

    // ====================
    // REVENUE STATS
    // ====================
    // Always show ALL tiers, even if they have 0 users
    const allTiers = ['free', 'basic', 'pro', 'executive'];
    const revenueByTier = allTiers.map(tier => {
      const count = tierCounts[tier] || 0;
      return {
        tier,
        count,
        monthlyRevenue: count * (PRICING[tier as keyof typeof PRICING] || 0),
      };
    });

    const totalMonthlyRevenue = revenueByTier.reduce((sum, tier) => sum + tier.monthlyRevenue, 0);

    // ====================
    // USAGE STATS
    // ====================
    const { data: usageStats, error: usageError } = await supabase
      .from('daily_usage')
      .select('usage_date, message_count, token_count')
      .gte('usage_date', startDate.toISOString().split('T')[0])
      .order('usage_date', { ascending: false });

    if (usageError) {
      console.error('Error fetching usage stats:', usageError);
      throw usageError;
    }

    // Aggregate usage stats
    console.log(`Found ${usageStats?.length || 0} days of usage data for period ${period}`);
    const totalMessages = usageStats?.reduce((sum: number, day: any) => sum + (day.message_count || 0), 0) || 0;
    const totalTokens = usageStats?.reduce((sum: number, day: any) => sum + (day.token_count || 0), 0) || 0;
    console.log(`Period ${period}: ${totalMessages} messages, ${totalTokens} tokens`);

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
    const { data: signupData, error: signupError } = await supabase
      .from('user_profiles')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString());

    const newSignups = signupData?.length || 0;
    console.log(`New signups in period ${period}: ${newSignups}`);

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
    }, {} as Record<string, { messages: number; tokens: number }>) || {};

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
