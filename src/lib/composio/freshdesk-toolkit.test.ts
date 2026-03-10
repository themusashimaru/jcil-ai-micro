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
  type FreshdeskActionCategory,
  type FreshdeskAction,
  ALL_FRESHDESK_ACTIONS,
  getFreshdeskFeaturedActionNames,
  getFreshdeskActionsByPriority,
  getFreshdeskActionNamesByPriority,
  getFreshdeskActionsByCategory,
  getFreshdeskActionPriority,
  isKnownFreshdeskAction,
  isDestructiveFreshdeskAction,
  sortByFreshdeskPriority,
  getFreshdeskActionStats,
  getFreshdeskSystemPrompt,
  getFreshdeskCapabilitySummary,
  logFreshdeskToolkitStats,
} from './freshdesk-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('FreshdeskToolkit type exports', () => {
  it('should export FreshdeskActionCategory type', () => {
    const cat: FreshdeskActionCategory = 'tickets';
    expect(['tickets', 'contacts', 'companies', 'agents', 'groups']).toContain(cat);
  });

  it('should export FreshdeskAction interface', () => {
    const action: FreshdeskAction = {
      name: 'FRESHDESK_CREATE_TICKET',
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

describe('ALL_FRESHDESK_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_FRESHDESK_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_FRESHDESK_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_FRESHDESK_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: FreshdeskActionCategory[] = [
      'tickets',
      'contacts',
      'companies',
      'agents',
      'groups',
    ];
    for (const action of ALL_FRESHDESK_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_FRESHDESK_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with FRESHDESK_', () => {
    for (const action of ALL_FRESHDESK_ACTIONS) {
      expect(action.name).toMatch(/^FRESHDESK_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_FRESHDESK_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Freshdesk query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getFreshdeskFeaturedActionNames();
    expect(names.length).toBe(ALL_FRESHDESK_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getFreshdeskActionsByPriority(1);
    const p2 = getFreshdeskActionsByPriority(2);
    const p3 = getFreshdeskActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: FreshdeskAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getFreshdeskActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: FreshdeskActionCategory = 'tickets';
    const actions = getFreshdeskActionsByCategory(category);
    expect(actions.every((a: FreshdeskAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getFreshdeskActionPriority('FRESHDESK_CREATE_TICKET');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getFreshdeskActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getFreshdeskActionPriority('composio_FRESHDESK_CREATE_TICKET');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownFreshdeskAction('FRESHDESK_CREATE_TICKET')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownFreshdeskAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownFreshdeskAction('composio_FRESHDESK_CREATE_TICKET')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveFreshdeskAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveFreshdeskAction('FRESHDESK_DELETE_TICKET')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'FRESHDESK_CREATE_TICKET' }];
    const sorted = sortByFreshdeskPriority(tools);
    expect(sorted[0].name).toBe('FRESHDESK_CREATE_TICKET');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Freshdesk stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getFreshdeskActionStats();
    expect(stats.total).toBe(ALL_FRESHDESK_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getFreshdeskSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getFreshdeskCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Freshdesk');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logFreshdeskToolkitStats()).not.toThrow();
  });
});
