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
  type SentryActionCategory,
  type SentryAction,
  ALL_SENTRY_ACTIONS,
  getSentryFeaturedActionNames,
  getSentryActionsByPriority,
  getSentryActionNamesByPriority,
  getSentryActionsByCategory,
  getSentryActionPriority,
  isKnownSentryAction,
  isDestructiveSentryAction,
  sortBySentryPriority,
  getSentryActionStats,
  getSentrySystemPrompt,
  getSentryCapabilitySummary,
  logSentryToolkitStats,
} from './sentry-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('SentryToolkit type exports', () => {
  it('should export SentryActionCategory type', () => {
    const cat: SentryActionCategory = 'issues';
    expect([
      'issues',
      'events',
      'projects',
      'releases',
      'alerts',
      'teams',
      'performance',
    ]).toContain(cat);
  });

  it('should export SentryAction interface', () => {
    const action: SentryAction = {
      name: 'SENTRY_LIST_ISSUES',
      label: 'Test',
      category: 'issues',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_SENTRY_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_SENTRY_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_SENTRY_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_SENTRY_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: SentryActionCategory[] = [
      'issues',
      'events',
      'projects',
      'releases',
      'alerts',
      'teams',
      'performance',
    ];
    for (const action of ALL_SENTRY_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_SENTRY_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with SENTRY_', () => {
    for (const action of ALL_SENTRY_ACTIONS) {
      expect(action.name).toMatch(/^SENTRY_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_SENTRY_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Sentry query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getSentryFeaturedActionNames();
    expect(names.length).toBe(ALL_SENTRY_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getSentryActionsByPriority(1);
    const p2 = getSentryActionsByPriority(2);
    const p3 = getSentryActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: SentryAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getSentryActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: SentryActionCategory = 'issues';
    const actions = getSentryActionsByCategory(category);
    expect(actions.every((a: SentryAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getSentryActionPriority('SENTRY_LIST_ISSUES');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getSentryActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getSentryActionPriority('composio_SENTRY_LIST_ISSUES');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownSentryAction('SENTRY_LIST_ISSUES')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownSentryAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownSentryAction('composio_SENTRY_LIST_ISSUES')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveSentryAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveSentryAction('SENTRY_DELETE_RELEASE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'SENTRY_LIST_ISSUES' }];
    const sorted = sortBySentryPriority(tools);
    expect(sorted[0].name).toBe('SENTRY_LIST_ISSUES');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Sentry stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getSentryActionStats();
    expect(stats.total).toBe(ALL_SENTRY_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getSentrySystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getSentryCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Sentry');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logSentryToolkitStats()).not.toThrow();
  });
});
