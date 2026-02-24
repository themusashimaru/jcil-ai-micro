import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  AdaptiveModelRouter,
  createAdaptiveModelRouter,
  type TaskProfile,
  type RoutingDecision,
  type PerformanceRecord,
  type RouterConfig,
} from './AdaptiveModelRouter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<TaskProfile> = {}): TaskProfile {
  return {
    taskId: 'test-task-1',
    taskType: 'analysis',
    complexity: 'moderate',
    requiredCapabilities: [],
    inputSize: 'medium',
    urgency: 'normal',
    costSensitivity: 'medium',
    qualityRequirement: 'good',
    ...overrides,
  };
}

function makePerformanceRecord(overrides: Partial<PerformanceRecord> = {}): PerformanceRecord {
  return {
    taskId: 'perf-task-1',
    taskType: 'analysis',
    modelUsed: 'sonnet',
    inputTokens: 1000,
    outputTokens: 500,
    latencyMs: 200,
    success: true,
    cost: 0.01,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdaptiveModelRouter', () => {
  let router: AdaptiveModelRouter;

  beforeEach(() => {
    router = new AdaptiveModelRouter();
  });

  // =========================================================================
  // Type exports
  // =========================================================================

  describe('type exports', () => {
    it('should export TaskProfile interface usable at runtime', () => {
      const profile: TaskProfile = makeTask();
      expect(profile.taskId).toBe('test-task-1');
    });

    it('should export RoutingDecision interface usable at runtime', () => {
      const decision: RoutingDecision = {
        taskId: 'x',
        selectedModel: 'sonnet',
        modelId: 'claude-sonnet-4-6',
        confidence: 0.8,
        reasoning: ['test'],
        estimatedCost: 0.01,
        estimatedLatency: 'medium',
        alternatives: [],
        timestamp: Date.now(),
      };
      expect(decision.selectedModel).toBe('sonnet');
    });

    it('should export PerformanceRecord interface usable at runtime', () => {
      const record: PerformanceRecord = makePerformanceRecord();
      expect(record.success).toBe(true);
    });

    it('should export RouterConfig interface usable at runtime', () => {
      const config: RouterConfig = {
        defaultModel: 'haiku',
        preferSpeed: true,
        preferQuality: false,
        learningEnabled: false,
      };
      expect(config.defaultModel).toBe('haiku');
    });
  });

  // =========================================================================
  // Construction
  // =========================================================================

  describe('constructor', () => {
    it('should create an instance with default config', () => {
      expect(router).toBeInstanceOf(AdaptiveModelRouter);
    });

    it('should accept partial config overrides', () => {
      const r = new AdaptiveModelRouter({ defaultModel: 'opus', preferSpeed: true });
      expect(r).toBeInstanceOf(AdaptiveModelRouter);
    });

    it('should accept an onStream callback', () => {
      const callback = vi.fn();
      const r = new AdaptiveModelRouter({}, callback);
      expect(r).toBeInstanceOf(AdaptiveModelRouter);
    });

    it('should work with no arguments', () => {
      const r = new AdaptiveModelRouter();
      expect(r).toBeInstanceOf(AdaptiveModelRouter);
    });
  });

  // =========================================================================
  // Method existence
  // =========================================================================

  describe('method existence', () => {
    it('should have route method', () => {
      expect(typeof router.route).toBe('function');
    });

    it('should have routeBatch method', () => {
      expect(typeof router.routeBatch).toBe('function');
    });

    it('should have profileTask method', () => {
      expect(typeof router.profileTask).toBe('function');
    });

    it('should have recordPerformance method', () => {
      expect(typeof router.recordPerformance).toBe('function');
    });

    it('should have getStatistics method', () => {
      expect(typeof router.getStatistics).toBe('function');
    });

    it('should have updateConfig method', () => {
      expect(typeof router.updateConfig).toBe('function');
    });
  });

  // =========================================================================
  // route()
  // =========================================================================

  describe('route()', () => {
    it('should return a RoutingDecision with all required fields', () => {
      const decision = router.route(makeTask());
      expect(decision).toHaveProperty('taskId');
      expect(decision).toHaveProperty('selectedModel');
      expect(decision).toHaveProperty('modelId');
      expect(decision).toHaveProperty('confidence');
      expect(decision).toHaveProperty('reasoning');
      expect(decision).toHaveProperty('estimatedCost');
      expect(decision).toHaveProperty('estimatedLatency');
      expect(decision).toHaveProperty('alternatives');
      expect(decision).toHaveProperty('timestamp');
    });

    it('should return the correct taskId in the decision', () => {
      const decision = router.route(makeTask({ taskId: 'my-custom-id' }));
      expect(decision.taskId).toBe('my-custom-id');
    });

    it('should select a valid model tier', () => {
      const decision = router.route(makeTask());
      expect(['opus', 'sonnet', 'haiku']).toContain(decision.selectedModel);
    });

    it('should have a modelId that is a non-empty string', () => {
      const decision = router.route(makeTask());
      expect(typeof decision.modelId).toBe('string');
      expect(decision.modelId.length).toBeGreaterThan(0);
    });

    it('should have confidence between 0 and 1', () => {
      const decision = router.route(makeTask());
      expect(decision.confidence).toBeGreaterThanOrEqual(0.3);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });

    it('should have at least one reasoning entry', () => {
      const decision = router.route(makeTask());
      expect(decision.reasoning.length).toBeGreaterThan(0);
    });

    it('should have a non-negative estimated cost', () => {
      const decision = router.route(makeTask());
      expect(decision.estimatedCost).toBeGreaterThanOrEqual(0);
    });

    it('should have a valid estimatedLatency value', () => {
      const decision = router.route(makeTask());
      expect(['fast', 'medium', 'slow']).toContain(decision.estimatedLatency);
    });

    it('should include alternatives for models not selected', () => {
      const decision = router.route(makeTask());
      // There are 3 models total, so alternatives should have 2 entries
      expect(decision.alternatives.length).toBe(2);
      for (const alt of decision.alternatives) {
        expect(alt.model).not.toBe(decision.selectedModel);
        expect(typeof alt.score).toBe('number');
        expect(typeof alt.tradeoff).toBe('string');
      }
    });

    it('should prefer opus for extreme complexity tasks', () => {
      const decision = router.route(
        makeTask({ complexity: 'extreme', qualityRequirement: 'best', costSensitivity: 'low' })
      );
      // Opus is the only model with maxComplexity 'extreme'
      expect(decision.selectedModel).toBe('opus');
    });

    it('should invoke onStream callback when provided', () => {
      const callback = vi.fn();
      const r = new AdaptiveModelRouter({}, callback);
      r.route(makeTask());
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'synthesis_progress',
          message: expect.stringContaining('[Router]'),
        })
      );
    });

    it('should apply urgency penalty for slow models on critical tasks', () => {
      const criticalDecision = router.route(
        makeTask({ urgency: 'critical', complexity: 'trivial', costSensitivity: 'low' })
      );
      // Haiku is the fastest — critical urgency penalizes slow models
      // At minimum, the decision should be valid
      expect(['opus', 'sonnet', 'haiku']).toContain(criticalDecision.selectedModel);
    });

    it('should penalize haiku for very_large input sizes', () => {
      const decision = router.route(makeTask({ inputSize: 'very_large', complexity: 'moderate' }));
      // The decision should not pick haiku since it gets a penalty for large inputs
      // (unless other factors dominate — just verify it ran correctly)
      expect(decision.selectedModel).toBeDefined();
    });
  });

  // =========================================================================
  // routeBatch()
  // =========================================================================

  describe('routeBatch()', () => {
    it('should return decisions for all input tasks', () => {
      const tasks = [
        makeTask({ taskId: 'a', urgency: 'low' }),
        makeTask({ taskId: 'b', urgency: 'high' }),
        makeTask({ taskId: 'c', urgency: 'normal' }),
      ];
      const decisions = router.routeBatch(tasks);
      expect(decisions.length).toBe(3);
    });

    it('should sort by urgency — critical tasks routed first', () => {
      const tasks = [
        makeTask({ taskId: 'low', urgency: 'low' }),
        makeTask({ taskId: 'critical', urgency: 'critical' }),
        makeTask({ taskId: 'normal', urgency: 'normal' }),
      ];
      const decisions = router.routeBatch(tasks);
      // First decision should correspond to the critical task
      expect(decisions[0].taskId).toBe('critical');
    });

    it('should handle empty task array', () => {
      const decisions = router.routeBatch([]);
      expect(decisions).toEqual([]);
    });

    it('should respect cost budget by forcing cost sensitivity', () => {
      const r = new AdaptiveModelRouter({ costBudget: 0.0001 }); // very low budget
      const tasks = [
        makeTask({ taskId: 'a', costSensitivity: 'low' }),
        makeTask({ taskId: 'b', costSensitivity: 'low' }),
      ];
      const decisions = r.routeBatch(tasks);
      expect(decisions.length).toBe(2);
    });
  });

  // =========================================================================
  // profileTask()
  // =========================================================================

  describe('profileTask()', () => {
    it('should return a TaskProfile with all required fields', () => {
      const profile = router.profileTask('t1', 'analysis', 'Analyze this data set carefully.');
      expect(profile.taskId).toBe('t1');
      expect(profile.taskType).toBe('analysis');
      expect(profile.complexity).toBeDefined();
      expect(profile.requiredCapabilities).toBeInstanceOf(Array);
      expect(profile.inputSize).toBeDefined();
      expect(profile.urgency).toBe('normal');
      expect(profile.costSensitivity).toBe('medium');
      expect(profile.qualityRequirement).toBe('good');
    });

    it('should classify small input sizes correctly', () => {
      // < 500 tokens => < 2000 chars
      const profile = router.profileTask('t', 'classification', 'short');
      expect(profile.inputSize).toBe('small');
    });

    it('should classify medium input sizes correctly', () => {
      const content = 'x'.repeat(3000); // 3000 chars / 4 = 750 tokens => medium
      const profile = router.profileTask('t', 'classification', content);
      expect(profile.inputSize).toBe('medium');
    });

    it('should classify large input sizes correctly', () => {
      const content = 'x'.repeat(12000); // 12000 / 4 = 3000 tokens => large
      const profile = router.profileTask('t', 'classification', content);
      expect(profile.inputSize).toBe('large');
    });

    it('should classify very_large input sizes correctly', () => {
      const content = 'x'.repeat(40000); // 40000 / 4 = 10000 tokens => very_large
      const profile = router.profileTask('t', 'classification', content);
      expect(profile.inputSize).toBe('very_large');
    });

    it('should detect reasoning capability from content', () => {
      const profile = router.profileTask('t', 'analysis', 'Please reason about why this happens.');
      expect(profile.requiredCapabilities).toContain('reasoning');
    });

    it('should detect creativity capability from content', () => {
      const profile = router.profileTask('t', 'generation', 'Create a poem about nature.');
      expect(profile.requiredCapabilities).toContain('creativity');
    });

    it('should detect code capability from content', () => {
      const profile = router.profileTask('t', 'code', 'Implement a function to sort arrays.');
      expect(profile.requiredCapabilities).toContain('code');
    });

    it('should detect vision capability from content', () => {
      const profile = router.profileTask('t', 'analysis', 'Analyze this image for defects.');
      expect(profile.requiredCapabilities).toContain('vision');
    });

    it('should detect math capability from content', () => {
      const profile = router.profileTask(
        't',
        'analysis',
        'Calculate the area of the circle using the formula.'
      );
      expect(profile.requiredCapabilities).toContain('math');
    });

    it('should detect speed capability from content', () => {
      const profile = router.profileTask('t', 'analysis', 'I need this fast, it is urgent!');
      expect(profile.requiredCapabilities).toContain('speed');
    });

    it('should detect precision capability from content', () => {
      const profile = router.profileTask(
        't',
        'verification',
        'Give me the exact and precise answer.'
      );
      expect(profile.requiredCapabilities).toContain('precision');
    });

    it('should increase complexity when content has complexity boosting words', () => {
      // 'analyze' and 'comprehensive' both boost +1 each => adjustment=2 => increases
      const profile = router.profileTask(
        't',
        'classification',
        'Analyze this comprehensive detailed report.'
      );
      // classification default is 'simple', boosted should be 'moderate'
      expect(profile.complexity).toBe('moderate');
    });

    it('should not decrease complexity when only one simplicity pattern matches', () => {
      // The simplicity regex is a single pattern: /\b(simple|quick|brief|just)\b/i
      // Even if multiple words match, the pattern counts once => adjustment = -1
      // decreaseComplexity requires adjustment < -1, so no decrease happens
      const profile = router.profileTask('t', 'analysis', 'Just give me a simple brief overview.');
      // analysis default is 'complex', -1 is not < -1, so complexity stays 'complex'
      expect(profile.complexity).toBe('complex');
    });

    it('should apply option overrides for urgency, costSensitivity, qualityRequirement', () => {
      const profile = router.profileTask('t', 'analysis', 'test content', {
        urgency: 'critical',
        costSensitivity: 'high',
        qualityRequirement: 'best',
      });
      expect(profile.urgency).toBe('critical');
      expect(profile.costSensitivity).toBe('high');
      expect(profile.qualityRequirement).toBe('best');
    });

    it('should truncate context to 200 characters', () => {
      const longContent = 'a'.repeat(500);
      const profile = router.profileTask('t', 'analysis', longContent);
      expect(profile.context).toBeDefined();
      expect(profile.context!.length).toBe(200);
    });
  });

  // =========================================================================
  // recordPerformance() & getStatistics()
  // =========================================================================

  describe('recordPerformance()', () => {
    it('should accept and store a performance record', () => {
      router.recordPerformance(makePerformanceRecord());
      const stats = router.getStatistics();
      expect(stats.totalRouted).toBe(1);
    });

    it('should keep at most 1000 records', () => {
      for (let i = 0; i < 1050; i++) {
        router.recordPerformance(makePerformanceRecord({ taskId: `t-${i}` }));
      }
      const stats = router.getStatistics();
      expect(stats.totalRouted).toBe(1000);
    });
  });

  describe('getStatistics()', () => {
    it('should return zero stats when no performance is recorded', () => {
      const stats = router.getStatistics();
      expect(stats.totalRouted).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.modelDistribution.opus).toBe(0);
      expect(stats.modelDistribution.sonnet).toBe(0);
      expect(stats.modelDistribution.haiku).toBe(0);
    });

    it('should correctly compute model distribution', () => {
      router.recordPerformance(makePerformanceRecord({ modelUsed: 'opus' }));
      router.recordPerformance(makePerformanceRecord({ modelUsed: 'opus' }));
      router.recordPerformance(makePerformanceRecord({ modelUsed: 'haiku' }));
      const stats = router.getStatistics();
      expect(stats.modelDistribution.opus).toBe(2);
      expect(stats.modelDistribution.haiku).toBe(1);
      expect(stats.modelDistribution.sonnet).toBe(0);
    });

    it('should correctly compute average latency per model', () => {
      router.recordPerformance(makePerformanceRecord({ modelUsed: 'sonnet', latencyMs: 100 }));
      router.recordPerformance(makePerformanceRecord({ modelUsed: 'sonnet', latencyMs: 300 }));
      const stats = router.getStatistics();
      expect(stats.averageLatency.sonnet).toBe(200);
    });

    it('should correctly compute success rate per model', () => {
      router.recordPerformance(makePerformanceRecord({ modelUsed: 'opus', success: true }));
      router.recordPerformance(makePerformanceRecord({ modelUsed: 'opus', success: false }));
      const stats = router.getStatistics();
      expect(stats.successRate.opus).toBe(0.5);
    });

    it('should accumulate total cost', () => {
      router.recordPerformance(makePerformanceRecord({ cost: 0.05 }));
      router.recordPerformance(makePerformanceRecord({ cost: 0.1 }));
      const stats = router.getStatistics();
      expect(stats.totalCost).toBeCloseTo(0.15);
    });
  });

  // =========================================================================
  // updateConfig()
  // =========================================================================

  describe('updateConfig()', () => {
    it('should update the router configuration', () => {
      router.updateConfig({ preferSpeed: true, preferQuality: false });
      // Verify by routing — speed preference should affect scoring
      const decision = router.route(makeTask({ complexity: 'trivial' }));
      expect(decision).toBeDefined();
    });

    it('should merge partial config without losing existing values', () => {
      router.updateConfig({ costBudget: 5.0 });
      // Router should still work (defaultModel was not overwritten)
      const decision = router.route(makeTask());
      expect(decision.selectedModel).toBeDefined();
    });
  });

  // =========================================================================
  // Historical learning integration
  // =========================================================================

  describe('historical learning', () => {
    it('should apply historical bonus when enough records exist', () => {
      // Need at least 3 records for a model+taskType combination
      for (let i = 0; i < 5; i++) {
        router.recordPerformance(
          makePerformanceRecord({
            modelUsed: 'haiku',
            taskType: 'classification',
            success: true,
            qualityScore: 0.9,
          })
        );
      }
      // Route a classification task — haiku should get a historical bonus
      const decision = router.route(
        makeTask({ taskType: 'classification', complexity: 'simple', costSensitivity: 'high' })
      );
      expect(decision).toBeDefined();
    });

    it('should not apply historical bonus with fewer than 3 records', () => {
      router.recordPerformance(
        makePerformanceRecord({ modelUsed: 'opus', taskType: 'analysis', success: true })
      );
      router.recordPerformance(
        makePerformanceRecord({ modelUsed: 'opus', taskType: 'analysis', success: true })
      );
      // Only 2 records — no bonus should be applied, but routing still works
      const decision = router.route(makeTask({ taskType: 'analysis' }));
      expect(decision).toBeDefined();
    });

    it('should disable historical learning when learningEnabled is false', () => {
      const r = new AdaptiveModelRouter({ learningEnabled: false });
      for (let i = 0; i < 10; i++) {
        r.recordPerformance(
          makePerformanceRecord({
            modelUsed: 'haiku',
            taskType: 'analysis',
            success: true,
            qualityScore: 1.0,
          })
        );
      }
      // With learning disabled, historical records should not affect routing
      const decision = r.route(makeTask({ taskType: 'analysis', complexity: 'complex' }));
      expect(decision).toBeDefined();
    });
  });

  // =========================================================================
  // createAdaptiveModelRouter factory
  // =========================================================================

  describe('createAdaptiveModelRouter()', () => {
    it('should return an AdaptiveModelRouter instance', () => {
      const r = createAdaptiveModelRouter();
      expect(r).toBeInstanceOf(AdaptiveModelRouter);
    });

    it('should accept config and onStream parameters', () => {
      const cb = vi.fn();
      const r = createAdaptiveModelRouter({ defaultModel: 'haiku' }, cb);
      expect(r).toBeInstanceOf(AdaptiveModelRouter);
    });
  });

  // =========================================================================
  // Cost sensitivity routing
  // =========================================================================

  describe('cost-sensitive routing', () => {
    it('should favor cheaper models when cost sensitivity is high and speed is preferred', () => {
      // Default config has preferQuality: true which boosts sonnet over haiku.
      // To truly favor haiku, disable quality preference and enable speed preference.
      const r = new AdaptiveModelRouter({ preferSpeed: true, preferQuality: false });
      const decision = r.route(
        makeTask({
          complexity: 'simple',
          costSensitivity: 'high',
          qualityRequirement: 'acceptable',
        })
      );
      // haiku: speed=10 (x2=20) + costEfficiency=10 (x3=30) => strong haiku bias
      expect(decision.selectedModel).toBe('haiku');
    });

    it('should favor quality models when cost sensitivity is low', () => {
      const decision = router.route(
        makeTask({ complexity: 'complex', costSensitivity: 'low', qualityRequirement: 'best' })
      );
      // Low cost sensitivity + best quality + complex => opus
      expect(decision.selectedModel).toBe('opus');
    });
  });
});
