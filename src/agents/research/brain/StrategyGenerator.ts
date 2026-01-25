/**
 * STRATEGY GENERATOR
 *
 * The second stage of the Research Brain.
 * Creates a dynamic, adaptive research strategy based on intent.
 *
 * Uses Brave Search for powerful, cost-effective research.
 * Dynamically generates 1-20 queries based on complexity.
 *
 * POWERED BY: Claude Sonnet 4.5 with xAI fallback
 */

import { completeChat } from '@/lib/ai/chat-router';
import { ResearchIntent, ResearchStrategy, GeneratedQuery } from '../../core/types';
import { logger } from '@/lib/logger';
import type { CoreMessage } from 'ai';

const log = logger('StrategyGenerator');

export class StrategyGenerator {
  /**
   * Generate a dynamic research strategy based on intent
   * Now supports up to 20 queries for comprehensive research
   */
  async generate(intent: ResearchIntent): Promise<ResearchStrategy> {
    const prompt = `You are an expert research strategist. Based on a user's research intent, create an optimal research strategy using Brave web search.

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
      "priority": 1-10,
      "queryType": "general" | "news" | "local" | "comparison" | "data"
    }
  ],
  "maxIterations": 1
}

STRATEGY RULES:
1. Generate between 1-20 queries based on complexity:
   - Simple questions: 1-3 queries
   - Standard research: 4-8 queries
   - Complex analysis: 8-15 queries
   - Deep dive research: 15-20 queries (comprehensive coverage)
2. Required depth mapping:
   - quick: 1-5 queries, focus on direct answers
   - standard: 5-12 queries, cover multiple angles
   - deep: 12-20 queries, exhaustive comprehensive coverage
3. Each query should target a DIFFERENT aspect of the topic
4. Queries should be specific and actionable, not vague
5. Prioritize queries (10 = most critical, 1 = nice to have)
6. Don't duplicate information across queries
7. Use queryType to optimize each search:
   - "news" for current events, announcements, recent updates
   - "local" for location-specific information
   - "comparison" for versus/alternatives/competitors
   - "data" for statistics, numbers, pricing
   - "general" for everything else

QUERY OPTIMIZATION (Brave Search excels at):
- Include location if relevant: "${intent.contextClues.location || 'not specified'}"
- Include year for recent data: "2024" or "2025"
- Include industry context: "${intent.contextClues.industry || 'not specified'}"
- Be specific: "tutoring business pricing models Boston 2025" not "business pricing"
- Rich data queries: weather, stock prices, sports scores, crypto prices
- Comparisons and alternatives
- Lists and rankings
- Statistics and market data
- Competitive intelligence
- Recent news and announcements

OUTPUT ONLY THE JSON OBJECT, NO OTHER TEXT.`;

    try {
      const messages: CoreMessage[] = [{ role: 'user', content: prompt }];

      // Use multi-provider chat with fallback
      const result = await completeChat(messages, {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 4096,
        temperature: 0.3,
        systemPrompt: 'You are an expert research strategist. Respond with valid JSON only.',
      });

      log.info('Strategy generation complete', {
        provider: result.providerId,
        usedFallback: result.usedFallback,
      });

      // Parse the JSON response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        queries: unknown[];
        maxIterations?: number;
      };

      // Build the strategy - single phase with all queries
      const queries = this.buildQueries(parsed.queries || []);

      const strategy: ResearchStrategy = {
        id: `strategy_${Date.now()}`,
        phases: [
          {
            id: 'phase_1',
            name: 'Brave Web Research',
            type: 'broad_scan',
            queries,
            sources: ['brave'],
            isConditional: false,
          },
        ],
        maxIterations: 1, // Single iteration - Brave handles comprehensive search
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

      log.info('Strategy created', { queryCount: queries.length });
      return strategy;
    } catch (error) {
      log.error('Error generating strategy', error as Error);
      return this.createFallbackStrategy(intent);
    }
  }

  /**
   * Build queries - all use Brave Search
   */
  private buildQueries(rawQueries: unknown[]): GeneratedQuery[] {
    return rawQueries
      .map((query: unknown, index: number) => {
        const q = query as Record<string, unknown>;
        return {
          id: `query_${Date.now()}_${index}`,
          query: String(q.query || ''),
          purpose: String(q.purpose || 'General research'),
          expectedInfo: (q.expectedInfo as string[]) || [],
          source: 'brave' as const, // Use Brave Search
          priority: Number(q.priority) || 5,
          queryType: String(q.queryType || 'general'),
        };
      })
      .filter((q) => q.query.length > 0);
  }

  /**
   * Create a fallback strategy if generation fails
   * Uses up to 8 queries for better coverage
   */
  private createFallbackStrategy(intent: ResearchIntent): ResearchStrategy {
    const queries: GeneratedQuery[] = intent.topics.slice(0, 8).map((topic, i) => ({
      id: `query_fallback_${i}`,
      query:
        `${topic} ${intent.contextClues.industry || ''} ${intent.contextClues.location || ''} 2025`.trim(),
      purpose: `Research ${topic}`,
      expectedInfo: [`Information about ${topic}`],
      source: 'brave' as const,
      priority: 10 - i,
      queryType: 'general',
    }));

    return {
      id: `strategy_fallback_${Date.now()}`,
      phases: [
        {
          id: 'phase_1',
          name: 'Brave Web Research',
          type: 'broad_scan',
          queries,
          sources: ['brave'],
          isConditional: false,
        },
      ],
      maxIterations: 1,
      stopConditions: [{ type: 'coverage_threshold', threshold: 0.7 }, { type: 'max_iterations' }],
      createdAt: Date.now(),
    };
  }

  /**
   * Generate additional queries based on gaps found
   * Can generate up to 5 queries to fill gaps
   */
  async generateGapFillingQueries(
    gaps: string[],
    intent: ResearchIntent,
    previousQueries: string[]
  ): Promise<GeneratedQuery[]> {
    if (gaps.length === 0) return [];

    const prompt = `You are a research strategist. We conducted research but found gaps. Generate specific Brave search queries to fill these gaps.

ORIGINAL INTENT: "${intent.refinedQuery}"
TOPICS: ${intent.topics.join(', ')}
CONTEXT: ${JSON.stringify(intent.contextClues)}

GAPS FOUND:
${gaps.map((g, i) => `${i + 1}. ${g}`).join('\n')}

QUERIES ALREADY TRIED (don't repeat):
${previousQueries.join('\n')}

Generate 1-5 NEW queries to fill these gaps. Output as JSON array:
[
  {
    "query": "specific search query",
    "purpose": "what gap this fills",
    "expectedInfo": ["what we expect to find"],
    "priority": 1-10,
    "queryType": "general" | "news" | "local" | "comparison" | "data"
  }
]

Be specific. Target the exact gaps. Don't repeat previous queries.
OUTPUT ONLY THE JSON ARRAY.`;

    try {
      const messages: CoreMessage[] = [{ role: 'user', content: prompt }];

      const result = await completeChat(messages, {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 2048,
        temperature: 0.3,
        systemPrompt: 'You are a research strategist. Respond with valid JSON array only.',
      });

      log.info('Gap-filling queries generated', {
        provider: result.providerId,
        usedFallback: result.usedFallback,
      });

      // Parse JSON array from response
      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as unknown[];
      return this.buildQueries(parsed);
    } catch (error) {
      log.error('Error generating gap queries', error as Error);
      return [];
    }
  }
}

export const strategyGenerator = new StrategyGenerator();
