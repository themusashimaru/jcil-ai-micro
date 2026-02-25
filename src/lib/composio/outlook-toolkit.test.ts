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
  type OutlookActionCategory,
  type OutlookAction,
  ALL_OUTLOOK_ACTIONS,
  getOutlookFeaturedActionNames,
  getOutlookActionsByPriority,
  getOutlookActionNamesByPriority,
  getOutlookActionsByCategory,
  getOutlookActionPriority,
  isKnownOutlookAction,
  isDestructiveOutlookAction,
  sortByOutlookPriority,
  getOutlookActionStats,
  getOutlookSystemPrompt,
  getOutlookCapabilitySummary,
  logOutlookToolkitStats,
} from './outlook-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('OutlookToolkit type exports', () => {
  it('should export OutlookActionCategory type', () => {
    const cat: OutlookActionCategory = 'email';
    expect(['email', 'calendar', 'contacts', 'settings']).toContain(cat);
  });

  it('should export OutlookAction interface', () => {
    const action: OutlookAction = {
      name: 'OUTLOOK_SEND_EMAIL',
      label: 'Test',
      category: 'email',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_OUTLOOK_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_OUTLOOK_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_OUTLOOK_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_OUTLOOK_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: OutlookActionCategory[] = ['email', 'calendar', 'contacts', 'settings'];
    for (const action of ALL_OUTLOOK_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_OUTLOOK_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with OUTLOOK_', () => {
    for (const action of ALL_OUTLOOK_ACTIONS) {
      expect(action.name).toMatch(/^OUTLOOK_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_OUTLOOK_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Outlook query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getOutlookFeaturedActionNames();
    expect(names.length).toBe(ALL_OUTLOOK_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getOutlookActionsByPriority(1);
    const p2 = getOutlookActionsByPriority(2);
    const p3 = getOutlookActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: OutlookAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getOutlookActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: OutlookActionCategory = 'email';
    const actions = getOutlookActionsByCategory(category);
    expect(actions.every((a: OutlookAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getOutlookActionPriority('OUTLOOK_SEND_EMAIL');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getOutlookActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getOutlookActionPriority('composio_OUTLOOK_SEND_EMAIL');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownOutlookAction('OUTLOOK_SEND_EMAIL')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownOutlookAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownOutlookAction('composio_OUTLOOK_SEND_EMAIL')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveOutlookAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveOutlookAction('OUTLOOK_DELETE_MESSAGE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'OUTLOOK_SEND_EMAIL' }];
    const sorted = sortByOutlookPriority(tools);
    expect(sorted[0].name).toBe('OUTLOOK_SEND_EMAIL');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Outlook stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getOutlookActionStats();
    expect(stats.total).toBe(ALL_OUTLOOK_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getOutlookSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getOutlookCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Outlook');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logOutlookToolkitStats()).not.toThrow();
  });
});
