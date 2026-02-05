/**
 * AGENTS HEALTH CHECK ROUTE
 *
 * Comprehensive health check for all AI agents in the system.
 * Reports status, configuration, and availability of each agent.
 *
 * GET /api/agents/health
 *
 * PROTECTED: Requires admin authentication
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

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

interface HealthResponse {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  agents: AgentStatus[];
  infrastructure: {
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

export async function GET() {
  // Require admin auth
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  log.info('Running agents health check');

  const agents: AgentStatus[] = [];
  const issues: string[] = [];

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

  // Infrastructure checks
  const braveConfigured = isBraveConfigured();
  const webSearchAvailable = isWebSearchAvailable();

  if (!braveConfigured) {
    issues.push('Infrastructure: BRAVE_API_KEY not configured');
  }

  // Calculate overall health
  const enabledCount = agents.filter((a) => a.enabled).length;
  const availableCount = agents.filter((a) => a.available).length;

  let overall: 'healthy' | 'degraded' | 'unhealthy';
  if (availableCount === agents.length && issues.length === 0) {
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
    enabled: enabledCount,
    available: availableCount,
    issues: issues.length,
  });

  return NextResponse.json(response);
}
