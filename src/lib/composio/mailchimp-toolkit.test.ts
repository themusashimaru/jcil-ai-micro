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
  type MailchimpActionCategory,
  type MailchimpAction,
  ALL_MAILCHIMP_ACTIONS,
  getMailchimpFeaturedActionNames,
  getMailchimpActionsByPriority,
  getMailchimpActionNamesByPriority,
  getMailchimpActionsByCategory,
  getMailchimpActionPriority,
  isKnownMailchimpAction,
  isDestructiveMailchimpAction,
  sortByMailchimpPriority,
  getMailchimpActionStats,
  getMailchimpSystemPrompt,
  getMailchimpCapabilitySummary,
  logMailchimpToolkitStats,
} from './mailchimp-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('MailchimpToolkit type exports', () => {
  it('should export MailchimpActionCategory type', () => {
    const cat: MailchimpActionCategory = 'campaigns';
    expect(['campaigns', 'audiences', 'members', 'templates', 'reports', 'tags']).toContain(cat);
  });

  it('should export MailchimpAction interface', () => {
    const action: MailchimpAction = {
      name: 'MAILCHIMP_LIST_CAMPAIGNS',
      label: 'Test',
      category: 'campaigns',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_MAILCHIMP_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_MAILCHIMP_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_MAILCHIMP_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_MAILCHIMP_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: MailchimpActionCategory[] = [
      'campaigns',
      'audiences',
      'members',
      'templates',
      'reports',
      'tags',
    ];
    for (const action of ALL_MAILCHIMP_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_MAILCHIMP_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with MAILCHIMP_', () => {
    for (const action of ALL_MAILCHIMP_ACTIONS) {
      expect(action.name).toMatch(/^MAILCHIMP_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_MAILCHIMP_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Mailchimp query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getMailchimpFeaturedActionNames();
    expect(names.length).toBe(ALL_MAILCHIMP_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getMailchimpActionsByPriority(1);
    const p2 = getMailchimpActionsByPriority(2);
    const p3 = getMailchimpActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: MailchimpAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getMailchimpActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: MailchimpActionCategory = 'campaigns';
    const actions = getMailchimpActionsByCategory(category);
    expect(actions.every((a: MailchimpAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getMailchimpActionPriority('MAILCHIMP_LIST_CAMPAIGNS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getMailchimpActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getMailchimpActionPriority('composio_MAILCHIMP_LIST_CAMPAIGNS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownMailchimpAction('MAILCHIMP_LIST_CAMPAIGNS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownMailchimpAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownMailchimpAction('composio_MAILCHIMP_LIST_CAMPAIGNS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveMailchimpAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveMailchimpAction('MAILCHIMP_DELETE_CAMPAIGN')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'MAILCHIMP_LIST_CAMPAIGNS' }];
    const sorted = sortByMailchimpPriority(tools);
    expect(sorted[0].name).toBe('MAILCHIMP_LIST_CAMPAIGNS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Mailchimp stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getMailchimpActionStats();
    expect(stats.total).toBe(ALL_MAILCHIMP_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getMailchimpSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getMailchimpCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Mailchimp');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logMailchimpToolkitStats()).not.toThrow();
  });
});
