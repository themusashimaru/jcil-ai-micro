/**
 * TESTS FOR: src/lib/composio/toolkits.ts
 * ========================================
 *
 * Comprehensive tests covering all 9 exported symbols:
 *   1. POPULAR_TOOLKITS (const)
 *   2. ALL_TOOLKITS (const)
 *   3. TOOLKITS_BY_CATEGORY (const)
 *   4. getToolkitById (function)
 *   5. composioSlugToToolkitId (function)
 *   6. getToolkitsByCategory (function)
 *   7. getPopularToolkits (function)
 *   8. searchToolkits (function)
 *   9. getTotalIntegrationsCount (function)
 *
 * Plus cross-cutting integration tests and data integrity checks.
 */

// vi.mock() calls MUST be before any imports of the module under test
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { describe, it, expect, vi } from 'vitest';
import type { ToolkitCategory, ToolkitConfig } from './types';
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

// ============================================================================
// CONSTANTS: valid categories and auth types from the types definition
// ============================================================================

const ALL_VALID_CATEGORIES: ToolkitCategory[] = [
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

const VALID_AUTH_TYPES: Array<'oauth2' | 'api_key' | 'basic'> = ['oauth2', 'api_key', 'basic'];

// ============================================================================
// POPULAR_TOOLKITS
// ============================================================================

describe('POPULAR_TOOLKITS', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(POPULAR_TOOLKITS)).toBe(true);
    expect(POPULAR_TOOLKITS.length).toBeGreaterThan(0);
  });

  it('should contain exactly 17 popular toolkits', () => {
    expect(POPULAR_TOOLKITS).toHaveLength(17);
  });

  it('should contain only toolkits marked as popular', () => {
    for (const toolkit of POPULAR_TOOLKITS) {
      expect(toolkit.popular).toBe(true);
    }
  });

  it('should include well-known toolkits: GitHub, Gmail, Slack, Notion, Jira', () => {
    const ids = POPULAR_TOOLKITS.map((t) => t.id);
    expect(ids).toContain('GITHUB');
    expect(ids).toContain('GMAIL');
    expect(ids).toContain('SLACK');
    expect(ids).toContain('NOTION');
    expect(ids).toContain('JIRA');
  });

  it('should have valid ToolkitConfig shape for each entry', () => {
    for (const toolkit of POPULAR_TOOLKITS) {
      expect(typeof toolkit.id).toBe('string');
      expect(toolkit.id.length).toBeGreaterThan(0);
      expect(typeof toolkit.displayName).toBe('string');
      expect(toolkit.displayName.length).toBeGreaterThan(0);
      expect(typeof toolkit.description).toBe('string');
      expect(toolkit.description.length).toBeGreaterThan(0);
      expect(typeof toolkit.icon).toBe('string');
      expect(toolkit.icon.length).toBeGreaterThan(0);
      expect(ALL_VALID_CATEGORIES).toContain(toolkit.category);
      expect(VALID_AUTH_TYPES).toContain(toolkit.authType);
    }
  });

  it('should have numeric toolLimit on every popular toolkit', () => {
    for (const toolkit of POPULAR_TOOLKITS) {
      expect(typeof toolkit.toolLimit).toBe('number');
      expect(toolkit.toolLimit).toBeGreaterThan(0);
    }
  });

  it('should have featuredActions as arrays when present', () => {
    for (const toolkit of POPULAR_TOOLKITS) {
      if (toolkit.featuredActions !== undefined) {
        expect(Array.isArray(toolkit.featuredActions)).toBe(true);
      }
    }
  });

  it('should span multiple categories', () => {
    const categories = new Set(POPULAR_TOOLKITS.map((t) => t.category));
    expect(categories.size).toBeGreaterThanOrEqual(4);
    expect(categories.has('communication')).toBe(true);
    expect(categories.has('development')).toBe(true);
    expect(categories.has('social')).toBe(true);
    expect(categories.has('productivity')).toBe(true);
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

  it('should contain 67 approved integrations', () => {
    expect(ALL_TOOLKITS).toHaveLength(67);
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
    for (const toolkit of ALL_TOOLKITS) {
      expect(ALL_VALID_CATEGORIES).toContain(toolkit.category);
    }
  });

  it('should have valid authType for all toolkits', () => {
    for (const toolkit of ALL_TOOLKITS) {
      expect(VALID_AUTH_TYPES).toContain(toolkit.authType);
    }
  });

  it('should include all popular toolkits', () => {
    const allIds = new Set(ALL_TOOLKITS.map((t) => t.id));
    for (const popular of POPULAR_TOOLKITS) {
      expect(allIds.has(popular.id)).toBe(true);
    }
  });

  it('should have toolLimit defined as a positive number for all toolkits', () => {
    for (const toolkit of ALL_TOOLKITS) {
      expect(toolkit.toolLimit).toBeDefined();
      expect(typeof toolkit.toolLimit).toBe('number');
      expect(toolkit.toolLimit).toBeGreaterThan(0);
      expect(toolkit.toolLimit).toBeLessThanOrEqual(200);
    }
  });

  it('should have featuredActions as an array (or undefined) for all toolkits', () => {
    for (const toolkit of ALL_TOOLKITS) {
      if (toolkit.featuredActions !== undefined) {
        expect(Array.isArray(toolkit.featuredActions)).toBe(true);
        for (const action of toolkit.featuredActions) {
          expect(typeof action).toBe('string');
        }
      }
    }
  });

  it('should have non-empty descriptions and displayNames for all toolkits', () => {
    for (const toolkit of ALL_TOOLKITS) {
      expect(toolkit.description.length).toBeGreaterThan(10);
      expect(toolkit.displayName.length).toBeGreaterThan(0);
    }
  });

  it('should have all IDs in uppercase format', () => {
    for (const toolkit of ALL_TOOLKITS) {
      expect(toolkit.id).toBe(toolkit.id.toUpperCase());
    }
  });

  it('should include both oauth2 and api_key auth types', () => {
    const authTypes = new Set(ALL_TOOLKITS.map((t) => t.authType));
    expect(authTypes.has('oauth2')).toBe(true);
    expect(authTypes.has('api_key')).toBe(true);
  });

  it('should include toolkits from all batches', () => {
    const ids = ALL_TOOLKITS.map((t) => t.id);
    // Batch 1 (popular)
    expect(ids).toContain('GMAIL');
    expect(ids).toContain('GITHUB');
    // Batch 2 (new productivity/dev)
    expect(ids).toContain('NOTION');
    expect(ids).toContain('ASANA');
    expect(ids).toContain('ZOOM');
    // Batch 3
    expect(ids).toContain('WHATSAPP');
    expect(ids).toContain('FIGMA');
    expect(ids).toContain('GITLAB');
    expect(ids).toContain('CONFLUENCE');
    // Batch 4
    expect(ids).toContain('TWILIO');
    expect(ids).toContain('FRESHDESK');
    expect(ids).toContain('LOOM');
    expect(ids).toContain('PAGERDUTY');
    expect(ids).toContain('BITBUCKET');
  });

  it('should cover at least 14 distinct categories', () => {
    const categories = new Set(ALL_TOOLKITS.map((t) => t.category));
    expect(categories.size).toBeGreaterThanOrEqual(14);
  });
});

// ============================================================================
// TOOLKITS_BY_CATEGORY
// ============================================================================

describe('TOOLKITS_BY_CATEGORY', () => {
  it('should be a Record with all 17 ToolkitCategory keys', () => {
    for (const category of ALL_VALID_CATEGORIES) {
      expect(TOOLKITS_BY_CATEGORY).toHaveProperty(category);
      expect(Array.isArray(TOOLKITS_BY_CATEGORY[category])).toBe(true);
    }
  });

  it('should group toolkits correctly by category', () => {
    for (const [category, toolkits] of Object.entries(TOOLKITS_BY_CATEGORY)) {
      for (const toolkit of toolkits) {
        expect(toolkit.category).toBe(category);
      }
    }
  });

  it('should have communication toolkits including Gmail, Slack, Discord', () => {
    const commIds = TOOLKITS_BY_CATEGORY.communication.map((t) => t.id);
    expect(commIds).toContain('GMAIL');
    expect(commIds).toContain('SLACK');
    expect(commIds).toContain('DISCORD');
    expect(commIds).toContain('MICROSOFT_TEAMS');
    expect(commIds).toContain('MICROSOFT_OUTLOOK');
    expect(commIds).toContain('TELEGRAM');
    expect(commIds).toContain('TWILIO');
  });

  it('should have development toolkits including GitHub, Vercel, Jira', () => {
    const devIds = TOOLKITS_BY_CATEGORY.development.map((t) => t.id);
    expect(devIds).toContain('GITHUB');
    expect(devIds).toContain('VERCEL');
    expect(devIds).toContain('JIRA');
    expect(devIds).toContain('GITLAB');
  });

  it('should have the total count across all categories equal ALL_TOOLKITS length', () => {
    let totalCount = 0;
    for (const toolkits of Object.values(TOOLKITS_BY_CATEGORY)) {
      totalCount += toolkits.length;
    }
    expect(totalCount).toBe(ALL_TOOLKITS.length);
  });

  it('should have empty arrays for categories with no toolkits', () => {
    expect(TOOLKITS_BY_CATEGORY.hr).toEqual([]);
    expect(TOOLKITS_BY_CATEGORY.education).toEqual([]);
    expect(TOOLKITS_BY_CATEGORY.automation).toEqual([]);
  });

  it('should have non-empty arrays for categories that do have toolkits', () => {
    expect(TOOLKITS_BY_CATEGORY.communication.length).toBeGreaterThan(0);
    expect(TOOLKITS_BY_CATEGORY.development.length).toBeGreaterThan(0);
    expect(TOOLKITS_BY_CATEGORY.social.length).toBeGreaterThan(0);
    expect(TOOLKITS_BY_CATEGORY.productivity.length).toBeGreaterThan(0);
    expect(TOOLKITS_BY_CATEGORY.finance.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// getToolkitById
// ============================================================================

describe('getToolkitById', () => {
  it('should return a toolkit by exact uppercase ID', () => {
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

  it('should handle mixed case input', () => {
    const result = getToolkitById('Google_Sheets');
    expect(result).toBeDefined();
    expect(result!.id).toBe('GOOGLE_SHEETS');
  });

  it('should handle Microsoft Teams with various formats', () => {
    expect(getToolkitById('MICROSOFT_TEAMS')?.id).toBe('MICROSOFT_TEAMS');
    expect(getToolkitById('microsoftteams')?.id).toBe('MICROSOFT_TEAMS');
    expect(getToolkitById('microsoft-teams')?.id).toBe('MICROSOFT_TEAMS');
    expect(getToolkitById('microsoft_teams')?.id).toBe('MICROSOFT_TEAMS');
  });

  it('should find GOOGLE_CALENDAR by slug', () => {
    const result = getToolkitById('googlecalendar');
    expect(result).toBeDefined();
    expect(result!.id).toBe('GOOGLE_CALENDAR');
  });

  it('should find PERPLEXITY_AI by slug', () => {
    const result = getToolkitById('perplexityai');
    expect(result).toBeDefined();
    expect(result!.id).toBe('PERPLEXITY_AI');
  });

  it('should return undefined for empty string', () => {
    expect(getToolkitById('')).toBeUndefined();
  });

  it('should return undefined for non-existent toolkit', () => {
    expect(getToolkitById('NON_EXISTENT_TOOLKIT')).toBeUndefined();
  });

  it('should return undefined for random string', () => {
    expect(getToolkitById('xyznotaservice')).toBeUndefined();
  });

  it('should return the full ToolkitConfig object with all required fields', () => {
    const result = getToolkitById('SLACK');
    expect(result).toBeDefined();
    expect(result).toHaveProperty('id', 'SLACK');
    expect(result).toHaveProperty('displayName', 'Slack');
    expect(result).toHaveProperty('category', 'communication');
    expect(result).toHaveProperty('authType', 'oauth2');
    expect(result).toHaveProperty('popular', true);
    expect(typeof result!.description).toBe('string');
    expect(typeof result!.icon).toBe('string');
  });

  it('should find every toolkit in ALL_TOOLKITS by its ID', () => {
    for (const toolkit of ALL_TOOLKITS) {
      const found = getToolkitById(toolkit.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(toolkit.id);
    }
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

  it('should convert underscored slug to internal ID', () => {
    expect(composioSlugToToolkitId('google_drive')).toBe('GOOGLE_DRIVE');
  });

  it('should return uppercased slug for unknown toolkits', () => {
    expect(composioSlugToToolkitId('unknowntool')).toBe('UNKNOWNTOOL');
  });

  it('should handle already-uppercased input for known toolkit', () => {
    expect(composioSlugToToolkitId('GMAIL')).toBe('GMAIL');
  });

  it('should handle mixed case with hyphens for unknown slug', () => {
    expect(composioSlugToToolkitId('my-custom-tool')).toBe('MY-CUSTOM-TOOL');
  });

  it('should correctly map multi-word slugs', () => {
    expect(composioSlugToToolkitId('microsoftteams')).toBe('MICROSOFT_TEAMS');
    expect(composioSlugToToolkitId('perplexityai')).toBe('PERPLEXITY_AI');
    expect(composioSlugToToolkitId('elevenlabs')).toBe('ELEVENLABS');
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

  it('should return development toolkits containing GitHub', () => {
    const result = getToolkitsByCategory('development');
    expect(result.length).toBeGreaterThan(0);
    const ids = result.map((t) => t.id);
    expect(ids).toContain('GITHUB');
  });

  it('should return productivity toolkits containing Notion', () => {
    const result = getToolkitsByCategory('productivity');
    expect(result.length).toBeGreaterThan(0);
    const ids = result.map((t) => t.id);
    expect(ids).toContain('NOTION');
    expect(ids).toContain('GOOGLE_DOCS');
  });

  it('should return social toolkits including Twitter and LinkedIn', () => {
    const result = getToolkitsByCategory('social');
    const ids = result.map((t) => t.id);
    expect(ids).toContain('TWITTER');
    expect(ids).toContain('LINKEDIN');
    expect(ids).toContain('INSTAGRAM');
    expect(ids).toContain('YOUTUBE');
    expect(ids).toContain('REDDIT');
  });

  it('should return finance toolkits including Stripe', () => {
    const result = getToolkitsByCategory('finance');
    const ids = result.map((t) => t.id);
    expect(ids).toContain('STRIPE');
    expect(ids).toContain('QUICKBOOKS');
  });

  it('should return storage toolkits including Google Drive', () => {
    const result = getToolkitsByCategory('storage');
    const ids = result.map((t) => t.id);
    expect(ids).toContain('GOOGLE_DRIVE');
    expect(ids).toContain('DROPBOX');
  });

  it('should return empty array for hr category (no toolkits)', () => {
    expect(getToolkitsByCategory('hr')).toEqual([]);
  });

  it('should return empty array for automation category (no toolkits)', () => {
    expect(getToolkitsByCategory('automation')).toEqual([]);
  });

  it('should return empty array for education category (no toolkits)', () => {
    expect(getToolkitsByCategory('education')).toEqual([]);
  });

  it('should return the same result as TOOLKITS_BY_CATEGORY direct lookup', () => {
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
});

// ============================================================================
// getPopularToolkits
// ============================================================================

describe('getPopularToolkits', () => {
  it('should return the POPULAR_TOOLKITS array (reference equality)', () => {
    const result = getPopularToolkits();
    expect(result).toBe(POPULAR_TOOLKITS);
  });

  it('should return a non-empty array of 17 items', () => {
    const result = getPopularToolkits();
    expect(result).toHaveLength(17);
  });

  it('should only contain toolkits with popular=true', () => {
    for (const toolkit of getPopularToolkits()) {
      expect(toolkit.popular).toBe(true);
    }
  });

  it('should include GitHub and Gmail', () => {
    const ids = getPopularToolkits().map((t) => t.id);
    expect(ids).toContain('GITHUB');
    expect(ids).toContain('GMAIL');
  });
});

// ============================================================================
// searchToolkits
// ============================================================================

describe('searchToolkits', () => {
  it('should find toolkit by exact display name', () => {
    const results = searchToolkits('GitHub');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.id === 'GITHUB')).toBe(true);
  });

  it('should find toolkits by partial display name (case-insensitive)', () => {
    const results = searchToolkits('git');
    const ids = results.map((t) => t.id);
    expect(ids).toContain('GITHUB');
    expect(ids).toContain('GITLAB');
  });

  it('should find toolkits by description keywords', () => {
    const results = searchToolkits('email');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((t) => t.id);
    // Outlook mentions "email" in its description
    expect(ids).toContain('MICROSOFT_OUTLOOK');
  });

  it('should find toolkits by ID substring', () => {
    const results = searchToolkits('gmail');
    expect(results.some((t) => t.id === 'GMAIL')).toBe(true);
  });

  it('should be case-insensitive for all match types', () => {
    const upper = searchToolkits('SLACK');
    const lower = searchToolkits('slack');
    const mixed = searchToolkits('Slack');
    expect(upper.length).toBe(lower.length);
    expect(upper.length).toBe(mixed.length);
    expect(upper.map((t) => t.id)).toEqual(lower.map((t) => t.id));
  });

  it('should return empty array for unmatched query', () => {
    const results = searchToolkits('xyznonexistenttoolkit');
    expect(results).toEqual([]);
  });

  it('should find toolkits matching description with "deploy"', () => {
    const results = searchToolkits('deploy');
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
    expect(ids).toContain('GOOGLE_CALENDAR');
  });

  it('should handle empty string by returning all toolkits', () => {
    const results = searchToolkits('');
    expect(results.length).toBe(ALL_TOOLKITS.length);
  });

  it('should match on description containing "integration" (all toolkits)', () => {
    const results = searchToolkits('integration');
    // Every toolkit description contains "integration"
    expect(results.length).toBe(ALL_TOOLKITS.length);
  });

  it('should find Stripe when searching "payments"', () => {
    const results = searchToolkits('payments');
    const ids = results.map((t) => t.id);
    expect(ids).toContain('STRIPE');
  });
});

// ============================================================================
// getTotalIntegrationsCount
// ============================================================================

describe('getTotalIntegrationsCount', () => {
  it('should return the length of ALL_TOOLKITS', () => {
    expect(getTotalIntegrationsCount()).toBe(ALL_TOOLKITS.length);
  });

  it('should return 67', () => {
    expect(getTotalIntegrationsCount()).toBe(67);
  });

  it('should return a positive number', () => {
    expect(getTotalIntegrationsCount()).toBeGreaterThan(0);
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

  it('searchToolkits results should all be valid ToolkitConfig objects', () => {
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

  it('getToolkitsByCategory and TOOLKITS_BY_CATEGORY should agree for all categories', () => {
    for (const category of ALL_VALID_CATEGORIES) {
      expect(getToolkitsByCategory(category)).toEqual(TOOLKITS_BY_CATEGORY[category]);
    }
  });

  it('getTotalIntegrationsCount should match sum of all category counts', () => {
    let sum = 0;
    for (const category of ALL_VALID_CATEGORIES) {
      sum += getToolkitsByCategory(category).length;
    }
    expect(getTotalIntegrationsCount()).toBe(sum);
  });
});
