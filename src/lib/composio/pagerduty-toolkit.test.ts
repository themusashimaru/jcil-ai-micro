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
  type PagerDutyActionCategory,
  type PagerDutyAction,
  ALL_PAGERDUTY_ACTIONS,
  getPagerDutyFeaturedActionNames,
  getPagerDutyActionsByPriority,
  getPagerDutyActionNamesByPriority,
  getPagerDutyActionsByCategory,
  getPagerDutyActionPriority,
  isKnownPagerDutyAction,
  isDestructivePagerDutyAction,
  sortByPagerDutyPriority,
  getPagerDutyActionStats,
  getPagerDutySystemPrompt,
  getPagerDutyCapabilitySummary,
  logPagerDutyToolkitStats,
} from './pagerduty-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('PagerDutyToolkit type exports', () => {
  it('should export PagerDutyActionCategory type', () => {
    const cat: PagerDutyActionCategory = 'incidents';
    expect(['incidents', 'services', 'users', 'schedules', 'escalation_policies']).toContain(cat);
  });

  it('should export PagerDutyAction interface', () => {
    const action: PagerDutyAction = {
      name: 'PAGERDUTY_LIST_INCIDENTS',
      label: 'Test',
      category: 'incidents',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_PAGERDUTY_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_PAGERDUTY_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_PAGERDUTY_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_PAGERDUTY_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: PagerDutyActionCategory[] = [
      'incidents',
      'services',
      'users',
      'schedules',
      'escalation_policies',
    ];
    for (const action of ALL_PAGERDUTY_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_PAGERDUTY_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with PAGERDUTY_', () => {
    for (const action of ALL_PAGERDUTY_ACTIONS) {
      expect(action.name).toMatch(/^PAGERDUTY_/);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('PagerDuty query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getPagerDutyFeaturedActionNames();
    expect(names.length).toBe(ALL_PAGERDUTY_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getPagerDutyActionsByPriority(1);
    const p2 = getPagerDutyActionsByPriority(2);
    const p3 = getPagerDutyActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: PagerDutyAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getPagerDutyActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: PagerDutyActionCategory = 'incidents';
    const actions = getPagerDutyActionsByCategory(category);
    expect(actions.every((a: PagerDutyAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getPagerDutyActionPriority('PAGERDUTY_LIST_INCIDENTS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getPagerDutyActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getPagerDutyActionPriority('composio_PAGERDUTY_LIST_INCIDENTS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownPagerDutyAction('PAGERDUTY_LIST_INCIDENTS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownPagerDutyAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownPagerDutyAction('composio_PAGERDUTY_LIST_INCIDENTS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructivePagerDutyAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'PAGERDUTY_LIST_INCIDENTS' }];
    const sorted = sortByPagerDutyPriority(tools);
    expect(sorted[0].name).toBe('PAGERDUTY_LIST_INCIDENTS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('PagerDuty stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getPagerDutyActionStats();
    expect(stats.total).toBe(ALL_PAGERDUTY_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getPagerDutySystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getPagerDutyCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Pager');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logPagerDutyToolkitStats()).not.toThrow();
  });
});
