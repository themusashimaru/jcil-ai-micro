import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import Anthropic from '@anthropic-ai/sdk';
import {
  ReflectionEngine,
  createReflectionEngine,
  type ReflectionResult,
  type Assumption,
  type BiasDetection,
  type BiasType,
  type LogicGap,
  type MetaObservation,
  type ReflectionContext,
} from './ReflectionEngine';

describe('ReflectionEngine type exports', () => {
  it('should export ReflectionResult interface', () => {
    const result: ReflectionResult = {
      assumptions: [],
      biases: [],
      logicGaps: [],
      metaObservations: [],
      calibratedConfidence: 0.8,
      qualityScore: 0.9,
      recommendations: ['test'],
    };
    expect(result.calibratedConfidence).toBe(0.8);
    expect(result.qualityScore).toBe(0.9);
  });

  it('should export Assumption interface', () => {
    const assumption: Assumption = {
      content: 'Users prefer simple UI',
      severity: 'medium',
      evidence: 'Based on survey data',
      alternative: 'Users may prefer complex UI',
    };
    expect(assumption.content).toBe('Users prefer simple UI');
    expect(assumption.severity).toBe('medium');
  });

  it('should export BiasDetection interface', () => {
    const bias: BiasDetection = {
      type: 'confirmation_bias',
      description: 'Only looking at supporting data',
      impact: 'high',
      mitigation: 'Seek disconfirming evidence',
    };
    expect(bias.type).toBe('confirmation_bias');
  });

  it('should export BiasType type', () => {
    const bias1: BiasType = 'confirmation_bias';
    const bias2: BiasType = 'anchoring_bias';
    expect(bias1).toBe('confirmation_bias');
    expect(bias2).toBe('anchoring_bias');
  });

  it('should export LogicGap interface', () => {
    const gap: LogicGap = {
      description: 'Missing step in analysis',
      severity: 'high',
      location: 'data gathering phase',
      suggestedFix: 'Add validation step',
    };
    expect(gap.description).toBe('Missing step in analysis');
  });

  it('should export MetaObservation interface', () => {
    const obs: MetaObservation = {
      insight: 'Research is narrowing too quickly',
      category: 'process',
      actionable: true,
    };
    expect(obs.actionable).toBe(true);
  });

  it('should export ReflectionContext interface', () => {
    const ctx: ReflectionContext = {
      phase: 'research',
      findings: [],
      currentConfidence: 0.7,
      timeElapsed: 5000,
    };
    expect(ctx.phase).toBe('research');
    expect(ctx.currentConfidence).toBe(0.7);
  });
});

describe('ReflectionEngine', () => {
  let engine: ReflectionEngine;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic();
    engine = new ReflectionEngine(mockClient);
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(engine).toBeInstanceOf(ReflectionEngine);
    });

    it('should accept optional onStream callback', () => {
      const onStream = vi.fn();
      const e = new ReflectionEngine(mockClient, onStream);
      expect(e).toBeInstanceOf(ReflectionEngine);
    });
  });

  describe('methods', () => {
    it('should have reflect method', () => {
      expect(typeof engine.reflect).toBe('function');
    });

    it('should have quickReflect method', () => {
      expect(typeof engine.quickReflect).toBe('function');
    });

    it('should have getCumulativeInsights method', () => {
      expect(typeof engine.getCumulativeInsights).toBe('function');
    });

    it('should have getHistory method', () => {
      expect(typeof engine.getHistory).toBe('function');
    });

    it('should have clearHistory method', () => {
      expect(typeof engine.clearHistory).toBe('function');
    });
  });

  describe('getCumulativeInsights', () => {
    it('should return defaults when no history', () => {
      const insights = engine.getCumulativeInsights();
      expect(insights.totalAssumptions).toBe(0);
      expect(insights.totalBiases).toBe(0);
      expect(insights.totalGaps).toBe(0);
      expect(insights.recurringIssues).toEqual([]);
      expect(insights.averageConfidence).toBe(0.5);
      expect(insights.trend).toBe('stable');
    });
  });

  describe('getHistory', () => {
    it('should return empty array initially', () => {
      expect(engine.getHistory()).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    it('should clear without error', () => {
      expect(() => engine.clearHistory()).not.toThrow();
    });

    it('should result in empty history', () => {
      engine.clearHistory();
      expect(engine.getHistory()).toEqual([]);
    });
  });
});

describe('createReflectionEngine', () => {
  it('should return a ReflectionEngine', () => {
    const client = new Anthropic();
    const engine = createReflectionEngine(client);
    expect(engine).toBeInstanceOf(ReflectionEngine);
  });

  it('should accept optional onStream', () => {
    const client = new Anthropic();
    const onStream = vi.fn();
    const engine = createReflectionEngine(client, onStream);
    expect(engine).toBeInstanceOf(ReflectionEngine);
  });
});
