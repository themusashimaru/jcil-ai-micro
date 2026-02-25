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
  type GoogleSlidesActionCategory,
  type GoogleSlidesAction,
  ALL_GOOGLE_SLIDES_ACTIONS,
  getGoogleSlidesFeaturedActionNames,
  getGoogleSlidesActionsByPriority,
  getGoogleSlidesActionNamesByPriority,
  getGoogleSlidesActionsByCategory,
  getGoogleSlidesActionPriority,
  isKnownGoogleSlidesAction,
  isDestructiveGoogleSlidesAction,
  sortByGoogleSlidesPriority,
  getGoogleSlidesActionStats,
  getGoogleSlidesSystemPrompt,
  getGoogleSlidesCapabilitySummary,
  logGoogleSlidesToolkitStats,
} from './googleslides-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GoogleSlidesToolkit type exports', () => {
  it('should export GoogleSlidesActionCategory type', () => {
    const cat: GoogleSlidesActionCategory = 'presentations';
    expect(['presentations', 'slides', 'elements', 'formatting', 'collaboration']).toContain(cat);
  });

  it('should export GoogleSlidesAction interface', () => {
    const action: GoogleSlidesAction = {
      name: 'GOOGLESLIDES_CREATE_PRESENTATION',
      label: 'Test',
      category: 'presentations',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_GOOGLE_SLIDES_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GOOGLE_SLIDES_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GOOGLE_SLIDES_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GOOGLE_SLIDES_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GoogleSlidesActionCategory[] = [
      'presentations',
      'slides',
      'elements',
      'formatting',
      'collaboration',
    ];
    for (const action of ALL_GOOGLE_SLIDES_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GOOGLE_SLIDES_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GOOGLESLIDES_', () => {
    for (const action of ALL_GOOGLE_SLIDES_ACTIONS) {
      expect(action.name).toMatch(/^GOOGLESLIDES_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GOOGLE_SLIDES_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('GoogleSlides query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGoogleSlidesFeaturedActionNames();
    expect(names.length).toBe(ALL_GOOGLE_SLIDES_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGoogleSlidesActionsByPriority(1);
    const p2 = getGoogleSlidesActionsByPriority(2);
    const p3 = getGoogleSlidesActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GoogleSlidesAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGoogleSlidesActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GoogleSlidesActionCategory = 'presentations';
    const actions = getGoogleSlidesActionsByCategory(category);
    expect(actions.every((a: GoogleSlidesAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGoogleSlidesActionPriority('GOOGLESLIDES_CREATE_PRESENTATION');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGoogleSlidesActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGoogleSlidesActionPriority('composio_GOOGLESLIDES_CREATE_PRESENTATION');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGoogleSlidesAction('GOOGLESLIDES_CREATE_PRESENTATION')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGoogleSlidesAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownGoogleSlidesAction('composio_GOOGLESLIDES_CREATE_PRESENTATION')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGoogleSlidesAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveGoogleSlidesAction('GOOGLESLIDES_DELETE_SLIDE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GOOGLESLIDES_CREATE_PRESENTATION' }];
    const sorted = sortByGoogleSlidesPriority(tools);
    expect(sorted[0].name).toBe('GOOGLESLIDES_CREATE_PRESENTATION');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('GoogleSlides stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGoogleSlidesActionStats();
    expect(stats.total).toBe(ALL_GOOGLE_SLIDES_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGoogleSlidesSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGoogleSlidesCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Google');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGoogleSlidesToolkitStats()).not.toThrow();
  });
});
