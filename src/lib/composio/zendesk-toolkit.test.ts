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
  type ZendeskActionCategory,
  type ZendeskAction,
  ALL_ZENDESK_ACTIONS,
  getZendeskFeaturedActionNames,
  getZendeskActionsByPriority,
  getZendeskActionNamesByPriority,
  getZendeskActionsByCategory,
  getZendeskActionPriority,
  isKnownZendeskAction,
  isDestructiveZendeskAction,
  sortByZendeskPriority,
  getZendeskActionStats,
  getZendeskSystemPrompt,
  getZendeskCapabilitySummary,
  logZendeskToolkitStats,
} from './zendesk-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('ZendeskToolkit type exports', () => {
  it('should export ZendeskActionCategory type', () => {
    const cat: ZendeskActionCategory = 'tickets';
    expect(['tickets', 'users', 'organizations', 'comments', 'groups', 'views']).toContain(cat);
  });

  it('should export ZendeskAction interface', () => {
    const action: ZendeskAction = {
      name: 'ZENDESK_CREATE_TICKET',
      label: 'Test',
      category: 'tickets',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_ZENDESK_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_ZENDESK_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_ZENDESK_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_ZENDESK_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: ZendeskActionCategory[] = [
      'tickets',
      'users',
      'organizations',
      'comments',
      'groups',
      'views',
    ];
    for (const action of ALL_ZENDESK_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_ZENDESK_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with ZENDESK_', () => {
    for (const action of ALL_ZENDESK_ACTIONS) {
      expect(action.name).toMatch(/^ZENDESK_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_ZENDESK_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Zendesk query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getZendeskFeaturedActionNames();
    expect(names.length).toBe(ALL_ZENDESK_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getZendeskActionsByPriority(1);
    const p2 = getZendeskActionsByPriority(2);
    const p3 = getZendeskActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: ZendeskAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getZendeskActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: ZendeskActionCategory = 'tickets';
    const actions = getZendeskActionsByCategory(category);
    expect(actions.every((a: ZendeskAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getZendeskActionPriority('ZENDESK_CREATE_TICKET');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getZendeskActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getZendeskActionPriority('composio_ZENDESK_CREATE_TICKET');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownZendeskAction('ZENDESK_CREATE_TICKET')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownZendeskAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownZendeskAction('composio_ZENDESK_CREATE_TICKET')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveZendeskAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveZendeskAction('ZENDESK_DELETE_TICKET')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'ZENDESK_CREATE_TICKET' }];
    const sorted = sortByZendeskPriority(tools);
    expect(sorted[0].name).toBe('ZENDESK_CREATE_TICKET');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Zendesk stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getZendeskActionStats();
    expect(stats.total).toBe(ALL_ZENDESK_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getZendeskSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getZendeskCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Zendesk');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logZendeskToolkitStats()).not.toThrow();
  });
});
