import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, checkPermission } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { captureAPIError } from '@/lib/api/utils';
import {
  adminEarningsQuerySchema,
  validateQuery,
  validationErrorResponse,
} from '@/lib/validation/schemas';

const log = logger('EarningsExcelExportAPI');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
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
    // Require admin authentication + export permission
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;
    const perm = checkPermission(auth, 'can_export_data');
    if (!perm.allowed) return perm.response;

    const supabase = getSupabaseAdmin();

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(adminEarningsQuerySchema, searchParams);
    if (!validation.success) {
      return NextResponse.json(validationErrorResponse(validation.error, validation.details), {
        status: 400,
      });
    }
    const { startDate, endDate } = validation.data;

    // Fetch earnings data (simplified version - reuse logic from main earnings endpoint)
    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name, subscription_tier')
      .eq('is_active', true);

    let usageQuery = supabase.from('usage_tracking').select('*');

    if (startDate) usageQuery = usageQuery.gte('created_at', startDate);
    if (endDate) usageQuery = usageQuery.lte('created_at', endDate);

    const { data: usageData } = await usageQuery;

    let newsQuery = supabase.from('news_costs').select('*');

    if (startDate) newsQuery = newsQuery.gte('created_at', startDate);
    if (endDate) newsQuery = newsQuery.lte('created_at', endDate);

    const { data: newsData } = await newsQuery;

    // Create CSV content
    const csvRows: string[] = [];

    // Header
    csvRows.push('JCIL.ai Financial Report');
    csvRows.push(`Date Range: ${startDate || 'All Time'} to ${endDate || 'Present'}`);
    csvRows.push('');

    // Summary Section
    csvRows.push('SUMMARY');
    csvRows.push('Category,Value');

    // Support both 'basic' and 'plus' tier names for backwards compatibility
    const tierCounts = { free: 0, plus: 0, pro: 0, executive: 0 };
    users?.forEach((u: { subscription_tier: string }) => {
      const tier = u.subscription_tier === 'basic' ? 'plus' : u.subscription_tier;
      if (tier in tierCounts) tierCounts[tier as keyof typeof tierCounts]++;
    });

    const tierPricing = { free: 0, plus: 18.0, pro: 30.0, executive: 99.0 };
    const monthlyRevenue = {
      free: tierCounts.free * tierPricing.free,
      plus: tierCounts.plus * tierPricing.plus,
      pro: tierCounts.pro * tierPricing.pro,
      executive: tierCounts.executive * tierPricing.executive,
    };
    const totalRevenue =
      monthlyRevenue.free + monthlyRevenue.plus + monthlyRevenue.pro + monthlyRevenue.executive;

    const totalCosts =
      usageData?.reduce(
        (sum: number, u: { total_cost: number }) => sum + (parseFloat(String(u.total_cost)) || 0),
        0
      ) || 0;
    const newsCosts =
      newsData?.reduce(
        (sum: number, n: { cost: number }) => sum + (parseFloat(String(n.cost)) || 0),
        0
      ) || 0;
    const totalProfit = totalRevenue - totalCosts - newsCosts;

    csvRows.push(`Total Users,${users?.length || 0}`);
    csvRows.push(`Total Revenue,$${totalRevenue.toFixed(2)}`);
    csvRows.push(`Total Costs,$${(totalCosts + newsCosts).toFixed(2)}`);
    csvRows.push(`Net Profit,$${totalProfit.toFixed(2)}`);
    csvRows.push(
      `Profit Margin,${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0}%`
    );
    csvRows.push('');

    // Revenue by Tier
    csvRows.push('REVENUE BY SUBSCRIPTION TIER');
    csvRows.push('Tier,User Count,Monthly Revenue Per User,Total Monthly Revenue');
    csvRows.push(
      `Free,${tierCounts.free},$${tierPricing.free.toFixed(2)},$${monthlyRevenue.free.toFixed(2)}`
    );
    csvRows.push(
      `Plus,${tierCounts.plus},$${tierPricing.plus.toFixed(2)},$${monthlyRevenue.plus.toFixed(2)}`
    );
    csvRows.push(
      `Pro,${tierCounts.pro},$${tierPricing.pro.toFixed(2)},$${monthlyRevenue.pro.toFixed(2)}`
    );
    csvRows.push(
      `Executive,${tierCounts.executive},$${tierPricing.executive.toFixed(2)},$${monthlyRevenue.executive.toFixed(2)}`
    );
    csvRows.push(`TOTAL,${users?.length || 0},,$${totalRevenue.toFixed(2)}`);
    csvRows.push('');

    // Costs by Model
    csvRows.push('API COSTS BY MODEL');
    csvRows.push(
      'Model,Usage Count,Input Tokens,Cached Input Tokens,Output Tokens,Live Search Calls,Total Cost'
    );

    const costsByModel: Record<
      string,
      {
        count: number;
        inputTokens: number;
        cachedInputTokens: number;
        outputTokens: number;
        liveSearchCalls: number;
        totalCost: number;
      }
    > = {};

    usageData?.forEach(
      (usage: {
        model_name: string;
        input_tokens: number;
        cached_input_tokens: number;
        output_tokens: number;
        live_search_calls: number;
        total_cost: number;
      }) => {
        if (!costsByModel[usage.model_name]) {
          costsByModel[usage.model_name] = {
            count: 0,
            inputTokens: 0,
            cachedInputTokens: 0,
            outputTokens: 0,
            liveSearchCalls: 0,
            totalCost: 0,
          };
        }
        costsByModel[usage.model_name].count++;
        costsByModel[usage.model_name].inputTokens += usage.input_tokens || 0;
        costsByModel[usage.model_name].cachedInputTokens += usage.cached_input_tokens || 0;
        costsByModel[usage.model_name].outputTokens += usage.output_tokens || 0;
        costsByModel[usage.model_name].liveSearchCalls += usage.live_search_calls || 0;
        costsByModel[usage.model_name].totalCost += parseFloat(String(usage.total_cost)) || 0;
      }
    );

    Object.entries(costsByModel).forEach(([model, stats]) => {
      csvRows.push(
        `${model},${stats.count},${stats.inputTokens},${stats.cachedInputTokens},${stats.outputTokens},${stats.liveSearchCalls},$${stats.totalCost.toFixed(8)}`
      );
    });
    csvRows.push('');

    // News Page Costs
    csvRows.push('NEWS PAGE COSTS');
    csvRows.push('Metric,Value');
    csvRows.push(`Total API Calls,${newsData?.length || 0}`);
    csvRows.push(
      `Total Tokens,${newsData?.reduce((sum: number, n: { tokens_used: number }) => sum + (n.tokens_used || 0), 0) || 0}`
    );
    csvRows.push(`Total Cost,$${newsCosts.toFixed(8)}`);
    csvRows.push('');

    // Detailed Usage by User
    csvRows.push('DETAILED USAGE BY USER');
    csvRows.push('User Email,User Name,Subscription Tier,Usage Count,Total Cost');

    const userUsage: Record<string, { count: number; cost: number }> = {};
    usageData?.forEach((usage: { user_id: string; total_cost: number }) => {
      if (!userUsage[usage.user_id]) {
        userUsage[usage.user_id] = { count: 0, cost: 0 };
      }
      userUsage[usage.user_id].count++;
      userUsage[usage.user_id].cost += parseFloat(String(usage.total_cost)) || 0;
    });

    users?.forEach(
      (u: { id: string; email: string; full_name: string | null; subscription_tier: string }) => {
        const usage = userUsage[u.id] || { count: 0, cost: 0 };
        csvRows.push(
          `${u.email || 'N/A'},"${u.full_name || 'N/A'}",${u.subscription_tier},${usage.count},$${usage.cost.toFixed(8)}`
        );
      }
    );

    // Join all rows
    const csv = csvRows.join('\n');

    // Return as downloadable CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="earnings-report-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    log.error('Error generating Excel export:', error instanceof Error ? error : { error });
    captureAPIError(error, '/api/admin/earnings/export/excel');
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
  }
}
