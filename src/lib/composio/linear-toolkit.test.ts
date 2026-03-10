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
  type LinearActionCategory,
  type LinearAction,
  ALL_LINEAR_ACTIONS,
  getLinearFeaturedActionNames,
  getLinearActionsByPriority,
  getLinearActionNamesByPriority,
  getLinearActionsByCategory,
  getLinearActionPriority,
  isKnownLinearAction,
  isDestructiveLinearAction,
  sortByLinearPriority,
  getLinearActionStats,
  getLinearSystemPrompt,
  getLinearCapabilitySummary,
  logLinearToolkitStats,
} from './linear-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('LinearToolkit type exports', () => {
  it('should export LinearActionCategory type', () => {
    const cat: LinearActionCategory = 'issues';
    expect([
      'issues',
      'projects',
      'cycles',
      'teams',
      'users',
      'labels',
      'comments',
      'workflows',
    ]).toContain(cat);
  });

  it('should export LinearAction interface', () => {
    const action: LinearAction = {
      name: 'LINEAR_CREATE_LINEAR_ISSUE',
      label: 'Create Issue',
      category: 'issues',
      priority: 1,
      writeOperation: true,
    };
    expect(action.priority).toBe(1);
    expect(action.writeOperation).toBe(true);
  });

  it('should support optional destructive field', () => {
    const action: LinearAction = {
      name: 'LINEAR_DELETE_LINEAR_PROJECT',
      label: 'Delete Project',
      category: 'projects',
      priority: 4,
      writeOperation: true,
      destructive: true,
    };
    expect(action.destructive).toBe(true);
  });
});

// ============================================================================
// ALL_LINEAR_ACTIONS REGISTRY
// ============================================================================

describe('ALL_LINEAR_ACTIONS', () => {
  it('should be a non-empty array', () => {
    expect(ALL_LINEAR_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have actions with valid priorities 1-4', () => {
    for (const action of ALL_LINEAR_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have actions with valid categories', () => {
    const validCategories = [
      'issues',
      'projects',
      'cycles',
      'teams',
      'users',
      'labels',
      'comments',
      'workflows',
    ];
    for (const action of ALL_LINEAR_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have unique action names', () => {
    const names = ALL_LINEAR_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have essential (priority 1) actions', () => {
    const essential = ALL_LINEAR_ACTIONS.filter((a) => a.priority === 1);
    expect(essential.length).toBeGreaterThan(0);
  });

  it('should include issue creation', () => {
    const create = ALL_LINEAR_ACTIONS.find((a) => a.name === 'LINEAR_CREATE_LINEAR_ISSUE');
    expect(create).toBeDefined();
    expect(create?.priority).toBe(1);
    expect(create?.writeOperation).toBe(true);
  });

  it('should mark destructive actions', () => {
    const destructive = ALL_LINEAR_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const d of destructive) {
      expect(d.priority).toBeGreaterThanOrEqual(2);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('getLinearFeaturedActionNames', () => {
  it('should return all action names', () => {
    const names = getLinearFeaturedActionNames();
    expect(names.length).toBe(ALL_LINEAR_ACTIONS.length);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should include LINEAR_CREATE_LINEAR_ISSUE', () => {
    expect(getLinearFeaturedActionNames()).toContain('LINEAR_CREATE_LINEAR_ISSUE');
  });
});

describe('getLinearActionsByPriority', () => {
  it('should return only actions at or below given priority', () => {
    const p2 = getLinearActionsByPriority(2);
    for (const a of p2) {
      expect(a.priority).toBeLessThanOrEqual(2);
    }
  });

  it('should return more actions at higher max priority', () => {
    const p1 = getLinearActionsByPriority(1);
    const p3 = getLinearActionsByPriority(3);
    expect(p3.length).toBeGreaterThanOrEqual(p1.length);
  });

  it('should default to maxPriority 3', () => {
    const defaultResult = getLinearActionsByPriority();
    const p3 = getLinearActionsByPriority(3);
    expect(defaultResult.length).toBe(p3.length);
  });
});

describe('getLinearActionNamesByPriority', () => {
  it('should return string array', () => {
    const names = getLinearActionNamesByPriority(2);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should match getLinearActionsByPriority length', () => {
    const actions = getLinearActionsByPriority(2);
    const names = getLinearActionNamesByPriority(2);
    expect(names.length).toBe(actions.length);
  });
});

describe('getLinearActionsByCategory', () => {
  it('should return issues category actions', () => {
    const issues = getLinearActionsByCategory('issues');
    expect(issues.length).toBeGreaterThan(0);
    for (const a of issues) {
      expect(a.category).toBe('issues');
    }
  });

  it('should return projects category actions', () => {
    const projects = getLinearActionsByCategory('projects');
    expect(projects.length).toBeGreaterThan(0);
    for (const a of projects) {
      expect(a.category).toBe('projects');
    }
  });

  it('should return cycles category actions', () => {
    const cycles = getLinearActionsByCategory('cycles');
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should return teams category actions', () => {
    const teams = getLinearActionsByCategory('teams');
    expect(teams.length).toBeGreaterThan(0);
  });
});

describe('getLinearActionPriority', () => {
  it('should return priority for known action', () => {
    expect(getLinearActionPriority('LINEAR_CREATE_LINEAR_ISSUE')).toBe(1);
  });

  it('should handle composio_ prefix', () => {
    expect(getLinearActionPriority('composio_LINEAR_CREATE_LINEAR_ISSUE')).toBe(1);
  });

  it('should return 99 for unknown action', () => {
    expect(getLinearActionPriority('UNKNOWN_ACTION')).toBe(99);
  });
});

describe('isKnownLinearAction', () => {
  it('should return true for known action', () => {
    expect(isKnownLinearAction('LINEAR_CREATE_LINEAR_ISSUE')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isKnownLinearAction('composio_LINEAR_CREATE_LINEAR_ISSUE')).toBe(true);
  });

  it('should return false for unknown action', () => {
    expect(isKnownLinearAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('isDestructiveLinearAction', () => {
  it('should return true for destructive actions', () => {
    expect(isDestructiveLinearAction('LINEAR_DELETE_LINEAR_PROJECT')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isDestructiveLinearAction('composio_LINEAR_DELETE_LINEAR_PROJECT')).toBe(true);
  });

  it('should return false for non-destructive action', () => {
    expect(isDestructiveLinearAction('LINEAR_CREATE_LINEAR_ISSUE')).toBe(false);
  });

  it('should return false for unknown action', () => {
    expect(isDestructiveLinearAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('sortByLinearPriority', () => {
  it('should sort tools by priority ascending', () => {
    const tools = [
      { name: 'LINEAR_DELETE_LINEAR_PROJECT' }, // priority 4
      { name: 'LINEAR_CREATE_LINEAR_ISSUE' }, // priority 1
      { name: 'LINEAR_CREATE_LINEAR_PROJECT' }, // priority 2
    ];
    const sorted = sortByLinearPriority(tools);
    expect(sorted[0].name).toBe('LINEAR_CREATE_LINEAR_ISSUE');
    expect(sorted[2].name).toBe('LINEAR_DELETE_LINEAR_PROJECT');
  });

  it('should place unknown actions last', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'LINEAR_CREATE_LINEAR_ISSUE' }];
    const sorted = sortByLinearPriority(tools);
    expect(sorted[0].name).toBe('LINEAR_CREATE_LINEAR_ISSUE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });

  it('should not mutate original array', () => {
    const tools = [
      { name: 'LINEAR_DELETE_LINEAR_PROJECT' },
      { name: 'LINEAR_CREATE_LINEAR_ISSUE' },
    ];
    const original = [...tools];
    sortByLinearPriority(tools);
    expect(tools).toEqual(original);
  });
});

describe('getLinearActionStats', () => {
  it('should return total count', () => {
    const stats = getLinearActionStats();
    expect(stats.total).toBe(ALL_LINEAR_ACTIONS.length);
  });

  it('should have byPriority breakdown', () => {
    const stats = getLinearActionStats();
    expect(stats.byPriority[1]).toBeGreaterThan(0);
    expect(stats.byPriority[2]).toBeGreaterThan(0);
    expect(stats.byPriority[3]).toBeGreaterThan(0);
    expect(stats.byPriority[4]).toBeGreaterThan(0);
  });

  it('should have byCategory breakdown', () => {
    const stats = getLinearActionStats();
    expect(stats.byCategory['issues']).toBeGreaterThan(0);
    expect(stats.byCategory['projects']).toBeGreaterThan(0);
  });

  it('should sum priorities to total', () => {
    const stats = getLinearActionStats();
    const sum = Object.values(stats.byPriority).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });

  it('should sum categories to total', () => {
    const stats = getLinearActionStats();
    const sum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });
});

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

describe('getLinearSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = getLinearSystemPrompt();
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should mention Linear', () => {
    expect(getLinearSystemPrompt()).toContain('Linear');
  });

  it('should mention safety rules', () => {
    expect(getLinearSystemPrompt()).toContain('Safety Rules');
  });

  it('should mention composio tools', () => {
    expect(getLinearSystemPrompt()).toContain('composio_LINEAR_');
  });
});

describe('getLinearCapabilitySummary', () => {
  it('should return a non-empty string', () => {
    expect(getLinearCapabilitySummary().length).toBeGreaterThan(0);
  });

  it('should include action count', () => {
    const stats = getLinearActionStats();
    expect(getLinearCapabilitySummary()).toContain(`${stats.total}`);
  });
});

describe('logLinearToolkitStats', () => {
  it('should be a function', () => {
    expect(typeof logLinearToolkitStats).toBe('function');
  });

  it('should not throw', () => {
    expect(() => logLinearToolkitStats()).not.toThrow();
  });
});
