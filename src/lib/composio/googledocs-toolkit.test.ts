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
  type GoogleDocsActionCategory,
  type GoogleDocsAction,
  ALL_GOOGLE_DOCS_ACTIONS,
  getGoogleDocsFeaturedActionNames,
  getGoogleDocsActionsByPriority,
  getGoogleDocsActionNamesByPriority,
  getGoogleDocsActionsByCategory,
  getGoogleDocsActionPriority,
  isKnownGoogleDocsAction,
  isDestructiveGoogleDocsAction,
  sortByGoogleDocsPriority,
  getGoogleDocsActionStats,
  getGoogleDocsSystemPrompt,
  getGoogleDocsCapabilitySummary,
  logGoogleDocsToolkitStats,
} from './googledocs-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GoogleDocsToolkit type exports', () => {
  it('should export GoogleDocsActionCategory type', () => {
    const cat: GoogleDocsActionCategory = 'create';
    expect(['create', 'edit', 'format', 'tables']).toContain(cat);
  });

  it('should export GoogleDocsAction interface', () => {
    const action: GoogleDocsAction = {
      name: 'GOOGLEDOCS_CREATE_DOCUMENT',
      label: 'Test',
      category: 'create',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_GOOGLE_DOCS_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GOOGLE_DOCS_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GOOGLE_DOCS_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GOOGLE_DOCS_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GoogleDocsActionCategory[] = ['create', 'edit', 'format', 'tables'];
    for (const action of ALL_GOOGLE_DOCS_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GOOGLE_DOCS_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GOOGLEDOCS_', () => {
    for (const action of ALL_GOOGLE_DOCS_ACTIONS) {
      expect(action.name).toMatch(/^GOOGLEDOCS_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GOOGLE_DOCS_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('GoogleDocs query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGoogleDocsFeaturedActionNames();
    expect(names.length).toBe(ALL_GOOGLE_DOCS_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGoogleDocsActionsByPriority(1);
    const p2 = getGoogleDocsActionsByPriority(2);
    const p3 = getGoogleDocsActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GoogleDocsAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGoogleDocsActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GoogleDocsActionCategory = 'create';
    const actions = getGoogleDocsActionsByCategory(category);
    expect(actions.every((a: GoogleDocsAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGoogleDocsActionPriority('GOOGLEDOCS_CREATE_DOCUMENT');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGoogleDocsActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGoogleDocsActionPriority('composio_GOOGLEDOCS_CREATE_DOCUMENT');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGoogleDocsAction('GOOGLEDOCS_CREATE_DOCUMENT')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGoogleDocsAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownGoogleDocsAction('composio_GOOGLEDOCS_CREATE_DOCUMENT')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGoogleDocsAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveGoogleDocsAction('GOOGLEDOCS_DELETE_CONTENT_RANGE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GOOGLEDOCS_CREATE_DOCUMENT' }];
    const sorted = sortByGoogleDocsPriority(tools);
    expect(sorted[0].name).toBe('GOOGLEDOCS_CREATE_DOCUMENT');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('GoogleDocs stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGoogleDocsActionStats();
    expect(stats.total).toBe(ALL_GOOGLE_DOCS_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGoogleDocsSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGoogleDocsCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Google');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGoogleDocsToolkitStats()).not.toThrow();
  });
});
