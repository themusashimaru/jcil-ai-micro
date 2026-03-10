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
  type GoogleCalendarActionCategory,
  type GoogleCalendarAction,
  ALL_GOOGLE_CALENDAR_ACTIONS,
  getGoogleCalendarFeaturedActionNames,
  getGoogleCalendarActionsByPriority,
  getGoogleCalendarActionNamesByPriority,
  getGoogleCalendarActionsByCategory,
  getGoogleCalendarActionPriority,
  isKnownGoogleCalendarAction,
  isDestructiveGoogleCalendarAction,
  sortByGoogleCalendarPriority,
  getGoogleCalendarActionStats,
  getGoogleCalendarSystemPrompt,
  getGoogleCalendarCapabilitySummary,
  logGoogleCalendarToolkitStats,
} from './googlecalendar-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GoogleCalendarToolkit type exports', () => {
  it('should export GoogleCalendarActionCategory type', () => {
    const cat: GoogleCalendarActionCategory = 'events';
    expect(['events', 'calendars', 'attendees', 'reminders', 'settings']).toContain(cat);
  });

  it('should export GoogleCalendarAction interface', () => {
    const action: GoogleCalendarAction = {
      name: 'GOOGLECALENDAR_CREATE_EVENT',
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

describe('ALL_GOOGLE_CALENDAR_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GOOGLE_CALENDAR_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GOOGLE_CALENDAR_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GOOGLE_CALENDAR_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GoogleCalendarActionCategory[] = [
      'events',
      'calendars',
      'attendees',
      'reminders',
      'settings',
    ];
    for (const action of ALL_GOOGLE_CALENDAR_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GOOGLE_CALENDAR_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GOOGLECALENDAR_', () => {
    for (const action of ALL_GOOGLE_CALENDAR_ACTIONS) {
      expect(action.name).toMatch(/^GOOGLECALENDAR_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GOOGLE_CALENDAR_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('GoogleCalendar query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGoogleCalendarFeaturedActionNames();
    expect(names.length).toBe(ALL_GOOGLE_CALENDAR_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGoogleCalendarActionsByPriority(1);
    const p2 = getGoogleCalendarActionsByPriority(2);
    const p3 = getGoogleCalendarActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GoogleCalendarAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGoogleCalendarActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GoogleCalendarActionCategory = 'events';
    const actions = getGoogleCalendarActionsByCategory(category);
    expect(actions.every((a: GoogleCalendarAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGoogleCalendarActionPriority('GOOGLECALENDAR_CREATE_EVENT');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGoogleCalendarActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGoogleCalendarActionPriority('composio_GOOGLECALENDAR_CREATE_EVENT');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGoogleCalendarAction('GOOGLECALENDAR_CREATE_EVENT')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGoogleCalendarAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownGoogleCalendarAction('composio_GOOGLECALENDAR_CREATE_EVENT')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGoogleCalendarAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveGoogleCalendarAction('GOOGLECALENDAR_DELETE_EVENT')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GOOGLECALENDAR_CREATE_EVENT' }];
    const sorted = sortByGoogleCalendarPriority(tools);
    expect(sorted[0].name).toBe('GOOGLECALENDAR_CREATE_EVENT');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('GoogleCalendar stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGoogleCalendarActionStats();
    expect(stats.total).toBe(ALL_GOOGLE_CALENDAR_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGoogleCalendarSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGoogleCalendarCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Google');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGoogleCalendarToolkitStats()).not.toThrow();
  });
});
