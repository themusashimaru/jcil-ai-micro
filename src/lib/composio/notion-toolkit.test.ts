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
  type NotionActionCategory,
  type NotionAction,
  ALL_NOTION_ACTIONS,
  getNotionFeaturedActionNames,
  getNotionActionsByPriority,
  getNotionActionNamesByPriority,
  getNotionActionsByCategory,
  getNotionActionPriority,
  isKnownNotionAction,
  isDestructiveNotionAction,
  sortByNotionPriority,
  getNotionActionStats,
  getNotionSystemPrompt,
  getNotionCapabilitySummary,
  logNotionToolkitStats,
} from './notion-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('NotionToolkit type exports', () => {
  it('should export NotionActionCategory type', () => {
    const cat: NotionActionCategory = 'pages';
    expect(['pages', 'databases', 'blocks', 'users', 'comments', 'search']).toContain(cat);
  });

  it('should export NotionAction interface', () => {
    const action: NotionAction = {
      name: 'NOTION_CREATE_PAGE',
      label: 'Create Page',
      category: 'pages',
      priority: 1,
      writeOperation: true,
    };
    expect(action.priority).toBe(1);
    expect(action.writeOperation).toBe(true);
  });

  it('should support optional destructive field', () => {
    const action: NotionAction = {
      name: 'NOTION_DELETE_BLOCK',
      label: 'Delete Block',
      category: 'blocks',
      priority: 4,
      writeOperation: true,
      destructive: true,
    };
    expect(action.destructive).toBe(true);
  });
});

// ============================================================================
// ALL_NOTION_ACTIONS REGISTRY
// ============================================================================

describe('ALL_NOTION_ACTIONS', () => {
  it('should be a non-empty array', () => {
    expect(ALL_NOTION_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have actions with valid priorities 1-4', () => {
    for (const action of ALL_NOTION_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have actions with valid categories', () => {
    const validCategories = ['pages', 'databases', 'blocks', 'users', 'comments', 'search'];
    for (const action of ALL_NOTION_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have unique action names', () => {
    const names = ALL_NOTION_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have essential (priority 1) actions', () => {
    const essential = ALL_NOTION_ACTIONS.filter((a) => a.priority === 1);
    expect(essential.length).toBeGreaterThan(0);
  });

  it('should include page creation', () => {
    const create = ALL_NOTION_ACTIONS.find((a) => a.name === 'NOTION_CREATE_PAGE');
    expect(create).toBeDefined();
    expect(create?.priority).toBe(1);
    expect(create?.writeOperation).toBe(true);
  });

  it('should mark destructive actions', () => {
    const destructive = ALL_NOTION_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const d of destructive) {
      expect(d.priority).toBe(4);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('getNotionFeaturedActionNames', () => {
  it('should return all action names', () => {
    const names = getNotionFeaturedActionNames();
    expect(names.length).toBe(ALL_NOTION_ACTIONS.length);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should include NOTION_CREATE_PAGE', () => {
    expect(getNotionFeaturedActionNames()).toContain('NOTION_CREATE_PAGE');
  });
});

describe('getNotionActionsByPriority', () => {
  it('should return only actions at or below given priority', () => {
    const p2 = getNotionActionsByPriority(2);
    for (const a of p2) {
      expect(a.priority).toBeLessThanOrEqual(2);
    }
  });

  it('should return more actions at higher max priority', () => {
    const p1 = getNotionActionsByPriority(1);
    const p3 = getNotionActionsByPriority(3);
    expect(p3.length).toBeGreaterThanOrEqual(p1.length);
  });

  it('should default to maxPriority 3', () => {
    const defaultResult = getNotionActionsByPriority();
    const p3 = getNotionActionsByPriority(3);
    expect(defaultResult.length).toBe(p3.length);
  });
});

describe('getNotionActionNamesByPriority', () => {
  it('should return string array', () => {
    const names = getNotionActionNamesByPriority(2);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should match getNotionActionsByPriority length', () => {
    const actions = getNotionActionsByPriority(2);
    const names = getNotionActionNamesByPriority(2);
    expect(names.length).toBe(actions.length);
  });
});

describe('getNotionActionsByCategory', () => {
  it('should return pages category actions', () => {
    const pages = getNotionActionsByCategory('pages');
    expect(pages.length).toBeGreaterThan(0);
    for (const a of pages) {
      expect(a.category).toBe('pages');
    }
  });

  it('should return databases category actions', () => {
    const databases = getNotionActionsByCategory('databases');
    expect(databases.length).toBeGreaterThan(0);
    for (const a of databases) {
      expect(a.category).toBe('databases');
    }
  });

  it('should return blocks category actions', () => {
    const blocks = getNotionActionsByCategory('blocks');
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('should return users category actions', () => {
    const users = getNotionActionsByCategory('users');
    expect(users.length).toBeGreaterThan(0);
  });
});

describe('getNotionActionPriority', () => {
  it('should return priority for known action', () => {
    expect(getNotionActionPriority('NOTION_CREATE_PAGE')).toBe(1);
  });

  it('should handle composio_ prefix', () => {
    expect(getNotionActionPriority('composio_NOTION_CREATE_PAGE')).toBe(1);
  });

  it('should return 99 for unknown action', () => {
    expect(getNotionActionPriority('UNKNOWN_ACTION')).toBe(99);
  });
});

describe('isKnownNotionAction', () => {
  it('should return true for known action', () => {
    expect(isKnownNotionAction('NOTION_CREATE_PAGE')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isKnownNotionAction('composio_NOTION_CREATE_PAGE')).toBe(true);
  });

  it('should return false for unknown action', () => {
    expect(isKnownNotionAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('isDestructiveNotionAction', () => {
  it('should return true for destructive actions', () => {
    expect(isDestructiveNotionAction('NOTION_DELETE_BLOCK')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isDestructiveNotionAction('composio_NOTION_DELETE_BLOCK')).toBe(true);
  });

  it('should return false for non-destructive action', () => {
    expect(isDestructiveNotionAction('NOTION_CREATE_PAGE')).toBe(false);
  });

  it('should return false for unknown action', () => {
    expect(isDestructiveNotionAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('sortByNotionPriority', () => {
  it('should sort tools by priority ascending', () => {
    const tools = [
      { name: 'NOTION_DELETE_BLOCK' }, // priority 4
      { name: 'NOTION_CREATE_PAGE' }, // priority 1
      { name: 'NOTION_CREATE_DATABASE' }, // priority 2
    ];
    const sorted = sortByNotionPriority(tools);
    expect(sorted[0].name).toBe('NOTION_CREATE_PAGE');
    expect(sorted[2].name).toBe('NOTION_DELETE_BLOCK');
  });

  it('should place unknown actions last', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'NOTION_CREATE_PAGE' }];
    const sorted = sortByNotionPriority(tools);
    expect(sorted[0].name).toBe('NOTION_CREATE_PAGE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });

  it('should not mutate original array', () => {
    const tools = [{ name: 'NOTION_DELETE_BLOCK' }, { name: 'NOTION_CREATE_PAGE' }];
    const original = [...tools];
    sortByNotionPriority(tools);
    expect(tools).toEqual(original);
  });
});

describe('getNotionActionStats', () => {
  it('should return total count', () => {
    const stats = getNotionActionStats();
    expect(stats.total).toBe(ALL_NOTION_ACTIONS.length);
  });

  it('should have byPriority breakdown', () => {
    const stats = getNotionActionStats();
    expect(stats.byPriority[1]).toBeGreaterThan(0);
    expect(stats.byPriority[2]).toBeGreaterThan(0);
    expect(stats.byPriority[3]).toBeGreaterThan(0);
    expect(stats.byPriority[4]).toBeGreaterThan(0);
  });

  it('should have byCategory breakdown', () => {
    const stats = getNotionActionStats();
    expect(stats.byCategory['pages']).toBeGreaterThan(0);
    expect(stats.byCategory['databases']).toBeGreaterThan(0);
  });

  it('should sum priorities to total', () => {
    const stats = getNotionActionStats();
    const sum = Object.values(stats.byPriority).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });

  it('should sum categories to total', () => {
    const stats = getNotionActionStats();
    const sum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });
});

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

describe('getNotionSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = getNotionSystemPrompt();
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should mention Notion', () => {
    expect(getNotionSystemPrompt()).toContain('Notion');
  });

  it('should mention safety rules', () => {
    expect(getNotionSystemPrompt()).toContain('Safety Rules');
  });

  it('should mention composio tools', () => {
    expect(getNotionSystemPrompt()).toContain('composio_NOTION_');
  });
});

describe('getNotionCapabilitySummary', () => {
  it('should return a non-empty string', () => {
    expect(getNotionCapabilitySummary().length).toBeGreaterThan(0);
  });

  it('should include action count', () => {
    const stats = getNotionActionStats();
    expect(getNotionCapabilitySummary()).toContain(`${stats.total}`);
  });
});

describe('logNotionToolkitStats', () => {
  it('should be a function', () => {
    expect(typeof logNotionToolkitStats).toBe('function');
  });

  it('should not throw', () => {
    expect(() => logNotionToolkitStats()).not.toThrow();
  });
});
