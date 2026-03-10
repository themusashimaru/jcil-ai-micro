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
  type RedditActionCategory,
  type RedditAction,
  ALL_REDDIT_ACTIONS,
  getRedditFeaturedActionNames,
  getRedditActionsByPriority,
  getRedditActionNamesByPriority,
  getRedditActionsByCategory,
  getRedditActionPriority,
  isKnownRedditAction,
  isDestructiveRedditAction,
  sortByRedditPriority,
  getRedditActionStats,
  getRedditSystemPrompt,
  getRedditCapabilitySummary,
  logRedditToolkitStats,
} from './reddit-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('RedditToolkit type exports', () => {
  it('should export RedditActionCategory type', () => {
    const cat: RedditActionCategory = 'posts';
    expect(['posts', 'comments', 'subreddits', 'users', 'messages', 'moderation']).toContain(cat);
  });

  it('should export RedditAction interface', () => {
    const action: RedditAction = {
      name: 'REDDIT_SUBMIT_POST',
      label: 'Test',
      category: 'posts',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_REDDIT_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_REDDIT_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_REDDIT_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_REDDIT_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: RedditActionCategory[] = [
      'posts',
      'comments',
      'subreddits',
      'users',
      'messages',
      'moderation',
    ];
    for (const action of ALL_REDDIT_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_REDDIT_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with REDDIT_', () => {
    for (const action of ALL_REDDIT_ACTIONS) {
      expect(action.name).toMatch(/^REDDIT_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_REDDIT_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Reddit query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getRedditFeaturedActionNames();
    expect(names.length).toBe(ALL_REDDIT_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getRedditActionsByPriority(1);
    const p2 = getRedditActionsByPriority(2);
    const p3 = getRedditActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: RedditAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getRedditActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: RedditActionCategory = 'posts';
    const actions = getRedditActionsByCategory(category);
    expect(actions.every((a: RedditAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getRedditActionPriority('REDDIT_SUBMIT_POST');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getRedditActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getRedditActionPriority('composio_REDDIT_SUBMIT_POST');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownRedditAction('REDDIT_SUBMIT_POST')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownRedditAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownRedditAction('composio_REDDIT_SUBMIT_POST')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveRedditAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveRedditAction('REDDIT_DELETE_POST')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'REDDIT_SUBMIT_POST' }];
    const sorted = sortByRedditPriority(tools);
    expect(sorted[0].name).toBe('REDDIT_SUBMIT_POST');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Reddit stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getRedditActionStats();
    expect(stats.total).toBe(ALL_REDDIT_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getRedditSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getRedditCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Reddit');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logRedditToolkitStats()).not.toThrow();
  });
});
