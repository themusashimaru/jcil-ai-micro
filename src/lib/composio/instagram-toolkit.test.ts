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
  type InstagramActionCategory,
  type InstagramAction,
  ALL_INSTAGRAM_ACTIONS,
  getInstagramFeaturedActionNames,
  getInstagramActionsByPriority,
  getInstagramActionNamesByPriority,
  getInstagramActionsByCategory,
  getInstagramActionPriority,
  isKnownInstagramAction,
  isDestructiveInstagramAction,
  sortByInstagramPriority,
  getInstagramActionStats,
  getInstagramSystemPrompt,
  getInstagramCapabilitySummary,
  logInstagramToolkitStats,
} from './instagram-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('InstagramToolkit type exports', () => {
  it('should export InstagramActionCategory type', () => {
    const cat: InstagramActionCategory = 'publish';
    expect(['publish', 'media', 'engagement', 'messaging', 'analytics', 'profile']).toContain(cat);
  });

  it('should export InstagramAction interface', () => {
    const action: InstagramAction = {
      name: 'INSTAGRAM_CREATE_MEDIA_CONTAINER',
      label: 'Test',
      category: 'publish',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_INSTAGRAM_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_INSTAGRAM_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_INSTAGRAM_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_INSTAGRAM_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: InstagramActionCategory[] = [
      'publish',
      'media',
      'engagement',
      'messaging',
      'analytics',
      'profile',
    ];
    for (const action of ALL_INSTAGRAM_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_INSTAGRAM_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with INSTAGRAM_', () => {
    for (const action of ALL_INSTAGRAM_ACTIONS) {
      expect(action.name).toMatch(/^INSTAGRAM_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_INSTAGRAM_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Instagram query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getInstagramFeaturedActionNames();
    expect(names.length).toBe(ALL_INSTAGRAM_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getInstagramActionsByPriority(1);
    const p2 = getInstagramActionsByPriority(2);
    const p3 = getInstagramActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: InstagramAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getInstagramActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: InstagramActionCategory = 'publish';
    const actions = getInstagramActionsByCategory(category);
    expect(actions.every((a: InstagramAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getInstagramActionPriority('INSTAGRAM_CREATE_MEDIA_CONTAINER');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getInstagramActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getInstagramActionPriority('composio_INSTAGRAM_CREATE_MEDIA_CONTAINER');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownInstagramAction('INSTAGRAM_CREATE_MEDIA_CONTAINER')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownInstagramAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownInstagramAction('composio_INSTAGRAM_CREATE_MEDIA_CONTAINER')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveInstagramAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveInstagramAction('INSTAGRAM_DELETE_COMMENT')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'INSTAGRAM_CREATE_MEDIA_CONTAINER' }];
    const sorted = sortByInstagramPriority(tools);
    expect(sorted[0].name).toBe('INSTAGRAM_CREATE_MEDIA_CONTAINER');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Instagram stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getInstagramActionStats();
    expect(stats.total).toBe(ALL_INSTAGRAM_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getInstagramSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getInstagramCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Instagram');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logInstagramToolkitStats()).not.toThrow();
  });
});
