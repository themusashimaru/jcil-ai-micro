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
  type SendGridActionCategory,
  type SendGridAction,
  ALL_SENDGRID_ACTIONS,
  getSendGridFeaturedActionNames,
  getSendGridActionsByPriority,
  getSendGridActionNamesByPriority,
  getSendGridActionsByCategory,
  getSendGridActionPriority,
  isKnownSendGridAction,
  isDestructiveSendGridAction,
  sortBySendGridPriority,
  getSendGridActionStats,
  getSendGridSystemPrompt,
  getSendGridCapabilitySummary,
  logSendGridToolkitStats,
} from './sendgrid-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('SendGridToolkit type exports', () => {
  it('should export SendGridActionCategory type', () => {
    const cat: SendGridActionCategory = 'mail';
    expect(['mail', 'contacts', 'lists', 'templates', 'stats', 'senders']).toContain(cat);
  });

  it('should export SendGridAction interface', () => {
    const action: SendGridAction = {
      name: 'SENDGRID_SEND_EMAIL',
      label: 'Test',
      category: 'mail',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_SENDGRID_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_SENDGRID_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_SENDGRID_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_SENDGRID_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: SendGridActionCategory[] = [
      'mail',
      'contacts',
      'lists',
      'templates',
      'stats',
      'senders',
    ];
    for (const action of ALL_SENDGRID_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_SENDGRID_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with SENDGRID_', () => {
    for (const action of ALL_SENDGRID_ACTIONS) {
      expect(action.name).toMatch(/^SENDGRID_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_SENDGRID_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('SendGrid query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getSendGridFeaturedActionNames();
    expect(names.length).toBe(ALL_SENDGRID_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getSendGridActionsByPriority(1);
    const p2 = getSendGridActionsByPriority(2);
    const p3 = getSendGridActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: SendGridAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getSendGridActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: SendGridActionCategory = 'mail';
    const actions = getSendGridActionsByCategory(category);
    expect(actions.every((a: SendGridAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getSendGridActionPriority('SENDGRID_SEND_EMAIL');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getSendGridActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getSendGridActionPriority('composio_SENDGRID_SEND_EMAIL');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownSendGridAction('SENDGRID_SEND_EMAIL')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownSendGridAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownSendGridAction('composio_SENDGRID_SEND_EMAIL')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveSendGridAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveSendGridAction('SENDGRID_DELETE_CONTACTS')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'SENDGRID_SEND_EMAIL' }];
    const sorted = sortBySendGridPriority(tools);
    expect(sorted[0].name).toBe('SENDGRID_SEND_EMAIL');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('SendGrid stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getSendGridActionStats();
    expect(stats.total).toBe(ALL_SENDGRID_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getSendGridSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getSendGridCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Send');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logSendGridToolkitStats()).not.toThrow();
  });
});
