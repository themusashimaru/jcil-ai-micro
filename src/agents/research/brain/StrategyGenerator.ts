/**
 * STRATEGY GENERATOR
 *
 * The second stage of the Research Brain.
 * Creates a dynamic, adaptive research strategy based on intent.
 *
 * Uses Perplexity exclusively for faster, more reliable results.
 * Dynamically generates 1-10 queries based on complexity.
 *
 * POWERED BY: Claude Sonnet 4.5 (migrated from Gemini)
 */

import { createClaudeStructuredOutput } from '@/lib/anthropic/client';
import {
  ResearchIntent,
  ResearchStrategy,
  GeneratedQuery,
} from '../../core/types';

export class StrategyGenerator {

  /**
   * Generate a dynamic research strategy based on intent
   */
  async generate(intent: ResearchIntent): Promise<ResearchStrategy> {
    const prompt = `You are an expert research strategist. Based on a user's research intent, create an optimal research strategy using Perplexity AI search.

RESEARCH INTENT:
- Original Query: "${intent.originalQuery}"
- Refined Query: "${intent.refinedQuery}"
- Topics to Cover: ${intent.topics.join(', ')}
- Required Depth: ${intent.requiredDepth}
- Expected Outputs: ${intent.expectedOutputs.join(', ')}
- Context Clues: ${JSON.stringify(intent.contextClues)}

Create a research strategy as a JSON object:
{
  "queries": [
    {
      "query": "Exact search query to use",
      "purpose": "Why this query helps",
      "expectedInfo": ["what we expect to find"],
      "priority": 1-10
    }
  ],
  "maxIterations": 1
}

STRATEGY RULES:
1. Generate between 1-10 queries based on complexity:
   - Simple questions: 1-3 queries
   - Standard research: 3-5 queries
   - Complex analysis: 5-8 queries
   - Deep dive research: 8-10 queries
2. Required depth mapping:
   - quick: 1-3 queries, focus on direct answers
   - standard: 3-6 queries, cover multiple angles
   - deep: 6-10 queries, comprehensive coverage
3. Each query should target a DIFFERENT aspect of the topic
4. Queries should be specific and actionable, not vague
5. Prioritize queries (10 = most critical, 1 = nice to have)
6. Don't duplicate information across queries

QUERY OPTIMIZATION:
- Include location if relevant: "${intent.contextClues.location || 'not specified'}"
- Include year for recent data: "2024" or "2025"
- Include industry context: "${intent.contextClues.industry || 'not specified'}"
- Be specific: "tutoring business pricing models Boston" not "business pricing"
- Perplexity excels at: comparisons, lists, analysis, summaries, competitive intelligence

OUTPUT ONLY THE JSON OBJECT, NO OTHER TEXT.`;

    try {
      const schema = {
        type: 'object',
        properties: {
          queries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                purpose: { type: 'string' },
                expectedInfo: { type: 'array', items: { type: 'string' } },
                priority: { type: 'number' },
              },
            },
          },
          maxIterations: { type: 'number' },
        },
        required: ['queries'],
      };

      const { data: parsed } = await createClaudeStructuredOutput<{ queries: unknown[]; maxIterations?: number }>({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are an expert research strategist. Respond with valid JSON only.',
        schema,
      });

      console.log(`[StrategyGenerator] Using Claude Sonnet for strategy generation`);

      // Build the strategy - single phase with all queries
      const queries = this.buildQueries(parsed.queries || []);

      const strategy: ResearchStrategy = {
        id: `strategy_${Date.now()}`,
        phases: [{
          id: 'phase_1',
          name: 'Perplexity Research',
          type: 'broad_scan',
          queries,
          sources: ['perplexity'],
          isConditional: false,
        }],
        maxIterations: 1, // Single iteration with Perplexity
        stopConditions: [
          { type: 'coverage_threshold', threshold: 0.85 },
          { type: 'max_iterations' },
        ],
        createdAt: Date.now(),
      };

      // Validate strategy
      if (queries.length === 0) {
        throw new Error('No queries generated');
      }

      return strategy;
    } catch (error) {
      console.error('[StrategyGenerator] Error generating strategy:', error);
      return this.createFallbackStrategy(intent);
    }
  }

  /**
   * Build queries - all use Perplexity
   */
  private buildQueries(rawQueries: unknown[]): GeneratedQuery[] {
    return rawQueries.map((query: unknown, index: number) => {
      const q = query as Record<string, unknown>;
      return {
        id: `query_${Date.now()}_${index}`,
        query: String(q.query || ''),
        purpose: String(q.purpose || 'General research'),
        expectedInfo: (q.expectedInfo as string[]) || [],
        source: 'perplexity' as const, // Always Perplexity
        priority: Number(q.priority) || 5,
      };
    }).filter(q => q.query.length > 0);
  }

  /**
   * Create a fallback strategy if generation fails
   */
  private createFallbackStrategy(intent: ResearchIntent): ResearchStrategy {
    const queries: GeneratedQuery[] = intent.topics.slice(0, 5).map((topic, i) => ({
      id: `query_fallback_${i}`,
      query: `${topic} ${intent.contextClues.industry || ''} ${intent.contextClues.location || ''} 2024`.trim(),
      purpose: `Research ${topic}`,
      expectedInfo: [`Information about ${topic}`],
      source: 'perplexity' as const,
      priority: 10 - i,
    }));

    return {
      id: `strategy_fallback_${Date.now()}`,
      phases: [
        {
          id: 'phase_1',
          name: 'Perplexity Research',
          type: 'broad_scan',
          queries,
          sources: ['perplexity'],
          isConditional: false,
        },
      ],
      maxIterations: 1,
      stopConditions: [
        { type: 'coverage_threshold', threshold: 0.7 },
        { type: 'max_iterations' },
      ],
      createdAt: Date.now(),
    };
  }

  /**
   * Generate additional queries based on gaps found
   */
  async generateGapFillingQueries(
    gaps: string[],
    intent: ResearchIntent,
    previousQueries: string[]
  ): Promise<GeneratedQuery[]> {
    if (gaps.length === 0) return [];

    const prompt = `You are a research strategist. We conducted research but found gaps. Generate specific Perplexity queries to fill these gaps.

ORIGINAL INTENT: "${intent.refinedQuery}"
TOPICS: ${intent.topics.join(', ')}
CONTEXT: ${JSON.stringify(intent.contextClues)}

GAPS FOUND:
${gaps.map((g, i) => `${i + 1}. ${g}`).join('\n')}

QUERIES ALREADY TRIED (don't repeat):
${previousQueries.join('\n')}

Generate 1-3 NEW queries to fill these gaps. Output as JSON array:
[
  {
    "query": "specific search query",
    "purpose": "what gap this fills",
    "expectedInfo": ["what we expect to find"],
    "priority": 1-10
  }
]

Be specific. Target the exact gaps. Don't repeat previous queries.
OUTPUT ONLY THE JSON ARRAY.`;

    try {
      const schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            purpose: { type: 'string' },
            expectedInfo: { type: 'array', items: { type: 'string' } },
            priority: { type: 'number' },
          },
        },
      };

      const { data: parsed } = await createClaudeStructuredOutput<unknown[]>({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are a research strategist. Respond with valid JSON array only.',
        schema,
      });

      console.log(`[StrategyGenerator] Using Claude Sonnet for gap-filling queries`);
      return this.buildQueries(parsed);
    } catch (error) {
      console.error('[StrategyGenerator] Error generating gap queries (Claude Sonnet):', error);
      return [];
    }
  }
}

export const strategyGenerator = new StrategyGenerator();
