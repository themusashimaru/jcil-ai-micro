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
  type GitHubActionCategory,
  type GitHubAction,
  ALL_GITHUB_ACTIONS,
  getGitHubFeaturedActionNames,
  getGitHubActionsByPriority,
  getGitHubActionNamesByPriority,
  getGitHubActionsByCategory,
  getGitHubActionPriority,
  isKnownGitHubAction,
  isDestructiveGitHubAction,
  sortByGitHubPriority,
  getGitHubActionStats,
  getGitHubSystemPrompt,
  getGitHubCapabilitySummary,
  logGitHubToolkitStats,
} from './github-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GitHubToolkit type exports', () => {
  it('should export GitHubActionCategory type with all valid values', () => {
    const categories: GitHubActionCategory[] = [
      'repository',
      'issues',
      'pull_requests',
      'code',
      'actions',
      'releases',
      'organizations',
      'search',
      'gists',
    ];
    expect(categories).toHaveLength(9);
    categories.forEach((cat) => {
      expect(typeof cat).toBe('string');
    });
  });

  it('should export GitHubAction interface with required fields', () => {
    const action: GitHubAction = {
      name: 'GITHUB_CREATE_ISSUE',
      label: 'Create Issue',
      category: 'issues',
      priority: 1,
    };
    expect(action.name).toBe('GITHUB_CREATE_ISSUE');
    expect(action.label).toBe('Create Issue');
    expect(action.category).toBe('issues');
    expect(action.priority).toBe(1);
  });

  it('should support optional writeOperation field', () => {
    const action: GitHubAction = {
      name: 'GITHUB_CREATE_ISSUE',
      label: 'Create Issue',
      category: 'issues',
      priority: 1,
      writeOperation: true,
    };
    expect(action.writeOperation).toBe(true);
  });

  it('should support optional destructive field', () => {
    const action: GitHubAction = {
      name: 'GITHUB_DELETE_REPOSITORY',
      label: 'Delete Repository',
      category: 'repository',
      priority: 4,
      writeOperation: true,
      destructive: true,
    };
    expect(action.destructive).toBe(true);
    expect(action.writeOperation).toBe(true);
  });

  it('should allow omitting optional fields', () => {
    const action: GitHubAction = {
      name: 'GITHUB_LIST_ISSUES',
      label: 'List Issues',
      category: 'issues',
      priority: 1,
    };
    expect(action.destructive).toBeUndefined();
    expect(action.writeOperation).toBeUndefined();
  });
});

// ============================================================================
// ALL_GITHUB_ACTIONS REGISTRY
// ============================================================================

describe('ALL_GITHUB_ACTIONS', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(ALL_GITHUB_ACTIONS)).toBe(true);
    expect(ALL_GITHUB_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should contain actions from all 4 priority levels', () => {
    const priorities = new Set(ALL_GITHUB_ACTIONS.map((a) => a.priority));
    expect(priorities.has(1)).toBe(true);
    expect(priorities.has(2)).toBe(true);
    expect(priorities.has(3)).toBe(true);
    expect(priorities.has(4)).toBe(true);
  });

  it('should contain actions from all categories', () => {
    const categories = new Set(ALL_GITHUB_ACTIONS.map((a) => a.category));
    expect(categories.has('repository')).toBe(true);
    expect(categories.has('issues')).toBe(true);
    expect(categories.has('pull_requests')).toBe(true);
    expect(categories.has('code')).toBe(true);
    expect(categories.has('actions')).toBe(true);
    expect(categories.has('releases')).toBe(true);
    expect(categories.has('organizations')).toBe(true);
    expect(categories.has('search')).toBe(true);
    expect(categories.has('gists')).toBe(true);
  });

  it('should have unique action names', () => {
    const names = ALL_GITHUB_ACTIONS.map((a) => a.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('should have all names prefixed with GITHUB_', () => {
    ALL_GITHUB_ACTIONS.forEach((action) => {
      expect(action.name).toMatch(/^GITHUB_/);
    });
  });

  it('should have non-empty labels for all actions', () => {
    ALL_GITHUB_ACTIONS.forEach((action) => {
      expect(action.label.length).toBeGreaterThan(0);
    });
  });

  it('should have priorities only in range 1-4', () => {
    ALL_GITHUB_ACTIONS.forEach((action) => {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    });
  });

  it('should include essential actions like GITHUB_CREATE_ISSUE', () => {
    const names = ALL_GITHUB_ACTIONS.map((a) => a.name);
    expect(names).toContain('GITHUB_CREATE_ISSUE');
    expect(names).toContain('GITHUB_LIST_ISSUES');
    expect(names).toContain('GITHUB_CREATE_PULL_REQUEST');
    expect(names).toContain('GITHUB_GET_REPOSITORY');
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GITHUB_ACTIONS.filter((a) => a.destructive === true);
    expect(destructive.length).toBeGreaterThan(0);
    destructive.forEach((action) => {
      expect(action.writeOperation).toBe(true);
    });
  });

  it('should include specific known counts for priority levels', () => {
    const p1 = ALL_GITHUB_ACTIONS.filter((a) => a.priority === 1);
    const p2 = ALL_GITHUB_ACTIONS.filter((a) => a.priority === 2);
    const p3 = ALL_GITHUB_ACTIONS.filter((a) => a.priority === 3);
    const p4 = ALL_GITHUB_ACTIONS.filter((a) => a.priority === 4);
    // Each priority level should have actions
    expect(p1.length).toBeGreaterThan(0);
    expect(p2.length).toBeGreaterThan(0);
    expect(p3.length).toBeGreaterThan(0);
    expect(p4.length).toBeGreaterThan(0);
    // Sum should equal total
    expect(p1.length + p2.length + p3.length + p4.length).toBe(ALL_GITHUB_ACTIONS.length);
    // Priority 1 (essential) should be smallest set
    expect(p1.length).toBeLessThan(p3.length);
  });
});

// ============================================================================
// getGitHubFeaturedActionNames
// ============================================================================

describe('getGitHubFeaturedActionNames', () => {
  it('should return an array of strings', () => {
    const names = getGitHubFeaturedActionNames();
    expect(Array.isArray(names)).toBe(true);
    names.forEach((name) => {
      expect(typeof name).toBe('string');
    });
  });

  it('should return all action names', () => {
    const names = getGitHubFeaturedActionNames();
    expect(names.length).toBe(ALL_GITHUB_ACTIONS.length);
  });

  it('should match the names in ALL_GITHUB_ACTIONS', () => {
    const names = getGitHubFeaturedActionNames();
    const expected = ALL_GITHUB_ACTIONS.map((a) => a.name);
    expect(names).toEqual(expected);
  });

  it('should contain GITHUB_CREATE_ISSUE', () => {
    const names = getGitHubFeaturedActionNames();
    expect(names).toContain('GITHUB_CREATE_ISSUE');
  });
});

// ============================================================================
// getGitHubActionsByPriority
// ============================================================================

describe('getGitHubActionsByPriority', () => {
  it('should return only priority 1 actions when maxPriority is 1', () => {
    const actions = getGitHubActionsByPriority(1);
    actions.forEach((action) => {
      expect(action.priority).toBe(1);
    });
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should return priority 1 and 2 actions when maxPriority is 2', () => {
    const actions = getGitHubActionsByPriority(2);
    actions.forEach((action) => {
      expect(action.priority).toBeLessThanOrEqual(2);
    });
    expect(actions.length).toBeGreaterThan(getGitHubActionsByPriority(1).length);
  });

  it('should default to maxPriority 3', () => {
    const actions = getGitHubActionsByPriority();
    actions.forEach((action) => {
      expect(action.priority).toBeLessThanOrEqual(3);
    });
    const actionsExplicit = getGitHubActionsByPriority(3);
    expect(actions.length).toBe(actionsExplicit.length);
  });

  it('should return all actions when maxPriority is 4', () => {
    const actions = getGitHubActionsByPriority(4);
    expect(actions.length).toBe(ALL_GITHUB_ACTIONS.length);
  });

  it('should return empty array when maxPriority is 0', () => {
    const actions = getGitHubActionsByPriority(0);
    expect(actions.length).toBe(0);
  });

  it('should return GitHubAction objects', () => {
    const actions = getGitHubActionsByPriority(1);
    actions.forEach((action) => {
      expect(action).toHaveProperty('name');
      expect(action).toHaveProperty('label');
      expect(action).toHaveProperty('category');
      expect(action).toHaveProperty('priority');
    });
  });
});

// ============================================================================
// getGitHubActionNamesByPriority
// ============================================================================

describe('getGitHubActionNamesByPriority', () => {
  it('should return strings for priority 1', () => {
    const names = getGitHubActionNamesByPriority(1);
    names.forEach((name) => {
      expect(typeof name).toBe('string');
    });
  });

  it('should default to priority 3', () => {
    const names = getGitHubActionNamesByPriority();
    const namesExplicit = getGitHubActionNamesByPriority(3);
    expect(names).toEqual(namesExplicit);
  });

  it('should return names matching getGitHubActionsByPriority', () => {
    const actions = getGitHubActionsByPriority(2);
    const names = getGitHubActionNamesByPriority(2);
    expect(names).toEqual(actions.map((a) => a.name));
  });

  it('should return fewer names for lower priority', () => {
    const p1 = getGitHubActionNamesByPriority(1);
    const p2 = getGitHubActionNamesByPriority(2);
    const p3 = getGitHubActionNamesByPriority(3);
    expect(p1.length).toBeLessThan(p2.length);
    expect(p2.length).toBeLessThan(p3.length);
  });
});

// ============================================================================
// getGitHubActionsByCategory
// ============================================================================

describe('getGitHubActionsByCategory', () => {
  it('should return actions for the issues category', () => {
    const actions = getGitHubActionsByCategory('issues');
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((action) => {
      expect(action.category).toBe('issues');
    });
  });

  it('should return actions for the pull_requests category', () => {
    const actions = getGitHubActionsByCategory('pull_requests');
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((action) => {
      expect(action.category).toBe('pull_requests');
    });
  });

  it('should return actions for the repository category', () => {
    const actions = getGitHubActionsByCategory('repository');
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((action) => {
      expect(action.category).toBe('repository');
    });
  });

  it('should return actions for all categories', () => {
    const categories: GitHubActionCategory[] = [
      'repository',
      'issues',
      'pull_requests',
      'code',
      'actions',
      'releases',
      'organizations',
      'search',
      'gists',
    ];
    categories.forEach((cat) => {
      const actions = getGitHubActionsByCategory(cat);
      expect(actions.length).toBeGreaterThan(0);
    });
  });

  it('should return GitHubAction objects with correct category', () => {
    const actions = getGitHubActionsByCategory('code');
    actions.forEach((action) => {
      expect(action.category).toBe('code');
      expect(action).toHaveProperty('name');
      expect(action).toHaveProperty('label');
      expect(action).toHaveProperty('priority');
    });
  });
});

// ============================================================================
// getGitHubActionPriority
// ============================================================================

describe('getGitHubActionPriority', () => {
  it('should return correct priority for a known priority-1 action', () => {
    expect(getGitHubActionPriority('GITHUB_CREATE_ISSUE')).toBe(1);
  });

  it('should return correct priority for a priority-2 action', () => {
    expect(getGitHubActionPriority('GITHUB_ADD_LABELS_TO_ISSUE')).toBe(2);
  });

  it('should return correct priority for a priority-3 action', () => {
    expect(getGitHubActionPriority('GITHUB_LOCK_ISSUE')).toBe(3);
  });

  it('should return correct priority for a priority-4 action', () => {
    expect(getGitHubActionPriority('GITHUB_DELETE_REPOSITORY')).toBe(4);
  });

  it('should return 99 for an unknown action', () => {
    expect(getGitHubActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('should strip composio_ prefix before lookup', () => {
    expect(getGitHubActionPriority('composio_GITHUB_CREATE_ISSUE')).toBe(1);
  });

  it('should return 99 for empty string', () => {
    expect(getGitHubActionPriority('')).toBe(99);
  });
});

// ============================================================================
// isKnownGitHubAction
// ============================================================================

describe('isKnownGitHubAction', () => {
  it('should return true for a known action', () => {
    expect(isKnownGitHubAction('GITHUB_CREATE_ISSUE')).toBe(true);
  });

  it('should return false for an unknown action', () => {
    expect(isKnownGitHubAction('GITHUB_NONEXISTENT_ACTION')).toBe(false);
  });

  it('should handle composio_ prefix', () => {
    expect(isKnownGitHubAction('composio_GITHUB_CREATE_ISSUE')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isKnownGitHubAction('')).toBe(false);
  });

  it('should return true for all actions in ALL_GITHUB_ACTIONS', () => {
    ALL_GITHUB_ACTIONS.forEach((action) => {
      expect(isKnownGitHubAction(action.name)).toBe(true);
    });
  });

  it('should return true for all actions with composio_ prefix', () => {
    ALL_GITHUB_ACTIONS.forEach((action) => {
      expect(isKnownGitHubAction(`composio_${action.name}`)).toBe(true);
    });
  });
});

// ============================================================================
// isDestructiveGitHubAction
// ============================================================================

describe('isDestructiveGitHubAction', () => {
  it('should return true for DELETE_REPOSITORY', () => {
    expect(isDestructiveGitHubAction('GITHUB_DELETE_REPOSITORY')).toBe(true);
  });

  it('should return true for DELETE_BRANCH', () => {
    expect(isDestructiveGitHubAction('GITHUB_DELETE_BRANCH')).toBe(true);
  });

  it('should return true for DELETE_FILE', () => {
    expect(isDestructiveGitHubAction('GITHUB_DELETE_FILE')).toBe(true);
  });

  it('should return false for a non-destructive action', () => {
    expect(isDestructiveGitHubAction('GITHUB_CREATE_ISSUE')).toBe(false);
  });

  it('should return false for an unknown action', () => {
    expect(isDestructiveGitHubAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('should handle composio_ prefix', () => {
    expect(isDestructiveGitHubAction('composio_GITHUB_DELETE_REPOSITORY')).toBe(true);
  });

  it('should return false for write-only non-destructive actions', () => {
    expect(isDestructiveGitHubAction('GITHUB_CREATE_PULL_REQUEST')).toBe(false);
  });
});

// ============================================================================
// sortByGitHubPriority
// ============================================================================

describe('sortByGitHubPriority', () => {
  it('should sort tools by GitHub action priority ascending', () => {
    const tools = [
      { name: 'GITHUB_DELETE_REPOSITORY' }, // priority 4
      { name: 'GITHUB_CREATE_ISSUE' }, // priority 1
      { name: 'GITHUB_ADD_LABELS_TO_ISSUE' }, // priority 2
    ];
    const sorted = sortByGitHubPriority(tools);
    expect(sorted[0].name).toBe('GITHUB_CREATE_ISSUE');
    expect(sorted[1].name).toBe('GITHUB_ADD_LABELS_TO_ISSUE');
    expect(sorted[2].name).toBe('GITHUB_DELETE_REPOSITORY');
  });

  it('should place unknown actions last (priority 99)', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GITHUB_CREATE_ISSUE' }];
    const sorted = sortByGitHubPriority(tools);
    expect(sorted[0].name).toBe('GITHUB_CREATE_ISSUE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });

  it('should not modify the original array', () => {
    const tools = [{ name: 'GITHUB_DELETE_REPOSITORY' }, { name: 'GITHUB_CREATE_ISSUE' }];
    const original = [...tools];
    sortByGitHubPriority(tools);
    expect(tools).toEqual(original);
  });

  it('should handle empty array', () => {
    const sorted = sortByGitHubPriority([]);
    expect(sorted).toEqual([]);
  });

  it('should handle single element', () => {
    const tools = [{ name: 'GITHUB_CREATE_ISSUE' }];
    const sorted = sortByGitHubPriority(tools);
    expect(sorted).toEqual([{ name: 'GITHUB_CREATE_ISSUE' }]);
  });

  it('should preserve extra properties on objects', () => {
    const tools = [
      { name: 'GITHUB_DELETE_REPOSITORY', extra: 'data1' },
      { name: 'GITHUB_CREATE_ISSUE', extra: 'data2' },
    ];
    const sorted = sortByGitHubPriority(tools);
    expect(sorted[0].extra).toBe('data2');
    expect(sorted[1].extra).toBe('data1');
  });

  it('should maintain relative order for actions with same priority', () => {
    const tools = [
      { name: 'GITHUB_LIST_ISSUES' }, // priority 1
      { name: 'GITHUB_CREATE_ISSUE' }, // priority 1
    ];
    const sorted = sortByGitHubPriority(tools);
    // Both priority 1, original order should be maintained (stable sort)
    expect(sorted[0].name).toBe('GITHUB_LIST_ISSUES');
    expect(sorted[1].name).toBe('GITHUB_CREATE_ISSUE');
  });
});

// ============================================================================
// getGitHubActionStats
// ============================================================================

describe('getGitHubActionStats', () => {
  it('should return total count matching ALL_GITHUB_ACTIONS', () => {
    const stats = getGitHubActionStats();
    expect(stats.total).toBe(ALL_GITHUB_ACTIONS.length);
  });

  it('should have byPriority with keys 1 through 4', () => {
    const stats = getGitHubActionStats();
    expect(stats.byPriority[1]).toBeGreaterThan(0);
    expect(stats.byPriority[2]).toBeGreaterThan(0);
    expect(stats.byPriority[3]).toBeGreaterThan(0);
    expect(stats.byPriority[4]).toBeGreaterThan(0);
  });

  it('should have byCategory with all 9 categories', () => {
    const stats = getGitHubActionStats();
    const categories: GitHubActionCategory[] = [
      'repository',
      'issues',
      'pull_requests',
      'code',
      'actions',
      'releases',
      'organizations',
      'search',
      'gists',
    ];
    categories.forEach((cat) => {
      expect(stats.byCategory[cat]).toBeGreaterThan(0);
    });
  });

  it('should have priority counts that sum to total', () => {
    const stats = getGitHubActionStats();
    const prioritySum = Object.values(stats.byPriority).reduce((a, b) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
  });

  it('should have category counts that sum to total', () => {
    const stats = getGitHubActionStats();
    const categorySum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('should return correct structure shape', () => {
    const stats = getGitHubActionStats();
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('byPriority');
    expect(stats).toHaveProperty('byCategory');
    expect(typeof stats.total).toBe('number');
    expect(typeof stats.byPriority).toBe('object');
    expect(typeof stats.byCategory).toBe('object');
  });
});

// ============================================================================
// getGitHubSystemPrompt
// ============================================================================

describe('getGitHubSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = getGitHubSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should mention GitHub Integration', () => {
    const prompt = getGitHubSystemPrompt();
    expect(prompt).toContain('GitHub Integration');
  });

  it('should mention composio_GITHUB_ tool prefix', () => {
    const prompt = getGitHubSystemPrompt();
    expect(prompt).toContain('composio_GITHUB_');
  });

  it('should mention Repository Management', () => {
    const prompt = getGitHubSystemPrompt();
    expect(prompt).toContain('Repository Management');
  });

  it('should mention Pull Requests', () => {
    const prompt = getGitHubSystemPrompt();
    expect(prompt).toContain('Pull Requests');
  });

  it('should mention Safety Rules', () => {
    const prompt = getGitHubSystemPrompt();
    expect(prompt).toContain('Safety Rules');
  });

  it('should mention destructive operations confirmation', () => {
    const prompt = getGitHubSystemPrompt();
    expect(prompt).toContain('destructive operations');
  });

  it('should include action-preview format', () => {
    const prompt = getGitHubSystemPrompt();
    expect(prompt).toContain('action-preview');
  });

  it('should mention Issues, Code, Actions, Releases, Organizations, Search sections', () => {
    const prompt = getGitHubSystemPrompt();
    expect(prompt).toContain('Issues');
    expect(prompt).toContain('Code & Commits');
    expect(prompt).toContain('GitHub Actions');
    expect(prompt).toContain('Releases & Deployments');
    expect(prompt).toContain('Organizations & Teams');
    expect(prompt).toContain('Search & Discovery');
  });
});

// ============================================================================
// getGitHubCapabilitySummary
// ============================================================================

describe('getGitHubCapabilitySummary', () => {
  it('should return a non-empty string', () => {
    const summary = getGitHubCapabilitySummary();
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('should include GitHub keyword', () => {
    const summary = getGitHubCapabilitySummary();
    expect(summary).toContain('GitHub');
  });

  it('should include action count', () => {
    const stats = getGitHubActionStats();
    const summary = getGitHubCapabilitySummary();
    expect(summary).toContain(String(stats.total));
  });

  it('should mention key capability areas', () => {
    const summary = getGitHubCapabilitySummary();
    expect(summary).toContain('repos');
    expect(summary).toContain('issues');
    expect(summary).toContain('PRs');
  });
});

// ============================================================================
// logGitHubToolkitStats
// ============================================================================

describe('logGitHubToolkitStats', () => {
  it('should not throw when called', () => {
    expect(() => logGitHubToolkitStats()).not.toThrow();
  });

  it('should return void', () => {
    const result = logGitHubToolkitStats();
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// EDGE CASES & INTEGRATION
// ============================================================================

describe('Edge cases and integration', () => {
  it('should handle getGitHubActionPriority with partial GITHUB_ prefix', () => {
    // Not a real action, should return 99
    expect(getGitHubActionPriority('GITHUB_')).toBe(99);
  });

  it('should handle composio_ prefix stripping correctly', () => {
    // composio_GITHUB_CREATE_ISSUE -> GITHUB_CREATE_ISSUE
    expect(isKnownGitHubAction('composio_GITHUB_CREATE_ISSUE')).toBe(true);
    // composio_ prefix that results in an unknown action
    expect(isKnownGitHubAction('composio_UNKNOWN')).toBe(false);
  });

  it('should not have double composio_ prefix handling', () => {
    // composio_composio_GITHUB_CREATE_ISSUE should NOT be found
    // because only one composio_ is stripped
    expect(isKnownGitHubAction('composio_composio_GITHUB_CREATE_ISSUE')).toBe(false);
  });

  it('all destructive actions should also be write operations', () => {
    const destructiveActions = ALL_GITHUB_ACTIONS.filter((a) => a.destructive === true);
    destructiveActions.forEach((action) => {
      expect(action.writeOperation).toBe(true);
    });
  });

  it('should have specific destructive actions', () => {
    const destructiveNames = ALL_GITHUB_ACTIONS.filter((a) => a.destructive).map((a) => a.name);
    expect(destructiveNames).toContain('GITHUB_DELETE_REPOSITORY');
    expect(destructiveNames).toContain('GITHUB_DELETE_BRANCH');
    expect(destructiveNames).toContain('GITHUB_DELETE_FILE');
    expect(destructiveNames).toContain('GITHUB_TRANSFER_REPOSITORY');
    expect(destructiveNames).toContain('GITHUB_DELETE_RELEASE');
    expect(destructiveNames).toContain('GITHUB_DELETE_ISSUE_COMMENT');
    expect(destructiveNames).toContain('GITHUB_REMOVE_COLLABORATOR');
    expect(destructiveNames).toContain('GITHUB_REMOVE_TEAM_MEMBER');
    expect(destructiveNames).toContain('GITHUB_DELETE_GIST');
  });

  it('getGitHubActionsByPriority with negative number returns empty', () => {
    const actions = getGitHubActionsByPriority(-1);
    expect(actions.length).toBe(0);
  });

  it('getGitHubActionsByPriority with very large number returns all', () => {
    const actions = getGitHubActionsByPriority(100);
    expect(actions.length).toBe(ALL_GITHUB_ACTIONS.length);
  });

  it('sortByGitHubPriority is generic and works with extended interfaces', () => {
    interface ExtendedTool {
      name: string;
      description: string;
      enabled: boolean;
    }
    const tools: ExtendedTool[] = [
      { name: 'GITHUB_DELETE_REPOSITORY', description: 'Delete', enabled: true },
      { name: 'GITHUB_CREATE_ISSUE', description: 'Create', enabled: false },
    ];
    const sorted = sortByGitHubPriority(tools);
    expect(sorted[0].description).toBe('Create');
    expect(sorted[0].enabled).toBe(false);
    expect(sorted[1].description).toBe('Delete');
    expect(sorted[1].enabled).toBe(true);
  });
});
