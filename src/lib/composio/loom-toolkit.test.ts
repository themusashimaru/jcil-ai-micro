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
  type LoomActionCategory,
  type LoomAction,
  ALL_LOOM_ACTIONS,
  getLoomFeaturedActionNames,
  getLoomActionsByPriority,
  getLoomActionNamesByPriority,
  getLoomActionsByCategory,
  getLoomActionPriority,
  isKnownLoomAction,
  isDestructiveLoomAction,
  sortByLoomPriority,
  getLoomActionStats,
  getLoomSystemPrompt,
  getLoomCapabilitySummary,
  logLoomToolkitStats,
} from './loom-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('LoomToolkit type exports', () => {
  it('should export LoomActionCategory type', () => {
    const cat: LoomActionCategory = 'videos';
    expect(['videos', 'folders', 'sharing', 'comments']).toContain(cat);
  });

  it('should export LoomAction interface', () => {
    const action: LoomAction = {
      name: 'LOOM_LIST_VIDEOS',
      label: 'Test',
      category: 'videos',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_LOOM_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_LOOM_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_LOOM_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_LOOM_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: LoomActionCategory[] = ['videos', 'folders', 'sharing', 'comments'];
    for (const action of ALL_LOOM_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_LOOM_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with LOOM_', () => {
    for (const action of ALL_LOOM_ACTIONS) {
      expect(action.name).toMatch(/^LOOM_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_LOOM_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Loom query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getLoomFeaturedActionNames();
    expect(names.length).toBe(ALL_LOOM_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getLoomActionsByPriority(1);
    const p2 = getLoomActionsByPriority(2);
    const p3 = getLoomActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: LoomAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getLoomActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: LoomActionCategory = 'videos';
    const actions = getLoomActionsByCategory(category);
    expect(actions.every((a: LoomAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getLoomActionPriority('LOOM_LIST_VIDEOS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getLoomActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getLoomActionPriority('composio_LOOM_LIST_VIDEOS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownLoomAction('LOOM_LIST_VIDEOS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownLoomAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownLoomAction('composio_LOOM_LIST_VIDEOS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveLoomAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveLoomAction('LOOM_DELETE_VIDEO')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'LOOM_LIST_VIDEOS' }];
    const sorted = sortByLoomPriority(tools);
    expect(sorted[0].name).toBe('LOOM_LIST_VIDEOS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Loom stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getLoomActionStats();
    expect(stats.total).toBe(ALL_LOOM_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getLoomSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getLoomCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Loom');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logLoomToolkitStats()).not.toThrow();
  });
});
