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
  type ConfluenceActionCategory,
  type ConfluenceAction,
  ALL_CONFLUENCE_ACTIONS,
  getConfluenceFeaturedActionNames,
  getConfluenceActionsByPriority,
  getConfluenceActionNamesByPriority,
  getConfluenceActionsByCategory,
  getConfluenceActionPriority,
  isKnownConfluenceAction,
  isDestructiveConfluenceAction,
  sortByConfluencePriority,
  getConfluenceActionStats,
  getConfluenceSystemPrompt,
  getConfluenceCapabilitySummary,
  logConfluenceToolkitStats,
} from './confluence-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('ConfluenceToolkit type exports', () => {
  it('should export ConfluenceActionCategory type', () => {
    const cat: ConfluenceActionCategory = 'pages';
    expect(['pages', 'spaces', 'comments', 'labels', 'attachments', 'users']).toContain(cat);
  });

  it('should export ConfluenceAction interface', () => {
    const action: ConfluenceAction = {
      name: 'CONFLUENCE_CREATE_PAGE',
      label: 'Test',
      category: 'pages',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_CONFLUENCE_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_CONFLUENCE_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_CONFLUENCE_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_CONFLUENCE_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: ConfluenceActionCategory[] = [
      'pages',
      'spaces',
      'comments',
      'labels',
      'attachments',
      'users',
    ];
    for (const action of ALL_CONFLUENCE_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_CONFLUENCE_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with CONFLUENCE_', () => {
    for (const action of ALL_CONFLUENCE_ACTIONS) {
      expect(action.name).toMatch(/^CONFLUENCE_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_CONFLUENCE_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Confluence query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getConfluenceFeaturedActionNames();
    expect(names.length).toBe(ALL_CONFLUENCE_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getConfluenceActionsByPriority(1);
    const p2 = getConfluenceActionsByPriority(2);
    const p3 = getConfluenceActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: ConfluenceAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getConfluenceActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: ConfluenceActionCategory = 'pages';
    const actions = getConfluenceActionsByCategory(category);
    expect(actions.every((a: ConfluenceAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getConfluenceActionPriority('CONFLUENCE_CREATE_PAGE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getConfluenceActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getConfluenceActionPriority('composio_CONFLUENCE_CREATE_PAGE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownConfluenceAction('CONFLUENCE_CREATE_PAGE')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownConfluenceAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownConfluenceAction('composio_CONFLUENCE_CREATE_PAGE')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveConfluenceAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveConfluenceAction('CONFLUENCE_DELETE_PAGE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'CONFLUENCE_CREATE_PAGE' }];
    const sorted = sortByConfluencePriority(tools);
    expect(sorted[0].name).toBe('CONFLUENCE_CREATE_PAGE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Confluence stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getConfluenceActionStats();
    expect(stats.total).toBe(ALL_CONFLUENCE_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getConfluenceSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getConfluenceCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Confluence');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logConfluenceToolkitStats()).not.toThrow();
  });
});
