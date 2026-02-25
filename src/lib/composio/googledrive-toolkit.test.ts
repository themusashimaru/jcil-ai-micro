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
  type GoogleDriveActionCategory,
  type GoogleDriveAction,
  ALL_GOOGLE_DRIVE_ACTIONS,
  getGoogleDriveFeaturedActionNames,
  getGoogleDriveActionsByPriority,
  getGoogleDriveActionNamesByPriority,
  getGoogleDriveActionsByCategory,
  getGoogleDriveActionPriority,
  isKnownGoogleDriveAction,
  isDestructiveGoogleDriveAction,
  sortByGoogleDrivePriority,
  getGoogleDriveActionStats,
  getGoogleDriveSystemPrompt,
  getGoogleDriveCapabilitySummary,
  logGoogleDriveToolkitStats,
} from './googledrive-toolkit';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('GoogleDriveToolkit type exports', () => {
  it('should export GoogleDriveActionCategory type', () => {
    const cat: GoogleDriveActionCategory = 'files';
    expect(['files', 'sharing', 'drives', 'collaboration', 'account']).toContain(cat);
  });

  it('should export GoogleDriveAction interface', () => {
    const action: GoogleDriveAction = {
      name: 'GOOGLEDRIVE_FIND_FILE',
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

describe('ALL_GOOGLE_DRIVE_ACTIONS', () => {
  it('should have at least one action', () => {
    expect(ALL_GOOGLE_DRIVE_ACTIONS.length).toBeGreaterThan(0);
  });

  it('should have unique action names', () => {
    const names = ALL_GOOGLE_DRIVE_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid priorities (1-4)', () => {
    for (const action of ALL_GOOGLE_DRIVE_ACTIONS) {
      expect(action.priority).toBeGreaterThanOrEqual(1);
      expect(action.priority).toBeLessThanOrEqual(4);
    }
  });

  it('should have valid categories', () => {
    const validCategories: GoogleDriveActionCategory[] = [
      'files',
      'sharing',
      'drives',
      'collaboration',
      'account',
    ];
    for (const action of ALL_GOOGLE_DRIVE_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have labels for all actions', () => {
    for (const action of ALL_GOOGLE_DRIVE_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('should have names starting with GOOGLEDRIVE_', () => {
    for (const action of ALL_GOOGLE_DRIVE_ACTIONS) {
      expect(action.name).toMatch(/^GOOGLEDRIVE_/);
    }
  });

  it('should mark destructive actions correctly', () => {
    const destructive = ALL_GOOGLE_DRIVE_ACTIONS.filter((a) => a.destructive);
    expect(destructive.length).toBeGreaterThan(0);
    for (const action of destructive) {
      expect(action.writeOperation).toBe(true);
    }
  });
});

// ============================================================================
// QUERY HELPERS
// ============================================================================

describe('GoogleDrive query helpers', () => {
  it('getFeaturedActionNames returns all action names', () => {
    const names = getGoogleDriveFeaturedActionNames();
    expect(names.length).toBe(ALL_GOOGLE_DRIVE_ACTIONS.length);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByPriority filters by max priority', () => {
    const p1 = getGoogleDriveActionsByPriority(1);
    const p2 = getGoogleDriveActionsByPriority(2);
    const p3 = getGoogleDriveActionsByPriority(3);
    expect(p1.length).toBeLessThanOrEqual(p2.length);
    expect(p2.length).toBeLessThanOrEqual(p3.length);
    expect(p1.every((a: GoogleDriveAction) => a.priority === 1)).toBe(true);
  });

  it('getActionNamesByPriority returns string array', () => {
    const names = getGoogleDriveActionNamesByPriority(2);
    expect(names.every((n: string) => typeof n === 'string')).toBe(true);
  });

  it('getActionsByCategory filters correctly', () => {
    const category: GoogleDriveActionCategory = 'files';
    const actions = getGoogleDriveActionsByCategory(category);
    expect(actions.every((a: GoogleDriveAction) => a.category === category)).toBe(true);
  });

  it('getActionPriority returns priority for known actions', () => {
    const priority = getGoogleDriveActionPriority('GOOGLEDRIVE_FIND_FILE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('getActionPriority returns 99 for unknown actions', () => {
    expect(getGoogleDriveActionPriority('UNKNOWN_ACTION')).toBe(99);
  });

  it('getActionPriority handles composio_ prefix', () => {
    const priority = getGoogleDriveActionPriority('composio_GOOGLEDRIVE_FIND_FILE');
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('isKnownAction returns true for valid actions', () => {
    expect(isKnownGoogleDriveAction('GOOGLEDRIVE_FIND_FILE')).toBe(true);
  });

  it('isKnownAction returns false for unknown actions', () => {
    expect(isKnownGoogleDriveAction('UNKNOWN_ACTION')).toBe(false);
  });

  it('isKnownAction handles composio_ prefix', () => {
    expect(isKnownGoogleDriveAction('composio_GOOGLEDRIVE_FIND_FILE')).toBe(true);
  });

  it('isDestructiveAction returns correct values', () => {
    expect(isDestructiveGoogleDriveAction('UNKNOWN_ACTION')).toBe(false);
    expect(
      isDestructiveGoogleDriveAction('GOOGLEDRIVE_GOOGLE_DRIVE_DELETE_FOLDER_OR_FILE_ACTION')
    ).toBe(true);
  });

  it('sortByPriority sorts tools correctly', () => {
    const tools = [{ name: 'UNKNOWN_TOOL' }, { name: 'GOOGLEDRIVE_FIND_FILE' }];
    const sorted = sortByGoogleDrivePriority(tools);
    expect(sorted[0].name).toBe('GOOGLEDRIVE_FIND_FILE');
    expect(sorted[1].name).toBe('UNKNOWN_TOOL');
  });
});

// ============================================================================
// STATS & PROMPTS
// ============================================================================

describe('GoogleDrive stats and prompts', () => {
  it('getActionStats returns correct totals', () => {
    const stats = getGoogleDriveActionStats();
    expect(stats.total).toBe(ALL_GOOGLE_DRIVE_ACTIONS.length);
    const prioritySum = Object.values(stats.byPriority).reduce((a: number, b: number) => a + b, 0);
    expect(prioritySum).toBe(stats.total);
    const categorySum = Object.values(stats.byCategory).reduce((a: number, b: number) => a + b, 0);
    expect(categorySum).toBe(stats.total);
  });

  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getGoogleDriveSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(typeof prompt).toBe('string');
  });

  it('getCapabilitySummary returns summary string', () => {
    const summary = getGoogleDriveCapabilitySummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Google');
  });

  it('logToolkitStats does not throw', () => {
    expect(() => logGoogleDriveToolkitStats()).not.toThrow();
  });
});
