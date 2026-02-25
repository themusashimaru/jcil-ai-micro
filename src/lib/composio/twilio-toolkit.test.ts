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
  type TwilioActionCategory,
  type TwilioAction,
  ALL_TWILIO_ACTIONS,
  getTwilioFeaturedActionNames,
  getTwilioActionsByPriority,
  getTwilioActionNamesByPriority,
  getTwilioActionsByCategory,
  getTwilioActionPriority,
  isKnownTwilioAction,
  isDestructiveTwilioAction,
  sortByTwilioPriority,
  getTwilioActionStats,
  getTwilioSystemPrompt,
  getTwilioCapabilitySummary,
  logTwilioToolkitStats,
} from './twilio-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('TwilioToolkit type exports', () => {
  it('should export TwilioActionCategory type', () => {
    const cat: TwilioActionCategory = 'sms';
    expect(['sms', 'voice', 'phone_numbers', 'account']).toContain(cat);
  });

  it('should export TwilioAction interface', () => {
    const action: TwilioAction = {
      name: 'TWILIO_SEND_SMS',
      label: 'Test',
      category: 'sms',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_TWILIO_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_TWILIO_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_TWILIO_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_TWILIO_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: TwilioActionCategory[] = ['sms', 'voice', 'phone_numbers', 'account'];
    for (const action of ALL_TWILIO_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_TWILIO_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with TWILIO_', () => {
    for (const action of ALL_TWILIO_ACTIONS) {
      expect(action.name).toMatch(/^TWILIO_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_TWILIO_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Twilio query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getTwilioFeaturedActionNames();
    expect(names.length).toBe(ALL_TWILIO_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getTwilioActionsByPriority(1);
    const p2 = getTwilioActionsByPriority(2);
    const p3 = getTwilioActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: TwilioAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getTwilioActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: TwilioActionCategory = 'sms';
    const actions = getTwilioActionsByCategory(category);
    expect(actions.every((a: TwilioAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getTwilioActionPriority('TWILIO_SEND_SMS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getTwilioActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getTwilioActionPriority('composio_TWILIO_SEND_SMS');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownTwilioAction('TWILIO_SEND_SMS')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownTwilioAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownTwilioAction('composio_TWILIO_SEND_SMS')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveTwilioAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveTwilioAction('TWILIO_RELEASE_PHONE_NUMBER')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'TWILIO_SEND_SMS' }];
    const sorted = sortByTwilioPriority(tools);
    expect(sorted[0].name).toBe('TWILIO_SEND_SMS');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Twilio stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getTwilioActionStats();
    expect(stats.total).toBe(ALL_TWILIO_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getTwilioSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getTwilioCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Twilio');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logTwilioToolkitStats()).not.toThrow();
  });
});
