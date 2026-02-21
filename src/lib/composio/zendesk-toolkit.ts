/**
 * COMPOSIO ZENDESK TOOLKIT
 * ========================
 *
 * Comprehensive Zendesk integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Tickets (create, get, update, delete, search, list)
 * - Users (create, get, list, search)
 * - Organizations (create, list, get)
 * - Comments (add, list)
 * - Groups (list, get)
 * - Views (list, get)
 */

import { logger } from '@/lib/logger';

const log = logger('ZendeskToolkit');

// ============================================================================
// ZENDESK ACTION CATEGORIES
// ============================================================================

export type ZendeskActionCategory =
  | 'tickets'
  | 'users'
  | 'organizations'
  | 'comments'
  | 'groups'
  | 'views';

export interface ZendeskAction {
  name: string;
  label: string;
  category: ZendeskActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL
// ============================================================================

const ESSENTIAL_ACTIONS: ZendeskAction[] = [
  {
    name: 'ZENDESK_CREATE_TICKET',
    label: 'Create Ticket',
    category: 'tickets',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'ZENDESK_GET_TICKET',
    label: 'Get Ticket',
    category: 'tickets',
    priority: 1,
  },
  {
    name: 'ZENDESK_UPDATE_TICKET',
    label: 'Update Ticket',
    category: 'tickets',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'ZENDESK_LIST_TICKETS',
    label: 'List Tickets',
    category: 'tickets',
    priority: 1,
  },
  {
    name: 'ZENDESK_SEARCH_TICKETS',
    label: 'Search Tickets',
    category: 'tickets',
    priority: 1,
  },
  {
    name: 'ZENDESK_ADD_COMMENT',
    label: 'Add Comment',
    category: 'comments',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT
// ============================================================================

const IMPORTANT_ACTIONS: ZendeskAction[] = [
  {
    name: 'ZENDESK_LIST_COMMENTS',
    label: 'List Comments',
    category: 'comments',
    priority: 2,
  },
  {
    name: 'ZENDESK_CREATE_USER',
    label: 'Create User',
    category: 'users',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'ZENDESK_GET_USER',
    label: 'Get User',
    category: 'users',
    priority: 2,
  },
  {
    name: 'ZENDESK_SEARCH_USERS',
    label: 'Search Users',
    category: 'users',
    priority: 2,
  },
  {
    name: 'ZENDESK_LIST_VIEWS',
    label: 'List Views',
    category: 'views',
    priority: 2,
  },
  {
    name: 'ZENDESK_LIST_GROUPS',
    label: 'List Groups',
    category: 'groups',
    priority: 2,
  },
  {
    name: 'ZENDESK_ASSIGN_TICKET',
    label: 'Assign Ticket',
    category: 'tickets',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL
// ============================================================================

const USEFUL_ACTIONS: ZendeskAction[] = [
  {
    name: 'ZENDESK_LIST_USERS',
    label: 'List Users',
    category: 'users',
    priority: 3,
  },
  {
    name: 'ZENDESK_UPDATE_USER',
    label: 'Update User',
    category: 'users',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'ZENDESK_CREATE_ORGANIZATION',
    label: 'Create Organization',
    category: 'organizations',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'ZENDESK_LIST_ORGANIZATIONS',
    label: 'List Organizations',
    category: 'organizations',
    priority: 3,
  },
  {
    name: 'ZENDESK_GET_ORGANIZATION',
    label: 'Get Organization',
    category: 'organizations',
    priority: 3,
  },
  {
    name: 'ZENDESK_GET_VIEW',
    label: 'Get View',
    category: 'views',
    priority: 3,
  },
  {
    name: 'ZENDESK_GET_GROUP',
    label: 'Get Group',
    category: 'groups',
    priority: 3,
  },
  {
    name: 'ZENDESK_MERGE_TICKETS',
    label: 'Merge Tickets',
    category: 'tickets',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED
// ============================================================================

const ADVANCED_ACTIONS: ZendeskAction[] = [
  {
    name: 'ZENDESK_DELETE_TICKET',
    label: 'Delete Ticket',
    category: 'tickets',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'ZENDESK_DELETE_USER',
    label: 'Delete User',
    category: 'users',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'ZENDESK_BULK_UPDATE_TICKETS',
    label: 'Bulk Update Tickets',
    category: 'tickets',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'ZENDESK_LIST_TICKET_METRICS',
    label: 'List Ticket Metrics',
    category: 'tickets',
    priority: 4,
  },
  {
    name: 'ZENDESK_GET_TICKET_METRICS',
    label: 'Get Ticket Metrics',
    category: 'tickets',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_ZENDESK_ACTIONS: ZendeskAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getZendeskFeaturedActionNames(): string[] {
  return ALL_ZENDESK_ACTIONS.map((a) => a.name);
}

export function getZendeskActionsByPriority(maxPriority: number = 3): ZendeskAction[] {
  return ALL_ZENDESK_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getZendeskActionNamesByPriority(maxPriority: number = 3): string[] {
  return getZendeskActionsByPriority(maxPriority).map((a) => a.name);
}

export function getZendeskActionsByCategory(category: ZendeskActionCategory): ZendeskAction[] {
  return ALL_ZENDESK_ACTIONS.filter((a) => a.category === category);
}

export function getZendeskActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_ZENDESK_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownZendeskAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_ZENDESK_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveZendeskAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_ZENDESK_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

export function sortByZendeskPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getZendeskActionPriority(a.name) - getZendeskActionPriority(b.name);
  });
}

export function getZendeskActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_ZENDESK_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_ZENDESK_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export function getZendeskSystemPrompt(): string {
  return `
## Zendesk Integration (Full Capabilities)

You have **full Zendesk access** through the user's connected account. Use the \`composio_ZENDESK_*\` tools.

### Tickets
- Create support tickets with subject, description, priority, and type
- Get ticket details including status, assignee, and tags
- Update ticket status, priority, assignee, and fields
- Search tickets with query strings
- List tickets with filters (status, assignee, view)
- Assign tickets to agents or groups
- Merge related tickets together

### Comments
- Add public or internal comments to tickets
- List all comments and conversation history on a ticket
- Include attachments in comments

### Users
- Create end-users and agents
- Get user details and profiles
- Search users by name or email
- Update user information

### Organizations
- Create organizations for grouping users
- List and get organization details

### Views & Groups
- List and get saved views for ticket filtering
- List and get agent groups

### Safety Rules
1. **ALWAYS confirm before creating tickets** - show subject, description, and priority:
\`\`\`action-preview
{
  "platform": "Zendesk",
  "action": "Create Ticket",
  "subject": "Ticket subject",
  "priority": "urgent/high/normal/low",
  "toolName": "composio_ZENDESK_CREATE_TICKET",
  "toolParams": { "subject": "...", "description": "...", "priority": "..." }
}
\`\`\`
2. **Confirm before deleting tickets or users** - deletion is permanent
3. **Confirm before bulk operations** - show the scope and changes
4. **Distinguish public vs internal comments** - internal notes are not visible to customers
5. **For ticket merges**, show both tickets and confirm which is the target
`;
}

export function getZendeskCapabilitySummary(): string {
  const stats = getZendeskActionStats();
  return `Zendesk (${stats.total} actions: tickets, users, organizations, comments, views, groups)`;
}

export function logZendeskToolkitStats(): void {
  const stats = getZendeskActionStats();
  log.info('Zendesk Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
