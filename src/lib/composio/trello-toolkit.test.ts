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
  type TrelloActionCategory,
  type TrelloAction,
  ALL_TRELLO_ACTIONS,
  getTrelloFeaturedActionNames,
  getTrelloActionsByPriority,
  getTrelloActionNamesByPriority,
  getTrelloActionsByCategory,
  getTrelloActionPriority,
  isKnownTrelloAction,
  isDestructiveTrelloAction,
  sortByTrelloPriority,
  getTrelloActionStats,
  getTrelloSystemPrompt,
  getTrelloCapabilitySummary,
  logTrelloToolkitStats,
} from './trello-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('TrelloToolkit type exports', () => {
  it('should export TrelloActionCategory type', () => {
    const cat: TrelloActionCategory = 'cards';
    expect(['cards', 'boards', 'lists', 'labels', 'members', 'checklists', 'comments']).toContain(
      cat
    );
  });

  it('should export TrelloAction interface', () => {
    const action: TrelloAction = {
      name: 'TRELLO_CREATE_CARD',
      label: 'Test',
      category: 'cards',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_TRELLO_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_TRELLO_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_TRELLO_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_TRELLO_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: TrelloActionCategory[] = [
      'cards',
      'boards',
      'lists',
      'labels',
      'members',
      'checklists',
      'comments',
    ];
    for (const action of ALL_TRELLO_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_TRELLO_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with TRELLO_', () => {
    for (const action of ALL_TRELLO_ACTIONS) {
      expect(action.name).toMatch(/^TRELLO_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_TRELLO_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Trello query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getTrelloFeaturedActionNames();
    expect(names.length).toBe(ALL_TRELLO_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getTrelloActionsByPriority(1);
    const p2 = getTrelloActionsByPriority(2);
    const p3 = getTrelloActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: TrelloAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getTrelloActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: TrelloActionCategory = 'cards';
    const actions = getTrelloActionsByCategory(category);
    expect(actions.every((a: TrelloAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getTrelloActionPriority('TRELLO_CREATE_CARD');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getTrelloActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getTrelloActionPriority('composio_TRELLO_CREATE_CARD');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownTrelloAction('TRELLO_CREATE_CARD')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownTrelloAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownTrelloAction('composio_TRELLO_CREATE_CARD')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveTrelloAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveTrelloAction('TRELLO_DELETE_CARD')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'TRELLO_CREATE_CARD' }];
    const sorted = sortByTrelloPriority(tools);
    expect(sorted[0].name).toBe('TRELLO_CREATE_CARD');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Trello stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getTrelloActionStats();
    expect(stats.total).toBe(ALL_TRELLO_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getTrelloSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getTrelloCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Trello');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logTrelloToolkitStats()).not.toThrow();
  });
});
