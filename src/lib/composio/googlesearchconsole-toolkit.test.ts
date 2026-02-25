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
  type GoogleSearchConsoleActionCategory,
  type GoogleSearchConsoleAction,
  ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS,
  getGoogleSearchConsoleFeaturedActionNames,
  getGoogleSearchConsoleActionsByPriority,
  getGoogleSearchConsoleActionNamesByPriority,
  getGoogleSearchConsoleActionsByCategory,
  getGoogleSearchConsoleActionPriority,
  isKnownGoogleSearchConsoleAction,
  isDestructiveGoogleSearchConsoleAction,
  sortByGoogleSearchConsolePriority,
  getGoogleSearchConsoleActionStats,
  getGoogleSearchConsoleSystemPrompt,
  getGoogleSearchConsoleCapabilitySummary,
  logGoogleSearchConsoleToolkitStats,
} from './googlesearchconsole-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GoogleSearchConsoleToolkit type exports', () => {
  it('should export GoogleSearchConsoleActionCategory type', () => {
    const cat: GoogleSearchConsoleActionCategory = 'search';
    expect(['search', 'sitemaps', 'inspection', 'sites']).toContain(cat);
  });

  it('should export GoogleSearchConsoleAction interface', () => {
    const action: GoogleSearchConsoleAction = {
      name: 'GOOGLESEARCHCONSOLE_QUERY_SEARCH_ANALYTICS',
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

describe('ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GoogleSearchConsoleActionCategory[] = [
      'search',
      'sitemaps',
      'inspection',
      'sites',
    ];
    for (const action of ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GOOGLESEARCHCONSOLE_', () => {
    for (const action of ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS) {
      expect(action.name).toMatch(/^GOOGLESEARCHCONSOLE_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('GoogleSearchConsole query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGoogleSearchConsoleFeaturedActionNames();
    expect(names.length).toBe(ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGoogleSearchConsoleActionsByPriority(1);
    const p2 = getGoogleSearchConsoleActionsByPriority(2);
    const p3 = getGoogleSearchConsoleActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GoogleSearchConsoleAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGoogleSearchConsoleActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GoogleSearchConsoleActionCategory = 'search';
    const actions = getGoogleSearchConsoleActionsByCategory(category);
    expect(actions.every((a: GoogleSearchConsoleAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGoogleSearchConsoleActionPriority(
      'GOOGLESEARCHCONSOLE_QUERY_SEARCH_ANALYTICS'
    );
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGoogleSearchConsoleActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGoogleSearchConsoleActionPriority(
      'composio_GOOGLESEARCHCONSOLE_QUERY_SEARCH_ANALYTICS'
    );
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGoogleSearchConsoleAction('GOOGLESEARCHCONSOLE_QUERY_SEARCH_ANALYTICS')).toBe(
      true
    );
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGoogleSearchConsoleAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(
      isKnownGoogleSearchConsoleAction('composio_GOOGLESEARCHCONSOLE_QUERY_SEARCH_ANALYTICS')
    ).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGoogleSearchConsoleAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveGoogleSearchConsoleAction('GOOGLESEARCHCONSOLE_DELETE_SITEMAP')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [
      { name: 'UNKNOWN_TOOL' },
      { name: 'GOOGLESEARCHCONSOLE_QUERY_SEARCH_ANALYTICS' },
    ];
    const sorted = sortByGoogleSearchConsolePriority(tools);
    expect(sorted[0].name).toBe('GOOGLESEARCHCONSOLE_QUERY_SEARCH_ANALYTICS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('GoogleSearchConsole stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGoogleSearchConsoleActionStats();
    expect(stats.total).toBe(ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGoogleSearchConsoleSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGoogleSearchConsoleCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Google');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGoogleSearchConsoleToolkitStats()).not.toThrow();
  });
});
