/**
 * HEALTH CHECK ENDPOINT
 *
 * PURPOSE:
 * - Provide health status for load balancers and monitoring
 * - Check database connectivity
 * - Check external service availability
 * - Return quick response for uptime monitoring
 *
 * USAGE:
 * - GET /api/health - Quick health check (load balancer)
 * - GET /api/health?detailed=true - Detailed health with service checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Always fresh response

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services?: {
    database: ServiceStatus;
    anthropic: ServiceStatus;
    e2b?: ServiceStatus;
  };
}

interface ServiceStatus {
  status: 'ok' | 'degraded' | 'error';
  latency?: number;
  message?: string;
}

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * GET /api/health
 *
 * Quick health check for load balancers (< 100ms response)
 * Add ?detailed=true for full service health
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const detailed = url.searchParams.get('detailed') === 'true';

  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || '1.0.0',
  };

  // Quick response for load balancers
  if (!detailed) {
    return NextResponse.json(health, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // Detailed health check with service status
  health.services = {
    database: await checkDatabase(),
    anthropic: checkAnthropicConfig(),
  };

  // Check E2B if configured
  if (process.env.E2B_API_KEY) {
    health.services.e2b = checkE2BConfig();
  }

  // Determine overall status
  const serviceStatuses = Object.values(health.services);
  if (serviceStatuses.some(s => s.status === 'error')) {
    health.status = 'unhealthy';
  } else if (serviceStatuses.some(s => s.status === 'degraded')) {
    health.status = 'degraded';
  }

  const httpStatus = health.status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(health, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'error',
        message: 'Database not configured',
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Simple query to test connectivity
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    const latency = Date.now() - start;

    if (error) {
      // Check if it's just a missing table (schema not applied)
      if (error.code === '42P01') {
        return {
          status: 'degraded',
          latency,
          message: 'Database connected but schema incomplete',
        };
      }
      return {
        status: 'error',
        latency,
        message: error.message,
      };
    }

    return {
      status: latency > 1000 ? 'degraded' : 'ok',
      latency,
    };
  } catch (error) {
    return {
      status: 'error',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Anthropic API configuration
 */
function checkAnthropicConfig(): ServiceStatus {
  // Check for any API key
  const hasKey = process.env.ANTHROPIC_API_KEY ||
                 process.env.ANTHROPIC_API_KEY_1 ||
                 process.env.ANTHROPIC_API_KEY_FALLBACK_1;

  if (!hasKey) {
    return {
      status: 'error',
      message: 'Anthropic API key not configured',
    };
  }

  return {
    status: 'ok',
  };
}

/**
 * Check E2B API configuration
 */
function checkE2BConfig(): ServiceStatus {
  if (!process.env.E2B_API_KEY) {
    return {
      status: 'error',
      message: 'E2B API key not configured',
    };
  }

  return {
    status: 'ok',
  };
}
