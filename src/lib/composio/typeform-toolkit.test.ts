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
  type TypeformActionCategory,
  type TypeformAction,
  ALL_TYPEFORM_ACTIONS,
  getTypeformFeaturedActionNames,
  getTypeformActionsByPriority,
  getTypeformActionNamesByPriority,
  getTypeformActionsByCategory,
  getTypeformActionPriority,
  isKnownTypeformAction,
  isDestructiveTypeformAction,
  sortByTypeformPriority,
  getTypeformActionStats,
  getTypeformSystemPrompt,
  getTypeformCapabilitySummary,
  logTypeformToolkitStats,
} from './typeform-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('TypeformToolkit type exports', () => {
  it('should export TypeformActionCategory type', () => {
    const cat: TypeformActionCategory = 'forms';
    expect(['forms', 'responses', 'workspaces', 'themes']).toContain(cat);
  });

  it('should export TypeformAction interface', () => {
    const action: TypeformAction = {
      name: 'TYPEFORM_LIST_FORMS',
      label: 'Test',
      category: 'forms',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_TYPEFORM_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_TYPEFORM_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_TYPEFORM_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_TYPEFORM_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: TypeformActionCategory[] = [
      'forms',
      'responses',
      'workspaces',
      'themes',
    ];
    for (const action of ALL_TYPEFORM_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_TYPEFORM_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with TYPEFORM_', () => {
    for (const action of ALL_TYPEFORM_ACTIONS) {
      expect(action.name).toMatch(/^TYPEFORM_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_TYPEFORM_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Typeform query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getTypeformFeaturedActionNames();
    expect(names.length).toBe(ALL_TYPEFORM_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getTypeformActionsByPriority(1);
    const p2 = getTypeformActionsByPriority(2);
    const p3 = getTypeformActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: TypeformAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getTypeformActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: TypeformActionCategory = 'forms';
    const actions = getTypeformActionsByCategory(category);
    expect(actions.every((a: TypeformAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getTypeformActionPriority('TYPEFORM_LIST_FORMS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getTypeformActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getTypeformActionPriority('composio_TYPEFORM_LIST_FORMS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownTypeformAction('TYPEFORM_LIST_FORMS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownTypeformAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownTypeformAction('composio_TYPEFORM_LIST_FORMS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveTypeformAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveTypeformAction('TYPEFORM_DELETE_FORM')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'TYPEFORM_LIST_FORMS' }];
    const sorted = sortByTypeformPriority(tools);
    expect(sorted[0].name).toBe('TYPEFORM_LIST_FORMS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Typeform stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getTypeformActionStats();
    expect(stats.total).toBe(ALL_TYPEFORM_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getTypeformSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getTypeformCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Typeform');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logTypeformToolkitStats()).not.toThrow();
  });
});
