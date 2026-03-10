/**
 * COMPOSIO ZOOM TOOLKIT
 * =====================
 *
 * Comprehensive Zoom integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Meetings (create, get, list, update, delete)
 * - Users (get, list)
 * - Recordings (list, get, delete)
 * - Webinars (create, list, get)
 */

import { logger } from '@/lib/logger';

const log = logger('ZoomToolkit');

// ============================================================================
// ZOOM ACTION CATEGORIES
// ============================================================================

export type ZoomActionCategory = 'meetings' | 'users' | 'recordings' | 'webinars';

export interface ZoomAction {
  name: string;
  label: string;
  category: ZoomActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL
// ============================================================================

const ESSENTIAL_ACTIONS: ZoomAction[] = [
  {
    name: 'ZOOM_CREATE_MEETING',
    label: 'Create Meeting',
    category: 'meetings',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'ZOOM_GET_MEETING',
    label: 'Get Meeting',
    category: 'meetings',
    priority: 1,
  },
  {
    name: 'ZOOM_LIST_MEETINGS',
    label: 'List Meetings',
    category: 'meetings',
    priority: 1,
  },
  {
    name: 'ZOOM_UPDATE_MEETING',
    label: 'Update Meeting',
    category: 'meetings',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'ZOOM_GET_USER',
    label: 'Get User',
    category: 'users',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT
// ============================================================================

const IMPORTANT_ACTIONS: ZoomAction[] = [
  {
    name: 'ZOOM_DELETE_MEETING',
    label: 'Delete Meeting',
    category: 'meetings',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'ZOOM_LIST_RECORDINGS',
    label: 'List Recordings',
    category: 'recordings',
    priority: 2,
  },
  {
    name: 'ZOOM_GET_RECORDING',
    label: 'Get Recording',
    category: 'recordings',
    priority: 2,
  },
  {
    name: 'ZOOM_LIST_USERS',
    label: 'List Users',
    category: 'users',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL
// ============================================================================

const USEFUL_ACTIONS: ZoomAction[] = [
  {
    name: 'ZOOM_CREATE_WEBINAR',
    label: 'Create Webinar',
    category: 'webinars',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'ZOOM_LIST_WEBINARS',
    label: 'List Webinars',
    category: 'webinars',
    priority: 3,
  },
  {
    name: 'ZOOM_GET_WEBINAR',
    label: 'Get Webinar',
    category: 'webinars',
    priority: 3,
  },
  {
    name: 'ZOOM_GET_MEETING_PARTICIPANTS',
    label: 'Get Meeting Participants',
    category: 'meetings',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED
// ============================================================================

const ADVANCED_ACTIONS: ZoomAction[] = [
  {
    name: 'ZOOM_DELETE_RECORDING',
    label: 'Delete Recording',
    category: 'recordings',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'ZOOM_DELETE_WEBINAR',
    label: 'Delete Webinar',
    category: 'webinars',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'ZOOM_END_MEETING',
    label: 'End Meeting',
    category: 'meetings',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'ZOOM_GET_MEETING_REPORT',
    label: 'Get Meeting Report',
    category: 'meetings',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_ZOOM_ACTIONS: ZoomAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getZoomFeaturedActionNames(): string[] {
  return ALL_ZOOM_ACTIONS.map((a) => a.name);
}

export function getZoomActionsByPriority(maxPriority: number = 3): ZoomAction[] {
  return ALL_ZOOM_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getZoomActionNamesByPriority(maxPriority: number = 3): string[] {
  return getZoomActionsByPriority(maxPriority).map((a) => a.name);
}

export function getZoomActionsByCategory(category: ZoomActionCategory): ZoomAction[] {
  return ALL_ZOOM_ACTIONS.filter((a) => a.category === category);
}

export function getZoomActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_ZOOM_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownZoomAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_ZOOM_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveZoomAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_ZOOM_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

export function sortByZoomPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getZoomActionPriority(a.name) - getZoomActionPriority(b.name);
  });
}

export function getZoomActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_ZOOM_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_ZOOM_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export function getZoomSystemPrompt(): string {
  return `
## Zoom Integration (Full Capabilities)

You have **full Zoom access** through the user's connected account. Use the \`composio_ZOOM_*\` tools.

### Meetings
- Create instant or scheduled meetings with customizable settings
- Get meeting details, status, and join URL
- List upcoming and past meetings
- Update meeting topic, time, duration, and settings
- View meeting participants and attendance
- End active meetings

### Recordings
- List cloud recordings for meetings
- Get recording details and download links
- Delete recordings when no longer needed

### Webinars
- Create webinars with registration settings
- List upcoming and past webinars
- Get webinar details and registration info

### Users
- Get current user profile information
- List users in the organization

### Safety Rules
1. **ALWAYS share the join URL** when creating meetings - users need the link to join
2. **Confirm before deleting meetings** - show meeting topic and scheduled time
3. **Confirm before deleting recordings** - deletion is permanent
4. **For ending active meetings**, confirm that the user wants to end it for all participants
5. **Include timezone information** when displaying meeting times
`;
}

export function getZoomCapabilitySummary(): string {
  const stats = getZoomActionStats();
  return `Zoom (${stats.total} actions: meetings, users, recordings, webinars)`;
}

export function logZoomToolkitStats(): void {
  const stats = getZoomActionStats();
  log.info('Zoom Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
