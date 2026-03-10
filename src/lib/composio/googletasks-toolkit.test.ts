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
  type GoogleTasksActionCategory,
  type GoogleTasksAction,
  ALL_GOOGLE_TASKS_ACTIONS,
  getGoogleTasksFeaturedActionNames,
  getGoogleTasksActionsByPriority,
  getGoogleTasksActionNamesByPriority,
  getGoogleTasksActionsByCategory,
  getGoogleTasksActionPriority,
  isKnownGoogleTasksAction,
  isDestructiveGoogleTasksAction,
  sortByGoogleTasksPriority,
  getGoogleTasksActionStats,
  getGoogleTasksSystemPrompt,
  getGoogleTasksCapabilitySummary,
  logGoogleTasksToolkitStats,
} from './googletasks-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GoogleTasksToolkit type exports', () => {
  it('should export GoogleTasksActionCategory type', () => {
    const cat: GoogleTasksActionCategory = 'tasks';
    expect(['tasks', 'tasklists']).toContain(cat);
  });

  it('should export GoogleTasksAction interface', () => {
    const action: GoogleTasksAction = {
      name: 'GOOGLETASKS_LIST_TASKS',
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

describe('ALL_GOOGLE_TASKS_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GOOGLE_TASKS_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GOOGLE_TASKS_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GOOGLE_TASKS_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GoogleTasksActionCategory[] = ['tasks', 'tasklists'];
    for (const action of ALL_GOOGLE_TASKS_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GOOGLE_TASKS_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GOOGLETASKS_', () => {
    for (const action of ALL_GOOGLE_TASKS_ACTIONS) {
      expect(action.name).toMatch(/^GOOGLETASKS_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GOOGLE_TASKS_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('GoogleTasks query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGoogleTasksFeaturedActionNames();
    expect(names.length).toBe(ALL_GOOGLE_TASKS_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGoogleTasksActionsByPriority(1);
    const p2 = getGoogleTasksActionsByPriority(2);
    const p3 = getGoogleTasksActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GoogleTasksAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGoogleTasksActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GoogleTasksActionCategory = 'tasks';
    const actions = getGoogleTasksActionsByCategory(category);
    expect(actions.every((a: GoogleTasksAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGoogleTasksActionPriority('GOOGLETASKS_LIST_TASKS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGoogleTasksActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGoogleTasksActionPriority('composio_GOOGLETASKS_LIST_TASKS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGoogleTasksAction('GOOGLETASKS_LIST_TASKS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGoogleTasksAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownGoogleTasksAction('composio_GOOGLETASKS_LIST_TASKS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGoogleTasksAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveGoogleTasksAction('GOOGLETASKS_DELETE_TASK')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GOOGLETASKS_LIST_TASKS' }];
    const sorted = sortByGoogleTasksPriority(tools);
    expect(sorted[0].name).toBe('GOOGLETASKS_LIST_TASKS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('GoogleTasks stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGoogleTasksActionStats();
    expect(stats.total).toBe(ALL_GOOGLE_TASKS_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGoogleTasksSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGoogleTasksCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Google');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGoogleTasksToolkitStats()).not.toThrow();
  });
});
