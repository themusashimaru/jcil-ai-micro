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
  type StripeActionCategory,
  type StripeAction,
  ALL_STRIPE_ACTIONS,
  getStripeFeaturedActionNames,
  getStripeActionsByPriority,
  getStripeActionNamesByPriority,
  getStripeActionsByCategory,
  getStripeActionPriority,
  isKnownStripeAction,
  isDestructiveStripeAction,
  sortByStripePriority,
  getStripeActionStats,
  getStripeSystemPrompt,
  getStripeCapabilitySummary,
  logStripeToolkitStats,
} from './stripe-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('StripeToolkit type exports', () => {
  it('should export StripeActionCategory type', () => {
    const cat: StripeActionCategory = 'payments';
    expect([
      'payments',
      'customers',
      'subscriptions',
      'invoicing',
      'products',
      'terminal',
      'account',
    ]).toContain(cat);
  });

  it('should export StripeAction interface', () => {
    const action: StripeAction = {
      name: 'STRIPE_CREATE_CUSTOMER',
      label: 'Create Customer',
      category: 'customers',
      priority: 1,
      writeOperation: true,
    };
    expect(action.priority).toBe(1);
    expect(action.writeOperation).toBe(true);
  });

  it('should support optional destructive field', () => {
    const action: StripeAction = {
      name: 'STRIPE_DELETE_CUSTOMER',
      label: 'Delete Customer',
      category: 'customers',
      priority: 4,
      writeOperation: true,
      destructive: true,
    };
    expect(action.destructive).toBe(true);
  });
});

// ============================================================================
// ALL_STRIPE_ACTIONS REGISTRY
// ============================================================================

describe('ALL_STRIPE_ACTIONS', () => {
  it('should be a non-empty array', () => {
    expect(ALL_STRIPE_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have actions with valid priorities 1-4', () => {
    for (const action of ALL_STRIPE_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have actions with valid categories', () => {
    const validCategories = [
      'payments',
      'customers',
      'subscriptions',
      'invoicing',
      'products',
      'terminal',
      'account',
    ];
    for (const action of ALL_STRIPE_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have unique action names', () => {
    const names = ALL_STRIPE_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have essential (priority 1) actions', () => {
    const essential = ALL_STRIPE_ACTIONS.filter((a) => a.priority === 1);
    expect(essential.length).toBeGreaterThan(0);
  });

  it('should include customer creation', () => {
    const create = ALL_STRIPE_ACTIONS.find((a) => a.name === 'STRIPE_CREATE_CUSTOMER');
    expect(create).toBeDefined();
    expect(create?.priority).toBe(1);
    expect(create?.writeOperation).toBe(true);
  });

  it('should mark destructive actions', () => {
    const destructive = ALL_STRIPE_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const d of destructive) {
      expect(d.priority).toBe(4);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('getStripeFeaturedActionNames', () => {
  it('should return all action names', () => {
    const names = getStripeFeaturedActionNames();
    expect(names.length).toBe(ALL_STRIPE_ACTIONS.length);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should include STRIPE_CREATE_CUSTOMER', () => {
    expect(getStripeFeaturedActionNames()).toContain('STRIPE_CREATE_CUSTOMER');
  });
});

describe('getStripeActionsByPriority', () => {
  it('should return only actions at or below given priority', () => {
    const p2 = getStripeActionsByPriority(2);
    for (const a of p2) {
      expect(a.priority).toBeLessThanOrEqual(2);
    }
  });

  it('should return more actions at higher max priority', () => {
    const p1 = getStripeActionsByPriority(1);
    const p3 = getStripeActionsByPriority(3);
    expect(p3.length).toBeGreaterThanOrEqual(p1.length);
  });

  it('should default to maxPriority 3', () => {
    const defaultResult = getStripeActionsByPriority();
    const p3 = getStripeActionsByPriority(3);
    expect(defaultResult.length).toBe(p3.length);
  });
});

describe('getStripeActionNamesByPriority', () => {
  it('should return string array', () => {
    const names = getStripeActionNamesByPriority(2);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should match getStripeActionsByPriority length', () => {
    const actions = getStripeActionsByPriority(2);
    const names = getStripeActionNamesByPriority(2);
    expect(names.length).toBe(actions.length);
  });
});

describe('getStripeActionsByCategory', () => {
  it('should return payments category actions', () => {
    const payments = getStripeActionsByCategory('payments');
    expect(payments.length).toBeGreaterThan(0);
    for (const a of payments) {
      expect(a.category).toBe('payments');
    }
  });

  it('should return customers category actions', () => {
    const customers = getStripeActionsByCategory('customers');
    expect(customers.length).toBeGreaterThan(0);
    for (const a of customers) {
      expect(a.category).toBe('customers');
    }
  });

  it('should return subscriptions category actions', () => {
    const subs = getStripeActionsByCategory('subscriptions');
    expect(subs.length).toBeGreaterThan(0);
  });

  it('should return invoicing category actions', () => {
    const invoicing = getStripeActionsByCategory('invoicing');
    expect(invoicing.length).toBeGreaterThan(0);
  });
});

describe('getStripeActionPriority', () => {
  it('should return priority for known action', () => {
    expect(getStripeActionPriority('STRIPE_CREATE_CUSTOMER')).toBe(1);
  });

  it('should handle composio_ prefix', () => {
    expect(getStripeActionPriority('composio_STRIPE_CREATE_CUSTOMER')).toBe(1);
  });

  it('should return 99 for unknown action', () => {
    expect(getStripeActionPriority('UNKNOWN_ACTION')).toBe(99);
  });
});

describe('isKnownStripeAction', () => {
  it('should return true for known action', () => {
    expect(isKnownStripeAction('STRIPE_CREATE_CUSTOMER')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isKnownStripeAction('composio_STRIPE_CREATE_CUSTOMER')).toBe(true);
  });

  it('should return false for unknown action', () => {
    expect(isKnownStripeAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('isDestructiveStripeAction', () => {
  it('should return true for destructive actions', () => {
    expect(isDestructiveStripeAction('STRIPE_DELETE_CUSTOMER')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isDestructiveStripeAction('composio_STRIPE_DELETE_CUSTOMER')).toBe(true);
  });

  it('should return false for non-destructive action', () => {
    expect(isDestructiveStripeAction('STRIPE_CREATE_CUSTOMER')).toBe(false);
  });

  it('should return false for unknown action', () => {
    expect(isDestructiveStripeAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('sortByStripePriority', () => {
  it('should sort tools by priority ascending', () => {
    const tools = [
      { name: 'STRIPE_DELETE_CUSTOMER' }, // priority 4
      { name: 'STRIPE_CREATE_CUSTOMER' }, // priority 1
      { name: 'STRIPE_CREATE_COUPON' }, // priority 2
    ];
    const sorted = sortByStripePriority(tools);
    expect(sorted[0].name).toBe('STRIPE_CREATE_CUSTOMER');
    expect(sorted[2].name).toBe('STRIPE_DELETE_CUSTOMER');
  });

  it('should place unknown actions last', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'STRIPE_CREATE_CUSTOMER' }];
    const sorted = sortByStripePriority(tools);
    expect(sorted[0].name).toBe('STRIPE_CREATE_CUSTOMER');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });

  it('should not mutate original array', () => {
    const tools = [{ name: 'STRIPE_DELETE_CUSTOMER' }, { name: 'STRIPE_CREATE_CUSTOMER' }];
    const original = [...tools];
    sortByStripePriority(tools);
    expect(tools).toEqual(original);
  });
});

describe('getStripeActionStats', () => {
  it('should return total count', () => {
    const stats = getStripeActionStats();
    expect(stats.total).toBe(ALL_STRIPE_ACTIONS.length);
  });

  it('should have byPriority breakdown', () => {
    const stats = getStripeActionStats();
    expect(stats.byPriority[1]).toBeGreaterThan(0);
    expect(stats.byPriority[2]).toBeGreaterThan(0);
    expect(stats.byPriority[3]).toBeGreaterThan(0);
    expect(stats.byPriority[4]).toBeGreaterThan(0);
  });

  it('should have byCategory breakdown', () => {
    const stats = getStripeActionStats();
    expect(stats.byCategory['payments']).toBeGreaterThan(0);
    expect(stats.byCategory['customers']).toBeGreaterThan(0);
  });

  it('should sum priorities to total', () => {
    const stats = getStripeActionStats();
    const sum = Object.values(stats.byPriority).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });

  it('should sum categories to total', () => {
    const stats = getStripeActionStats();
    const sum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });
});

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

describe('getStripeSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = getStripeSystemPrompt();
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should mention Stripe', () => {
    expect(getStripeSystemPrompt()).toContain('Stripe');
  });

  it('should mention safety rules', () => {
    expect(getStripeSystemPrompt()).toContain('Safety Rules');
  });

  it('should mention composio tools', () => {
    expect(getStripeSystemPrompt()).toContain('composio_STRIPE_');
  });
});

describe('getStripeCapabilitySummary', () => {
  it('should return a non-empty string', () => {
    expect(getStripeCapabilitySummary().length).toBeGreaterThan(0);
  });

  it('should include action count', () => {
    const stats = getStripeActionStats();
    expect(getStripeCapabilitySummary()).toContain(`${stats.total}`);
  });
});

describe('logStripeToolkitStats', () => {
  it('should be a function', () => {
    expect(typeof logStripeToolkitStats).toBe('function');
  });

  it('should not throw', () => {
    expect(() => logStripeToolkitStats()).not.toThrow();
  });
});
