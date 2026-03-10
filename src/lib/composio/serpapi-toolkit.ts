/**
 * COMPOSIO SERPAPI TOOLKIT
 * ========================
 *
 * Comprehensive SerpAPI integration via Composio's search tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Search (Google web search, videos, scholar, autocomplete, related, trends, patents)
 * - Images (image search)
 * - News (news search)
 * - Shopping (shopping search)
 * - Local (local business search, maps)
 */

import { logger } from '@/lib/logger';

const log = logger('SerpAPIToolkit');

// ============================================================================
// SERPAPI ACTION CATEGORIES
// ============================================================================

export type SerpAPIActionCategory = 'search' | 'images' | 'news' | 'shopping' | 'local';

export interface SerpAPIAction {
  name: string; // Composio action name (e.g., SERPAPI_GOOGLE_SEARCH)
  label: string; // Human-readable label
  category: SerpAPIActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when SerpAPI connected)
// ============================================================================

const ESSENTIAL_ACTIONS: SerpAPIAction[] = [
  // Search
  {
    name: 'SERPAPI_GOOGLE_SEARCH',
    label: 'Google Search',
    category: 'search',
    priority: 1,
  },

  // Images
  {
    name: 'SERPAPI_SEARCH_IMAGES',
    label: 'Image Search',
    category: 'images',
    priority: 1,
  },

  // News
  {
    name: 'SERPAPI_SEARCH_NEWS',
    label: 'News Search',
    category: 'news',
    priority: 1,
  },

  // Shopping
  {
    name: 'SERPAPI_SEARCH_SHOPPING',
    label: 'Shopping Search',
    category: 'shopping',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: SerpAPIAction[] = [
  // Local
  {
    name: 'SERPAPI_SEARCH_LOCAL',
    label: 'Local Search',
    category: 'local',
    priority: 2,
  },

  // Search - Extended
  {
    name: 'SERPAPI_SEARCH_VIDEOS',
    label: 'Video Search',
    category: 'search',
    priority: 2,
  },
  {
    name: 'SERPAPI_SEARCH_SCHOLAR',
    label: 'Scholar Search',
    category: 'search',
    priority: 2,
  },
  {
    name: 'SERPAPI_GET_SEARCH_RESULTS',
    label: 'Get Search Results',
    category: 'search',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: SerpAPIAction[] = [
  // Local - Extended
  {
    name: 'SERPAPI_SEARCH_MAPS',
    label: 'Maps Search',
    category: 'local',
    priority: 3,
  },

  // Search - Extended
  {
    name: 'SERPAPI_SEARCH_AUTOCOMPLETE',
    label: 'Autocomplete Search',
    category: 'search',
    priority: 3,
  },
  {
    name: 'SERPAPI_SEARCH_RELATED',
    label: 'Related Search',
    category: 'search',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Specialized operations)
// ============================================================================

const ADVANCED_ACTIONS: SerpAPIAction[] = [
  {
    name: 'SERPAPI_GET_ACCOUNT_INFO',
    label: 'Account Info',
    category: 'search',
    priority: 4,
  },
  {
    name: 'SERPAPI_SEARCH_TRENDS',
    label: 'Trends Search',
    category: 'search',
    priority: 4,
  },
  {
    name: 'SERPAPI_SEARCH_PATENTS',
    label: 'Patents Search',
    category: 'search',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_SERPAPI_ACTIONS: SerpAPIAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getSerpAPIFeaturedActionNames(): string[] {
  return ALL_SERPAPI_ACTIONS.map((a) => a.name);
}

export function getSerpAPIActionsByPriority(maxPriority: number = 3): SerpAPIAction[] {
  return ALL_SERPAPI_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getSerpAPIActionNamesByPriority(maxPriority: number = 3): string[] {
  return getSerpAPIActionsByPriority(maxPriority).map((a) => a.name);
}

export function getSerpAPIActionsByCategory(category: SerpAPIActionCategory): SerpAPIAction[] {
  return ALL_SERPAPI_ACTIONS.filter((a) => a.category === category);
}

export function getSerpAPIActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_SERPAPI_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownSerpAPIAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SERPAPI_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveSerpAPIAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SERPAPI_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by SerpAPI action priority.
 * Known SerpAPI actions sorted by priority (1-4), unknown actions last.
 */
export function sortBySerpAPIPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getSerpAPIActionPriority(a.name) - getSerpAPIActionPriority(b.name);
  });
}

export function getSerpAPIActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_SERPAPI_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_SERPAPI_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate SerpAPI-specific system prompt when user has SerpAPI connected.
 * Tells Claude exactly what it can do via the Composio SerpAPI toolkit.
 */
export function getSerpAPISystemPrompt(): string {
  return `
## SerpAPI Integration (Full Capabilities)

You have **full SerpAPI access** through the user's connected account. Use the \`composio_SERPAPI_*\` tools.

### Google Search
- Perform Google web searches with full result parsing
- Get organic results, featured snippets, and knowledge panels
- Retrieve related searches and "People Also Ask" data
- Access autocomplete suggestions for query refinement

### Image Search
- Search Google Images with filtering options
- Get image results with thumbnails, sources, and metadata

### News Search
- Search Google News for current events and articles
- Get news results with publication dates, sources, and snippets

### Shopping Search
- Search Google Shopping for product listings
- Get pricing, merchant details, and product comparisons

### Local Search
- Search for local businesses and places
- Get Google Maps results with locations, ratings, and reviews
- Find nearby services with geographic context

### Scholarly Search
- Search Google Scholar for academic papers and citations
- Find research articles, theses, and academic publications

### Advanced
- Track search trends and popular queries
- Search patent databases for intellectual property research
- Retrieve account information and usage stats

### Safety Rules
1. **All operations are read-only** - SerpAPI only retrieves search results and does not modify any external data
2. **Information retrieval only** - these tools fetch publicly available search data from Google and other engines
3. **Present results clearly** - always organize search results with titles, snippets, and source URLs
4. **Cite sources** - when presenting search results, always include the source URL so the user can verify
5. **Be transparent about limitations** - search results may not be exhaustive; suggest refining queries if needed
6. **Respect user intent** - use the most appropriate search type for the user's query (e.g., news for current events, scholar for academic research, local for nearby places)
7. **For multi-step research**, summarize findings and offer to search deeper on specific topics
8. **Handle sensitive topics carefully** - present factual search results without editorializing
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getSerpAPICapabilitySummary(): string {
  const stats = getSerpAPIActionStats();
  return `SerpAPI (${stats.total} actions: search, images, news, shopping, local, scholar)`;
}

export function logSerpAPIToolkitStats(): void {
  const stats = getSerpAPIActionStats();
  log.info('SerpAPI Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
