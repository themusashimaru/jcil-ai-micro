/**
 * RESULT EVALUATOR
 *
 * The third stage of the Research Brain.
 * Evaluates search results and decides: continue, pivot, or synthesize?
 *
 * Capabilities:
 * - Self-evaluating result quality
 * - Gap detection in research coverage
 * - Dynamic adaptation based on findings
 *
 * Powered by Claude Sonnet 4.5.
 */

import { createClaudeStructuredOutput } from '@/lib/anthropic/client';
import {
  ResearchIntent,
  SearchResult,
  EvaluatedResults,
  GeneratedQuery,
} from '../../core/types';
import { logger } from '@/lib/logger';

const log = logger('ResultEvaluator');

export class ResultEvaluator {

  /**
   * Evaluate search results against the original intent
   */
  async evaluate(
    results: SearchResult[],
    intent: ResearchIntent,
    iteration: number,
    maxIterations: number
  ): Promise<EvaluatedResults> {
    // Combine all result content for analysis
    const combinedContent = results
      .map(r => `[Source: ${r.source}] ${r.title || 'Untitled'}\n${r.content}`)
      .join('\n\n---\n\n');

    const prompt = `You are a research quality analyst. Evaluate whether the search results adequately address the user's research needs.

ORIGINAL RESEARCH INTENT:
- Query: "${intent.refinedQuery}"
- Topics to Cover: ${intent.topics.join(', ')}
- Expected Outputs: ${intent.expectedOutputs.join(', ')}
- Required Depth: ${intent.requiredDepth}

SEARCH RESULTS COLLECTED (${results.length} results):
${combinedContent.substring(0, 15000)}

CURRENT STATUS:
- Iteration: ${iteration} of ${maxIterations}
- Can do ${maxIterations - iteration} more iterations

Analyze the results and output a JSON object:
{
  "coverage": {
    "score": 0.0-1.0,
    "topicsCovered": ["topics that have good coverage"],
    "topicsMissing": ["topics with no or weak coverage"]
  },
  "quality": {
    "score": 0.0-1.0,
    "conflicts": ["any contradicting information found"],
    "gaps": ["specific information that's missing"]
  },
  "recommendation": {
    "action": "continue" | "pivot" | "synthesize",
    "reason": "explanation of decision",
    "suggestedQueries": [
      {
        "query": "specific query to fill gap",
        "purpose": "what this addresses",
        "source": "google" | "perplexity"
      }
    ]
  }
}

DECISION RULES:
1. If coverage.score >= 0.85 AND quality.score >= 0.75 → "synthesize"
2. If iteration >= maxIterations → "synthesize" (forced)
3. If gaps exist but queries would help → "continue" with suggestedQueries
4. If results are off-topic or wrong direction → "pivot" with new approach
5. Be aggressive about finding gaps - users need comprehensive info

QUALITY SCORING:
- 1.0: Perfect - all topics covered in depth
- 0.8: Good - most topics covered, minor gaps
- 0.6: Adequate - main topics covered, significant gaps
- 0.4: Poor - major gaps, incomplete coverage
- 0.2: Very Poor - most topics missing

OUTPUT ONLY THE JSON OBJECT.`;

    try {
      const schema = {
        type: 'object',
        properties: {
          coverage: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              topicsCovered: { type: 'array', items: { type: 'string' } },
              topicsMissing: { type: 'array', items: { type: 'string' } },
            },
          },
          quality: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              conflicts: { type: 'array', items: { type: 'string' } },
              gaps: { type: 'array', items: { type: 'string' } },
            },
          },
          recommendation: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['continue', 'pivot', 'synthesize'] },
              reason: { type: 'string' },
              suggestedQueries: { type: 'array' },
            },
          },
        },
        required: ['coverage', 'quality', 'recommendation'],
      };

      interface EvalResponse {
        coverage?: { score?: number; topicsCovered?: string[]; topicsMissing?: string[] };
        quality?: { score?: number; conflicts?: string[]; gaps?: string[] };
        recommendation?: { action?: string; reason?: string; suggestedQueries?: unknown[] };
      }

      const { data: parsed } = await createClaudeStructuredOutput<EvalResponse>({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are a research quality analyst. Respond with valid JSON only.',
        schema,
      });

      log.info(`Using Claude Sonnet for result evaluation`);

      // Build evaluated results with proper typing
      const evaluated: EvaluatedResults = {
        results,
        coverage: {
          score: Number(parsed.coverage?.score) || 0.5,
          topicsCovered: parsed.coverage?.topicsCovered || [],
          topicsMissing: parsed.coverage?.topicsMissing || [],
        },
        quality: {
          score: Number(parsed.quality?.score) || 0.5,
          conflicts: parsed.quality?.conflicts || [],
          gaps: parsed.quality?.gaps || [],
        },
        recommendation: {
          action: this.validateAction(parsed.recommendation?.action),
          reason: parsed.recommendation?.reason || 'Evaluation complete',
          suggestedQueries: this.buildSuggestedQueries(parsed.recommendation?.suggestedQueries),
        },
      };

      // Force synthesize if at max iterations
      if (iteration >= maxIterations && evaluated.recommendation.action !== 'synthesize') {
        evaluated.recommendation.action = 'synthesize';
        evaluated.recommendation.reason = 'Maximum iterations reached - synthesizing available results';
      }

      return evaluated;
    } catch (error) {
      log.error('Error evaluating results (Claude Sonnet)', error as Error);
      return this.createFallbackEvaluation(results, iteration >= maxIterations);
    }
  }

  /**
   * Quick check if results seem sufficient (for early termination)
   */
  async quickCheck(results: SearchResult[], intent: ResearchIntent): Promise<{
    sufficient: boolean;
    confidence: number;
  }> {
    // Simple heuristic check before full evaluation
    const totalContent = results.reduce((acc, r) => acc + r.content.length, 0);
    const uniqueSources = new Set(results.map(r => r.source)).size;
    const topicsInContent = intent.topics.filter(topic =>
      results.some(r => r.content.toLowerCase().includes(topic.toLowerCase()))
    ).length;

    const topicCoverage = topicsInContent / intent.topics.length;
    const hasMultipleSources = uniqueSources >= 2;
    const hasSubstantialContent = totalContent > 2000;

    const sufficient = topicCoverage >= 0.7 && hasSubstantialContent;
    const confidence = (topicCoverage * 0.5) + (hasMultipleSources ? 0.25 : 0) + (hasSubstantialContent ? 0.25 : 0);

    return { sufficient, confidence };
  }

  /**
   * Validate action type
   */
  private validateAction(action: unknown): 'continue' | 'pivot' | 'synthesize' {
    const validActions = ['continue', 'pivot', 'synthesize'];
    return validActions.includes(String(action))
      ? (action as 'continue' | 'pivot' | 'synthesize')
      : 'synthesize';
  }

  /**
   * Build suggested queries with proper typing
   */
  private buildSuggestedQueries(queries: unknown[] | undefined): GeneratedQuery[] {
    if (!queries || !Array.isArray(queries)) return [];

    return queries.map((q: unknown, i: number) => {
      const query = q as Record<string, unknown>;
      return {
        id: `suggested_${Date.now()}_${i}`,
        query: String(query.query || ''),
        purpose: String(query.purpose || 'Fill gap'),
        expectedInfo: [],
        source: (query.source === 'perplexity' ? 'perplexity' : 'google') as 'google' | 'perplexity',
        priority: 8,
      };
    }).filter(q => q.query.length > 0);
  }

  /**
   * Create fallback evaluation if analysis fails
   */
  private createFallbackEvaluation(results: SearchResult[], forceComplete: boolean): EvaluatedResults {
    return {
      results,
      coverage: {
        score: 0.6,
        topicsCovered: [],
        topicsMissing: [],
      },
      quality: {
        score: 0.6,
        conflicts: [],
        gaps: ['Unable to fully evaluate results'],
      },
      recommendation: {
        action: forceComplete ? 'synthesize' : 'synthesize', // Default to synthesize on error
        reason: forceComplete
          ? 'Maximum iterations reached'
          : 'Proceeding with available results',
        suggestedQueries: [],
      },
    };
  }

  /**
   * Calculate confidence score for final output
   */
  calculateConfidenceScore(evaluations: EvaluatedResults[]): number {
    if (evaluations.length === 0) return 0;

    const avgCoverage = evaluations.reduce((acc, e) => acc + e.coverage.score, 0) / evaluations.length;
    const avgQuality = evaluations.reduce((acc, e) => acc + e.quality.score, 0) / evaluations.length;
    const hasMultipleIterations = evaluations.length > 1 ? 0.1 : 0;

    return Math.min(1, (avgCoverage * 0.5) + (avgQuality * 0.4) + hasMultipleIterations);
  }
}

export const resultEvaluator = new ResultEvaluator();
