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
  type GoogleAdsActionCategory,
  type GoogleAdsAction,
  ALL_GOOGLE_ADS_ACTIONS,
  getGoogleAdsFeaturedActionNames,
  getGoogleAdsActionsByPriority,
  getGoogleAdsActionNamesByPriority,
  getGoogleAdsActionsByCategory,
  getGoogleAdsActionPriority,
  isKnownGoogleAdsAction,
  isDestructiveGoogleAdsAction,
  sortByGoogleAdsPriority,
  getGoogleAdsActionStats,
  getGoogleAdsSystemPrompt,
  getGoogleAdsCapabilitySummary,
  logGoogleAdsToolkitStats,
} from './googleads-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GoogleAdsToolkit type exports', () => {
  it('should export GoogleAdsActionCategory type', () => {
    const cat: GoogleAdsActionCategory = 'campaigns';
    expect(['campaigns', 'adgroups', 'ads', 'keywords', 'reports', 'budgets']).toContain(cat);
  });

  it('should export GoogleAdsAction interface', () => {
    const action: GoogleAdsAction = {
      name: 'GOOGLEADS_LIST_CAMPAIGNS',
      label: 'Test',
      category: 'campaigns',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_GOOGLE_ADS_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GOOGLE_ADS_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GOOGLE_ADS_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GOOGLE_ADS_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GoogleAdsActionCategory[] = [
      'campaigns',
      'adgroups',
      'ads',
      'keywords',
      'reports',
      'budgets',
    ];
    for (const action of ALL_GOOGLE_ADS_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GOOGLE_ADS_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GOOGLEADS_', () => {
    for (const action of ALL_GOOGLE_ADS_ACTIONS) {
      expect(action.name).toMatch(/^GOOGLEADS_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GOOGLE_ADS_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('GoogleAds query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGoogleAdsFeaturedActionNames();
    expect(names.length).toBe(ALL_GOOGLE_ADS_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGoogleAdsActionsByPriority(1);
    const p2 = getGoogleAdsActionsByPriority(2);
    const p3 = getGoogleAdsActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GoogleAdsAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGoogleAdsActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GoogleAdsActionCategory = 'campaigns';
    const actions = getGoogleAdsActionsByCategory(category);
    expect(actions.every((a: GoogleAdsAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGoogleAdsActionPriority('GOOGLEADS_LIST_CAMPAIGNS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGoogleAdsActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGoogleAdsActionPriority('composio_GOOGLEADS_LIST_CAMPAIGNS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGoogleAdsAction('GOOGLEADS_LIST_CAMPAIGNS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGoogleAdsAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownGoogleAdsAction('composio_GOOGLEADS_LIST_CAMPAIGNS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGoogleAdsAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveGoogleAdsAction('GOOGLEADS_REMOVE_CAMPAIGN')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GOOGLEADS_LIST_CAMPAIGNS' }];
    const sorted = sortByGoogleAdsPriority(tools);
    expect(sorted[0].name).toBe('GOOGLEADS_LIST_CAMPAIGNS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('GoogleAds stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGoogleAdsActionStats();
    expect(stats.total).toBe(ALL_GOOGLE_ADS_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGoogleAdsSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGoogleAdsCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Google');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGoogleAdsToolkitStats()).not.toThrow();
  });
});
