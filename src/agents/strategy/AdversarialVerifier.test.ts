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

describe('AdversarialVerifier type exports', () => {
  it('should export AdversarialResult interface', () => {
    const result: AdversarialResult = {
      counterArguments: [],
      contradictions: [],
      stressTests: [],
      alternativePerspectives: [],
      devilsAdvocate: { assessment: '', rating: 'strong', confidence: 0.9 },
      verdict: { isSound: true, confidence: 0.95, summary: 'All good' },
      overallScore: 0.9,
    };
    expect(result.overallScore).toBe(0.9);
  });

  it('should export CounterArgument interface', () => {
    const ca: CounterArgument = {
      claim: 'Housing prices will rise',
      counterPoint: 'Interest rates are increasing',
      strength: 'high',
      evidence: 'Fed policy signals',
    };
    expect(ca.strength).toBe('high');
  });

  it('should export Contradiction interface', () => {
    const c: Contradiction = {
      statement1: 'Demand is high',
      statement2: 'Prices are falling',
      severity: 'major',
      resolution: 'Check data sources',
    };
    expect(c.severity).toBe('major');
  });

  it('should export StressTestResult interface', () => {
    const st: StressTestResult = {
      scenario: 'Market crash',
      impact: 'Conclusions invalid',
      likelihood: 'low',
      resilience: 'weak',
    };
    expect(st.resilience).toBe('weak');
  });

  it('should export Perspective interface', () => {
    const p: Perspective = {
      viewpoint: 'Economic conservative',
      assessment: 'Too optimistic',
      blindSpots: ['Ignores debt'],
    };
    expect(p.blindSpots).toHaveLength(1);
  });

  it('should export DevilsAdvocateAssessment interface', () => {
    const da: DevilsAdvocateAssessment = {
      assessment: 'Analysis is too narrow',
      rating: 'moderate',
      confidence: 0.7,
    };
    expect(da.rating).toBe('moderate');
  });

  it('should export VerificationVerdict interface', () => {
    const v: VerificationVerdict = {
      isSound: true,
      confidence: 0.85,
      summary: 'Research is solid',
    };
    expect(v.isSound).toBe(true);
  });

  it('should export AdversarialContext interface', () => {
    const ctx: AdversarialContext = {
      findings: [],
      conclusions: [],
      confidence: 0.8,
    };
    expect(ctx.confidence).toBe(0.8);
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
