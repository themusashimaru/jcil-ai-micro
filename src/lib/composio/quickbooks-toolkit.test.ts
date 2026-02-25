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
  type QuickBooksActionCategory,
  type QuickBooksAction,
  ALL_QUICKBOOKS_ACTIONS,
  getQuickBooksFeaturedActionNames,
  getQuickBooksActionsByPriority,
  getQuickBooksActionNamesByPriority,
  getQuickBooksActionsByCategory,
  getQuickBooksActionPriority,
  isKnownQuickBooksAction,
  isDestructiveQuickBooksAction,
  sortByQuickBooksPriority,
  getQuickBooksActionStats,
  getQuickBooksSystemPrompt,
  getQuickBooksCapabilitySummary,
  logQuickBooksToolkitStats,
} from './quickbooks-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('QuickBooksToolkit type exports', () => {
  it('should export QuickBooksActionCategory type', () => {
    const cat: QuickBooksActionCategory = 'invoices';
    expect(['invoices', 'customers', 'payments', 'items', 'accounts', 'reports']).toContain(cat);
  });

  it('should export QuickBooksAction interface', () => {
    const action: QuickBooksAction = {
      name: 'QUICKBOOKS_CREATE_INVOICE',
      label: 'Test',
      category: 'invoices',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_QUICKBOOKS_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_QUICKBOOKS_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_QUICKBOOKS_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_QUICKBOOKS_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: QuickBooksActionCategory[] = [
      'invoices',
      'customers',
      'payments',
      'items',
      'accounts',
      'reports',
    ];
    for (const action of ALL_QUICKBOOKS_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_QUICKBOOKS_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with QUICKBOOKS_', () => {
    for (const action of ALL_QUICKBOOKS_ACTIONS) {
      expect(action.name).toMatch(/^QUICKBOOKS_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_QUICKBOOKS_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('QuickBooks query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getQuickBooksFeaturedActionNames();
    expect(names.length).toBe(ALL_QUICKBOOKS_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getQuickBooksActionsByPriority(1);
    const p2 = getQuickBooksActionsByPriority(2);
    const p3 = getQuickBooksActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: QuickBooksAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getQuickBooksActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: QuickBooksActionCategory = 'invoices';
    const actions = getQuickBooksActionsByCategory(category);
    expect(actions.every((a: QuickBooksAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getQuickBooksActionPriority('QUICKBOOKS_CREATE_INVOICE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getQuickBooksActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getQuickBooksActionPriority('composio_QUICKBOOKS_CREATE_INVOICE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownQuickBooksAction('QUICKBOOKS_CREATE_INVOICE')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownQuickBooksAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownQuickBooksAction('composio_QUICKBOOKS_CREATE_INVOICE')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveQuickBooksAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveQuickBooksAction('QUICKBOOKS_VOID_INVOICE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'QUICKBOOKS_CREATE_INVOICE' }];
    const sorted = sortByQuickBooksPriority(tools);
    expect(sorted[0].name).toBe('QUICKBOOKS_CREATE_INVOICE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('QuickBooks stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getQuickBooksActionStats();
    expect(stats.total).toBe(ALL_QUICKBOOKS_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getQuickBooksSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getQuickBooksCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Quick');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logQuickBooksToolkitStats()).not.toThrow();
  });
});
