/**
 * COMPOSIO EVENTBRITE TOOLKIT
 * ============================
 *
 * Comprehensive Eventbrite integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Events (create, update, publish, list events)
 * - Tickets (ticket classes, pricing, availability)
 * - Orders (order management, refunds)
 * - Attendees (check-in, attendee details)
 * - Venues (venue creation, management)
 */

import { logger } from '@/lib/logger';

const log = logger('EventbriteToolkit');

// ============================================================================
// EVENTBRITE ACTION CATEGORIES
// ============================================================================

export type EventbriteActionCategory = 'events' | 'tickets' | 'orders' | 'attendees' | 'venues';

export interface EventbriteAction {
  name: string; // Composio action name (e.g., EVENTBRITE_CREATE_EVENT)
  label: string; // Human-readable label
  category: EventbriteActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Eventbrite connected)
// ============================================================================

const ESSENTIAL_ACTIONS: EventbriteAction[] = [
  // Events - Core
  {
    name: 'EVENTBRITE_CREATE_EVENT',
    label: 'Create Event',
    category: 'events',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'EVENTBRITE_LIST_EVENTS',
    label: 'List Events',
    category: 'events',
    priority: 1,
  },
  {
    name: 'EVENTBRITE_GET_EVENT',
    label: 'Get Event Details',
    category: 'events',
    priority: 1,
  },
  {
    name: 'EVENTBRITE_PUBLISH_EVENT',
    label: 'Publish Event',
    category: 'events',
    priority: 1,
    writeOperation: true,
  },

  // Tickets - Core
  {
    name: 'EVENTBRITE_CREATE_TICKET_CLASS',
    label: 'Create Ticket Class',
    category: 'tickets',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'EVENTBRITE_LIST_TICKET_CLASSES',
    label: 'List Ticket Classes',
    category: 'tickets',
    priority: 1,
  },

  // Attendees - Core
  {
    name: 'EVENTBRITE_GET_ATTENDEES',
    label: 'Get Attendees',
    category: 'attendees',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: EventbriteAction[] = [
  // Events - Extended
  {
    name: 'EVENTBRITE_UPDATE_EVENT',
    label: 'Update Event',
    category: 'events',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'EVENTBRITE_SEARCH_EVENTS',
    label: 'Search Events',
    category: 'events',
    priority: 2,
  },
  {
    name: 'EVENTBRITE_GET_EVENT_SUMMARY',
    label: 'Get Event Summary',
    category: 'events',
    priority: 2,
  },

  // Orders - Core
  {
    name: 'EVENTBRITE_GET_EVENT_ORDERS',
    label: 'Get Event Orders',
    category: 'orders',
    priority: 2,
  },
  {
    name: 'EVENTBRITE_GET_ORDER',
    label: 'Get Order Details',
    category: 'orders',
    priority: 2,
  },

  // Tickets - Extended
  {
    name: 'EVENTBRITE_UPDATE_TICKET_CLASS',
    label: 'Update Ticket Class',
    category: 'tickets',
    priority: 2,
    writeOperation: true,
  },

  // Attendees - Extended
  {
    name: 'EVENTBRITE_GET_ATTENDEE',
    label: 'Get Attendee Details',
    category: 'attendees',
    priority: 2,
  },
  {
    name: 'EVENTBRITE_CHECK_IN_ATTENDEE',
    label: 'Check In Attendee',
    category: 'attendees',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: EventbriteAction[] = [
  // Events - Extended
  {
    name: 'EVENTBRITE_COPY_EVENT',
    label: 'Copy Event',
    category: 'events',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'EVENTBRITE_UNPUBLISH_EVENT',
    label: 'Unpublish Event',
    category: 'events',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'EVENTBRITE_GET_EVENT_DISPLAY_SETTINGS',
    label: 'Get Display Settings',
    category: 'events',
    priority: 3,
  },

  // Venues - Core
  {
    name: 'EVENTBRITE_CREATE_VENUE',
    label: 'Create Venue',
    category: 'venues',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'EVENTBRITE_LIST_VENUES',
    label: 'List Venues',
    category: 'venues',
    priority: 3,
  },
  {
    name: 'EVENTBRITE_GET_VENUE',
    label: 'Get Venue Details',
    category: 'venues',
    priority: 3,
  },

  // Orders - Extended
  {
    name: 'EVENTBRITE_LIST_ORDER_ATTENDEES',
    label: 'List Order Attendees',
    category: 'orders',
    priority: 3,
  },

  // Attendees - Extended
  {
    name: 'EVENTBRITE_LIST_ATTENDEE_ANSWERS',
    label: 'List Attendee Answers',
    category: 'attendees',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: EventbriteAction[] = [
  // Events - Destructive
  {
    name: 'EVENTBRITE_DELETE_EVENT',
    label: 'Delete Event',
    category: 'events',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'EVENTBRITE_CANCEL_EVENT',
    label: 'Cancel Event',
    category: 'events',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Tickets - Destructive
  {
    name: 'EVENTBRITE_DELETE_TICKET_CLASS',
    label: 'Delete Ticket Class',
    category: 'tickets',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Venues - Extended
  {
    name: 'EVENTBRITE_UPDATE_VENUE',
    label: 'Update Venue',
    category: 'venues',
    priority: 4,
    writeOperation: true,
  },

  // Orders - Destructive
  {
    name: 'EVENTBRITE_REFUND_ORDER',
    label: 'Refund Order',
    category: 'orders',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_EVENTBRITE_ACTIONS: EventbriteAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getEventbriteFeaturedActionNames(): string[] {
  return ALL_EVENTBRITE_ACTIONS.map((a) => a.name);
}

export function getEventbriteActionsByPriority(maxPriority: number = 3): EventbriteAction[] {
  return ALL_EVENTBRITE_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getEventbriteActionNamesByPriority(maxPriority: number = 3): string[] {
  return getEventbriteActionsByPriority(maxPriority).map((a) => a.name);
}

export function getEventbriteActionsByCategory(
  category: EventbriteActionCategory
): EventbriteAction[] {
  return ALL_EVENTBRITE_ACTIONS.filter((a) => a.category === category);
}

export function getEventbriteActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_EVENTBRITE_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownEventbriteAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_EVENTBRITE_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveEventbriteAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_EVENTBRITE_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Eventbrite action priority.
 * Known Eventbrite actions sorted by priority (1-4), unknown actions last.
 */
export function sortByEventbritePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getEventbriteActionPriority(a.name) - getEventbriteActionPriority(b.name);
  });
}

export function getEventbriteActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_EVENTBRITE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_EVENTBRITE_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Eventbrite-specific system prompt when user has Eventbrite connected.
 * Tells Claude exactly what it can do via the Composio Eventbrite toolkit.
 */
export function getEventbriteSystemPrompt(): string {
  return `
## Eventbrite Integration (Full Capabilities)

You have **full Eventbrite access** through the user's connected account. Use the \`composio_EVENTBRITE_*\` tools.

### Events
- Create, update, and publish events
- List and search events across the organization
- Copy existing events as templates
- Unpublish, cancel, or delete events
- View event summaries and display settings

### Tickets
- Create ticket classes with pricing and availability
- Update ticket class details (price, quantity, visibility)
- List all ticket classes for an event
- Delete ticket classes (with confirmation)

### Orders
- View all orders for an event
- Get detailed order information
- List attendees associated with an order
- Process refunds (with confirmation)

### Attendees
- Get attendee lists for events
- View individual attendee details
- Check in attendees at the event
- View attendee questionnaire answers

### Venues
- Create and manage venue locations
- List available venues
- Get venue details (address, capacity)
- Update venue information

### Safety Rules
1. **ALWAYS preview before publishing** - show event details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Eventbrite",
  "action": "Publish Event",
  "content": "Event title and details...",
  "toolName": "composio_EVENTBRITE_PUBLISH_EVENT",
  "toolParams": { "event_id": "..." }
}
\`\`\`
2. **Confirm event details before publishing** - verify date, time, venue, and ticket info
3. **Never delete or cancel without confirmation** - always show what will be affected
4. **For refunds**, show order details and refund amount before processing
5. **For ticket changes**, confirm pricing and availability impacts
6. **Handle capacity limits** - warn when events approach venue capacity
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getEventbriteCapabilitySummary(): string {
  const stats = getEventbriteActionStats();
  return `Eventbrite (${stats.total} actions: events, tickets, orders, attendees, venues)`;
}

export function logEventbriteToolkitStats(): void {
  const stats = getEventbriteActionStats();
  log.info('Eventbrite Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
