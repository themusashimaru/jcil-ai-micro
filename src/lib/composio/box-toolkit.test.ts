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
  type BoxActionCategory,
  type BoxAction,
  ALL_BOX_ACTIONS,
  getBoxFeaturedActionNames,
  getBoxActionsByPriority,
  getBoxActionNamesByPriority,
  getBoxActionsByCategory,
  getBoxActionPriority,
  isKnownBoxAction,
  isDestructiveBoxAction,
  sortByBoxPriority,
  getBoxActionStats,
  getBoxSystemPrompt,
  getBoxCapabilitySummary,
  logBoxToolkitStats,
} from './box-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('BoxToolkit type exports', () => {
  it('should export BoxActionCategory type', () => {
    const cat: BoxActionCategory = 'files';
    expect(['files', 'folders', 'sharing', 'comments', 'users']).toContain(cat);
  });

  it('should export BoxAction interface', () => {
    const action: BoxAction = {
      name: 'BOX_UPLOAD_FILE',
      label: 'Test',
      category: 'files',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_BOX_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_BOX_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_BOX_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_BOX_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: BoxActionCategory[] = [
      'files',
      'folders',
      'sharing',
      'comments',
      'users',
    ];
    for (const action of ALL_BOX_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_BOX_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with BOX_', () => {
    for (const action of ALL_BOX_ACTIONS) {
      expect(action.name).toMatch(/^BOX_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_BOX_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Box query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getBoxFeaturedActionNames();
    expect(names.length).toBe(ALL_BOX_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getBoxActionsByPriority(1);
    const p2 = getBoxActionsByPriority(2);
    const p3 = getBoxActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: BoxAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getBoxActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: BoxActionCategory = 'files';
    const actions = getBoxActionsByCategory(category);
    expect(actions.every((a: BoxAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getBoxActionPriority('BOX_UPLOAD_FILE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getBoxActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getBoxActionPriority('composio_BOX_UPLOAD_FILE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownBoxAction('BOX_UPLOAD_FILE')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownBoxAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownBoxAction('composio_BOX_UPLOAD_FILE')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveBoxAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveBoxAction('BOX_DELETE_FILE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'BOX_UPLOAD_FILE' }];
    const sorted = sortByBoxPriority(tools);
    expect(sorted[0].name).toBe('BOX_UPLOAD_FILE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Box stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getBoxActionStats();
    expect(stats.total).toBe(ALL_BOX_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getBoxSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getBoxCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Box');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logBoxToolkitStats()).not.toThrow();
  });
});
