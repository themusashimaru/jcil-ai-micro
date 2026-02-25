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
  type EvernoteActionCategory,
  type EvernoteAction,
  ALL_EVERNOTE_ACTIONS,
  getEvernoteFeaturedActionNames,
  getEvernoteActionsByPriority,
  getEvernoteActionNamesByPriority,
  getEvernoteActionsByCategory,
  getEvernoteActionPriority,
  isKnownEvernoteAction,
  isDestructiveEvernoteAction,
  sortByEvernotePriority,
  getEvernoteActionStats,
  getEvernoteSystemPrompt,
  getEvernoteCapabilitySummary,
  logEvernoteToolkitStats,
} from './evernote-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('EvernoteToolkit type exports', () => {
  it('should export EvernoteActionCategory type', () => {
    const cat: EvernoteActionCategory = 'notes';
    expect(['notes', 'notebooks', 'tags', 'search']).toContain(cat);
  });

  it('should export EvernoteAction interface', () => {
    const action: EvernoteAction = {
      name: 'EVERNOTE_CREATE_NOTE',
      label: 'Test',
      category: 'notes',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_EVERNOTE_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_EVERNOTE_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_EVERNOTE_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_EVERNOTE_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: EvernoteActionCategory[] = ['notes', 'notebooks', 'tags', 'search'];
    for (const action of ALL_EVERNOTE_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_EVERNOTE_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with EVERNOTE_', () => {
    for (const action of ALL_EVERNOTE_ACTIONS) {
      expect(action.name).toMatch(/^EVERNOTE_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_EVERNOTE_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Evernote query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getEvernoteFeaturedActionNames();
    expect(names.length).toBe(ALL_EVERNOTE_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getEvernoteActionsByPriority(1);
    const p2 = getEvernoteActionsByPriority(2);
    const p3 = getEvernoteActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: EvernoteAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getEvernoteActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: EvernoteActionCategory = 'notes';
    const actions = getEvernoteActionsByCategory(category);
    expect(actions.every((a: EvernoteAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getEvernoteActionPriority('EVERNOTE_CREATE_NOTE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getEvernoteActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getEvernoteActionPriority('composio_EVERNOTE_CREATE_NOTE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownEvernoteAction('EVERNOTE_CREATE_NOTE')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownEvernoteAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownEvernoteAction('composio_EVERNOTE_CREATE_NOTE')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveEvernoteAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveEvernoteAction('EVERNOTE_DELETE_NOTE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'EVERNOTE_CREATE_NOTE' }];
    const sorted = sortByEvernotePriority(tools);
    expect(sorted[0].name).toBe('EVERNOTE_CREATE_NOTE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Evernote stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getEvernoteActionStats();
    expect(stats.total).toBe(ALL_EVERNOTE_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getEvernoteSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getEvernoteCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Evernote');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logEvernoteToolkitStats()).not.toThrow();
  });
});
