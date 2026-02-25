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
  type TodoistActionCategory,
  type TodoistAction,
  ALL_TODOIST_ACTIONS,
  getTodoistFeaturedActionNames,
  getTodoistActionsByPriority,
  getTodoistActionNamesByPriority,
  getTodoistActionsByCategory,
  getTodoistActionPriority,
  isKnownTodoistAction,
  isDestructiveTodoistAction,
  sortByTodoistPriority,
  getTodoistActionStats,
  getTodoistSystemPrompt,
  getTodoistCapabilitySummary,
  logTodoistToolkitStats,
} from './todoist-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('TodoistToolkit type exports', () => {
  it('should export TodoistActionCategory type', () => {
    const cat: TodoistActionCategory = 'tasks';
    expect(['tasks', 'projects', 'sections', 'labels', 'comments']).toContain(cat);
  });

  it('should export TodoistAction interface', () => {
    const action: TodoistAction = {
      name: 'TODOIST_CREATE_TASK',
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

describe('ALL_TODOIST_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_TODOIST_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_TODOIST_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_TODOIST_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: TodoistActionCategory[] = [
      'tasks',
      'projects',
      'sections',
      'labels',
      'comments',
    ];
    for (const action of ALL_TODOIST_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_TODOIST_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with TODOIST_', () => {
    for (const action of ALL_TODOIST_ACTIONS) {
      expect(action.name).toMatch(/^TODOIST_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_TODOIST_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Todoist query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getTodoistFeaturedActionNames();
    expect(names.length).toBe(ALL_TODOIST_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getTodoistActionsByPriority(1);
    const p2 = getTodoistActionsByPriority(2);
    const p3 = getTodoistActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: TodoistAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getTodoistActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: TodoistActionCategory = 'tasks';
    const actions = getTodoistActionsByCategory(category);
    expect(actions.every((a: TodoistAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getTodoistActionPriority('TODOIST_CREATE_TASK');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getTodoistActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getTodoistActionPriority('composio_TODOIST_CREATE_TASK');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownTodoistAction('TODOIST_CREATE_TASK')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownTodoistAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownTodoistAction('composio_TODOIST_CREATE_TASK')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveTodoistAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveTodoistAction('TODOIST_DELETE_TASK')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'TODOIST_CREATE_TASK' }];
    const sorted = sortByTodoistPriority(tools);
    expect(sorted[0].name).toBe('TODOIST_CREATE_TASK');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Todoist stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getTodoistActionStats();
    expect(stats.total).toBe(ALL_TODOIST_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getTodoistSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getTodoistCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Todoist');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logTodoistToolkitStats()).not.toThrow();
  });
});
