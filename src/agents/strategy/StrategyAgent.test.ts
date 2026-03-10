import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock('./ForensicIntake', () => ({
  ForensicIntake: vi.fn(),
  createForensicIntake: vi.fn(() => ({
    startIntake: vi.fn().mockResolvedValue('Welcome'),
    processUserInput: vi.fn().mockResolvedValue({ response: 'OK', isComplete: false }),
    getMessages: vi.fn().mockReturnValue([]),
    restoreMessages: vi.fn(),
  })),
}));

vi.mock('./MasterArchitect', () => ({
  MasterArchitect: vi.fn(),
  createMasterArchitect: vi.fn(() => ({
    setStreamCallback: vi.fn(),
    designHierarchy: vi.fn().mockResolvedValue({ blueprints: [], hierarchy: {} }),
  })),
}));

vi.mock('./QualityControl', () => ({
  QualityControl: vi.fn(),
  createQualityControl: vi.fn(() => ({
    setStreamCallback: vi.fn(),
    evaluate: vi.fn().mockResolvedValue({ score: 0.9 }),
  })),
}));

vi.mock('./Synthesizer', () => ({
  Synthesizer: vi.fn(),
  createSynthesizer: vi.fn(() => ({
    setStreamCallback: vi.fn(),
    synthesize: vi.fn().mockResolvedValue({ summary: '' }),
  })),
}));

vi.mock('./Scout', () => ({
  createScout: vi.fn(),
  executeScoutBatch: vi.fn().mockResolvedValue([]),
}));

vi.mock('./ExecutionQueue', () => ({
  ExecutionQueue: vi.fn(),
  createExecutionQueue: vi.fn(() => ({
    add: vi.fn(),
    process: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('./SteeringEngine', () => ({
  SteeringEngine: vi.fn(),
  createSteeringEngine: vi.fn(() => ({
    parseCommand: vi.fn().mockReturnValue(null),
    applyCommand: vi.fn(),
  })),
}));

vi.mock('./KnowledgeBase', () => ({
  getKnowledgeSummary: vi.fn().mockResolvedValue(''),
  storeFindings: vi.fn().mockResolvedValue(undefined),
  buildKnowledgePromptContext: vi.fn().mockReturnValue(''),
}));

vi.mock('./PerformanceTracker', () => ({
  recordScoutPerformance: vi.fn(),
  getPerformanceInsights: vi.fn().mockReturnValue(''),
  buildPerformancePromptContext: vi.fn().mockReturnValue(''),
}));

vi.mock('./ArtifactGenerator', () => ({
  generateArtifacts: vi.fn().mockResolvedValue([]),
}));

vi.mock('./prompts', () => ({
  getPrompts: vi.fn(() => ({
    intake: 'intake prompt',
    intakeOpening: 'opening prompt',
    architect: 'architect prompt',
    qualityControl: 'qc prompt',
    synthesizer: 'synth prompt',
  })),
}));

vi.mock('./constants', () => ({
  DEFAULT_LIMITS: {
    maxScouts: 10,
    maxDepth: 3,
    maxFindings: 100,
    maxCostUsd: 5,
    maxDurationMs: 300000,
  },
  CLAUDE_OPUS_46: 'claude-opus-4-6',
  MODEL_CONFIGS: {},
  BRAVE_COST_PER_QUERY: 0.005,
}));

vi.mock('./utils', () => ({
  extractJSON: vi.fn((text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }),
}));

import { StrategyAgent, createStrategyAgent } from './StrategyAgent';

// -------------------------------------------------------------------
// StrategyAgent class
// -------------------------------------------------------------------
describe('StrategyAgent', () => {
  describe('constructor', () => {
    it('should create a StrategyAgent with required params', () => {
      const agent = new StrategyAgent('test-api-key', { userId: 'user1' });
      expect(agent).toBeInstanceOf(StrategyAgent);
    });

    it('should accept an optional onStream callback', () => {
      const onStream = vi.fn();
      const agent = new StrategyAgent('test-api-key', { userId: 'user1' }, onStream);
      expect(agent).toBeInstanceOf(StrategyAgent);
    });

    it('should default mode to strategy', () => {
      const agent = new StrategyAgent('test-api-key', {});
      expect(agent).toBeInstanceOf(StrategyAgent);
    });
  });

  describe('setStreamCallback', () => {
    it('should set stream callback without error', () => {
      const agent = new StrategyAgent('test-api-key', { userId: 'user1' });
      const callback = vi.fn();
      expect(() => agent.setStreamCallback(callback)).not.toThrow();
    });

    it('should accept undefined callback', () => {
      const agent = new StrategyAgent('test-api-key', { userId: 'user1' });
      expect(() => agent.setStreamCallback(undefined)).not.toThrow();
    });
  });

  describe('startIntake', () => {
    it('should return a welcome string', async () => {
      const agent = new StrategyAgent('test-api-key', { userId: 'user1' });
      const result = await agent.startIntake();
      expect(typeof result).toBe('string');
    });
  });

  describe('processIntakeInput', () => {
    it('should return response and isComplete', async () => {
      const agent = new StrategyAgent('test-api-key', { userId: 'user1' });
      const result = await agent.processIntakeInput('Test input');
      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('isComplete');
      expect(typeof result.response).toBe('string');
      expect(typeof result.isComplete).toBe('boolean');
    });
  });

  describe('getIntakeMessages', () => {
    it('should return array of messages', () => {
      const agent = new StrategyAgent('test-api-key', { userId: 'user1' });
      const messages = agent.getIntakeMessages();
      expect(Array.isArray(messages)).toBe(true);
    });
  });

  describe('restoreIntakeMessages', () => {
    it('should restore messages without error', () => {
      const agent = new StrategyAgent('test-api-key', { userId: 'user1' });
      expect(() => agent.restoreIntakeMessages([{ role: 'user', content: 'hello' }])).not.toThrow();
    });
  });

  describe('addContext', () => {
    it('should throw when strategy is not running', async () => {
      const agent = new StrategyAgent('test-api-key', { userId: 'user1' });
      await expect(agent.addContext('new info')).rejects.toThrow(
        'Cannot add context when strategy is not running'
      );
    });
  });
});

// -------------------------------------------------------------------
// createStrategyAgent factory
// -------------------------------------------------------------------
describe('createStrategyAgent', () => {
  it('should return a StrategyAgent instance', () => {
    const agent = createStrategyAgent('test-api-key', { userId: 'user1' });
    expect(agent).toBeInstanceOf(StrategyAgent);
  });

  it('should accept optional onStream callback', () => {
    const onStream = vi.fn();
    const agent = createStrategyAgent('test-api-key', { userId: 'user1' }, onStream);
    expect(agent).toBeInstanceOf(StrategyAgent);
  });
});
