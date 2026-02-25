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
  type GmailActionCategory,
  type GmailAction,
  ALL_GMAIL_ACTIONS,
  getGmailFeaturedActionNames,
  getGmailActionsByPriority,
  getGmailActionNamesByPriority,
  getGmailActionsByCategory,
  getGmailActionPriority,
  isKnownGmailAction,
  isDestructiveGmailAction,
  sortByGmailPriority,
  getGmailActionStats,
  getGmailSystemPrompt,
  getGmailCapabilitySummary,
  logGmailToolkitStats,
} from './gmail-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GmailToolkit type exports', () => {
  it('should export GmailActionCategory type', () => {
    const cat: GmailActionCategory = 'inbox';
    expect(['inbox', 'compose', 'organize', 'contacts', 'settings', 'security']).toContain(cat);
  });

  it('should export GmailAction interface', () => {
    const action: GmailAction = {
      name: 'GMAIL_SEND_EMAIL',
      label: 'Test',
      category: 'inbox',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_GMAIL_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GMAIL_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GMAIL_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GMAIL_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GmailActionCategory[] = [
      'inbox',
      'compose',
      'organize',
      'contacts',
      'settings',
      'security',
    ];
    for (const action of ALL_GMAIL_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GMAIL_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GMAIL_', () => {
    for (const action of ALL_GMAIL_ACTIONS) {
      expect(action.name).toMatch(/^GMAIL_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GMAIL_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Gmail query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGmailFeaturedActionNames();
    expect(names.length).toBe(ALL_GMAIL_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGmailActionsByPriority(1);
    const p2 = getGmailActionsByPriority(2);
    const p3 = getGmailActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GmailAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGmailActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GmailActionCategory = 'inbox';
    const actions = getGmailActionsByCategory(category);
    expect(actions.every((a: GmailAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGmailActionPriority('GMAIL_SEND_EMAIL');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGmailActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGmailActionPriority('composio_GMAIL_SEND_EMAIL');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGmailAction('GMAIL_SEND_EMAIL')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGmailAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownGmailAction('composio_GMAIL_SEND_EMAIL')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGmailAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveGmailAction('GMAIL_BATCH_DELETE_MESSAGES')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GMAIL_SEND_EMAIL' }];
    const sorted = sortByGmailPriority(tools);
    expect(sorted[0].name).toBe('GMAIL_SEND_EMAIL');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Gmail stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGmailActionStats();
    expect(stats.total).toBe(ALL_GMAIL_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGmailSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGmailCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Gmail');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGmailToolkitStats()).not.toThrow();
  });
});
