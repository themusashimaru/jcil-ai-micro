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
  type SupabaseActionCategory,
  type SupabaseAction,
  ALL_SUPABASE_ACTIONS,
  getSupabaseFeaturedActionNames,
  getSupabaseActionsByPriority,
  getSupabaseActionNamesByPriority,
  getSupabaseActionsByCategory,
  getSupabaseActionPriority,
  isKnownSupabaseAction,
  isDestructiveSupabaseAction,
  sortBySupabasePriority,
  getSupabaseActionStats,
  getSupabaseSystemPrompt,
  getSupabaseCapabilitySummary,
  logSupabaseToolkitStats,
} from './supabase-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('SupabaseToolkit type exports', () => {
  it('should export SupabaseActionCategory type', () => {
    const cat: SupabaseActionCategory = 'database';
    expect(['database', 'auth', 'storage', 'functions', 'projects', 'realtime']).toContain(cat);
  });

  it('should export SupabaseAction interface', () => {
    const action: SupabaseAction = {
      name: 'SUPABASE_LIST_PROJECTS',
      label: 'Test',
      category: 'database',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_SUPABASE_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_SUPABASE_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_SUPABASE_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_SUPABASE_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: SupabaseActionCategory[] = [
      'database',
      'auth',
      'storage',
      'functions',
      'projects',
      'realtime',
    ];
    for (const action of ALL_SUPABASE_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_SUPABASE_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with SUPABASE_', () => {
    for (const action of ALL_SUPABASE_ACTIONS) {
      expect(action.name).toMatch(/^SUPABASE_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_SUPABASE_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Supabase query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getSupabaseFeaturedActionNames();
    expect(names.length).toBe(ALL_SUPABASE_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getSupabaseActionsByPriority(1);
    const p2 = getSupabaseActionsByPriority(2);
    const p3 = getSupabaseActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: SupabaseAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getSupabaseActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: SupabaseActionCategory = 'database';
    const actions = getSupabaseActionsByCategory(category);
    expect(actions.every((a: SupabaseAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getSupabaseActionPriority('SUPABASE_LIST_PROJECTS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getSupabaseActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getSupabaseActionPriority('composio_SUPABASE_LIST_PROJECTS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownSupabaseAction('SUPABASE_LIST_PROJECTS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownSupabaseAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownSupabaseAction('composio_SUPABASE_LIST_PROJECTS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveSupabaseAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveSupabaseAction('SUPABASE_DELETE_ROW')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'SUPABASE_LIST_PROJECTS' }];
    const sorted = sortBySupabasePriority(tools);
    expect(sorted[0].name).toBe('SUPABASE_LIST_PROJECTS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Supabase stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getSupabaseActionStats();
    expect(stats.total).toBe(ALL_SUPABASE_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getSupabaseSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getSupabaseCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Supabase');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logSupabaseToolkitStats()).not.toThrow();
  });
});
