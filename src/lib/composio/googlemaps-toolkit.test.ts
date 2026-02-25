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
  type GoogleMapsActionCategory,
  type GoogleMapsAction,
  ALL_GOOGLE_MAPS_ACTIONS,
  getGoogleMapsFeaturedActionNames,
  getGoogleMapsActionsByPriority,
  getGoogleMapsActionNamesByPriority,
  getGoogleMapsActionsByCategory,
  getGoogleMapsActionPriority,
  isKnownGoogleMapsAction,
  isDestructiveGoogleMapsAction,
  sortByGoogleMapsPriority,
  getGoogleMapsActionStats,
  getGoogleMapsSystemPrompt,
  getGoogleMapsCapabilitySummary,
  logGoogleMapsToolkitStats,
} from './googlemaps-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GoogleMapsToolkit type exports', () => {
  it('should export GoogleMapsActionCategory type', () => {
    const cat: GoogleMapsActionCategory = 'places';
    expect(['places', 'directions', 'geocoding', 'distance']).toContain(cat);
  });

  it('should export GoogleMapsAction interface', () => {
    const action: GoogleMapsAction = {
      name: 'GOOGLEMAPS_SEARCH_PLACES',
      label: 'Test',
      category: 'places',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_GOOGLE_MAPS_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GOOGLE_MAPS_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GOOGLE_MAPS_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GOOGLE_MAPS_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GoogleMapsActionCategory[] = [
      'places',
      'directions',
      'geocoding',
      'distance',
    ];
    for (const action of ALL_GOOGLE_MAPS_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GOOGLE_MAPS_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GOOGLEMAPS_', () => {
    for (const action of ALL_GOOGLE_MAPS_ACTIONS) {
      expect(action.name).toMatch(/^GOOGLEMAPS_/);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('GoogleMaps query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGoogleMapsFeaturedActionNames();
    expect(names.length).toBe(ALL_GOOGLE_MAPS_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGoogleMapsActionsByPriority(1);
    const p2 = getGoogleMapsActionsByPriority(2);
    const p3 = getGoogleMapsActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GoogleMapsAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGoogleMapsActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GoogleMapsActionCategory = 'places';
    const actions = getGoogleMapsActionsByCategory(category);
    expect(actions.every((a: GoogleMapsAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGoogleMapsActionPriority('GOOGLEMAPS_SEARCH_PLACES');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGoogleMapsActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGoogleMapsActionPriority('composio_GOOGLEMAPS_SEARCH_PLACES');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGoogleMapsAction('GOOGLEMAPS_SEARCH_PLACES')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGoogleMapsAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownGoogleMapsAction('composio_GOOGLEMAPS_SEARCH_PLACES')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGoogleMapsAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GOOGLEMAPS_SEARCH_PLACES' }];
    const sorted = sortByGoogleMapsPriority(tools);
    expect(sorted[0].name).toBe('GOOGLEMAPS_SEARCH_PLACES');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('GoogleMaps stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGoogleMapsActionStats();
    expect(stats.total).toBe(ALL_GOOGLE_MAPS_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGoogleMapsSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGoogleMapsCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Google');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGoogleMapsToolkitStats()).not.toThrow();
  });
});
