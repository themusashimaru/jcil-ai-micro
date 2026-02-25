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
  type BitbucketActionCategory,
  type BitbucketAction,
  ALL_BITBUCKET_ACTIONS,
  getBitbucketFeaturedActionNames,
  getBitbucketActionsByPriority,
  getBitbucketActionNamesByPriority,
  getBitbucketActionsByCategory,
  getBitbucketActionPriority,
  isKnownBitbucketAction,
  isDestructiveBitbucketAction,
  sortByBitbucketPriority,
  getBitbucketActionStats,
  getBitbucketSystemPrompt,
  getBitbucketCapabilitySummary,
  logBitbucketToolkitStats,
} from './bitbucket-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('BitbucketToolkit type exports', () => {
  it('should export BitbucketActionCategory type', () => {
    const cat: BitbucketActionCategory = 'repositories';
    expect(['repositories', 'pull_requests', 'issues', 'branches', 'pipelines']).toContain(cat);
  });

  it('should export BitbucketAction interface', () => {
    const action: BitbucketAction = {
      name: 'BITBUCKET_LIST_REPOS',
      label: 'Test',
      category: 'repositories',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_BITBUCKET_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_BITBUCKET_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_BITBUCKET_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_BITBUCKET_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: BitbucketActionCategory[] = [
      'repositories',
      'pull_requests',
      'issues',
      'branches',
      'pipelines',
    ];
    for (const action of ALL_BITBUCKET_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_BITBUCKET_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with BITBUCKET_', () => {
    for (const action of ALL_BITBUCKET_ACTIONS) {
      expect(action.name).toMatch(/^BITBUCKET_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_BITBUCKET_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Bitbucket query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getBitbucketFeaturedActionNames();
    expect(names.length).toBe(ALL_BITBUCKET_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getBitbucketActionsByPriority(1);
    const p2 = getBitbucketActionsByPriority(2);
    const p3 = getBitbucketActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: BitbucketAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getBitbucketActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: BitbucketActionCategory = 'repositories';
    const actions = getBitbucketActionsByCategory(category);
    expect(actions.every((a: BitbucketAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getBitbucketActionPriority('BITBUCKET_LIST_REPOS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getBitbucketActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getBitbucketActionPriority('composio_BITBUCKET_LIST_REPOS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownBitbucketAction('BITBUCKET_LIST_REPOS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownBitbucketAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownBitbucketAction('composio_BITBUCKET_LIST_REPOS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveBitbucketAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveBitbucketAction('BITBUCKET_DECLINE_PR')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'BITBUCKET_LIST_REPOS' }];
    const sorted = sortByBitbucketPriority(tools);
    expect(sorted[0].name).toBe('BITBUCKET_LIST_REPOS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Bitbucket stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getBitbucketActionStats();
    expect(stats.total).toBe(ALL_BITBUCKET_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getBitbucketSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getBitbucketCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Bitbucket');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logBitbucketToolkitStats()).not.toThrow();
  });
});
