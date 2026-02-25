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
  type AirtableActionCategory,
  type AirtableAction,
  ALL_AIRTABLE_ACTIONS,
  getAirtableFeaturedActionNames,
  getAirtableActionsByPriority,
  getAirtableActionNamesByPriority,
  getAirtableActionsByCategory,
  getAirtableActionPriority,
  isKnownAirtableAction,
  isDestructiveAirtableAction,
  sortByAirtablePriority,
  getAirtableActionStats,
  getAirtableSystemPrompt,
  getAirtableCapabilitySummary,
  logAirtableToolkitStats,
} from './airtable-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('AirtableToolkit type exports', () => {
  it('should export AirtableActionCategory type', () => {
    const cat: AirtableActionCategory = 'bases';
    expect(['bases', 'records', 'tables', 'collaboration']).toContain(cat);
  });

  it('should export AirtableAction interface', () => {
    const action: AirtableAction = {
      name: 'AIRTABLE_LIST_BASES',
      label: 'Test',
      category: 'bases',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_AIRTABLE_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_AIRTABLE_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_AIRTABLE_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_AIRTABLE_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: AirtableActionCategory[] = [
      'bases',
      'records',
      'tables',
      'collaboration',
    ];
    for (const action of ALL_AIRTABLE_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_AIRTABLE_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with AIRTABLE_', () => {
    for (const action of ALL_AIRTABLE_ACTIONS) {
      expect(action.name).toMatch(/^AIRTABLE_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_AIRTABLE_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Airtable query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getAirtableFeaturedActionNames();
    expect(names.length).toBe(ALL_AIRTABLE_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getAirtableActionsByPriority(1);
    const p2 = getAirtableActionsByPriority(2);
    const p3 = getAirtableActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: AirtableAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getAirtableActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: AirtableActionCategory = 'bases';
    const actions = getAirtableActionsByCategory(category);
    expect(actions.every((a: AirtableAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getAirtableActionPriority('AIRTABLE_LIST_BASES');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getAirtableActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getAirtableActionPriority('composio_AIRTABLE_LIST_BASES');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownAirtableAction('AIRTABLE_LIST_BASES')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownAirtableAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownAirtableAction('composio_AIRTABLE_LIST_BASES')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveAirtableAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveAirtableAction('AIRTABLE_DELETE_RECORD')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'AIRTABLE_LIST_BASES' }];
    const sorted = sortByAirtablePriority(tools);
    expect(sorted[0].name).toBe('AIRTABLE_LIST_BASES');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Airtable stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getAirtableActionStats();
    expect(stats.total).toBe(ALL_AIRTABLE_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getAirtableSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getAirtableCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Airtable');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logAirtableToolkitStats()).not.toThrow();
  });
});
