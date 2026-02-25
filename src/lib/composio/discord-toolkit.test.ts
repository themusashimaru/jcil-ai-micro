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
  type DiscordActionCategory,
  type DiscordAction,
  ALL_DISCORD_ACTIONS,
  getDiscordFeaturedActionNames,
  getDiscordActionsByPriority,
  getDiscordActionNamesByPriority,
  getDiscordActionsByCategory,
  getDiscordActionPriority,
  isKnownDiscordAction,
  isDestructiveDiscordAction,
  sortByDiscordPriority,
  getDiscordActionStats,
  getDiscordSystemPrompt,
  getDiscordCapabilitySummary,
  logDiscordToolkitStats,
} from './discord-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('DiscordToolkit type exports', () => {
  it('should export DiscordActionCategory type', () => {
    const cat: DiscordActionCategory = 'users';
    expect(['users', 'guilds', 'auth']).toContain(cat);
  });

  it('should export DiscordAction interface', () => {
    const action: DiscordAction = {
      name: 'DISCORD_GET_MY_USER',
      label: 'Test',
      category: 'users',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_DISCORD_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_DISCORD_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_DISCORD_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_DISCORD_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: DiscordActionCategory[] = ['users', 'guilds', 'auth'];
    for (const action of ALL_DISCORD_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_DISCORD_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with DISCORD_', () => {
    for (const action of ALL_DISCORD_ACTIONS) {
      expect(action.name).toMatch(/^DISCORD_/);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Discord query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getDiscordFeaturedActionNames();
    expect(names.length).toBe(ALL_DISCORD_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getDiscordActionsByPriority(1);
    const p2 = getDiscordActionsByPriority(2);
    const p3 = getDiscordActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: DiscordAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getDiscordActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: DiscordActionCategory = 'users';
    const actions = getDiscordActionsByCategory(category);
    expect(actions.every((a: DiscordAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getDiscordActionPriority('DISCORD_GET_MY_USER');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getDiscordActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getDiscordActionPriority('composio_DISCORD_GET_MY_USER');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownDiscordAction('DISCORD_GET_MY_USER')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownDiscordAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownDiscordAction('composio_DISCORD_GET_MY_USER')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveDiscordAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'DISCORD_GET_MY_USER' }];
    const sorted = sortByDiscordPriority(tools);
    expect(sorted[0].name).toBe('DISCORD_GET_MY_USER');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Discord stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getDiscordActionStats();
    expect(stats.total).toBe(ALL_DISCORD_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getDiscordSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getDiscordCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Discord');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logDiscordToolkitStats()).not.toThrow();
  });
});
