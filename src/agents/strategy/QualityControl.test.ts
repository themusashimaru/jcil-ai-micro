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
import { QualityControl, createQualityControl } from './QualityControl';

describe('QualityControl', () => {
  let qc: QualityControl;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic();
    qc = new QualityControl(mockClient);
  });

  describe('constructor', () => {
    it('should create an instance with defaults', () => {
      expect(qc).toBeInstanceOf(QualityControl);
    });

    it('should accept custom limits', () => {
      const limits = {
        maxBudget: 10,
        maxScouts: 5,
        maxSearches: 20,
        maxTimeMinutes: 10,
        maxDepth: 20,
        maxConcurrentCalls: 10,
        batchDelayMs: 250,
        minConfidenceScore: 0.7,
        maxErrorRate: 0.15,
      };
      const q = new QualityControl(mockClient, limits);
      expect(q).toBeInstanceOf(QualityControl);
    });

    it('should accept optional onStream callback', () => {
      const onStream = vi.fn();
      const q = new QualityControl(mockClient, undefined, onStream);
      expect(q).toBeInstanceOf(QualityControl);
    });

    it('should accept custom system prompt', () => {
      const q = new QualityControl(mockClient, undefined, undefined, 'Custom QC prompt');
      expect(q).toBeInstanceOf(QualityControl);
    });
  });

  describe('methods', () => {
    it('should have setStreamCallback method', () => {
      expect(typeof qc.setStreamCallback).toBe('function');
    });

    it('should have runDeepAnalysis method', () => {
      expect(typeof qc.runDeepAnalysis).toBe('function');
    });

    it('should have triggerKillSwitch method', () => {
      expect(typeof qc.triggerKillSwitch).toBe('function');
    });

    it('should have getState method', () => {
      expect(typeof qc.getState).toBe('function');
    });

    it('should have isKilled method', () => {
      expect(typeof qc.isKilled).toBe('function');
    });

    it('should have reset method', () => {
      expect(typeof qc.reset).toBe('function');
    });
  });

  describe('getState', () => {
    it('should return initial state', () => {
      const state = qc.getState();
      expect(state.status).toBe('pending');
      expect(state.issuesFound).toEqual([]);
      expect(state.killSwitchTriggered).toBe(false);
      expect(state.overallQualityScore).toBe(1.0);
    });
  });

  describe('isKilled', () => {
    it('should return false initially', () => {
      expect(qc.isKilled()).toBe(false);
    });
  });

  describe('triggerKillSwitch', () => {
    it('should trigger kill switch', () => {
      qc.triggerKillSwitch('Budget exceeded');
      expect(qc.isKilled()).toBe(true);
    });

    it('should reflect in state', () => {
      qc.triggerKillSwitch('Quality too low');
      const state = qc.getState();
      expect(state.killSwitchTriggered).toBe(true);
    });
  });

  describe('setStreamCallback', () => {
    it('should set callback without error', () => {
      expect(() => qc.setStreamCallback(vi.fn())).not.toThrow();
    });

    it('should accept undefined', () => {
      expect(() => qc.setStreamCallback(undefined)).not.toThrow();
    });
  });

  describe('reset', () => {
    it('should reset state', () => {
      qc.triggerKillSwitch('test');
      qc.reset();
      expect(qc.isKilled()).toBe(false);
    });
  });
});

describe('createQualityControl', () => {
  it('should return a QualityControl instance', () => {
    const client = new Anthropic();
    const qc = createQualityControl(client);
    expect(qc).toBeInstanceOf(QualityControl);
  });

  it('should accept all optional params', () => {
    const client = new Anthropic();
    const qc = createQualityControl(client, undefined, vi.fn(), 'Custom prompt');
    expect(qc).toBeInstanceOf(QualityControl);
  });
});
