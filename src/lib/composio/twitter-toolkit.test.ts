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
  type TwitterActionCategory,
  type TwitterAction,
  ALL_TWITTER_ACTIONS,
  getTwitterFeaturedActionNames,
  getTwitterActionsByPriority,
  getTwitterActionNamesByPriority,
  getTwitterActionsByCategory,
  getTwitterActionPriority,
  isKnownTwitterAction,
  isDestructiveTwitterAction,
  sortByTwitterPriority,
  getTwitterActionStats,
  getTwitterSystemPrompt,
  getTwitterCapabilitySummary,
  logTwitterToolkitStats,
} from './twitter-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('TwitterToolkit type exports', () => {
  it('should export TwitterActionCategory type', () => {
    const cat: TwitterActionCategory = 'tweets';
    expect(['tweets', 'search', 'dms', 'users', 'lists', 'spaces', 'admin']).toContain(cat);
  });

  it('should export TwitterAction interface', () => {
    const action: TwitterAction = {
      name: 'TWITTER_CREATION_OF_A_POST',
      label: 'Create Tweet',
      category: 'tweets',
      priority: 1,
      writeOperation: true,
    };
    expect(action.priority).toBe(1);
    expect(action.writeOperation).toBe(true);
  });

  it('should support optional destructive field', () => {
    const action: TwitterAction = {
      name: 'TWITTER_POST_DELETE_BY_POST_ID',
      label: 'Delete Tweet',
      category: 'tweets',
      priority: 4,
      writeOperation: true,
      destructive: true,
    };
    expect(action.destructive).toBe(true);
  });
});

// ============================================================================
// ALL_TWITTER_ACTIONS REGISTRY
// ============================================================================

describe('ALL_TWITTER_ACTIONS', () => {
  it('should be a non-empty array', () => {
    expect(ALL_TWITTER_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have actions with valid priorities 1-4', () => {
    for (const action of ALL_TWITTER_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have actions with valid categories', () => {
    const validCategories = ['tweets', 'search', 'dms', 'users', 'lists', 'spaces', 'admin'];
    for (const action of ALL_TWITTER_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have unique action names', () => {
    const names = ALL_TWITTER_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have essential (priority 1) actions', () => {
    const essential = ALL_TWITTER_ACTIONS.filter((a) => a.priority === 1);
    expect(essential.length).toBeGreaterThan(0);
  });

  it('should include tweet creation', () => {
    const create = ALL_TWITTER_ACTIONS.find((a) => a.name === 'TWITTER_CREATION_OF_A_POST');
    expect(create).toBeDefined();
    expect(create?.priority).toBe(1);
    expect(create?.writeOperation).toBe(true);
  });

  it('should mark destructive actions', () => {
    const destructive = ALL_TWITTER_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const d of destructive) {
      expect(d.priority).toBe(4);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('getTwitterFeaturedActionNames', () => {
  it('should return all action names', () => {
    const names = getTwitterFeaturedActionNames();
    expect(names.length).toBe(ALL_TWITTER_ACTIONS.length);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should include TWITTER_CREATION_OF_A_POST', () => {
    expect(getTwitterFeaturedActionNames()).toContain('TWITTER_CREATION_OF_A_POST');
  });
});

describe('getTwitterActionsByPriority', () => {
  it('should return only actions at or below given priority', () => {
    const p2 = getTwitterActionsByPriority(2);
    for (const a of p2) {
      expect(a.priority).toBeLessThanOrEqual(2);
    }
  });

  it('should return more actions at higher max priority', () => {
    const p1 = getTwitterActionsByPriority(1);
    const p3 = getTwitterActionsByPriority(3);
    expect(p3.length).toBeGreaterThanOrEqual(p1.length);
  });

  it('should default to maxPriority 3', () => {
    const defaultResult = getTwitterActionsByPriority();
    const p3 = getTwitterActionsByPriority(3);
    expect(defaultResult.length).toBe(p3.length);
  });
});

describe('getTwitterActionNamesByPriority', () => {
  it('should return string array', () => {
    const names = getTwitterActionNamesByPriority(2);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should match getTwitterActionsByPriority length', () => {
    const actions = getTwitterActionsByPriority(2);
    const names = getTwitterActionNamesByPriority(2);
    expect(names.length).toBe(actions.length);
  });
});

describe('getTwitterActionsByCategory', () => {
  it('should return tweets category actions', () => {
    const tweets = getTwitterActionsByCategory('tweets');
    expect(tweets.length).toBeGreaterThan(0);
    for (const a of tweets) {
      expect(a.category).toBe('tweets');
    }
  });

  it('should return search category actions', () => {
    const search = getTwitterActionsByCategory('search');
    expect(search.length).toBeGreaterThan(0);
    for (const a of search) {
      expect(a.category).toBe('search');
    }
  });

  it('should return dms category actions', () => {
    const dms = getTwitterActionsByCategory('dms');
    expect(dms.length).toBeGreaterThan(0);
  });

  it('should return users category actions', () => {
    const users = getTwitterActionsByCategory('users');
    expect(users.length).toBeGreaterThan(0);
  });
});

describe('getTwitterActionPriority', () => {
  it('should return priority for known action', () => {
    expect(getTwitterActionPriority('TWITTER_CREATION_OF_A_POST')).toBe(1);
  });

  it('should handle composio_ prefix', () => {
    expect(getTwitterActionPriority('composio_TWITTER_CREATION_OF_A_POST')).toBe(1);
  });

  it('should return 99 for unknown action', () => {
    expect(getTwitterActionPriority('UNKNOWN_ACTION')).toBe(99);
  });
});

describe('isKnownTwitterAction', () => {
  it('should return true for known action', () => {
    expect(isKnownTwitterAction('TWITTER_CREATION_OF_A_POST')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isKnownTwitterAction('composio_TWITTER_CREATION_OF_A_POST')).toBe(true);
  });

  it('should return false for unknown action', () => {
    expect(isKnownTwitterAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('isDestructiveTwitterAction', () => {
  it('should return true for destructive actions', () => {
    expect(isDestructiveTwitterAction('TWITTER_POST_DELETE_BY_POST_ID')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isDestructiveTwitterAction('composio_TWITTER_POST_DELETE_BY_POST_ID')).toBe(true);
  });

  it('should return false for non-destructive action', () => {
    expect(isDestructiveTwitterAction('TWITTER_CREATION_OF_A_POST')).toBe(false);
  });

  it('should return false for unknown action', () => {
    expect(isDestructiveTwitterAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('sortByTwitterPriority', () => {
  it('should sort tools by priority ascending', () => {
    const tools = [
      { name: 'TWITTER_POST_DELETE_BY_POST_ID' }, // priority 4
      { name: 'TWITTER_CREATION_OF_A_POST' }, // priority 1
      { name: 'TWITTER_FULL_ARCHIVE_SEARCH' }, // priority 2
    ];
    const sorted = sortByTwitterPriority(tools);
    expect(sorted[0].name).toBe('TWITTER_CREATION_OF_A_POST');
    expect(sorted[2].name).toBe('TWITTER_POST_DELETE_BY_POST_ID');
  });

  it('should place unknown actions last', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'TWITTER_CREATION_OF_A_POST' }];
    const sorted = sortByTwitterPriority(tools);
    expect(sorted[0].name).toBe('TWITTER_CREATION_OF_A_POST');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });

  it('should not mutate original array', () => {
    const tools = [
      { name: 'TWITTER_POST_DELETE_BY_POST_ID' },
      { name: 'TWITTER_CREATION_OF_A_POST' },
    ];
    const original = [...tools];
    sortByTwitterPriority(tools);
    expect(tools).toEqual(original);
  });
});

describe('getTwitterActionStats', () => {
  it('should return total count', () => {
    const stats = getTwitterActionStats();
    expect(stats.total).toBe(ALL_TWITTER_ACTIONS.length);
  });

  it('should have byPriority breakdown', () => {
    const stats = getTwitterActionStats();
    expect(stats.byPriority[1]).toBeGreaterThan(0);
    expect(stats.byPriority[2]).toBeGreaterThan(0);
    expect(stats.byPriority[3]).toBeGreaterThan(0);
    expect(stats.byPriority[4]).toBeGreaterThan(0);
  });

  it('should have byCategory breakdown', () => {
    const stats = getTwitterActionStats();
    expect(stats.byCategory['tweets']).toBeGreaterThan(0);
    expect(stats.byCategory['search']).toBeGreaterThan(0);
  });

  it('should sum priorities to total', () => {
    const stats = getTwitterActionStats();
    const sum = Object.values(stats.byPriority).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });

  it('should sum categories to total', () => {
    const stats = getTwitterActionStats();
    const sum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });
});

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

describe('getTwitterSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = getTwitterSystemPrompt();
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should mention Twitter/X', () => {
    expect(getTwitterSystemPrompt()).toContain('Twitter/X');
  });

  it('should mention safety rules', () => {
    expect(getTwitterSystemPrompt()).toContain('Safety Rules');
  });

  it('should mention composio tools', () => {
    expect(getTwitterSystemPrompt()).toContain('composio_TWITTER_');
  });
});

describe('getTwitterCapabilitySummary', () => {
  it('should return a non-empty string', () => {
    expect(getTwitterCapabilitySummary().length).toBeGreaterThan(0);
  });

  it('should include action count', () => {
    const stats = getTwitterActionStats();
    expect(getTwitterCapabilitySummary()).toContain(`${stats.total}`);
  });
});

describe('logTwitterToolkitStats', () => {
  it('should be a function', () => {
    expect(typeof logTwitterToolkitStats).toBe('function');
  });

  it('should not throw', () => {
    expect(() => logTwitterToolkitStats()).not.toThrow();
  });
});
