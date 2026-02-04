/**
 * DEEP STRATEGY AGENT - Main Orchestrator
 *
 * The most advanced self-replicating AI agent ever built.
 * Coordinates Opus 4.5, Sonnet 4.5, and Haiku 4.5 to create
 * a dynamic army of specialized agents.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  StrategyContext,
  SynthesizedProblem,
  UserProblem,
  AgentBlueprint,
  AgentHierarchy,
  Finding,
  StrategyOutput,
  StrategyStreamCallback,
  StrategyStreamEvent,
  CostTracker,
  Artifact,
  SteeringCommand,
} from './types';
import { DEFAULT_LIMITS, CLAUDE_OPUS_45 } from './constants';
import { getPrompts } from './prompts';
import type { PromptSet } from './prompts';
import { ForensicIntake, createForensicIntake } from './ForensicIntake';
import { MasterArchitect, createMasterArchitect } from './MasterArchitect';
import { QualityControl, createQualityControl } from './QualityControl';
import { createScout, executeScoutBatch } from './Scout';
import { ExecutionQueue, createExecutionQueue } from './ExecutionQueue';
import { SteeringEngine, createSteeringEngine } from './SteeringEngine';
import { getKnowledgeSummary, storeFindings, buildKnowledgePromptContext } from './KnowledgeBase';
import {
  recordScoutPerformance,
  getPerformanceInsights,
  buildPerformancePromptContext,
} from './PerformanceTracker';
import { generateArtifacts } from './ArtifactGenerator';
import { logger } from '@/lib/logger';

const log = logger('StrategyAgent');

// =============================================================================
// STRATEGY AGENT CLASS
// =============================================================================

export class StrategyAgent {
  private client: Anthropic;
  private context: StrategyContext;
  private intake: ForensicIntake;
  private architect: MasterArchitect;
  private qc: QualityControl;
  private queue: ExecutionQueue;
  private steeringEngine: SteeringEngine;
  private onStream?: StrategyStreamCallback;
  private prompts: PromptSet;

  // State
  private allFindings: Finding[] = [];
  private blueprints: AgentBlueprint[] = [];
  private hierarchy?: AgentHierarchy;
  private artifacts: Artifact[] = [];
  private isRunning = false;
  private isCancelled = false;

  constructor(
    apiKey: string,
    context: Partial<StrategyContext>,
    onStream?: StrategyStreamCallback
  ) {
    this.client = new Anthropic({ apiKey });
    this.onStream = onStream;

    // Select prompt set based on mode
    this.prompts = getPrompts(context.mode || 'strategy');

    // Initialize context with defaults
    this.context = {
      userId: context.userId || 'unknown',
      sessionId: context.sessionId || crypto.randomUUID(),
      isAdmin: context.isAdmin ?? false,
      startTime: Date.now(),
      limits: context.limits || DEFAULT_LIMITS,
      costTracker: this.initCostTracker(),
      mode: context.mode || 'strategy',
      attachments: context.attachments,
      userContext: [],
    };

    // Initialize components with mode-specific prompts
    this.queue = createExecutionQueue(this.context.limits, onStream);
    this.steeringEngine = createSteeringEngine(onStream);
    this.intake = createForensicIntake(
      this.client,
      onStream,
      this.prompts.intake,
      this.prompts.intakeOpening
    );
    this.architect = createMasterArchitect(
      this.client,
      this.context.limits,
      onStream,
      this.prompts.architect
    );
    this.qc = createQualityControl(
      this.client,
      this.context.limits,
      onStream,
      this.prompts.qualityControl
    );
  }

  private initCostTracker(): CostTracker {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      searchCost: 0,
      breakdown: {
        opus: { tokens: 0, cost: 0 },
        sonnet: { tokens: 0, cost: 0 },
        haiku: { tokens: 0, cost: 0 },
        brave: { queries: 0, cost: 0 },
      },
    };
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Update the stream callback (needed when switching from intake to execute stream)
   */
  setStreamCallback(callback: StrategyStreamCallback | undefined): void {
    this.onStream = callback;
    // Note: Components created in constructor keep their original callbacks,
    // but scouts are created fresh during execution and will use the new callback.
    // This is mainly needed to update the agent's direct emitEvent calls.
  }

  /**
   * Start the intake process
   */
  async startIntake(): Promise<string> {
    // Deep Strategy Agent is now available to all users
    return this.intake.startIntake();
  }

  /**
   * Process user input during intake
   */
  async processIntakeInput(userInput: string): Promise<{
    response: string;
    isComplete: boolean;
  }> {
    const result = await this.intake.processUserInput(userInput);

    if (result.isComplete && result.problem) {
      this.context.problem = result.problem;
    }

    return {
      response: result.response,
      isComplete: result.isComplete,
    };
  }

  /**
   * Get intake messages for persistence (serverless support)
   */
  getIntakeMessages(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return this.intake.getMessages();
  }

  /**
   * Restore intake messages from persistence (serverless support)
   */
  restoreIntakeMessages(messages: Array<{ role: 'user' | 'assistant'; content: string }>): void {
    this.intake.restoreMessages(messages);
  }

  /**
   * Add context during execution (like Claude Code's interrupt feature)
   * Allows user to provide additional information or steering commands
   * while strategy is running.
   *
   * Steering commands (e.g., "stop researching X", "focus on Y") are
   * parsed by the SteeringEngine and applied in real-time.
   */
  async addContext(message: string): Promise<{
    steeringApplied: boolean;
    steeringResponse?: string;
    command?: SteeringCommand;
  }> {
    if (!this.isRunning) {
      throw new Error('Cannot add context when strategy is not running');
    }

    // Store the context message
    if (!this.context.userContext) {
      this.context.userContext = [];
    }
    this.context.userContext.push(message);

    // Try to parse as a steering command
    const command = this.steeringEngine.parseCommand(message);

    if (command) {
      // Apply the steering command
      const response = this.steeringEngine.applyCommand(command);

      // If redirect or spawn, generate new blueprints and queue them
      if (
        command.action === 'redirect' ||
        command.action === 'spawn_scouts' ||
        command.action === 'focus_domain'
      ) {
        const newBlueprints = this.steeringEngine.generateRedirectBlueprints(
          command,
          this.blueprints
        );
        if (newBlueprints.length > 0) {
          this.blueprints.push(...newBlueprints);
          if (this.hierarchy) {
            this.hierarchy.totalAgents += newBlueprints.length;
          }
          this.emit(
            'agent_spawned',
            `Steering: Spawning ${newBlueprints.length} new scouts for "${command.target}"`,
            { totalAgents: this.blueprints.length }
          );
        }
      }

      log.info('Steering command applied', {
        sessionId: this.context.sessionId,
        action: command.action,
        target: command.target,
        response,
      });

      return { steeringApplied: true, steeringResponse: response, command };
    }

    // Not a steering command — just context
    this.onStream?.({
      type: 'user_context_added',
      message,
      timestamp: Date.now(),
    });

    log.info('User context added during execution', {
      sessionId: this.context.sessionId,
      messageLength: message.length,
      totalContextMessages: this.context.userContext.length,
    });

    return { steeringApplied: false };
  }

  /**
   * Execute the full strategy after intake is complete
   */
  async executeStrategy(): Promise<StrategyOutput> {
    if (!this.context.problem) {
      throw new Error('Intake not complete. Call processIntakeInput until isComplete is true.');
    }

    if (this.isRunning) {
      throw new Error('Strategy execution already in progress');
    }

    this.isRunning = true;
    this.isCancelled = false;
    let wasKilled = false;
    let killReason = '';

    try {
      // Phase 0: Load prior knowledge and performance data
      let knowledgeContext = '';
      let performanceContext = '';

      try {
        const [knowledgeSummary, performanceInsights] = await Promise.all([
          getKnowledgeSummary(
            this.context.userId,
            this.context.problem.synthesizedProblem.coreQuestion
          ),
          getPerformanceInsights(this.context.userId, this.context.mode || 'strategy'),
        ]);

        knowledgeContext = buildKnowledgePromptContext(knowledgeSummary);
        performanceContext = buildPerformancePromptContext(performanceInsights);

        if (knowledgeSummary.totalFindings > 0) {
          this.emit(
            'synthesis_progress',
            `Loaded ${knowledgeSummary.totalFindings} prior findings from ${knowledgeSummary.domains.length} domains`
          );
        }
        if (performanceInsights.length > 0) {
          this.emit(
            'synthesis_progress',
            `Loaded ${performanceInsights.length} performance insights for smarter agent design`
          );
        }
      } catch (error) {
        log.warn('Failed to load prior knowledge/performance', { error });
        // Non-fatal — continue without prior context
      }

      // Phase 1: Design agents (enriched with prior knowledge + performance)
      this.emit('architect_designing', 'Master Architect designing agent army...');

      // Inject prior knowledge and performance data into architect's context
      if (knowledgeContext || performanceContext) {
        this.architect.injectAdditionalContext(knowledgeContext + performanceContext);
      }

      this.hierarchy = await this.architect.designAgents(this.context.problem.synthesizedProblem);
      // getScoutBlueprints reuses cached design from designAgents() - no extra API call
      this.blueprints = this.architect.getScoutBlueprints(this.context.problem.synthesizedProblem);

      // Register active domains with the steering engine
      const domains = this.context.problem.synthesizedProblem.domains;
      this.steeringEngine.setActiveDomains(domains);

      log.info('Agent design complete', {
        totalBlueprints: this.blueprints.length,
        projectManagers: this.hierarchy.projectManagers.length,
      });

      // Phase 2: Execute scouts in batches
      this.emit('agent_spawned', `Spawning ${this.blueprints.length} research scouts...`, {
        totalAgents: this.blueprints.length,
      });

      await this.executeScouts();

      // Check if cancelled - gracefully continue with partial results
      if (this.isCancelled || this.qc.isKilled()) {
        wasKilled = true;
        killReason = this.isCancelled ? 'User cancelled' : 'Quality control triggered stop';
        this.emit(
          'kill_switch',
          `Strategy stopped early: ${killReason}. Synthesizing partial results...`,
          {
            killReason: this.isCancelled ? 'user_cancelled' : 'quality_control_failed',
          }
        );
      }

      // Phase 3: Run quality check (skip if already killed)
      if (!wasKilled) {
        const qcResult = await this.qc.runCheck(
          this.queue.getCost(),
          this.hierarchy.completedAgents,
          this.hierarchy.totalAgents,
          this.hierarchy.failedAgents,
          this.allFindings
        );

        if (qcResult.action === 'kill') {
          wasKilled = true;
          killReason = qcResult.recommendation;
          this.emit(
            'kill_switch',
            `Quality control: ${killReason}. Synthesizing available findings...`,
            {
              killReason: 'quality_control_failed',
            }
          );
        }
      }

      // Phase 4: Final synthesis - ALWAYS try to synthesize if we have any findings
      if (this.allFindings.length > 0) {
        this.emit(
          'synthesis_start',
          wasKilled
            ? 'Synthesizing partial results with available findings...'
            : 'Synthesizing final strategy recommendation...'
        );
        const strategy = await this.synthesizeFinalStrategy(wasKilled, killReason);

        // Phase 5: Post-synthesis — store knowledge + generate artifacts
        try {
          this.emit('synthesis_progress', 'Storing findings in knowledge base...');
          const storageDomains = this.context.problem?.synthesizedProblem.domains || [];
          await storeFindings(
            this.context.userId,
            this.context.sessionId,
            this.context.mode || 'strategy',
            this.allFindings,
            storageDomains
          );
        } catch (error) {
          log.warn('Failed to store findings in knowledge base', { error });
        }

        try {
          this.emit('synthesis_progress', 'Generating deliverables...');
          this.artifacts = await generateArtifacts(
            this.context.userId,
            this.context.sessionId,
            strategy,
            this.allFindings,
            this.onStream
          );
          if (this.artifacts.length > 0) {
            this.emit(
              'synthesis_progress',
              `Generated ${this.artifacts.length} deliverable${this.artifacts.length > 1 ? 's' : ''}: ${this.artifacts.map((a) => a.title).join(', ')}`
            );
          }
        } catch (error) {
          log.warn('Failed to generate artifacts', { error });
        }

        this.emit(
          'strategy_complete',
          wasKilled
            ? `Partial strategy complete with ${this.allFindings.length} findings. ${killReason}`
            : 'Strategy complete!',
          {
            cost: this.queue.getCost().totalCost,
          }
        );

        return strategy;
      } else {
        // No findings at all - return minimal result
        this.emit('error', 'No research findings available to synthesize.', { error: killReason });
        return this.createMinimalResult(killReason || 'No findings collected');
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.emit('error', `Strategy execution error: ${errMsg}`, { error: errMsg });

      // Even on error, try to return partial results if we have findings
      if (this.allFindings.length > 0) {
        this.emit(
          'synthesis_start',
          'Attempting to synthesize available findings despite error...'
        );
        try {
          return await this.synthesizeFinalStrategy(true, errMsg);
        } catch (synthError) {
          log.error('Failed to synthesize after error', { error: synthError });
          return this.createMinimalResult(errMsg);
        }
      }

      return this.createMinimalResult(errMsg);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Create a minimal result when synthesis fails completely
   */
  private createMinimalResult(reason: string): StrategyOutput {
    const cost = this.queue.getCost();
    const problem = this.context.problem?.synthesizedProblem || {
      summary: 'Problem analysis incomplete',
      coreQuestion: 'Unable to determine',
      constraints: [],
      priorities: [],
      stakeholders: [],
      timeframe: 'Unknown',
      riskTolerance: 'medium' as const,
      complexity: 'moderate' as const,
      domains: [],
      hiddenFactors: [],
      successCriteria: [],
    };

    return {
      id: this.context.sessionId,
      problem,
      recommendation: {
        title: 'Partial Results Available',
        summary: `The strategy was stopped early: ${reason}. Based on the ${this.allFindings.length} findings we collected, here's what we know so far.`,
        confidence: Math.min(50, this.allFindings.length * 5),
        reasoning: this.allFindings.slice(0, 5).map((f) => f.title),
        tradeoffs: ['Full analysis not completed'],
        bestFor: 'Initial guidance only - consider running full analysis later',
      },
      alternatives: [],
      analysis: {
        byDomain: [],
        riskAssessment: {
          overallRisk: 'medium',
          risks: [
            {
              risk: 'Incomplete analysis',
              probability: 'high',
              impact: 'medium',
              mitigation: 'Run full strategy later',
            },
          ],
          mitigations: ['Review partial findings', 'Consider manual research for gaps'],
        },
      },
      actionPlan: [
        {
          order: 1,
          action: 'Review the partial findings below',
          timeframe: 'Now',
          priority: 'high',
        },
        {
          order: 2,
          action: 'Consider running full Deep Strategy later',
          timeframe: 'When ready',
          priority: 'medium',
        },
      ],
      gaps: [`Strategy stopped: ${reason}`, 'Full synthesis not completed'],
      nextSteps: ['Review partial findings', 'Retry Deep Strategy if needed'],
      metadata: {
        executionTime: this.queue.getElapsedTime() * 1000,
        totalAgents: this.blueprints.length,
        totalSearches: cost.breakdown.brave.queries,
        totalCost: cost.totalCost,
        confidenceScore: Math.min(0.5, this.allFindings.length * 0.05),
        completedAt: Date.now(),
        modelUsage: {
          opus: { calls: 1, tokens: cost.breakdown.opus.tokens },
          sonnet: {
            calls: this.hierarchy?.projectManagers.length || 0,
            tokens: cost.breakdown.sonnet.tokens,
          },
          haiku: {
            calls: this.hierarchy?.completedAgents || 0,
            tokens: cost.breakdown.haiku.tokens,
          },
        },
        qualityScore: this.qc.getState().overallQualityScore,
      },
    };
  }

  /**
   * Cancel the current execution
   */
  cancel(): void {
    this.isCancelled = true;
    this.queue.kill('User cancelled');
    this.qc.triggerKillSwitch('User cancelled');
    this.emit('kill_switch', 'Strategy cancelled by user', { killReason: 'user_cancelled' });
  }

  /**
   * Get current progress
   */
  getProgress(): {
    phase: string;
    progress: number;
    agentsComplete: number;
    agentsTotal: number;
    cost: number;
    elapsed: number;
  } {
    const queueProgress = this.queue.getProgress();
    const cost = this.queue.getCost();

    return {
      phase: this.getCurrentPhase(),
      progress: this.calculateOverallProgress(),
      agentsComplete: queueProgress.completed,
      agentsTotal: queueProgress.total,
      cost: cost.totalCost,
      elapsed: this.queue.getElapsedTime(),
    };
  }

  /**
   * Get all findings so far
   */
  getFindings(): Finding[] {
    return [...this.allFindings];
  }

  /**
   * Get generated artifacts (available after synthesis completes)
   */
  getArtifacts(): Artifact[] {
    return [...this.artifacts];
  }

  /**
   * Get the synthesized problem from intake
   */
  getProblem(): UserProblem | undefined {
    return this.context.problem;
  }

  /**
   * Get the agent mode name (e.g., 'Deep Strategy', 'Deep Research')
   */
  getModeName(): string {
    return this.prompts.name;
  }

  // ===========================================================================
  // PRIVATE METHODS - EXECUTION
  // ===========================================================================

  /**
   * Execute all scouts with rate limiting, steering, and performance tracking
   */
  private async executeScouts(): Promise<void> {
    const batchSize = this.context.limits.maxConcurrentCalls;
    const delayMs = this.context.limits.batchDelayMs;

    let completed = 0;
    const total = this.blueprints.length;

    // Track which blueprint IDs have been executed so steering scouts
    // added mid-execution don't get run twice (the async generator reads
    // blueprints.length dynamically and would pick them up).
    const executedIds = new Set<string>();

    for await (const result of executeScoutBatch(
      this.client,
      this.blueprints,
      batchSize,
      delayMs,
      this.onStream,
      this.prompts.scout
    )) {
      // Check for cancellation
      if (this.isCancelled || this.qc.isKilled()) {
        break;
      }

      // Check if execution is paused (steering)
      while (this.steeringEngine.isExecutionPaused() && !this.isCancelled) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Mark this scout as executed
      executedIds.add(result.agentId);

      // Check if this scout's domain was killed via steering
      const blueprint = this.blueprints.find((b) => b.id === result.agentId);
      if (blueprint && this.steeringEngine.shouldKillScout(blueprint)) {
        log.info('Scout skipped by steering engine', { agentId: result.agentId });
        if (this.hierarchy) {
          this.hierarchy.completedAgents++;
        }
        completed++;
        continue;
      }

      // Collect findings
      this.allFindings.push(...result.findings);

      // Update cost tracker with accurate input/output token counts
      this.queue.updateCost('haiku', result.inputTokens, result.outputTokens);
      this.queue.updateCost('brave', undefined, undefined, result.searchesExecuted);

      // Update hierarchy
      if (this.hierarchy) {
        this.hierarchy.completedAgents++;
      }

      completed++;

      // Record scout performance (non-blocking)
      if (blueprint) {
        recordScoutPerformance(
          this.context.userId,
          this.context.sessionId,
          this.context.mode || 'strategy',
          blueprint,
          result.findings,
          {
            executionTimeMs: result.executionTime || 0,
            tokensUsed: result.tokensUsed,
            costIncurred: 0, // Calculated by queue
            searchesExecuted: result.searchesExecuted,
            pagesVisited: 0,
            screenshotsTaken: 0,
            toolCallsTotal: result.searchesExecuted,
            toolCallsSucceeded: result.searchesExecuted,
            toolCallsFailed: 0,
          },
          result.findings.length > 0 ? 'complete' : 'failed',
          undefined,
          result.childSuggestions?.length || 0,
          result.gaps,
          this.context.problem?.synthesizedProblem.complexity
        ).catch((err) => {
          log.warn('Failed to record scout performance', { error: err });
        });
      }

      // Emit progress
      this.emit('agent_complete', `Scout ${completed}/${total} complete`, {
        completedAgents: completed,
        totalAgents: total,
        progress: Math.round((completed / total) * 100),
      });

      // Periodic quality check (every 10 agents)
      if (completed % 10 === 0) {
        const qcResult = await this.qc.runCheck(
          this.queue.getCost(),
          completed,
          total,
          this.hierarchy?.failedAgents || 0,
          this.allFindings
        );

        if (qcResult.action === 'kill') {
          this.queue.kill(qcResult.recommendation);
          break;
        }
      }

      // Handle child spawning (recursive agents)
      if (result.needsDeeper && result.childSuggestions.length > 0) {
        await this.handleChildSpawning(result);
      }
    }

    // Execute any steering scouts that weren't picked up by the main batch.
    // The generator reads blueprints.length dynamically, so most steering
    // scouts get executed in the main loop. This catches any stragglers
    // added after the loop exited (e.g., during QC checks).
    const unexecutedSteering = this.blueprints.filter(
      (b) => b.id.startsWith('scout_steer_') && !executedIds.has(b.id)
    );

    if (unexecutedSteering.length > 0) {
      this.emit(
        'agent_spawned',
        `Executing ${unexecutedSteering.length} user-requested scouts...`,
        { totalAgents: unexecutedSteering.length }
      );

      for await (const result of executeScoutBatch(
        this.client,
        unexecutedSteering,
        batchSize,
        delayMs,
        this.onStream,
        this.prompts.scout
      )) {
        if (this.isCancelled || this.qc.isKilled()) break;
        this.allFindings.push(...result.findings);
        // Update cost tracker with accurate input/output token counts
        this.queue.updateCost('haiku', result.inputTokens, result.outputTokens);
        this.queue.updateCost('brave', undefined, undefined, result.searchesExecuted);
        if (this.hierarchy) {
          this.hierarchy.completedAgents++;
        }
      }
    }
  }

  /**
   * Handle spawning child agents
   */
  private async handleChildSpawning(parentResult: {
    agentId: string;
    childSuggestions: Partial<AgentBlueprint>[];
  }): Promise<void> {
    const parent = this.blueprints.find((b) => b.id === parentResult.agentId);
    if (!parent || !parent.canSpawnChildren) return;

    const childCount = Math.min(
      parentResult.childSuggestions.length,
      parent.maxChildren,
      this.context.limits.maxScouts - this.blueprints.length
    );

    if (childCount <= 0) return;

    log.info('Spawning child agents', { parentId: parent.id, childCount });

    const childBlueprints: AgentBlueprint[] = parentResult.childSuggestions
      .slice(0, childCount)
      .map((suggestion, i) => ({
        id: `${parent.id}_child_${i}`,
        name: String(suggestion.name || `${parent.name} Sub-scout ${i + 1}`),
        role: String(suggestion.role || parent.role),
        expertise: suggestion.expertise || parent.expertise,
        purpose: String(suggestion.purpose || ''),
        keyQuestions: suggestion.keyQuestions || [],
        researchApproach: suggestion.researchApproach || parent.researchApproach,
        dataSources: suggestion.dataSources || parent.dataSources,
        searchQueries: suggestion.searchQueries || [],
        deliverable: String(suggestion.deliverable || 'Research findings'),
        outputFormat: suggestion.outputFormat || parent.outputFormat,
        modelTier: 'haiku',
        priority: parent.priority - 1,
        estimatedSearches: suggestion.searchQueries?.length || 2,
        parentId: parent.id,
        depth: parent.depth + 1,
        canSpawnChildren: parent.depth + 1 < 5, // Max 5 levels deep
        maxChildren: Math.max(0, parent.maxChildren - 1),
      }));

    // Add to blueprints and execute
    this.blueprints.push(...childBlueprints);

    for (const blueprint of childBlueprints) {
      const scout = createScout(this.client, blueprint, this.onStream, this.prompts.scout);
      const result = await scout.execute();
      this.allFindings.push(...result.findings);

      if (this.hierarchy) {
        this.hierarchy.completedAgents++;
        this.hierarchy.totalAgents++;
      }
    }
  }

  // ===========================================================================
  // PRIVATE METHODS - SYNTHESIS
  // ===========================================================================

  /**
   * Synthesize the final strategy using Opus 4.5
   * @param isPartial - Whether this is a partial synthesis due to early termination
   * @param reason - The reason for early termination (if any)
   */
  private async synthesizeFinalStrategy(
    isPartial: boolean = false,
    reason?: string
  ): Promise<StrategyOutput> {
    const problem = this.context.problem!.synthesizedProblem;

    // Group findings by type
    const findingsByType = this.groupFindingsByType();

    // Build the prompt - add partial synthesis note if needed
    let prompt = this.prompts.synthesis
      .replace('{SYNTHESIZED_PROBLEM}', JSON.stringify(problem, null, 2))
      .replace('{ALL_FINDINGS}', JSON.stringify(findingsByType, null, 2))
      .replace('{DOMAIN_REPORTS}', this.buildDomainReports());

    // If partial, add instructions to handle gracefully
    if (isPartial) {
      prompt += `\n\nIMPORTANT: This is a PARTIAL synthesis. The research was stopped early (${reason || 'unknown reason'}).
You have ${this.allFindings.length} findings to work with.
- Be honest about the limited data
- Provide the best recommendation possible with available information
- Clearly note what gaps exist due to incomplete research
- Still give actionable advice - something is better than nothing
- Set confidence levels appropriately lower`;
    }

    const userMessage = isPartial
      ? `The research was interrupted, but we collected ${this.allFindings.length} findings. Please synthesize the best possible strategy recommendation from the available data, being transparent about limitations.`
      : 'Create the final strategy recommendation based on all the research findings.';

    const response = await this.client.messages.create({
      model: CLAUDE_OPUS_45,
      max_tokens: 8192,
      temperature: 0.7,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Update cost
    this.queue.updateCost(
      'opus',
      response.usage?.input_tokens || 0,
      response.usage?.output_tokens || 0
    );

    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Parse the response
    return this.parseFinalStrategy(textContent, problem);
  }

  /**
   * Group findings by type for synthesis
   */
  private groupFindingsByType(): Record<string, Finding[]> {
    const groups: Record<string, Finding[]> = {};

    for (const finding of this.allFindings) {
      if (!groups[finding.type]) {
        groups[finding.type] = [];
      }
      groups[finding.type].push(finding);
    }

    return groups;
  }

  /**
   * Build domain reports from PM findings
   */
  private buildDomainReports(): string {
    if (!this.hierarchy) return 'No domain reports available';

    return this.hierarchy.projectManagers
      .map((pm) => {
        const pmFindings = this.allFindings.filter(
          (f) => this.blueprints.find((b) => b.id === f.agentId)?.parentId === pm.id
        );

        return `## ${pm.domain}\n\n${pmFindings.map((f) => `- ${f.title}: ${f.content}`).join('\n')}`;
      })
      .join('\n\n');
  }

  /**
   * Parse final strategy response
   */
  private parseFinalStrategy(response: string, problem: SynthesizedProblem): StrategyOutput {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

    const cost = this.queue.getCost();

    const metadata = {
      executionTime: this.queue.getElapsedTime() * 1000,
      totalAgents: this.blueprints.length,
      totalSearches: cost.breakdown.brave.queries,
      totalCost: cost.totalCost,
      confidenceScore: this.qc.getState().overallQualityScore,
      completedAt: Date.now(),
      modelUsage: {
        opus: { calls: 3, tokens: cost.breakdown.opus.tokens },
        sonnet: {
          calls: this.hierarchy?.projectManagers.length || 0,
          tokens: cost.breakdown.sonnet.tokens,
        },
        haiku: { calls: this.blueprints.length, tokens: cost.breakdown.haiku.tokens },
      },
      qualityScore: this.qc.getState().overallQualityScore,
    };

    if (!jsonMatch) {
      // Create basic strategy from text
      return {
        id: this.context.sessionId,
        problem,
        recommendation: {
          title: 'Strategy Recommendation',
          summary: response.slice(0, 500),
          confidence: 70,
          reasoning: ['Based on comprehensive research'],
          tradeoffs: [],
          bestFor: 'General guidance',
        },
        alternatives: [],
        analysis: {
          byDomain: [],
          riskAssessment: {
            overallRisk: 'medium',
            risks: [],
            mitigations: [],
          },
        },
        actionPlan: [],
        gaps: [],
        nextSteps: [],
        metadata,
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);

      return {
        id: this.context.sessionId,
        problem,
        recommendation: parsed.recommendation || {
          title: 'Recommendation',
          summary: '',
          confidence: 50,
          reasoning: [],
          tradeoffs: [],
          bestFor: '',
        },
        alternatives: parsed.alternatives || [],
        analysis: parsed.analysis || {
          byDomain: [],
          riskAssessment: { overallRisk: 'medium', risks: [], mitigations: [] },
        },
        actionPlan: parsed.actionPlan || [],
        gaps: parsed.gaps || [],
        nextSteps: parsed.nextSteps || [],
        metadata,
      };
    } catch (error) {
      log.error('Failed to parse final strategy', { error });
      return {
        id: this.context.sessionId,
        problem,
        recommendation: {
          title: 'Strategy Recommendation',
          summary: 'Unable to parse detailed strategy. Please review the findings.',
          confidence: 50,
          reasoning: [],
          tradeoffs: [],
          bestFor: '',
        },
        alternatives: [],
        analysis: {
          byDomain: [],
          riskAssessment: { overallRisk: 'medium', risks: [], mitigations: [] },
        },
        actionPlan: [],
        gaps: ['Strategy parsing failed'],
        nextSteps: ['Review individual findings'],
        metadata,
      };
    }
  }

  // ===========================================================================
  // PRIVATE METHODS - UTILITIES
  // ===========================================================================

  /**
   * Get current phase name
   */
  private getCurrentPhase(): string {
    if (!this.context.problem) return 'intake';
    if (!this.hierarchy) return 'designing';
    if (this.hierarchy.completedAgents < this.hierarchy.totalAgents) return 'researching';
    return 'synthesizing';
  }

  /**
   * Calculate overall progress
   */
  private calculateOverallProgress(): number {
    const phase = this.getCurrentPhase();

    switch (phase) {
      case 'intake':
        return 10;
      case 'designing':
        return 20;
      case 'researching':
        if (!this.hierarchy) return 25;
        return 25 + (this.hierarchy.completedAgents / this.hierarchy.totalAgents) * 60;
      case 'synthesizing':
        return 90;
      default:
        return 0;
    }
  }

  /**
   * Emit stream event
   */
  private emit(
    type: StrategyStreamEvent['type'],
    message: string,
    data?: StrategyStreamEvent['data']
  ): void {
    if (this.onStream) {
      this.onStream({
        type,
        message,
        timestamp: Date.now(),
        data,
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createStrategyAgent(
  apiKey: string,
  context: Partial<StrategyContext>,
  onStream?: StrategyStreamCallback
): StrategyAgent {
  return new StrategyAgent(apiKey, context, onStream);
}
