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
import { isResearchAgentEnabled, shouldUseResearchAgent } from '@/agents/research';
import { isCodeAgentEnabled, shouldUseCodeAgent, isCodeReviewRequest } from '@/agents/code';
import { listAgents, getAgent } from '@/agents';

// Research executors
import { braveExecutor } from '@/agents/research/executors/BraveExecutor';
import { documentExecutor } from '@/agents/research/executors/DocumentExecutor';

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
    registeredAgents: string[];
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

  // 1. Research Agent Health Check
  try {
    const researchEnabled = isResearchAgentEnabled();
    const researchAgent = getAgent('research');

    // Test detection with sample queries
    const detectsResearch = shouldUseResearchAgent('Research my competitors in the AI market');
    const ignoresSimple = !shouldUseResearchAgent('Hello, how are you?');

    // Check brave executor configuration
    const braveAvailable = await braveExecutor.isAvailable();

    agents.push({
      name: 'Research Agent',
      enabled: researchEnabled,
      available: !!researchAgent && braveAvailable,
      detectionWorking: detectsResearch && ignoresSimple,
      details: {
        braveExecutor: braveAvailable,
        documentSearch: await documentExecutor.isAvailable('test-user'),
        detectsResearchQueries: detectsResearch,
        ignoresSimpleQueries: ignoresSimple,
      },
    });

    if (!braveAvailable) {
      issues.push('Research Agent: Brave Search not configured');
    }
  } catch (error) {
    agents.push({
      name: 'Research Agent',
      enabled: false,
      available: false,
      detectionWorking: false,
      error: (error as Error).message,
    });
    issues.push(`Research Agent: ${(error as Error).message}`);
  }

  // 2. Code Agent Health Check
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

  // 3. Strategy Agent Health Check (check if imports work)
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
  const registeredAgents = listAgents();

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
      registeredAgents,
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
