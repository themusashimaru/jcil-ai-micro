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
  type DocuSignActionCategory,
  type DocuSignAction,
  ALL_DOCUSIGN_ACTIONS,
  getDocuSignFeaturedActionNames,
  getDocuSignActionsByPriority,
  getDocuSignActionNamesByPriority,
  getDocuSignActionsByCategory,
  getDocuSignActionPriority,
  isKnownDocuSignAction,
  isDestructiveDocuSignAction,
  sortByDocuSignPriority,
  getDocuSignActionStats,
  getDocuSignSystemPrompt,
  getDocuSignCapabilitySummary,
  logDocuSignToolkitStats,
} from './docusign-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('DocuSignToolkit type exports', () => {
  it('should export DocuSignActionCategory type', () => {
    const cat: DocuSignActionCategory = 'envelopes';
    expect(['envelopes', 'documents', 'recipients', 'templates', 'signing', 'account']).toContain(
      cat
    );
  });

  it('should export DocuSignAction interface', () => {
    const action: DocuSignAction = {
      name: 'DOCUSIGN_CREATE_ENVELOPE',
      label: 'Test',
      category: 'envelopes',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_DOCUSIGN_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_DOCUSIGN_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_DOCUSIGN_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_DOCUSIGN_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: DocuSignActionCategory[] = [
      'envelopes',
      'documents',
      'recipients',
      'templates',
      'signing',
      'account',
    ];
    for (const action of ALL_DOCUSIGN_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_DOCUSIGN_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with DOCUSIGN_', () => {
    for (const action of ALL_DOCUSIGN_ACTIONS) {
      expect(action.name).toMatch(/^DOCUSIGN_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_DOCUSIGN_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('DocuSign query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getDocuSignFeaturedActionNames();
    expect(names.length).toBe(ALL_DOCUSIGN_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getDocuSignActionsByPriority(1);
    const p2 = getDocuSignActionsByPriority(2);
    const p3 = getDocuSignActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: DocuSignAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getDocuSignActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: DocuSignActionCategory = 'envelopes';
    const actions = getDocuSignActionsByCategory(category);
    expect(actions.every((a: DocuSignAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getDocuSignActionPriority('DOCUSIGN_CREATE_ENVELOPE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getDocuSignActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getDocuSignActionPriority('composio_DOCUSIGN_CREATE_ENVELOPE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownDocuSignAction('DOCUSIGN_CREATE_ENVELOPE')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownDocuSignAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownDocuSignAction('composio_DOCUSIGN_CREATE_ENVELOPE')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveDocuSignAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveDocuSignAction('DOCUSIGN_VOID_ENVELOPE')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'DOCUSIGN_CREATE_ENVELOPE' }];
    const sorted = sortByDocuSignPriority(tools);
    expect(sorted[0].name).toBe('DOCUSIGN_CREATE_ENVELOPE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('DocuSign stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getDocuSignActionStats();
    expect(stats.total).toBe(ALL_DOCUSIGN_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getDocuSignSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getDocuSignCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Docu');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logDocuSignToolkitStats()).not.toThrow();
  });
});
