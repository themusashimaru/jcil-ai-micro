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
  AdversarialVerifier,
  createAdversarialVerifier,
  type AdversarialResult,
  type CounterArgument,
  type Contradiction,
  type StressTestResult,
  type Perspective,
  type DevilsAdvocateAssessment,
  type VerificationVerdict,
  type AdversarialContext,
} from './AdversarialVerifier';
import type { SynthesizedProblem } from './types';

describe('AdversarialVerifier type exports', () => {
  it('should export AdversarialResult interface', () => {
    const result: AdversarialResult = {
      status: 'verified',
      robustnessScore: 0.9,
      counterArguments: [],
      contradictions: [],
      stressTests: [],
      underweightedPerspectives: [],
      devilsAdvocate: {
        mainThesis: 'Thesis',
        opposingPosition: 'Counter',
        strongestCounterpoints: [],
        weaknesses: [],
        whatCouldGoWrong: [],
        hiddenRisks: [],
      },
      verdict: {
        confidence: 0.95,
        recommendation: 'proceed',
        summary: 'All good',
        requiredActions: [],
        remainingRisks: [],
      },
      timestamp: Date.now(),
    };
    expect(result.robustnessScore).toBe(0.9);
  });

  it('should export CounterArgument interface', () => {
    const ca: CounterArgument = {
      id: 'ca-1',
      argument: 'Housing prices will rise',
      strength: 'strong',
      evidence: ['Fed policy signals'],
      rebuttalSuggestion: 'Check macro trends',
    };
    expect(ca.strength).toBe('strong');
  });

  it('should export Contradiction interface', () => {
    const c: Contradiction = {
      id: 'ctr-1',
      findingA: { id: 'f1', title: 'Demand is high', content: 'High demand observed' },
      findingB: { id: 'f2', title: 'Prices are falling', content: 'Price decline noted' },
      contradictionType: 'direct',
      severity: 'high',
      resolution: 'Check data sources',
    };
    expect(c.severity).toBe('high');
  });

  it('should export StressTestResult interface', () => {
    const st: StressTestResult = {
      id: 'st-1',
      scenario: 'Market crash',
      testedElement: 'Main recommendation',
      passed: false,
      failureMode: 'Conclusions invalid under crash',
      implications: 'Need contingency plan',
    };
    expect(st.passed).toBe(false);
  });

  it('should export Perspective interface', () => {
    const p: Perspective = {
      id: 'p-1',
      perspective: 'Economic conservative viewpoint',
      stakeholder: 'Conservative investors',
      importance: 0.8,
      currentWeight: 0.2,
      suggestedWeight: 0.5,
      reasoning: 'Risk-averse viewpoint underrepresented',
    };
    expect(p.importance).toBe(0.8);
  });

  it('should export DevilsAdvocateAssessment interface', () => {
    const da: DevilsAdvocateAssessment = {
      mainThesis: 'Analysis is too narrow',
      opposingPosition: 'Broader factors exist',
      strongestCounterpoints: ['Market cycles ignored'],
      weaknesses: ['Limited data sources'],
      whatCouldGoWrong: ['Recession hits'],
      hiddenRisks: ['Regulatory changes'],
    };
    expect(da.strongestCounterpoints).toHaveLength(1);
  });

  it('should export VerificationVerdict interface', () => {
    const v: VerificationVerdict = {
      confidence: 0.85,
      recommendation: 'proceed_with_caution',
      summary: 'Research is solid but has gaps',
      requiredActions: ['Verify pricing data'],
      remainingRisks: ['Market volatility'],
    };
    expect(v.confidence).toBe(0.85);
  });

  it('should export AdversarialContext interface', () => {
    const ctx: AdversarialContext = {
      problem: {
        summary: 'Housing analysis',
        coreQuestion: 'Should I buy?',
        constraints: [],
        priorities: [],
        stakeholders: [],
        timeframe: '6 months',
        riskTolerance: 'medium',
        complexity: 'moderate',
        domains: ['housing'],
        hiddenFactors: [],
        successCriteria: [],
      } as SynthesizedProblem,
      findings: [],
    };
    expect(ctx.findings).toEqual([]);
  });
});

describe('AdversarialVerifier', () => {
  let verifier: AdversarialVerifier;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic();
    verifier = new AdversarialVerifier(mockClient);
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(verifier).toBeInstanceOf(AdversarialVerifier);
    });

    it('should accept optional onStream callback', () => {
      const onStream = vi.fn();
      const v = new AdversarialVerifier(mockClient, onStream);
      expect(v).toBeInstanceOf(AdversarialVerifier);
    });
  });

  describe('methods', () => {
    it('should have verify method', () => {
      expect(typeof verifier.verify).toBe('function');
    });

    it('should have detectContradictions method', () => {
      expect(typeof verifier.detectContradictions).toBe('function');
    });

    it('should have getHistory method', () => {
      expect(typeof verifier.getHistory).toBe('function');
    });
  });

  describe('getHistory', () => {
    it('should return empty array initially', () => {
      expect(verifier.getHistory()).toEqual([]);
    });
  });
});

describe('createAdversarialVerifier', () => {
  it('should return an AdversarialVerifier', () => {
    const client = new Anthropic();
    const v = createAdversarialVerifier(client);
    expect(v).toBeInstanceOf(AdversarialVerifier);
  });

  it('should accept optional onStream', () => {
    const client = new Anthropic();
    const onStream = vi.fn();
    const v = createAdversarialVerifier(client, onStream);
    expect(v).toBeInstanceOf(AdversarialVerifier);
  });
});
