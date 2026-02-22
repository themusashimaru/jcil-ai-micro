/**
 * AGENTS HEALTH CHECK ROUTE
 *
 * Comprehensive health check for all AI agents in the system.
 * Reports status, configuration, and availability of each agent.
 * Also checks critical infrastructure: Supabase (database) and Redis (cache).
 *
 * GET /api/agents/health
 *
 * PROTECTED: Requires admin authentication
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { redis, isRedisAvailable } from '@/lib/redis/client';

// Agent imports
import { isCodeAgentEnabled, shouldUseCodeAgent, isCodeReviewRequest } from '@/agents/code';

// Tools availability
import { isWebSearchAvailable } from '@/lib/ai/tools/web-search';
import { isBraveConfigured } from '@/lib/brave';

const log = logger('AgentsHealth');

export const maxDuration = 30; // 30 seconds for health checks

interface AgentStatus {
  name: string;
  enabled: boolean;
  available: boolean;
  detectionWorking: boolean;
  details?: Record<string, unknown>;
  error?: string;
}

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

interface HealthResponse {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  agents: AgentStatus[];
  infrastructure: {
    database: ComponentHealth;
    redis: ComponentHealth;
    braveSearch: boolean;
    webSearchTool: boolean;
  };
  summary: {
    total: number;
    enabled: number;
    available: number;
    issues: string[];
  };
}

/**
 * Check Supabase database connectivity
 */
async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { status: 'down', message: 'Supabase not configured' };
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase.from('users').select('id').limit(1);
    const latency = Date.now() - start;

    if (error) {
      // Table not found is degraded, not down
      if (error.code === '42P01') {
        return {
          status: 'degraded',
          latency,
          message: 'Table not found (may be expected in fresh setup)',
        };
      }
      return { status: 'down', latency, message: error.message };
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
 * Check Redis connectivity
 */
async function checkRedis(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    if (!isRedisAvailable() || !redis) {
      return { status: 'degraded', message: 'Redis not configured (using in-memory fallback)' };
    }

    await redis.ping();
    return { status: 'up', latency: Date.now() - start };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Redis ping failed',
    };
  }
}

export async function GET() {
  // Require admin auth
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  log.info('Running agents health check');

  const agents: AgentStatus[] = [];
  const issues: string[] = [];

  // Run infrastructure checks in parallel with agent checks
  const [dbHealth, redisHealth] = await Promise.all([checkDatabase(), checkRedis()]);

  // Track infrastructure issues
  if (dbHealth.status === 'down') {
    issues.push(`Database: ${dbHealth.message || 'unreachable'}`);
  } else if (dbHealth.status === 'degraded') {
    issues.push(`Database: ${dbHealth.message || 'degraded'}`);
  }

  if (redisHealth.status === 'down') {
    issues.push(`Redis: ${redisHealth.message || 'unreachable'}`);
  } else if (redisHealth.status === 'degraded') {
    issues.push(`Redis: ${redisHealth.message || 'degraded'}`);
  }

  // 1. Code Agent Health Check
  try {
    const codeEnabled = isCodeAgentEnabled();

    // Test detection with sample queries
    const detectsBuild = shouldUseCodeAgent('Build me a React app');
    const detectsReview = isCodeReviewRequest('Review my code for bugs');
    const ignoresSimple = !shouldUseCodeAgent('What is TypeScript?');

    agents.push({
      name: 'Code Agent',
      enabled: codeEnabled,
      available: codeEnabled,
      detectionWorking: detectsBuild && detectsReview && ignoresSimple,
      details: {
        detectsBuildRequests: detectsBuild,
        detectsReviewRequests: detectsReview,
        ignoresNonCodeQueries: ignoresSimple,
      },
    });
  } catch (error) {
    agents.push({
      name: 'Code Agent',
      enabled: false,
      available: false,
      detectionWorking: false,
      error: (error as Error).message,
    });
    issues.push(`Code Agent: ${(error as Error).message}`);
  }

  // 2. Strategy Agent Health Check (Deep Strategy, Deep Research, Quick Research)
  try {
    // Dynamic import to test availability
    const strategyModule = await import('@/agents/strategy');
    const toolsModule = await import('@/agents/strategy/tools');

    const agentAvailable = typeof strategyModule.createStrategyAgent === 'function';
    const toolsAvailable = typeof toolsModule.executeScoutTool === 'function';

    agents.push({
      name: 'Strategy Agent',
      enabled: true,
      available: agentAvailable && toolsAvailable,
      detectionWorking: true,
      details: {
        strategyAgentAvailable: agentAvailable,
        scoutToolsAvailable: toolsAvailable,
        executionQueueAvailable: typeof strategyModule.createExecutionQueue === 'function',
        modes: ['strategy', 'research', 'quick-research'],
      },
    });
  } catch (error) {
    agents.push({
      name: 'Strategy Agent',
      enabled: false,
      available: false,
      detectionWorking: false,
      error: (error as Error).message,
    });
    issues.push(`Strategy Agent: ${(error as Error).message}`);
  }

  // Additional infrastructure checks
  const braveConfigured = isBraveConfigured();
  const webSearchAvailable = isWebSearchAvailable();

  if (!braveConfigured) {
    issues.push('Infrastructure: BRAVE_API_KEY not configured');
  }

  // Calculate overall health — infrastructure DOWN = unhealthy
  const enabledCount = agents.filter((a) => a.enabled).length;
  const availableCount = agents.filter((a) => a.available).length;

  let overall: 'healthy' | 'degraded' | 'unhealthy';
  if (dbHealth.status === 'down' || redisHealth.status === 'down') {
    // Critical infrastructure is down
    overall = 'unhealthy';
  } else if (
    availableCount === agents.length &&
    issues.length === 0 &&
    dbHealth.status === 'up' &&
    redisHealth.status === 'up'
  ) {
    overall = 'healthy';
  } else if (availableCount >= 1) {
    overall = 'degraded';
  } else {
    overall = 'unhealthy';
  }

  const response: HealthResponse = {
    timestamp: new Date().toISOString(),
    overall,
    agents,
    infrastructure: {
      database: dbHealth,
      redis: redisHealth,
      braveSearch: braveConfigured,
      webSearchTool: webSearchAvailable,
    },
    summary: {
      total: agents.length,
      enabled: enabledCount,
      available: availableCount,
      issues,
    },
  };

  log.info('Agents health check complete', {
    overall,
    database: dbHealth.status,
    redis: redisHealth.status,
    enabled: enabledCount,
    available: availableCount,
    issues: issues.length,
  });

  // Return 503 if unhealthy so load balancers and monitors catch it
  const httpStatus = overall === 'unhealthy' ? 503 : 200;

  return NextResponse.json(response, { status: httpStatus });
}
