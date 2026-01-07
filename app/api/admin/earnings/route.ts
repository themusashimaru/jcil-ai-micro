import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const supabase = getSupabaseAdmin();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 1. Get total users by subscription tier
    const { data: usersByTier, error: usersError } = await supabase
      .from('users')
      .select('subscription_tier, id')
      .eq('is_active', true);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const tierCounts = {
      free: 0,
      basic: 0,
      pro: 0,
      executive: 0,
    };

    usersByTier?.forEach((user: { subscription_tier: string }) => {
      const tier = user.subscription_tier as keyof typeof tierCounts;
      if (tier in tierCounts) {
        tierCounts[tier]++;
      }
    });

    // 2. Get subscription pricing
    const { data: subscriptionTiers, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('*');

    if (tiersError) {
      console.error('Error fetching subscription tiers:', tiersError);
    }

    // Calculate monthly revenue
    const tierPricing: Record<string, number> = {
      free: 0,
      plus: 18.00,
      pro: 30.00,
      executive: 99.00,
    };

    subscriptionTiers?.forEach((tier: { tier_name: string; monthly_price: number }) => {
      tierPricing[tier.tier_name] = tier.monthly_price;
    });

    const monthlyRevenue = {
      free: tierCounts.free * tierPricing.free,
      basic: tierCounts.basic * tierPricing.basic,
      pro: tierCounts.pro * tierPricing.pro,
      executive: tierCounts.executive * tierPricing.executive,
      total: 0,
    };

    monthlyRevenue.total =
      monthlyRevenue.free +
      monthlyRevenue.basic +
      monthlyRevenue.pro +
      monthlyRevenue.executive;

    // 3. Get usage tracking data for costs
    let usageQuery = supabase
      .from('usage_tracking')
      .select('*');

    if (startDate) {
      usageQuery = usageQuery.gte('created_at', startDate);
    }
    if (endDate) {
      usageQuery = usageQuery.lte('created_at', endDate);
    }

    const { data: usageData, error: usageError } = await usageQuery;

    if (usageError) {
      console.error('Error fetching usage data:', usageError);
    }

    // Calculate costs by model
    const costsByModel: Record<string, {
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      liveSearchCalls: number;
      totalCost: number;
      usageCount: number;
    }> = {};

    usageData?.forEach((usage: {
      model_name: string;
      input_tokens: number;
      cached_input_tokens: number;
      output_tokens: number;
      live_search_calls: number;
      total_cost: number;
    }) => {
      if (!costsByModel[usage.model_name]) {
        costsByModel[usage.model_name] = {
          inputTokens: 0,
          cachedInputTokens: 0,
          outputTokens: 0,
          liveSearchCalls: 0,
          totalCost: 0,
          usageCount: 0,
        };
      }

      costsByModel[usage.model_name].inputTokens += usage.input_tokens || 0;
      costsByModel[usage.model_name].cachedInputTokens += usage.cached_input_tokens || 0;
      costsByModel[usage.model_name].outputTokens += usage.output_tokens || 0;
      costsByModel[usage.model_name].liveSearchCalls += usage.live_search_calls || 0;
      costsByModel[usage.model_name].totalCost += parseFloat(String(usage.total_cost)) || 0;
      costsByModel[usage.model_name].usageCount += 1;
    });

    const totalCosts = Object.values(costsByModel).reduce((sum, model) => sum + model.totalCost, 0);

    // 4. Get costs by user tier
    const costsByTier: Record<string, number> = {
      free: 0,
      basic: 0,
      pro: 0,
      executive: 0,
    };

    // Join usage with users to get tier information
    for (const usage of usageData || []) {
      const user = usersByTier?.find((u: { id: string }) => u.id === (usage as { user_id: string }).user_id);
      if (user) {
        const tier = (user as { subscription_tier: string }).subscription_tier;
        if (tier in costsByTier) {
          costsByTier[tier] += parseFloat(String((usage as { total_cost: number }).total_cost)) || 0;
        }
      }
    }

    // 5. Get news page costs
    let newsQuery = supabase
      .from('news_costs')
      .select('*');

    if (startDate) {
      newsQuery = newsQuery.gte('created_at', startDate);
    }
    if (endDate) {
      newsQuery = newsQuery.lte('created_at', endDate);
    }

    const { data: newsData, error: newsError } = await newsQuery;

    if (newsError) {
      console.error('Error fetching news costs:', newsError);
    }

    const newsCosts = {
      totalCalls: newsData?.length || 0,
      totalTokens: newsData?.reduce((sum: number, item: { tokens_used: number }) => sum + (item.tokens_used || 0), 0) || 0,
      totalCost: newsData?.reduce((sum: number, item: { cost: number }) => sum + (parseFloat(String(item.cost)) || 0), 0) || 0,
    };

    // 6. Calculate profit margins by tier
    const profitByTier = {
      free: monthlyRevenue.free - costsByTier.free,
      basic: monthlyRevenue.basic - costsByTier.basic,
      pro: monthlyRevenue.pro - costsByTier.pro,
      executive: monthlyRevenue.executive - costsByTier.executive,
      total: monthlyRevenue.total - totalCosts - newsCosts.totalCost,
    };

    // 7. Get API pricing for reference
    const { data: apiPricing } = await supabase
      .from('api_pricing')
      .select('*');

    // 8. Calculate daily averages (if date range provided)
    let daysInRange = 30; // Default to 30 days
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      daysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    const dailyAverages = {
      revenue: monthlyRevenue.total / daysInRange,
      costs: (totalCosts + newsCosts.totalCost) / daysInRange,
      profit: profitByTier.total / daysInRange,
    };

    return NextResponse.json({
      success: true,
      data: {
        users: {
          byTier: tierCounts,
          total: usersByTier?.length || 0,
        },
        revenue: {
          monthly: monthlyRevenue,
          daily: dailyAverages.revenue,
        },
        costs: {
          byModel: costsByModel,
          byTier: costsByTier,
          news: newsCosts,
          total: totalCosts + newsCosts.totalCost,
          daily: dailyAverages.costs,
        },
        profit: {
          byTier: profitByTier,
          daily: dailyAverages.profit,
          margin: monthlyRevenue.total > 0
            ? ((profitByTier.total / monthlyRevenue.total) * 100).toFixed(2) + '%'
            : '0%',
        },
        apiPricing,
        dateRange: {
          start: startDate || 'all time',
          end: endDate || 'present',
          days: daysInRange,
        },
      },
    });

  } catch (error) {
    console.error('Error calculating earnings:', error);
    return NextResponse.json(
      { error: 'Failed to calculate earnings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
