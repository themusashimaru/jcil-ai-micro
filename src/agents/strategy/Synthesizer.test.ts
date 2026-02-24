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
      title: 'Market is growing',
      content: 'Evidence suggests growth',
      confidence: 0.8,
      sources: [],
    };
    expect(si.confidence).toBe(0.8);
  });

  it('should export SynthesizedDataPoint interface', () => {
    const dp: SynthesizedDataPoint = {
      metric: 'price',
      value: '$500k',
      source: 'Zillow',
      confidence: 0.9,
    };
    expect(dp.metric).toBe('price');
  });

  it('should export DomainFindings interface', () => {
    const df: DomainFindings = {
      domain: 'housing',
      insights: [],
      dataPoints: [],
      confidence: 0.7,
    };
    expect(df.domain).toBe('housing');
  });

  it('should export ConflictResolution interface', () => {
    const cr: ConflictResolution = {
      conflict: 'Two sources disagree on price trend',
      resolution: 'Weighted by recency',
      confidence: 0.6,
    };
    expect(cr.conflict).toBe('Two sources disagree on price trend');
  });

  it('should export ResearchGap interface', () => {
    const rg: ResearchGap = {
      topic: 'Long-term projections',
      importance: 'high',
      suggestion: 'Consult historical data',
    };
    expect(rg.importance).toBe('high');
  });

  it('should export TopFinding interface', () => {
    const tf: TopFinding = {
      title: 'Key insight',
      content: 'Very important finding',
      confidence: 0.95,
      domain: 'jobs',
    };
    expect(tf.title).toBe('Key insight');
  });

  it('should export OverallAssessment interface', () => {
    const oa: OverallAssessment = {
      summary: 'Research is comprehensive',
      confidence: 0.85,
      recommendations: ['Proceed with caution'],
    };
    expect(oa.recommendations).toHaveLength(1);
  });

  it('should export SynthesizerResult interface', () => {
    const sr: SynthesizerResult = {
      domains: [],
      topFindings: [],
      conflicts: [],
      gaps: [],
      overallAssessment: { summary: '', confidence: 0, recommendations: [] },
    };
    expect(sr.domains).toEqual([]);
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
