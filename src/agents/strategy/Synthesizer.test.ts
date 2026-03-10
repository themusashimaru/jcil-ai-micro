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
  Synthesizer,
  createSynthesizer,
  type SynthesizedInsight,
  type SynthesizedDataPoint,
  type DomainFindings,
  type ConflictResolution,
  type ResearchGap,
  type TopFinding,
  type OverallAssessment,
  type SynthesizerResult,
} from './Synthesizer';

describe('Synthesizer type exports', () => {
  it('should export SynthesizedInsight interface', () => {
    const si: SynthesizedInsight = {
      insight: 'Market is growing',
      confidence: 'high',
      supportingEvidence: ['Data source A'],
      sourceCount: 3,
      sources: ['Source 1', 'Source 2', 'Source 3'],
    };
    expect(si.confidence).toBe('high');
  });

  it('should export SynthesizedDataPoint interface', () => {
    const dp: SynthesizedDataPoint = {
      metric: 'price',
      value: '$500k',
      confidence: 'high',
      sources: ['Zillow'],
    };
    expect(dp.metric).toBe('price');
  });

  it('should export DomainFindings interface', () => {
    const df: DomainFindings = {
      keyInsights: [],
      dataPoints: [],
      warnings: [],
      opportunities: [],
    };
    expect(df.keyInsights).toEqual([]);
  });

  it('should export ConflictResolution interface', () => {
    const cr: ConflictResolution = {
      topic: 'Price trend direction',
      position1: { claim: 'Prices rising', source: 'Source A', confidence: 'high' },
      position2: { claim: 'Prices falling', source: 'Source B', confidence: 'medium' },
      resolution: 'Weighted by recency',
    };
    expect(cr.topic).toBe('Price trend direction');
  });

  it('should export ResearchGap interface', () => {
    const rg: ResearchGap = {
      question: 'What are long-term projections?',
      importance: 'critical',
      suggestedAction: 'Consult historical data',
    };
    expect(rg.importance).toBe('critical');
  });

  it('should export TopFinding interface', () => {
    const tf: TopFinding = {
      rank: 1,
      finding: 'Very important finding',
      impact: 'Major market shift expected',
      confidence: 'high',
    };
    expect(tf.rank).toBe(1);
  });

  it('should export OverallAssessment interface', () => {
    const oa: OverallAssessment = {
      researchQuality: 'good',
      coverageCompleteness: 0.85,
      confidenceLevel: 'high',
      readyForQC: true,
      notes: 'Research is comprehensive',
    };
    expect(oa.readyForQC).toBe(true);
  });

  it('should export SynthesizerResult interface', () => {
    const sr: SynthesizerResult = {
      synthesisComplete: true,
      totalFindingsProcessed: 10,
      uniqueFindingsAfterDedup: 8,
      organizedFindings: {},
      conflicts: [],
      gaps: [],
      topFindings: [],
      overallAssessment: {
        researchQuality: 'good',
        coverageCompleteness: 0.8,
        confidenceLevel: 'medium',
        readyForQC: true,
        notes: '',
      },
    };
    expect(sr.synthesisComplete).toBe(true);
  });
});

describe('Synthesizer', () => {
  let synth: Synthesizer;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic();
    synth = new Synthesizer(mockClient);
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(synth).toBeInstanceOf(Synthesizer);
    });

    it('should accept optional onStream', () => {
      const s = new Synthesizer(mockClient, vi.fn());
      expect(s).toBeInstanceOf(Synthesizer);
    });

    it('should accept custom system prompt', () => {
      const s = new Synthesizer(mockClient, undefined, 'Custom synthesis prompt');
      expect(s).toBeInstanceOf(Synthesizer);
    });
  });

  describe('methods', () => {
    it('should have setStreamCallback method', () => {
      expect(typeof synth.setStreamCallback).toBe('function');
    });

    it('should have synthesize method', () => {
      expect(typeof synth.synthesize).toBe('function');
    });
  });

  describe('setStreamCallback', () => {
    it('should set callback without error', () => {
      expect(() => synth.setStreamCallback(vi.fn())).not.toThrow();
    });

    it('should accept undefined', () => {
      expect(() => synth.setStreamCallback(undefined)).not.toThrow();
    });
  });
});

describe('createSynthesizer', () => {
  it('should return a Synthesizer instance', () => {
    const client = new Anthropic();
    expect(createSynthesizer(client)).toBeInstanceOf(Synthesizer);
  });

  it('should accept all optional params', () => {
    const client = new Anthropic();
    expect(createSynthesizer(client, vi.fn(), 'Custom')).toBeInstanceOf(Synthesizer);
  });
});
