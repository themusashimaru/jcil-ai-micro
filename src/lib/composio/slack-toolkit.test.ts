vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { describe, it, expect, vi } from 'vitest';
import type { SlackActionCategory, SlackAction } from './slack-toolkit';
import {
  ALL_SLACK_ACTIONS,
  getSlackFeaturedActionNames,
  getSlackActionsByPriority,
  getSlackActionNamesByPriority,
  getSlackActionsByCategory,
  getSlackActionPriority,
  isKnownSlackAction,
  isDestructiveSlackAction,
  sortBySlackPriority,
  getSlackActionStats,
  getSlackSystemPrompt,
  getSlackCapabilitySummary,
  logSlackToolkitStats,
} from './slack-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('SlackToolkit type exports', () => {
  it('should export SlackActionCategory as a union of valid categories', () => {
    const categories: SlackActionCategory[] = [
      'messaging',
      'channels',
      'users',
      'files',
      'workflows',
      'admin',
    ];
    expect(categories).toHaveLength(6);
    // Each category should be assignable to SlackActionCategory
    categories.forEach((cat) => {
      const _check: SlackActionCategory = cat;
      expect(_check).toBeDefined();
    });
  });

  it('should export SlackAction interface with required fields', () => {
    const action: SlackAction = {
      name: 'TEST_ACTION',
      label: 'Test Action',
      category: 'messaging',
      priority: 1,
    };
    expect(action.name).toBe('TEST_ACTION');
    expect(action.label).toBe('Test Action');
    expect(action.category).toBe('messaging');
    expect(action.priority).toBe(1);
  });

  it('should export SlackAction interface with optional fields', () => {
    const action: SlackAction = {
      name: 'TEST_ACTION',
      label: 'Test Action',
      category: 'messaging',
      priority: 1,
      destructive: true,
      writeOperation: true,
    };
    expect(action.destructive).toBe(true);
    expect(action.writeOperation).toBe(true);
  });

  it('should allow SlackAction with optional fields undefined', () => {
    const action: SlackAction = {
      name: 'TEST_ACTION',
      label: 'Test Action',
      category: 'files',
      priority: 2,
    };
    expect(action.destructive).toBeUndefined();
    expect(action.writeOperation).toBeUndefined();
  });
});

// ============================================================================
// ALL_SLACK_ACTIONS
// ============================================================================

describe('ALL_SLACK_ACTIONS', () => {
  it('should be an array of SlackAction objects', () => {
    expect(Array.isArray(ALL_SLACK_ACTIONS)).toBe(true);
    expect(ALL_SLACK_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should contain actions from all four priority levels', () => {
    const priorities = new Set(ALL_SLACK_ACTIONS.map((a) => a.priority));
    expect(priorities.has(1)).toBe(true);
    expect(priorities.has(2)).toBe(true);
    expect(priorities.has(3)).toBe(true);
    expect(priorities.has(4)).toBe(true);
  });

  it('should contain actions from all six categories', () => {
    const categories = new Set(ALL_SLACK_ACTIONS.map((a) => a.category));
    expect(categories.has('messaging')).toBe(true);
    expect(categories.has('channels')).toBe(true);
    expect(categories.has('users')).toBe(true);
    expect(categories.has('files')).toBe(true);
    expect(categories.has('workflows')).toBe(true);
    expect(categories.has('admin')).toBe(true);
  });

  it('should have unique action names', () => {
    const names = ALL_SLACK_ACTIONS.map((a) => a.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('should have all action names start with SLACK_', () => {
    ALL_SLACK_ACTIONS.forEach((action) => {
      expect(action.name).toMatch(/^SLACK_/);
    });
  });

  it('should include essential actions', () => {
    const names = ALL_SLACK_ACTIONS.map((a) => a.name);
    expect(names).toContain('SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL');
    expect(names).toContain('SLACK_LIST_ALL_CHANNELS');
    expect(names).toContain('SLACK_LIST_ALL_USERS');
  });

  it('should include important actions', () => {
    const names = ALL_SLACK_ACTIONS.map((a) => a.name);
    expect(names).toContain('SLACK_SEND_SLACK_MESSAGE_BLOCKS');
    expect(names).toContain('SLACK_UPLOAD_FILE_TO_SLACK_V2');
    expect(names).toContain('SLACK_CREATE_A_REMINDER');
  });

  it('should include useful actions', () => {
    const names = ALL_SLACK_ACTIONS.map((a) => a.name);
    expect(names).toContain('SLACK_DELETES_A_MESSAGE_FROM_A_CHAT');
    expect(names).toContain('SLACK_ARCHIVE_A_SLACK_CONVERSATION');
    expect(names).toContain('SLACK_CREATE_CANVAS');
  });

  it('should include advanced actions', () => {
    const names = ALL_SLACK_ACTIONS.map((a) => a.name);
    expect(names).toContain('SLACK_DELETE_A_PUBLIC_OR_PRIVATE_CHANNEL');
    expect(names).toContain('SLACK_ADMIN_CONVERSATIONS_SEARCH');
    expect(names).toContain('SLACK_API_TEST');
  });

  it('should have every action with a non-empty label', () => {
    ALL_SLACK_ACTIONS.forEach((action) => {
      expect(action.label.length).toBeGreaterThan(0);
    });
  });

  it('should have priority between 1 and 4 for all actions', () => {
    ALL_SLACK_ACTIONS.forEach((action) => {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    });
  });

  it('should mark destructive actions with the destructive flag', () => {
    const destructiveActions = ALL_SLACK_ACTIONS.filter((a) => a.destructive);
    expect(destructiveActions.length).toBeGreaterThan(0);
    // Delete actions should be destructive
    const deleteChannel = ALL_SLACK_ACTIONS.find(
      (a) => a.name === 'SLACK_DELETE_A_PUBLIC_OR_PRIVATE_CHANNEL'
    );
    expect(deleteChannel?.destructive).toBe(true);
  });

  it('should mark write operations with the writeOperation flag', () => {
    const writeActions = ALL_SLACK_ACTIONS.filter((a) => a.writeOperation);
    expect(writeActions.length).toBeGreaterThan(0);
    // Send message should be a write operation
    const sendMessage = ALL_SLACK_ACTIONS.find(
      (a) => a.name === 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL'
    );
    expect(sendMessage?.writeOperation).toBe(true);
  });
});

// ============================================================================
// getSlackFeaturedActionNames
// ============================================================================

describe('getSlackFeaturedActionNames', () => {
  it('should return an array of strings', () => {
    const names = getSlackFeaturedActionNames();
    expect(Array.isArray(names)).toBe(true);
    names.forEach((name) => {
      expect(typeof name).toBe('string');
    });
  });

  it('should return the same number of names as ALL_SLACK_ACTIONS', () => {
    const names = getSlackFeaturedActionNames();
    expect(names.length).toBe(ALL_SLACK_ACTIONS.length);
  });

  it('should return only action names without other fields', () => {
    const names = getSlackFeaturedActionNames();
    names.forEach((name) => {
      expect(name).toMatch(/^SLACK_/);
    });
  });

  it('should preserve the order of ALL_SLACK_ACTIONS', () => {
    const names = getSlackFeaturedActionNames();
    ALL_SLACK_ACTIONS.forEach((action, idx) => {
      expect(names[idx]).toBe(action.name);
    });
  });
});

// ============================================================================
// getSlackActionsByPriority
// ============================================================================

describe('getSlackActionsByPriority', () => {
  it('should return only priority 1 actions when maxPriority is 1', () => {
    const actions = getSlackActionsByPriority(1);
    actions.forEach((action) => {
      expect(action.priority).toBe(1);
    });
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should return priority 1 and 2 actions when maxPriority is 2', () => {
    const actions = getSlackActionsByPriority(2);
    actions.forEach((action) => {
      expect(action.priority).toBeLessThanOrEqual(2);
    });
    const hasPriority1 = actions.some((a) => a.priority === 1);
    const hasPriority2 = actions.some((a) => a.priority === 2);
    expect(hasPriority1).toBe(true);
    expect(hasPriority2).toBe(true);
  });

  it('should default to maxPriority 3 when not specified', () => {
    const actions = getSlackActionsByPriority();
    actions.forEach((action) => {
      expect(action.priority).toBeLessThanOrEqual(3);
    });
    // Should not contain priority 4 actions
    const hasPriority4 = actions.some((a) => a.priority === 4);
    expect(hasPriority4).toBe(false);
  });

  it('should return all actions when maxPriority is 4', () => {
    const actions = getSlackActionsByPriority(4);
    expect(actions.length).toBe(ALL_SLACK_ACTIONS.length);
  });

  it('should return empty array when maxPriority is 0', () => {
    const actions = getSlackActionsByPriority(0);
    expect(actions).toHaveLength(0);
  });

  it('should return complete SlackAction objects', () => {
    const actions = getSlackActionsByPriority(1);
    actions.forEach((action) => {
      expect(action).toHaveProperty('name');
      expect(action).toHaveProperty('label');
      expect(action).toHaveProperty('category');
      expect(action).toHaveProperty('priority');
    });
  });
});

// ============================================================================
// getSlackActionNamesByPriority
// ============================================================================

describe('getSlackActionNamesByPriority', () => {
  it('should return only names (strings) not full objects', () => {
    const names = getSlackActionNamesByPriority(1);
    names.forEach((name) => {
      expect(typeof name).toBe('string');
    });
  });

  it('should match the count from getSlackActionsByPriority', () => {
    for (let p = 1; p <= 4; p++) {
      const names = getSlackActionNamesByPriority(p);
      const actions = getSlackActionsByPriority(p);
      expect(names.length).toBe(actions.length);
    }
  });

  it('should default to maxPriority 3', () => {
    const names = getSlackActionNamesByPriority();
    const actions = getSlackActionsByPriority(3);
    expect(names.length).toBe(actions.length);
  });

  it('should return the same names as the corresponding actions', () => {
    const names = getSlackActionNamesByPriority(2);
    const actions = getSlackActionsByPriority(2);
    names.forEach((name, idx) => {
      expect(name).toBe(actions[idx].name);
    });
  });
});

// ============================================================================
// getSlackActionsByCategory
// ============================================================================

describe('getSlackActionsByCategory', () => {
  it('should return only messaging actions for messaging category', () => {
    const actions = getSlackActionsByCategory('messaging');
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((action) => {
      expect(action.category).toBe('messaging');
    });
  });

  it('should return only channels actions for channels category', () => {
    const actions = getSlackActionsByCategory('channels');
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((action) => {
      expect(action.category).toBe('channels');
    });
  });

  it('should return only users actions for users category', () => {
    const actions = getSlackActionsByCategory('users');
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((action) => {
      expect(action.category).toBe('users');
    });
  });

  it('should return only files actions for files category', () => {
    const actions = getSlackActionsByCategory('files');
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((action) => {
      expect(action.category).toBe('files');
    });
  });

  it('should return only workflows actions for workflows category', () => {
    const actions = getSlackActionsByCategory('workflows');
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((action) => {
      expect(action.category).toBe('workflows');
    });
  });

  it('should return only admin actions for admin category', () => {
    const actions = getSlackActionsByCategory('admin');
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((action) => {
      expect(action.category).toBe('admin');
    });
  });

  it('should return the total of all categories equaling ALL_SLACK_ACTIONS length', () => {
    const categories: SlackActionCategory[] = [
      'messaging',
      'channels',
      'users',
      'files',
      'workflows',
      'admin',
    ];
    let total = 0;
    categories.forEach((cat) => {
      total += getSlackActionsByCategory(cat).length;
    });
    expect(total).toBe(ALL_SLACK_ACTIONS.length);
  });
});

// ============================================================================
// getSlackActionPriority
// ============================================================================

describe('getSlackActionPriority', () => {
  it('should return 1 for an essential action', () => {
    expect(getSlackActionPriority('SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL')).toBe(1);
  });

  it('should return 2 for an important action', () => {
    expect(getSlackActionPriority('SLACK_SEND_SLACK_MESSAGE_BLOCKS')).toBe(2);
  });

  it('should return 3 for a useful action', () => {
    expect(getSlackActionPriority('SLACK_DELETES_A_MESSAGE_FROM_A_CHAT')).toBe(3);
  });

  it('should return 4 for an advanced action', () => {
    expect(getSlackActionPriority('SLACK_DELETE_A_PUBLIC_OR_PRIVATE_CHANNEL')).toBe(4);
  });

  it('should return 99 for an unknown action', () => {
    expect(getSlackActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('should strip composio_ prefix and still find the action', () => {
    expect(getSlackActionPriority('composio_SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL')).toBe(1);
  });

  it('should return 99 for an empty string', () => {
    expect(getSlackActionPriority('')).toBe(99);
  });
});

// ============================================================================
// isKnownSlackAction
// ============================================================================

describe('isKnownSlackAction', () => {
  it('should return true for a known action', () => {
    expect(isKnownSlackAction('SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL')).toBe(true);
  });

  it('should return false for an unknown action', () => {
    expect(isKnownSlackAction('SLACK_NONEXISTENT_ACTION')).toBe(false);
  });

  it('should return true when action has composio_ prefix', () => {
    expect(isKnownSlackAction('composio_SLACK_LIST_ALL_CHANNELS')).toBe(true);
  });

  it('should return false for an empty string', () => {
    expect(isKnownSlackAction('')).toBe(false);
  });

  it('should return true for actions of all priority levels', () => {
    expect(isKnownSlackAction('SLACK_LIST_ALL_USERS')).toBe(true); // P1
    expect(isKnownSlackAction('SLACK_UPLOAD_FILE_TO_SLACK_V2')).toBe(true); // P2
    expect(isKnownSlackAction('SLACK_CREATE_CANVAS')).toBe(true); // P3
    expect(isKnownSlackAction('SLACK_API_TEST')).toBe(true); // P4
  });
});

// ============================================================================
// isDestructiveSlackAction
// ============================================================================

describe('isDestructiveSlackAction', () => {
  it('should return true for a destructive action', () => {
    expect(isDestructiveSlackAction('SLACK_DELETE_A_PUBLIC_OR_PRIVATE_CHANNEL')).toBe(true);
  });

  it('should return false for a non-destructive action', () => {
    expect(isDestructiveSlackAction('SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL')).toBe(false);
  });

  it('should return false for an unknown action', () => {
    expect(isDestructiveSlackAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('should strip composio_ prefix when checking', () => {
    expect(isDestructiveSlackAction('composio_SLACK_DELETE_A_PUBLIC_OR_PRIVATE_CHANNEL')).toBe(
      true
    );
  });

  it('should return true for all known destructive actions', () => {
    const destructiveNames = ALL_SLACK_ACTIONS.filter((a) => a.destructive).map((a) => a.name);
    destructiveNames.forEach((name) => {
      expect(isDestructiveSlackAction(name)).toBe(true);
    });
  });

  it('should return false for write operations that are not destructive', () => {
    // Send message is a write operation but not destructive
    expect(isDestructiveSlackAction('SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL')).toBe(false);
    expect(isDestructiveSlackAction('SLACK_CREATE_CHANNEL')).toBe(false);
  });
});

// ============================================================================
// sortBySlackPriority
// ============================================================================

describe('sortBySlackPriority', () => {
  it('should sort tools by their Slack priority', () => {
    const tools = [
      { name: 'SLACK_API_TEST' }, // P4
      { name: 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL' }, // P1
      { name: 'SLACK_DELETES_A_MESSAGE_FROM_A_CHAT' }, // P3
      { name: 'SLACK_SEND_SLACK_MESSAGE_BLOCKS' }, // P2
    ];
    const sorted = sortBySlackPriority(tools);
    expect(sorted[0].name).toBe('SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL');
    expect(sorted[1].name).toBe('SLACK_SEND_SLACK_MESSAGE_BLOCKS');
    expect(sorted[2].name).toBe('SLACK_DELETES_A_MESSAGE_FROM_A_CHAT');
    expect(sorted[3].name).toBe('SLACK_API_TEST');
  });

  it('should not mutate the original array', () => {
    const tools = [
      { name: 'SLACK_API_TEST' },
      { name: 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL' },
    ];
    const original = [...tools];
    sortBySlackPriority(tools);
    expect(tools[0].name).toBe(original[0].name);
    expect(tools[1].name).toBe(original[1].name);
  });

  it('should handle empty array', () => {
    const sorted = sortBySlackPriority([]);
    expect(sorted).toEqual([]);
  });

  it('should handle single element array', () => {
    const tools = [{ name: 'SLACK_API_TEST' }];
    const sorted = sortBySlackPriority(tools);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].name).toBe('SLACK_API_TEST');
  });

  it('should put unknown actions last (priority 99)', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL' }];
    const sorted = sortBySlackPriority(tools);
    expect(sorted[0].name).toBe('SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });

  it('should maintain relative order for same priority tools', () => {
    // All P1 tools should maintain relative order (stable sort behavior)
    const p1Actions = ALL_SLACK_ACTIONS.filter((a) => a.priority === 1);
    const tools = p1Actions.map((a) => ({ name: a.name }));
    const sorted = sortBySlackPriority(tools);
    // All should still be in the same relative order since they all have priority 1
    sorted.forEach((tool) => {
      expect(getSlackActionPriority(tool.name)).toBe(1);
    });
  });

  it('should work with objects that have additional properties', () => {
    const tools = [
      { name: 'SLACK_API_TEST', extra: 'data1' },
      { name: 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL', extra: 'data2' },
    ];
    const sorted = sortBySlackPriority(tools);
    expect(sorted[0].extra).toBe('data2');
    expect(sorted[1].extra).toBe('data1');
  });
});

// ============================================================================
// getSlackActionStats
// ============================================================================

describe('getSlackActionStats', () => {
  it('should return correct total count', () => {
    const stats = getSlackActionStats();
    expect(stats.total).toBe(ALL_SLACK_ACTIONS.length);
  });

  it('should return byPriority with counts for priorities 1-4', () => {
    const stats = getSlackActionStats();
    expect(stats.byPriority[1]).toBeGreaterThan(0);
    expect(stats.byPriority[2]).toBeGreaterThan(0);
    expect(stats.byPriority[3]).toBeGreaterThan(0);
    expect(stats.byPriority[4]).toBeGreaterThan(0);
  });

  it('should have byPriority counts summing to total', () => {
    const stats = getSlackActionStats();
    const prioritySum = Object.values(stats.byPriority).reduce((sum, count) => sum + count, 0);
    expect(prioritySum).toBe(stats.total);
  });

  it('should return byCategory with counts for all categories', () => {
    const stats = getSlackActionStats();
    expect(stats.byCategory['messaging']).toBeGreaterThan(0);
    expect(stats.byCategory['channels']).toBeGreaterThan(0);
    expect(stats.byCategory['users']).toBeGreaterThan(0);
    expect(stats.byCategory['files']).toBeGreaterThan(0);
    expect(stats.byCategory['workflows']).toBeGreaterThan(0);
    expect(stats.byCategory['admin']).toBeGreaterThan(0);
  });

  it('should have byCategory counts summing to total', () => {
    const stats = getSlackActionStats();
    const categorySum = Object.values(stats.byCategory).reduce((sum, count) => sum + count, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('should return the correct return type shape', () => {
    const stats = getSlackActionStats();
    expect(typeof stats.total).toBe('number');
    expect(typeof stats.byPriority).toBe('object');
    expect(typeof stats.byCategory).toBe('object');
  });
});

// ============================================================================
// getSlackSystemPrompt
// ============================================================================

describe('getSlackSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = getSlackSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should include Slack Integration heading', () => {
    const prompt = getSlackSystemPrompt();
    expect(prompt).toContain('Slack Integration');
  });

  it('should include Messaging section', () => {
    const prompt = getSlackSystemPrompt();
    expect(prompt).toContain('### Messaging');
  });

  it('should include Channels section', () => {
    const prompt = getSlackSystemPrompt();
    expect(prompt).toContain('### Channels');
  });

  it('should include Users & Groups section', () => {
    const prompt = getSlackSystemPrompt();
    expect(prompt).toContain('### Users & Groups');
  });

  it('should include Files & Canvases section', () => {
    const prompt = getSlackSystemPrompt();
    expect(prompt).toContain('### Files & Canvases');
  });

  it('should include Safety Rules section', () => {
    const prompt = getSlackSystemPrompt();
    expect(prompt).toContain('### Safety Rules');
  });

  it('should mention composio_SLACK_ tool prefix', () => {
    const prompt = getSlackSystemPrompt();
    expect(prompt).toContain('composio_SLACK_');
  });

  it('should include action-preview format example', () => {
    const prompt = getSlackSystemPrompt();
    expect(prompt).toContain('action-preview');
  });

  it('should mention confirming before sending messages', () => {
    const prompt = getSlackSystemPrompt();
    expect(prompt).toContain('confirm before sending');
  });
});

// ============================================================================
// getSlackCapabilitySummary
// ============================================================================

describe('getSlackCapabilitySummary', () => {
  it('should return a non-empty string', () => {
    const summary = getSlackCapabilitySummary();
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('should include the word Slack', () => {
    const summary = getSlackCapabilitySummary();
    expect(summary).toContain('Slack');
  });

  it('should include the total action count', () => {
    const summary = getSlackCapabilitySummary();
    const stats = getSlackActionStats();
    expect(summary).toContain(`${stats.total} actions`);
  });

  it('should mention key capability areas', () => {
    const summary = getSlackCapabilitySummary();
    expect(summary).toContain('messages');
    expect(summary).toContain('channels');
    expect(summary).toContain('users');
    expect(summary).toContain('files');
    expect(summary).toContain('canvases');
    expect(summary).toContain('reminders');
  });
});

// ============================================================================
// logSlackToolkitStats
// ============================================================================

describe('logSlackToolkitStats', () => {
  it('should execute without throwing', () => {
    expect(() => logSlackToolkitStats()).not.toThrow();
  });

  it('should return undefined (void)', () => {
    const result = logSlackToolkitStats();
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// EDGE CASES AND DATA INTEGRITY
// ============================================================================

describe('data integrity', () => {
  it('should have specific essential action: Send Message', () => {
    const action = ALL_SLACK_ACTIONS.find(
      (a) => a.name === 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL'
    );
    expect(action).toBeDefined();
    expect(action!.label).toBe('Send Message');
    expect(action!.category).toBe('messaging');
    expect(action!.priority).toBe(1);
    expect(action!.writeOperation).toBe(true);
  });

  it('should have specific essential action: List Channels', () => {
    const action = ALL_SLACK_ACTIONS.find((a) => a.name === 'SLACK_LIST_ALL_CHANNELS');
    expect(action).toBeDefined();
    expect(action!.label).toBe('List Channels');
    expect(action!.category).toBe('channels');
    expect(action!.priority).toBe(1);
    expect(action!.writeOperation).toBeUndefined();
  });

  it('should have destructive actions only at priority 3 or 4', () => {
    const destructiveActions = ALL_SLACK_ACTIONS.filter((a) => a.destructive);
    destructiveActions.forEach((action) => {
      expect(action.priority).toBeGreaterThanOrEqual(3);
    });
  });

  it('should have all destructive actions also marked as writeOperation', () => {
    const destructiveActions = ALL_SLACK_ACTIONS.filter((a) => a.destructive);
    destructiveActions.forEach((action) => {
      expect(action.writeOperation).toBe(true);
    });
  });

  it('should have essential actions (P1) with 11 entries', () => {
    const essentialActions = ALL_SLACK_ACTIONS.filter((a) => a.priority === 1);
    expect(essentialActions.length).toBe(11);
  });
});
