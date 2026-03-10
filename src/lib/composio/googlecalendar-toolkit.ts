/**
 * COMPOSIO GOOGLE CALENDAR TOOLKIT
 * =================================
 *
 * Comprehensive Google Calendar integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Events (create, find, update, delete, recurring, instances)
 * - Calendars (create, manage, subscribe, clear)
 * - Attendees (add, remove)
 * - Reminders (set reminders)
 * - Settings (colors, ACL, free/busy, general settings)
 */

import { logger } from '@/lib/logger';

const log = logger('GoogleCalendarToolkit');

// ============================================================================
// GOOGLE CALENDAR ACTION CATEGORIES
// ============================================================================

export type GoogleCalendarActionCategory =
  | 'events'
  | 'calendars'
  | 'attendees'
  | 'reminders'
  | 'settings';

export interface GoogleCalendarAction {
  name: string; // Composio action name (e.g., GOOGLECALENDAR_CREATE_EVENT)
  label: string; // Human-readable label
  category: GoogleCalendarActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Google Calendar connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GoogleCalendarAction[] = [
  // Events - Core
  {
    name: 'GOOGLECALENDAR_CREATE_EVENT',
    label: 'Create Event',
    category: 'events',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLECALENDAR_FIND_EVENT',
    label: 'Find Event',
    category: 'events',
    priority: 1,
  },
  {
    name: 'GOOGLECALENDAR_GET_EVENT',
    label: 'Get Event',
    category: 'events',
    priority: 1,
  },
  {
    name: 'GOOGLECALENDAR_LIST_EVENTS',
    label: 'List Events',
    category: 'events',
    priority: 1,
  },
  {
    name: 'GOOGLECALENDAR_UPDATE_EVENT',
    label: 'Update Event',
    category: 'events',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLECALENDAR_DELETE_EVENT',
    label: 'Delete Event',
    category: 'events',
    priority: 1,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLECALENDAR_QUICK_ADD_EVENT',
    label: 'Quick Add Event',
    category: 'events',
    priority: 1,
    writeOperation: true,
  },

  // Calendars - Core
  {
    name: 'GOOGLECALENDAR_LIST_CALENDARS',
    label: 'List Calendars',
    category: 'calendars',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GoogleCalendarAction[] = [
  // Calendars - Extended
  {
    name: 'GOOGLECALENDAR_CREATE_CALENDAR',
    label: 'Create Calendar',
    category: 'calendars',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLECALENDAR_GET_CALENDAR',
    label: 'Get Calendar',
    category: 'calendars',
    priority: 2,
  },
  {
    name: 'GOOGLECALENDAR_UPDATE_CALENDAR',
    label: 'Update Calendar',
    category: 'calendars',
    priority: 2,
    writeOperation: true,
  },

  // Events - Extended
  {
    name: 'GOOGLECALENDAR_PATCH_EVENT',
    label: 'Patch Event',
    category: 'events',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLECALENDAR_MOVE_EVENT',
    label: 'Move Event',
    category: 'events',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLECALENDAR_LIST_INSTANCES',
    label: 'List Instances',
    category: 'events',
    priority: 2,
  },

  // Attendees
  {
    name: 'GOOGLECALENDAR_ADD_ATTENDEE',
    label: 'Add Attendee',
    category: 'attendees',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLECALENDAR_REMOVE_ATTENDEE',
    label: 'Remove Attendee',
    category: 'attendees',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GoogleCalendarAction[] = [
  // Events - Extended
  {
    name: 'GOOGLECALENDAR_CREATE_RECURRING_EVENT',
    label: 'Create Recurring Event',
    category: 'events',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLECALENDAR_LIST_UPCOMING_EVENTS',
    label: 'List Upcoming Events',
    category: 'events',
    priority: 3,
  },
  {
    name: 'GOOGLECALENDAR_CHECK_AVAILABILITY',
    label: 'Check Availability',
    category: 'events',
    priority: 3,
  },
  {
    name: 'GOOGLECALENDAR_GET_FREE_BUSY',
    label: 'Get Free/Busy',
    category: 'events',
    priority: 3,
  },
  {
    name: 'GOOGLECALENDAR_IMPORT_EVENT',
    label: 'Import Event',
    category: 'events',
    priority: 3,
    writeOperation: true,
  },

  // Reminders
  {
    name: 'GOOGLECALENDAR_SET_REMINDER',
    label: 'Set Reminder',
    category: 'reminders',
    priority: 3,
    writeOperation: true,
  },

  // Settings
  {
    name: 'GOOGLECALENDAR_LIST_COLORS',
    label: 'List Colors',
    category: 'settings',
    priority: 3,
  },

  // Calendars - Extended
  {
    name: 'GOOGLECALENDAR_SUBSCRIBE_CALENDAR',
    label: 'Subscribe to Calendar',
    category: 'calendars',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: GoogleCalendarAction[] = [
  {
    name: 'GOOGLECALENDAR_DELETE_CALENDAR',
    label: 'Delete Calendar',
    category: 'calendars',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLECALENDAR_CLEAR_CALENDAR',
    label: 'Clear Calendar',
    category: 'calendars',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLECALENDAR_LIST_ACL',
    label: 'List ACL Rules',
    category: 'settings',
    priority: 4,
  },
  {
    name: 'GOOGLECALENDAR_CREATE_ACL_RULE',
    label: 'Create ACL Rule',
    category: 'settings',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GOOGLECALENDAR_DELETE_ACL_RULE',
    label: 'Delete ACL Rule',
    category: 'settings',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLECALENDAR_GET_SETTINGS',
    label: 'Get Settings',
    category: 'settings',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GOOGLE_CALENDAR_ACTIONS: GoogleCalendarAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGoogleCalendarFeaturedActionNames(): string[] {
  return ALL_GOOGLE_CALENDAR_ACTIONS.map((a) => a.name);
}

export function getGoogleCalendarActionsByPriority(
  maxPriority: number = 3
): GoogleCalendarAction[] {
  return ALL_GOOGLE_CALENDAR_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGoogleCalendarActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGoogleCalendarActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGoogleCalendarActionsByCategory(
  category: GoogleCalendarActionCategory
): GoogleCalendarAction[] {
  return ALL_GOOGLE_CALENDAR_ACTIONS.filter((a) => a.category === category);
}

export function getGoogleCalendarActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GOOGLE_CALENDAR_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGoogleCalendarAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_CALENDAR_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGoogleCalendarAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_CALENDAR_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Google Calendar action priority.
 * Known Google Calendar actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGoogleCalendarPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGoogleCalendarActionPriority(a.name) - getGoogleCalendarActionPriority(b.name);
  });
}

export function getGoogleCalendarActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GOOGLE_CALENDAR_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GOOGLE_CALENDAR_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Google Calendar-specific system prompt when user has Google Calendar connected.
 * Tells Claude exactly what it can do via the Composio Google Calendar toolkit.
 */
export function getGoogleCalendarSystemPrompt(): string {
  return `
## Google Calendar Integration (Full Capabilities)

You have **full Google Calendar access** through the user's connected account. Use the \`composio_GOOGLECALENDAR_*\` tools.

### Event Management
- Create events with titles, descriptions, locations, start/end times, and attendees
- Quick-add events using natural language descriptions
- Find, list, and retrieve event details
- Update or patch existing events (time, title, description, location)
- Delete events that are no longer needed
- Move events between calendars
- Create recurring events with custom recurrence rules (daily, weekly, monthly, etc.)
- List instances of recurring events
- Import events from external sources

### Calendar Management
- List all calendars the user has access to
- Create new calendars for organizing different types of events
- Get and update calendar properties (name, description, timezone)
- Subscribe to public or shared calendars
- Clear all events from a calendar
- Delete calendars entirely

### Scheduling & Availability
- List upcoming events to see what's on the schedule
- Check availability across calendars
- Query free/busy information for scheduling meetings
- View calendar colors for visual organization

### Attendee Management
- Add attendees to events (with email invitations)
- Remove attendees from events
- View attendee response status (accepted, declined, tentative)

### Access Control & Settings
- List access control rules for calendars
- Create ACL rules to share calendars with specific users or groups
- Remove ACL rules to revoke calendar access
- Retrieve calendar settings and preferences
- Set reminders for events (email, popup notifications)

### Safety Rules
1. **ALWAYS confirm event details before creating** - show title, date/time, timezone, attendees, and location:
\`\`\`action-preview
{
  "platform": "Google Calendar",
  "action": "Create Event",
  "title": "Event title",
  "dateTime": "Start - End",
  "timezone": "User timezone",
  "attendees": ["attendee1@email.com"],
  "toolName": "composio_GOOGLECALENDAR_CREATE_EVENT",
  "toolParams": { "summary": "...", "start": "...", "end": "...", "attendees": [...] }
}
\`\`\`
2. **Confirm before deleting events** - show the event title, date, and attendees before deletion
3. **Warn before destructive calendar operations** - clearing or deleting a calendar removes all events permanently
4. **Verify attendee email addresses** before sending invitations
5. **For recurring events**, clearly show the recurrence pattern and confirm before creating
6. **Always include timezone information** when displaying or creating events
7. **For ACL changes**, explain the access level being granted and confirm with the user
8. **For batch operations**, summarize what will happen and get explicit approval
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGoogleCalendarCapabilitySummary(): string {
  const stats = getGoogleCalendarActionStats();
  return `Google Calendar (${stats.total} actions: events, calendars, scheduling, attendees, settings)`;
}

export function logGoogleCalendarToolkitStats(): void {
  const stats = getGoogleCalendarActionStats();
  log.info('Google Calendar Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
