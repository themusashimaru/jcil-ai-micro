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
  type WebflowActionCategory,
  type WebflowAction,
  ALL_WEBFLOW_ACTIONS,
  getWebflowFeaturedActionNames,
  getWebflowActionsByPriority,
  getWebflowActionNamesByPriority,
  getWebflowActionsByCategory,
  getWebflowActionPriority,
  isKnownWebflowAction,
  isDestructiveWebflowAction,
  sortByWebflowPriority,
  getWebflowActionStats,
  getWebflowSystemPrompt,
  getWebflowCapabilitySummary,
  logWebflowToolkitStats,
} from './webflow-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('WebflowToolkit type exports', () => {
  it('should export WebflowActionCategory type', () => {
    const cat: WebflowActionCategory = 'sites';
    expect(['sites', 'collections', 'cms_items', 'domains', 'forms']).toContain(cat);
  });

  it('should export WebflowAction interface', () => {
    const action: WebflowAction = {
      name: 'WEBFLOW_LIST_SITES',
      label: 'Test',
      category: 'sites',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_WEBFLOW_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_WEBFLOW_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_WEBFLOW_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_WEBFLOW_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: WebflowActionCategory[] = [
      'sites',
      'collections',
      'cms_items',
      'domains',
      'forms',
    ];
    for (const action of ALL_WEBFLOW_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_WEBFLOW_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with WEBFLOW_', () => {
    for (const action of ALL_WEBFLOW_ACTIONS) {
      expect(action.name).toMatch(/^WEBFLOW_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_WEBFLOW_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Webflow query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getWebflowFeaturedActionNames();
    expect(names.length).toBe(ALL_WEBFLOW_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getWebflowActionsByPriority(1);
    const p2 = getWebflowActionsByPriority(2);
    const p3 = getWebflowActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: WebflowAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getWebflowActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: WebflowActionCategory = 'sites';
    const actions = getWebflowActionsByCategory(category);
    expect(actions.every((a: WebflowAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getWebflowActionPriority('WEBFLOW_LIST_SITES');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getWebflowActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getWebflowActionPriority('composio_WEBFLOW_LIST_SITES');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownWebflowAction('WEBFLOW_LIST_SITES')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownWebflowAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownWebflowAction('composio_WEBFLOW_LIST_SITES')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveWebflowAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveWebflowAction('WEBFLOW_DELETE_ITEM')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'WEBFLOW_LIST_SITES' }];
    const sorted = sortByWebflowPriority(tools);
    expect(sorted[0].name).toBe('WEBFLOW_LIST_SITES');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Webflow stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getWebflowActionStats();
    expect(stats.total).toBe(ALL_WEBFLOW_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getWebflowSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getWebflowCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Webflow');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logWebflowToolkitStats()).not.toThrow();
  });
});
