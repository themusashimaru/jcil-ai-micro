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
  type JiraActionCategory,
  type JiraAction,
  ALL_JIRA_ACTIONS,
  getJiraFeaturedActionNames,
  getJiraActionsByPriority,
  getJiraActionNamesByPriority,
  getJiraActionsByCategory,
  getJiraActionPriority,
  isKnownJiraAction,
  isDestructiveJiraAction,
  sortByJiraPriority,
  getJiraActionStats,
  getJiraSystemPrompt,
  getJiraCapabilitySummary,
  logJiraToolkitStats,
} from './jira-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('JiraToolkit type exports', () => {
  it('should export JiraActionCategory type', () => {
    const cat: JiraActionCategory = 'issues';
    expect([
      'issues',
      'projects',
      'comments',
      'sprints',
      'boards',
      'users',
      'labels',
      'attachments',
    ]).toContain(cat);
  });

  it('should export JiraAction interface', () => {
    const action: JiraAction = {
      name: 'JIRA_CREATE_ISSUE',
      label: 'Create Issue',
      category: 'issues',
      priority: 1,
      writeOperation: true,
    };
    expect(action.priority).toBe(1);
    expect(action.writeOperation).toBe(true);
  });

  it('should support optional destructive field', () => {
    const action: JiraAction = {
      name: 'JIRA_DELETE_ISSUE',
      label: 'Delete Issue',
      category: 'issues',
      priority: 4,
      writeOperation: true,
      destructive: true,
    };
    expect(action.destructive).toBe(true);
  });
});

// ============================================================================
// ALL_JIRA_ACTIONS REGISTRY
// ============================================================================

describe('ALL_JIRA_ACTIONS', () => {
  it('should be a non-empty array', () => {
    expect(ALL_JIRA_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have actions with valid priorities 1-4', () => {
    for (const action of ALL_JIRA_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have actions with valid categories', () => {
    const validCategories = [
      'issues',
      'projects',
      'comments',
      'sprints',
      'boards',
      'users',
      'labels',
      'attachments',
    ];
    for (const action of ALL_JIRA_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have unique action names', () => {
    const names = ALL_JIRA_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have essential (priority 1) actions', () => {
    const essential = ALL_JIRA_ACTIONS.filter((a) => a.priority === 1);
    expect(essential.length).toBeGreaterThan(0);
  });

  it('should include issue creation', () => {
    const create = ALL_JIRA_ACTIONS.find((a) => a.name === 'JIRA_CREATE_ISSUE');
    expect(create).toBeDefined();
    expect(create?.priority).toBe(1);
    expect(create?.writeOperation).toBe(true);
  });

  it('should mark destructive actions', () => {
    const destructive = ALL_JIRA_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const d of destructive) {
      expect(d.priority).toBe(4);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('getJiraFeaturedActionNames', () => {
  it('should return all action names', () => {
    const names = getJiraFeaturedActionNames();
    expect(names.length).toBe(ALL_JIRA_ACTIONS.length);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should include JIRA_CREATE_ISSUE', () => {
    expect(getJiraFeaturedActionNames()).toContain('JIRA_CREATE_ISSUE');
  });
});

describe('getJiraActionsByPriority', () => {
  it('should return only actions at or below given priority', () => {
    const p2 = getJiraActionsByPriority(2);
    for (const a of p2) {
      expect(a.priority).toBeLessThanOrEqual(2);
    }
  });

  it('should return more actions at higher max priority', () => {
    const p1 = getJiraActionsByPriority(1);
    const p3 = getJiraActionsByPriority(3);
    expect(p3.length).toBeGreaterThanOrEqual(p1.length);
  });

  it('should default to maxPriority 3', () => {
    const defaultResult = getJiraActionsByPriority();
    const p3 = getJiraActionsByPriority(3);
    expect(defaultResult.length).toBe(p3.length);
  });
});

describe('getJiraActionNamesByPriority', () => {
  it('should return string array', () => {
    const names = getJiraActionNamesByPriority(2);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should match getJiraActionsByPriority length', () => {
    const actions = getJiraActionsByPriority(2);
    const names = getJiraActionNamesByPriority(2);
    expect(names.length).toBe(actions.length);
  });
});

describe('getJiraActionsByCategory', () => {
  it('should return issues category actions', () => {
    const issues = getJiraActionsByCategory('issues');
    expect(issues.length).toBeGreaterThan(0);
    for (const a of issues) {
      expect(a.category).toBe('issues');
    }
  });

  it('should return projects category actions', () => {
    const projects = getJiraActionsByCategory('projects');
    expect(projects.length).toBeGreaterThan(0);
    for (const a of projects) {
      expect(a.category).toBe('projects');
    }
  });

  it('should return comments category actions', () => {
    const comments = getJiraActionsByCategory('comments');
    expect(comments.length).toBeGreaterThan(0);
  });

  it('should return sprints category actions', () => {
    const sprints = getJiraActionsByCategory('sprints');
    expect(sprints.length).toBeGreaterThan(0);
  });
});

describe('getJiraActionPriority', () => {
  it('should return priority for known action', () => {
    expect(getJiraActionPriority('JIRA_CREATE_ISSUE')).toBe(1);
  });

  it('should handle composio_ prefix', () => {
    expect(getJiraActionPriority('composio_JIRA_CREATE_ISSUE')).toBe(1);
  });

  it('should return 99 for unknown action', () => {
    expect(getJiraActionPriority('UNKNOWN_ACTION')).toBe(99);
  });
});

describe('isKnownJiraAction', () => {
  it('should return true for known action', () => {
    expect(isKnownJiraAction('JIRA_CREATE_ISSUE')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isKnownJiraAction('composio_JIRA_CREATE_ISSUE')).toBe(true);
  });

  it('should return false for unknown action', () => {
    expect(isKnownJiraAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('isDestructiveJiraAction', () => {
  it('should return true for destructive actions', () => {
    expect(isDestructiveJiraAction('JIRA_DELETE_ISSUE')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isDestructiveJiraAction('composio_JIRA_DELETE_ISSUE')).toBe(true);
  });

  it('should return false for non-destructive action', () => {
    expect(isDestructiveJiraAction('JIRA_CREATE_ISSUE')).toBe(false);
  });

  it('should return false for unknown action', () => {
    expect(isDestructiveJiraAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('sortByJiraPriority', () => {
  it('should sort tools by priority ascending', () => {
    const tools = [
      { name: 'JIRA_DELETE_ISSUE' }, // priority 4
      { name: 'JIRA_CREATE_ISSUE' }, // priority 1
      { name: 'JIRA_GET_PROJECT' }, // priority 2
    ];
    const sorted = sortByJiraPriority(tools);
    expect(sorted[0].name).toBe('JIRA_CREATE_ISSUE');
    expect(sorted[2].name).toBe('JIRA_DELETE_ISSUE');
  });

  it('should place unknown actions last', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'JIRA_CREATE_ISSUE' }];
    const sorted = sortByJiraPriority(tools);
    expect(sorted[0].name).toBe('JIRA_CREATE_ISSUE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });

  it('should not mutate original array', () => {
    const tools = [{ name: 'JIRA_DELETE_ISSUE' }, { name: 'JIRA_CREATE_ISSUE' }];
    const original = [...tools];
    sortByJiraPriority(tools);
    expect(tools).toEqual(original);
  });
});

describe('getJiraActionStats', () => {
  it('should return total count', () => {
    const stats = getJiraActionStats();
    expect(stats.total).toBe(ALL_JIRA_ACTIONS.length);
  });

  it('should have byPriority breakdown', () => {
    const stats = getJiraActionStats();
    expect(stats.byPriority[1]).toBeGreaterThan(0);
    expect(stats.byPriority[2]).toBeGreaterThan(0);
    expect(stats.byPriority[3]).toBeGreaterThan(0);
    expect(stats.byPriority[4]).toBeGreaterThan(0);
  });

  it('should have byCategory breakdown', () => {
    const stats = getJiraActionStats();
    expect(stats.byCategory['issues']).toBeGreaterThan(0);
    expect(stats.byCategory['projects']).toBeGreaterThan(0);
  });

  it('should sum priorities to total', () => {
    const stats = getJiraActionStats();
    const sum = Object.values(stats.byPriority).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });

  it('should sum categories to total', () => {
    const stats = getJiraActionStats();
    const sum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });
});

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

describe('getJiraSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = getJiraSystemPrompt();
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should mention Jira', () => {
    expect(getJiraSystemPrompt()).toContain('Jira');
  });

  it('should mention safety rules', () => {
    expect(getJiraSystemPrompt()).toContain('Safety Rules');
  });

  it('should mention composio tools', () => {
    expect(getJiraSystemPrompt()).toContain('composio_JIRA_');
  });
});

describe('getJiraCapabilitySummary', () => {
  it('should return a non-empty string', () => {
    expect(getJiraCapabilitySummary().length).toBeGreaterThan(0);
  });

  it('should include action count', () => {
    const stats = getJiraActionStats();
    expect(getJiraCapabilitySummary()).toContain(`${stats.total}`);
  });
});

describe('logJiraToolkitStats', () => {
  it('should be a function', () => {
    expect(typeof logJiraToolkitStats).toBe('function');
  });

  it('should not throw', () => {
    expect(() => logJiraToolkitStats()).not.toThrow();
  });
});
