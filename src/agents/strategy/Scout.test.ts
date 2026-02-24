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

vi.mock('@/lib/brave', () => ({
  braveWebSearch: vi.fn().mockResolvedValue({ web: { results: [] } }),
}));

vi.mock('./tools', () => ({
  executeScoutTool: vi.fn().mockResolvedValue({ success: true }),
  getClaudeToolDefinitions: vi.fn().mockReturnValue([]),
  parseClaudeToolCall: vi.fn().mockReturnValue(null),
  setSessionId: vi.fn(),
  AI_SAFETY_PROMPT: 'safety prompt',
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

vi.mock('./constants', () => ({
  CLAUDE_SONNET_46: 'claude-sonnet-4-6',
  SCOUT_PROMPT: 'scout prompt',
  MODEL_CONFIGS: {
    'claude-sonnet-4-6': { inputCostPerToken: 0.000003, outputCostPerToken: 0.000015 },
  },
}));

import Anthropic from '@anthropic-ai/sdk';
import { Scout, createScout, executeScoutBatch } from './Scout';
import type { AgentBlueprint } from './types';

const mockBlueprint: AgentBlueprint = {
  id: 'scout-1',
  name: 'Test Scout',
  role: 'research specialist',
  expertise: ['testing'],
  purpose: 'Research testing',
  keyQuestions: ['What is testing?'],
  researchApproach: 'broad_scan',
  dataSources: ['web'],
  searchQueries: ['test query'],
  deliverable: 'research findings',
  outputFormat: 'structured_report',
  modelTier: 'sonnet',
  priority: 1,
  estimatedSearches: 3,
  depth: 1,
  canSpawnChildren: false,
  maxChildren: 0,
  tools: ['brave_search'],
};

// -------------------------------------------------------------------
// Scout class
// -------------------------------------------------------------------
describe('Scout', () => {
  it('should be exported as a class', () => {
    expect(Scout).toBeDefined();
    expect(typeof Scout).toBe('function');
  });

  it('should create a Scout instance', () => {
    const client = new Anthropic();
    const scout = new Scout(client, mockBlueprint);
    expect(scout).toBeInstanceOf(Scout);
  });

  it('should accept optional onStream callback', () => {
    const client = new Anthropic();
    const onStream = vi.fn();
    const scout = new Scout(client, mockBlueprint, onStream);
    expect(scout).toBeInstanceOf(Scout);
  });

  it('should accept optional custom scoutPrompt', () => {
    const client = new Anthropic();
    const scout = new Scout(client, mockBlueprint, undefined, 'custom prompt');
    expect(scout).toBeInstanceOf(Scout);
  });

  it('should have an execute method', () => {
    const client = new Anthropic();
    const scout = new Scout(client, mockBlueprint);
    expect(typeof scout.execute).toBe('function');
  });
});

// -------------------------------------------------------------------
// createScout factory
// -------------------------------------------------------------------
describe('createScout', () => {
  it('should return a Scout instance', () => {
    const client = new Anthropic();
    const scout = createScout(client, mockBlueprint);
    expect(scout).toBeInstanceOf(Scout);
  });

  it('should accept optional stream callback and prompt', () => {
    const client = new Anthropic();
    const onStream = vi.fn();
    const scout = createScout(client, mockBlueprint, onStream, 'custom');
    expect(scout).toBeInstanceOf(Scout);
  });
});

// -------------------------------------------------------------------
// executeScoutBatch
// -------------------------------------------------------------------
describe('executeScoutBatch', () => {
  it('should be an async generator function', () => {
    expect(typeof executeScoutBatch).toBe('function');
  });

  it('should yield nothing for empty blueprints', async () => {
    const client = new Anthropic();
    const results: unknown[] = [];

    for await (const result of executeScoutBatch(client, [])) {
      results.push(result);
    }

    expect(results).toHaveLength(0);
  });
});
