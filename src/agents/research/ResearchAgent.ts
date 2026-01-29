/**
 * RESEARCH AGENT
 *
 * The main orchestrator for the dynamic research system.
 * Coordinates: Intent → Strategy → Execution → Evaluation → Synthesis
 *
 * Key Features:
 * - Dynamic query generation (1-20 queries based on complexity)
 * - Brave Search powered (cost-effective, rich data, comprehensive)
 * - Perplexity fallback for complex research (optional)
 * - Single iteration, parallel execution
 * - Streaming progress for real-time feedback
 * - Multi-provider AI synthesis with Claude/xAI fallback
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
import { qualityControl, type QCReport } from './brain/QualityControl';
import { braveExecutor } from './executors/BraveExecutor';
import { perplexityExecutor } from './executors/PerplexityExecutor';
import { browserExecutor } from './executors/BrowserExecutor';
import { visionExecutor, type VisionInput } from './executors/VisionExecutor';
import { codeExecutor, type CodeInput } from './executors/CodeExecutor';
import { documentExecutor } from './executors/DocumentExecutor';

export interface ResearchInput {
  query: string;
  depth?: 'quick' | 'standard' | 'deep';
  userId?: string; // For document search
  enableQC?: boolean; // Enable quality control verification
  images?: VisionInput[]; // Images to analyze
  codeSnippets?: CodeInput[]; // Code to execute
}

export class ResearchAgent extends BaseAgent<ResearchInput, ResearchOutput> {
  name = 'ResearchAgent';
  description =
    'Comprehensive multi-source research with Brave Search, Browser (Puppeteer), Vision (Claude), Code (E2B), and Document search';
  version = '3.0.0';

  // Time budget: Leave 30s for synthesis, so search phase max = 60s (increased for more queries)
  private readonly MAX_SEARCH_TIME_MS = 60000;
  private executionStartTime: number = 0;

  // Maximum limits - increased for comprehensive research
  private readonly MAX_RESULTS = 150; // Up to 20 queries × ~7 useful results each
  private readonly MAX_EVALUATIONS = 10;

  // Store all results across iterations
  private allResults: SearchResult[] = [];
  private allEvaluations: EvaluatedResults[] = [];
  private executedQueries: Set<string> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private qcReport: QCReport | null = null;

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

      this.emit(
        onStream,
        'thinking',
        `Strategy: ${strategy.phases.length} phases, ${this.countTotalQueries(strategy)} queries`,
        {
          phase: 'Strategy Generation',
          progress: 20,
          details: {
            phases: strategy.phases.map((p) => p.name),
            maxIterations: strategy.maxIterations,
          },
        }
      );

      // ========================================
      // PHASE 3: Execute & Evaluate Loop
      // ========================================
      let iteration = 0;
      let shouldContinue = true;
      let pendingQueries: GeneratedQuery[] = this.getAllQueries(strategy);

      while (shouldContinue && iteration < strategy.maxIterations && !this.isTimeToSynthesize()) {
        iteration++;
        this.incrementIteration();

        const progressBase = 20 + iteration * 20;

        this.emit(
          onStream,
          'searching',
          `Iteration ${iteration}: Executing ${pendingQueries.length} searches...`,
          {
            phase: `Iteration ${iteration}`,
            progress: progressBase,
            details: {
              queries: pendingQueries.map((q) => q.query),
            },
          }
        );

        // Start heartbeat to prevent Vercel timeout during long searches
        this.startHeartbeat(onStream, `Iteration ${iteration}`);

        // Execute searches in parallel via Brave (with Perplexity fallback if needed)
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
          this.emit(
            onStream,
            'thinking',
            'Time budget reached. Moving to synthesis with current results...',
            {
              phase: 'Time Check',
              progress: 80,
            }
          );
          break;
        }

        // Mark queries as executed
        pendingQueries.forEach((q) => this.executedQueries.add(q.query));

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

        this.emit(
          onStream,
          'evaluating',
          `Coverage: ${(evaluation.coverage.score * 100).toFixed(0)}% | Quality: ${(evaluation.quality.score * 100).toFixed(0)}%`,
          {
            phase: `Iteration ${iteration}`,
            progress: progressBase + 15,
            details: {
              coverage: evaluation.coverage,
              quality: evaluation.quality,
              recommendation: evaluation.recommendation.action,
            },
          }
        );

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
            if (
              evaluation.recommendation.suggestedQueries &&
              evaluation.recommendation.suggestedQueries.length > 0
            ) {
              // Filter out already-executed queries
              pendingQueries = evaluation.recommendation.suggestedQueries.filter(
                (q) => !this.executedQueries.has(q.query)
              );

              if (pendingQueries.length === 0) {
                shouldContinue = false;
                this.emit(onStream, 'thinking', 'No new queries to try. Moving to synthesis...', {
                  phase: 'Decision',
                  progress: progressBase + 18,
                });
              } else {
                this.emit(
                  onStream,
                  'pivoting',
                  `Found gaps. Adding ${pendingQueries.length} new queries...`,
                  {
                    phase: 'Decision',
                    progress: progressBase + 18,
                    details: { gaps: evaluation.quality.gaps },
                  }
                );
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
              (q) => !this.executedQueries.has(q.query)
            );

            if (pendingQueries.length === 0) {
              shouldContinue = false;
            }
            break;
        }
      }

      // ========================================
      // PHASE 3.5: Extended Capabilities
      // ========================================

      // Check if any queries need browser execution (JS-heavy sites)
      const browserQueries = pendingQueries.filter((q) => browserExecutor.shouldUseBrowser(q));
      if (browserQueries.length > 0 && (await browserExecutor.isAvailable())) {
        this.emit(onStream, 'searching', `Executing ${browserQueries.length} browser visits...`, {
          phase: 'Browser Execution',
          progress: 70,
        });

        const browserResults = await browserExecutor.executeMany(browserQueries);
        this.allResults.push(...browserResults);
      }

      // Process any images provided
      if (input.images && input.images.length > 0 && (await visionExecutor.isAvailable())) {
        this.emit(onStream, 'searching', `Analyzing ${input.images.length} images...`, {
          phase: 'Vision Analysis',
          progress: 72,
        });

        const visionResults = await visionExecutor.executeMany(input.images);
        this.allResults.push(...visionResults);
      }

      // Execute any code snippets provided
      if (
        input.codeSnippets &&
        input.codeSnippets.length > 0 &&
        (await codeExecutor.isAvailable())
      ) {
        this.emit(
          onStream,
          'searching',
          `Executing ${input.codeSnippets.length} code snippets...`,
          {
            phase: 'Code Execution',
            progress: 74,
          }
        );

        const codeResults = await codeExecutor.executeMany(input.codeSnippets);
        this.allResults.push(...codeResults);
      }

      // Search user documents if userId provided
      if (input.userId && (await documentExecutor.isAvailable(input.userId))) {
        this.emit(onStream, 'searching', 'Searching your uploaded documents...', {
          phase: 'Document Search',
          progress: 76,
        });

        // Search documents with the refined query
        const docResult = await documentExecutor.execute({
          query: {
            id: `doc_search_${Date.now()}`,
            query: intent.refinedQuery,
            purpose: 'Find relevant user documents',
            expectedInfo: intent.expectedOutputs,
            source: 'brave',
            priority: 8,
          },
          userId: input.userId,
          matchCount: 10,
        });

        if (docResult.relevanceScore && docResult.relevanceScore > 0.1) {
          this.allResults.push(docResult);
        }
      }

      // ========================================
      // PHASE 3.6: Question Refinement (QC)
      // ========================================
      if (input.enableQC !== false) {
        this.emit(onStream, 'evaluating', 'Refining question for better results...', {
          phase: 'Quality Control',
          progress: 78,
        });

        const refinement = await qualityControl.refineQuestion(input.query, context.userId);

        // If the refined question is significantly different, log it
        if (refinement.refinedQuestion !== refinement.originalQuestion) {
          this.emit(
            onStream,
            'thinking',
            `Question refined: "${refinement.refinedQuestion.substring(0, 80)}..."`,
            {
              phase: 'Quality Control',
              progress: 79,
              details: {
                clarifyingQuestions: refinement.clarifyingQuestions,
                missingContext: refinement.missingContext,
              },
            }
          );
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

      const output = await synthesizer.synthesize(this.allResults, intent, this.allEvaluations, {
        totalQueries: this.executedQueries.size,
        iterations: iteration,
        executionTime: this.getExecutionTime(),
        depth: intent.requiredDepth,
      });

      // Stop heartbeat
      this.stopHeartbeat();

      // ========================================
      // PHASE 5: Quality Control Review (Optional)
      // ========================================
      if (input.enableQC !== false && output.keyFindings.length > 0) {
        this.emit(onStream, 'evaluating', 'Running quality control verification...', {
          phase: 'Quality Control',
          progress: 95,
        });

        try {
          this.qcReport = await qualityControl.review(intent, this.allResults, output);

          // Add QC insights to output
          if (this.qcReport.criticalIssues.length > 0) {
            output.gaps = [...output.gaps, ...this.qcReport.criticalIssues];
          }

          if (this.qcReport.suggestions.length > 0) {
            output.suggestions = [...output.suggestions, ...this.qcReport.suggestions];
          }

          // Adjust confidence based on QC
          output.metadata.confidenceScore = Math.min(
            output.metadata.confidenceScore,
            this.qcReport.overallConfidence
          );

          this.emit(
            onStream,
            'evaluating',
            `QC Complete: ${(this.qcReport.overallConfidence * 100).toFixed(0)}% confidence`,
            {
              phase: 'Quality Control',
              progress: 98,
              details: {
                completeness: this.qcReport.completenessScore,
                criticalIssues: this.qcReport.criticalIssues.length,
                verifiedClaims: this.qcReport.verifiedClaims.filter(
                  (c) => c.verificationStatus === 'verified'
                ).length,
              },
            }
          );
        } catch (qcError) {
          // QC failure is non-fatal
          console.warn('[ResearchAgent] QC review failed:', qcError);
        }
      }

      this.emit(onStream, 'complete', 'Research complete!', {
        phase: 'Complete',
        progress: 100,
        details: {
          findings: output.keyFindings.length,
          sources: output.sources.length,
          confidence: output.metadata.confidenceScore,
          qcCompleted: !!this.qcReport,
        },
      });

      // Track source used
      this.trackSource('brave');

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
   * Execute all queries via Brave Search (with Perplexity fallback)
   * Supports up to 20 parallel queries for comprehensive research
   */
  private async executeQueries(
    queries: GeneratedQuery[],
    onStream: AgentStreamCallback,
    progressBase: number
  ): Promise<SearchResult[]> {
    // Primary: Brave Search (cost-effective, rich data)
    if (braveExecutor.isAvailable()) {
      this.emit(onStream, 'searching', `Executing ${queries.length} Brave searches...`, {
        phase: 'Brave Search',
        progress: progressBase,
        details: { queryCount: queries.length, provider: 'brave' },
      });
      return this.executeWithProgress(queries, 'brave', onStream, progressBase);
    }

    // Fallback: Perplexity (if Brave not configured)
    if (perplexityExecutor.isAvailable()) {
      this.emit(
        onStream,
        'searching',
        `Falling back to Perplexity for ${queries.length} searches...`,
        {
          phase: 'Perplexity Search',
          progress: progressBase,
          details: { queryCount: queries.length, provider: 'perplexity' },
        }
      );
      return this.executeWithPerplexity(queries, onStream, progressBase);
    }

    // No search provider available
    this.emit(
      onStream,
      'error',
      'No search provider configured (BRAVE_SEARCH_API_KEY or PERPLEXITY_API_KEY required)',
      {
        phase: 'Error',
        progress: 0,
      }
    );
    return [];
  }

  /**
   * Execute queries via Perplexity (fallback)
   */
  private async executeWithPerplexity(
    queries: GeneratedQuery[],
    onStream: AgentStreamCallback,
    _progressBase: number
  ): Promise<SearchResult[]> {
    // Perplexity has stricter limits, so cap at 10 queries
    const cappedQueries = queries.slice(0, 10);

    cappedQueries.forEach((query) => {
      this.emit(onStream, 'searching', `Querying: "${query.query.substring(0, 60)}..."`, {
        phase: 'Searching',
        details: { source: 'perplexity', purpose: query.purpose },
      });
    });

    const SEARCH_TIMEOUT = 20000;

    const searchPromises = cappedQueries.map(async (query) => {
      const fallbackResult: SearchResult = {
        id: `timeout-perplexity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        query: query.query,
        source: 'perplexity',
        content: `Search timed out for: ${query.query}`,
        relevanceScore: 0.1,
        timestamp: Date.now(),
      };

      return this.withTimeout(perplexityExecutor.execute(query), SEARCH_TIMEOUT, fallbackResult);
    });

    return Promise.all(searchPromises);
  }

  /**
   * Timeout wrapper for individual searches
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => {
        setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  }

  /**
   * Execute queries via Brave Search with progress updates
   * Runs ALL searches IN PARALLEL with batching for large query sets
   */
  private async executeWithProgress(
    queries: GeneratedQuery[],
    _source: 'google' | 'perplexity' | 'brave',
    onStream: AgentStreamCallback,
    _progressBase: number
  ): Promise<SearchResult[]> {
    // Log query count
    this.emit(onStream, 'searching', `Starting ${queries.length} parallel searches...`, {
      phase: 'Brave Search',
      details: { queryCount: queries.length },
    });

    // Execute in batches of 10 to avoid overwhelming
    const BATCH_SIZE = 10;
    const SEARCH_TIMEOUT = 25000; // 25 seconds max per search (Brave + AI synthesis)
    const results: SearchResult[] = [];

    for (let i = 0; i < queries.length; i += BATCH_SIZE) {
      const batch = queries.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(queries.length / BATCH_SIZE);

      this.emit(
        onStream,
        'searching',
        `Batch ${batchNumber}/${totalBatches}: ${batch.length} searches...`,
        {
          phase: 'Brave Search',
          details: { batch: batchNumber, total: totalBatches },
        }
      );

      // Log individual queries in batch
      batch.forEach((query) => {
        this.emit(onStream, 'searching', `Querying: "${query.query.substring(0, 50)}..."`, {
          phase: 'Searching',
          details: { source: 'brave', purpose: query.purpose },
        });
      });

      // Execute batch in parallel
      const batchPromises = batch.map(async (query) => {
        const fallbackResult: SearchResult = {
          id: `timeout-brave-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          query: query.query,
          source: 'brave',
          content: `Search timed out for: ${query.query}`,
          relevanceScore: 0.1,
          timestamp: Date.now(),
        };

        return this.withTimeout(braveExecutor.execute(query), SEARCH_TIMEOUT, fallbackResult);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Brief pause between batches if more to come
      if (i + BATCH_SIZE < queries.length) {
        await this.sleep(200);
      }
    }

    this.emit(onStream, 'searching', `Completed ${results.length} searches`, {
      phase: 'Brave Search Complete',
      details: { successful: results.filter((r) => (r.relevanceScore ?? 0) > 0.2).length },
    });

    return results;
  }

  /**
   * Get all queries from a strategy
   */
  private getAllQueries(strategy: ResearchStrategy): GeneratedQuery[] {
    return strategy.phases
      .filter((p) => !p.isConditional) // Only non-conditional phases initially
      .flatMap((p) => p.queries);
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

  /**
   * Get the QC report from the last execution
   */
  getQCReport(): QCReport | null {
    return this.qcReport;
  }

  /**
   * Check which extended capabilities are available
   */
  async getAvailableCapabilities(): Promise<{
    search: { brave: boolean; perplexity: boolean };
    extended: { browser: boolean; vision: boolean; code: boolean; documents: boolean };
  }> {
    const [browserAvailable, visionAvailable, codeAvailable] = await Promise.all([
      browserExecutor.isAvailable(),
      visionExecutor.isAvailable(),
      codeExecutor.isAvailable(),
    ]);

    return {
      search: {
        brave: braveExecutor.isAvailable(),
        perplexity: perplexityExecutor.isAvailable(),
      },
      extended: {
        browser: browserAvailable,
        vision: visionAvailable,
        code: codeAvailable,
        documents: true, // Always available, just needs userId
      },
    };
  }

  /**
   * Cleanup resources (call on shutdown)
   */
  async cleanup(): Promise<void> {
    this.stopHeartbeat();
    await codeExecutor.cleanup();
  }
}

// Export singleton instance
export const researchAgent = new ResearchAgent();
