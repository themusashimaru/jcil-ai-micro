/**
 * ADMIN STATUS DASHBOARD
 *
 * Comprehensive health check for all system components.
 * Protected by requireAdmin — only accessible to admin users.
 *
 * Checks: Database, Redis, Stripe, Sentry, AI providers, Storage
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { successResponse } from '@/lib/api/utils';
import { createClient } from '@supabase/supabase-js';
import { isRedisAvailable } from '@/lib/redis/client';
import { isAnthropicConfigured, getAnthropicKeyStats } from '@/lib/anthropic/client';
import { logger } from '@/lib/logger';

const log = logger('AdminStatus');

export const dynamic = 'force-dynamic';

interface ComponentStatus {
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  details?: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

  const results: Record<string, ComponentStatus> = {};

  // 1. Database check
  const dbStart = Date.now();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error } = await supabase.from('users').select('id').limit(1);
    results.database = {
      status: error ? 'degraded' : 'healthy',
      latency: Date.now() - dbStart,
      details: error ? error.message : undefined,
    };
  } catch (e) {
    results.database = {
      status: 'down',
      latency: Date.now() - dbStart,
      details: (e as Error).message,
    };
  }

  // 2. Redis check
  try {
    const redisUp = await isRedisAvailable();
    results.redis = {
      status: redisUp ? 'healthy' : 'degraded',
      details: redisUp ? undefined : 'Redis unavailable — using in-memory fallback',
    };
  } catch {
    results.redis = { status: 'down', details: 'Redis check failed' };
  }

  // 3. AI provider check
  try {
    const configured = isAnthropicConfigured();
    const stats = getAnthropicKeyStats();
    results.ai = {
      status: configured ? 'healthy' : 'down',
      details: configured
        ? `${stats.totalKeys} key(s), ${stats.totalAvailable} available`
        : 'No API keys configured',
    };
  } catch {
    results.ai = { status: 'down', details: 'AI provider check failed' };
  }

  // 4. Stripe check
  try {
    const hasStripe = !!process.env.STRIPE_SECRET_KEY;
    const hasWebhook = !!process.env.STRIPE_WEBHOOK_SECRET;
    const hasPrices =
      !!process.env.STRIPE_PRICE_ID_PLUS &&
      !!process.env.STRIPE_PRICE_ID_PRO &&
      !!process.env.STRIPE_PRICE_ID_EXECUTIVE;
    results.stripe = {
      status: hasStripe && hasWebhook && hasPrices ? 'healthy' : hasStripe ? 'degraded' : 'down',
      details: !hasStripe
        ? 'STRIPE_SECRET_KEY missing'
        : !hasWebhook
          ? 'STRIPE_WEBHOOK_SECRET missing'
          : !hasPrices
            ? 'Some price IDs missing'
            : undefined,
    };
  } catch {
    results.stripe = { status: 'down', details: 'Stripe check failed' };
  }

  // 5. Sentry check
  results.sentry = {
    status: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'healthy' : 'degraded',
    details: process.env.NEXT_PUBLIC_SENTRY_DSN
      ? undefined
      : 'SENTRY_DSN not set — errors not tracked',
  };

  // 6. Storage check
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: buckets } = await supabase.storage.listBuckets();
    results.storage = {
      status: buckets ? 'healthy' : 'degraded',
      details: buckets ? `${buckets.length} bucket(s)` : 'Could not list buckets',
    };
  } catch {
    results.storage = { status: 'down', details: 'Storage check failed' };
  }

  // Overall status
  const statuses = Object.values(results).map((r) => r.status);
  const overall = statuses.includes('down')
    ? 'down'
    : statuses.includes('degraded')
      ? 'degraded'
      : 'healthy';

  log.info('Admin status check', { overall });

  return successResponse({
    overall,
    timestamp: new Date().toISOString(),
    components: results,
  });
}
