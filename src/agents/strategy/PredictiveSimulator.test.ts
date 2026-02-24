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
  PredictiveSimulator,
  createPredictiveSimulator,
  type Scenario,
  type ScenarioVariable,
  type TimelineEvent,
  type Outcome,
  type ScenarioRisk,
  type WhatIfQuery,
  type WhatIfResult,
  type SensitivityAnalysis,
  type DecisionTree,
  type DecisionNode,
  type SimulationResult,
} from './PredictiveSimulator';

describe('PredictiveSimulator type exports', () => {
  it('should export Scenario interface', () => {
    const s: Scenario = {
      name: 'Best case',
      description: 'Everything goes right',
      probability: 0.3,
      variables: [],
      timeline: [],
      outcome: { description: 'Success', impact: 'positive', confidence: 0.9, metrics: {} },
      risks: [],
    };
    expect(s.probability).toBe(0.3);
  });

  it('should export ScenarioVariable interface', () => {
    const v: ScenarioVariable = {
      name: 'Interest Rate',
      currentValue: '5%',
      projectedValue: '4%',
      impact: 'Positive for borrowers',
    };
    expect(v.name).toBe('Interest Rate');
  });

  it('should export TimelineEvent interface', () => {
    const e: TimelineEvent = {
      time: '3 months',
      event: 'Rate drop',
      probability: 0.6,
      impact: 'Increased demand',
    };
    expect(e.probability).toBe(0.6);
  });

  it('should export Outcome interface', () => {
    const o: Outcome = {
      description: 'Market correction',
      impact: 'negative',
      confidence: 0.5,
      metrics: { priceChange: '-10%' },
    };
    expect(o.impact).toBe('negative');
  });

  it('should export ScenarioRisk interface', () => {
    const r: ScenarioRisk = {
      risk: 'Market crash',
      likelihood: 'low',
      impact: 'severe',
      mitigation: 'Diversify investments',
    };
    expect(r.likelihood).toBe('low');
  });

  it('should export WhatIfQuery interface', () => {
    const q: WhatIfQuery = {
      question: 'What if rates rise?',
      variables: [{ name: 'Rate', currentValue: '5%', projectedValue: '7%', impact: '' }],
      timeframe: '6 months',
    };
    expect(q.question).toBe('What if rates rise?');
  });

  it('should export WhatIfResult interface', () => {
    const r: WhatIfResult = {
      query: { question: 'test', variables: [], timeframe: '1yr' },
      scenarios: [],
      recommendation: 'Wait',
      confidence: 0.7,
    };
    expect(r.confidence).toBe(0.7);
  });

  it('should export SensitivityAnalysis interface', () => {
    const sa: SensitivityAnalysis = {
      variable: 'Interest rates',
      impactOnOutcome: 'high',
      elasticity: 0.8,
      breakpoints: ['2%', '5%', '8%'],
    };
    expect(sa.elasticity).toBe(0.8);
  });

  it('should export DecisionTree interface', () => {
    const dt: DecisionTree = {
      rootNode: { type: 'decision', label: 'Buy or rent?', children: [] },
      optimalPath: ['Buy'],
      expectedValue: 50000,
    };
    expect(dt.expectedValue).toBe(50000);
  });

  it('should export DecisionNode interface', () => {
    const dn: DecisionNode = {
      type: 'decision',
      label: 'Invest now?',
      children: [],
    };
    expect(dn.type).toBe('decision');
  });

  it('should export SimulationResult interface', () => {
    const sr: SimulationResult = {
      scenarios: [],
      sensitivityAnalysis: [],
      decisionTree: {
        rootNode: { type: 'decision', label: 'Root', children: [] },
        optimalPath: [],
        expectedValue: 0,
      },
      recommendation: 'Proceed',
      confidence: 0.8,
    };
    expect(sr.recommendation).toBe('Proceed');
  });
});

describe('PredictiveSimulator', () => {
  let sim: PredictiveSimulator;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic();
    sim = new PredictiveSimulator(mockClient);
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(sim).toBeInstanceOf(PredictiveSimulator);
    });

    it('should accept optional onStream', () => {
      const s = new PredictiveSimulator(mockClient, vi.fn());
      expect(s).toBeInstanceOf(PredictiveSimulator);
    });
  });

  describe('methods', () => {
    it('should have generateScenarios method', () => {
      expect(typeof sim.generateScenarios).toBe('function');
    });

    it('should have whatIf method', () => {
      expect(typeof sim.whatIf).toBe('function');
    });

    it('should have getHistory method', () => {
      expect(typeof sim.getHistory).toBe('function');
    });
  });

  describe('getHistory', () => {
    it('should return empty array initially', () => {
      expect(sim.getHistory()).toEqual([]);
    });
  });
});

describe('createPredictiveSimulator', () => {
  it('should return an instance', () => {
    const client = new Anthropic();
    expect(createPredictiveSimulator(client)).toBeInstanceOf(PredictiveSimulator);
  });

  it('should accept optional onStream', () => {
    const client = new Anthropic();
    expect(createPredictiveSimulator(client, vi.fn())).toBeInstanceOf(PredictiveSimulator);
  });
});
