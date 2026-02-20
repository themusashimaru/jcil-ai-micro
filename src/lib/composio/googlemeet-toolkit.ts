/**
 * COMPOSIO GOOGLE MEET TOOLKIT
 * =============================
 *
 * Comprehensive Google Meet integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Meetings (create, get, list, end, conference records)
 * - Participants (list, get participant details)
 * - Recordings (list, get, delete, transcripts)
 * - Spaces (create, update, get, end)
 */

import { logger } from '@/lib/logger';

const log = logger('GoogleMeetToolkit');

// ============================================================================
// GOOGLE MEET ACTION CATEGORIES
// ============================================================================

export type GoogleMeetActionCategory = 'meetings' | 'participants' | 'recordings' | 'spaces';

export interface GoogleMeetAction {
  name: string; // Composio action name (e.g., GOOGLEMEET_CREATE_MEETING)
  label: string; // Human-readable label
  category: GoogleMeetActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Google Meet connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GoogleMeetAction[] = [
  // Meetings
  {
    name: 'GOOGLEMEET_CREATE_MEETING',
    label: 'Create Meeting',
    category: 'meetings',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLEMEET_GET_MEETING',
    label: 'Get Meeting',
    category: 'meetings',
    priority: 1,
  },
  {
    name: 'GOOGLEMEET_LIST_MEETINGS',
    label: 'List Meetings',
    category: 'meetings',
    priority: 1,
  },

  // Spaces
  {
    name: 'GOOGLEMEET_CREATE_SPACE',
    label: 'Create Space',
    category: 'spaces',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GoogleMeetAction[] = [
  // Meetings
  {
    name: 'GOOGLEMEET_END_MEETING',
    label: 'End Meeting',
    category: 'meetings',
    priority: 2,
    writeOperation: true,
  },

  // Participants
  {
    name: 'GOOGLEMEET_LIST_PARTICIPANTS',
    label: 'List Participants',
    category: 'participants',
    priority: 2,
  },
  {
    name: 'GOOGLEMEET_GET_PARTICIPANT',
    label: 'Get Participant',
    category: 'participants',
    priority: 2,
  },

  // Recordings
  {
    name: 'GOOGLEMEET_LIST_RECORDINGS',
    label: 'List Recordings',
    category: 'recordings',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GoogleMeetAction[] = [
  // Recordings
  {
    name: 'GOOGLEMEET_GET_RECORDING',
    label: 'Get Recording',
    category: 'recordings',
    priority: 3,
  },
  {
    name: 'GOOGLEMEET_LIST_TRANSCRIPT_ENTRIES',
    label: 'List Transcript Entries',
    category: 'recordings',
    priority: 3,
  },

  // Spaces
  {
    name: 'GOOGLEMEET_UPDATE_SPACE',
    label: 'Update Space',
    category: 'spaces',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEMEET_GET_SPACE',
    label: 'Get Space',
    category: 'spaces',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: GoogleMeetAction[] = [
  {
    name: 'GOOGLEMEET_END_SPACE',
    label: 'End Space',
    category: 'spaces',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEMEET_DELETE_RECORDING',
    label: 'Delete Recording',
    category: 'recordings',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEMEET_LIST_CONFERENCE_RECORDS',
    label: 'List Conference Records',
    category: 'meetings',
    priority: 4,
  },
  {
    name: 'GOOGLEMEET_GET_TRANSCRIPT',
    label: 'Get Transcript',
    category: 'recordings',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GOOGLE_MEET_ACTIONS: GoogleMeetAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGoogleMeetFeaturedActionNames(): string[] {
  return ALL_GOOGLE_MEET_ACTIONS.map((a) => a.name);
}

export function getGoogleMeetActionsByPriority(maxPriority: number = 3): GoogleMeetAction[] {
  return ALL_GOOGLE_MEET_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGoogleMeetActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGoogleMeetActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGoogleMeetActionsByCategory(
  category: GoogleMeetActionCategory
): GoogleMeetAction[] {
  return ALL_GOOGLE_MEET_ACTIONS.filter((a) => a.category === category);
}

export function getGoogleMeetActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GOOGLE_MEET_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGoogleMeetAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_MEET_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGoogleMeetAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_MEET_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Google Meet action priority.
 * Known Google Meet actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGoogleMeetPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGoogleMeetActionPriority(a.name) - getGoogleMeetActionPriority(b.name);
  });
}

export function getGoogleMeetActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GOOGLE_MEET_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GOOGLE_MEET_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Google Meet-specific system prompt when user has Google Meet connected.
 * Tells Claude exactly what it can do via the Composio Google Meet toolkit.
 */
export function getGoogleMeetSystemPrompt(): string {
  return `
## Google Meet Integration (Full Capabilities)

You have **full Google Meet access** through the user's connected account. Use the \`composio_GOOGLEMEET_*\` tools.

### Meetings
- Create new meetings with configurable settings
- Retrieve details for a specific meeting
- List all meetings for the connected account
- End active meetings
- List conference records for historical meeting data

### Participants
- List all participants in a meeting (current and past)
- Get detailed information about a specific participant
- Track attendance and participation status

### Recordings
- List available recordings for meetings
- Retrieve details and download links for specific recordings
- Access meeting transcripts and transcript entries
- Delete recordings when no longer needed

### Spaces
- Create meeting spaces for recurring or scheduled meetings
- Update space configuration and settings
- Retrieve space details and status
- End spaces when they are no longer needed

### Safety Rules
1. **ALWAYS confirm before creating meetings** - show meeting details, time, and participants:
\`\`\`action-preview
{
  "platform": "Google Meet",
  "action": "Create Meeting",
  "details": "Meeting subject and settings",
  "toolName": "composio_GOOGLEMEET_CREATE_MEETING",
  "toolParams": { ... }
}
\`\`\`
2. **Confirm before ending meetings** - show meeting details and active participant count
3. **Never delete recordings without explicit approval** - deletion is permanent
4. **Never end spaces without explicit approval** - this terminates all active sessions in the space
5. **Handle participant data carefully** - respect privacy when listing or sharing participant information
6. **For meeting creation**, clearly show all configured settings before proceeding
7. **For recordings and transcripts**, verify the user has appropriate access before retrieving
8. **For batch operations**, summarize what will happen and get explicit approval
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGoogleMeetCapabilitySummary(): string {
  const stats = getGoogleMeetActionStats();
  return `Google Meet (${stats.total} actions: meetings, participants, recordings, spaces)`;
}

export function logGoogleMeetToolkitStats(): void {
  const stats = getGoogleMeetActionStats();
  log.info('Google Meet Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
