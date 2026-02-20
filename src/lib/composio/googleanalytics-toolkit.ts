/**
 * COMPOSIO GOOGLE ANALYTICS TOOLKIT
 * ==================================
 *
 * Comprehensive Google Analytics integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Reports (run reports, real-time, pivot, funnel, batch)
 * - Properties (list, get, custom dimensions)
 * - Audiences (list, get, create, delete)
 * - Conversions (list, get, create, delete)
 * - Admin (accounts, data streams)
 */

import { logger } from '@/lib/logger';

const log = logger('GoogleAnalyticsToolkit');

// ============================================================================
// GOOGLE ANALYTICS ACTION CATEGORIES
// ============================================================================

export type GoogleAnalyticsActionCategory =
  | 'reports'
  | 'properties'
  | 'audiences'
  | 'conversions'
  | 'admin';

export interface GoogleAnalyticsAction {
  name: string; // Composio action name (e.g., GOOGLEANALYTICS_RUN_REPORT)
  label: string; // Human-readable label
  category: GoogleAnalyticsActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Google Analytics connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GoogleAnalyticsAction[] = [
  // Reports
  {
    name: 'GOOGLEANALYTICS_RUN_REPORT',
    label: 'Run Report',
    category: 'reports',
    priority: 1,
  },
  {
    name: 'GOOGLEANALYTICS_RUN_REALTIME_REPORT',
    label: 'Run Realtime Report',
    category: 'reports',
    priority: 1,
  },

  // Properties
  {
    name: 'GOOGLEANALYTICS_LIST_PROPERTIES',
    label: 'List Properties',
    category: 'properties',
    priority: 1,
  },
  {
    name: 'GOOGLEANALYTICS_GET_PROPERTY',
    label: 'Get Property',
    category: 'properties',
    priority: 1,
  },

  // Admin
  {
    name: 'GOOGLEANALYTICS_LIST_ACCOUNTS',
    label: 'List Accounts',
    category: 'admin',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GoogleAnalyticsAction[] = [
  // Reports - Extended
  {
    name: 'GOOGLEANALYTICS_BATCH_RUN_REPORTS',
    label: 'Batch Run Reports',
    category: 'reports',
    priority: 2,
  },
  {
    name: 'GOOGLEANALYTICS_RUN_PIVOT_REPORT',
    label: 'Run Pivot Report',
    category: 'reports',
    priority: 2,
  },

  // Audiences
  {
    name: 'GOOGLEANALYTICS_LIST_AUDIENCES',
    label: 'List Audiences',
    category: 'audiences',
    priority: 2,
  },
  {
    name: 'GOOGLEANALYTICS_GET_AUDIENCE',
    label: 'Get Audience',
    category: 'audiences',
    priority: 2,
  },

  // Conversions
  {
    name: 'GOOGLEANALYTICS_LIST_CONVERSION_EVENTS',
    label: 'List Conversion Events',
    category: 'conversions',
    priority: 2,
  },
  {
    name: 'GOOGLEANALYTICS_GET_CONVERSION_EVENT',
    label: 'Get Conversion Event',
    category: 'conversions',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GoogleAnalyticsAction[] = [
  // Audiences - Extended
  {
    name: 'GOOGLEANALYTICS_CREATE_AUDIENCE',
    label: 'Create Audience',
    category: 'audiences',
    priority: 3,
    writeOperation: true,
  },

  // Conversions - Extended
  {
    name: 'GOOGLEANALYTICS_CREATE_CONVERSION_EVENT',
    label: 'Create Conversion Event',
    category: 'conversions',
    priority: 3,
    writeOperation: true,
  },

  // Properties - Extended
  {
    name: 'GOOGLEANALYTICS_LIST_CUSTOM_DIMENSIONS',
    label: 'List Custom Dimensions',
    category: 'properties',
    priority: 3,
  },
  {
    name: 'GOOGLEANALYTICS_CREATE_CUSTOM_DIMENSION',
    label: 'Create Custom Dimension',
    category: 'properties',
    priority: 3,
    writeOperation: true,
  },

  // Reports - Extended
  {
    name: 'GOOGLEANALYTICS_RUN_FUNNEL_REPORT',
    label: 'Run Funnel Report',
    category: 'reports',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: GoogleAnalyticsAction[] = [
  {
    name: 'GOOGLEANALYTICS_DELETE_AUDIENCE',
    label: 'Delete Audience',
    category: 'audiences',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEANALYTICS_DELETE_CONVERSION_EVENT',
    label: 'Delete Conversion Event',
    category: 'conversions',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEANALYTICS_ARCHIVE_CUSTOM_DIMENSION',
    label: 'Archive Custom Dimension',
    category: 'properties',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEANALYTICS_LIST_DATA_STREAMS',
    label: 'List Data Streams',
    category: 'admin',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GOOGLE_ANALYTICS_ACTIONS: GoogleAnalyticsAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGoogleAnalyticsFeaturedActionNames(): string[] {
  return ALL_GOOGLE_ANALYTICS_ACTIONS.map((a) => a.name);
}

export function getGoogleAnalyticsActionsByPriority(
  maxPriority: number = 3
): GoogleAnalyticsAction[] {
  return ALL_GOOGLE_ANALYTICS_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGoogleAnalyticsActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGoogleAnalyticsActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGoogleAnalyticsActionsByCategory(
  category: GoogleAnalyticsActionCategory
): GoogleAnalyticsAction[] {
  return ALL_GOOGLE_ANALYTICS_ACTIONS.filter((a) => a.category === category);
}

export function getGoogleAnalyticsActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GOOGLE_ANALYTICS_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGoogleAnalyticsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_ANALYTICS_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGoogleAnalyticsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_ANALYTICS_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Google Analytics action priority.
 * Known Google Analytics actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGoogleAnalyticsPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGoogleAnalyticsActionPriority(a.name) - getGoogleAnalyticsActionPriority(b.name);
  });
}

export function getGoogleAnalyticsActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GOOGLE_ANALYTICS_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GOOGLE_ANALYTICS_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Google Analytics-specific system prompt when user has Google Analytics connected.
 * Tells Claude exactly what it can do via the Composio Google Analytics toolkit.
 */
export function getGoogleAnalyticsSystemPrompt(): string {
  return `
## Google Analytics Integration (Full Capabilities)

You have **full Google Analytics access** through the user's connected account. Use the \`composio_GOOGLEANALYTICS_*\` tools.

### Reports
- Run standard reports with dimensions, metrics, date ranges, and filters
- Run real-time reports to see current active users and live activity
- Execute batch reports to retrieve multiple reports in a single request
- Create pivot reports for multi-dimensional data analysis
- Run funnel reports to analyze user conversion paths and drop-off points

### Properties
- List all GA4 properties accessible to the connected account
- Get detailed configuration for a specific property
- List custom dimensions defined on a property
- Create new custom dimensions for tracking custom data

### Audiences
- List all audiences configured for a property
- Get detailed audience definitions and criteria
- Create new audiences based on user segments and conditions
- Delete audiences that are no longer needed

### Conversions
- List all conversion events configured for a property
- Get details on a specific conversion event
- Create new conversion events to track key user actions
- Delete conversion events that are no longer relevant

### Admin
- List all Google Analytics accounts accessible to the user
- List data streams (web, iOS, Android) configured for a property

### Safety Rules
1. **ALWAYS confirm before creating or modifying resources** - show the property, resource type, and configuration:
\`\`\`action-preview
{
  "platform": "Google Analytics",
  "action": "Create Audience",
  "property": "properties/XXXXXXXX",
  "audienceName": "...",
  "toolName": "composio_GOOGLEANALYTICS_CREATE_AUDIENCE",
  "toolParams": { "property": "...", "displayName": "...", "description": "..." }
}
\`\`\`
2. **Double-check property IDs** before running any reports or making changes - confirm which property the user intends
3. **Never delete audiences or conversion events without explicit approval** - deletion may affect historical reporting
4. **For batch reports**, summarize all requested reports and get confirmation before executing
5. **When creating conversion events**, verify the event name matches the actual event being tracked
6. **For custom dimensions**, confirm the scope (event-level vs user-level) before creation as it cannot be changed later
7. **Archive operations are permanent** - always warn users that archiving custom dimensions cannot be undone
8. **Handle reporting data carefully** - present metrics with proper context, date ranges, and appropriate caveats
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGoogleAnalyticsCapabilitySummary(): string {
  const stats = getGoogleAnalyticsActionStats();
  return `Google Analytics (${stats.total} actions: reports, properties, audiences, conversions, admin)`;
}

export function logGoogleAnalyticsToolkitStats(): void {
  const stats = getGoogleAnalyticsActionStats();
  log.info('Google Analytics Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
