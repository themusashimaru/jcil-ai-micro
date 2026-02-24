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
  type HubSpotActionCategory,
  type HubSpotAction,
  ALL_HUBSPOT_ACTIONS,
  getHubSpotFeaturedActionNames,
  getHubSpotActionsByPriority,
  getHubSpotActionNamesByPriority,
  getHubSpotActionsByCategory,
  getHubSpotActionPriority,
  isKnownHubSpotAction,
  isDestructiveHubSpotAction,
  sortByHubSpotPriority,
  getHubSpotActionStats,
  getHubSpotSystemPrompt,
  getHubSpotCapabilitySummary,
  logHubSpotToolkitStats,
} from './hubspot-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('HubSpotToolkit type exports', () => {
  it('should export HubSpotActionCategory type', () => {
    const cat: HubSpotActionCategory = 'contacts';
    expect([
      'contacts',
      'companies',
      'deals',
      'tickets',
      'lists',
      'emails',
      'notes',
      'tasks',
    ]).toContain(cat);
  });

  it('should export HubSpotAction interface', () => {
    const action: HubSpotAction = {
      name: 'HUBSPOT_CREATE_CONTACT',
      label: 'Create Contact',
      category: 'contacts',
      priority: 1,
      writeOperation: true,
    };
    expect(action.priority).toBe(1);
    expect(action.writeOperation).toBe(true);
  });

  it('should support optional destructive field', () => {
    const action: HubSpotAction = {
      name: 'HUBSPOT_DELETE_CONTACT',
      label: 'Delete Contact',
      category: 'contacts',
      priority: 3,
      writeOperation: true,
      destructive: true,
    };
    expect(action.destructive).toBe(true);
  });
});

// ============================================================================
// ALL_HUBSPOT_ACTIONS REGISTRY
// ============================================================================

describe('ALL_HUBSPOT_ACTIONS', () => {
  it('should be a non-empty array', () => {
    expect(ALL_HUBSPOT_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have actions with valid priorities 1-4', () => {
    for (const action of ALL_HUBSPOT_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have actions with valid categories', () => {
    const validCategories = [
      'contacts',
      'companies',
      'deals',
      'tickets',
      'lists',
      'emails',
      'notes',
      'tasks',
    ];
    for (const action of ALL_HUBSPOT_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have unique action names', () => {
    const names = ALL_HUBSPOT_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have essential (priority 1) actions', () => {
    const essential = ALL_HUBSPOT_ACTIONS.filter((a) => a.priority === 1);
    expect(essential.length).toBeGreaterThan(0);
  });

  it('should include contact creation', () => {
    const create = ALL_HUBSPOT_ACTIONS.find((a) => a.name === 'HUBSPOT_CREATE_CONTACT');
    expect(create).toBeDefined();
    expect(create?.priority).toBe(1);
    expect(create?.writeOperation).toBe(true);
  });

  it('should mark destructive actions', () => {
    const destructive = ALL_HUBSPOT_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const d of destructive) {
      expect(d.priority).toBeGreaterThanOrEqual(3);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('getHubSpotFeaturedActionNames', () => {
  it('should return all action names', () => {
    const names = getHubSpotFeaturedActionNames();
    expect(names.length).toBe(ALL_HUBSPOT_ACTIONS.length);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should include HUBSPOT_CREATE_CONTACT', () => {
    expect(getHubSpotFeaturedActionNames()).toContain('HUBSPOT_CREATE_CONTACT');
  });
});

describe('getHubSpotActionsByPriority', () => {
  it('should return only actions at or below given priority', () => {
    const p2 = getHubSpotActionsByPriority(2);
    for (const a of p2) {
      expect(a.priority).toBeLessThanOrEqual(2);
    }
  });

  it('should return more actions at higher max priority', () => {
    const p1 = getHubSpotActionsByPriority(1);
    const p3 = getHubSpotActionsByPriority(3);
    expect(p3.length).toBeGreaterThanOrEqual(p1.length);
  });

  it('should default to maxPriority 3', () => {
    const defaultResult = getHubSpotActionsByPriority();
    const p3 = getHubSpotActionsByPriority(3);
    expect(defaultResult.length).toBe(p3.length);
  });
});

describe('getHubSpotActionNamesByPriority', () => {
  it('should return string array', () => {
    const names = getHubSpotActionNamesByPriority(2);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should match getHubSpotActionsByPriority length', () => {
    const actions = getHubSpotActionsByPriority(2);
    const names = getHubSpotActionNamesByPriority(2);
    expect(names.length).toBe(actions.length);
  });
});

describe('getHubSpotActionsByCategory', () => {
  it('should return contacts category actions', () => {
    const contacts = getHubSpotActionsByCategory('contacts');
    expect(contacts.length).toBeGreaterThan(0);
    for (const a of contacts) {
      expect(a.category).toBe('contacts');
    }
  });

  it('should return deals category actions', () => {
    const deals = getHubSpotActionsByCategory('deals');
    expect(deals.length).toBeGreaterThan(0);
    for (const a of deals) {
      expect(a.category).toBe('deals');
    }
  });

  it('should return companies category actions', () => {
    const companies = getHubSpotActionsByCategory('companies');
    expect(companies.length).toBeGreaterThan(0);
  });

  it('should return tickets category actions', () => {
    const tickets = getHubSpotActionsByCategory('tickets');
    expect(tickets.length).toBeGreaterThan(0);
  });
});

describe('getHubSpotActionPriority', () => {
  it('should return priority for known action', () => {
    expect(getHubSpotActionPriority('HUBSPOT_CREATE_CONTACT')).toBe(1);
  });

  it('should handle composio_ prefix', () => {
    expect(getHubSpotActionPriority('composio_HUBSPOT_CREATE_CONTACT')).toBe(1);
  });

  it('should return 99 for unknown action', () => {
    expect(getHubSpotActionPriority('UNKNOWN_ACTION')).toBe(99);
  });
});

describe('isKnownHubSpotAction', () => {
  it('should return true for known action', () => {
    expect(isKnownHubSpotAction('HUBSPOT_CREATE_CONTACT')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isKnownHubSpotAction('composio_HUBSPOT_CREATE_CONTACT')).toBe(true);
  });

  it('should return false for unknown action', () => {
    expect(isKnownHubSpotAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('isDestructiveHubSpotAction', () => {
  it('should return true for destructive actions', () => {
    expect(isDestructiveHubSpotAction('HUBSPOT_DELETE_CONTACT')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isDestructiveHubSpotAction('composio_HUBSPOT_DELETE_CONTACT')).toBe(true);
  });

  it('should return false for non-destructive action', () => {
    expect(isDestructiveHubSpotAction('HUBSPOT_CREATE_CONTACT')).toBe(false);
  });

  it('should return false for unknown action', () => {
    expect(isDestructiveHubSpotAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('sortByHubSpotPriority', () => {
  it('should sort tools by priority ascending', () => {
    const tools = [
      { name: 'HUBSPOT_DELETE_NOTE' }, // priority 4
      { name: 'HUBSPOT_CREATE_CONTACT' }, // priority 1
      { name: 'HUBSPOT_CREATE_TICKET' }, // priority 2
    ];
    const sorted = sortByHubSpotPriority(tools);
    expect(sorted[0].name).toBe('HUBSPOT_CREATE_CONTACT');
    expect(sorted[2].name).toBe('HUBSPOT_DELETE_NOTE');
  });

  it('should place unknown actions last', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'HUBSPOT_CREATE_CONTACT' }];
    const sorted = sortByHubSpotPriority(tools);
    expect(sorted[0].name).toBe('HUBSPOT_CREATE_CONTACT');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });

  it('should not mutate original array', () => {
    const tools = [{ name: 'HUBSPOT_DELETE_NOTE' }, { name: 'HUBSPOT_CREATE_CONTACT' }];
    const original = [...tools];
    sortByHubSpotPriority(tools);
    expect(tools).toEqual(original);
  });
});

describe('getHubSpotActionStats', () => {
  it('should return total count', () => {
    const stats = getHubSpotActionStats();
    expect(stats.total).toBe(ALL_HUBSPOT_ACTIONS.length);
  });

  it('should have byPriority breakdown', () => {
    const stats = getHubSpotActionStats();
    expect(stats.byPriority[1]).toBeGreaterThan(0);
    expect(stats.byPriority[2]).toBeGreaterThan(0);
    expect(stats.byPriority[3]).toBeGreaterThan(0);
    expect(stats.byPriority[4]).toBeGreaterThan(0);
  });

  it('should have byCategory breakdown', () => {
    const stats = getHubSpotActionStats();
    expect(stats.byCategory['contacts']).toBeGreaterThan(0);
    expect(stats.byCategory['deals']).toBeGreaterThan(0);
  });

  it('should sum priorities to total', () => {
    const stats = getHubSpotActionStats();
    const sum = Object.values(stats.byPriority).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });

  it('should sum categories to total', () => {
    const stats = getHubSpotActionStats();
    const sum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });
});

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

describe('getHubSpotSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = getHubSpotSystemPrompt();
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should mention HubSpot', () => {
    expect(getHubSpotSystemPrompt()).toContain('HubSpot');
  });

  it('should mention safety rules', () => {
    expect(getHubSpotSystemPrompt()).toContain('Safety Rules');
  });

  it('should mention composio tools', () => {
    expect(getHubSpotSystemPrompt()).toContain('composio_HUBSPOT_');
  });
});

describe('getHubSpotCapabilitySummary', () => {
  it('should return a non-empty string', () => {
    expect(getHubSpotCapabilitySummary().length).toBeGreaterThan(0);
  });

  it('should include action count', () => {
    const stats = getHubSpotActionStats();
    expect(getHubSpotCapabilitySummary()).toContain(`${stats.total}`);
  });
});

describe('logHubSpotToolkitStats', () => {
  it('should be a function', () => {
    expect(typeof logHubSpotToolkitStats).toBe('function');
  });

  it('should not throw', () => {
    expect(() => logHubSpotToolkitStats()).not.toThrow();
  });
});
