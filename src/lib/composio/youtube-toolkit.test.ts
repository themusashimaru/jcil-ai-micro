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
  type YouTubeActionCategory,
  type YouTubeAction,
  ALL_YOUTUBE_ACTIONS,
  getYouTubeFeaturedActionNames,
  getYouTubeActionsByPriority,
  getYouTubeActionNamesByPriority,
  getYouTubeActionsByCategory,
  getYouTubeActionPriority,
  isKnownYouTubeAction,
  isDestructiveYouTubeAction,
  sortByYouTubePriority,
  getYouTubeActionStats,
  getYouTubeSystemPrompt,
  getYouTubeCapabilitySummary,
  logYouTubeToolkitStats,
} from './youtube-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('YouTubeToolkit type exports', () => {
  it('should export YouTubeActionCategory type', () => {
    const cat: YouTubeActionCategory = 'search';
    expect(['search', 'videos', 'channels', 'playlists', 'engagement']).toContain(cat);
  });

  it('should export YouTubeAction interface', () => {
    const action: YouTubeAction = {
      name: 'YOUTUBE_SEARCH_YOU_TUBE',
      label: 'Test',
      category: 'search',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_YOUTUBE_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_YOUTUBE_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_YOUTUBE_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_YOUTUBE_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: YouTubeActionCategory[] = [
      'search',
      'videos',
      'channels',
      'playlists',
      'engagement',
    ];
    for (const action of ALL_YOUTUBE_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_YOUTUBE_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with YOUTUBE_', () => {
    for (const action of ALL_YOUTUBE_ACTIONS) {
      expect(action.name).toMatch(/^YOUTUBE_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_YOUTUBE_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('YouTube query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getYouTubeFeaturedActionNames();
    expect(names.length).toBe(ALL_YOUTUBE_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getYouTubeActionsByPriority(1);
    const p2 = getYouTubeActionsByPriority(2);
    const p3 = getYouTubeActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: YouTubeAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getYouTubeActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: YouTubeActionCategory = 'search';
    const actions = getYouTubeActionsByCategory(category);
    expect(actions.every((a: YouTubeAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getYouTubeActionPriority('YOUTUBE_SEARCH_YOU_TUBE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getYouTubeActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getYouTubeActionPriority('composio_YOUTUBE_SEARCH_YOU_TUBE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownYouTubeAction('YOUTUBE_SEARCH_YOU_TUBE')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownYouTubeAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownYouTubeAction('composio_YOUTUBE_SEARCH_YOU_TUBE')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveYouTubeAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveYouTubeAction('YOUTUBE_DELETE_VIDEO')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'YOUTUBE_SEARCH_YOU_TUBE' }];
    const sorted = sortByYouTubePriority(tools);
    expect(sorted[0].name).toBe('YOUTUBE_SEARCH_YOU_TUBE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('YouTube stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getYouTubeActionStats();
    expect(stats.total).toBe(ALL_YOUTUBE_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getYouTubeSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getYouTubeCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('You');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logYouTubeToolkitStats()).not.toThrow();
  });
});
