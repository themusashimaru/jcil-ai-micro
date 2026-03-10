/**
 * COMPOSIO CALENDLY TOOLKIT
 * =========================
 *
 * Comprehensive Calendly integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Events (list, get, cancel)
 * - EventTypes (list, get)
 * - Invitees (list, get)
 * - Users (get, list)
 * - Scheduling (create link, availability)
 */

import { logger } from '@/lib/logger';

const log = logger('CalendlyToolkit');

// ============================================================================
// CALENDLY ACTION CATEGORIES
// ============================================================================

export type CalendlyActionCategory = 'events' | 'event_types' | 'invitees' | 'users' | 'scheduling';

export interface CalendlyAction {
  name: string;
  label: string;
  category: CalendlyActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL
// ============================================================================

const ESSENTIAL_ACTIONS: CalendlyAction[] = [
  {
    name: 'CALENDLY_LIST_EVENTS',
    label: 'List Events',
    category: 'events',
    priority: 1,
  },
  {
    name: 'CALENDLY_GET_EVENT',
    label: 'Get Event',
    category: 'events',
    priority: 1,
  },
  {
    name: 'CALENDLY_LIST_EVENT_TYPES',
    label: 'List Event Types',
    category: 'event_types',
    priority: 1,
  },
  {
    name: 'CALENDLY_GET_CURRENT_USER',
    label: 'Get Current User',
    category: 'users',
    priority: 1,
  },
  {
    name: 'CALENDLY_CREATE_SCHEDULING_LINK',
    label: 'Create Scheduling Link',
    category: 'scheduling',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT
// ============================================================================

const IMPORTANT_ACTIONS: CalendlyAction[] = [
  {
    name: 'CALENDLY_LIST_INVITEES',
    label: 'List Invitees',
    category: 'invitees',
    priority: 2,
  },
  {
    name: 'CALENDLY_GET_INVITEE',
    label: 'Get Invitee',
    category: 'invitees',
    priority: 2,
  },
  {
    name: 'CALENDLY_GET_EVENT_TYPE',
    label: 'Get Event Type',
    category: 'event_types',
    priority: 2,
  },
  {
    name: 'CALENDLY_CANCEL_EVENT',
    label: 'Cancel Event',
    category: 'events',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'CALENDLY_GET_AVAILABILITY',
    label: 'Get Availability',
    category: 'scheduling',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL
// ============================================================================

const USEFUL_ACTIONS: CalendlyAction[] = [
  {
    name: 'CALENDLY_LIST_ORGANIZATION_MEMBERS',
    label: 'List Organization Members',
    category: 'users',
    priority: 3,
  },
  {
    name: 'CALENDLY_GET_ORGANIZATION',
    label: 'Get Organization',
    category: 'users',
    priority: 3,
  },
  {
    name: 'CALENDLY_LIST_AVAILABILITY_SCHEDULES',
    label: 'List Availability Schedules',
    category: 'scheduling',
    priority: 3,
  },
  {
    name: 'CALENDLY_GET_AVAILABILITY_SCHEDULE',
    label: 'Get Availability Schedule',
    category: 'scheduling',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED
// ============================================================================

const ADVANCED_ACTIONS: CalendlyAction[] = [
  {
    name: 'CALENDLY_MARK_NO_SHOW',
    label: 'Mark No Show',
    category: 'invitees',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'CALENDLY_UNMARK_NO_SHOW',
    label: 'Unmark No Show',
    category: 'invitees',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'CALENDLY_LIST_EVENT_TYPE_AVAILABLE_TIMES',
    label: 'List Available Times',
    category: 'scheduling',
    priority: 4,
  },
  {
    name: 'CALENDLY_GET_USER',
    label: 'Get User',
    category: 'users',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_CALENDLY_ACTIONS: CalendlyAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getCalendlyFeaturedActionNames(): string[] {
  return ALL_CALENDLY_ACTIONS.map((a) => a.name);
}

export function getCalendlyActionsByPriority(maxPriority: number = 3): CalendlyAction[] {
  return ALL_CALENDLY_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getCalendlyActionNamesByPriority(maxPriority: number = 3): string[] {
  return getCalendlyActionsByPriority(maxPriority).map((a) => a.name);
}

export function getCalendlyActionsByCategory(category: CalendlyActionCategory): CalendlyAction[] {
  return ALL_CALENDLY_ACTIONS.filter((a) => a.category === category);
}

export function getCalendlyActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_CALENDLY_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownCalendlyAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_CALENDLY_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveCalendlyAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_CALENDLY_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

export function sortByCalendlyPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getCalendlyActionPriority(a.name) - getCalendlyActionPriority(b.name);
  });
}

export function getCalendlyActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_CALENDLY_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_CALENDLY_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export function getCalendlySystemPrompt(): string {
  return `
## Calendly Integration (Full Capabilities)

You have **full Calendly access** through the user's connected account. Use the \`composio_CALENDLY_*\` tools.

### Events
- List scheduled events with date range filters
- Get event details including attendees, time, and location
- Cancel scheduled events with optional reason

### Event Types
- List all event types (meeting types the user offers)
- Get event type details including duration, availability, and settings

### Invitees
- List invitees for specific events
- Get invitee details and responses
- Mark or unmark invitees as no-shows

### Scheduling
- Create one-time scheduling links for specific event types
- Check availability for scheduling
- List and view availability schedules

### Organization
- Get organization details
- List organization members

### Safety Rules
1. **Confirm before canceling events** - show event details, attendees, and scheduled time:
\`\`\`action-preview
{
  "platform": "Calendly",
  "action": "Cancel Event",
  "event": "Event name",
  "time": "Scheduled time",
  "attendees": ["attendee1@email.com"],
  "toolName": "composio_CALENDLY_CANCEL_EVENT",
  "toolParams": { "uuid": "...", "reason": "..." }
}
\`\`\`
2. **Always include timezone context** when displaying event times
3. **Share scheduling links clearly** - format the URL prominently for easy sharing
4. **Confirm before marking no-shows** - this affects the invitee's record
`;
}

export function getCalendlyCapabilitySummary(): string {
  const stats = getCalendlyActionStats();
  return `Calendly (${stats.total} actions: events, event types, invitees, scheduling)`;
}

export function logCalendlyToolkitStats(): void {
  const stats = getCalendlyActionStats();
  log.info('Calendly Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
