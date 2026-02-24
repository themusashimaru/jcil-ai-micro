/**
 * Tests for AuditTrail — comprehensive audit trail and explainability system.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependencies
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => null),
}));

import {
  AuditTrail,
  createAuditTrail,
  type AuditEvent,
  type AuditEventType,
  type DecisionExplanation,
  type ReasoningChain,
  type ReasoningStep,
  type DataFlowNode,
  type AuditQuery,
  type AuditQueryResult,
} from './AuditTrail';

describe('AuditTrail', () => {
  let trail: AuditTrail;

  beforeEach(() => {
    trail = new AuditTrail('session-1', 'user-1', { persistToDb: false });
  });

  // ===========================================================================
  // TYPE EXPORT VALIDATION
  // ===========================================================================

  describe('type exports', () => {
    it('should export the AuditTrail class', () => {
      expect(AuditTrail).toBeDefined();
      expect(typeof AuditTrail).toBe('function');
    });

    it('should export the createAuditTrail factory function', () => {
      expect(createAuditTrail).toBeDefined();
      expect(typeof createAuditTrail).toBe('function');
    });

    it('should allow creating AuditEvent objects that match the interface', () => {
      const event: AuditEvent = {
        id: 'test-id',
        sessionId: 'session-1',
        userId: 'user-1',
        eventType: 'decision',
        timestamp: Date.now(),
        component: 'TestComponent',
        action: 'testAction',
        details: {},
        success: true,
      };
      expect(event.id).toBe('test-id');
      expect(event.eventType).toBe('decision');
    });

    it('should allow all AuditEventType values', () => {
      const types: AuditEventType[] = [
        'decision',
        'inference',
        'tool_call',
        'data_access',
        'validation',
        'transformation',
        'routing',
        'error',
        'user_input',
        'system_action',
      ];
      expect(types).toHaveLength(10);
    });

    it('should allow creating DecisionExplanation objects', () => {
      const explanation: DecisionExplanation = {
        decisionId: 'd1',
        decisionType: 'routing',
        summary: 'Test summary',
        reasoning: ['reason1'],
        alternatives: [],
        confidenceFactors: [],
        dataUsed: [],
        modelContribution: 'none',
        humanReadableSummary: 'Human readable',
      };
      expect(explanation.decisionId).toBe('d1');
    });

    it('should allow creating ReasoningChain objects', () => {
      const chain: ReasoningChain = {
        chainId: 'c1',
        sessionId: 's1',
        title: 'Test chain',
        steps: [],
        conclusion: 'done',
        overallConfidence: 0.9,
        timestamp: Date.now(),
      };
      expect(chain.chainId).toBe('c1');
    });

    it('should allow creating ReasoningStep objects', () => {
      const step: ReasoningStep = {
        stepNumber: 1,
        action: 'analyze',
        input: 'data',
        output: 'result',
        reasoning: 'because',
        confidence: 0.8,
      };
      expect(step.stepNumber).toBe(1);
    });

    it('should allow creating DataFlowNode objects', () => {
      const node: DataFlowNode = {
        id: 'n1',
        type: 'process',
        name: 'Process Node',
        description: 'desc',
        connectedTo: ['n2'],
      };
      expect(node.type).toBe('process');
    });

    it('should allow creating AuditQuery objects', () => {
      const query: AuditQuery = {
        sessionId: 's1',
        eventTypes: ['decision', 'error'],
        limit: 10,
      };
      expect(query.limit).toBe(10);
    });

    it('should allow creating AuditQueryResult objects', () => {
      const result: AuditQueryResult = {
        events: [],
        total: 0,
        hasMore: false,
        aggregations: {
          totalCost: 0,
          avgLatency: 0,
          successRate: 1,
          eventTypeCounts: {},
          componentCounts: {},
        },
      };
      expect(result.total).toBe(0);
    });
  });

  // ===========================================================================
  // CONSTRUCTION
  // ===========================================================================

  describe('construction', () => {
    it('should construct with sessionId and userId', () => {
      const instance = new AuditTrail('s1', 'u1', { persistToDb: false });
      expect(instance).toBeInstanceOf(AuditTrail);
    });

    it('should construct with no options', () => {
      const instance = new AuditTrail('s1', 'u1');
      expect(instance).toBeInstanceOf(AuditTrail);
    });

    it('should construct with persistToDb option', () => {
      const instance = new AuditTrail('s1', 'u1', { persistToDb: true });
      expect(instance).toBeInstanceOf(AuditTrail);
    });

    it('should construct with onStream callback', () => {
      const callback = vi.fn();
      const instance = new AuditTrail('s1', 'u1', {
        persistToDb: false,
        onStream: callback,
      });
      expect(instance).toBeInstanceOf(AuditTrail);
    });

    it('should start with empty events', () => {
      expect(trail.getEvents()).toEqual([]);
    });

    it('should start with empty reasoning chains', () => {
      expect(trail.getReasoningChains()).toEqual([]);
    });
  });

  // ===========================================================================
  // FACTORY FUNCTION
  // ===========================================================================

  describe('createAuditTrail', () => {
    it('should create an AuditTrail instance', () => {
      const instance = createAuditTrail('s1', 'u1', { persistToDb: false });
      expect(instance).toBeInstanceOf(AuditTrail);
    });

    it('should create instance without options', () => {
      const instance = createAuditTrail('s1', 'u1');
      expect(instance).toBeInstanceOf(AuditTrail);
    });
  });

  // ===========================================================================
  // METHOD EXISTENCE
  // ===========================================================================

  describe('method existence', () => {
    it('should have logDecision method', () => {
      expect(typeof trail.logDecision).toBe('function');
    });

    it('should have logInference method', () => {
      expect(typeof trail.logInference).toBe('function');
    });

    it('should have logToolCall method', () => {
      expect(typeof trail.logToolCall).toBe('function');
    });

    it('should have logError method', () => {
      expect(typeof trail.logError).toBe('function');
    });

    it('should have logEvent method', () => {
      expect(typeof trail.logEvent).toBe('function');
    });

    it('should have startReasoningChain method', () => {
      expect(typeof trail.startReasoningChain).toBe('function');
    });

    it('should have addReasoningStep method', () => {
      expect(typeof trail.addReasoningStep).toBe('function');
    });

    it('should have completeReasoningChain method', () => {
      expect(typeof trail.completeReasoningChain).toBe('function');
    });

    it('should have explainDecision method', () => {
      expect(typeof trail.explainDecision).toBe('function');
    });

    it('should have generateReport method', () => {
      expect(typeof trail.generateReport).toBe('function');
    });

    it('should have query method', () => {
      expect(typeof trail.query).toBe('function');
    });

    it('should have queryFromDatabase method', () => {
      expect(typeof trail.queryFromDatabase).toBe('function');
    });

    it('should have persistAll method', () => {
      expect(typeof trail.persistAll).toBe('function');
    });

    it('should have getEvents method', () => {
      expect(typeof trail.getEvents).toBe('function');
    });

    it('should have getReasoningChains method', () => {
      expect(typeof trail.getReasoningChains).toBe('function');
    });
  });

  // ===========================================================================
  // EVENT LOGGING
  // ===========================================================================

  describe('logEvent', () => {
    it('should log a generic event and return it', async () => {
      const event = await trail.logEvent('decision', 'TestComp', 'testAction', {
        success: true,
      });
      expect(event).toBeDefined();
      expect(event.id).toMatch(/^audit_/);
      expect(event.sessionId).toBe('session-1');
      expect(event.userId).toBe('user-1');
      expect(event.eventType).toBe('decision');
      expect(event.component).toBe('TestComp');
      expect(event.action).toBe('testAction');
      expect(event.success).toBe(true);
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('should store the event in the local events array', async () => {
      await trail.logEvent('tool_call', 'Comp', 'action', { success: true });
      const events = trail.getEvents();
      expect(events).toHaveLength(1);
    });

    it('should default success to true when not specified', async () => {
      const event = await trail.logEvent('routing', 'Router', 'route', {});
      expect(event.success).toBe(true);
    });

    it('should include optional fields when provided', async () => {
      const event = await trail.logEvent('inference', 'AI', 'classify', {
        success: true,
        modelUsed: 'sonnet',
        inputSummary: 'input text',
        outputSummary: 'output text',
        reasoning: ['reason1', 'reason2'],
        cost: 0.05,
        latencyMs: 1200,
        errorMessage: undefined,
        parentEventId: 'parent-1',
      });
      expect(event.modelUsed).toBe('sonnet');
      expect(event.inputSummary).toBe('input text');
      expect(event.outputSummary).toBe('output text');
      expect(event.reasoning).toEqual(['reason1', 'reason2']);
      expect(event.cost).toBe(0.05);
      expect(event.latencyMs).toBe(1200);
      expect(event.parentEventId).toBe('parent-1');
    });

    it('should add inference events to the current reasoning chain', async () => {
      trail.startReasoningChain('Test chain');
      await trail.logEvent('inference', 'AI', 'infer', {
        success: true,
        inputSummary: 'in',
        outputSummary: 'out',
        reasoning: ['r1'],
        modelUsed: 'haiku',
        latencyMs: 100,
      });

      // Complete the chain to capture its state
      trail.completeReasoningChain('done', 0.9);
      const chains = trail.getReasoningChains();
      expect(chains).toHaveLength(1);
      expect(chains[0].steps).toHaveLength(1);
      expect(chains[0].steps[0].stepNumber).toBe(1);
      expect(chains[0].steps[0].input).toBe('in');
      expect(chains[0].steps[0].output).toBe('out');
    });

    it('should call onStream for decision events', async () => {
      const streamCallback = vi.fn();
      const streamTrail = new AuditTrail('s1', 'u1', {
        persistToDb: false,
        onStream: streamCallback,
      });
      await streamTrail.logEvent('decision', 'Router', 'select_model', {
        success: true,
      });
      expect(streamCallback).toHaveBeenCalledTimes(1);
      expect(streamCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'synthesis_progress',
          message: '[Audit] Router: select_model',
        })
      );
    });

    it('should NOT call onStream for non-decision events', async () => {
      const streamCallback = vi.fn();
      const streamTrail = new AuditTrail('s1', 'u1', {
        persistToDb: false,
        onStream: streamCallback,
      });
      await streamTrail.logEvent('inference', 'AI', 'classify', { success: true });
      expect(streamCallback).not.toHaveBeenCalled();
    });
  });

  describe('logDecision', () => {
    it('should log a decision event and return its id', async () => {
      const eventId = await trail.logDecision('Router', 'select_model', {
        reasoning: ['faster', 'cheaper'],
      });
      expect(typeof eventId).toBe('string');
      expect(eventId).toMatch(/^audit_/);

      const events = trail.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('decision');
      expect(events[0].success).toBe(true);
    });

    it('should include alternatives in details', async () => {
      await trail.logDecision('Router', 'select_model', {
        reasoning: ['reason'],
        alternatives: [{ option: 'opus', whyNotChosen: 'too expensive' }],
        confidence: 0.9,
        dataUsed: ['usage stats'],
      });
      const events = trail.getEvents();
      expect(events[0].details).toHaveProperty('alternatives');
      expect(events[0].details).toHaveProperty('confidence');
      expect(events[0].details).toHaveProperty('dataUsed');
    });
  });

  describe('logInference', () => {
    it('should log an inference event and return its id', async () => {
      const eventId = await trail.logInference('AI', 'classify', {
        inputSummary: 'user query',
        outputSummary: 'classification result',
        modelUsed: 'haiku',
      });
      expect(typeof eventId).toBe('string');
      const events = trail.getEvents();
      expect(events[0].eventType).toBe('inference');
      expect(events[0].inputSummary).toBe('user query');
      expect(events[0].outputSummary).toBe('classification result');
      expect(events[0].modelUsed).toBe('haiku');
    });

    it('should default success to true', async () => {
      await trail.logInference('AI', 'gen', {
        inputSummary: 'in',
        outputSummary: 'out',
        modelUsed: 'sonnet',
      });
      const events = trail.getEvents();
      expect(events[0].success).toBe(true);
    });

    it('should allow marking inference as failed', async () => {
      await trail.logInference(
        'AI',
        'gen',
        {
          inputSummary: 'in',
          outputSummary: '',
          modelUsed: 'opus',
        },
        { success: false, errorMessage: 'timeout' }
      );
      const events = trail.getEvents();
      expect(events[0].success).toBe(false);
    });
  });

  describe('logToolCall', () => {
    it('should log a tool call event', async () => {
      const eventId = await trail.logToolCall('Scout', 'brave_search', {
        input: { query: 'test query' },
        output: { results: [] },
        success: true,
      });
      expect(typeof eventId).toBe('string');
      const events = trail.getEvents();
      expect(events[0].eventType).toBe('tool_call');
      expect(events[0].action).toBe('brave_search');
    });

    it('should log a failed tool call', async () => {
      await trail.logToolCall('Scout', 'web_scrape', {
        input: { url: 'https://example.com' },
        success: false,
        errorMessage: 'Connection refused',
      });
      const events = trail.getEvents();
      expect(events[0].success).toBe(false);
    });
  });

  describe('logError', () => {
    it('should log an error from an Error object', async () => {
      const eventId = await trail.logError('AI', 'inference', new Error('API timeout'));
      expect(typeof eventId).toBe('string');
      const events = trail.getEvents();
      expect(events[0].eventType).toBe('error');
      expect(events[0].success).toBe(false);
      expect(events[0].details.errorMessage).toBe('API timeout');
    });

    it('should log an error from a string', async () => {
      await trail.logError('DB', 'query', 'Connection lost');
      const events = trail.getEvents();
      expect(events[0].details.errorMessage).toBe('Connection lost');
    });

    it('should include context in error details', async () => {
      await trail.logError('Scout', 'search', 'Rate limited', {
        retryAfter: 60,
      });
      const events = trail.getEvents();
      expect(events[0].details.context).toEqual({ retryAfter: 60 });
    });
  });

  // ===========================================================================
  // REASONING CHAINS
  // ===========================================================================

  describe('reasoning chains', () => {
    it('should start a reasoning chain and return its id', () => {
      const chainId = trail.startReasoningChain('Analysis chain');
      expect(typeof chainId).toBe('string');
      expect(chainId).toMatch(/^chain_/);
    });

    it('should add steps to the current chain', () => {
      trail.startReasoningChain('Test');
      trail.addReasoningStep({
        action: 'analyze',
        input: 'data',
        output: 'result',
        reasoning: 'because',
        confidence: 0.9,
      });
      trail.completeReasoningChain('done', 0.85);

      const chains = trail.getReasoningChains();
      expect(chains).toHaveLength(1);
      expect(chains[0].steps).toHaveLength(1);
      expect(chains[0].steps[0].stepNumber).toBe(1);
      expect(chains[0].steps[0].action).toBe('analyze');
    });

    it('should auto-increment step numbers', () => {
      trail.startReasoningChain('Multi-step');
      trail.addReasoningStep({
        action: 'step1',
        input: '',
        output: '',
        reasoning: '',
        confidence: 0.8,
      });
      trail.addReasoningStep({
        action: 'step2',
        input: '',
        output: '',
        reasoning: '',
        confidence: 0.9,
      });
      trail.completeReasoningChain('done', 0.85);

      const chains = trail.getReasoningChains();
      expect(chains[0].steps[0].stepNumber).toBe(1);
      expect(chains[0].steps[1].stepNumber).toBe(2);
    });

    it('should handle addReasoningStep with no active chain gracefully', () => {
      // Should not throw, just warn
      expect(() => {
        trail.addReasoningStep({
          action: 'orphan',
          input: '',
          output: '',
          reasoning: '',
          confidence: 0.5,
        });
      }).not.toThrow();
    });

    it('should handle completeReasoningChain with no active chain gracefully', () => {
      expect(() => {
        trail.completeReasoningChain('no chain', 0.5);
      }).not.toThrow();
    });

    it('should store conclusion and confidence on completion', () => {
      trail.startReasoningChain('Conclusion test');
      trail.completeReasoningChain('The analysis is complete', 0.95);

      const chains = trail.getReasoningChains();
      expect(chains[0].conclusion).toBe('The analysis is complete');
      expect(chains[0].overallConfidence).toBe(0.95);
    });

    it('should support multiple completed chains', () => {
      trail.startReasoningChain('Chain 1');
      trail.completeReasoningChain('done1', 0.8);

      trail.startReasoningChain('Chain 2');
      trail.completeReasoningChain('done2', 0.9);

      const chains = trail.getReasoningChains();
      expect(chains).toHaveLength(2);
      expect(chains[0].title).toBe('Chain 1');
      expect(chains[1].title).toBe('Chain 2');
    });
  });

  // ===========================================================================
  // EXPLAIN DECISION
  // ===========================================================================

  describe('explainDecision', () => {
    it('should return null for non-existent event', () => {
      const explanation = trail.explainDecision('nonexistent-id');
      expect(explanation).toBeNull();
    });

    it('should return null for non-decision events', async () => {
      const eventId = await trail.logInference('AI', 'infer', {
        inputSummary: 'in',
        outputSummary: 'out',
        modelUsed: 'haiku',
      });
      const explanation = trail.explainDecision(eventId);
      expect(explanation).toBeNull();
    });

    it('should generate a decision explanation for a decision event', async () => {
      const eventId = await trail.logDecision('Router', 'route_request', {
        reasoning: ['Low complexity', 'Cost-effective'],
        alternatives: [{ option: 'opus', whyNotChosen: 'too expensive' }],
        dataUsed: ['query analysis'],
      });
      const explanation = trail.explainDecision(eventId);
      expect(explanation).not.toBeNull();
      expect(explanation!.decisionId).toBe(eventId);
      expect(explanation!.decisionType).toBe('route_request');
      expect(explanation!.reasoning).toEqual(['Low complexity', 'Cost-effective']);
      expect(explanation!.alternatives).toHaveLength(1);
      expect(explanation!.dataUsed).toEqual(['query analysis']);
      expect(explanation!.summary).toContain('Router');
      expect(explanation!.summary).toContain('route_request');
    });

    it('should generate human-readable summary with reasoning', async () => {
      const eventId = await trail.logDecision('ModelSelector', 'pick_model', {
        reasoning: ['Speed matters here'],
      });
      const explanation = trail.explainDecision(eventId);
      expect(explanation!.humanReadableSummary).toContain('ModelSelector');
      expect(explanation!.humanReadableSummary).toContain('pick_model');
      expect(explanation!.humanReadableSummary).toContain('Speed matters here');
    });

    it('should mention model used in modelContribution', async () => {
      const eventId = await trail.logDecision(
        'Classifier',
        'classify',
        { reasoning: ['accurate'] },
        { modelUsed: 'opus' }
      );
      const explanation = trail.explainDecision(eventId);
      expect(explanation!.modelContribution).toContain('opus');
    });

    it('should note when no model was used', async () => {
      const eventId = await trail.logDecision('RuleBased', 'apply_rule', {
        reasoning: ['deterministic'],
      });
      const explanation = trail.explainDecision(eventId);
      expect(explanation!.modelContribution).toContain('No AI model');
    });

    it('should extract confidence factors from reasoning', async () => {
      const eventId = await trail.logDecision('Comp', 'act', {
        reasoning: ['factor1', 'factor2'],
      });
      const explanation = trail.explainDecision(eventId);
      expect(explanation!.confidenceFactors).toHaveLength(2);
      expect(explanation!.confidenceFactors[0].factor).toBe('factor1');
      expect(explanation!.confidenceFactors[0].weight).toBe(0.5);
      expect(explanation!.confidenceFactors[1].weight).toBe(0.5);
    });
  });

  // ===========================================================================
  // GENERATE REPORT
  // ===========================================================================

  describe('generateReport', () => {
    it('should generate an empty report with no events', () => {
      const report = trail.generateReport();
      expect(report).toBeDefined();
      expect(report.reportId).toMatch(/^report_/);
      expect(report.sessionId).toBe('session-1');
      expect(report.userId).toBe('user-1');
      expect(report.summary.totalDecisions).toBe(0);
      expect(report.summary.totalInferences).toBe(0);
      expect(report.summary.totalCost).toBe(0);
      expect(report.summary.totalDuration).toBe(0);
      expect(report.summary.successRate).toBe(1);
      expect(report.decisionBreakdown).toEqual([]);
      expect(report.keyDecisions).toEqual([]);
      expect(report.dataFlow).toEqual([]);
    });

    it('should count decisions and inferences correctly', async () => {
      await trail.logDecision('A', 'act1', { reasoning: ['r'] });
      await trail.logDecision('B', 'act2', { reasoning: ['r'] });
      await trail.logInference('C', 'infer', {
        inputSummary: 'in',
        outputSummary: 'out',
        modelUsed: 'haiku',
      });

      const report = trail.generateReport();
      expect(report.summary.totalDecisions).toBe(2);
      expect(report.summary.totalInferences).toBe(1);
    });

    it('should calculate total cost and duration', async () => {
      await trail.logEvent('decision', 'A', 'act', {
        success: true,
        cost: 0.01,
        latencyMs: 100,
      });
      await trail.logEvent('inference', 'B', 'infer', {
        success: true,
        cost: 0.05,
        latencyMs: 500,
      });

      const report = trail.generateReport();
      expect(report.summary.totalCost).toBeCloseTo(0.06, 5);
      expect(report.summary.totalDuration).toBe(600);
    });

    it('should calculate success rate', async () => {
      await trail.logEvent('decision', 'A', 'act', { success: true });
      await trail.logEvent('error', 'B', 'fail', { success: false });

      const report = trail.generateReport();
      expect(report.summary.successRate).toBe(0.5);
    });

    it('should produce decision breakdown by component', async () => {
      await trail.logDecision('CompA', 'act1', { reasoning: ['r'] });
      await trail.logDecision('CompA', 'act2', { reasoning: ['r'] });
      await trail.logDecision('CompB', 'act3', { reasoning: ['r'] });

      const report = trail.generateReport();
      expect(report.decisionBreakdown).toHaveLength(2);

      const compA = report.decisionBreakdown.find((d) => d.component === 'CompA');
      expect(compA).toBeDefined();
      expect(compA!.decisionCount).toBe(2);

      const compB = report.decisionBreakdown.find((d) => d.component === 'CompB');
      expect(compB).toBeDefined();
      expect(compB!.decisionCount).toBe(1);
    });

    it('should include completed reasoning chains', () => {
      trail.startReasoningChain('My Chain');
      trail.completeReasoningChain('done', 0.8);

      const report = trail.generateReport();
      expect(report.reasoningChains).toHaveLength(1);
      expect(report.reasoningChains[0].title).toBe('My Chain');
    });

    it('should build data flow from events', async () => {
      await trail.logEvent('inference', 'AI', 'classify', { success: true });
      await trail.logEvent('tool_call', 'Scout', 'search', { success: true });

      const report = trail.generateReport();
      expect(report.dataFlow.length).toBeGreaterThan(0);
    });

    it('should generate recommendations for high error rates', async () => {
      // Create 10 events, 3 failures -> 30% error rate (> 10%)
      for (let i = 0; i < 7; i++) {
        await trail.logEvent('decision', 'C', 'ok', { success: true });
      }
      for (let i = 0; i < 3; i++) {
        await trail.logEvent('error', 'C', 'fail', { success: false });
      }

      const report = trail.generateReport();
      const errorRecommendation = report.recommendations.find((r) => r.includes('error rate'));
      expect(errorRecommendation).toBeDefined();
    });
  });

  // ===========================================================================
  // QUERY
  // ===========================================================================

  describe('query', () => {
    beforeEach(async () => {
      await trail.logEvent('decision', 'Router', 'route', {
        success: true,
        cost: 0.01,
        latencyMs: 100,
      });
      await trail.logEvent('inference', 'AI', 'classify', {
        success: true,
        cost: 0.05,
        latencyMs: 500,
      });
      await trail.logEvent('error', 'Scout', 'search', {
        success: false,
        cost: 0,
        latencyMs: 200,
      });
    });

    it('should return all events with empty query', () => {
      const result = trail.query({});
      expect(result.events).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by sessionId', () => {
      const result = trail.query({ sessionId: 'session-1' });
      expect(result.events).toHaveLength(3);

      const result2 = trail.query({ sessionId: 'other-session' });
      expect(result2.events).toHaveLength(0);
    });

    it('should filter by userId', () => {
      const result = trail.query({ userId: 'user-1' });
      expect(result.events).toHaveLength(3);

      const result2 = trail.query({ userId: 'other-user' });
      expect(result2.events).toHaveLength(0);
    });

    it('should filter by eventTypes', () => {
      const result = trail.query({ eventTypes: ['decision'] });
      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('decision');
    });

    it('should filter by multiple eventTypes', () => {
      const result = trail.query({ eventTypes: ['decision', 'error'] });
      expect(result.events).toHaveLength(2);
    });

    it('should filter by component', () => {
      const result = trail.query({ component: 'AI' });
      expect(result.events).toHaveLength(1);
      expect(result.events[0].component).toBe('AI');
    });

    it('should filter by successOnly', () => {
      const result = trail.query({ successOnly: true });
      expect(result.events).toHaveLength(2);
      expect(result.events.every((e) => e.success)).toBe(true);
    });

    it('should filter by minCost', () => {
      const result = trail.query({ minCost: 0.04 });
      expect(result.events).toHaveLength(1);
      expect(result.events[0].cost).toBe(0.05);
    });

    it('should apply pagination with limit', () => {
      const result = trail.query({ limit: 2 });
      expect(result.events).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should apply pagination with offset', () => {
      const result = trail.query({ offset: 1, limit: 2 });
      expect(result.events).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it('should calculate aggregations correctly', () => {
      const result = trail.query({});
      expect(result.aggregations.totalCost).toBeCloseTo(0.06, 5);
      expect(result.aggregations.avgLatency).toBeCloseTo(266.67, 0);
      expect(result.aggregations.successRate).toBeCloseTo(0.6667, 2);
      expect(result.aggregations.eventTypeCounts['decision']).toBe(1);
      expect(result.aggregations.eventTypeCounts['inference']).toBe(1);
      expect(result.aggregations.eventTypeCounts['error']).toBe(1);
      expect(result.aggregations.componentCounts['Router']).toBe(1);
      expect(result.aggregations.componentCounts['AI']).toBe(1);
      expect(result.aggregations.componentCounts['Scout']).toBe(1);
    });
  });

  // ===========================================================================
  // GET EVENTS / GET REASONING CHAINS (return copies)
  // ===========================================================================

  describe('getEvents returns a copy', () => {
    it('should return a copy, not a reference', async () => {
      await trail.logEvent('decision', 'A', 'act', { success: true });
      const events1 = trail.getEvents();
      const events2 = trail.getEvents();
      expect(events1).not.toBe(events2);
      expect(events1).toEqual(events2);
    });
  });

  describe('getReasoningChains returns a copy', () => {
    it('should return a copy, not a reference', () => {
      trail.startReasoningChain('Chain');
      trail.completeReasoningChain('done', 0.8);
      const chains1 = trail.getReasoningChains();
      const chains2 = trail.getReasoningChains();
      expect(chains1).not.toBe(chains2);
      expect(chains1).toEqual(chains2);
    });
  });

  // ===========================================================================
  // PERSISTENCE (mocked - just ensure no throw)
  // ===========================================================================

  describe('persistAll', () => {
    it('should not throw when Supabase is unavailable', async () => {
      await expect(trail.persistAll()).resolves.toBeUndefined();
    });
  });

  describe('queryFromDatabase', () => {
    it('should fall back to in-memory query when Supabase is unavailable', async () => {
      await trail.logEvent('decision', 'A', 'act', { success: true });
      const result = await trail.queryFromDatabase({});
      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
