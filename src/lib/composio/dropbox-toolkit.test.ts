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
  type DropboxActionCategory,
  type DropboxAction,
  ALL_DROPBOX_ACTIONS,
  getDropboxFeaturedActionNames,
  getDropboxActionsByPriority,
  getDropboxActionNamesByPriority,
  getDropboxActionsByCategory,
  getDropboxActionPriority,
  isKnownDropboxAction,
  isDestructiveDropboxAction,
  sortByDropboxPriority,
  getDropboxActionStats,
  getDropboxSystemPrompt,
  getDropboxCapabilitySummary,
  logDropboxToolkitStats,
} from './dropbox-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('DropboxToolkit type exports', () => {
  it('should export DropboxActionCategory type', () => {
    const cat: DropboxActionCategory = 'files';
    expect(['files', 'folders', 'sharing', 'account']).toContain(cat);
  });

  it('should export DropboxAction interface', () => {
    const action: DropboxAction = {
      name: 'DROPBOX_LIST_FILES',
      label: 'Test',
      category: 'files',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_DROPBOX_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_DROPBOX_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_DROPBOX_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_DROPBOX_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: DropboxActionCategory[] = ['files', 'folders', 'sharing', 'account'];
    for (const action of ALL_DROPBOX_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_DROPBOX_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with DROPBOX_', () => {
    for (const action of ALL_DROPBOX_ACTIONS) {
      expect(action.name).toMatch(/^DROPBOX_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_DROPBOX_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Dropbox query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getDropboxFeaturedActionNames();
    expect(names.length).toBe(ALL_DROPBOX_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getDropboxActionsByPriority(1);
    const p2 = getDropboxActionsByPriority(2);
    const p3 = getDropboxActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: DropboxAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getDropboxActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: DropboxActionCategory = 'files';
    const actions = getDropboxActionsByCategory(category);
    expect(actions.every((a: DropboxAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getDropboxActionPriority('DROPBOX_LIST_FILES');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getDropboxActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getDropboxActionPriority('composio_DROPBOX_LIST_FILES');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownDropboxAction('DROPBOX_LIST_FILES')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownDropboxAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownDropboxAction('composio_DROPBOX_LIST_FILES')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveDropboxAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveDropboxAction('DROPBOX_DELETE_FILE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'DROPBOX_LIST_FILES' }];
    const sorted = sortByDropboxPriority(tools);
    expect(sorted[0].name).toBe('DROPBOX_LIST_FILES');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Dropbox stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getDropboxActionStats();
    expect(stats.total).toBe(ALL_DROPBOX_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getDropboxSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getDropboxCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Dropbox');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logDropboxToolkitStats()).not.toThrow();
  });
});
