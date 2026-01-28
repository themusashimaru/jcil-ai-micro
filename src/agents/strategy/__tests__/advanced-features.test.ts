/**
 * COMPREHENSIVE TESTS FOR ADVANCED AI FEATURES
 *
 * Tests all 9 advanced capabilities:
 * 1. ReflectionEngine
 * 2. AdversarialVerifier
 * 3. KnowledgeGraph
 * 4. CausalReasoningEngine
 * 5. PredictiveSimulator
 * 6. DocumentAnalyzer
 * 7. AdaptiveModelRouter
 * 8. AuditTrail
 * 9. AdvancedPuppeteer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '```json\n{}\n```' }],
        usage: { input_tokens: 100, output_tokens: 100 },
      }),
    },
  })),
}));

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{ id: 'test' }], error: null }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

import Anthropic from '@anthropic-ai/sdk';
import { ReflectionEngine, createReflectionEngine } from '../ReflectionEngine';
import { AdversarialVerifier, createAdversarialVerifier } from '../AdversarialVerifier';
import { KnowledgeGraph, createKnowledgeGraph } from '../KnowledgeGraph';
import { CausalReasoningEngine, createCausalReasoningEngine } from '../CausalReasoningEngine';
import { PredictiveSimulator, createPredictiveSimulator } from '../PredictiveSimulator';
import { DocumentAnalyzer, createDocumentAnalyzer } from '../DocumentAnalyzer';
import {
  AdaptiveModelRouter,
  createAdaptiveModelRouter,
  type TaskProfile,
} from '../AdaptiveModelRouter';
import { AuditTrail, createAuditTrail } from '../AuditTrail';
import { AdvancedPuppeteer, createAdvancedPuppeteer } from '../tools/AdvancedPuppeteer';
import type { Finding, SynthesizedProblem, StrategyRecommendation } from '../types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const mockFinding: Finding = {
  id: 'finding_1',
  agentId: 'agent_1',
  agentName: 'Test Scout',
  type: 'fact',
  title: 'Test Finding',
  content: 'This is a test finding about housing prices in Jersey City.',
  confidence: 'high',
  sources: [
    {
      title: 'Test Source',
      url: 'https://example.com',
      type: 'web',
      accessedAt: Date.now(),
      reliability: 'high',
    },
  ],
  timestamp: Date.now(),
  relevanceScore: 0.9,
};

const mockProblem: SynthesizedProblem = {
  summary: 'User needs help deciding where to move',
  coreQuestion: 'Should I move to Jersey City or stay in Manhattan?',
  constraints: ['Budget: $3000/month', 'Commute to midtown'],
  priorities: [{ factor: 'Cost', importance: 9, isNegotiable: false }],
  stakeholders: ['User', 'Partner'],
  timeframe: '3 months',
  riskTolerance: 'medium',
  complexity: 'moderate',
  domains: ['Housing', 'Finance', 'Transportation'],
  hiddenFactors: ['Job security'],
  successCriteria: ['Find affordable housing', 'Reasonable commute'],
};

const mockRecommendation: StrategyRecommendation = {
  title: 'Move to Jersey City',
  summary: 'Jersey City offers better value for money with reasonable commute times.',
  confidence: 78,
  reasoning: ['30% lower rent', 'PATH train access', 'Growing food scene'],
  tradeoffs: ['Longer commute', 'Less walkable'],
  bestFor: 'Budget-conscious professionals',
};

// =============================================================================
// REFLECTION ENGINE TESTS
// =============================================================================

describe('ReflectionEngine', () => {
  let client: Anthropic;
  let engine: ReflectionEngine;

  beforeEach(() => {
    client = new Anthropic({ apiKey: 'test' });
    engine = createReflectionEngine(client);
  });

  it('should create reflection engine', () => {
    expect(engine).toBeInstanceOf(ReflectionEngine);
  });

  it('should run reflection analysis', async () => {
    const result = await engine.reflect({
      problem: mockProblem,
      findings: [mockFinding],
      phase: 'post_research',
    });

    expect(result).toBeDefined();
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.qualityScore).toBeLessThanOrEqual(1);
    expect(result.timestamp).toBeDefined();
  });

  it('should run quick reflection on a finding', async () => {
    const result = await engine.quickReflect(mockFinding);

    expect(result).toBeDefined();
    expect(typeof result.hasIssues).toBe('boolean');
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should accumulate cumulative insights', async () => {
    await engine.reflect({
      problem: mockProblem,
      findings: [mockFinding],
      phase: 'post_research',
    });

    const insights = engine.getCumulativeInsights();

    expect(insights).toBeDefined();
    expect(typeof insights.totalAssumptions).toBe('number');
    expect(typeof insights.totalBiases).toBe('number');
    expect(typeof insights.totalGaps).toBe('number');
    expect(['improving', 'stable', 'declining']).toContain(insights.trend);
  });

  it('should maintain reflection history', async () => {
    await engine.reflect({
      problem: mockProblem,
      findings: [mockFinding],
      phase: 'post_intake',
    });

    const history = engine.getHistory();
    expect(history.length).toBeGreaterThan(0);
  });

  it('should clear history', () => {
    engine.clearHistory();
    expect(engine.getHistory().length).toBe(0);
  });
});

// =============================================================================
// ADVERSARIAL VERIFIER TESTS
// =============================================================================

describe('AdversarialVerifier', () => {
  let client: Anthropic;
  let verifier: AdversarialVerifier;

  beforeEach(() => {
    client = new Anthropic({ apiKey: 'test' });
    verifier = createAdversarialVerifier(client);
  });

  it('should create adversarial verifier', () => {
    expect(verifier).toBeInstanceOf(AdversarialVerifier);
  });

  it('should run full verification', async () => {
    const result = await verifier.verify({
      problem: mockProblem,
      findings: [mockFinding],
      recommendation: mockRecommendation,
    });

    expect(result).toBeDefined();
    expect(['verified', 'concerns', 'failed']).toContain(result.status);
    expect(result.robustnessScore).toBeGreaterThanOrEqual(0);
    expect(result.robustnessScore).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.counterArguments)).toBe(true);
    expect(result.verdict).toBeDefined();
  });

  it('should verify individual findings', async () => {
    const result = await verifier.verifyFinding(mockFinding, mockProblem);

    expect(result).toBeDefined();
    expect(typeof result.isValid).toBe('boolean');
    expect(Array.isArray(result.counterArguments)).toBe(true);
    expect(result.adjustedConfidence).toBeGreaterThanOrEqual(0);
    expect(result.adjustedConfidence).toBeLessThanOrEqual(1);
  });

  it('should detect contradictions', async () => {
    const findings: Finding[] = [
      { ...mockFinding, id: 'f1', title: 'Housing is affordable' },
      { ...mockFinding, id: 'f2', title: 'Housing prices are too high' },
    ];

    const contradictions = await verifier.detectContradictions(findings);
    expect(Array.isArray(contradictions)).toBe(true);
  });

  it('should maintain verification history', async () => {
    await verifier.verify({
      problem: mockProblem,
      findings: [mockFinding],
    });

    const history = verifier.getHistory();
    expect(history.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// KNOWLEDGE GRAPH TESTS
// =============================================================================

describe('KnowledgeGraph', () => {
  let client: Anthropic;
  let graph: KnowledgeGraph;

  beforeEach(() => {
    client = new Anthropic({ apiKey: 'test' });
    graph = createKnowledgeGraph(client, 'user_123', 'session_123');
  });

  it('should create knowledge graph', () => {
    expect(graph).toBeInstanceOf(KnowledgeGraph);
  });

  it('should extract entities from findings', async () => {
    const result = await graph.extractFromFindings([mockFinding]);

    expect(result).toBeDefined();
    expect(typeof result.extractedFromCount).toBe('number');
  });

  it('should add entities manually', () => {
    const entity = graph.addEntity({
      name: 'Jersey City',
      type: 'location',
      aliases: ['JC'],
      properties: { state: 'NJ' },
      confidence: 0.9,
      sourceIds: ['finding_1'],
    });

    expect(entity).toBeDefined();
    expect(entity.id).toBeDefined();
    expect(entity.name).toBe('Jersey City');
  });

  it('should add relationships', () => {
    const entity1 = graph.addEntity({
      name: 'Jersey City',
      type: 'location',
      aliases: [],
      properties: {},
      confidence: 0.9,
      sourceIds: [],
    });

    const entity2 = graph.addEntity({
      name: 'PATH Train',
      type: 'service',
      aliases: [],
      properties: {},
      confidence: 0.9,
      sourceIds: [],
    });

    const rel = graph.addRelationship({
      sourceEntityId: entity1.id,
      targetEntityId: entity2.id,
      type: 'connected_to',
      properties: {},
      confidence: 0.9,
      sourceIds: [],
      bidirectional: true,
    });

    expect(rel).toBeDefined();
    expect(rel?.type).toBe('connected_to');
  });

  it('should query the graph', () => {
    graph.addEntity({
      name: 'Test Entity',
      type: 'concept',
      aliases: [],
      properties: {},
      confidence: 0.9,
      sourceIds: [],
    });

    const result = graph.query({ entityTypes: ['concept'] });

    expect(result).toBeDefined();
    expect(result.entities.length).toBeGreaterThan(0);
  });

  it('should get statistics', () => {
    graph.addEntity({
      name: 'Test',
      type: 'concept',
      aliases: [],
      properties: {},
      confidence: 0.9,
      sourceIds: [],
    });

    const stats = graph.getStatistics();

    expect(stats).toBeDefined();
    expect(stats.totalEntities).toBeGreaterThan(0);
    expect(typeof stats.averageConfidence).toBe('number');
  });
});

// =============================================================================
// CAUSAL REASONING ENGINE TESTS
// =============================================================================

describe('CausalReasoningEngine', () => {
  let client: Anthropic;
  let engine: CausalReasoningEngine;

  beforeEach(() => {
    client = new Anthropic({ apiKey: 'test' });
    engine = createCausalReasoningEngine(client);
  });

  it('should create causal reasoning engine', () => {
    expect(engine).toBeInstanceOf(CausalReasoningEngine);
  });

  it('should analyze causal relationships', async () => {
    const result = await engine.analyze([mockFinding], mockProblem);

    expect(result).toBeDefined();
    expect(result.graph).toBeDefined();
    expect(Array.isArray(result.chains)).toBe(true);
    expect(Array.isArray(result.counterfactuals)).toBe(true);
  });

  it('should perform root cause analysis', async () => {
    const result = await engine.analyzeRootCauses(
      'High housing costs',
      ['Limited supply', 'High demand', 'Low interest rates'],
      'Urban housing market'
    );

    expect(result).toBeDefined();
    expect(result.problem).toBe('High housing costs');
    expect(Array.isArray(result.rootCauses)).toBe(true);
  });

  it('should generate counterfactuals', async () => {
    const counterfactuals = await engine.generateCounterfactuals(
      'Living in Manhattan',
      ['Location', 'Budget'],
      'More affordable living'
    );

    expect(Array.isArray(counterfactuals)).toBe(true);
  });

  it('should maintain analysis history', async () => {
    await engine.analyze([mockFinding], mockProblem);
    const history = engine.getHistory();
    expect(history.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// PREDICTIVE SIMULATOR TESTS
// =============================================================================

describe('PredictiveSimulator', () => {
  let client: Anthropic;
  let simulator: PredictiveSimulator;

  beforeEach(() => {
    client = new Anthropic({ apiKey: 'test' });
    simulator = createPredictiveSimulator(client);
  });

  it('should create predictive simulator', () => {
    expect(simulator).toBeInstanceOf(PredictiveSimulator);
  });

  it('should generate scenarios', async () => {
    const result = await simulator.generateScenarios(mockProblem, mockRecommendation, [
      mockFinding,
    ]);

    expect(result).toBeDefined();
    expect(Array.isArray(result.scenarios)).toBe(true);
    expect(Array.isArray(result.keyInsights)).toBe(true);
  });

  it('should answer what-if questions', async () => {
    const result = await simulator.whatIf(
      {
        question: 'What if rent increases by 20%?',
        variables: [{ name: 'Rent', currentValue: 2500, hypotheticalValue: 3000 }],
      },
      mockProblem
    );

    expect(result).toBeDefined();
    expect(result.query.question).toBe('What if rent increases by 20%?');
    expect(typeof result.probability).toBe('number');
  });

  it('should run sensitivity analysis', async () => {
    const results = await simulator.analyzeSensitivity(
      [{ name: 'Rent', baseValue: 2500, testRange: { min: 2000, max: 3500 } }],
      'Monthly budget impact',
      mockProblem
    );

    expect(Array.isArray(results)).toBe(true);
  });

  it('should build decision trees', async () => {
    const tree = await simulator.buildDecisionTree(
      'Where to move?',
      ['Jersey City', 'Hoboken', 'Stay in Manhattan'],
      ['Job loss', 'Rent increase'],
      mockProblem
    );

    expect(tree).toBeDefined();
    expect(tree.rootNode).toBeDefined();
  });

  it('should run Monte Carlo simulation', async () => {
    const result = await simulator.runMonteCarlo(
      [
        {
          name: 'Rent',
          distribution: 'normal',
          params: { mean: 2500, stdDev: 300 },
        },
      ],
      1000,
      'Rent + Utilities'
    );

    expect(result).toBeDefined();
    expect(typeof result.mean).toBe('number');
    expect(typeof result.median).toBe('number');
    expect(typeof result.stdDev).toBe('number');
    expect(result.percentiles).toBeDefined();
  });
});

// =============================================================================
// DOCUMENT ANALYZER TESTS
// =============================================================================

describe('DocumentAnalyzer', () => {
  let client: Anthropic;
  let analyzer: DocumentAnalyzer;

  beforeEach(() => {
    client = new Anthropic({ apiKey: 'test' });
    analyzer = createDocumentAnalyzer(client);
  });

  it('should create document analyzer', () => {
    expect(analyzer).toBeInstanceOf(DocumentAnalyzer);
  });

  it('should analyze documents', async () => {
    const result = await analyzer.analyze({
      name: 'test.txt',
      type: 'text/plain',
      content: Buffer.from('Test content').toString('base64'),
    });

    expect(result).toBeDefined();
    expect(result.documentName).toBe('test.txt');
  });

  it('should analyze multiple documents', async () => {
    const results = await analyzer.analyzeMultiple([
      {
        name: 'doc1.txt',
        type: 'text/plain',
        content: Buffer.from('Content 1').toString('base64'),
      },
      {
        name: 'doc2.txt',
        type: 'text/plain',
        content: Buffer.from('Content 2').toString('base64'),
      },
    ]);

    expect(results.length).toBe(2);
  });

  it('should extract comparison data', async () => {
    const result = await analyzer.extractComparison(`
      Option A: $100, High quality, Fast delivery
      Option B: $80, Medium quality, Slow delivery
    `);

    expect(result).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(Array.isArray(result.criteria)).toBe(true);
  });

  it('should maintain analysis history', async () => {
    await analyzer.analyze({
      name: 'test.txt',
      type: 'text/plain',
      content: Buffer.from('Test').toString('base64'),
    });

    const history = analyzer.getHistory();
    expect(history.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// ADAPTIVE MODEL ROUTER TESTS
// =============================================================================

describe('AdaptiveModelRouter', () => {
  let router: AdaptiveModelRouter;

  beforeEach(() => {
    router = createAdaptiveModelRouter();
  });

  it('should create adaptive model router', () => {
    expect(router).toBeInstanceOf(AdaptiveModelRouter);
  });

  it('should route tasks to appropriate models', () => {
    const decision = router.route({
      taskId: 'task_1',
      taskType: 'analysis',
      complexity: 'complex',
      requiredCapabilities: ['reasoning', 'synthesis'],
      inputSize: 'medium',
      urgency: 'normal',
      costSensitivity: 'medium',
      qualityRequirement: 'good',
    });

    expect(decision).toBeDefined();
    expect(['opus', 'sonnet', 'haiku']).toContain(decision.selectedModel);
    expect(decision.confidence).toBeGreaterThan(0);
    expect(Array.isArray(decision.reasoning)).toBe(true);
  });

  it('should route simple tasks to haiku when speed is preferred', () => {
    // Create a speed-focused router for this test
    const speedRouter = createAdaptiveModelRouter({
      defaultModel: 'sonnet',
      preferSpeed: true,
      preferQuality: false,
      learningEnabled: false,
    });

    const decision = speedRouter.route({
      taskId: 'task_2',
      taskType: 'classification',
      complexity: 'trivial',
      requiredCapabilities: [],
      inputSize: 'small',
      urgency: 'high',
      costSensitivity: 'high',
      qualityRequirement: 'acceptable',
    });

    expect(decision.selectedModel).toBe('haiku');
  });

  it('should route complex tasks to opus', () => {
    const decision = router.route({
      taskId: 'task_3',
      taskType: 'synthesis',
      complexity: 'extreme',
      requiredCapabilities: ['reasoning', 'creativity', 'precision'],
      inputSize: 'large',
      urgency: 'normal',
      costSensitivity: 'low',
      qualityRequirement: 'best',
    });

    expect(['opus', 'sonnet']).toContain(decision.selectedModel);
  });

  it('should profile tasks automatically', () => {
    const profile = router.profileTask(
      'task_4',
      'analysis',
      'Please analyze this complex data and provide detailed insights with reasoning.'
    );

    expect(profile).toBeDefined();
    expect(profile.taskType).toBe('analysis');
    expect(['trivial', 'simple', 'moderate', 'complex', 'extreme']).toContain(profile.complexity);
  });

  it('should route batch tasks', () => {
    const tasks: TaskProfile[] = [
      {
        taskId: 'batch_1',
        taskType: 'classification',
        complexity: 'simple',
        requiredCapabilities: [],
        inputSize: 'small',
        urgency: 'normal',
        costSensitivity: 'medium',
        qualityRequirement: 'good',
      },
      {
        taskId: 'batch_2',
        taskType: 'analysis',
        complexity: 'complex',
        requiredCapabilities: ['reasoning'],
        inputSize: 'large',
        urgency: 'critical',
        costSensitivity: 'low',
        qualityRequirement: 'best',
      },
    ];

    const decisions = router.routeBatch(tasks);
    expect(decisions.length).toBe(2);
  });

  it('should record and use performance data', () => {
    router.recordPerformance({
      taskId: 'perf_1',
      taskType: 'analysis',
      modelUsed: 'sonnet',
      inputTokens: 1000,
      outputTokens: 500,
      latencyMs: 2000,
      success: true,
      qualityScore: 0.9,
      cost: 0.01,
      timestamp: Date.now(),
    });

    const stats = router.getStatistics();
    expect(stats.totalRouted).toBe(1);
    expect(stats.modelDistribution.sonnet).toBe(1);
  });
});

// =============================================================================
// AUDIT TRAIL TESTS
// =============================================================================

describe('AuditTrail', () => {
  let audit: AuditTrail;

  beforeEach(() => {
    audit = createAuditTrail('session_123', 'user_123', { persistToDb: false });
  });

  it('should create audit trail', () => {
    expect(audit).toBeInstanceOf(AuditTrail);
  });

  it('should log decisions', async () => {
    const eventId = await audit.logDecision('TestComponent', 'test_action', {
      reasoning: ['Reason 1', 'Reason 2'],
      confidence: 0.8,
    });

    expect(eventId).toBeDefined();
    expect(eventId.startsWith('audit_')).toBe(true);
  });

  it('should log inferences', async () => {
    const eventId = await audit.logInference('ModelRouter', 'model_selection', {
      inputSummary: 'Test input',
      outputSummary: 'Test output',
      modelUsed: 'sonnet',
    });

    expect(eventId).toBeDefined();
  });

  it('should log tool calls', async () => {
    const eventId = await audit.logToolCall('Scout', 'brave_search', {
      input: { query: 'test query' },
      output: { results: [] },
      success: true,
    });

    expect(eventId).toBeDefined();
  });

  it('should log errors', async () => {
    const eventId = await audit.logError('TestComponent', 'test_action', new Error('Test error'));
    expect(eventId).toBeDefined();
  });

  it('should track reasoning chains', () => {
    const chainId = audit.startReasoningChain('Test Chain');
    expect(chainId).toBeDefined();

    audit.addReasoningStep({
      action: 'Step 1',
      input: 'Input 1',
      output: 'Output 1',
      reasoning: 'Reasoning 1',
      confidence: 0.9,
    });

    audit.completeReasoningChain('Conclusion', 0.85);

    const chains = audit.getReasoningChains();
    expect(chains.length).toBe(1);
    expect(chains[0].steps.length).toBe(1);
  });

  it('should explain decisions', async () => {
    const eventId = await audit.logDecision('TestComponent', 'test_action', {
      reasoning: ['Because X', 'And Y'],
      alternatives: [{ option: 'Option B', whyNotChosen: 'Too expensive' }],
    });

    const explanation = audit.explainDecision(eventId);

    expect(explanation).toBeDefined();
    expect(explanation?.reasoning.length).toBe(2);
  });

  it('should generate explainability reports', async () => {
    await audit.logDecision('Component1', 'action1', { reasoning: ['Reason'] });
    await audit.logInference('Component2', 'action2', {
      inputSummary: 'Input',
      outputSummary: 'Output',
      modelUsed: 'sonnet',
    });

    const report = audit.generateReport();

    expect(report).toBeDefined();
    expect(report.summary.totalDecisions).toBeGreaterThan(0);
    expect(report.summary.totalInferences).toBeGreaterThan(0);
  });

  it('should query events', async () => {
    await audit.logDecision('Component', 'action', { reasoning: [] });

    const result = audit.query({ eventTypes: ['decision'] });

    expect(result.events.length).toBeGreaterThan(0);
    expect(result.aggregations).toBeDefined();
  });
});

// =============================================================================
// ADVANCED PUPPETEER TESTS
// =============================================================================

describe('AdvancedPuppeteer', () => {
  let puppeteer: AdvancedPuppeteer;

  beforeEach(() => {
    puppeteer = createAdvancedPuppeteer({
      antiDetectionLevel: 'standard',
      userAgentRotation: true,
    });
  });

  it('should create advanced puppeteer', () => {
    expect(puppeteer).toBeInstanceOf(AdvancedPuppeteer);
  });

  it('should create sessions', () => {
    const session = puppeteer.createSession('desktop');

    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.userAgent).toBeDefined();
    expect(session.viewport).toBeDefined();
  });

  it('should create mobile sessions', () => {
    const session = puppeteer.createSession('mobile');

    expect(session).toBeDefined();
    expect(session.viewport.width).toBeLessThan(500);
  });

  it('should add proxies', () => {
    puppeteer.addProxies([
      { host: '127.0.0.1', port: 8080, protocol: 'http' },
      { host: '127.0.0.1', port: 8081, protocol: 'socks5' },
    ]);

    const stats = puppeteer.getProxyStats();
    expect(stats.length).toBe(2);
  });

  it('should generate fingerprints', () => {
    const fingerprint = puppeteer.generateFingerprint('desktop');

    expect(fingerprint).toBeDefined();
    expect(fingerprint.userAgent).toBeDefined();
    expect(fingerprint.viewport).toBeDefined();
    expect(fingerprint.timezone).toBeDefined();
    expect(fingerprint.hardwareConcurrency).toBeGreaterThan(0);
  });

  it('should reject sensitive form fields', async () => {
    await expect(
      puppeteer.fillForm('https://example.com', { password: 'secret123' })
    ).rejects.toThrow('Cannot fill sensitive field');

    await expect(
      puppeteer.fillForm('https://example.com', { credit_card: '4111111111111111' })
    ).rejects.toThrow('Cannot fill sensitive field');
  });

  it('should navigate (mock)', async () => {
    const result = await puppeteer.navigate('https://example.com');

    expect(result).toBeDefined();
    expect(result.timing).toBeDefined();
    expect(typeof result.timing.totalMs).toBe('number');
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Integration Tests', () => {
  it('should use multiple advanced features together', async () => {
    const client = new Anthropic({ apiKey: 'test' });

    // Create all components
    const router = createAdaptiveModelRouter();
    const audit = createAuditTrail('session_test', 'user_test', { persistToDb: false });
    const reflection = createReflectionEngine(client);
    const verifier = createAdversarialVerifier(client);

    // Route a task
    const routingDecision = router.route({
      taskId: 'integration_test',
      taskType: 'analysis',
      complexity: 'complex',
      requiredCapabilities: ['reasoning'],
      inputSize: 'medium',
      urgency: 'normal',
      costSensitivity: 'medium',
      qualityRequirement: 'good',
    });

    // Log the routing decision
    await audit.logDecision('ModelRouter', 'route_task', {
      reasoning: routingDecision.reasoning,
      confidence: routingDecision.confidence,
    });

    // Run reflection
    const reflectionResult = await reflection.reflect({
      problem: mockProblem,
      findings: [mockFinding],
      phase: 'post_research',
    });

    // Log reflection
    await audit.logInference('ReflectionEngine', 'reflect', {
      inputSummary: 'Problem and findings',
      outputSummary: `Quality score: ${reflectionResult.qualityScore}`,
      modelUsed: 'opus',
    });

    // Run verification
    const verificationResult = await verifier.verify({
      problem: mockProblem,
      findings: [mockFinding],
    });

    // Log verification
    await audit.logInference('AdversarialVerifier', 'verify', {
      inputSummary: 'Problem and findings',
      outputSummary: `Status: ${verificationResult.status}`,
      modelUsed: 'opus',
    });

    // Generate report
    const report = audit.generateReport();

    expect(report.summary.totalDecisions).toBeGreaterThan(0);
    expect(report.summary.totalInferences).toBeGreaterThan(0);
  });
});
