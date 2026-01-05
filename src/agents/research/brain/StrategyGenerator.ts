/**
 * STRATEGY GENERATOR
 *
 * The second stage of the Research Brain.
 * Creates a dynamic, adaptive research strategy based on intent.
 *
 * Unlike Manus which uses fixed pipelines, this generates
 * a custom strategy for EVERY query.
 */

import { GoogleGenAI } from '@google/genai';
import {
  ResearchIntent,
  ResearchStrategy,
  ResearchPhase,
  GeneratedQuery,
} from '../../core/types';

const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY_1 || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export class StrategyGenerator {
  private model = 'gemini-3-pro-preview';

  /**
   * Generate a dynamic research strategy based on intent
   */
  async generate(intent: ResearchIntent): Promise<ResearchStrategy> {
    const prompt = `You are an expert research strategist. Based on a user's research intent, create an optimal multi-phase research strategy.

RESEARCH INTENT:
- Original Query: "${intent.originalQuery}"
- Refined Query: "${intent.refinedQuery}"
- Topics to Cover: ${intent.topics.join(', ')}
- Required Depth: ${intent.requiredDepth}
- Expected Outputs: ${intent.expectedOutputs.join(', ')}
- Context Clues: ${JSON.stringify(intent.contextClues)}

Create a research strategy as a JSON object:
{
  "phases": [
    {
      "name": "Phase name",
      "type": "broad_scan" | "deep_dive" | "gap_fill" | "validation",
      "queries": [
        {
          "query": "Exact search query to use",
          "purpose": "Why this query helps",
          "expectedInfo": ["what we expect to find"],
          "source": "google" | "perplexity",
          "priority": 1-10
        }
      ],
      "sources": ["google", "perplexity"],
      "isConditional": false | true,
      "dependsOn": null | "phase_id"
    }
  ],
  "maxIterations": 3,
  "stopConditions": [
    { "type": "coverage_threshold", "threshold": 0.85 },
    { "type": "max_iterations" },
    { "type": "no_new_info" }
  ]
}

STRATEGY RULES:
1. Phase 1 should ALWAYS be a "broad_scan" to get initial coverage
2. Use "google" for current facts, news, recent data
3. Use "perplexity" for deep analysis, comparisons, synthesized insights
4. Create 2-4 phases depending on requiredDepth:
   - quick: 1-2 phases, 2-4 queries total
   - standard: 2-3 phases, 4-8 queries total
   - deep: 3-4 phases, 6-12 queries total
5. Later phases should be conditional (isConditional: true) - only run if gaps found
6. Queries should be specific and actionable, not vague
7. Each query should have a clear purpose
8. Prioritize queries (10 = most important)
9. Don't duplicate information across queries

QUERY OPTIMIZATION:
- Include location if relevant: "${intent.contextClues.location || 'not specified'}"
- Include year for recent data: "2024" or "2025"
- Include industry context: "${intent.contextClues.industry || 'not specified'}"
- Be specific: "tutoring business pricing models" not "business pricing"

OUTPUT ONLY THE JSON OBJECT, NO OTHER TEXT.`;

    try {
      const response = await gemini.models.generateContent({
        model: this.model,
        contents: prompt,
      });

      const text = response.text?.trim() || '';

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Build the strategy with IDs
      const strategy: ResearchStrategy = {
        id: `strategy_${Date.now()}`,
        phases: this.buildPhases(parsed.phases || []),
        maxIterations: parsed.maxIterations || 3,
        stopConditions: parsed.stopConditions || [
          { type: 'coverage_threshold', threshold: 0.85 },
          { type: 'max_iterations' },
        ],
        createdAt: Date.now(),
      };

      // Validate strategy
      if (strategy.phases.length === 0) {
        throw new Error('No phases generated');
      }

      return strategy;
    } catch (error) {
      console.error('[StrategyGenerator] Error generating strategy:', error);
      return this.createFallbackStrategy(intent);
    }
  }

  /**
   * Build phases with proper IDs and query structure
   */
  private buildPhases(rawPhases: unknown[]): ResearchPhase[] {
    return rawPhases.map((phase: unknown, index: number) => {
      const p = phase as Record<string, unknown>;
      return {
        id: `phase_${index + 1}`,
        name: String(p.name || `Phase ${index + 1}`),
        type: this.validatePhaseType(p.type),
        queries: this.buildQueries(p.queries as unknown[] || [], p.sources as string[] || ['google']),
        sources: (p.sources as ('google' | 'perplexity')[]) || ['google'],
        isConditional: Boolean(p.isConditional),
        dependsOn: p.dependsOn ? String(p.dependsOn) : undefined,
      };
    });
  }

  /**
   * Build queries with proper IDs
   */
  private buildQueries(rawQueries: unknown[], defaultSources: string[]): GeneratedQuery[] {
    return rawQueries.map((query: unknown, index: number) => {
      const q = query as Record<string, unknown>;
      return {
        id: `query_${Date.now()}_${index}`,
        query: String(q.query || ''),
        purpose: String(q.purpose || 'General research'),
        expectedInfo: (q.expectedInfo as string[]) || [],
        source: this.validateSource(q.source) || (defaultSources[0] as 'google' | 'perplexity') || 'google',
        priority: Number(q.priority) || 5,
      };
    }).filter(q => q.query.length > 0);
  }

  /**
   * Validate phase type
   */
  private validatePhaseType(type: unknown): ResearchPhase['type'] {
    const validTypes = ['broad_scan', 'deep_dive', 'gap_fill', 'validation'];
    return validTypes.includes(String(type))
      ? (type as ResearchPhase['type'])
      : 'broad_scan';
  }

  /**
   * Validate source
   */
  private validateSource(source: unknown): 'google' | 'perplexity' | null {
    if (source === 'google' || source === 'perplexity') {
      return source;
    }
    return null;
  }

  /**
   * Create a fallback strategy if generation fails
   */
  private createFallbackStrategy(intent: ResearchIntent): ResearchStrategy {
    const queries: GeneratedQuery[] = intent.topics.slice(0, 3).map((topic, i) => ({
      id: `query_fallback_${i}`,
      query: `${topic} ${intent.contextClues.industry || ''} ${intent.contextClues.location || ''} 2024`.trim(),
      purpose: `Research ${topic}`,
      expectedInfo: [`Information about ${topic}`],
      source: i % 2 === 0 ? 'google' as const : 'perplexity' as const,
      priority: 10 - i,
    }));

    return {
      id: `strategy_fallback_${Date.now()}`,
      phases: [
        {
          id: 'phase_1',
          name: 'Initial Research',
          type: 'broad_scan',
          queries,
          sources: ['google', 'perplexity'],
          isConditional: false,
        },
      ],
      maxIterations: 2,
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

    const prompt = `You are a research strategist. We conducted research but found gaps. Generate specific queries to fill these gaps.

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
    "source": "google" | "perplexity",
    "priority": 1-10
  }
]

Be specific. Target the exact gaps. Don't repeat previous queries.
OUTPUT ONLY THE JSON ARRAY.`;

    try {
      const response = await gemini.models.generateContent({
        model: this.model,
        contents: prompt,
      });

      const text = response.text?.trim() || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]) as unknown[];
      return this.buildQueries(parsed, ['google']);
    } catch (error) {
      console.error('[StrategyGenerator] Error generating gap queries:', error);
      return [];
    }
  }
}

export const strategyGenerator = new StrategyGenerator();
