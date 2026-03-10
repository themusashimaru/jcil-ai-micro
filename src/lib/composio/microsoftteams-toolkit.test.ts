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
  type MicrosoftTeamsActionCategory,
  type MicrosoftTeamsAction,
  ALL_MICROSOFT_TEAMS_ACTIONS,
  getMicrosoftTeamsFeaturedActionNames,
  getMicrosoftTeamsActionsByPriority,
  getMicrosoftTeamsActionNamesByPriority,
  getMicrosoftTeamsActionsByCategory,
  getMicrosoftTeamsActionPriority,
  isKnownMicrosoftTeamsAction,
  isDestructiveMicrosoftTeamsAction,
  sortByMicrosoftTeamsPriority,
  getMicrosoftTeamsActionStats,
  getMicrosoftTeamsSystemPrompt,
  getMicrosoftTeamsCapabilitySummary,
  logMicrosoftTeamsToolkitStats,
} from './microsoftteams-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('MicrosoftTeamsToolkit type exports', () => {
  it('should export MicrosoftTeamsActionCategory type', () => {
    const cat: MicrosoftTeamsActionCategory = 'messaging';
    expect(['messaging', 'channels', 'teams', 'meetings', 'users', 'files', 'apps']).toContain(cat);
  });

  it('should export MicrosoftTeamsAction interface', () => {
    const action: MicrosoftTeamsAction = {
      name: 'MICROSOFTTEAMS_SEND_MESSAGE',
      label: 'Test',
      category: 'messaging',
      priority: 1,
    };
    expect(action.priority).toBe(1);
  });
});

// ============================================================================
// ACTION REGISTRY
// ============================================================================

describe('ALL_MICROSOFT_TEAMS_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_MICROSOFT_TEAMS_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_MICROSOFT_TEAMS_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_MICROSOFT_TEAMS_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: MicrosoftTeamsActionCategory[] = [
      'messaging',
      'channels',
      'teams',
      'meetings',
      'users',
      'files',
      'apps',
    ];
    for (const action of ALL_MICROSOFT_TEAMS_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_MICROSOFT_TEAMS_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with MICROSOFTTEAMS_', () => {
    for (const action of ALL_MICROSOFT_TEAMS_ACTIONS) {
      expect(action.name).toMatch(/^MICROSOFTTEAMS_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_MICROSOFT_TEAMS_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('MicrosoftTeams query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getMicrosoftTeamsFeaturedActionNames();
    expect(names.length).toBe(ALL_MICROSOFT_TEAMS_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getMicrosoftTeamsActionsByPriority(1);
    const p2 = getMicrosoftTeamsActionsByPriority(2);
    const p3 = getMicrosoftTeamsActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: MicrosoftTeamsAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getMicrosoftTeamsActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: MicrosoftTeamsActionCategory = 'messaging';
    const actions = getMicrosoftTeamsActionsByCategory(category);
    expect(actions.every((a: MicrosoftTeamsAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getMicrosoftTeamsActionPriority('MICROSOFTTEAMS_SEND_MESSAGE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getMicrosoftTeamsActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getMicrosoftTeamsActionPriority('composio_MICROSOFTTEAMS_SEND_MESSAGE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownMicrosoftTeamsAction('MICROSOFTTEAMS_SEND_MESSAGE')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownMicrosoftTeamsAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownMicrosoftTeamsAction('composio_MICROSOFTTEAMS_SEND_MESSAGE')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveMicrosoftTeamsAction('UNKNOWN_ACTION')).toBe(false);
    expect(isDestructiveMicrosoftTeamsAction('MICROSOFTTEAMS_DELETE_CHANNEL')).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'MICROSOFTTEAMS_SEND_MESSAGE' }];
    const sorted = sortByMicrosoftTeamsPriority(tools);
    expect(sorted[0].name).toBe('MICROSOFTTEAMS_SEND_MESSAGE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('MicrosoftTeams stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getMicrosoftTeamsActionStats();
    expect(stats.total).toBe(ALL_MICROSOFT_TEAMS_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getMicrosoftTeamsSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getMicrosoftTeamsCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Microsoft');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logMicrosoftTeamsToolkitStats()).not.toThrow();
  });
});
