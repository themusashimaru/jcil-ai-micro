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
  type IntercomActionCategory,
  type IntercomAction,
  ALL_INTERCOM_ACTIONS,
  getIntercomFeaturedActionNames,
  getIntercomActionsByPriority,
  getIntercomActionNamesByPriority,
  getIntercomActionsByCategory,
  getIntercomActionPriority,
  isKnownIntercomAction,
  isDestructiveIntercomAction,
  sortByIntercomPriority,
  getIntercomActionStats,
  getIntercomSystemPrompt,
  getIntercomCapabilitySummary,
  logIntercomToolkitStats,
} from './intercom-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('IntercomToolkit type exports', () => {
  it('should export IntercomActionCategory type', () => {
    const cat: IntercomActionCategory = 'conversations';
    expect(['conversations', 'contacts', 'companies', 'articles', 'tags', 'admins']).toContain(cat);
  });

  it('should export IntercomAction interface', () => {
    const action: IntercomAction = {
      name: 'INTERCOM_LIST_CONVERSATIONS',
      label: 'Test',
      category: 'conversations',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_INTERCOM_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_INTERCOM_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_INTERCOM_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_INTERCOM_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: IntercomActionCategory[] = [
      'conversations',
      'contacts',
      'companies',
      'articles',
      'tags',
      'admins',
    ];
    for (const action of ALL_INTERCOM_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_INTERCOM_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with INTERCOM_', () => {
    for (const action of ALL_INTERCOM_ACTIONS) {
      expect(action.name).toMatch(/^INTERCOM_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_INTERCOM_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Intercom query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getIntercomFeaturedActionNames();
    expect(names.length).toBe(ALL_INTERCOM_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getIntercomActionsByPriority(1);
    const p2 = getIntercomActionsByPriority(2);
    const p3 = getIntercomActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: IntercomAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getIntercomActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: IntercomActionCategory = 'conversations';
    const actions = getIntercomActionsByCategory(category);
    expect(actions.every((a: IntercomAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getIntercomActionPriority('INTERCOM_LIST_CONVERSATIONS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getIntercomActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getIntercomActionPriority('composio_INTERCOM_LIST_CONVERSATIONS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownIntercomAction('INTERCOM_LIST_CONVERSATIONS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownIntercomAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownIntercomAction('composio_INTERCOM_LIST_CONVERSATIONS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveIntercomAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveIntercomAction('INTERCOM_DELETE_CONTACT')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'INTERCOM_LIST_CONVERSATIONS' }];
    const sorted = sortByIntercomPriority(tools);
    expect(sorted[0].name).toBe('INTERCOM_LIST_CONVERSATIONS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Intercom stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getIntercomActionStats();
    expect(stats.total).toBe(ALL_INTERCOM_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getIntercomSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getIntercomCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Intercom');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logIntercomToolkitStats()).not.toThrow();
  });
});
