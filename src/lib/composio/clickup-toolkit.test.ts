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
  type ClickUpActionCategory,
  type ClickUpAction,
  ALL_CLICKUP_ACTIONS,
  getClickUpFeaturedActionNames,
  getClickUpActionsByPriority,
  getClickUpActionNamesByPriority,
  getClickUpActionsByCategory,
  getClickUpActionPriority,
  isKnownClickUpAction,
  isDestructiveClickUpAction,
  sortByClickUpPriority,
  getClickUpActionStats,
  getClickUpSystemPrompt,
  getClickUpCapabilitySummary,
  logClickUpToolkitStats,
} from './clickup-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('ClickUpToolkit type exports', () => {
  it('should export ClickUpActionCategory type', () => {
    const cat: ClickUpActionCategory = 'tasks';
    expect(['tasks', 'spaces', 'lists', 'folders', 'comments', 'goals', 'tags', 'time']).toContain(
      cat
    );
  });

  it('should export ClickUpAction interface', () => {
    const action: ClickUpAction = {
      name: 'CLICKUP_CREATE_TASK',
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

describe('ALL_CLICKUP_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_CLICKUP_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_CLICKUP_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_CLICKUP_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: ClickUpActionCategory[] = [
      'tasks',
      'spaces',
      'lists',
      'folders',
      'comments',
      'goals',
      'tags',
      'time',
    ];
    for (const action of ALL_CLICKUP_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_CLICKUP_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with CLICKUP_', () => {
    for (const action of ALL_CLICKUP_ACTIONS) {
      expect(action.name).toMatch(/^CLICKUP_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_CLICKUP_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('ClickUp query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getClickUpFeaturedActionNames();
    expect(names.length).toBe(ALL_CLICKUP_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getClickUpActionsByPriority(1);
    const p2 = getClickUpActionsByPriority(2);
    const p3 = getClickUpActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: ClickUpAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getClickUpActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: ClickUpActionCategory = 'tasks';
    const actions = getClickUpActionsByCategory(category);
    expect(actions.every((a: ClickUpAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getClickUpActionPriority('CLICKUP_CREATE_TASK');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getClickUpActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getClickUpActionPriority('composio_CLICKUP_CREATE_TASK');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownClickUpAction('CLICKUP_CREATE_TASK')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownClickUpAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownClickUpAction('composio_CLICKUP_CREATE_TASK')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveClickUpAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveClickUpAction('CLICKUP_DELETE_TASK')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'CLICKUP_CREATE_TASK' }];
    const sorted = sortByClickUpPriority(tools);
    expect(sorted[0].name).toBe('CLICKUP_CREATE_TASK');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('ClickUp stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getClickUpActionStats();
    expect(stats.total).toBe(ALL_CLICKUP_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getClickUpSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getClickUpCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Click');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logClickUpToolkitStats()).not.toThrow();
  });
});
