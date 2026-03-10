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
  type GoogleMeetActionCategory,
  type GoogleMeetAction,
  ALL_GOOGLE_MEET_ACTIONS,
  getGoogleMeetFeaturedActionNames,
  getGoogleMeetActionsByPriority,
  getGoogleMeetActionNamesByPriority,
  getGoogleMeetActionsByCategory,
  getGoogleMeetActionPriority,
  isKnownGoogleMeetAction,
  isDestructiveGoogleMeetAction,
  sortByGoogleMeetPriority,
  getGoogleMeetActionStats,
  getGoogleMeetSystemPrompt,
  getGoogleMeetCapabilitySummary,
  logGoogleMeetToolkitStats,
} from './googlemeet-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GoogleMeetToolkit type exports', () => {
  it('should export GoogleMeetActionCategory type', () => {
    const cat: GoogleMeetActionCategory = 'meetings';
    expect(['meetings', 'participants', 'recordings', 'spaces']).toContain(cat);
  });

  it('should export GoogleMeetAction interface', () => {
    const action: GoogleMeetAction = {
      name: 'GOOGLEMEET_CREATE_MEETING',
      label: 'Test',
      category: 'meetings',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_GOOGLE_MEET_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GOOGLE_MEET_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GOOGLE_MEET_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GOOGLE_MEET_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GoogleMeetActionCategory[] = [
      'meetings',
      'participants',
      'recordings',
      'spaces',
    ];
    for (const action of ALL_GOOGLE_MEET_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GOOGLE_MEET_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GOOGLEMEET_', () => {
    for (const action of ALL_GOOGLE_MEET_ACTIONS) {
      expect(action.name).toMatch(/^GOOGLEMEET_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GOOGLE_MEET_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('GoogleMeet query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGoogleMeetFeaturedActionNames();
    expect(names.length).toBe(ALL_GOOGLE_MEET_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGoogleMeetActionsByPriority(1);
    const p2 = getGoogleMeetActionsByPriority(2);
    const p3 = getGoogleMeetActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GoogleMeetAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGoogleMeetActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GoogleMeetActionCategory = 'meetings';
    const actions = getGoogleMeetActionsByCategory(category);
    expect(actions.every((a: GoogleMeetAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGoogleMeetActionPriority('GOOGLEMEET_CREATE_MEETING');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGoogleMeetActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGoogleMeetActionPriority('composio_GOOGLEMEET_CREATE_MEETING');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGoogleMeetAction('GOOGLEMEET_CREATE_MEETING')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGoogleMeetAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownGoogleMeetAction('composio_GOOGLEMEET_CREATE_MEETING')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGoogleMeetAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveGoogleMeetAction('GOOGLEMEET_END_SPACE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GOOGLEMEET_CREATE_MEETING' }];
    const sorted = sortByGoogleMeetPriority(tools);
    expect(sorted[0].name).toBe('GOOGLEMEET_CREATE_MEETING');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('GoogleMeet stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGoogleMeetActionStats();
    expect(stats.total).toBe(ALL_GOOGLE_MEET_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGoogleMeetSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGoogleMeetCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Google');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGoogleMeetToolkitStats()).not.toThrow();
  });
});
