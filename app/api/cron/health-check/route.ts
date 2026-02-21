/**
 * HEALTH CHECK CRON JOB
 *
 * Runs every 10 minutes to monitor system health and
 * collect metrics for alerting. Checks:
 * - Database connectivity
 * - Redis connectivity
 * - Queue status
 * - API key availability
 *
 * SCHEDULE: *\/10 * * * * (every 10 minutes)
 * SECURITY: Requires CRON_SECRET in Authorization header
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { redis, isRedisAvailable } from '@/lib/redis/client';
import { getQueueStatus } from '@/lib/queue';
import { getAnthropicKeyStats, isAnthropicConfigured } from '@/lib/anthropic/client';
import { logger } from '@/lib/logger';

const log = logger('CronHealthCheck');

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    log.warn('CRON_SECRET not configured — cron jobs will be rejected');
    return false;
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    log.warn('Cron secret mismatch', {
      hasAuthHeader: !!authHeader,
      headerFormat: authHeader ? (authHeader.startsWith('Bearer ') ? 'Bearer' : 'other') : 'none',
      source: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    });
    return false;
  }

  return true;
}

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: { status: string; latencyMs?: number; error?: string };
    redis: { status: string; latencyMs?: number; error?: string };
    queue: {
      status: string;
      active: number;
      available: number;
      utilizationPercent: number;
    };
    anthropic: {
      status: string;
      totalKeys: number;
      availableKeys: number;
      primaryAvailable: number;
      fallbackAvailable: number;
    };
  };
  alerts: string[];
  timestamp: string;
  durationMs: number;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  // Security check
  if (!verifyCronSecret(request)) {
    log.warn('Unauthorized cron access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const alerts: string[] = [];
  const checks: HealthCheckResult['checks'] = {
    database: { status: 'unknown' },
    redis: { status: 'unknown' },
    queue: { status: 'unknown', active: 0, available: 0, utilizationPercent: 0 },
    anthropic: {
      status: 'unknown',
      totalKeys: 0,
      availableKeys: 0,
      primaryAvailable: 0,
      fallbackAvailable: 0,
    },
  };

  // Check Database
  try {
    const dbStart = Date.now();
    const supabase = createServerClient();
    const { error } = await supabase.from('conversations').select('id').limit(1);
    const dbLatency = Date.now() - dbStart;

    if (error) {
      checks.database = { status: 'unhealthy', error: error.message };
      alerts.push(`Database error: ${error.message}`);
    } else {
      checks.database = { status: 'healthy', latencyMs: dbLatency };
      if (dbLatency > 1000) {
        alerts.push(`Database latency high: ${dbLatency}ms`);
      }
    }
  } catch (error) {
    checks.database = { status: 'unhealthy', error: (error as Error).message };
    alerts.push(`Database unreachable: ${(error as Error).message}`);
  }

  // Check Redis
  try {
    if (isRedisAvailable() && redis) {
      const redisStart = Date.now();
      await redis.ping();
      const redisLatency = Date.now() - redisStart;
      checks.redis = { status: 'healthy', latencyMs: redisLatency };
      if (redisLatency > 500) {
        alerts.push(`Redis latency high: ${redisLatency}ms`);
      }
    } else {
      checks.redis = { status: 'degraded', error: 'Redis not configured' };
      alerts.push('Redis not configured - using in-memory fallback');
    }
  } catch (error) {
    checks.redis = { status: 'unhealthy', error: (error as Error).message };
    alerts.push(`Redis error: ${(error as Error).message}`);
  }

  // Check Queue
  try {
    const queueStatus = await getQueueStatus();
    const utilizationPercent = Math.round(
      (queueStatus.activeRequests / queueStatus.maxConcurrent) * 100
    );
    checks.queue = {
      status: utilizationPercent > 90 ? 'degraded' : 'healthy',
      active: queueStatus.activeRequests,
      available: queueStatus.available,
      utilizationPercent,
    };
    if (utilizationPercent > 80) {
      alerts.push(`Queue utilization high: ${utilizationPercent}%`);
    }
  } catch (error) {
    checks.queue = {
      status: 'unhealthy',
      active: 0,
      available: 0,
      utilizationPercent: 0,
    };
    alerts.push(`Queue error: ${(error as Error).message}`);
  }

  // Check Anthropic API Keys
  try {
    if (isAnthropicConfigured()) {
      const keyStats = getAnthropicKeyStats();
      const availabilityPercent = Math.round((keyStats.totalAvailable / keyStats.totalKeys) * 100);
      checks.anthropic = {
        status: availabilityPercent < 50 ? 'degraded' : 'healthy',
        totalKeys: keyStats.totalKeys,
        availableKeys: keyStats.totalAvailable,
        primaryAvailable: keyStats.primaryAvailable,
        fallbackAvailable: keyStats.fallbackAvailable,
      };
      if (availabilityPercent < 50) {
        alerts.push(`API key availability low: ${keyStats.totalAvailable}/${keyStats.totalKeys}`);
      }
    } else {
      checks.anthropic = {
        status: 'unhealthy',
        totalKeys: 0,
        availableKeys: 0,
        primaryAvailable: 0,
        fallbackAvailable: 0,
      };
      alerts.push('No Anthropic API keys configured');
    }
  } catch (error) {
    checks.anthropic = {
      status: 'unhealthy',
      totalKeys: 0,
      availableKeys: 0,
      primaryAvailable: 0,
      fallbackAvailable: 0,
    };
    alerts.push(`Anthropic check error: ${(error as Error).message}`);
  }

  // Determine overall status
  const hasUnhealthy = Object.values(checks).some((c) => c.status === 'unhealthy');
  const hasDegraded = Object.values(checks).some((c) => c.status === 'degraded');
  const overallStatus: 'healthy' | 'degraded' | 'unhealthy' = hasUnhealthy
    ? 'unhealthy'
    : hasDegraded
      ? 'degraded'
      : 'healthy';

  const duration = Date.now() - startTime;

  const result: HealthCheckResult = {
    status: overallStatus,
    checks,
    alerts,
    timestamp: new Date().toISOString(),
    durationMs: duration,
  };

  // Log health status
  if (overallStatus === 'unhealthy') {
    log.error('Health check UNHEALTHY', { alerts, checks });
  } else if (overallStatus === 'degraded') {
    log.warn('Health check DEGRADED', { alerts, checks });
  } else {
    log.info('Health check healthy', { durationMs: duration });
  }

  // Send alerts if configured (placeholder for webhook integration)
  if (alerts.length > 0 && process.env.ALERT_WEBHOOK_URL) {
    try {
      await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'jcil-ai',
          status: overallStatus,
          alerts,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      log.warn('Failed to send alert webhook');
    }
  }

  return NextResponse.json(result, {
    status: overallStatus === 'unhealthy' ? 503 : 200,
  });
}

// Also support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}
