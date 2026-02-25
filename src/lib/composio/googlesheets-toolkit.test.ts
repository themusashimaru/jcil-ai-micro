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
  type GoogleSheetsActionCategory,
  type GoogleSheetsAction,
  ALL_GOOGLE_SHEETS_ACTIONS,
  getGoogleSheetsFeaturedActionNames,
  getGoogleSheetsActionsByPriority,
  getGoogleSheetsActionNamesByPriority,
  getGoogleSheetsActionsByCategory,
  getGoogleSheetsActionPriority,
  isKnownGoogleSheetsAction,
  isDestructiveGoogleSheetsAction,
  sortByGoogleSheetsPriority,
  getGoogleSheetsActionStats,
  getGoogleSheetsSystemPrompt,
  getGoogleSheetsCapabilitySummary,
  logGoogleSheetsToolkitStats,
} from './googlesheets-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GoogleSheetsToolkit type exports', () => {
  it('should export GoogleSheetsActionCategory type', () => {
    const cat: GoogleSheetsActionCategory = 'read';
    expect(['read', 'write', 'manage', 'analyze']).toContain(cat);
  });

  it('should export GoogleSheetsAction interface', () => {
    const action: GoogleSheetsAction = {
      name: 'GOOGLESHEETS_VALUES_UPDATE',
      label: 'Test',
      category: 'read',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_GOOGLE_SHEETS_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GOOGLE_SHEETS_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GOOGLE_SHEETS_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GOOGLE_SHEETS_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GoogleSheetsActionCategory[] = ['read', 'write', 'manage', 'analyze'];
    for (const action of ALL_GOOGLE_SHEETS_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GOOGLE_SHEETS_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GOOGLESHEETS_', () => {
    for (const action of ALL_GOOGLE_SHEETS_ACTIONS) {
      expect(action.name).toMatch(/^GOOGLESHEETS_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GOOGLE_SHEETS_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('GoogleSheets query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGoogleSheetsFeaturedActionNames();
    expect(names.length).toBe(ALL_GOOGLE_SHEETS_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGoogleSheetsActionsByPriority(1);
    const p2 = getGoogleSheetsActionsByPriority(2);
    const p3 = getGoogleSheetsActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GoogleSheetsAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGoogleSheetsActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GoogleSheetsActionCategory = 'read';
    const actions = getGoogleSheetsActionsByCategory(category);
    expect(actions.every((a: GoogleSheetsAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGoogleSheetsActionPriority('GOOGLESHEETS_VALUES_UPDATE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGoogleSheetsActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGoogleSheetsActionPriority('composio_GOOGLESHEETS_VALUES_UPDATE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGoogleSheetsAction('GOOGLESHEETS_VALUES_UPDATE')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGoogleSheetsAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownGoogleSheetsAction('composio_GOOGLESHEETS_VALUES_UPDATE')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGoogleSheetsAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveGoogleSheetsAction('GOOGLESHEETS_DELETE_SHEET')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GOOGLESHEETS_VALUES_UPDATE' }];
    const sorted = sortByGoogleSheetsPriority(tools);
    expect(sorted[0].name).toBe('GOOGLESHEETS_VALUES_UPDATE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('GoogleSheets stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGoogleSheetsActionStats();
    expect(stats.total).toBe(ALL_GOOGLE_SHEETS_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGoogleSheetsSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGoogleSheetsCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Google');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGoogleSheetsToolkitStats()).not.toThrow();
  });
});
