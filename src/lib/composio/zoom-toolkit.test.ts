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
  type ZoomActionCategory,
  type ZoomAction,
  ALL_ZOOM_ACTIONS,
  getZoomFeaturedActionNames,
  getZoomActionsByPriority,
  getZoomActionNamesByPriority,
  getZoomActionsByCategory,
  getZoomActionPriority,
  isKnownZoomAction,
  isDestructiveZoomAction,
  sortByZoomPriority,
  getZoomActionStats,
  getZoomSystemPrompt,
  getZoomCapabilitySummary,
  logZoomToolkitStats,
} from './zoom-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('ZoomToolkit type exports', () => {
  it('should export ZoomActionCategory type', () => {
    const cat: ZoomActionCategory = 'meetings';
    expect(['meetings', 'users', 'recordings', 'webinars']).toContain(cat);
  });

  it('should export ZoomAction interface', () => {
    const action: ZoomAction = {
      name: 'ZOOM_CREATE_MEETING',
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

describe('ALL_ZOOM_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_ZOOM_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_ZOOM_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_ZOOM_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: ZoomActionCategory[] = ['meetings', 'users', 'recordings', 'webinars'];
    for (const action of ALL_ZOOM_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_ZOOM_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with ZOOM_', () => {
    for (const action of ALL_ZOOM_ACTIONS) {
      expect(action.name).toMatch(/^ZOOM_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_ZOOM_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Zoom query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getZoomFeaturedActionNames();
    expect(names.length).toBe(ALL_ZOOM_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getZoomActionsByPriority(1);
    const p2 = getZoomActionsByPriority(2);
    const p3 = getZoomActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: ZoomAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getZoomActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: ZoomActionCategory = 'meetings';
    const actions = getZoomActionsByCategory(category);
    expect(actions.every((a: ZoomAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getZoomActionPriority('ZOOM_CREATE_MEETING');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getZoomActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getZoomActionPriority('composio_ZOOM_CREATE_MEETING');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownZoomAction('ZOOM_CREATE_MEETING')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownZoomAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownZoomAction('composio_ZOOM_CREATE_MEETING')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveZoomAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveZoomAction('ZOOM_DELETE_MEETING')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'ZOOM_CREATE_MEETING' }];
    const sorted = sortByZoomPriority(tools);
    expect(sorted[0].name).toBe('ZOOM_CREATE_MEETING');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Zoom stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getZoomActionStats();
    expect(stats.total).toBe(ALL_ZOOM_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getZoomSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getZoomCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Zoom');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logZoomToolkitStats()).not.toThrow();
  });
});
