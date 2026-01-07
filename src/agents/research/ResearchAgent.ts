/**
 * RESEARCH AGENT
 *
 * The main orchestrator for the dynamic research system.
 * Coordinates: Intent → Strategy → Execution → Evaluation → Synthesis
 *
 * This is what makes JCIL different from Manus:
 * - Dynamic query generation (1-10 queries based on complexity)
 * - Perplexity-powered search (fast, reliable, synthesized)
 * - Single iteration, parallel execution
 * - Streaming progress (never times out)
 */

import { BaseAgent } from '../core/BaseAgent';
import {
  AgentContext,
  AgentResult,
  AgentStreamCallback,
  ResearchStrategy,
  SearchResult,
  EvaluatedResults,
  ResearchOutput,
  GeneratedQuery,
} from '../core/types';

import { intentAnalyzer } from './brain/IntentAnalyzer';
import { strategyGenerator } from './brain/StrategyGenerator';
import { resultEvaluator } from './brain/ResultEvaluator';
import { synthesizer } from './brain/Synthesizer';
import { perplexityExecutor } from './executors/PerplexityExecutor';

export interface ResearchInput {
  query: string;
  depth?: 'quick' | 'standard' | 'deep';
}

export class ResearchAgent extends BaseAgent<ResearchInput, ResearchOutput> {
  name = 'ResearchAgent';
  description = 'Dynamic multi-source research with self-evaluation and adaptive querying';
  version = '1.0.0';

  // Time budget: Leave 30s for synthesis, so search phase max = 50s
  private readonly MAX_SEARCH_TIME_MS = 50000;
  private executionStartTime: number = 0;

  // Maximum limits to prevent memory exhaustion
  private readonly MAX_RESULTS = 100;
  private readonly MAX_EVALUATIONS = 10;

  // Store all results across iterations
  private allResults: SearchResult[] = [];
  private allEvaluations: EvaluatedResults[] = [];
  private executedQueries: Set<string> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Start heartbeat to prevent Vercel timeout
   */
  private startHeartbeat(onStream: AgentStreamCallback, phase: string): void {
    this.stopHeartbeat();
    let tick = 0;
    this.heartbeatInterval = setInterval(() => {
      tick++;
      this.emit(onStream, 'searching', `Still working... (${tick * 5}s)`, {
        phase,
        details: { heartbeat: true },
      });
    }, 5000); // Every 5 seconds for Vercel
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Check if we're running out of time and should force synthesis
   */
  private isTimeToSynthesize(): boolean {
    const elapsed = Date.now() - this.executionStartTime;
    return elapsed >= this.MAX_SEARCH_TIME_MS;
  }

  /**
   * Main execution method
   */
  async execute(
    input: ResearchInput,
    context: AgentContext,
    onStream: AgentStreamCallback
  ): Promise<AgentResult<ResearchOutput>> {
    this.startExecution();
    this.executionStartTime = Date.now();
    this.allResults = [];
    this.allEvaluations = [];
    this.executedQueries.clear();

    try {
      // ========================================
      // PHASE 1: Understand Intent
      // ========================================
      this.emit(onStream, 'thinking', 'Analyzing your research request...', {
        phase: 'Intent Analysis',
        progress: 5,
      });

      const intent = await intentAnalyzer.analyze(input.query, context);

      // Override depth if specified in input
      if (input.depth) {
        intent.requiredDepth = input.depth;
      }

      this.emit(onStream, 'thinking', `Understood: "${intent.refinedQuery}"`, {
        phase: 'Intent Analysis',
        progress: 10,
        details: {
          topics: intent.topics,
          depth: intent.requiredDepth,
          expectedOutputs: intent.expectedOutputs,
        },
      });

      // ========================================
      // PHASE 2: Generate Strategy
      // ========================================
      this.emit(onStream, 'thinking', 'Creating research strategy...', {
        phase: 'Strategy Generation',
        progress: 15,
      });

      const strategy = await strategyGenerator.generate(intent);

      this.emit(onStream, 'thinking', `Strategy: ${strategy.phases.length} phases, ${this.countTotalQueries(strategy)} queries`, {
        phase: 'Strategy Generation',
        progress: 20,
        details: {
          phases: strategy.phases.map(p => p.name),
          maxIterations: strategy.maxIterations,
        },
      });

      // ========================================
      // PHASE 3: Execute & Evaluate Loop
      // ========================================
      let iteration = 0;
      let shouldContinue = true;
      let pendingQueries: GeneratedQuery[] = this.getAllQueries(strategy);

      while (shouldContinue && iteration < strategy.maxIterations && !this.isTimeToSynthesize()) {
        iteration++;
        this.incrementIteration();

        const progressBase = 20 + (iteration * 20);

        this.emit(onStream, 'searching', `Iteration ${iteration}: Executing ${pendingQueries.length} searches...`, {
          phase: `Iteration ${iteration}`,
          progress: progressBase,
        });

        // Start heartbeat to prevent Vercel timeout during long searches
        this.startHeartbeat(onStream, `Iteration ${iteration}`);

        // Execute searches in parallel (Google and Perplexity)
        const results = await this.executeQueries(pendingQueries, onStream, progressBase);

        // Add results with limit to prevent memory exhaustion
        for (const result of results) {
          if (this.allResults.length >= this.MAX_RESULTS) {
            console.warn('[ResearchAgent] Max results limit reached, skipping remaining');
            break;
          }
          this.allResults.push(result);
        }

        // Stop heartbeat after searches complete
        this.stopHeartbeat();

        // Check time budget - force synthesis if running low
        if (this.isTimeToSynthesize()) {
          this.emit(onStream, 'thinking', 'Time budget reached. Moving to synthesis with current results...', {
            phase: 'Time Check',
            progress: 80,
          });
          break;
        }

        // Mark queries as executed
        pendingQueries.forEach(q => this.executedQueries.add(q.query));

        this.emit(onStream, 'evaluating', `Evaluating ${results.length} results...`, {
          phase: `Iteration ${iteration}`,
          progress: progressBase + 10,
        });

        // Evaluate results
        const evaluation = await resultEvaluator.evaluate(
          this.allResults,
          intent,
          iteration,
          strategy.maxIterations
        );

        // Add evaluation with limit
        if (this.allEvaluations.length < this.MAX_EVALUATIONS) {
          this.allEvaluations.push(evaluation);
        }

        this.emit(onStream, 'evaluating', `Coverage: ${(evaluation.coverage.score * 100).toFixed(0)}% | Quality: ${(evaluation.quality.score * 100).toFixed(0)}%`, {
          phase: `Iteration ${iteration}`,
          progress: progressBase + 15,
          details: {
            coverage: evaluation.coverage,
            quality: evaluation.quality,
            recommendation: evaluation.recommendation.action,
          },
        });

        // Decide next action
        switch (evaluation.recommendation.action) {
          case 'synthesize':
            shouldContinue = false;
            this.emit(onStream, 'thinking', 'Sufficient data collected. Moving to synthesis...', {
              phase: 'Decision',
              progress: progressBase + 18,
            });
            break;

          case 'continue':
            if (evaluation.recommendation.suggestedQueries && evaluation.recommendation.suggestedQueries.length > 0) {
              // Filter out already-executed queries
              pendingQueries = evaluation.recommendation.suggestedQueries.filter(
                q => !this.executedQueries.has(q.query)
              );

              if (pendingQueries.length === 0) {
                shouldContinue = false;
                this.emit(onStream, 'thinking', 'No new queries to try. Moving to synthesis...', {
                  phase: 'Decision',
                  progress: progressBase + 18,
                });
              } else {
                this.emit(onStream, 'pivoting', `Found gaps. Adding ${pendingQueries.length} new queries...`, {
                  phase: 'Decision',
                  progress: progressBase + 18,
                  details: { gaps: evaluation.quality.gaps },
                });
              }
            } else {
              // Generate gap-filling queries
              const gapQueries = await strategyGenerator.generateGapFillingQueries(
                evaluation.quality.gaps,
                intent,
                Array.from(this.executedQueries)
              );
              pendingQueries = gapQueries;

              if (pendingQueries.length === 0) {
                shouldContinue = false;
              }
            }
            break;

          case 'pivot':
            // Major strategy change - regenerate
            this.emit(onStream, 'pivoting', 'Results off-target. Adjusting strategy...', {
              phase: 'Decision',
              progress: progressBase + 18,
            });

            const newStrategy = await strategyGenerator.generate({
              ...intent,
              refinedQuery: intent.refinedQuery + ' ' + evaluation.quality.gaps.join(' '),
            });

            pendingQueries = this.getAllQueries(newStrategy).filter(
              q => !this.executedQueries.has(q.query)
            );

            if (pendingQueries.length === 0) {
              shouldContinue = false;
            }
            break;
        }
      }

      // ========================================
      // PHASE 4: Synthesize Results
      // ========================================
      this.emit(onStream, 'synthesizing', 'Creating comprehensive research report...', {
        phase: 'Synthesis',
        progress: 85,
      });

      // Start heartbeat for synthesis (can take 30+ seconds)
      this.startHeartbeat(onStream, 'Synthesis');

      const output = await synthesizer.synthesize(
        this.allResults,
        intent,
        this.allEvaluations,
        {
          totalQueries: this.executedQueries.size,
          iterations: iteration,
          executionTime: this.getExecutionTime(),
        }
      );

      // Stop heartbeat
      this.stopHeartbeat();

      this.emit(onStream, 'complete', 'Research complete!', {
        phase: 'Complete',
        progress: 100,
        details: {
          findings: output.keyFindings.length,
          sources: output.sources.length,
          confidence: output.metadata.confidenceScore,
        },
      });

      // Track source used
      this.trackSource('perplexity');

      return this.success(output, output.metadata.confidenceScore);
    } catch (error) {
      // Clean up heartbeat on error
      this.stopHeartbeat();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.emit(onStream, 'error', `Research failed: ${errorMessage}`, {
        phase: 'Error',
        progress: 0,
      });

      return this.failure(errorMessage);
    }
  }

  /**
   * Check if this agent can handle the input
   */
  canHandle(input: unknown): boolean {
    if (typeof input !== 'object' || input === null) return false;
    const obj = input as Record<string, unknown>;
    return typeof obj.query === 'string' && obj.query.length > 0;
  }

  /**
   * Execute all queries via Perplexity in parallel
   */
  private async executeQueries(
    queries: GeneratedQuery[],
    onStream: AgentStreamCallback,
    progressBase: number
  ): Promise<SearchResult[]> {
    // All queries go to Perplexity now - faster and more reliable
    if (!perplexityExecutor.isAvailable()) {
      this.emit(onStream, 'error', 'Perplexity API not configured', {
        phase: 'Error',
        progress: 0,
      });
      return [];
    }

    return this.executeWithProgress(queries, 'perplexity', onStream, progressBase);
  }

  /**
   * Timeout wrapper for individual searches
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallback: T
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => {
        setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  }

  /**
   * Execute queries via Perplexity with progress updates
   * Runs ALL searches IN PARALLEL with individual timeouts
   */
  private async executeWithProgress(
    queries: GeneratedQuery[],
    _source: 'google' | 'perplexity',
    onStream: AgentStreamCallback,
    _progressBase: number
  ): Promise<SearchResult[]> {
    // Log each query as we start
    queries.forEach(query => {
      this.emit(onStream, 'searching', `Querying: "${query.query.substring(0, 60)}..."`, {
        phase: 'Searching',
        details: { source: 'perplexity', purpose: query.purpose },
      });
    });

    // Execute ALL searches in parallel with 20-second timeout each
    const SEARCH_TIMEOUT = 20000; // 20 seconds max per search

    const searchPromises = queries.map(async (query) => {
      const fallbackResult: SearchResult = {
        id: `timeout-perplexity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        query: query.query,
        source: 'perplexity',
        content: `Search timed out for: ${query.query}`,
        relevanceScore: 0.1,
        timestamp: Date.now(),
      };

      return this.withTimeout(
        perplexityExecutor.execute(query),
        SEARCH_TIMEOUT,
        fallbackResult
      );
    });

    // Wait for all searches to complete (with their timeouts)
    const results = await Promise.all(searchPromises);

    return results;
  }

  /**
   * Get all queries from a strategy
   */
  private getAllQueries(strategy: ResearchStrategy): GeneratedQuery[] {
    return strategy.phases
      .filter(p => !p.isConditional) // Only non-conditional phases initially
      .flatMap(p => p.queries);
  }

  /**
   * Count total queries in a strategy
   */
  private countTotalQueries(strategy: ResearchStrategy): number {
    return strategy.phases.reduce((acc, p) => acc + p.queries.length, 0);
  }

  /**
   * Format output as markdown for display
   */
  formatOutput(output: ResearchOutput): string {
    return synthesizer.formatAsMarkdown(output);
  }
}

// Export singleton instance
export const researchAgent = new ResearchAgent();
