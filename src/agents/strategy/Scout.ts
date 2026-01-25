/**
 * SCOUT FRAMEWORK - Research Execution
 *
 * Scouts are the workers that execute research using Haiku 4.5 and Brave Search.
 * They are highly specialized and focused on specific tasks.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentBlueprint,
  ScoutState,
  Finding,
  FindingType,
  SourceCitation,
  DataPoint,
  StrategyStreamCallback,
} from './types';
import { CLAUDE_HAIKU_45, SCOUT_PROMPT, MODEL_CONFIGS } from './constants';
import { braveWebSearch, type BraveSearchResponse, type BraveWebResult } from '@/lib/brave';
import { logger } from '@/lib/logger';

const log = logger('Scout');

// =============================================================================
// SCOUT RESULT
// =============================================================================

interface ScoutResult {
  agentId: string;
  findings: Finding[];
  summary: string;
  needsDeeper: boolean;
  childSuggestions: Partial<AgentBlueprint>[];
  gaps: string[];
  searchesExecuted: number;
  tokensUsed: number;
  executionTime: number;
}

// =============================================================================
// SCOUT CLASS
// =============================================================================

export class Scout {
  private client: Anthropic;
  private blueprint: AgentBlueprint;
  private state: ScoutState;
  private onStream?: StrategyStreamCallback;
  private model: string;
  private costPerQuery = 0.005; // Brave Search cost

  constructor(client: Anthropic, blueprint: AgentBlueprint, onStream?: StrategyStreamCallback) {
    this.client = client;
    this.blueprint = blueprint;
    this.onStream = onStream;

    // Select model based on tier
    this.model = MODEL_CONFIGS[blueprint.modelTier]?.id || CLAUDE_HAIKU_45;

    this.state = {
      id: blueprint.id,
      blueprintId: blueprint.id,
      name: blueprint.name,
      status: 'pending',
      progress: 0,
      searchesCompleted: 0,
      searchesTotal: blueprint.searchQueries.length,
      findings: [],
      errors: [],
      startTime: Date.now(),
      tokensUsed: 0,
      costIncurred: 0,
    };
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Execute the scout's research mission
   */
  async execute(): Promise<ScoutResult> {
    const startTime = Date.now();
    this.state.status = 'researching';
    this.state.startTime = startTime;

    this.emitEvent('agent_progress', `${this.blueprint.name} starting research...`, {
      agentId: this.blueprint.id,
      agentName: this.blueprint.name,
      progress: 0,
    });

    try {
      // Execute all search queries
      const searchResults = await this.executeSearches();

      this.state.status = 'synthesizing';
      this.state.progress = 70;

      this.emitEvent('agent_progress', `${this.blueprint.name} synthesizing findings...`, {
        agentId: this.blueprint.id,
        progress: 70,
      });

      // Analyze results and generate findings
      const analysisResult = await this.analyzeResults(searchResults);

      // Update state
      this.state.status = 'complete';
      this.state.progress = 100;
      this.state.endTime = Date.now();
      this.state.findings = analysisResult.findings;

      const executionTime = Date.now() - startTime;

      this.emitEvent(
        'agent_complete',
        `${this.blueprint.name} complete with ${analysisResult.findings.length} findings`,
        {
          agentId: this.blueprint.id,
          agentName: this.blueprint.name,
        }
      );

      log.info('Scout execution complete', {
        agentId: this.blueprint.id,
        findingsCount: analysisResult.findings.length,
        searchesExecuted: this.state.searchesCompleted,
        executionTimeMs: executionTime,
      });

      return {
        agentId: this.blueprint.id,
        findings: analysisResult.findings,
        summary: analysisResult.summary,
        needsDeeper: analysisResult.needsDeeper,
        childSuggestions: analysisResult.childSuggestions,
        gaps: analysisResult.gaps,
        searchesExecuted: this.state.searchesCompleted,
        tokensUsed: this.state.tokensUsed,
        executionTime,
      };
    } catch (error) {
      this.state.status = 'failed';
      this.state.endTime = Date.now();
      const errMsg = error instanceof Error ? error.message : String(error);
      this.state.errors.push(errMsg);

      this.emitEvent('agent_failed', `${this.blueprint.name} failed: ${errMsg}`, {
        agentId: this.blueprint.id,
        error: errMsg,
      });

      log.error('Scout execution failed', { agentId: this.blueprint.id, error });

      return {
        agentId: this.blueprint.id,
        findings: [],
        summary: `Research failed: ${errMsg}`,
        needsDeeper: false,
        childSuggestions: [],
        gaps: ['Research could not be completed'],
        searchesExecuted: this.state.searchesCompleted,
        tokensUsed: this.state.tokensUsed,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get current state
   */
  getState(): ScoutState {
    return { ...this.state };
  }

  /**
   * Get blueprint
   */
  getBlueprint(): AgentBlueprint {
    return this.blueprint;
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Execute all search queries
   */
  private async executeSearches(): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const queries = this.blueprint.searchQueries;

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];

      this.emitEvent('search_executing', `Searching: ${query.slice(0, 50)}...`, {
        agentId: this.blueprint.id,
        searchQuery: query,
      });

      try {
        // Execute Brave search
        const searchResult = await braveWebSearch({ query, count: 10, extraSnippets: true });

        // Format results
        const formattedResults = this.formatSearchResults(searchResult);
        results.set(query, formattedResults);

        this.state.searchesCompleted++;
        this.state.costIncurred += this.costPerQuery;

        // Update progress
        this.state.progress = Math.round(((i + 1) / queries.length) * 60); // 0-60% for searches

        this.emitEvent('search_complete', `Search complete: ${query.slice(0, 30)}...`, {
          agentId: this.blueprint.id,
        });

        // Small delay to avoid rate limiting
        if (i < queries.length - 1) {
          await this.sleep(200);
        }
      } catch (error) {
        log.warn('Search failed', { query, error });
        this.state.errors.push(`Search failed: ${query}`);
        results.set(query, 'Search failed - no results');
      }
    }

    return results;
  }

  /**
   * Format Brave search results
   */
  private formatSearchResults(searchResult: BraveSearchResponse): string {
    if (!searchResult.webResults?.length) {
      return 'No results found';
    }

    return searchResult.webResults
      .slice(0, 8)
      .map((r: BraveWebResult, i: number) => {
        const description = r.description || '';
        const snippet = r.extraSnippets?.join(' ') || '';
        return `[${i + 1}] ${r.title}\nURL: ${r.url}\n${description}\n${snippet}`.trim();
      })
      .join('\n\n');
  }

  /**
   * Analyze search results and generate findings
   */
  private async analyzeResults(searchResults: Map<string, string>): Promise<{
    findings: Finding[];
    summary: string;
    needsDeeper: boolean;
    childSuggestions: Partial<AgentBlueprint>[];
    gaps: string[];
  }> {
    // Build the prompt with search results
    const searchContext = Array.from(searchResults.entries())
      .map(([query, results]) => `QUERY: ${query}\n\nRESULTS:\n${results}`)
      .join('\n\n---\n\n');

    const prompt = SCOUT_PROMPT.replace('{AGENT_NAME}', this.blueprint.name)
      .replace('{AGENT_ROLE}', this.blueprint.role)
      .replace('{EXPERTISE}', this.blueprint.expertise.join(', '))
      .replace('{PURPOSE}', this.blueprint.purpose)
      .replace('{KEY_QUESTIONS}', this.blueprint.keyQuestions.map((q) => `• ${q}`).join('\n'))
      .replace('{SEARCH_QUERIES}', this.blueprint.searchQueries.join('\n'));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      temperature: 0.5,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: `Here are your search results. Analyze them and provide your findings:\n\n${searchContext}`,
        },
      ],
    });

    // Track token usage
    this.state.tokensUsed +=
      (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Parse the response
    return this.parseAnalysisResponse(textContent);
  }

  /**
   * Parse analysis response
   */
  private parseAnalysisResponse(response: string): {
    findings: Finding[];
    summary: string;
    needsDeeper: boolean;
    childSuggestions: Partial<AgentBlueprint>[];
    gaps: string[];
  } {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

    if (!jsonMatch) {
      // Create a basic finding from the text
      return {
        findings: [
          {
            id: `finding_${Date.now()}`,
            agentId: this.blueprint.id,
            agentName: this.blueprint.name,
            type: 'insight',
            title: 'Research Summary',
            content: response.slice(0, 1000),
            confidence: 'medium',
            sources: [],
            timestamp: Date.now(),
            relevanceScore: 0.7,
          },
        ],
        summary: response.slice(0, 500),
        needsDeeper: false,
        childSuggestions: [],
        gaps: [],
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);

      const findings: Finding[] = (parsed.findings || []).map(
        (f: Record<string, unknown>, i: number) => ({
          id: `finding_${this.blueprint.id}_${i}`,
          agentId: this.blueprint.id,
          agentName: this.blueprint.name,
          type: this.normalizeType(f.type),
          title: String(f.title || 'Finding'),
          content: String(f.content || ''),
          confidence: this.normalizeConfidence(f.confidence),
          sources: this.normalizeSources(f.sources),
          dataPoints: this.normalizeDataPoints(f.dataPoints),
          timestamp: Date.now(),
          relevanceScore: Number(f.relevanceScore) || 0.7,
        })
      );

      return {
        findings,
        summary: String(parsed.summary || ''),
        needsDeeper: Boolean(parsed.needsDeeper),
        childSuggestions: Array.isArray(parsed.childSuggestions) ? parsed.childSuggestions : [],
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
      };
    } catch (error) {
      log.warn('Failed to parse analysis response', { error });
      return {
        findings: [],
        summary: 'Failed to parse research results',
        needsDeeper: false,
        childSuggestions: [],
        gaps: ['Analysis parsing failed'],
      };
    }
  }

  /**
   * Normalize finding type
   */
  private normalizeType(raw: unknown): FindingType {
    const value = String(raw).toLowerCase();
    const valid: FindingType[] = [
      'fact',
      'insight',
      'recommendation',
      'warning',
      'opportunity',
      'comparison',
      'data',
      'gap',
    ];
    return valid.includes(value as FindingType) ? (value as FindingType) : 'insight';
  }

  /**
   * Normalize confidence level
   */
  private normalizeConfidence(raw: unknown): 'high' | 'medium' | 'low' {
    const value = String(raw).toLowerCase();
    if (value === 'high' || value === 'medium' || value === 'low') {
      return value;
    }
    return 'medium';
  }

  /**
   * Normalize sources
   */
  private normalizeSources(raw: unknown): SourceCitation[] {
    if (!Array.isArray(raw)) return [];

    return raw.map((s): SourceCitation => {
      if (typeof s === 'string') {
        return {
          title: s,
          type: 'web',
          accessedAt: Date.now(),
          reliability: 'medium',
        };
      }
      const source = s as Record<string, unknown>;
      return {
        title: String(source.title || 'Source'),
        url: source.url ? String(source.url) : undefined,
        type: 'web',
        accessedAt: Date.now(),
        reliability: 'medium',
      };
    });
  }

  /**
   * Normalize data points
   */
  private normalizeDataPoints(raw: unknown): DataPoint[] | undefined {
    if (!Array.isArray(raw)) return undefined;

    return raw.map((d): DataPoint => {
      const point = d as Record<string, unknown>;
      return {
        label: String(point.label || ''),
        value: point.value as string | number,
        unit: point.unit ? String(point.unit) : undefined,
        source: point.source ? String(point.source) : undefined,
      };
    });
  }

  /**
   * Emit stream event
   */
  private emitEvent(
    type:
      | 'agent_progress'
      | 'agent_complete'
      | 'agent_failed'
      | 'search_executing'
      | 'search_complete',
    message: string,
    data: Record<string, unknown>
  ): void {
    if (this.onStream) {
      this.onStream({
        type,
        message,
        timestamp: Date.now(),
        data: data as Parameters<StrategyStreamCallback>[0]['data'],
      });
    }
  }

  /**
   * Sleep helper
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createScout(
  client: Anthropic,
  blueprint: AgentBlueprint,
  onStream?: StrategyStreamCallback
): Scout {
  return new Scout(client, blueprint, onStream);
}

// =============================================================================
// BATCH EXECUTION
// =============================================================================

/**
 * Execute multiple scouts in batches
 */
export async function* executeScoutBatch(
  client: Anthropic,
  blueprints: AgentBlueprint[],
  batchSize: number = 5,
  delayMs: number = 500,
  onStream?: StrategyStreamCallback
): AsyncGenerator<ScoutResult> {
  for (let i = 0; i < blueprints.length; i += batchSize) {
    const batch = blueprints.slice(i, i + batchSize);

    // Execute batch concurrently
    const scouts = batch.map((bp) => createScout(client, bp, onStream));
    const results = await Promise.allSettled(scouts.map((s) => s.execute()));

    // Yield results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        yield result.value;
      } else {
        log.error('Scout batch execution failed', { error: result.reason });
      }
    }

    // Delay between batches
    if (i + batchSize < blueprints.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
