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
  type WhatsAppActionCategory,
  type WhatsAppAction,
  ALL_WHATSAPP_ACTIONS,
  getWhatsAppFeaturedActionNames,
  getWhatsAppActionsByPriority,
  getWhatsAppActionNamesByPriority,
  getWhatsAppActionsByCategory,
  getWhatsAppActionPriority,
  isKnownWhatsAppAction,
  isDestructiveWhatsAppAction,
  sortByWhatsAppPriority,
  getWhatsAppActionStats,
  getWhatsAppSystemPrompt,
  getWhatsAppCapabilitySummary,
  logWhatsAppToolkitStats,
} from './whatsapp-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('WhatsAppToolkit type exports', () => {
  it('should export WhatsAppActionCategory type', () => {
    const cat: WhatsAppActionCategory = 'messages';
    expect(['messages', 'media', 'contacts', 'business']).toContain(cat);
  });

  it('should export WhatsAppAction interface', () => {
    const action: WhatsAppAction = {
      name: 'WHATSAPP_SEND_MESSAGE',
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

describe('ALL_WHATSAPP_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_WHATSAPP_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_WHATSAPP_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_WHATSAPP_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: WhatsAppActionCategory[] = ['messages', 'media', 'contacts', 'business'];
    for (const action of ALL_WHATSAPP_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_WHATSAPP_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with WHATSAPP_', () => {
    for (const action of ALL_WHATSAPP_ACTIONS) {
      expect(action.name).toMatch(/^WHATSAPP_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_WHATSAPP_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('WhatsApp query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getWhatsAppFeaturedActionNames();
    expect(names.length).toBe(ALL_WHATSAPP_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getWhatsAppActionsByPriority(1);
    const p2 = getWhatsAppActionsByPriority(2);
    const p3 = getWhatsAppActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: WhatsAppAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getWhatsAppActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: WhatsAppActionCategory = 'messages';
    const actions = getWhatsAppActionsByCategory(category);
    expect(actions.every((a: WhatsAppAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getWhatsAppActionPriority('WHATSAPP_SEND_MESSAGE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getWhatsAppActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getWhatsAppActionPriority('composio_WHATSAPP_SEND_MESSAGE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownWhatsAppAction('WHATSAPP_SEND_MESSAGE')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownWhatsAppAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownWhatsAppAction('composio_WHATSAPP_SEND_MESSAGE')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveWhatsAppAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveWhatsAppAction('WHATSAPP_DELETE_MESSAGE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'WHATSAPP_SEND_MESSAGE' }];
    const sorted = sortByWhatsAppPriority(tools);
    expect(sorted[0].name).toBe('WHATSAPP_SEND_MESSAGE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('WhatsApp stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getWhatsAppActionStats();
    expect(stats.total).toBe(ALL_WHATSAPP_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getWhatsAppSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getWhatsAppCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Whats');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logWhatsAppToolkitStats()).not.toThrow();
  });
});
