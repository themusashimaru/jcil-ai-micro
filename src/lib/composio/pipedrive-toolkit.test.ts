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
  type PipedriveActionCategory,
  type PipedriveAction,
  ALL_PIPEDRIVE_ACTIONS,
  getPipedriveFeaturedActionNames,
  getPipedriveActionsByPriority,
  getPipedriveActionNamesByPriority,
  getPipedriveActionsByCategory,
  getPipedriveActionPriority,
  isKnownPipedriveAction,
  isDestructivePipedriveAction,
  sortByPipedrivePriority,
  getPipedriveActionStats,
  getPipedriveSystemPrompt,
  getPipedriveCapabilitySummary,
  logPipedriveToolkitStats,
} from './pipedrive-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('PipedriveToolkit type exports', () => {
  it('should export PipedriveActionCategory type', () => {
    const cat: PipedriveActionCategory = 'deals';
    expect(['deals', 'contacts', 'organizations', 'activities', 'pipelines', 'notes']).toContain(
      cat
    );
  });

  it('should export PipedriveAction interface', () => {
    const action: PipedriveAction = {
      name: 'PIPEDRIVE_CREATE_DEAL',
      label: 'Test',
      category: 'deals',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_PIPEDRIVE_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_PIPEDRIVE_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_PIPEDRIVE_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_PIPEDRIVE_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: PipedriveActionCategory[] = [
      'deals',
      'contacts',
      'organizations',
      'activities',
      'pipelines',
      'notes',
    ];
    for (const action of ALL_PIPEDRIVE_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_PIPEDRIVE_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with PIPEDRIVE_', () => {
    for (const action of ALL_PIPEDRIVE_ACTIONS) {
      expect(action.name).toMatch(/^PIPEDRIVE_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_PIPEDRIVE_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Pipedrive query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getPipedriveFeaturedActionNames();
    expect(names.length).toBe(ALL_PIPEDRIVE_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getPipedriveActionsByPriority(1);
    const p2 = getPipedriveActionsByPriority(2);
    const p3 = getPipedriveActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: PipedriveAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getPipedriveActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: PipedriveActionCategory = 'deals';
    const actions = getPipedriveActionsByCategory(category);
    expect(actions.every((a: PipedriveAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getPipedriveActionPriority('PIPEDRIVE_CREATE_DEAL');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getPipedriveActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getPipedriveActionPriority('composio_PIPEDRIVE_CREATE_DEAL');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownPipedriveAction('PIPEDRIVE_CREATE_DEAL')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownPipedriveAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownPipedriveAction('composio_PIPEDRIVE_CREATE_DEAL')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructivePipedriveAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructivePipedriveAction('PIPEDRIVE_DELETE_DEAL')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'PIPEDRIVE_CREATE_DEAL' }];
    const sorted = sortByPipedrivePriority(tools);
    expect(sorted[0].name).toBe('PIPEDRIVE_CREATE_DEAL');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Pipedrive stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getPipedriveActionStats();
    expect(stats.total).toBe(ALL_PIPEDRIVE_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getPipedriveSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getPipedriveCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Pipedrive');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logPipedriveToolkitStats()).not.toThrow();
  });
});
