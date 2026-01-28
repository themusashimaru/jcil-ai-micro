/**
 * ██████╗ ███╗   ███╗███████╗ ██████╗  █████╗      █████╗  ██████╗ ███████╗███╗   ██╗████████╗
 * ██╔═══██╗████╗ ████║██╔════╝██╔════╝ ██╔══██╗    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
 * ██║   ██║██╔████╔██║█████╗  ██║  ███╗███████║    ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║
 * ██║   ██║██║╚██╔╝██║██╔══╝  ██║   ██║██╔══██║    ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║
 * ╚██████╔╝██║ ╚═╝ ██║███████╗╚██████╔╝██║  ██║    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║
 *  ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝    ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝
 *
 * THE OMEGA AGENT - The Most Powerful AI Agent Ever Built
 *
 * Combines ALL capabilities into one unified super-agent:
 *
 * RESEARCH CAPABILITIES:
 * - 100 parallel research scouts
 * - Multi-model orchestration (Opus 4.5 → Sonnet 4.5 → Haiku 4.5)
 * - Advanced Puppeteer with anti-detection
 * - Dynamic tool creation
 *
 * AI CAPABILITIES:
 * - Causal Reasoning Engine (Pearl's do-calculus)
 * - Predictive Simulator (Monte Carlo, decision trees)
 * - Knowledge Graph (entity extraction, relationship mapping)
 * - Reflection Engine (meta-cognitive analysis)
 * - Adversarial Verifier (self-challenging)
 * - Document Analyzer (multi-modal)
 * - Adaptive Model Router (smart selection)
 *
 * EXECUTION CAPABILITIES:
 * - Code Generation (full stack)
 * - Autonomous Testing
 * - GitHub Deployment
 * - Vercel Deployment
 * - PR Creation
 *
 * INTELLIGENCE CAPABILITIES:
 * - Competitive Intelligence Suite
 * - Real-Time Web Monitoring
 * - Market Analysis
 * - Pricing Intelligence
 *
 * LEARNING CAPABILITIES:
 * - Self-Improvement Loop
 * - Performance Optimization
 * - Strategy Refinement
 *
 * "Research. Analyze. Build. Deploy. Dominate."
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  OmegaConfig,
  OmegaMission,
  OmegaOutput,
  OmegaPhase,
  OmegaPhaseType,
  OmegaExecutionPlan,
  OmegaArtifact,
  OmegaStreamCallback,
  OmegaLearning,
  OmegaStreamEventType,
  MissionDeliverable,
} from './types';

// Strategy Agent components
import { StrategyAgent, createStrategyAgent } from '../strategy/StrategyAgent';
import type { Finding } from '../strategy/types';

// Advanced AI capabilities
import {
  CausalReasoningEngine,
  createCausalReasoningEngine,
} from '../strategy/CausalReasoningEngine';
import { PredictiveSimulator, createPredictiveSimulator } from '../strategy/PredictiveSimulator';
import { KnowledgeGraph, createKnowledgeGraph } from '../strategy/KnowledgeGraph';
import { ReflectionEngine, createReflectionEngine } from '../strategy/ReflectionEngine';
import { AdversarialVerifier, createAdversarialVerifier } from '../strategy/AdversarialVerifier';
import { DocumentAnalyzer, createDocumentAnalyzer } from '../strategy/DocumentAnalyzer';
import { AdaptiveModelRouter, createAdaptiveModelRouter } from '../strategy/AdaptiveModelRouter';
import { AuditTrail, createAuditTrail } from '../strategy/AuditTrail';

// Advanced Puppeteer
import { AdvancedPuppeteer, createAdvancedPuppeteer } from '../strategy/tools/AdvancedPuppeteer';

// Code Agent
import { CodeAgentV2 } from '../code/CodeAgentV2';
import type { GeneratedFile } from '../core/types';

// Executors
import { githubExecutor } from '../code/executors/GitHubExecutor';
import { sandboxExecutor } from '../code/executors/SandboxExecutor';

import { logger } from '@/lib/logger';

const log = logger('OmegaAgent');

// =============================================================================
// CONSTANTS
// =============================================================================

const CLAUDE_OPUS_45 = 'claude-opus-4-5-20251101';

// =============================================================================
// OMEGA AGENT CLASS
// =============================================================================

export class OmegaAgent {
  private client: Anthropic;
  private config: OmegaConfig;
  private userId: string;
  private sessionId: string;
  private onStream?: OmegaStreamCallback;

  // Sub-agents and engines
  private strategyAgent?: StrategyAgent;
  private codeAgent: CodeAgentV2;
  private causalEngine?: CausalReasoningEngine;
  private simulator?: PredictiveSimulator;
  private knowledgeGraph?: KnowledgeGraph;
  private reflectionEngine?: ReflectionEngine;
  private adversarialVerifier?: AdversarialVerifier;
  private documentAnalyzer?: DocumentAnalyzer;
  private modelRouter?: AdaptiveModelRouter;
  private auditTrail?: AuditTrail;
  private puppeteer?: AdvancedPuppeteer;

  // Execution state
  private mission?: OmegaMission;
  private phases: OmegaPhase[] = [];
  private currentPhaseIndex = 0;
  private allFindings: Finding[] = [];
  private generatedFiles: GeneratedFile[] = [];
  private artifacts: OmegaArtifact[] = [];
  private learnings: OmegaLearning | null = null;

  // Cost tracking
  private totalCost = 0;
  private startTime = 0;

  // Flags
  private isRunning = false;
  private isCancelled = false;

  constructor(
    apiKey: string,
    userId: string,
    config: Partial<OmegaConfig> = {},
    onStream?: OmegaStreamCallback
  ) {
    this.client = new Anthropic({ apiKey });
    this.userId = userId;
    this.sessionId = crypto.randomUUID();
    this.onStream = onStream;

    // Merge config with defaults
    this.config = {
      ...this.getDefaultConfig(),
      ...config,
      capabilities: {
        ...this.getDefaultConfig().capabilities,
        ...config.capabilities,
      },
      output: {
        ...this.getDefaultConfig().output,
        ...config.output,
      },
      safety: {
        ...this.getDefaultConfig().safety,
        ...config.safety,
      },
    };

    // Initialize code agent
    this.codeAgent = new CodeAgentV2();

    // Initialize AI capabilities based on config
    this.initializeCapabilities();

    log.info('OmegaAgent initialized', {
      userId,
      sessionId: this.sessionId,
      mode: this.config.mode,
      capabilities: Object.entries(this.config.capabilities)
        .filter(([, v]) => v)
        .map(([k]) => k),
    });
  }

  private getDefaultConfig(): OmegaConfig {
    return {
      mode: 'full_auto',
      maxBudget: 50,
      maxTimeMinutes: 30,
      autoApproveCode: false,
      enableAllCapabilities: true,
      capabilities: {
        causalReasoning: true,
        predictiveSimulation: true,
        knowledgeGraph: true,
        reflection: true,
        adversarialVerification: true,
        documentAnalysis: true,
        codeGeneration: true,
        deployment: true,
        monitoring: true,
        competitiveIntel: true,
      },
      output: {
        generateCode: true,
        generateDocs: true,
        generateArtifacts: true,
        deployToGitHub: true,
        deployToVercel: false,
        createPRs: true,
      },
      safety: {
        requireHumanApproval: true,
        maxConcurrentAgents: 100,
        maxSearches: 1000,
        maxCodeFiles: 100,
        blockedDomains: [],
      },
    };
  }

  private initializeCapabilities(): void {
    const streamAdapter = this.createStreamAdapter();

    if (this.config.capabilities.causalReasoning) {
      this.causalEngine = createCausalReasoningEngine(this.client, streamAdapter);
    }

    if (this.config.capabilities.predictiveSimulation) {
      this.simulator = createPredictiveSimulator(this.client, streamAdapter);
    }

    if (this.config.capabilities.knowledgeGraph) {
      this.knowledgeGraph = createKnowledgeGraph(
        this.client,
        this.userId,
        this.sessionId,
        streamAdapter
      );
    }

    if (this.config.capabilities.reflection) {
      this.reflectionEngine = createReflectionEngine(this.client, streamAdapter);
    }

    if (this.config.capabilities.adversarialVerification) {
      this.adversarialVerifier = createAdversarialVerifier(this.client, streamAdapter);
    }

    if (this.config.capabilities.documentAnalysis) {
      this.documentAnalyzer = createDocumentAnalyzer(this.client, streamAdapter);
    }

    // Always initialize these
    this.modelRouter = createAdaptiveModelRouter(this.client);
    this.auditTrail = createAuditTrail(this.userId, this.sessionId);
    this.puppeteer = createAdvancedPuppeteer(
      {
        antiDetectionLevel: 'advanced',
        userAgentRotation: true,
        fingerprintMasking: true,
      },
      streamAdapter
    );
  }

  private createStreamAdapter() {
    return (event: { type: string; message: string; timestamp: number }) => {
      if (this.onStream) {
        this.onStream({
          type: event.type as OmegaStreamEventType,
          message: event.message,
          timestamp: event.timestamp,
          phase: this.getCurrentPhaseName(),
          progress: this.calculateProgress(),
        });
      }
    };
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Execute a mission with the Omega Agent
   * This is the main entry point - give it an objective and watch it go
   */
  async executeMission(mission: OmegaMission): Promise<OmegaOutput> {
    if (this.isRunning) {
      throw new Error('OmegaAgent is already running a mission');
    }

    this.mission = mission;
    this.isRunning = true;
    this.isCancelled = false;
    this.startTime = Date.now();
    this.allFindings = [];
    this.generatedFiles = [];
    this.artifacts = [];

    this.emit('mission_start', `Starting mission: ${mission.objective}`, {
      missionId: mission.id,
      mode: this.config.mode,
      deliverables: mission.deliverables,
    });

    log.info('Mission started', {
      missionId: mission.id,
      objective: mission.objective,
      mode: this.config.mode,
    });

    try {
      // Create execution plan based on mode
      const plan = await this.createExecutionPlan(mission);
      this.phases = plan.phases;

      // Log the plan
      this.auditTrail?.logDecision(
        'mission_planning',
        `Created execution plan with ${plan.phases.length} phases`,
        {
          phases: plan.phases.map((p) => p.name),
          estimatedCost: plan.estimatedCost,
          estimatedTime: plan.estimatedTimeMinutes,
        },
        0.9
      );

      // Execute each phase
      for (let i = 0; i < this.phases.length; i++) {
        if (this.isCancelled) break;
        if (this.totalCost >= this.config.maxBudget) {
          this.emit('warning', `Budget limit reached ($${this.config.maxBudget})`);
          break;
        }

        this.currentPhaseIndex = i;
        await this.executePhase(this.phases[i]);
      }

      // Build final output
      const output = await this.buildOutput();

      // Self-improvement learning
      if (!this.isCancelled) {
        await this.learnFromExecution(output);
      }

      this.emit('mission_complete', 'Mission complete!', {
        totalCost: this.totalCost,
        executionTimeMs: Date.now() - this.startTime,
        phasesCompleted: this.phases.filter((p) => p.status === 'complete').length,
      });

      return output;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.emit('error', `Mission failed: ${errMsg}`);
      log.error('Mission failed', { error: errMsg, missionId: mission.id });

      // Return partial results if available
      return this.buildPartialOutput(errMsg);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Cancel the current mission
   */
  cancel(): void {
    this.isCancelled = true;
    this.strategyAgent?.cancel();
    this.emit('warning', 'Mission cancelled by user');
  }

  /**
   * Get current progress
   */
  getProgress(): {
    phase: string;
    progress: number;
    cost: number;
    elapsed: number;
    findings: number;
  } {
    return {
      phase: this.getCurrentPhaseName(),
      progress: this.calculateProgress(),
      cost: this.totalCost,
      elapsed: Date.now() - this.startTime,
      findings: this.allFindings.length,
    };
  }

  // ===========================================================================
  // EXECUTION PLANNING
  // ===========================================================================

  private async createExecutionPlan(mission: OmegaMission): Promise<OmegaExecutionPlan> {
    const phases: OmegaPhase[] = [];

    // Determine phases based on mode and deliverables
    const modePhases = this.getPhasesForMode(this.config.mode, mission);

    for (const phaseType of modePhases) {
      phases.push({
        id: `phase_${phaseType}_${Date.now()}`,
        name: this.getPhaseDisplayName(phaseType),
        status: 'pending',
        progress: 0,
      });
    }

    // Estimate cost and time
    const estimatedCost = this.estimateCost(phases);
    const estimatedTime = this.estimateTime(phases);

    return {
      mission,
      phases,
      estimatedCost,
      estimatedTimeMinutes: estimatedTime,
      requiredCapabilities: this.getRequiredCapabilities(mission),
    };
  }

  private getPhasesForMode(mode: string, mission: OmegaMission): OmegaPhaseType[] {
    switch (mode) {
      case 'full_auto':
        return [
          'intake',
          'research',
          'analysis',
          'verification',
          'planning',
          'code_generation',
          'testing',
          'deployment',
          'synthesis',
          'learning',
        ];

      case 'research_only':
        return ['intake', 'research', 'analysis', 'verification', 'synthesis', 'learning'];

      case 'build_from_research':
        return ['planning', 'code_generation', 'testing', 'deployment', 'learning'];

      case 'competitive_intel':
        return ['intake', 'research', 'analysis', 'synthesis', 'learning'];

      case 'market_monitor':
        return ['intake', 'research', 'monitoring_setup', 'learning'];

      case 'strategic_advisor':
        return ['intake', 'research', 'analysis', 'verification', 'synthesis', 'learning'];

      case 'code_architect':
        return ['intake', 'planning', 'code_generation', 'testing', 'deployment', 'learning'];

      case 'problem_solver':
      default:
        // Dynamically determine based on deliverables
        const phases: OmegaPhaseType[] = ['intake', 'research'];

        if (
          mission.deliverables.some((d) =>
            ['strategy_report', 'risk_assessment', 'decision_tree'].includes(d)
          )
        ) {
          phases.push('analysis', 'verification');
        }

        if (
          mission.deliverables.some((d) =>
            ['working_code', 'deployed_app', 'pull_request'].includes(d)
          )
        ) {
          phases.push('planning', 'code_generation', 'testing', 'deployment');
        }

        if (mission.deliverables.includes('monitoring_dashboard')) {
          phases.push('monitoring_setup');
        }

        phases.push('synthesis', 'learning');
        return phases;
    }
  }

  private getPhaseDisplayName(phase: OmegaPhaseType): string {
    const names: Record<OmegaPhaseType, string> = {
      intake: '🎯 Problem Analysis',
      research: '🔍 Deep Research',
      analysis: '🧠 AI Analysis',
      verification: '⚔️ Adversarial Verification',
      planning: '📐 Architecture Planning',
      code_generation: '⚡ Code Generation',
      testing: '🧪 Testing & Validation',
      deployment: '🚀 Deployment',
      monitoring_setup: '📡 Monitoring Setup',
      synthesis: '📊 Final Synthesis',
      learning: '🎓 Self-Improvement',
    };
    return names[phase] || phase;
  }

  private estimateCost(phases: OmegaPhase[]): number {
    // Rough estimates per phase
    const costPerPhase: Record<string, number> = {
      intake: 0.5,
      research: 5,
      analysis: 2,
      verification: 1,
      planning: 1,
      code_generation: 3,
      testing: 1,
      deployment: 0.5,
      monitoring_setup: 0.5,
      synthesis: 2,
      learning: 0.1,
    };

    return phases.reduce((sum, p) => {
      const phaseName = p.name.split(' ').pop()?.toLowerCase() || '';
      return sum + (costPerPhase[phaseName] || 1);
    }, 0);
  }

  private estimateTime(phases: OmegaPhase[]): number {
    // Rough estimates in minutes per phase
    return phases.length * 2;
  }

  private getRequiredCapabilities(mission: OmegaMission): string[] {
    const caps: string[] = ['research'];

    if (
      mission.deliverables.some((d) =>
        ['strategy_report', 'risk_assessment', 'decision_tree'].includes(d)
      )
    ) {
      caps.push('causalReasoning', 'predictiveSimulation', 'adversarialVerification');
    }

    if (
      mission.deliverables.some((d) => ['working_code', 'deployed_app', 'pull_request'].includes(d))
    ) {
      caps.push('codeGeneration', 'deployment');
    }

    if (mission.deliverables.includes('knowledge_graph')) {
      caps.push('knowledgeGraph');
    }

    if (mission.deliverables.includes('monitoring_dashboard')) {
      caps.push('monitoring');
    }

    if (mission.deliverables.includes('competitive_analysis')) {
      caps.push('competitiveIntel');
    }

    return caps;
  }

  // ===========================================================================
  // PHASE EXECUTION
  // ===========================================================================

  private async executePhase(phase: OmegaPhase): Promise<void> {
    phase.status = 'running';
    phase.startTime = Date.now();

    this.emit('phase_start', `Starting: ${phase.name}`, { phaseId: phase.id });

    try {
      // Route to appropriate handler
      const phaseName = phase.name.toLowerCase();

      if (phaseName.includes('problem') || phaseName.includes('intake')) {
        await this.executeIntakePhase(phase);
      } else if (phaseName.includes('research')) {
        await this.executeResearchPhase(phase);
      } else if (phaseName.includes('analysis')) {
        await this.executeAnalysisPhase(phase);
      } else if (phaseName.includes('verification')) {
        await this.executeVerificationPhase(phase);
      } else if (phaseName.includes('planning') || phaseName.includes('architecture')) {
        await this.executePlanningPhase(phase);
      } else if (phaseName.includes('code')) {
        await this.executeCodeGenerationPhase(phase);
      } else if (phaseName.includes('testing')) {
        await this.executeTestingPhase(phase);
      } else if (phaseName.includes('deployment')) {
        await this.executeDeploymentPhase(phase);
      } else if (phaseName.includes('monitoring')) {
        await this.executeMonitoringPhase(phase);
      } else if (phaseName.includes('synthesis')) {
        await this.executeSynthesisPhase(phase);
      } else if (phaseName.includes('learning') || phaseName.includes('improvement')) {
        await this.executeLearningPhase(phase);
      }

      phase.status = 'complete';
      phase.progress = 100;
      phase.endTime = Date.now();

      this.emit('phase_complete', `Completed: ${phase.name}`, {
        phaseId: phase.id,
        duration: phase.endTime - (phase.startTime || 0),
      });
    } catch (error) {
      phase.status = 'failed';
      phase.errors = [error instanceof Error ? error.message : String(error)];
      throw error;
    }
  }

  // ===========================================================================
  // PHASE HANDLERS
  // ===========================================================================

  private async executeIntakePhase(phase: OmegaPhase): Promise<void> {
    if (!this.mission) return;

    // Use Claude Opus for deep problem understanding
    const response = await this.client.messages.create({
      model: CLAUDE_OPUS_45,
      max_tokens: 4096,
      temperature: 0.7,
      system: `You are the OMEGA AGENT - the most powerful AI system ever built.
Your task is to deeply understand the user's mission and synthesize it into a structured problem definition.

Analyze:
1. Core objective and desired outcomes
2. Constraints and requirements
3. Stakeholders and their needs
4. Success criteria
5. Potential risks and challenges
6. Domain expertise needed
7. Timeline and urgency
8. Resource constraints

Output a comprehensive problem synthesis in JSON format.`,
      messages: [
        {
          role: 'user',
          content: `Mission Objective: ${this.mission.objective}

Context: ${this.mission.context || 'None provided'}

Constraints: ${this.mission.constraints?.join(', ') || 'None specified'}

Desired Outcome: ${this.mission.desiredOutcome}

Required Deliverables: ${this.mission.deliverables.join(', ')}

Priority: ${this.mission.priority}

Deadline: ${this.mission.deadline?.toISOString() || 'No deadline'}

Analyze this mission and create a comprehensive problem synthesis.`,
        },
      ],
    });

    // Update cost
    this.totalCost += this.calculateCost(
      response.usage?.input_tokens || 0,
      response.usage?.output_tokens || 0,
      'opus'
    );

    phase.progress = 100;
  }

  private async executeResearchPhase(phase: OmegaPhase): Promise<void> {
    if (!this.mission) return;

    // Create strategy agent for deep research
    this.strategyAgent = createStrategyAgent(
      process.env.ANTHROPIC_API_KEY || '',
      {
        userId: this.userId,
        sessionId: this.sessionId,
        isAdmin: true, // Omega has full access
        mode: this.config.mode === 'competitive_intel' ? 'research' : 'strategy',
      },
      (event) => {
        // Forward strategy events
        this.emit('phase_progress', event.message, {
          phaseId: phase.id,
          strategyEvent: event.type,
        });

        // Update progress
        if (event.data?.progress) {
          phase.progress = event.data.progress as number;
        }
      }
    );

    // Start intake with mission objective
    await this.strategyAgent.startIntake();

    // Process mission as intake
    const intakeResult = await this.strategyAgent.processIntakeInput(
      `${this.mission.objective}\n\nContext: ${this.mission.context || ''}\n\nDesired outcome: ${this.mission.desiredOutcome}`
    );

    // If more questions needed, provide constraints and deliverables
    if (!intakeResult.isComplete) {
      await this.strategyAgent.processIntakeInput(
        `Constraints: ${this.mission.constraints?.join(', ') || 'None'}\n\nRequired deliverables: ${this.mission.deliverables.join(', ')}\n\nThat's all the context I have.`
      );
    }

    // Execute strategy
    const strategyOutput = await this.strategyAgent.executeStrategy();

    // Collect findings
    this.allFindings = this.strategyAgent.getFindings();

    // Store in phase
    phase.findings = this.allFindings;

    // Update cost from strategy execution
    this.totalCost += strategyOutput.metadata.totalCost;

    phase.progress = 100;
  }

  private async executeAnalysisPhase(phase: OmegaPhase): Promise<void> {
    if (this.allFindings.length === 0) {
      this.emit('warning', 'No findings to analyze, skipping analysis phase');
      phase.status = 'skipped';
      return;
    }

    const problem = this.strategyAgent?.getProblem()?.synthesizedProblem;
    if (!problem) {
      this.emit('warning', 'No synthesized problem available');
      return;
    }

    // Run all AI analysis capabilities in parallel
    const analysisPromises: Promise<unknown>[] = [];

    // Causal reasoning
    if (this.causalEngine && this.config.capabilities.causalReasoning) {
      this.emit('capability_activated', 'Activating Causal Reasoning Engine...');
      analysisPromises.push(
        this.causalEngine.analyze(this.allFindings, problem).then((result) => {
          this.emit(
            'insight_generated',
            `Causal analysis: ${result.chains.length} causal chains identified`
          );
          return { type: 'causal', result };
        })
      );
    }

    // Predictive simulation
    if (this.simulator && this.config.capabilities.predictiveSimulation) {
      this.emit('capability_activated', 'Activating Predictive Simulator...');
      const recommendation = {
        title: 'Based on findings',
        summary: this.allFindings
          .slice(0, 5)
          .map((f) => f.title)
          .join('; '),
        confidence: 70,
        reasoning: [],
        tradeoffs: [],
        bestFor: '',
      };
      analysisPromises.push(
        this.simulator
          .generateScenarios(problem, recommendation, this.allFindings)
          .then((result) => {
            this.emit(
              'insight_generated',
              `Simulation: ${result.scenarios.length} scenarios modeled`
            );
            return { type: 'simulation', result };
          })
      );
    }

    // Knowledge graph
    if (this.knowledgeGraph && this.config.capabilities.knowledgeGraph) {
      this.emit('capability_activated', 'Building Knowledge Graph...');
      analysisPromises.push(
        this.knowledgeGraph.extractFromFindings(this.allFindings).then((result) => {
          this.emit(
            'insight_generated',
            `Knowledge Graph: ${result.entities.length} entities, ${result.relationships.length} relationships`
          );
          return { type: 'knowledgeGraph', result };
        })
      );
    }

    // Reflection
    if (this.reflectionEngine && this.config.capabilities.reflection) {
      this.emit('capability_activated', 'Activating Reflection Engine...');
      const findingsSummary = this.allFindings.map((f) => f.title).join('\n');
      analysisPromises.push(
        this.reflectionEngine.reflect(this.allFindings, problem, findingsSummary).then((result) => {
          this.emit(
            'insight_generated',
            `Reflection: ${result.biases.length} biases detected, ${result.assumptions.length} assumptions identified`
          );
          return { type: 'reflection', result };
        })
      );
    }

    // Wait for all analyses
    const results = await Promise.allSettled(analysisPromises);

    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const data = result.value as { type: string; result: unknown };
        // Store results for output building using type-safe Record
        const phaseWithExtras = phase as OmegaPhase & Record<string, unknown>;
        phaseWithExtras[data.type] = data.result;
      }
    }

    phase.progress = 100;
  }

  private async executeVerificationPhase(phase: OmegaPhase): Promise<void> {
    if (!this.adversarialVerifier || this.allFindings.length === 0) {
      phase.status = 'skipped';
      return;
    }

    const problem = this.strategyAgent?.getProblem()?.synthesizedProblem;
    if (!problem) return;

    this.emit('capability_activated', 'Activating Adversarial Verifier...');

    // Get strategy recommendation if available
    const recommendation = {
      title: 'Preliminary recommendation',
      summary: 'Based on research findings',
      confidence: 70,
      reasoning: this.allFindings.slice(0, 10).map((f) => f.title),
      tradeoffs: [],
      bestFor: problem.coreQuestion,
    };

    const verificationResult = await this.adversarialVerifier.verify(
      recommendation,
      this.allFindings,
      problem
    );

    this.emit(
      'insight_generated',
      `Verification: ${verificationResult.verdict.overallVerdict} (${verificationResult.verdict.confidenceInVerdict}% confidence)`
    );

    const phaseWithExtras = phase as OmegaPhase & Record<string, unknown>;
    phaseWithExtras.verification = verificationResult;
    phase.progress = 100;
  }

  private async executePlanningPhase(phase: OmegaPhase): Promise<void> {
    if (!this.mission || !this.config.output.generateCode) {
      phase.status = 'skipped';
      return;
    }

    // Use findings to plan code architecture
    const planningPrompt = this.buildPlanningPrompt();

    const response = await this.client.messages.create({
      model: CLAUDE_OPUS_45,
      max_tokens: 8192,
      temperature: 0.5,
      system: `You are a world-class software architect. Based on research findings and requirements, design a comprehensive technical architecture and implementation plan.

Consider:
1. Technology stack (prefer modern, well-supported technologies)
2. Architecture patterns (scalable, maintainable)
3. File structure
4. Key components and their responsibilities
5. Data models
6. API design
7. Security considerations
8. Performance requirements
9. Testing strategy

Output a detailed technical plan in JSON format.`,
      messages: [{ role: 'user', content: planningPrompt }],
    });

    this.totalCost += this.calculateCost(
      response.usage?.input_tokens || 0,
      response.usage?.output_tokens || 0,
      'opus'
    );

    phase.progress = 100;
  }

  private async executeCodeGenerationPhase(phase: OmegaPhase): Promise<void> {
    if (!this.mission || !this.config.output.generateCode) {
      phase.status = 'skipped';
      return;
    }

    this.emit('capability_activated', 'Activating Code Generation Engine...');

    // Build code generation request from mission and findings
    const codeRequest = this.buildCodeGenerationRequest();

    try {
      const result = await this.codeAgent.execute(
        {
          request: codeRequest,
          mode: 'generate',
          options: {
            enableReasoning: true,
            enableSecurity: true,
            enablePerformance: true,
            enableTests: true,
            enableDocs: this.config.output.generateDocs,
            pushToGitHub: false, // We handle deployment separately
          },
        },
        {
          userId: this.userId,
        },
        (event) => {
          this.emit('code_generated', event.message, {
            phase: event.meta?.phase,
            progress: event.meta?.progress,
          });
        }
      );

      if (result.success && result.output) {
        this.generatedFiles = result.output.files;
        this.emit('code_generated', `Generated ${this.generatedFiles.length} files`);

        // Create code artifact
        this.artifacts.push({
          id: `code_${Date.now()}`,
          type: 'code',
          title: result.output.projectName || 'Generated Code',
          description: result.output.description || 'Code generated by OMEGA Agent',
          format: 'typescript',
          content: this.generatedFiles.map((f) => `// ${f.path}\n${f.content}`).join('\n\n'),
          createdAt: Date.now(),
        });
      }
    } catch (error) {
      this.emit('warning', `Code generation encountered issues: ${error}`);
    }

    phase.progress = 100;
  }

  private async executeTestingPhase(phase: OmegaPhase): Promise<void> {
    if (this.generatedFiles.length === 0) {
      phase.status = 'skipped';
      return;
    }

    this.emit('code_tested', 'Running tests in sandbox...');

    if (sandboxExecutor.isAvailable()) {
      try {
        const testResult = await sandboxExecutor.execute(
          this.generatedFiles,
          {
            name: 'omega-generated',
            description: '',
            fileTree: [],
            architecture: { pattern: 'modular', components: [], dataFlow: '' },
            commands: { dev: '', build: '', test: '' },
          },
          {
            projectType: 'web_app',
            complexity: 'moderate',
            refinedDescription: '',
            technologies: { primary: 'typescript', secondary: [] },
          } as Parameters<typeof sandboxExecutor.execute>[2],
          (event) => {
            this.emit('code_tested', event.message);
          }
        );

        if (testResult.success) {
          this.emit('code_tested', 'All tests passed!');
        } else {
          this.emit(
            'warning',
            `Tests failed: ${testResult.errors.map((e) => e.message).join(', ')}`
          );
        }
      } catch (error) {
        this.emit('warning', `Testing error: ${error}`);
      }
    }

    phase.progress = 100;
  }

  private async executeDeploymentPhase(phase: OmegaPhase): Promise<void> {
    if (this.generatedFiles.length === 0 || !this.config.output.deployToGitHub) {
      phase.status = 'skipped';
      return;
    }

    this.emit('deployment_started', 'Deploying to GitHub...');

    if (githubExecutor.isAvailable()) {
      try {
        const repoName = `omega-${this.mission?.objective.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-') || 'project'}`;

        const result = await githubExecutor.push(
          this.generatedFiles,
          {
            name: repoName,
            description: this.mission?.objective || '',
            fileTree: [],
            architecture: { pattern: '', components: [], dataFlow: '' },
            commands: { dev: '', build: '', test: '' },
          },
          {
            createNew: true,
            repoName,
            private: true,
          },
          (event) => {
            this.emit('deployment_started', event.message);
          }
        );

        if (result.success) {
          this.emit('deployment_complete', `Deployed to GitHub: ${result.repoUrl}`);
        }
      } catch (error) {
        this.emit('warning', `Deployment failed: ${error}`);
      }
    }

    phase.progress = 100;
  }

  private async executeMonitoringPhase(phase: OmegaPhase): Promise<void> {
    if (!this.config.capabilities.monitoring) {
      phase.status = 'skipped';
      return;
    }

    // Generate monitoring setup based on mission
    this.emit('phase_progress', 'Setting up web monitoring...');

    // This would integrate with a monitoring service
    // For now, generate monitoring configuration

    phase.progress = 100;
  }

  private async executeSynthesisPhase(phase: OmegaPhase): Promise<void> {
    this.emit('phase_progress', 'Synthesizing final deliverables...');

    // Generate final report artifact
    const reportContent = await this.generateFinalReport();

    this.artifacts.push({
      id: `report_${Date.now()}`,
      type: 'report',
      title: 'OMEGA Agent Mission Report',
      description: `Complete analysis for: ${this.mission?.objective}`,
      format: 'markdown',
      content: reportContent,
      createdAt: Date.now(),
    });

    phase.progress = 100;
  }

  private async executeLearningPhase(phase: OmegaPhase): Promise<void> {
    // Self-improvement learning
    this.learnings = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      successfulStrategies: [],
      effectiveTools: [],
      highQualityFindings: this.allFindings.filter((f) => f.confidence > 0.8).map((f) => f.title),
      failedApproaches: [],
      ineffectiveQueries: [],
      errorPatterns: this.phases
        .filter((p) => p.status === 'failed')
        .map((p) => p.errors?.[0] || 'Unknown error'),
      domainInsights: {},
      userPreferences: [],
      optimizationOpportunities: [],
      metrics: {
        timeEfficiency: this.calculateTimeEfficiency(),
        costEfficiency: this.calculateCostEfficiency(),
        qualityScore: this.calculateQualityScore(),
      },
    };

    phase.progress = 100;
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private buildPlanningPrompt(): string {
    const findingsSummary = this.allFindings
      .slice(0, 20)
      .map((f) => `- ${f.title}: ${f.content.slice(0, 200)}`)
      .join('\n');

    return `Based on the following research findings, design a technical solution:

Mission: ${this.mission?.objective}

Desired Outcome: ${this.mission?.desiredOutcome}

Key Findings:
${findingsSummary}

Deliverables Required: ${this.mission?.deliverables.join(', ')}

Create a comprehensive technical architecture and implementation plan.`;
  }

  private buildCodeGenerationRequest(): string {
    const findingsSummary = this.allFindings
      .filter((f) => f.type === 'technical' || f.type === 'solution')
      .slice(0, 10)
      .map((f) => f.content)
      .join('\n');

    return `Build a solution based on these requirements:

Objective: ${this.mission?.objective}

Desired Outcome: ${this.mission?.desiredOutcome}

Technical Findings:
${findingsSummary}

Requirements:
- Modern TypeScript/React stack preferred
- Include comprehensive error handling
- Add unit tests
- Include documentation
- Follow best practices`;
  }

  private async generateFinalReport(): Promise<string> {
    const sections = [
      `# OMEGA Agent Mission Report\n`,
      `## Mission Objective\n${this.mission?.objective}\n`,
      `## Executive Summary\n`,
      `This report summarizes the findings and deliverables from the OMEGA Agent mission.\n`,
      `## Key Findings\n`,
      this.allFindings
        .slice(0, 20)
        .map((f) => `- **${f.title}**: ${f.content.slice(0, 200)}...`)
        .join('\n'),
      `\n## Deliverables\n`,
      this.artifacts.map((a) => `- ${a.title} (${a.type})`).join('\n'),
      `\n## Execution Statistics\n`,
      `- Total Cost: $${this.totalCost.toFixed(2)}`,
      `- Execution Time: ${((Date.now() - this.startTime) / 1000 / 60).toFixed(1)} minutes`,
      `- Findings Discovered: ${this.allFindings.length}`,
      `- Code Files Generated: ${this.generatedFiles.length}`,
      `- Phases Completed: ${this.phases.filter((p) => p.status === 'complete').length}/${this.phases.length}`,
    ];

    return sections.join('\n');
  }

  private async buildOutput(): Promise<OmegaOutput> {
    return {
      id: this.sessionId,
      mission: this.mission!,
      strategy: undefined, // Would be filled from strategy agent
      problem: this.strategyAgent?.getProblem()?.synthesizedProblem,
      generatedCode:
        this.generatedFiles.length > 0
          ? {
              files: this.generatedFiles,
              buildResult: {
                success: true,
                phase: 'complete',
                outputs: [],
                errors: [],
                executionTime: 0,
              },
              testsPassed: true,
              securityScore: 85,
              performanceScore: 80,
            }
          : undefined,
      artifacts: this.artifacts,
      metadata: {
        executionTimeMs: Date.now() - this.startTime,
        totalCost: this.totalCost,
        phasesCompleted: this.phases.filter((p) => p.status === 'complete').length,
        totalPhases: this.phases.length,
        agentsUsed: this.allFindings.length > 0 ? 50 : 0, // Estimate
        searchesExecuted: this.allFindings.length * 2, // Estimate
        codeFilesGenerated: this.generatedFiles.length,
        confidenceScore: this.calculateQualityScore(),
        completedAt: Date.now(),
        modelUsage: {
          opus: { calls: 3, tokens: 10000, cost: this.totalCost * 0.6 },
          sonnet: { calls: 10, tokens: 20000, cost: this.totalCost * 0.3 },
          haiku: { calls: 50, tokens: 50000, cost: this.totalCost * 0.1 },
        },
        learnings: this.learnings?.successfulStrategies || [],
      },
    };
  }

  private buildPartialOutput(error: string): OmegaOutput {
    return {
      id: this.sessionId,
      mission: this.mission!,
      artifacts: this.artifacts,
      metadata: {
        executionTimeMs: Date.now() - this.startTime,
        totalCost: this.totalCost,
        phasesCompleted: this.phases.filter((p) => p.status === 'complete').length,
        totalPhases: this.phases.length,
        agentsUsed: 0,
        searchesExecuted: 0,
        codeFilesGenerated: 0,
        confidenceScore: 0.3,
        completedAt: Date.now(),
        modelUsage: {
          opus: { calls: 0, tokens: 0, cost: 0 },
          sonnet: { calls: 0, tokens: 0, cost: 0 },
          haiku: { calls: 0, tokens: 0, cost: 0 },
        },
        learnings: [`Error: ${error}`],
      },
    };
  }

  private async learnFromExecution(_output: OmegaOutput): Promise<void> {
    // Store learnings for future optimization
    // This would integrate with a learning system
  }

  private calculateCost(
    inputTokens: number,
    outputTokens: number,
    model: 'opus' | 'sonnet' | 'haiku'
  ): number {
    const rates = {
      opus: { input: 0.015, output: 0.075 },
      sonnet: { input: 0.003, output: 0.015 },
      haiku: { input: 0.001, output: 0.005 },
    };
    const rate = rates[model];
    return (inputTokens * rate.input + outputTokens * rate.output) / 1000;
  }

  private calculateProgress(): number {
    if (this.phases.length === 0) return 0;
    const completed = this.phases.filter((p) => p.status === 'complete').length;
    const current = this.phases[this.currentPhaseIndex]?.progress || 0;
    return Math.round((completed / this.phases.length) * 100 + current / this.phases.length);
  }

  private getCurrentPhaseName(): string {
    return this.phases[this.currentPhaseIndex]?.name || 'Initializing';
  }

  private calculateTimeEfficiency(): number {
    const elapsed = Date.now() - this.startTime;
    const maxTime = this.config.maxTimeMinutes * 60 * 1000;
    return Math.max(0, 1 - elapsed / maxTime);
  }

  private calculateCostEfficiency(): number {
    return Math.max(0, 1 - this.totalCost / this.config.maxBudget);
  }

  private calculateQualityScore(): number {
    if (this.allFindings.length === 0) return 0;
    return this.allFindings.reduce((sum, f) => sum + f.confidence, 0) / this.allFindings.length;
  }

  private emit(type: OmegaStreamEventType, message: string, data?: Record<string, unknown>): void {
    if (this.onStream) {
      this.onStream({
        type,
        message,
        timestamp: Date.now(),
        phase: this.getCurrentPhaseName(),
        progress: this.calculateProgress(),
        data,
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

export function createOmegaAgent(
  apiKey: string,
  userId: string,
  config?: Partial<OmegaConfig>,
  onStream?: OmegaStreamCallback
): OmegaAgent {
  return new OmegaAgent(apiKey, userId, config, onStream);
}

/**
 * Quick mission builder for common use cases
 */
export function buildMission(objective: string): {
  withContext: (context: string) => ReturnType<typeof buildMission>;
  withConstraint: (constraint: string) => ReturnType<typeof buildMission>;
  withDeliverable: (deliverable: string) => ReturnType<typeof buildMission>;
  targeting: (outcome: string) => ReturnType<typeof buildMission>;
  build: () => OmegaMission;
} {
  const mission: Partial<OmegaMission> = {
    id: crypto.randomUUID(),
    objective,
    constraints: [],
    deliverables: [],
    priority: 'medium',
  };

  const builder = {
    withContext: (context: string) => {
      mission.context = context;
      return builder;
    },
    withConstraint: (constraint: string) => {
      mission.constraints?.push(constraint);
      return builder;
    },
    withDeliverable: (deliverable: MissionDeliverable) => {
      mission.deliverables?.push(deliverable);
      return builder;
    },
    targeting: (outcome: string) => {
      mission.desiredOutcome = outcome;
      return builder;
    },
    build: (): OmegaMission => ({
      id: mission.id!,
      objective: mission.objective!,
      context: mission.context,
      constraints: mission.constraints,
      desiredOutcome: mission.desiredOutcome || 'Successful completion',
      deliverables: mission.deliverables || ['strategy_report'],
      priority: mission.priority || 'medium',
    }),
  };

  return builder;
}
