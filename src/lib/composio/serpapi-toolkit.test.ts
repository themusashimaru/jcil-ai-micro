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
  type SerpAPIActionCategory,
  type SerpAPIAction,
  ALL_SERPAPI_ACTIONS,
  getSerpAPIFeaturedActionNames,
  getSerpAPIActionsByPriority,
  getSerpAPIActionNamesByPriority,
  getSerpAPIActionsByCategory,
  getSerpAPIActionPriority,
  isKnownSerpAPIAction,
  isDestructiveSerpAPIAction,
  sortBySerpAPIPriority,
  getSerpAPIActionStats,
  getSerpAPISystemPrompt,
  getSerpAPICapabilitySummary,
  logSerpAPIToolkitStats,
} from './serpapi-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('SerpAPIToolkit type exports', () => {
  it('should export SerpAPIActionCategory type', () => {
    const cat: SerpAPIActionCategory = 'search';
    expect(['search', 'images', 'news', 'shopping', 'local']).toContain(cat);
  });

  it('should export SerpAPIAction interface', () => {
    const action: SerpAPIAction = {
      name: 'SERPAPI_GOOGLE_SEARCH',
      label: 'Test',
      category: 'search',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_SERPAPI_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_SERPAPI_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_SERPAPI_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_SERPAPI_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: SerpAPIActionCategory[] = [
      'search',
      'images',
      'news',
      'shopping',
      'local',
    ];
    for (const action of ALL_SERPAPI_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_SERPAPI_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with SERPAPI_', () => {
    for (const action of ALL_SERPAPI_ACTIONS) {
      expect(action.name).toMatch(/^SERPAPI_/);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('SerpAPI query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getSerpAPIFeaturedActionNames();
    expect(names.length).toBe(ALL_SERPAPI_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getSerpAPIActionsByPriority(1);
    const p2 = getSerpAPIActionsByPriority(2);
    const p3 = getSerpAPIActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: SerpAPIAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getSerpAPIActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: SerpAPIActionCategory = 'search';
    const actions = getSerpAPIActionsByCategory(category);
    expect(actions.every((a: SerpAPIAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getSerpAPIActionPriority('SERPAPI_GOOGLE_SEARCH');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getSerpAPIActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getSerpAPIActionPriority('composio_SERPAPI_GOOGLE_SEARCH');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownSerpAPIAction('SERPAPI_GOOGLE_SEARCH')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownSerpAPIAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownSerpAPIAction('composio_SERPAPI_GOOGLE_SEARCH')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveSerpAPIAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'SERPAPI_GOOGLE_SEARCH' }];
    const sorted = sortBySerpAPIPriority(tools);
    expect(sorted[0].name).toBe('SERPAPI_GOOGLE_SEARCH');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('SerpAPI stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getSerpAPIActionStats();
    expect(stats.total).toBe(ALL_SERPAPI_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getSerpAPISystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getSerpAPICapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Serp');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logSerpAPIToolkitStats()).not.toThrow();
  });
});
