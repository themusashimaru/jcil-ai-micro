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
  type ShopifyActionCategory,
  type ShopifyAction,
  ALL_SHOPIFY_ACTIONS,
  getShopifyFeaturedActionNames,
  getShopifyActionsByPriority,
  getShopifyActionNamesByPriority,
  getShopifyActionsByCategory,
  getShopifyActionPriority,
  isKnownShopifyAction,
  isDestructiveShopifyAction,
  sortByShopifyPriority,
  getShopifyActionStats,
  getShopifySystemPrompt,
  getShopifyCapabilitySummary,
  logShopifyToolkitStats,
} from './shopify-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('ShopifyToolkit type exports', () => {
  it('should export ShopifyActionCategory type', () => {
    const cat: ShopifyActionCategory = 'products';
    expect([
      'products',
      'orders',
      'customers',
      'inventory',
      'collections',
      'discounts',
      'fulfillment',
      'shop',
    ]).toContain(cat);
  });

  it('should export ShopifyAction interface', () => {
    const action: ShopifyAction = {
      name: 'SHOPIFY_LIST_PRODUCTS',
      label: 'Test',
      category: 'products',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_SHOPIFY_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_SHOPIFY_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_SHOPIFY_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_SHOPIFY_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: ShopifyActionCategory[] = [
      'products',
      'orders',
      'customers',
      'inventory',
      'collections',
      'discounts',
      'fulfillment',
      'shop',
    ];
    for (const action of ALL_SHOPIFY_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_SHOPIFY_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with SHOPIFY_', () => {
    for (const action of ALL_SHOPIFY_ACTIONS) {
      expect(action.name).toMatch(/^SHOPIFY_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_SHOPIFY_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Shopify query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getShopifyFeaturedActionNames();
    expect(names.length).toBe(ALL_SHOPIFY_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getShopifyActionsByPriority(1);
    const p2 = getShopifyActionsByPriority(2);
    const p3 = getShopifyActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: ShopifyAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getShopifyActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: ShopifyActionCategory = 'products';
    const actions = getShopifyActionsByCategory(category);
    expect(actions.every((a: ShopifyAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getShopifyActionPriority('SHOPIFY_LIST_PRODUCTS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getShopifyActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getShopifyActionPriority('composio_SHOPIFY_LIST_PRODUCTS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownShopifyAction('SHOPIFY_LIST_PRODUCTS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownShopifyAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownShopifyAction('composio_SHOPIFY_LIST_PRODUCTS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveShopifyAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveShopifyAction('SHOPIFY_DELETE_PRODUCT')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'SHOPIFY_LIST_PRODUCTS' }];
    const sorted = sortByShopifyPriority(tools);
    expect(sorted[0].name).toBe('SHOPIFY_LIST_PRODUCTS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Shopify stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getShopifyActionStats();
    expect(stats.total).toBe(ALL_SHOPIFY_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getShopifySystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getShopifyCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Shopify');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logShopifyToolkitStats()).not.toThrow();
  });
});
