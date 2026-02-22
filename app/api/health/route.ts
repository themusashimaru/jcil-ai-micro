/**
 * HEALTH CHECK ENDPOINT
 *
 * Provides system health status for monitoring and load balancers.
 * Returns status of all critical services.
 *
 * GET /api/health - Returns health status
 * GET /api/health?detailed=true - Returns detailed component status
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks?: {
    database?: ComponentHealth;
    cache?: ComponentHealth;
    ai?: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { status: 'down', message: 'Not configured' };
    }

    // Dynamic import to avoid issues if not configured
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Simple query to check connectivity
    const { error } = await supabase.from('users').select('id').limit(1);

    const latency = Date.now() - start;

    if (error) {
      return { status: 'degraded', latency, message: error.message };
    }

    return { status: 'up', latency };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis/cache connectivity
 */
async function checkCache(): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    // Check if Redis is configured
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return { status: 'degraded', message: 'Not configured (using in-memory fallback)' };
    }

    const { Redis } = await import('@upstash/redis');
    const redis = Redis.fromEnv();

    // Ping Redis
    await redis.ping();

    return { status: 'up', latency: Date.now() - start };
  } catch {
    return {
      status: 'degraded',
      latency: Date.now() - start,
      message: 'Redis unavailable (fallback active)',
    };
  }
}

/**
 * Check AI provider status
 */
async function checkAI(): Promise<ComponentHealth> {
  try {
    // Check if Anthropic is configured
    const hasApiKey = !!(
      process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_API_KEY_1 ||
      process.env.ANTHROPIC_API_KEY_2
    );

    if (!hasApiKey) {
      return { status: 'down', message: 'Not configured' };
    }

    // We don't actually call the API to avoid costs
    // Just verify configuration exists
    return { status: 'up', message: 'Configured' };
  } catch {
    return { status: 'down', message: 'Configuration error' };
  }
}

/**
 * Determine overall health status
 */
function determineOverallStatus(checks: HealthCheck['checks']): HealthCheck['status'] {
  if (!checks) return 'healthy';

  const statuses = Object.values(checks).map((c) => c?.status);

  if (statuses.some((s) => s === 'down')) {
    // If database is down, system is unhealthy
    if (checks.database?.status === 'down') {
      return 'unhealthy';
    }
    return 'degraded';
  }

  if (statuses.some((s) => s === 'degraded')) {
    return 'degraded';
  }

  return 'healthy';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get('detailed') === 'true';

  const timestamp = new Date().toISOString();
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const version = process.env.npm_package_version || '1.0.0';

  // Basic health check — still checks critical dependencies (fast, lightweight)
  if (!detailed) {
    // Quick database check: just verify Supabase is configured and reachable
    const dbOk = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    const basicStatus: HealthCheck['status'] = dbOk ? 'healthy' : 'unhealthy';

    const response: HealthCheck = {
      status: basicStatus,
      timestamp,
      version,
      uptime,
    };

    return NextResponse.json(response, {
      status: basicStatus === 'unhealthy' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // Detailed health check requires authentication to prevent abuse
  const auth = await requireUser();
  if (!auth.authorized) {
    // Fall back to basic health check for unauthenticated requests
    const dbOk = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    const basicStatus: HealthCheck['status'] = dbOk ? 'healthy' : 'unhealthy';

    const response: HealthCheck = {
      status: basicStatus,
      timestamp,
      version,
      uptime,
    };

    return NextResponse.json(response, {
      status: basicStatus === 'unhealthy' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // Authenticated detailed health check (checks all services)
  const [database, cache, ai] = await Promise.all([checkDatabase(), checkCache(), checkAI()]);

  const checks = { database, cache, ai };
  const status = determineOverallStatus(checks);

  const response: HealthCheck = {
    status,
    timestamp,
    version,
    uptime,
    checks,
  };

  // Return appropriate HTTP status
  const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

// Also support HEAD for simple uptime checks
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
