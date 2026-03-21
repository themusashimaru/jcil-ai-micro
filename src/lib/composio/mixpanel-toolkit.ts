/**
 * COMPOSIO MIXPANEL TOOLKIT
 * =========================
 *
 * Comprehensive Mixpanel integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Events (track events, get event data, event properties)
 * - Users (user profiles, user properties, people data)
 * - Funnels (create funnels, get funnel data)
 * - Reports (insights, segmentation, retention)
 * - Cohorts (create cohorts, list cohorts, get cohort data)
 */

import { logger } from '@/lib/logger';

const log = logger('MixpanelToolkit');

// ============================================================================
// MIXPANEL ACTION CATEGORIES
// ============================================================================

export type MixpanelActionCategory = 'events' | 'users' | 'funnels' | 'reports' | 'cohorts';

export interface MixpanelAction {
  name: string; // Composio action name (e.g., MIXPANEL_TRACK_EVENT)
  label: string; // Human-readable label
  category: MixpanelActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Mixpanel connected)
// ============================================================================

const ESSENTIAL_ACTIONS: MixpanelAction[] = [
  // Events - Core
  {
    name: 'MIXPANEL_TRACK_EVENT',
    label: 'Track Event',
    category: 'events',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'MIXPANEL_GET_EVENTS',
    label: 'Get Events',
    category: 'events',
    priority: 1,
  },
  {
    name: 'MIXPANEL_GET_EVENT_PROPERTIES',
    label: 'Get Event Properties',
    category: 'events',
    priority: 1,
  },

  // Users - Core
  {
    name: 'MIXPANEL_GET_USER_PROFILE',
    label: 'Get User Profile',
    category: 'users',
    priority: 1,
  },

  // Reports - Core
  {
    name: 'MIXPANEL_GET_INSIGHTS',
    label: 'Get Insights Report',
    category: 'reports',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: MixpanelAction[] = [
  // Events - Extended
  {
    name: 'MIXPANEL_GET_TOP_EVENTS',
    label: 'Get Top Events',
    category: 'events',
    priority: 2,
  },
  {
    name: 'MIXPANEL_GET_EVENT_NAMES',
    label: 'Get Event Names',
    category: 'events',
    priority: 2,
  },

  // Users - Extended
  {
    name: 'MIXPANEL_SET_USER_PROPERTY',
    label: 'Set User Property',
    category: 'users',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'MIXPANEL_GET_USER_ACTIVITY',
    label: 'Get User Activity',
    category: 'users',
    priority: 2,
  },

  // Funnels - Core
  {
    name: 'MIXPANEL_CREATE_FUNNEL',
    label: 'Create Funnel',
    category: 'funnels',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'MIXPANEL_GET_FUNNEL',
    label: 'Get Funnel Data',
    category: 'funnels',
    priority: 2,
  },
  {
    name: 'MIXPANEL_LIST_FUNNELS',
    label: 'List Funnels',
    category: 'funnels',
    priority: 2,
  },

  // Reports - Extended
  {
    name: 'MIXPANEL_GET_RETENTION',
    label: 'Get Retention Report',
    category: 'reports',
    priority: 2,
  },

  // Cohorts - Core
  {
    name: 'MIXPANEL_LIST_COHORTS',
    label: 'List Cohorts',
    category: 'cohorts',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: MixpanelAction[] = [
  // Events - Extended
  {
    name: 'MIXPANEL_EXPORT_DATA',
    label: 'Export Event Data',
    category: 'events',
    priority: 3,
  },
  {
    name: 'MIXPANEL_GET_EVENT_COUNT',
    label: 'Get Event Count',
    category: 'events',
    priority: 3,
  },

  // Reports - Extended
  {
    name: 'MIXPANEL_GET_SEGMENTATION',
    label: 'Get Segmentation Report',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'MIXPANEL_GET_FLOW_REPORT',
    label: 'Get Flow Report',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'MIXPANEL_GET_FREQUENCY_REPORT',
    label: 'Get Frequency Report',
    category: 'reports',
    priority: 3,
  },

  // Cohorts - Extended
  {
    name: 'MIXPANEL_CREATE_COHORT',
    label: 'Create Cohort',
    category: 'cohorts',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MIXPANEL_GET_COHORT',
    label: 'Get Cohort Details',
    category: 'cohorts',
    priority: 3,
  },

  // Users - Extended
  {
    name: 'MIXPANEL_LIST_USERS',
    label: 'List Users',
    category: 'users',
    priority: 3,
  },
  {
    name: 'MIXPANEL_MERGE_USERS',
    label: 'Merge User Profiles',
    category: 'users',
    priority: 3,
    writeOperation: true,
  },

  // Funnels - Extended
  {
    name: 'MIXPANEL_UPDATE_FUNNEL',
    label: 'Update Funnel',
    category: 'funnels',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: MixpanelAction[] = [
  // Users - Destructive
  {
    name: 'MIXPANEL_DELETE_USER_PROFILE',
    label: 'Delete User Profile',
    category: 'users',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'MIXPANEL_REMOVE_USER_PROPERTY',
    label: 'Remove User Property',
    category: 'users',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Funnels - Destructive
  {
    name: 'MIXPANEL_DELETE_FUNNEL',
    label: 'Delete Funnel',
    category: 'funnels',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Cohorts - Destructive
  {
    name: 'MIXPANEL_DELETE_COHORT',
    label: 'Delete Cohort',
    category: 'cohorts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Events - Specialized
  {
    name: 'MIXPANEL_DELETE_EVENTS',
    label: 'Delete Events',
    category: 'events',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_MIXPANEL_ACTIONS: MixpanelAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getMixpanelFeaturedActionNames(): string[] {
  return ALL_MIXPANEL_ACTIONS.map((a) => a.name);
}

export function getMixpanelActionsByPriority(maxPriority: number = 3): MixpanelAction[] {
  return ALL_MIXPANEL_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getMixpanelActionNamesByPriority(maxPriority: number = 3): string[] {
  return getMixpanelActionsByPriority(maxPriority).map((a) => a.name);
}

export function getMixpanelActionsByCategory(category: MixpanelActionCategory): MixpanelAction[] {
  return ALL_MIXPANEL_ACTIONS.filter((a) => a.category === category);
}

export function getMixpanelActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_MIXPANEL_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownMixpanelAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_MIXPANEL_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveMixpanelAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_MIXPANEL_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Mixpanel action priority.
 * Known Mixpanel actions sorted by priority (1-4), unknown actions last.
 */
export function sortByMixpanelPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getMixpanelActionPriority(a.name) - getMixpanelActionPriority(b.name);
  });
}

export function getMixpanelActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_MIXPANEL_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_MIXPANEL_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Mixpanel-specific system prompt when user has Mixpanel connected.
 * Tells Claude exactly what it can do via the Composio Mixpanel toolkit.
 */
export function getMixpanelSystemPrompt(): string {
  return `
## Mixpanel Integration (Full Capabilities)

You have **full Mixpanel access** through the user's connected account. Use the \`composio_MIXPANEL_*\` tools.

### Events
- Track custom events with properties
- Get event data and event property breakdowns
- List top events and event names
- Get event counts over time ranges
- Export raw event data for analysis
- Delete events (with confirmation)

### Users
- Get user profiles and properties
- Set user properties for tracking
- View user activity timelines
- List and search users
- Merge duplicate user profiles
- Delete user profiles (with confirmation)
- Remove user properties (with confirmation)

### Funnels
- Create conversion funnels from event sequences
- Get funnel data with conversion rates
- List all configured funnels
- Update funnel definitions
- Delete funnels (with confirmation)

### Reports
- Get insights reports with custom queries
- View retention analysis over time periods
- Run segmentation reports by user properties
- Generate flow reports for user journeys
- Get frequency reports for engagement analysis

### Cohorts
- List existing user cohorts
- Create new cohorts based on behavior or properties
- Get cohort details and membership
- Delete cohorts (with confirmation)

### Safety Rules
1. **ALWAYS preview before tracking** - show event details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Mixpanel",
  "action": "Track Event",
  "eventName": "event_name",
  "properties": { "key": "value" },
  "toolName": "composio_MIXPANEL_TRACK_EVENT",
  "toolParams": { "event": "...", "properties": {...} }
}
\`\`\`
2. **Confirm before deleting data** - event and user deletions are irreversible
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For user merges**, show both profiles before merging
5. **For funnel creation**, confirm the event sequence with the user
6. **For exports**, confirm the date range and event filters before exporting
7. **Handle date ranges carefully** - always confirm the time period for reports
8. **Respect data privacy** - be cautious with user profile data
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getMixpanelCapabilitySummary(): string {
  const stats = getMixpanelActionStats();
  return `Mixpanel (${stats.total} actions: events, users, funnels, reports, cohorts)`;
}

export function logMixpanelToolkitStats(): void {
  const stats = getMixpanelActionStats();
  log.info('Mixpanel Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
