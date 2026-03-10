/**
 * COMPOSIO GOOGLE SEARCH CONSOLE TOOLKIT
 * =======================================
 *
 * Comprehensive Google Search Console integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Search (analytics queries, performance data by page/query/country/device/date)
 * - Sitemaps (list, get, submit, delete sitemaps)
 * - Inspection (URL inspection, batch inspection)
 * - Sites (list, get, add, remove site properties)
 */

import { logger } from '@/lib/logger';

const log = logger('GoogleSearchConsoleToolkit');

// ============================================================================
// GOOGLE SEARCH CONSOLE ACTION CATEGORIES
// ============================================================================

export type GoogleSearchConsoleActionCategory = 'search' | 'sitemaps' | 'inspection' | 'sites';

export interface GoogleSearchConsoleAction {
  name: string; // Composio action name (e.g., GOOGLESEARCHCONSOLE_QUERY_SEARCH_ANALYTICS)
  label: string; // Human-readable label
  category: GoogleSearchConsoleActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Google Search Console connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GoogleSearchConsoleAction[] = [
  // Search
  {
    name: 'GOOGLESEARCHCONSOLE_QUERY_SEARCH_ANALYTICS',
    label: 'Query Search Analytics',
    category: 'search',
    priority: 1,
  },

  // Sites
  {
    name: 'GOOGLESEARCHCONSOLE_LIST_SITES',
    label: 'List Sites',
    category: 'sites',
    priority: 1,
  },
  {
    name: 'GOOGLESEARCHCONSOLE_GET_SITE',
    label: 'Get Site',
    category: 'sites',
    priority: 1,
  },

  // Sitemaps
  {
    name: 'GOOGLESEARCHCONSOLE_LIST_SITEMAPS',
    label: 'List Sitemaps',
    category: 'sitemaps',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GoogleSearchConsoleAction[] = [
  // Sitemaps
  {
    name: 'GOOGLESEARCHCONSOLE_SUBMIT_SITEMAP',
    label: 'Submit Sitemap',
    category: 'sitemaps',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLESEARCHCONSOLE_GET_SITEMAP',
    label: 'Get Sitemap',
    category: 'sitemaps',
    priority: 2,
  },

  // Inspection
  {
    name: 'GOOGLESEARCHCONSOLE_INSPECT_URL',
    label: 'Inspect URL',
    category: 'inspection',
    priority: 2,
  },

  // Sites
  {
    name: 'GOOGLESEARCHCONSOLE_ADD_SITE',
    label: 'Add Site',
    category: 'sites',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GoogleSearchConsoleAction[] = [
  // Sitemaps
  {
    name: 'GOOGLESEARCHCONSOLE_DELETE_SITEMAP',
    label: 'Delete Sitemap',
    category: 'sitemaps',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Search - Dimension-specific queries
  {
    name: 'GOOGLESEARCHCONSOLE_QUERY_BY_PAGE',
    label: 'Query by Page',
    category: 'search',
    priority: 3,
  },
  {
    name: 'GOOGLESEARCHCONSOLE_QUERY_BY_QUERY',
    label: 'Query by Query',
    category: 'search',
    priority: 3,
  },
  {
    name: 'GOOGLESEARCHCONSOLE_QUERY_BY_COUNTRY',
    label: 'Query by Country',
    category: 'search',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: GoogleSearchConsoleAction[] = [
  {
    name: 'GOOGLESEARCHCONSOLE_REMOVE_SITE',
    label: 'Remove Site',
    category: 'sites',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLESEARCHCONSOLE_QUERY_BY_DEVICE',
    label: 'Query by Device',
    category: 'search',
    priority: 4,
  },
  {
    name: 'GOOGLESEARCHCONSOLE_QUERY_BY_DATE',
    label: 'Query by Date',
    category: 'search',
    priority: 4,
  },
  {
    name: 'GOOGLESEARCHCONSOLE_BATCH_INSPECT_URLS',
    label: 'Batch Inspect URLs',
    category: 'inspection',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS: GoogleSearchConsoleAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGoogleSearchConsoleFeaturedActionNames(): string[] {
  return ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS.map((a) => a.name);
}

export function getGoogleSearchConsoleActionsByPriority(
  maxPriority: number = 3
): GoogleSearchConsoleAction[] {
  return ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGoogleSearchConsoleActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGoogleSearchConsoleActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGoogleSearchConsoleActionsByCategory(
  category: GoogleSearchConsoleActionCategory
): GoogleSearchConsoleAction[] {
  return ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS.filter((a) => a.category === category);
}

export function getGoogleSearchConsoleActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGoogleSearchConsoleAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGoogleSearchConsoleAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Google Search Console action priority.
 * Known Google Search Console actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGoogleSearchConsolePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return (
      getGoogleSearchConsoleActionPriority(a.name) - getGoogleSearchConsoleActionPriority(b.name)
    );
  });
}

export function getGoogleSearchConsoleActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Google Search Console-specific system prompt when user has GSC connected.
 * Tells Claude exactly what it can do via the Composio Google Search Console toolkit.
 */
export function getGoogleSearchConsoleSystemPrompt(): string {
  return `
## Google Search Console Integration (Full Capabilities)

You have **full Google Search Console access** through the user's connected account. Use the \`composio_GOOGLESEARCHCONSOLE_*\` tools.

### Search Analytics
- Query search performance data (clicks, impressions, CTR, position)
- Filter analytics by page, query, country, device, or date range
- Analyze search traffic trends and keyword performance
- Identify top-performing pages and queries
- Compare performance across different dimensions

### Sitemap Management
- List all sitemaps submitted for a site property
- Get detailed status of a specific sitemap
- Submit new sitemaps to notify Google of site content
- Delete sitemaps that are no longer needed

### URL Inspection
- Inspect individual URLs for indexing status and crawl details
- Check if a URL is indexed, has errors, or needs attention
- Batch inspect multiple URLs for bulk indexing analysis
- Review coverage issues and mobile usability

### SEO Monitoring
- Monitor site properties and their verification status
- Track search appearance and rich result performance
- Identify indexing issues and crawl errors
- Analyze click-through rates and average positions

### Site Management
- List all verified site properties in the account
- Get details about a specific site property
- Add new site properties for monitoring
- Remove site properties from the account

### Safety Rules
1. **ALWAYS confirm before modifying site properties** - show site URL and action details:
\`\`\`action-preview
{
  "platform": "Google Search Console",
  "action": "Add Site",
  "siteUrl": "https://example.com",
  "toolName": "composio_GOOGLESEARCHCONSOLE_ADD_SITE",
  "toolParams": { "siteUrl": "..." }
}
\`\`\`
2. **Confirm before deleting sitemaps** - show sitemap URL and associated site property
3. **Never remove a site property without explicit approval** - removal affects all users with access
4. **For search analytics queries**, clearly show the date range, dimensions, and filters being used
5. **Present analytics data clearly** - use tables or structured formats for metrics like clicks, impressions, CTR, and position
6. **For batch URL inspections**, summarize the URLs to be inspected and get approval first
7. **Handle SEO data responsibly** - search performance data may be business-sensitive
8. **For sitemap submissions**, verify the sitemap URL is valid before submitting
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGoogleSearchConsoleCapabilitySummary(): string {
  const stats = getGoogleSearchConsoleActionStats();
  return `Google Search Console (${stats.total} actions: search analytics, sitemaps, URL inspection, site management)`;
}

export function logGoogleSearchConsoleToolkitStats(): void {
  const stats = getGoogleSearchConsoleActionStats();
  log.info('Google Search Console Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
