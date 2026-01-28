/**
 * PERFORMANCE TRACKER - Scout Learning System
 *
 * Records how well each scout configuration performed. Over time,
 * the Master Architect uses this data to design better agent armies.
 *
 * Tracks: tool combinations, research approaches, findings quality,
 * execution metrics, and failure rates.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { AgentMode, AgentBlueprint, Finding, PerformanceInsight } from './types';
import { logger } from '@/lib/logger';

const log = logger('PerformanceTracker');

// =============================================================================
// SUPABASE SERVICE CLIENT
// =============================================================================

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase credentials for PerformanceTracker');
  }
  return createServiceClient(url, key);
}

// =============================================================================
// RECORD PERFORMANCE
// =============================================================================

/**
 * Record a scout's performance after execution completes.
 * Called for every scout — successful, failed, or killed.
 */
export async function recordScoutPerformance(
  userId: string,
  sessionId: string,
  agentMode: AgentMode,
  blueprint: AgentBlueprint,
  findings: Finding[],
  metrics: {
    executionTimeMs: number;
    tokensUsed: number;
    costIncurred: number;
    searchesExecuted: number;
    pagesVisited: number;
    screenshotsTaken: number;
    toolCallsTotal: number;
    toolCallsSucceeded: number;
    toolCallsFailed: number;
  },
  status: 'complete' | 'failed' | 'killed',
  errorMessage?: string,
  spawnedChildren?: number,
  gaps?: string[],
  problemComplexity?: string
): Promise<void> {
  const supabase = getServiceClient();

  const highConf = findings.filter((f) => f.confidence === 'high').length;
  const medConf = findings.filter((f) => f.confidence === 'medium').length;
  const lowConf = findings.filter((f) => f.confidence === 'low').length;
  const avgRelevance =
    findings.length > 0
      ? findings.reduce((sum, f) => sum + f.relevanceScore, 0) / findings.length
      : 0;

  const record: Record<string, unknown> = {
    user_id: userId,
    session_id: sessionId,
    agent_mode: agentMode,
    scout_id: blueprint.id,
    scout_name: blueprint.name,
    scout_role: blueprint.role,
    expertise: blueprint.expertise,
    model_tier: blueprint.modelTier,
    tools_assigned: blueprint.tools || ['brave_search'],
    research_approach: blueprint.researchApproach,
    search_queries: blueprint.searchQueries,
    browser_targets: blueprint.browserTargets || [],
    findings_count: findings.length,
    high_confidence_count: highConf,
    medium_confidence_count: medConf,
    low_confidence_count: lowConf,
    avg_relevance_score: parseFloat(avgRelevance.toFixed(3)),
    execution_time_ms: metrics.executionTimeMs,
    tokens_used: metrics.tokensUsed,
    cost_incurred: parseFloat(metrics.costIncurred.toFixed(4)),
    searches_executed: metrics.searchesExecuted,
    pages_visited: metrics.pagesVisited,
    screenshots_taken: metrics.screenshotsTaken,
    tool_calls_total: metrics.toolCallsTotal,
    tool_calls_succeeded: metrics.toolCallsSucceeded,
    tool_calls_failed: metrics.toolCallsFailed,
    status,
    error_message: errorMessage,
    spawned_children: spawnedChildren || 0,
    gaps_identified: gaps || [],
    domain: blueprint.expertise[0] || undefined,
    problem_complexity: problemComplexity,
  };

  const { error } = await supabase.from('scout_performance').insert(record);

  if (error) {
    log.error('Failed to record scout performance', {
      error: error.message,
      scoutId: blueprint.id,
    });
  } else {
    log.debug('Recorded scout performance', {
      scoutId: blueprint.id,
      status,
      findings: findings.length,
    });
  }
}

// =============================================================================
// QUERY PERFORMANCE DATA
// =============================================================================

/**
 * Get performance insights for a user — which tool combos work best,
 * which approaches yield the highest confidence findings, etc.
 *
 * The Master Architect uses this to design better agent armies.
 */
export async function getPerformanceInsights(
  userId: string,
  agentMode?: AgentMode,
  domain?: string,
  limit: number = 200
): Promise<PerformanceInsight[]> {
  const supabase = getServiceClient();

  let q = supabase
    .from('scout_performance')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'complete')
    .gt('findings_count', 0)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (agentMode) {
    q = q.eq('agent_mode', agentMode);
  }

  if (domain) {
    q = q.eq('domain', domain);
  }

  const { data, error } = await q;

  if (error || !data || data.length === 0) {
    if (error) {
      log.error('Failed to query performance data', { error: error.message });
    }
    return [];
  }

  // Aggregate by tool combination
  const combos = new Map<
    string,
    {
      tools: string[];
      findingsCounts: number[];
      confidenceScores: number[];
      relevanceScores: number[];
      executionTimes: number[];
      successes: number;
      total: number;
    }
  >();

  for (const row of data) {
    const tools = (row.tools_assigned as string[]) || ['brave_search'];
    const key = [...tools].sort().join('+');

    if (!combos.has(key)) {
      combos.set(key, {
        tools,
        findingsCounts: [],
        confidenceScores: [],
        relevanceScores: [],
        executionTimes: [],
        successes: 0,
        total: 0,
      });
    }

    const combo = combos.get(key)!;
    combo.findingsCounts.push(row.findings_count as number);
    combo.relevanceScores.push(row.avg_relevance_score as number);
    combo.executionTimes.push(row.execution_time_ms as number);
    combo.total++;

    // Calculate a confidence score (weighted)
    const confScore =
      ((row.high_confidence_count as number) * 1.0 +
        (row.medium_confidence_count as number) * 0.5 +
        (row.low_confidence_count as number) * 0.2) /
      Math.max(row.findings_count as number, 1);
    combo.confidenceScores.push(confScore);

    if ((row.findings_count as number) > 0) {
      combo.successes++;
    }
  }

  // Convert to insights
  const insights: PerformanceInsight[] = [];
  for (const [, combo] of combos) {
    if (combo.total < 2) continue; // Need at least 2 samples

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    insights.push({
      toolCombo: combo.tools,
      avgFindingsCount: parseFloat(avg(combo.findingsCounts).toFixed(1)),
      avgConfidenceScore: parseFloat(avg(combo.confidenceScores).toFixed(2)),
      avgRelevanceScore: parseFloat(avg(combo.relevanceScores).toFixed(2)),
      successRate: parseFloat((combo.successes / combo.total).toFixed(2)),
      avgExecutionTimeMs: Math.round(avg(combo.executionTimes)),
      sampleSize: combo.total,
    });
  }

  // Sort by combined effectiveness (confidence * relevance * success rate)
  insights.sort((a, b) => {
    const scoreA = a.avgConfidenceScore * a.avgRelevanceScore * a.successRate;
    const scoreB = b.avgConfidenceScore * b.avgRelevanceScore * b.successRate;
    return scoreB - scoreA;
  });

  return insights;
}

/**
 * Build a performance context string for the Master Architect prompt.
 * Tells the architect what tool combinations have worked well in the past.
 */
export function buildPerformancePromptContext(insights: PerformanceInsight[]): string {
  if (insights.length === 0) {
    return '';
  }

  const lines: string[] = [
    '\n\nPAST PERFORMANCE DATA (from previous sessions):',
    'Use this data to make smarter tool assignments. Higher scores = better results.',
    '',
  ];

  const topInsights = insights.slice(0, 10);

  for (const insight of topInsights) {
    const effectiveness = (
      insight.avgConfidenceScore *
      insight.avgRelevanceScore *
      insight.successRate
    ).toFixed(2);
    lines.push(
      `- Tools: [${insight.toolCombo.join(', ')}] → ` +
        `Effectiveness: ${effectiveness} | ` +
        `Avg findings: ${insight.avgFindingsCount} | ` +
        `Confidence: ${insight.avgConfidenceScore} | ` +
        `Success rate: ${(insight.successRate * 100).toFixed(0)}% | ` +
        `Samples: ${insight.sampleSize}`
    );
  }

  lines.push(
    '',
    'Favor tool combinations with higher effectiveness scores.',
    'Avoid combinations that consistently underperform.'
  );

  return lines.join('\n');
}
