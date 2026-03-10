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
  type TelegramActionCategory,
  type TelegramAction,
  ALL_TELEGRAM_ACTIONS,
  getTelegramFeaturedActionNames,
  getTelegramActionsByPriority,
  getTelegramActionNamesByPriority,
  getTelegramActionsByCategory,
  getTelegramActionPriority,
  isKnownTelegramAction,
  isDestructiveTelegramAction,
  sortByTelegramPriority,
  getTelegramActionStats,
  getTelegramSystemPrompt,
  getTelegramCapabilitySummary,
  logTelegramToolkitStats,
} from './telegram-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('TelegramToolkit type exports', () => {
  it('should export TelegramActionCategory type', () => {
    const cat: TelegramActionCategory = 'messages';
    expect(['messages', 'media', 'chats', 'updates']).toContain(cat);
  });

  it('should export TelegramAction interface', () => {
    const action: TelegramAction = {
      name: 'TELEGRAM_SEND_MESSAGE',
      label: 'Test',
      category: 'messages',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_TELEGRAM_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_TELEGRAM_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_TELEGRAM_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_TELEGRAM_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: TelegramActionCategory[] = ['messages', 'media', 'chats', 'updates'];
    for (const action of ALL_TELEGRAM_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_TELEGRAM_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with TELEGRAM_', () => {
    for (const action of ALL_TELEGRAM_ACTIONS) {
      expect(action.name).toMatch(/^TELEGRAM_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_TELEGRAM_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Telegram query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getTelegramFeaturedActionNames();
    expect(names.length).toBe(ALL_TELEGRAM_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getTelegramActionsByPriority(1);
    const p2 = getTelegramActionsByPriority(2);
    const p3 = getTelegramActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: TelegramAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getTelegramActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: TelegramActionCategory = 'messages';
    const actions = getTelegramActionsByCategory(category);
    expect(actions.every((a: TelegramAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getTelegramActionPriority('TELEGRAM_SEND_MESSAGE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getTelegramActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getTelegramActionPriority('composio_TELEGRAM_SEND_MESSAGE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownTelegramAction('TELEGRAM_SEND_MESSAGE')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownTelegramAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownTelegramAction('composio_TELEGRAM_SEND_MESSAGE')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveTelegramAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveTelegramAction('TELEGRAM_DELETE_MESSAGE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'TELEGRAM_SEND_MESSAGE' }];
    const sorted = sortByTelegramPriority(tools);
    expect(sorted[0].name).toBe('TELEGRAM_SEND_MESSAGE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Telegram stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getTelegramActionStats();
    expect(stats.total).toBe(ALL_TELEGRAM_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getTelegramSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getTelegramCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Telegram');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logTelegramToolkitStats()).not.toThrow();
  });
});
