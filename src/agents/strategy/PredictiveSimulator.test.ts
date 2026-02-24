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
      id: 'sc-1',
      name: 'Best case',
      description: 'Everything goes right',
      type: 'optimistic',
      assumptions: ['Growth continues'],
      variables: [],
      probability: 0.3,
      timeline: [],
      outcomes: [],
      risks: [],
      opportunities: ['Market expansion'],
    };
    expect(s.probability).toBe(0.3);
  });

  it('should export ScenarioVariable interface', () => {
    const v: ScenarioVariable = {
      name: 'Interest Rate',
      baseValue: '5%',
      scenarioValue: '4%',
      sensitivity: 'high',
      confidence: 0.8,
    };
    expect(v.name).toBe('Interest Rate');
  });

  it('should export TimelineEvent interface', () => {
    const e: TimelineEvent = {
      date: '3 months',
      event: 'Rate drop',
      probability: 0.6,
      dependencies: [],
      impact: 'positive',
    };
    expect(e.probability).toBe(0.6);
  });

  it('should export Outcome interface', () => {
    const o: Outcome = {
      id: 'out-1',
      name: 'Market correction',
      description: 'A market correction occurs',
      probability: 0.5,
      impact: 'negative',
      qualitativeDescription: 'Moderate price decline expected',
    };
    expect(o.impact).toBe('negative');
  });

  it('should export ScenarioRisk interface', () => {
    const r: ScenarioRisk = {
      risk: 'Market crash',
      probability: 0.1,
      impact: 'critical',
      mitigation: 'Diversify investments',
    };
    expect(r.impact).toBe('critical');
  });

  it('should export WhatIfQuery interface', () => {
    const q: WhatIfQuery = {
      question: 'What if rates rise?',
      variables: [{ name: 'Rate', currentValue: '5%', hypotheticalValue: '7%' }],
      context: 'US housing market',
    };
    expect(q.question).toBe('What if rates rise?');
  });

  it('should export WhatIfResult interface', () => {
    const r: WhatIfResult = {
      query: { question: 'test', variables: [] },
      analysis: 'Rates rising would cool demand',
      primaryEffect: 'Reduced demand',
      secondaryEffects: ['Lower prices'],
      probability: 0.6,
      confidence: 0.7,
      assumptions: ['Fed acts as expected'],
      caveats: ['Subject to policy changes'],
      recommendations: ['Wait for clarity'],
    };
    expect(r.confidence).toBe(0.7);
  });

  it('should export SensitivityAnalysis interface', () => {
    const sa: SensitivityAnalysis = {
      variable: 'Interest rates',
      baseValue: 5.0,
      testRange: { min: 3.0, max: 8.0 },
      sensitivityScore: 0.8,
      breakpoints: [{ value: 7.0, event: 'Market slowdown', significance: 'critical' }],
      recommendations: ['Monitor rate changes closely'],
    };
    expect(sa.sensitivityScore).toBe(0.8);
  });

  it('should export DecisionTree interface', () => {
    const dt: DecisionTree = {
      id: 'dt-1',
      rootNode: { id: 'dn-1', type: 'decision', label: 'Buy or rent?', children: [] },
      bestPath: ['Buy'],
      worstPath: ['Rent in declining market'],
      expectedValue: 50000,
    };
    expect(dt.expectedValue).toBe(50000);
  });

  it('should export DecisionNode interface', () => {
    const dn: DecisionNode = {
      id: 'dn-1',
      type: 'decision',
      label: 'Invest now?',
      children: [],
    };
    expect(dn.type).toBe('decision');
  });

  it('should export SimulationResult interface', () => {
    const sr: SimulationResult = {
      scenarios: [],
      whatIfResults: [],
      sensitivityAnalyses: [],
      keyInsights: ['Key insight'],
      recommendations: ['Proceed'],
      timestamp: Date.now(),
    };
    expect(sr.recommendations).toContain('Proceed');
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
