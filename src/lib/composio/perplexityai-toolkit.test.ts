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
  type PerplexityAIActionCategory,
  type PerplexityAIAction,
  ALL_PERPLEXITY_AI_ACTIONS,
  getPerplexityAIFeaturedActionNames,
  getPerplexityAIActionsByPriority,
  getPerplexityAIActionNamesByPriority,
  getPerplexityAIActionsByCategory,
  getPerplexityAIActionPriority,
  isKnownPerplexityAIAction,
  isDestructivePerplexityAIAction,
  sortByPerplexityAIPriority,
  getPerplexityAIActionStats,
  getPerplexityAISystemPrompt,
  getPerplexityAICapabilitySummary,
  logPerplexityAIToolkitStats,
} from './perplexityai-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('PerplexityAIToolkit type exports', () => {
  it('should export PerplexityAIActionCategory type', () => {
    const cat: PerplexityAIActionCategory = 'search';
    expect(['search', 'chat', 'research']).toContain(cat);
  });

  it('should export PerplexityAIAction interface', () => {
    const action: PerplexityAIAction = {
      name: 'PERPLEXITYAI_SEARCH',
      label: 'Test',
      category: 'search',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_PERPLEXITY_AI_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_PERPLEXITY_AI_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_PERPLEXITY_AI_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_PERPLEXITY_AI_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: PerplexityAIActionCategory[] = ['search', 'chat', 'research'];
    for (const action of ALL_PERPLEXITY_AI_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_PERPLEXITY_AI_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with PERPLEXITYAI_', () => {
    for (const action of ALL_PERPLEXITY_AI_ACTIONS) {
      expect(action.name).toMatch(/^PERPLEXITYAI_/);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('PerplexityAI query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getPerplexityAIFeaturedActionNames();
    expect(names.length).toBe(ALL_PERPLEXITY_AI_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getPerplexityAIActionsByPriority(1);
    const p2 = getPerplexityAIActionsByPriority(2);
    const p3 = getPerplexityAIActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: PerplexityAIAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getPerplexityAIActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: PerplexityAIActionCategory = 'search';
    const actions = getPerplexityAIActionsByCategory(category);
    expect(actions.every((a: PerplexityAIAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getPerplexityAIActionPriority('PERPLEXITYAI_SEARCH');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getPerplexityAIActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getPerplexityAIActionPriority('composio_PERPLEXITYAI_SEARCH');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownPerplexityAIAction('PERPLEXITYAI_SEARCH')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownPerplexityAIAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownPerplexityAIAction('composio_PERPLEXITYAI_SEARCH')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructivePerplexityAIAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'PERPLEXITYAI_SEARCH' }];
    const sorted = sortByPerplexityAIPriority(tools);
    expect(sorted[0].name).toBe('PERPLEXITYAI_SEARCH');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('PerplexityAI stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getPerplexityAIActionStats();
    expect(stats.total).toBe(ALL_PERPLEXITY_AI_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getPerplexityAISystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getPerplexityAICapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Perplexity');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logPerplexityAIToolkitStats()).not.toThrow();
  });
});
