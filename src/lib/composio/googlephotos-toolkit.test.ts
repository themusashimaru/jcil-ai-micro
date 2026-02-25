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
  type GooglePhotosActionCategory,
  type GooglePhotosAction,
  ALL_GOOGLE_PHOTOS_ACTIONS,
  getGooglePhotosFeaturedActionNames,
  getGooglePhotosActionsByPriority,
  getGooglePhotosActionNamesByPriority,
  getGooglePhotosActionsByCategory,
  getGooglePhotosActionPriority,
  isKnownGooglePhotosAction,
  isDestructiveGooglePhotosAction,
  sortByGooglePhotosPriority,
  getGooglePhotosActionStats,
  getGooglePhotosSystemPrompt,
  getGooglePhotosCapabilitySummary,
  logGooglePhotosToolkitStats,
} from './googlephotos-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GooglePhotosToolkit type exports', () => {
  it('should export GooglePhotosActionCategory type', () => {
    const cat: GooglePhotosActionCategory = 'media';
    expect(['media', 'albums', 'sharing']).toContain(cat);
  });

  it('should export GooglePhotosAction interface', () => {
    const action: GooglePhotosAction = {
      name: 'GOOGLEPHOTOS_LIST_MEDIA_ITEMS',
      label: 'Test',
      category: 'media',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_GOOGLE_PHOTOS_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GOOGLE_PHOTOS_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GOOGLE_PHOTOS_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GOOGLE_PHOTOS_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GooglePhotosActionCategory[] = ['media', 'albums', 'sharing'];
    for (const action of ALL_GOOGLE_PHOTOS_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GOOGLE_PHOTOS_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GOOGLEPHOTOS_', () => {
    for (const action of ALL_GOOGLE_PHOTOS_ACTIONS) {
      expect(action.name).toMatch(/^GOOGLEPHOTOS_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GOOGLE_PHOTOS_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('GooglePhotos query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGooglePhotosFeaturedActionNames();
    expect(names.length).toBe(ALL_GOOGLE_PHOTOS_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGooglePhotosActionsByPriority(1);
    const p2 = getGooglePhotosActionsByPriority(2);
    const p3 = getGooglePhotosActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GooglePhotosAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGooglePhotosActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GooglePhotosActionCategory = 'media';
    const actions = getGooglePhotosActionsByCategory(category);
    expect(actions.every((a: GooglePhotosAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGooglePhotosActionPriority('GOOGLEPHOTOS_LIST_MEDIA_ITEMS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGooglePhotosActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGooglePhotosActionPriority('composio_GOOGLEPHOTOS_LIST_MEDIA_ITEMS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGooglePhotosAction('GOOGLEPHOTOS_LIST_MEDIA_ITEMS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGooglePhotosAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownGooglePhotosAction('composio_GOOGLEPHOTOS_LIST_MEDIA_ITEMS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGooglePhotosAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveGooglePhotosAction('GOOGLEPHOTOS_REMOVE_MEDIA_FROM_ALBUM')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GOOGLEPHOTOS_LIST_MEDIA_ITEMS' }];
    const sorted = sortByGooglePhotosPriority(tools);
    expect(sorted[0].name).toBe('GOOGLEPHOTOS_LIST_MEDIA_ITEMS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('GooglePhotos stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGooglePhotosActionStats();
    expect(stats.total).toBe(ALL_GOOGLE_PHOTOS_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGooglePhotosSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGooglePhotosCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Google');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGooglePhotosToolkitStats()).not.toThrow();
  });
});
