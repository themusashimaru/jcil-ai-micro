import { describe, it, expect } from 'vitest';

import type {
  AgentMode,
  ModelTier,
  ModelConfig,
  StrategyLimits,
  CostTracker,
  KillReason,
  SynthesizedProblem,
  PriorityItem,
  AgentBlueprint,
  ResearchApproach,
  ScoutToolType,
  OutputFormat,
  ScoutState,
  AgentStatus,
  Finding,
  FindingType,
  DataPoint,
  SourceCitation,
  QualityIssueType,
  QualityAction,
  TaskType,
  QueueProgress,
  StrategyRecommendation,
  RiskItem,
  ActionItem,
  StrategyStreamEvent,
  StrategyStreamCallback,
  KnowledgeEntry,
  KnowledgeQuery,
  PerformanceInsight,
  SteeringAction,
  SteeringCommand,
} from './types';

describe('Strategy types', () => {
  describe('Model Configuration types', () => {
    it('should support all AgentMode values', () => {
      const modes: AgentMode[] = [
        'strategy',
        'research',
        'quick-research',
        'quick-strategy',
        'deep-writer',
        'quick-writer',
      ];
      expect(modes).toHaveLength(6);
    });

    it('should support all ModelTier values', () => {
      const tiers: ModelTier[] = ['opus', 'sonnet', 'haiku'];
      expect(tiers).toHaveLength(3);
    });

    it('should create ModelConfig', () => {
      const config: ModelConfig = {
        id: 'claude-opus-4-6',
        tier: 'opus',
        costPerMillionInput: 15,
        costPerMillionOutput: 75,
        maxTokens: 32768,
        description: 'Most capable model',
      };
      expect(config.tier).toBe('opus');
    });
  });

  describe('Safety & Limits types', () => {
    it('should create StrategyLimits', () => {
      const limits: StrategyLimits = {
        maxBudget: 20,
        maxScouts: 100,
        maxSearches: 500,
        maxTimeMinutes: 10,
        maxDepth: 50,
        maxConcurrentCalls: 10,
        batchDelayMs: 100,
        minConfidenceScore: 0.7,
        maxErrorRate: 0.3,
      };
      expect(limits.maxBudget).toBe(20);
    });

    it('should create CostTracker', () => {
      const ct: CostTracker = {
        inputTokens: 1000,
        outputTokens: 500,
        totalCost: 0.05,
        searchCost: 0.01,
        breakdown: {
          opus: { tokens: 500, cost: 0.03 },
          sonnet: { tokens: 300, cost: 0.01 },
          haiku: { tokens: 200, cost: 0.005 },
          brave: { queries: 5, cost: 0.01 },
        },
      };
      expect(ct.totalCost).toBe(0.05);
    });

    it('should support all KillReason values', () => {
      const reasons: KillReason[] = [
        'budget_exceeded',
        'time_exceeded',
        'error_rate_exceeded',
        'user_cancelled',
        'quality_control_failed',
        'infinite_loop_detected',
        'manual_kill',
      ];
      expect(reasons).toHaveLength(7);
    });
  });

  describe('Intake & Problem types', () => {
    it('should create SynthesizedProblem', () => {
      const sp: SynthesizedProblem = {
        summary: 'Finding housing in JC',
        coreQuestion: 'Where to live?',
        constraints: ['$3000 budget'],
        priorities: [{ factor: 'transit', importance: 9, isNegotiable: false }],
        stakeholders: ['family'],
        timeframe: '3 months',
        riskTolerance: 'medium',
        complexity: 'complex',
        domains: ['housing', 'transit'],
        hiddenFactors: ['school quality'],
        successCriteria: ['Good commute'],
      };
      expect(sp.complexity).toBe('complex');
    });

    it('should create PriorityItem', () => {
      const pi: PriorityItem = { factor: 'Cost', importance: 8, isNegotiable: true };
      expect(pi.importance).toBe(8);
    });
  });

  describe('Agent Blueprint types', () => {
    it('should create AgentBlueprint', () => {
      const bp: AgentBlueprint = {
        id: 'scout-1',
        name: 'Housing Scout',
        role: 'Real estate researcher',
        expertise: ['NJ housing'],
        purpose: 'Find housing options',
        keyQuestions: ['What are prices?'],
        researchApproach: 'deep_dive',
        dataSources: ['web'],
        searchQueries: ['housing JC'],
        deliverable: 'findings',
        outputFormat: 'summary',
        modelTier: 'sonnet',
        priority: 1,
        estimatedSearches: 5,
        depth: 1,
        canSpawnChildren: false,
        maxChildren: 0,
        tools: ['brave_search', 'browser_visit'],
      };
      expect(bp.tools).toContain('brave_search');
    });

    it('should support all ResearchApproach values', () => {
      const approaches: ResearchApproach[] = [
        'broad_scan',
        'deep_dive',
        'comparative',
        'risk_analysis',
        'opportunity_scan',
        'validation',
        'synthesis',
      ];
      expect(approaches).toHaveLength(7);
    });

    it('should support all ScoutToolType values', () => {
      const tools: ScoutToolType[] = [
        'brave_search',
        'browser_visit',
        'run_code',
        'screenshot',
        'vision_analyze',
        'extract_table',
        'compare_screenshots',
        'safe_form_fill',
        'paginate',
        'infinite_scroll',
        'click_navigate',
        'extract_pdf',
        'generate_comparison',
      ];
      expect(tools).toHaveLength(13);
    });

    it('should support all OutputFormat values', () => {
      const formats: OutputFormat[] = [
        'summary',
        'bullet_points',
        'comparison_matrix',
        'comparison_table',
        'swot_analysis',
        'risk_assessment',
        'recommendation',
        'action_plan',
        'data_table',
      ];
      expect(formats).toHaveLength(9);
    });
  });

  describe('Agent Hierarchy types', () => {
    it('should support all AgentStatus values', () => {
      const statuses: AgentStatus[] = [
        'pending',
        'initializing',
        'researching',
        'synthesizing',
        'complete',
        'failed',
        'killed',
      ];
      expect(statuses).toHaveLength(7);
    });

    it('should create ScoutState', () => {
      const ss: ScoutState = {
        id: 's1',
        blueprintId: 'bp1',
        name: 'Scout',
        status: 'researching',
        progress: 50,
        searchesCompleted: 3,
        searchesTotal: 10,
        findings: [],
        errors: [],
        startTime: Date.now(),
        tokensUsed: 1000,
        costIncurred: 0.01,
      };
      expect(ss.progress).toBe(50);
    });
  });

  describe('Finding types', () => {
    it('should support all FindingType values', () => {
      const types: FindingType[] = [
        'fact',
        'insight',
        'recommendation',
        'warning',
        'opportunity',
        'comparison',
        'data',
        'gap',
      ];
      expect(types).toHaveLength(8);
    });

    it('should create Finding', () => {
      const f: Finding = {
        id: 'f1',
        agentId: 'a1',
        agentName: 'Scout 1',
        type: 'fact',
        title: 'Price data',
        content: 'Median is $500k',
        confidence: 'high',
        sources: [],
        timestamp: Date.now(),
        relevanceScore: 0.9,
      };
      expect(f.confidence).toBe('high');
    });

    it('should create DataPoint', () => {
      const dp: DataPoint = { label: 'Price', value: 500000, unit: 'USD', source: 'Zillow' };
      expect(dp.value).toBe(500000);
    });

    it('should create SourceCitation', () => {
      const sc: SourceCitation = {
        title: 'Zillow Report',
        url: 'https://zillow.com',
        type: 'web',
        accessedAt: Date.now(),
        reliability: 'high',
      };
      expect(sc.type).toBe('web');
    });
  });

  describe('Quality Control types', () => {
    it('should support all QualityIssueType values', () => {
      const types: QualityIssueType[] = [
        'low_confidence',
        'conflicting_data',
        'insufficient_coverage',
        'high_error_rate',
        'budget_warning',
        'time_warning',
        'stale_data',
        'missing_critical',
      ];
      expect(types).toHaveLength(8);
    });

    it('should support all QualityAction values', () => {
      const actions: QualityAction[] = [
        'continue',
        'spawn_more_agents',
        'redirect_focus',
        'request_user_input',
        'pause_and_review',
        'kill',
      ];
      expect(actions).toHaveLength(6);
    });
  });

  describe('Queue types', () => {
    it('should support all TaskType values', () => {
      const types: TaskType[] = ['agent_execution', 'brave_search', 'synthesis', 'quality_check'];
      expect(types).toHaveLength(4);
    });

    it('should create QueueProgress', () => {
      const qp: QueueProgress = {
        total: 10,
        completed: 3,
        failed: 1,
        inProgress: 2,
        queued: 4,
        estimatedTimeRemaining: 30000,
        currentBatch: 1,
        totalBatches: 3,
      };
      expect(qp.total).toBe(10);
    });
  });

  describe('Strategy Output types', () => {
    it('should create StrategyRecommendation', () => {
      const sr: StrategyRecommendation = {
        title: 'Move to JC',
        summary: 'Best option',
        confidence: 85,
        reasoning: ['Transit access'],
        tradeoffs: ['Higher cost'],
        bestFor: 'Commuters',
      };
      expect(sr.confidence).toBe(85);
    });

    it('should create ActionItem', () => {
      const ai: ActionItem = {
        order: 1,
        action: 'Research housing',
        timeframe: '1 week',
        priority: 'high',
        details: 'Check Zillow',
      };
      expect(ai.priority).toBe('high');
    });

    it('should create RiskItem', () => {
      const ri: RiskItem = {
        risk: 'Market downturn',
        probability: 'medium',
        impact: 'high',
        mitigation: 'Diversify',
      };
      expect(ri.probability).toBe('medium');
    });
  });

  describe('Streaming types', () => {
    it('should create StrategyStreamEvent', () => {
      const event: StrategyStreamEvent = {
        type: 'agent_spawned',
        message: 'New scout created',
        timestamp: Date.now(),
        data: { agentId: 'a1', agentName: 'Scout 1' },
      };
      expect(event.type).toBe('agent_spawned');
    });

    it('should create StrategyStreamCallback type', () => {
      const cb: StrategyStreamCallback = () => {};
      expect(typeof cb).toBe('function');
    });
  });

  describe('Steering types', () => {
    it('should support all SteeringAction values', () => {
      const actions: SteeringAction[] = [
        'kill_domain',
        'kill_scout',
        'focus_domain',
        'spawn_scouts',
        'pause',
        'resume',
        'adjust_budget',
        'redirect',
      ];
      expect(actions).toHaveLength(8);
    });

    it('should create SteeringCommand', () => {
      const cmd: SteeringCommand = {
        action: 'kill_domain',
        target: 'housing',
        message: 'stop researching housing',
        timestamp: Date.now(),
      };
      expect(cmd.action).toBe('kill_domain');
    });
  });

  describe('Knowledge Base types', () => {
    it('should create KnowledgeEntry', () => {
      const ke: KnowledgeEntry = {
        id: '1',
        userId: 'u1',
        sessionId: 's1',
        agentMode: 'strategy',
        findingType: 'fact',
        title: 'Test',
        content: 'Content',
        confidence: 'high',
        relevanceScore: 0.9,
        sources: [],
        dataPoints: [],
        topicTags: [],
        searchQueries: [],
        scoutToolsUsed: [],
        createdAt: Date.now(),
      };
      expect(ke.confidence).toBe('high');
    });

    it('should create KnowledgeQuery', () => {
      const kq: KnowledgeQuery = {
        userId: 'u1',
        searchText: 'housing',
        domain: 'real-estate',
        limit: 10,
      };
      expect(kq.limit).toBe(10);
    });
  });

  describe('Performance types', () => {
    it('should create PerformanceInsight', () => {
      const pi: PerformanceInsight = {
        toolCombo: ['brave_search'],
        avgFindingsCount: 5,
        avgConfidenceScore: 0.8,
        avgRelevanceScore: 0.7,
        successRate: 0.9,
        avgExecutionTimeMs: 5000,
        sampleSize: 10,
      };
      expect(pi.sampleSize).toBe(10);
    });
  });
});
