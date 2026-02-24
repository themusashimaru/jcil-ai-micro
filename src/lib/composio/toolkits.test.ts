/**
 * TESTS FOR: src/lib/composio/toolkits.ts
 *
 * Covers all 9 exports:
 *   1. POPULAR_TOOLKITS (const)
 *   2. ALL_TOOLKITS (const)
 *   3. TOOLKITS_BY_CATEGORY (const)
 *   4. getToolkitById (function)
 *   5. composioSlugToToolkitId (function)
 *   6. getToolkitsByCategory (function)
 *   7. getPopularToolkits (function)
 *   8. searchToolkits (function)
 *   9. getTotalIntegrationsCount (function)
 */

import { describe, it, expect, vi } from 'vitest';

// Mock logger before any toolkit imports (individual toolkit files use @/lib/logger)
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  POPULAR_TOOLKITS,
  ALL_TOOLKITS,
  TOOLKITS_BY_CATEGORY,
  getToolkitById,
  composioSlugToToolkitId,
  getToolkitsByCategory,
  getPopularToolkits,
  searchToolkits,
  getTotalIntegrationsCount,
} from './toolkits';

import type { ToolkitCategory, ToolkitConfig } from './types';

// ============================================================================
// POPULAR_TOOLKITS
// ============================================================================

describe('POPULAR_TOOLKITS', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(POPULAR_TOOLKITS)).toBe(true);
    expect(POPULAR_TOOLKITS.length).toBeGreaterThan(0);
  });

  it('should contain only toolkits marked as popular', () => {
    for (const toolkit of POPULAR_TOOLKITS) {
      expect(toolkit.popular).toBe(true);
    }
  });

  it('should include well-known toolkits like GitHub, Gmail, Slack', () => {
    const ids = POPULAR_TOOLKITS.map((t) => t.id);
    expect(ids).toContain('GITHUB');
    expect(ids).toContain('GMAIL');
    expect(ids).toContain('SLACK');
  });

  it('should have valid ToolkitConfig shape for each entry', () => {
    for (const toolkit of POPULAR_TOOLKITS) {
      expect(toolkit).toHaveProperty('id');
      expect(toolkit).toHaveProperty('displayName');
      expect(toolkit).toHaveProperty('description');
      expect(toolkit).toHaveProperty('icon');
      expect(toolkit).toHaveProperty('category');
      expect(toolkit).toHaveProperty('authType');
      expect(typeof toolkit.id).toBe('string');
      expect(typeof toolkit.displayName).toBe('string');
      expect(typeof toolkit.description).toBe('string');
      expect(typeof toolkit.icon).toBe('string');
      expect(['oauth2', 'api_key', 'basic']).toContain(toolkit.authType);
    }
  });

  it('should have 17 popular toolkits', () => {
    expect(POPULAR_TOOLKITS.length).toBe(17);
  });
});

// ============================================================================
// ALL_TOOLKITS
// ============================================================================

describe('ALL_TOOLKITS', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(ALL_TOOLKITS)).toBe(true);
    expect(ALL_TOOLKITS.length).toBeGreaterThan(0);
  });

  it('should contain more toolkits than POPULAR_TOOLKITS', () => {
    expect(ALL_TOOLKITS.length).toBeGreaterThan(POPULAR_TOOLKITS.length);
  });

  it('should have unique IDs across all toolkits', () => {
    const ids = ALL_TOOLKITS.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have valid category values for all toolkits', () => {
    const validCategories: ToolkitCategory[] = [
      'communication',
      'productivity',
      'social',
      'development',
      'crm',
      'finance',
      'calendar',
      'storage',
      'analytics',
      'marketing',
      'ecommerce',
      'hr',
      'support',
      'automation',
      'media',
      'education',
      'travel',
    ];
    for (const toolkit of ALL_TOOLKITS) {
      expect(validCategories).toContain(toolkit.category);
    }
  });

  it('should have valid authType for all toolkits', () => {
    for (const toolkit of ALL_TOOLKITS) {
      expect(['oauth2', 'api_key', 'basic']).toContain(toolkit.authType);
    }
  });

  it('should include all popular toolkits', () => {
    const allIds = ALL_TOOLKITS.map((t) => t.id);
    for (const popular of POPULAR_TOOLKITS) {
      expect(allIds).toContain(popular.id);
    }
  });

  it('should have toolLimit defined for all toolkits', () => {
    for (const toolkit of ALL_TOOLKITS) {
      expect(toolkit.toolLimit).toBeDefined();
      expect(typeof toolkit.toolLimit).toBe('number');
      expect(toolkit.toolLimit).toBeGreaterThan(0);
    }
  });

  it('should have featuredActions as an array (or undefined) for all toolkits', () => {
    for (const toolkit of ALL_TOOLKITS) {
      if (toolkit.featuredActions !== undefined) {
        expect(Array.isArray(toolkit.featuredActions)).toBe(true);
      }
    }
  });

  it('should have non-empty descriptions for all toolkits', () => {
    for (const toolkit of ALL_TOOLKITS) {
      expect(toolkit.description.length).toBeGreaterThan(0);
    }
  });

  it('should have non-empty displayName for all toolkits', () => {
    for (const toolkit of ALL_TOOLKITS) {
      expect(toolkit.displayName.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// TOOLKITS_BY_CATEGORY
// ============================================================================

describe('TOOLKITS_BY_CATEGORY', () => {
  it('should be a record with all category keys', () => {
    const expectedCategories: ToolkitCategory[] = [
      'communication',
      'productivity',
      'social',
      'development',
      'crm',
      'finance',
      'calendar',
      'storage',
      'analytics',
      'marketing',
      'ecommerce',
      'hr',
      'support',
      'automation',
      'media',
      'education',
      'travel',
    ];
    for (const cat of expectedCategories) {
      expect(TOOLKITS_BY_CATEGORY).toHaveProperty(cat);
      expect(Array.isArray(TOOLKITS_BY_CATEGORY[cat])).toBe(true);
    }
  });

  it('should group toolkits correctly by category', () => {
    for (const [category, toolkits] of Object.entries(TOOLKITS_BY_CATEGORY)) {
      for (const toolkit of toolkits) {
        expect(toolkit.category).toBe(category);
      }
    }
  });

  it('should have communication toolkits including Gmail and Slack', () => {
    const commIds = TOOLKITS_BY_CATEGORY.communication.map((t) => t.id);
    expect(commIds).toContain('GMAIL');
    expect(commIds).toContain('SLACK');
    expect(commIds).toContain('DISCORD');
  });

  it('should have development toolkits including GitHub', () => {
    const devIds = TOOLKITS_BY_CATEGORY.development.map((t) => t.id);
    expect(devIds).toContain('GITHUB');
  });

  it('should have the total count across all categories equal ALL_TOOLKITS length', () => {
    let totalCount = 0;
    for (const toolkits of Object.values(TOOLKITS_BY_CATEGORY)) {
      totalCount += toolkits.length;
    }
    expect(totalCount).toBe(ALL_TOOLKITS.length);
  });

  it('should have empty arrays for categories with no toolkits (e.g., hr, education)', () => {
    // These categories exist in ToolkitCategory but have no toolkits defined in ALL_TOOLKITS
    expect(TOOLKITS_BY_CATEGORY.hr).toEqual([]);
    expect(TOOLKITS_BY_CATEGORY.education).toEqual([]);
    expect(TOOLKITS_BY_CATEGORY.automation).toEqual([]);
  });
});

// ============================================================================
// getToolkitById
// ============================================================================

describe('getToolkitById', () => {
  it('should return a toolkit by exact ID match', () => {
    const result = getToolkitById('GITHUB');
    expect(result).toBeDefined();
    expect(result!.id).toBe('GITHUB');
    expect(result!.displayName).toBe('GitHub');
  });

  it('should return a toolkit by lowercase ID', () => {
    const result = getToolkitById('github');
    expect(result).toBeDefined();
    expect(result!.id).toBe('GITHUB');
  });

  it('should return a toolkit by slug format without underscores', () => {
    const result = getToolkitById('googlesheets');
    expect(result).toBeDefined();
    expect(result!.id).toBe('GOOGLE_SHEETS');
  });

  it('should return a toolkit by hyphenated slug format', () => {
    const result = getToolkitById('google-sheets');
    expect(result).toBeDefined();
    expect(result!.id).toBe('GOOGLE_SHEETS');
  });

  it('should return a toolkit by underscore format (lowercase)', () => {
    const result = getToolkitById('google_sheets');
    expect(result).toBeDefined();
    expect(result!.id).toBe('GOOGLE_SHEETS');
  });

  it('should return undefined for empty string', () => {
    expect(getToolkitById('')).toBeUndefined();
  });

  it('should return undefined for non-existent toolkit', () => {
    expect(getToolkitById('NON_EXISTENT_TOOLKIT')).toBeUndefined();
  });

  it('should handle mixed case input', () => {
    const result = getToolkitById('Google_Sheets');
    expect(result).toBeDefined();
    expect(result!.id).toBe('GOOGLE_SHEETS');
  });

  it('should handle Microsoft Teams with various formats', () => {
    expect(getToolkitById('MICROSOFT_TEAMS')?.id).toBe('MICROSOFT_TEAMS');
    expect(getToolkitById('microsoftteams')?.id).toBe('MICROSOFT_TEAMS');
    expect(getToolkitById('microsoft-teams')?.id).toBe('MICROSOFT_TEAMS');
  });

  it('should return the full ToolkitConfig object', () => {
    const result = getToolkitById('SLACK');
    expect(result).toBeDefined();
    expect(result).toHaveProperty('id', 'SLACK');
    expect(result).toHaveProperty('displayName', 'Slack');
    expect(result).toHaveProperty('category', 'communication');
    expect(result).toHaveProperty('authType', 'oauth2');
    expect(result).toHaveProperty('popular', true);
  });
});

// ============================================================================
// composioSlugToToolkitId
// ============================================================================

describe('composioSlugToToolkitId', () => {
  it('should convert a known Composio slug to internal toolkit ID', () => {
    expect(composioSlugToToolkitId('googlesheets')).toBe('GOOGLE_SHEETS');
  });

  it('should convert github slug to GITHUB', () => {
    expect(composioSlugToToolkitId('github')).toBe('GITHUB');
  });

  it('should convert hyphenated slug to internal ID', () => {
    expect(composioSlugToToolkitId('google-docs')).toBe('GOOGLE_DOCS');
  });

  it('should return uppercased slug for unknown toolkits', () => {
    expect(composioSlugToToolkitId('unknowntool')).toBe('UNKNOWNTOOL');
  });

  it('should handle already-uppercased input', () => {
    expect(composioSlugToToolkitId('GMAIL')).toBe('GMAIL');
  });

  it('should handle mixed case with hyphens for unknown slug', () => {
    expect(composioSlugToToolkitId('my-custom-tool')).toBe('MY-CUSTOM-TOOL');
  });

  it('should correctly map microsoft teams slug', () => {
    expect(composioSlugToToolkitId('microsoftteams')).toBe('MICROSOFT_TEAMS');
  });
});

// ============================================================================
// getToolkitsByCategory
// ============================================================================

describe('getToolkitsByCategory', () => {
  it('should return communication toolkits', () => {
    const result = getToolkitsByCategory('communication');
    expect(result.length).toBeGreaterThan(0);
    for (const toolkit of result) {
      expect(toolkit.category).toBe('communication');
    }
  });

  it('should return development toolkits', () => {
    const result = getToolkitsByCategory('development');
    expect(result.length).toBeGreaterThan(0);
    for (const toolkit of result) {
      expect(toolkit.category).toBe('development');
    }
  });

  it('should return empty array for categories with no toolkits', () => {
    const result = getToolkitsByCategory('hr');
    expect(result).toEqual([]);
  });

  it('should return the same result as TOOLKITS_BY_CATEGORY lookup', () => {
    const categories: ToolkitCategory[] = [
      'communication',
      'productivity',
      'social',
      'development',
    ];
    for (const cat of categories) {
      expect(getToolkitsByCategory(cat)).toEqual(TOOLKITS_BY_CATEGORY[cat]);
    }
  });

  it('should return social toolkits including Twitter and LinkedIn', () => {
    const result = getToolkitsByCategory('social');
    const ids = result.map((t) => t.id);
    expect(ids).toContain('TWITTER');
    expect(ids).toContain('LINKEDIN');
  });

  it('should return storage toolkits including Google Drive', () => {
    const result = getToolkitsByCategory('storage');
    const ids = result.map((t) => t.id);
    expect(ids).toContain('GOOGLE_DRIVE');
  });
});

// ============================================================================
// getPopularToolkits
// ============================================================================

describe('getPopularToolkits', () => {
  it('should return the POPULAR_TOOLKITS array', () => {
    const result = getPopularToolkits();
    expect(result).toBe(POPULAR_TOOLKITS);
  });

  it('should return a non-empty array', () => {
    const result = getPopularToolkits();
    expect(result.length).toBeGreaterThan(0);
  });

  it('should only contain toolkits with popular=true', () => {
    const result = getPopularToolkits();
    for (const toolkit of result) {
      expect(toolkit.popular).toBe(true);
    }
  });

  it('should include GitHub and Gmail', () => {
    const result = getPopularToolkits();
    const ids = result.map((t) => t.id);
    expect(ids).toContain('GITHUB');
    expect(ids).toContain('GMAIL');
  });
});

// ============================================================================
// searchToolkits
// ============================================================================

describe('searchToolkits', () => {
  it('should find toolkits by display name', () => {
    const results = searchToolkits('GitHub');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.id === 'GITHUB')).toBe(true);
  });

  it('should find toolkits by partial display name (case-insensitive)', () => {
    const results = searchToolkits('git');
    expect(results.length).toBeGreaterThan(0);
    // Should match GitHub, GitLab, and possibly others
    const ids = results.map((t) => t.id);
    expect(ids).toContain('GITHUB');
    expect(ids).toContain('GITLAB');
  });

  it('should find toolkits by description keywords', () => {
    const results = searchToolkits('email');
    expect(results.length).toBeGreaterThan(0);
    // Outlook and SendGrid mention "email" in their descriptions
    const ids = results.map((t) => t.id);
    expect(ids).toContain('MICROSOFT_OUTLOOK');
  });

  it('should find toolkits by ID', () => {
    const results = searchToolkits('gmail');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.id === 'GMAIL')).toBe(true);
  });

  it('should be case-insensitive', () => {
    const upper = searchToolkits('SLACK');
    const lower = searchToolkits('slack');
    const mixed = searchToolkits('Slack');
    expect(upper.length).toBe(lower.length);
    expect(upper.length).toBe(mixed.length);
    expect(upper.every((t) => t.id === lower.find((l) => l.id === t.id)?.id)).toBe(true);
  });

  it('should return empty array for unmatched query', () => {
    const results = searchToolkits('xyznonexistenttoolkit');
    expect(results).toEqual([]);
  });

  it('should find toolkits matching description with "deploy"', () => {
    const results = searchToolkits('deploy');
    expect(results.length).toBeGreaterThan(0);
    // Vercel mentions deployments
    const ids = results.map((t) => t.id);
    expect(ids).toContain('VERCEL');
  });

  it('should find multiple Google toolkits when searching "google"', () => {
    const results = searchToolkits('google');
    expect(results.length).toBeGreaterThan(5);
    const ids = results.map((t) => t.id);
    expect(ids).toContain('GOOGLE_DOCS');
    expect(ids).toContain('GOOGLE_SHEETS');
    expect(ids).toContain('GOOGLE_DRIVE');
  });

  it('should handle empty string by returning all toolkits', () => {
    const results = searchToolkits('');
    expect(results.length).toBe(ALL_TOOLKITS.length);
  });
});

// ============================================================================
// getTotalIntegrationsCount
// ============================================================================

describe('getTotalIntegrationsCount', () => {
  it('should return the length of ALL_TOOLKITS', () => {
    expect(getTotalIntegrationsCount()).toBe(ALL_TOOLKITS.length);
  });

  it('should return a positive number', () => {
    expect(getTotalIntegrationsCount()).toBeGreaterThan(0);
  });

  it('should be at least 60 (67 approved integrations per docs)', () => {
    expect(getTotalIntegrationsCount()).toBeGreaterThanOrEqual(60);
  });
});

// ============================================================================
// CROSS-CUTTING INTEGRATION TESTS
// ============================================================================

describe('cross-cutting integration', () => {
  it('every POPULAR_TOOLKIT should be findable via getToolkitById', () => {
    for (const toolkit of POPULAR_TOOLKITS) {
      const found = getToolkitById(toolkit.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(toolkit.id);
    }
  });

  it('every ALL_TOOLKITS entry should be in exactly one category bucket', () => {
    for (const toolkit of ALL_TOOLKITS) {
      const categoryToolkits = TOOLKITS_BY_CATEGORY[toolkit.category as ToolkitCategory];
      expect(categoryToolkits).toBeDefined();
      expect(categoryToolkits.some((t: ToolkitConfig) => t.id === toolkit.id)).toBe(true);
    }
  });

  it('searchToolkits results should all be valid toolkit configs', () => {
    const results = searchToolkits('google');
    for (const toolkit of results) {
      expect(toolkit).toHaveProperty('id');
      expect(toolkit).toHaveProperty('displayName');
      expect(toolkit).toHaveProperty('description');
      expect(toolkit).toHaveProperty('category');
      expect(toolkit).toHaveProperty('authType');
    }
  });

  it('composioSlugToToolkitId should return IDs that getToolkitById can find', () => {
    const knownSlugs = ['github', 'gmail', 'slack', 'googlesheets', 'google-docs'];
    for (const slug of knownSlugs) {
      const internalId = composioSlugToToolkitId(slug);
      const toolkit = getToolkitById(internalId);
      expect(toolkit).toBeDefined();
    }
  });
});
