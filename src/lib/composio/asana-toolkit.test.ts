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
  type AsanaActionCategory,
  type AsanaAction,
  ALL_ASANA_ACTIONS,
  getAsanaFeaturedActionNames,
  getAsanaActionsByPriority,
  getAsanaActionNamesByPriority,
  getAsanaActionsByCategory,
  getAsanaActionPriority,
  isKnownAsanaAction,
  isDestructiveAsanaAction,
  sortByAsanaPriority,
  getAsanaActionStats,
  getAsanaSystemPrompt,
  getAsanaCapabilitySummary,
  logAsanaToolkitStats,
} from './asana-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('AsanaToolkit type exports', () => {
  it('should export AsanaActionCategory type', () => {
    const cat: AsanaActionCategory = 'tasks';
    expect(['tasks', 'projects', 'sections', 'workspaces', 'tags', 'comments', 'users']).toContain(
      cat
    );
  });

  it('should export AsanaAction interface', () => {
    const action: AsanaAction = {
      name: 'ASANA_CREATE_TASK',
      label: 'Test',
      category: 'tasks',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_ASANA_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_ASANA_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_ASANA_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_ASANA_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: AsanaActionCategory[] = [
      'tasks',
      'projects',
      'sections',
      'workspaces',
      'tags',
      'comments',
      'users',
    ];
    for (const action of ALL_ASANA_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_ASANA_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with ASANA_', () => {
    for (const action of ALL_ASANA_ACTIONS) {
      expect(action.name).toMatch(/^ASANA_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_ASANA_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Asana query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getAsanaFeaturedActionNames();
    expect(names.length).toBe(ALL_ASANA_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getAsanaActionsByPriority(1);
    const p2 = getAsanaActionsByPriority(2);
    const p3 = getAsanaActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: AsanaAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getAsanaActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: AsanaActionCategory = 'tasks';
    const actions = getAsanaActionsByCategory(category);
    expect(actions.every((a: AsanaAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getAsanaActionPriority('ASANA_CREATE_TASK');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getAsanaActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getAsanaActionPriority('composio_ASANA_CREATE_TASK');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownAsanaAction('ASANA_CREATE_TASK')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownAsanaAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownAsanaAction('composio_ASANA_CREATE_TASK')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveAsanaAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveAsanaAction('ASANA_DELETE_TASK')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'ASANA_CREATE_TASK' }];
    const sorted = sortByAsanaPriority(tools);
    expect(sorted[0].name).toBe('ASANA_CREATE_TASK');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Asana stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getAsanaActionStats();
    expect(stats.total).toBe(ALL_ASANA_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getAsanaSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getAsanaCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Asana');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logAsanaToolkitStats()).not.toThrow();
  });
});
