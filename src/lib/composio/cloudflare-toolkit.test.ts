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
  type CloudflareActionCategory,
  type CloudflareAction,
  ALL_CLOUDFLARE_ACTIONS,
  getCloudflareFeaturedActionNames,
  getCloudflareActionsByPriority,
  getCloudflareActionNamesByPriority,
  getCloudflareActionsByCategory,
  getCloudflareActionPriority,
  isKnownCloudflareAction,
  isDestructiveCloudflareAction,
  sortByCloudflarePriority,
  getCloudflareActionStats,
  getCloudflareSystemPrompt,
  getCloudflareCapabilitySummary,
  logCloudflareToolkitStats,
} from './cloudflare-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('CloudflareToolkit type exports', () => {
  it('should export CloudflareActionCategory type', () => {
    const cat: CloudflareActionCategory = 'dns';
    expect(['dns', 'zones', 'workers', 'firewall', 'cache', 'analytics', 'pages']).toContain(cat);
  });

  it('should export CloudflareAction interface', () => {
    const action: CloudflareAction = {
      name: 'CLOUDFLARE_LIST_ZONES',
      label: 'Test',
      category: 'dns',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_CLOUDFLARE_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_CLOUDFLARE_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_CLOUDFLARE_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_CLOUDFLARE_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: CloudflareActionCategory[] = [
      'dns',
      'zones',
      'workers',
      'firewall',
      'cache',
      'analytics',
      'pages',
    ];
    for (const action of ALL_CLOUDFLARE_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_CLOUDFLARE_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with CLOUDFLARE_', () => {
    for (const action of ALL_CLOUDFLARE_ACTIONS) {
      expect(action.name).toMatch(/^CLOUDFLARE_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_CLOUDFLARE_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Cloudflare query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getCloudflareFeaturedActionNames();
    expect(names.length).toBe(ALL_CLOUDFLARE_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getCloudflareActionsByPriority(1);
    const p2 = getCloudflareActionsByPriority(2);
    const p3 = getCloudflareActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: CloudflareAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getCloudflareActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: CloudflareActionCategory = 'dns';
    const actions = getCloudflareActionsByCategory(category);
    expect(actions.every((a: CloudflareAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getCloudflareActionPriority('CLOUDFLARE_LIST_ZONES');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getCloudflareActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getCloudflareActionPriority('composio_CLOUDFLARE_LIST_ZONES');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownCloudflareAction('CLOUDFLARE_LIST_ZONES')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownCloudflareAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownCloudflareAction('composio_CLOUDFLARE_LIST_ZONES')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveCloudflareAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveCloudflareAction('CLOUDFLARE_DELETE_DNS_RECORD')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'CLOUDFLARE_LIST_ZONES' }];
    const sorted = sortByCloudflarePriority(tools);
    expect(sorted[0].name).toBe('CLOUDFLARE_LIST_ZONES');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Cloudflare stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getCloudflareActionStats();
    expect(stats.total).toBe(ALL_CLOUDFLARE_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getCloudflareSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getCloudflareCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Cloudflare');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logCloudflareToolkitStats()).not.toThrow();
  });
});
