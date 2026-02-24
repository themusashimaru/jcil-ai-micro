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
import { MasterArchitect, createMasterArchitect } from './MasterArchitect';

describe('MasterArchitect', () => {
  let architect: MasterArchitect;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic();
    architect = new MasterArchitect(mockClient);
  });

  describe('constructor', () => {
    it('should create an instance with defaults', () => {
      expect(architect).toBeInstanceOf(MasterArchitect);
    });

    it('should accept custom limits', () => {
      const limits = {
        maxBudget: 5,
        maxTime: 30000,
        maxAgents: 3,
        maxSearchesPerScout: 2,
        maxTotalSearches: 10,
        minConfidenceThreshold: 0.6,
      };
      const a = new MasterArchitect(mockClient, limits);
      expect(a).toBeInstanceOf(MasterArchitect);
    });

    it('should accept optional onStream callback', () => {
      const onStream = vi.fn();
      const a = new MasterArchitect(mockClient, undefined, onStream);
      expect(a).toBeInstanceOf(MasterArchitect);
    });

    it('should accept custom system prompt', () => {
      const a = new MasterArchitect(mockClient, undefined, undefined, 'Custom prompt');
      expect(a).toBeInstanceOf(MasterArchitect);
    });
  });

  describe('methods', () => {
    it('should have setStreamCallback method', () => {
      expect(typeof architect.setStreamCallback).toBe('function');
    });

    it('should have injectAdditionalContext method', () => {
      expect(typeof architect.injectAdditionalContext).toBe('function');
    });

    it('should have designAgents method', () => {
      expect(typeof architect.designAgents).toBe('function');
    });

    it('should have getState method', () => {
      expect(typeof architect.getState).toBe('function');
    });

    it('should have getScoutBlueprints method', () => {
      expect(typeof architect.getScoutBlueprints).toBe('function');
    });
  });

  describe('getState', () => {
    it('should return initial state', () => {
      const state = architect.getState();
      expect(state.status).toBe('pending');
      expect(state.blueprintsCreated).toBe(0);
    });
  });

  describe('setStreamCallback', () => {
    it('should set callback without error', () => {
      expect(() => architect.setStreamCallback(vi.fn())).not.toThrow();
    });

    it('should accept undefined', () => {
      expect(() => architect.setStreamCallback(undefined)).not.toThrow();
    });
  });

  describe('injectAdditionalContext', () => {
    it('should inject context without error', () => {
      expect(() => architect.injectAdditionalContext('Extra context')).not.toThrow();
    });
  });
});

describe('createMasterArchitect', () => {
  it('should return a MasterArchitect instance', () => {
    const client = new Anthropic();
    const arch = createMasterArchitect(client);
    expect(arch).toBeInstanceOf(MasterArchitect);
  });

  it('should accept all optional params', () => {
    const client = new Anthropic();
    const arch = createMasterArchitect(client, undefined, vi.fn(), 'Custom');
    expect(arch).toBeInstanceOf(MasterArchitect);
  });
});
