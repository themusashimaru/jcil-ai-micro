import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { captureAPIError } from '@/lib/api/utils';
import {
  adminReportGenerateSchema,
  validateBody,
  validationErrorResponse,
} from '@/lib/validation/schemas';

const log = logger('EarningsReportAPI');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for report generation

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

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication with CSRF validation
    const auth = await requireAdmin(request);
    if (!auth.authorized) return auth.response;

    const supabase = getSupabaseAdmin();

    // Parse and validate request body
    const body = await request.json();
    const validation = validateBody(adminReportGenerateSchema, body);
    if (!validation.success) {
      return NextResponse.json(validationErrorResponse(validation.error, validation.details), {
        status: 400,
      });
    }
    const { reportType, startDate, endDate } = validation.data;

    // Calculate date range if not provided
    let calculatedStartDate = startDate;
    const calculatedEndDate = endDate || new Date().toISOString().split('T')[0];

    if (!calculatedStartDate) {
      const now = new Date();
      switch (reportType) {
        case 'daily':
          calculatedStartDate = new Date(now.setDate(now.getDate() - 1))
            .toISOString()
            .split('T')[0];
          break;
        case 'monthly':
          calculatedStartDate = new Date(now.setMonth(now.getMonth() - 1))
            .toISOString()
            .split('T')[0];
          break;
        case 'quarterly':
          calculatedStartDate = new Date(now.setMonth(now.getMonth() - 3))
            .toISOString()
            .split('T')[0];
          break;
        case 'half-yearly':
          calculatedStartDate = new Date(now.setMonth(now.getMonth() - 6))
            .toISOString()
            .split('T')[0];
          break;
        case 'yearly':
          calculatedStartDate = new Date(now.setFullYear(now.getFullYear() - 1))
            .toISOString()
            .split('T')[0];
          break;
      }
    }

    // Fetch financial data
    const { data: users } = await supabase
      .from('users')
      .select('id, subscription_tier')
      .eq('is_active', true);

    const { data: usageData } = await supabase
      .from('usage_tracking')
      .select('*')
      .gte('created_at', calculatedStartDate)
      .lte('created_at', calculatedEndDate);

    const { data: newsData } = await supabase
      .from('news_costs')
      .select('*')
      .gte('created_at', calculatedStartDate)
      .lte('created_at', calculatedEndDate);

    // Calculate metrics (support both 'basic' and 'plus' tier names for backwards compatibility)
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
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : '0';

    // Cost breakdown by model
    const costsByModel: Record<string, { count: number; cost: number }> = {};
    usageData?.forEach((usage: { model_name: string; total_cost: number }) => {
      if (!costsByModel[usage.model_name]) {
        costsByModel[usage.model_name] = { count: 0, cost: 0 };
      }
      costsByModel[usage.model_name].count++;
      costsByModel[usage.model_name].cost += parseFloat(String(usage.total_cost)) || 0;
    });

    // Prepare data for Claude
    const financialData = {
      period: {
        type: reportType,
        start: calculatedStartDate,
        end: calculatedEndDate,
      },
      users: {
        total: users?.length || 0,
        byTier: tierCounts,
      },
      revenue: {
        total: totalRevenue,
        byTier: monthlyRevenue,
      },
      costs: {
        total: totalCosts + newsCosts,
        api: totalCosts,
        news: newsCosts,
        byModel: costsByModel,
      },
      profit: {
        total: totalProfit,
        margin: profitMargin,
      },
    };

    // Generate report using Claude
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const prompt = `You are a business analyst for JCIL.ai, an AI chat platform. Generate a comprehensive ${reportType} business report based on the following financial data:

${JSON.stringify(financialData, null, 2)}

Please provide:

1. **Executive Summary** (2-3 paragraphs)
   - Overall business performance
   - Key highlights and concerns
   - Period-over-period trends (if applicable)

2. **Revenue Analysis**
   - Total revenue and breakdown by subscription tier
   - Revenue trends and patterns
   - Customer acquisition and retention insights

3. **Cost Analysis**
   - API costs breakdown by model (claude-haiku, claude-sonnet, perplexity)
   - News page costs (updated every 30 min)
   - Cost efficiency metrics
   - Areas of high spend

4. **Profitability Analysis**
   - Net profit and profit margin
   - Profitability by user tier
   - Break-even analysis

5. **Key Metrics**
   - User growth by tier
   - Average revenue per user (ARPU)
   - Cost per user
   - Customer lifetime value indicators

6. **Strategic Recommendations**
   - Cost optimization opportunities
   - Revenue growth strategies
   - Pricing adjustments (if needed)
   - Product/feature priorities

7. **Action Items**
   - Top 3-5 concrete action items for the next period
   - Priority level for each

Format the report professionally with clear sections, bullet points where appropriate, and actionable insights. Use specific numbers from the data provided.`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system:
          'You are a professional business analyst specializing in SaaS and AI platform financial analysis.',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.json();
      throw new Error(`Claude API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const claudeData = await claudeResponse.json();
    const reportContent = claudeData.content[0].text;

    // Save report to database
    const { data: savedReport, error: saveError } = await supabase
      .from('business_reports')
      .insert({
        report_type: reportType,
        report_period_start: calculatedStartDate,
        report_period_end: calculatedEndDate,
        summary: reportContent.substring(0, 500), // First 500 chars
        key_metrics: financialData,
        full_report: reportContent,
        generated_by: null, // TODO: Add admin user ID when auth is implemented
      })
      .select()
      .single();

    if (saveError) {
      log.error(
        'Error saving report:',
        saveError instanceof Error ? saveError : { error: saveError }
      );
      // Continue anyway - report was generated
    }

    return NextResponse.json({
      success: true,
      data: {
        reportId: savedReport?.id,
        reportType,
        period: {
          start: calculatedStartDate,
          end: calculatedEndDate,
        },
        metrics: financialData,
        report: reportContent,
      },
    });
  } catch (error) {
    log.error('Error generating report:', error instanceof Error ? error : { error });
    captureAPIError(error, '/api/admin/earnings/generate-report');
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
