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
  type GoogleAnalyticsActionCategory,
  type GoogleAnalyticsAction,
  ALL_GOOGLE_ANALYTICS_ACTIONS,
  getGoogleAnalyticsFeaturedActionNames,
  getGoogleAnalyticsActionsByPriority,
  getGoogleAnalyticsActionNamesByPriority,
  getGoogleAnalyticsActionsByCategory,
  getGoogleAnalyticsActionPriority,
  isKnownGoogleAnalyticsAction,
  isDestructiveGoogleAnalyticsAction,
  sortByGoogleAnalyticsPriority,
  getGoogleAnalyticsActionStats,
  getGoogleAnalyticsSystemPrompt,
  getGoogleAnalyticsCapabilitySummary,
  logGoogleAnalyticsToolkitStats,
} from './googleanalytics-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GoogleAnalyticsToolkit type exports', () => {
  it('should export GoogleAnalyticsActionCategory type', () => {
    const cat: GoogleAnalyticsActionCategory = 'reports';
    expect(['reports', 'properties', 'audiences', 'conversions', 'admin']).toContain(cat);
  });

  it('should export GoogleAnalyticsAction interface', () => {
    const action: GoogleAnalyticsAction = {
      name: 'GOOGLEANALYTICS_RUN_REPORT',
      label: 'Test',
      category: 'reports',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_GOOGLE_ANALYTICS_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GOOGLE_ANALYTICS_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GOOGLE_ANALYTICS_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GOOGLE_ANALYTICS_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GoogleAnalyticsActionCategory[] = [
      'reports',
      'properties',
      'audiences',
      'conversions',
      'admin',
    ];
    for (const action of ALL_GOOGLE_ANALYTICS_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GOOGLE_ANALYTICS_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GOOGLEANALYTICS_', () => {
    for (const action of ALL_GOOGLE_ANALYTICS_ACTIONS) {
      expect(action.name).toMatch(/^GOOGLEANALYTICS_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GOOGLE_ANALYTICS_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('GoogleAnalytics query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGoogleAnalyticsFeaturedActionNames();
    expect(names.length).toBe(ALL_GOOGLE_ANALYTICS_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGoogleAnalyticsActionsByPriority(1);
    const p2 = getGoogleAnalyticsActionsByPriority(2);
    const p3 = getGoogleAnalyticsActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GoogleAnalyticsAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGoogleAnalyticsActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GoogleAnalyticsActionCategory = 'reports';
    const actions = getGoogleAnalyticsActionsByCategory(category);
    expect(actions.every((a: GoogleAnalyticsAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGoogleAnalyticsActionPriority('GOOGLEANALYTICS_RUN_REPORT');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGoogleAnalyticsActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGoogleAnalyticsActionPriority('composio_GOOGLEANALYTICS_RUN_REPORT');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGoogleAnalyticsAction('GOOGLEANALYTICS_RUN_REPORT')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGoogleAnalyticsAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownGoogleAnalyticsAction('composio_GOOGLEANALYTICS_RUN_REPORT')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGoogleAnalyticsAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveGoogleAnalyticsAction('GOOGLEANALYTICS_DELETE_AUDIENCE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GOOGLEANALYTICS_RUN_REPORT' }];
    const sorted = sortByGoogleAnalyticsPriority(tools);
    expect(sorted[0].name).toBe('GOOGLEANALYTICS_RUN_REPORT');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('GoogleAnalytics stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGoogleAnalyticsActionStats();
    expect(stats.total).toBe(ALL_GOOGLE_ANALYTICS_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGoogleAnalyticsSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGoogleAnalyticsCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Google');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGoogleAnalyticsToolkitStats()).not.toThrow();
  });
});
