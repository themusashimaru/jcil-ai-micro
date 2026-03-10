import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  type ElevenLabsActionCategory,
  type ElevenLabsAction,
  ALL_ELEVENLABS_ACTIONS,
  getElevenLabsFeaturedActionNames,
  getElevenLabsActionsByPriority,
  getElevenLabsActionNamesByPriority,
  getElevenLabsActionsByCategory,
  getElevenLabsActionPriority,
  isKnownElevenLabsAction,
  isDestructiveElevenLabsAction,
  sortByElevenLabsPriority,
  getElevenLabsActionStats,
  getElevenLabsSystemPrompt,
  getElevenLabsCapabilitySummary,
  logElevenLabsToolkitStats,
} from './elevenlabs-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('ElevenLabsToolkit type exports', () => {
  it('should export ElevenLabsActionCategory type', () => {
    const cat: ElevenLabsActionCategory = 'tts';
    expect(['tts', 'voices', 'audio', 'projects']).toContain(cat);
  });

  it('should export ElevenLabsAction interface', () => {
    const action: ElevenLabsAction = {
      name: 'ELEVENLABS_TEXT_TO_SPEECH',
      label: 'Test',
      category: 'tts',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_ELEVENLABS_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_ELEVENLABS_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_ELEVENLABS_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_ELEVENLABS_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: ElevenLabsActionCategory[] = ['tts', 'voices', 'audio', 'projects'];
    for (const action of ALL_ELEVENLABS_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_ELEVENLABS_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with ELEVENLABS_', () => {
    for (const action of ALL_ELEVENLABS_ACTIONS) {
      expect(action.name).toMatch(/^ELEVENLABS_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_ELEVENLABS_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('ElevenLabs query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getElevenLabsFeaturedActionNames();
    expect(names.length).toBe(ALL_ELEVENLABS_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getElevenLabsActionsByPriority(1);
    const p2 = getElevenLabsActionsByPriority(2);
    const p3 = getElevenLabsActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: ElevenLabsAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getElevenLabsActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: ElevenLabsActionCategory = 'tts';
    const actions = getElevenLabsActionsByCategory(category);
    expect(actions.every((a: ElevenLabsAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getElevenLabsActionPriority('ELEVENLABS_TEXT_TO_SPEECH');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getElevenLabsActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getElevenLabsActionPriority('composio_ELEVENLABS_TEXT_TO_SPEECH');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownElevenLabsAction('ELEVENLABS_TEXT_TO_SPEECH')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownElevenLabsAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownElevenLabsAction('composio_ELEVENLABS_TEXT_TO_SPEECH')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveElevenLabsAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveElevenLabsAction('ELEVENLABS_DELETE_VOICE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'ELEVENLABS_TEXT_TO_SPEECH' }];
    const sorted = sortByElevenLabsPriority(tools);
    expect(sorted[0].name).toBe('ELEVENLABS_TEXT_TO_SPEECH');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('ElevenLabs stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getElevenLabsActionStats();
    expect(stats.total).toBe(ALL_ELEVENLABS_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getElevenLabsSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getElevenLabsCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Eleven');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logElevenLabsToolkitStats()).not.toThrow();
  });
});
