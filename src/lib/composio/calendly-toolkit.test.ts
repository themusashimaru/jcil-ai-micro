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
  type CalendlyActionCategory,
  type CalendlyAction,
  ALL_CALENDLY_ACTIONS,
  getCalendlyFeaturedActionNames,
  getCalendlyActionsByPriority,
  getCalendlyActionNamesByPriority,
  getCalendlyActionsByCategory,
  getCalendlyActionPriority,
  isKnownCalendlyAction,
  isDestructiveCalendlyAction,
  sortByCalendlyPriority,
  getCalendlyActionStats,
  getCalendlySystemPrompt,
  getCalendlyCapabilitySummary,
  logCalendlyToolkitStats,
} from './calendly-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('CalendlyToolkit type exports', () => {
  it('should export CalendlyActionCategory type', () => {
    const cat: CalendlyActionCategory = 'events';
    expect(['events', 'event_types', 'invitees', 'users', 'scheduling']).toContain(cat);
  });

  it('should export CalendlyAction interface', () => {
    const action: CalendlyAction = {
      name: 'CALENDLY_LIST_EVENTS',
      label: 'Test',
      category: 'events',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_CALENDLY_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_CALENDLY_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_CALENDLY_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_CALENDLY_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: CalendlyActionCategory[] = [
      'events',
      'event_types',
      'invitees',
      'users',
      'scheduling',
    ];
    for (const action of ALL_CALENDLY_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_CALENDLY_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with CALENDLY_', () => {
    for (const action of ALL_CALENDLY_ACTIONS) {
      expect(action.name).toMatch(/^CALENDLY_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_CALENDLY_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Calendly query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getCalendlyFeaturedActionNames();
    expect(names.length).toBe(ALL_CALENDLY_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getCalendlyActionsByPriority(1);
    const p2 = getCalendlyActionsByPriority(2);
    const p3 = getCalendlyActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: CalendlyAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getCalendlyActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: CalendlyActionCategory = 'events';
    const actions = getCalendlyActionsByCategory(category);
    expect(actions.every((a: CalendlyAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getCalendlyActionPriority('CALENDLY_LIST_EVENTS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getCalendlyActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getCalendlyActionPriority('composio_CALENDLY_LIST_EVENTS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownCalendlyAction('CALENDLY_LIST_EVENTS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownCalendlyAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownCalendlyAction('composio_CALENDLY_LIST_EVENTS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveCalendlyAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveCalendlyAction('CALENDLY_CANCEL_EVENT')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'CALENDLY_LIST_EVENTS' }];
    const sorted = sortByCalendlyPriority(tools);
    expect(sorted[0].name).toBe('CALENDLY_LIST_EVENTS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Calendly stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getCalendlyActionStats();
    expect(stats.total).toBe(ALL_CALENDLY_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getCalendlySystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getCalendlyCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Calendly');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logCalendlyToolkitStats()).not.toThrow();
  });
});
