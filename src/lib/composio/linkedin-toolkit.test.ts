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
  type LinkedInActionCategory,
  type LinkedInAction,
  ALL_LINKEDIN_ACTIONS,
  getLinkedInFeaturedActionNames,
  getLinkedInActionsByPriority,
  getLinkedInActionNamesByPriority,
  getLinkedInActionsByCategory,
  getLinkedInActionPriority,
  isKnownLinkedInAction,
  isDestructiveLinkedInAction,
  sortByLinkedInPriority,
  getLinkedInActionStats,
  getLinkedInSystemPrompt,
  getLinkedInCapabilitySummary,
  logLinkedInToolkitStats,
} from './linkedin-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('LinkedInToolkit type exports', () => {
  it('should export LinkedInActionCategory type', () => {
    const cat: LinkedInActionCategory = 'posts';
    expect(['posts', 'profile', 'media']).toContain(cat);
  });

  it('should export LinkedInAction interface', () => {
    const action: LinkedInAction = {
      name: 'LINKEDIN_CREATE_LINKED_IN_POST',
      label: 'Test',
      category: 'posts',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_LINKEDIN_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_LINKEDIN_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_LINKEDIN_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_LINKEDIN_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: LinkedInActionCategory[] = ['posts', 'profile', 'media'];
    for (const action of ALL_LINKEDIN_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_LINKEDIN_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with LINKEDIN_', () => {
    for (const action of ALL_LINKEDIN_ACTIONS) {
      expect(action.name).toMatch(/^LINKEDIN_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_LINKEDIN_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('LinkedIn query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getLinkedInFeaturedActionNames();
    expect(names.length).toBe(ALL_LINKEDIN_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getLinkedInActionsByPriority(1);
    const p2 = getLinkedInActionsByPriority(2);
    const p3 = getLinkedInActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: LinkedInAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getLinkedInActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: LinkedInActionCategory = 'posts';
    const actions = getLinkedInActionsByCategory(category);
    expect(actions.every((a: LinkedInAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getLinkedInActionPriority('LINKEDIN_CREATE_LINKED_IN_POST');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getLinkedInActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getLinkedInActionPriority('composio_LINKEDIN_CREATE_LINKED_IN_POST');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownLinkedInAction('LINKEDIN_CREATE_LINKED_IN_POST')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownLinkedInAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownLinkedInAction('composio_LINKEDIN_CREATE_LINKED_IN_POST')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveLinkedInAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveLinkedInAction('LINKEDIN_DELETE_LINKED_IN_POST')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'LINKEDIN_CREATE_LINKED_IN_POST' }];
    const sorted = sortByLinkedInPriority(tools);
    expect(sorted[0].name).toBe('LINKEDIN_CREATE_LINKED_IN_POST');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('LinkedIn stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getLinkedInActionStats();
    expect(stats.total).toBe(ALL_LINKEDIN_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getLinkedInSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getLinkedInCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Linked');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logLinkedInToolkitStats()).not.toThrow();
  });
});
