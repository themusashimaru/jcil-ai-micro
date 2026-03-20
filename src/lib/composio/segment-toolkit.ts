/**
 * COMPOSIO SEGMENT TOOLKIT
 * ========================
 *
 * Comprehensive Segment integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Tracking (track events, page views)
 * - Sources (create, list, update data sources)
 * - Destinations (create, list, update destinations)
 * - Users (identify, group, alias users)
 * - Events (list, query event schemas)
 */

import { logger } from '@/lib/logger';

const log = logger('SegmentToolkit');

// ============================================================================
// SEGMENT ACTION CATEGORIES
// ============================================================================

export type SegmentActionCategory = 'tracking' | 'sources' | 'destinations' | 'users' | 'events';

export interface SegmentAction {
  name: string; // Composio action name (e.g., SEGMENT_TRACK_EVENT)
  label: string; // Human-readable label
  category: SegmentActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Segment connected)
// ============================================================================

const ESSENTIAL_ACTIONS: SegmentAction[] = [
  // Tracking - Core
  {
    name: 'SEGMENT_TRACK_EVENT',
    label: 'Track Event',
    category: 'tracking',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SEGMENT_IDENTIFY_USER',
    label: 'Identify User',
    category: 'users',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SEGMENT_GROUP',
    label: 'Group User',
    category: 'users',
    priority: 1,
    writeOperation: true,
  },

  // Sources - Core
  { name: 'SEGMENT_LIST_SOURCES', label: 'List Sources', category: 'sources', priority: 1 },

  // Destinations - Core
  {
    name: 'SEGMENT_LIST_DESTINATIONS',
    label: 'List Destinations',
    category: 'destinations',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: SegmentAction[] = [
  // Tracking - Extended
  {
    name: 'SEGMENT_PAGE',
    label: 'Track Page View',
    category: 'tracking',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SEGMENT_SCREEN',
    label: 'Track Screen View',
    category: 'tracking',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SEGMENT_ALIAS',
    label: 'Alias User',
    category: 'users',
    priority: 2,
    writeOperation: true,
  },

  // Sources - Extended
  { name: 'SEGMENT_GET_SOURCE', label: 'Get Source Details', category: 'sources', priority: 2 },
  {
    name: 'SEGMENT_CREATE_SOURCE',
    label: 'Create Source',
    category: 'sources',
    priority: 2,
    writeOperation: true,
  },

  // Destinations - Extended
  {
    name: 'SEGMENT_GET_DESTINATION',
    label: 'Get Destination Details',
    category: 'destinations',
    priority: 2,
  },
  {
    name: 'SEGMENT_CREATE_DESTINATION',
    label: 'Create Destination',
    category: 'destinations',
    priority: 2,
    writeOperation: true,
  },

  // Events - Core
  { name: 'SEGMENT_LIST_EVENTS', label: 'List Events', category: 'events', priority: 2 },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: SegmentAction[] = [
  // Sources - Extended
  {
    name: 'SEGMENT_UPDATE_SOURCE',
    label: 'Update Source',
    category: 'sources',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SEGMENT_GET_SOURCE_SCHEMA',
    label: 'Get Source Schema',
    category: 'sources',
    priority: 3,
  },

  // Destinations - Extended
  {
    name: 'SEGMENT_UPDATE_DESTINATION',
    label: 'Update Destination',
    category: 'destinations',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SEGMENT_LIST_DESTINATION_SUBSCRIPTIONS',
    label: 'List Destination Subscriptions',
    category: 'destinations',
    priority: 3,
  },

  // Events - Extended
  {
    name: 'SEGMENT_GET_EVENT_SCHEMA',
    label: 'Get Event Schema',
    category: 'events',
    priority: 3,
  },
  {
    name: 'SEGMENT_GET_EVENT_VOLUME',
    label: 'Get Event Volume',
    category: 'events',
    priority: 3,
  },

  // Tracking - Extended
  {
    name: 'SEGMENT_BATCH',
    label: 'Batch Track Events',
    category: 'tracking',
    priority: 3,
    writeOperation: true,
  },

  // Users - Extended
  {
    name: 'SEGMENT_GET_USER_TRAITS',
    label: 'Get User Traits',
    category: 'users',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: SegmentAction[] = [
  // Sources - Destructive
  {
    name: 'SEGMENT_DELETE_SOURCE',
    label: 'Delete Source',
    category: 'sources',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Destinations - Destructive
  {
    name: 'SEGMENT_DELETE_DESTINATION',
    label: 'Delete Destination',
    category: 'destinations',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Users - Destructive
  {
    name: 'SEGMENT_SUPPRESS_USER',
    label: 'Suppress User',
    category: 'users',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SEGMENT_DELETE_USER',
    label: 'Delete User',
    category: 'users',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Events - Specialized
  {
    name: 'SEGMENT_REPLAY_EVENTS',
    label: 'Replay Events',
    category: 'events',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_SEGMENT_ACTIONS: SegmentAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getSegmentFeaturedActionNames(): string[] {
  return ALL_SEGMENT_ACTIONS.map((a) => a.name);
}

export function getSegmentActionsByPriority(maxPriority: number = 3): SegmentAction[] {
  return ALL_SEGMENT_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getSegmentActionNamesByPriority(maxPriority: number = 3): string[] {
  return getSegmentActionsByPriority(maxPriority).map((a) => a.name);
}

export function getSegmentActionsByCategory(category: SegmentActionCategory): SegmentAction[] {
  return ALL_SEGMENT_ACTIONS.filter((a) => a.category === category);
}

export function getSegmentActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_SEGMENT_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownSegmentAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SEGMENT_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveSegmentAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SEGMENT_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Segment action priority.
 * Known Segment actions sorted by priority (1-4), unknown actions last.
 */
export function sortBySegmentPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getSegmentActionPriority(a.name) - getSegmentActionPriority(b.name);
  });
}

export function getSegmentActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_SEGMENT_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_SEGMENT_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Segment-specific system prompt when user has Segment connected.
 * Tells Claude exactly what it can do via the Composio Segment toolkit.
 */
export function getSegmentSystemPrompt(): string {
  return `
## Segment Integration (Full Capabilities)

You have **full Segment access** through the user's connected account. Use the \`composio_SEGMENT_*\` tools.

### Tracking
- Track custom events with properties and context
- Track page views with page name and properties
- Track screen views for mobile applications
- Batch track multiple events in a single call

### Users
- Identify users with traits (email, name, custom properties)
- Group users into organizations or teams
- Create user aliases to merge identities
- View user traits and profile data
- Suppress users from data collection (with confirmation)
- Delete user data (with confirmation)

### Sources
- List all configured data sources
- Get detailed source information and configuration
- Create new data sources for ingestion
- Update source settings and configuration
- View source schemas and data structure
- Delete sources (with confirmation)

### Destinations
- List all configured data destinations
- Get destination details and connection status
- Create new destinations for data routing
- Update destination configuration and mappings
- View destination subscriptions and event filters
- Delete destinations (with confirmation)

### Events
- List all tracked event types
- Get event schemas and property definitions
- View event volume and frequency metrics
- Replay events to destinations (with confirmation)

### Safety Rules
1. **ALWAYS preview before tracking** - show event details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Segment",
  "action": "Track Event",
  "content": "Event name and properties preview...",
  "toolName": "composio_SEGMENT_TRACK_EVENT",
  "toolParams": { "event": "...", "properties": {} }
}
\`\`\`
2. **Confirm user identification** - verify user ID and traits before identifying
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For source/destination changes**, show current configuration before modifying
5. **For batch operations**, confirm the number of events and scope before executing
6. **For event replays**, confirm the time range and destination before proceeding
7. **Handle PII carefully** - flag any personally identifiable information in event properties
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getSegmentCapabilitySummary(): string {
  const stats = getSegmentActionStats();
  return `Segment (${stats.total} actions: tracking, sources, destinations, users, events)`;
}

export function logSegmentToolkitStats(): void {
  const stats = getSegmentActionStats();
  log.info('Segment Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
