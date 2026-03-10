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
  type VercelActionCategory,
  type VercelAction,
  ALL_VERCEL_ACTIONS,
  getVercelFeaturedActionNames,
  getVercelActionsByPriority,
  getVercelActionNamesByPriority,
  getVercelActionsByCategory,
  getVercelActionPriority,
  isKnownVercelAction,
  isDestructiveVercelAction,
  sortByVercelPriority,
  getVercelActionStats,
  getVercelSystemPrompt,
  getVercelCapabilitySummary,
  logVercelToolkitStats,
} from './vercel-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('VercelToolkit type exports', () => {
  it('should export VercelActionCategory type', () => {
    const cat: VercelActionCategory = 'projects';
    expect([
      'projects',
      'deployments',
      'domains',
      'env',
      'teams',
      'security',
      'edge',
      'dns',
    ]).toContain(cat);
  });

  it('should export VercelAction interface', () => {
    const action: VercelAction = {
      name: 'VERCEL_LIST_DEPLOYMENTS',
      label: 'Test',
      category: 'projects',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_VERCEL_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_VERCEL_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_VERCEL_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_VERCEL_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: VercelActionCategory[] = [
      'projects',
      'deployments',
      'domains',
      'env',
      'teams',
      'security',
      'edge',
      'dns',
    ];
    for (const action of ALL_VERCEL_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_VERCEL_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with VERCEL_', () => {
    for (const action of ALL_VERCEL_ACTIONS) {
      expect(action.name).toMatch(/^VERCEL_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_VERCEL_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Vercel query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getVercelFeaturedActionNames();
    expect(names.length).toBe(ALL_VERCEL_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getVercelActionsByPriority(1);
    const p2 = getVercelActionsByPriority(2);
    const p3 = getVercelActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: VercelAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getVercelActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: VercelActionCategory = 'projects';
    const actions = getVercelActionsByCategory(category);
    expect(actions.every((a: VercelAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getVercelActionPriority('VERCEL_LIST_DEPLOYMENTS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getVercelActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getVercelActionPriority('composio_VERCEL_LIST_DEPLOYMENTS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownVercelAction('VERCEL_LIST_DEPLOYMENTS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownVercelAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownVercelAction('composio_VERCEL_LIST_DEPLOYMENTS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveVercelAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveVercelAction('VERCEL_DELETE_DEPLOYMENT')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'VERCEL_LIST_DEPLOYMENTS' }];
    const sorted = sortByVercelPriority(tools);
    expect(sorted[0].name).toBe('VERCEL_LIST_DEPLOYMENTS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Vercel stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getVercelActionStats();
    expect(stats.total).toBe(ALL_VERCEL_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getVercelSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getVercelCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Vercel');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logVercelToolkitStats()).not.toThrow();
  });
});
