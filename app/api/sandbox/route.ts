/**
 * SANDBOX API ROUTE
 * =================
 *
 * Execute code in Vercel Sandbox VMs.
 * Rate limited by user subscription tier.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import {
  executeSandbox,
  quickTest,
  buildAndTest,
  getSandboxConfig,
  isSandboxConfigured,
  getMissingSandboxConfig,
} from '@/lib/connectors/vercel-sandbox';
import { logger } from '@/lib/logger';

const log = logger('SandboxAPI');

// Rate limits per subscription tier (executions per month)
// Maps to existing user subscription_tier values
const RATE_LIMITS: Record<string, number> = {
  free: 10,
  basic: 25, // $18/month
  pro: 100, // $30/month
  executive: 500, // $99/month (premium)
};

export async function POST(req: NextRequest) {
  try {
    // Get OIDC token from Vercel (available in request headers for serverless functions)
    const oidcToken = req.headers.get('x-vercel-oidc-token');

    // Check if sandbox is configured (OIDC from header OR access token from env)
    if (!isSandboxConfigured(oidcToken)) {
      const missing = getMissingSandboxConfig();
      return NextResponse.json(
        {
          error: 'Sandbox not configured',
          missing,
          hint: missing.includes('VERCEL_TEAM_ID')
            ? 'Find your Team ID at: Vercel Dashboard → Settings → General. Even personal Pro accounts have a Team ID.'
            : undefined,
        },
        { status: 503 }
      );
    }

    const sandboxConfig = getSandboxConfig(oidcToken);
    if (!sandboxConfig) {
      return NextResponse.json({ error: 'Invalid sandbox configuration' }, { status: 503 });
    }

    // Authenticate user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's subscription tier from users table
    let tier = 'free';
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();
      tier = (userData as unknown as { subscription_tier?: string })?.subscription_tier || 'free';
    } catch {
      // Default to free tier on error
    }
    const limit = RATE_LIMITS[tier] || RATE_LIMITS.free;

    // Count sandbox executions this month from token_usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: executionsUsed } = await supabase
      .from('token_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('tool', 'sandbox')
      .gte('created_at', startOfMonth.toISOString());

    const currentUsage = executionsUsed || 0;

    // Check rate limit
    if (currentUsage >= limit) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          limit,
          used: currentUsage,
          tier,
        },
        { status: 429 }
      );
    }

    // Parse request
    const body = await req.json();
    const { type, ...options } = body;

    let result;

    switch (type) {
      case 'quick':
        // Quick test: just run a code snippet
        result = await quickTest(sandboxConfig, options.code, options.language || 'javascript');
        break;

      case 'build':
        // Build and test a project
        result = await buildAndTest(sandboxConfig, options.files, {
          packageManager: options.packageManager,
          buildCommand: options.buildCommand,
          testCommand: options.testCommand,
        });
        break;

      case 'execute':
        // Full execution with custom commands
        result = await executeSandbox(sandboxConfig, {
          files: options.files,
          commands: options.commands,
          runtime: options.runtime,
          timeout: options.timeout,
          vcpus: options.vcpus,
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid execution type. Use: quick, build, or execute' },
          { status: 400 }
        );
    }

    // Track sandbox execution in token_usage
    await supabase.from('token_usage').insert({
      user_id: user.id,
      model: 'vercel-sandbox',
      route: 'sandbox',
      tool: 'sandbox',
      input_tokens: 0,
      output_tokens: 0,
    });

    return NextResponse.json({
      ...result,
      usage: {
        used: currentUsage + 1,
        limit,
        remaining: limit - currentUsage - 1,
      },
    });
  } catch (error) {
    log.error('Sandbox execution error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Code execution failed' }, { status: 500 });
  }
}

/**
 * GET - Check sandbox status and usage
 */
export async function GET(req: NextRequest) {
  try {
    // Get OIDC token from Vercel (available in request headers for serverless functions)
    const oidcToken = req.headers.get('x-vercel-oidc-token');
    const configured = isSandboxConfigured(oidcToken);

    if (!configured) {
      const missing = getMissingSandboxConfig(oidcToken);
      return NextResponse.json({
        available: false,
        reason: 'Sandbox not configured',
        missing,
        hint: missing.includes('VERCEL_TEAM_ID')
          ? 'Find your Team ID at: Vercel Dashboard → Settings → General. Even personal Pro accounts have a Team ID.'
          : undefined,
      });
    }

    // Authenticate user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        available: configured,
        authenticated: false,
      });
    }

    // Get user's subscription tier
    let tier = 'free';
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();
      tier = (userData as unknown as { subscription_tier?: string })?.subscription_tier || 'free';
    } catch {
      // Default to free tier on error
    }
    const limit = RATE_LIMITS[tier] || RATE_LIMITS.free;

    // Count sandbox executions this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: executionsUsed } = await supabase
      .from('token_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('tool', 'sandbox')
      .gte('created_at', startOfMonth.toISOString());

    const currentUsage = executionsUsed || 0;

    return NextResponse.json({
      available: true,
      authenticated: true,
      tier,
      usage: {
        used: currentUsage,
        limit,
        remaining: Math.max(0, limit - currentUsage),
      },
    });
  } catch (error) {
    log.error('Sandbox status error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Failed to get sandbox status' }, { status: 500 });
  }
}
