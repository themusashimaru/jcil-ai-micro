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
  type FigmaActionCategory,
  type FigmaAction,
  ALL_FIGMA_ACTIONS,
  getFigmaFeaturedActionNames,
  getFigmaActionsByPriority,
  getFigmaActionNamesByPriority,
  getFigmaActionsByCategory,
  getFigmaActionPriority,
  isKnownFigmaAction,
  isDestructiveFigmaAction,
  sortByFigmaPriority,
  getFigmaActionStats,
  getFigmaSystemPrompt,
  getFigmaCapabilitySummary,
  logFigmaToolkitStats,
} from './figma-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('FigmaToolkit type exports', () => {
  it('should export FigmaActionCategory type', () => {
    const cat: FigmaActionCategory = 'files';
    expect(['files', 'components', 'comments', 'projects', 'teams', 'styles']).toContain(cat);
  });

  it('should export FigmaAction interface', () => {
    const action: FigmaAction = {
      name: 'FIGMA_GET_FILE',
      label: 'Test',
      category: 'files',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_FIGMA_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_FIGMA_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_FIGMA_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_FIGMA_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: FigmaActionCategory[] = [
      'files',
      'components',
      'comments',
      'projects',
      'teams',
      'styles',
    ];
    for (const action of ALL_FIGMA_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_FIGMA_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with FIGMA_', () => {
    for (const action of ALL_FIGMA_ACTIONS) {
      expect(action.name).toMatch(/^FIGMA_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_FIGMA_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('Figma query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getFigmaFeaturedActionNames();
    expect(names.length).toBe(ALL_FIGMA_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getFigmaActionsByPriority(1);
    const p2 = getFigmaActionsByPriority(2);
    const p3 = getFigmaActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: FigmaAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getFigmaActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: FigmaActionCategory = 'files';
    const actions = getFigmaActionsByCategory(category);
    expect(actions.every((a: FigmaAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getFigmaActionPriority('FIGMA_GET_FILE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getFigmaActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getFigmaActionPriority('composio_FIGMA_GET_FILE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownFigmaAction('FIGMA_GET_FILE')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownFigmaAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownFigmaAction('composio_FIGMA_GET_FILE')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveFigmaAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveFigmaAction('FIGMA_DELETE_COMMENT')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'FIGMA_GET_FILE' }];
    const sorted = sortByFigmaPriority(tools);
    expect(sorted[0].name).toBe('FIGMA_GET_FILE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('Figma stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getFigmaActionStats();
    expect(stats.total).toBe(ALL_FIGMA_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getFigmaSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getFigmaCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Figma');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logFigmaToolkitStats()).not.toThrow();
  });
});
