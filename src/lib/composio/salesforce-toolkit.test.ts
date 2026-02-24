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
  type SalesforceActionCategory,
  type SalesforceAction,
  ALL_SALESFORCE_ACTIONS,
  getSalesforceFeaturedActionNames,
  getSalesforceActionsByPriority,
  getSalesforceActionNamesByPriority,
  getSalesforceActionsByCategory,
  getSalesforceActionPriority,
  isKnownSalesforceAction,
  isDestructiveSalesforceAction,
  sortBySalesforcePriority,
  getSalesforceActionStats,
  getSalesforceSystemPrompt,
  getSalesforceCapabilitySummary,
  logSalesforceToolkitStats,
} from './salesforce-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('SalesforceToolkit type exports', () => {
  it('should export SalesforceActionCategory type', () => {
    const cat: SalesforceActionCategory = 'leads';
    expect([
      'leads',
      'contacts',
      'accounts',
      'opportunities',
      'cases',
      'tasks',
      'reports',
      'records',
    ]).toContain(cat);
  });

  it('should export SalesforceAction interface', () => {
    const action: SalesforceAction = {
      name: 'SALESFORCE_CREATE_LEAD',
      label: 'Create Lead',
      category: 'leads',
      priority: 1,
      writeOperation: true,
    };
    expect(action.priority).toBe(1);
    expect(action.writeOperation).toBe(true);
  });

  it('should support optional destructive field', () => {
    const action: SalesforceAction = {
      name: 'SALESFORCE_DELETE_LEAD',
      label: 'Delete Lead',
      category: 'leads',
      priority: 3,
      writeOperation: true,
      destructive: true,
    };
    expect(action.destructive).toBe(true);
  });
});

// ============================================================================
// ALL_SALESFORCE_ACTIONS REGISTRY
// ============================================================================

describe('ALL_SALESFORCE_ACTIONS', () => {
  it('should be a non-empty array', () => {
    expect(ALL_SALESFORCE_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have actions with valid priorities 1-4', () => {
    for (const action of ALL_SALESFORCE_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have actions with valid categories', () => {
    const validCategories = [
      'leads',
      'contacts',
      'accounts',
      'opportunities',
      'cases',
      'tasks',
      'reports',
      'records',
    ];
    for (const action of ALL_SALESFORCE_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have unique action names', () => {
    const names = ALL_SALESFORCE_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have essential (priority 1) actions', () => {
    const essential = ALL_SALESFORCE_ACTIONS.filter((a) => a.priority === 1);
    expect(essential.length).toBeGreaterThan(0);
  });

  it('should include lead creation', () => {
    const create = ALL_SALESFORCE_ACTIONS.find((a) => a.name === 'SALESFORCE_CREATE_LEAD');
    expect(create).toBeDefined();
    expect(create?.priority).toBe(1);
    expect(create?.writeOperation).toBe(true);
  });

  it('should mark destructive actions', () => {
    const destructive = ALL_SALESFORCE_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const d of destructive) {
      expect(d.priority).toBeGreaterThanOrEqual(3);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('getSalesforceFeaturedActionNames', () => {
  it('should return all action names', () => {
    const names = getSalesforceFeaturedActionNames();
    expect(names.length).toBe(ALL_SALESFORCE_ACTIONS.length);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should include SALESFORCE_CREATE_LEAD', () => {
    expect(getSalesforceFeaturedActionNames()).toContain('SALESFORCE_CREATE_LEAD');
  });
});

describe('getSalesforceActionsByPriority', () => {
  it('should return only actions at or below given priority', () => {
    const p2 = getSalesforceActionsByPriority(2);
    for (const a of p2) {
      expect(a.priority).toBeLessThanOrEqual(2);
    }
  });

  it('should return more actions at higher max priority', () => {
    const p1 = getSalesforceActionsByPriority(1);
    const p3 = getSalesforceActionsByPriority(3);
    expect(p3.length).toBeGreaterThanOrEqual(p1.length);
  });

  it('should default to maxPriority 3', () => {
    const defaultResult = getSalesforceActionsByPriority();
    const p3 = getSalesforceActionsByPriority(3);
    expect(defaultResult.length).toBe(p3.length);
  });
});

describe('getSalesforceActionNamesByPriority', () => {
  it('should return string array', () => {
    const names = getSalesforceActionNamesByPriority(2);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('should match getSalesforceActionsByPriority length', () => {
    const actions = getSalesforceActionsByPriority(2);
    const names = getSalesforceActionNamesByPriority(2);
    expect(names.length).toBe(actions.length);
  });
});

describe('getSalesforceActionsByCategory', () => {
  it('should return leads category actions', () => {
    const leads = getSalesforceActionsByCategory('leads');
    expect(leads.length).toBeGreaterThan(0);
    for (const a of leads) {
      expect(a.category).toBe('leads');
    }
  });

  it('should return contacts category actions', () => {
    const contacts = getSalesforceActionsByCategory('contacts');
    expect(contacts.length).toBeGreaterThan(0);
    for (const a of contacts) {
      expect(a.category).toBe('contacts');
    }
  });

  it('should return accounts category actions', () => {
    const accounts = getSalesforceActionsByCategory('accounts');
    expect(accounts.length).toBeGreaterThan(0);
  });

  it('should return opportunities category actions', () => {
    const opps = getSalesforceActionsByCategory('opportunities');
    expect(opps.length).toBeGreaterThan(0);
  });
});

describe('getSalesforceActionPriority', () => {
  it('should return priority for known action', () => {
    expect(getSalesforceActionPriority('SALESFORCE_CREATE_LEAD')).toBe(1);
  });

  it('should handle composio_ prefix', () => {
    expect(getSalesforceActionPriority('composio_SALESFORCE_CREATE_LEAD')).toBe(1);
  });

  it('should return 99 for unknown action', () => {
    expect(getSalesforceActionPriority('UNKNOWN_ACTION')).toBe(99);
  });
});

describe('isKnownSalesforceAction', () => {
  it('should return true for known action', () => {
    expect(isKnownSalesforceAction('SALESFORCE_CREATE_LEAD')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isKnownSalesforceAction('composio_SALESFORCE_CREATE_LEAD')).toBe(true);
  });

  it('should return false for unknown action', () => {
    expect(isKnownSalesforceAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('isDestructiveSalesforceAction', () => {
  it('should return true for destructive actions', () => {
    expect(isDestructiveSalesforceAction('SALESFORCE_DELETE_LEAD')).toBe(true);
  });

  it('should handle composio_ prefix', () => {
    expect(isDestructiveSalesforceAction('composio_SALESFORCE_DELETE_LEAD')).toBe(true);
  });

  it('should return false for non-destructive action', () => {
    expect(isDestructiveSalesforceAction('SALESFORCE_CREATE_LEAD')).toBe(false);
  });

  it('should return false for unknown action', () => {
    expect(isDestructiveSalesforceAction('UNKNOWN_ACTION')).toBe(false);
  });
});

describe('sortBySalesforcePriority', () => {
  it('should sort tools by priority ascending', () => {
    const tools = [
      { name: 'SALESFORCE_DELETE_CASE' }, // priority 4
      { name: 'SALESFORCE_CREATE_LEAD' }, // priority 1
      { name: 'SALESFORCE_CREATE_CASE' }, // priority 2
    ];
    const sorted = sortBySalesforcePriority(tools);
    expect(sorted[0].name).toBe('SALESFORCE_CREATE_LEAD');
    expect(sorted[2].name).toBe('SALESFORCE_DELETE_CASE');
  });

  it('should place unknown actions last', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'SALESFORCE_CREATE_LEAD' }];
    const sorted = sortBySalesforcePriority(tools);
    expect(sorted[0].name).toBe('SALESFORCE_CREATE_LEAD');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });

  it('should not mutate original array', () => {
    const tools = [{ name: 'SALESFORCE_DELETE_CASE' }, { name: 'SALESFORCE_CREATE_LEAD' }];
    const original = [...tools];
    sortBySalesforcePriority(tools);
    expect(tools).toEqual(original);
  });
});

describe('getSalesforceActionStats', () => {
  it('should return total count', () => {
    const stats = getSalesforceActionStats();
    expect(stats.total).toBe(ALL_SALESFORCE_ACTIONS.length);
  });

  it('should have byPriority breakdown', () => {
    const stats = getSalesforceActionStats();
    expect(stats.byPriority[1]).toBeGreaterThan(0);
    expect(stats.byPriority[2]).toBeGreaterThan(0);
    expect(stats.byPriority[3]).toBeGreaterThan(0);
    expect(stats.byPriority[4]).toBeGreaterThan(0);
  });

  it('should have byCategory breakdown', () => {
    const stats = getSalesforceActionStats();
    expect(stats.byCategory['leads']).toBeGreaterThan(0);
    expect(stats.byCategory['contacts']).toBeGreaterThan(0);
  });

  it('should sum priorities to total', () => {
    const stats = getSalesforceActionStats();
    const sum = Object.values(stats.byPriority).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });

  it('should sum categories to total', () => {
    const stats = getSalesforceActionStats();
    const sum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });
});

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

describe('getSalesforceSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = getSalesforceSystemPrompt();
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should mention Salesforce', () => {
    expect(getSalesforceSystemPrompt()).toContain('Salesforce');
  });

  it('should mention safety rules', () => {
    expect(getSalesforceSystemPrompt()).toContain('Safety Rules');
  });

  it('should mention composio tools', () => {
    expect(getSalesforceSystemPrompt()).toContain('composio_SALESFORCE_');
  });
});

describe('getSalesforceCapabilitySummary', () => {
  it('should return a non-empty string', () => {
    expect(getSalesforceCapabilitySummary().length).toBeGreaterThan(0);
  });

  it('should include action count', () => {
    const stats = getSalesforceActionStats();
    expect(getSalesforceCapabilitySummary()).toContain(`${stats.total}`);
  });
});

describe('logSalesforceToolkitStats', () => {
  it('should be a function', () => {
    expect(typeof logSalesforceToolkitStats).toBe('function');
  });

  it('should not throw', () => {
    expect(() => logSalesforceToolkitStats()).not.toThrow();
  });
});
