/**
 * COMPOSIO FRESHDESK TOOLKIT
 * ============================
 *
 * Comprehensive Freshdesk integration via Composio's tools.
 *
 * Categories:
 * - Tickets (create, update, list, search, reply)
 * - Contacts (create, update, list, search)
 * - Companies (create, update, list)
 * - Agents (list, get)
 * - Groups (list, get)
 */

import { logger } from '@/lib/logger';

const log = logger('FreshdeskToolkit');

export type FreshdeskActionCategory = 'tickets' | 'contacts' | 'companies' | 'agents' | 'groups';

export interface FreshdeskAction {
  name: string;
  label: string;
  category: FreshdeskActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: FreshdeskAction[] = [
  {
    name: 'FRESHDESK_CREATE_TICKET',
    label: 'Create Ticket',
    category: 'tickets',
    priority: 1,
    writeOperation: true,
  },
  { name: 'FRESHDESK_GET_TICKET', label: 'Get Ticket', category: 'tickets', priority: 1 },
  { name: 'FRESHDESK_LIST_TICKETS', label: 'List Tickets', category: 'tickets', priority: 1 },
  {
    name: 'FRESHDESK_REPLY_TICKET',
    label: 'Reply to Ticket',
    category: 'tickets',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'FRESHDESK_UPDATE_TICKET',
    label: 'Update Ticket',
    category: 'tickets',
    priority: 1,
    writeOperation: true,
  },
  { name: 'FRESHDESK_SEARCH_TICKETS', label: 'Search Tickets', category: 'tickets', priority: 1 },
];

const IMPORTANT_ACTIONS: FreshdeskAction[] = [
  {
    name: 'FRESHDESK_CREATE_CONTACT',
    label: 'Create Contact',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },
  { name: 'FRESHDESK_GET_CONTACT', label: 'Get Contact', category: 'contacts', priority: 2 },
  { name: 'FRESHDESK_LIST_CONTACTS', label: 'List Contacts', category: 'contacts', priority: 2 },
  {
    name: 'FRESHDESK_ADD_NOTE',
    label: 'Add Note to Ticket',
    category: 'tickets',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'FRESHDESK_LIST_CONVERSATIONS',
    label: 'List Ticket Conversations',
    category: 'tickets',
    priority: 2,
  },
];

const USEFUL_ACTIONS: FreshdeskAction[] = [
  {
    name: 'FRESHDESK_CREATE_COMPANY',
    label: 'Create Company',
    category: 'companies',
    priority: 3,
    writeOperation: true,
  },
  { name: 'FRESHDESK_LIST_COMPANIES', label: 'List Companies', category: 'companies', priority: 3 },
  {
    name: 'FRESHDESK_UPDATE_CONTACT',
    label: 'Update Contact',
    category: 'contacts',
    priority: 3,
    writeOperation: true,
  },
  { name: 'FRESHDESK_LIST_AGENTS', label: 'List Agents', category: 'agents', priority: 3 },
  { name: 'FRESHDESK_LIST_GROUPS', label: 'List Groups', category: 'groups', priority: 3 },
  {
    name: 'FRESHDESK_SEARCH_CONTACTS',
    label: 'Search Contacts',
    category: 'contacts',
    priority: 3,
  },
];

const ADVANCED_ACTIONS: FreshdeskAction[] = [
  {
    name: 'FRESHDESK_DELETE_TICKET',
    label: 'Delete Ticket',
    category: 'tickets',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'FRESHDESK_DELETE_CONTACT',
    label: 'Delete Contact',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'FRESHDESK_UPDATE_COMPANY',
    label: 'Update Company',
    category: 'companies',
    priority: 4,
    writeOperation: true,
  },
  { name: 'FRESHDESK_GET_AGENT', label: 'Get Agent', category: 'agents', priority: 4 },
];

export const ALL_FRESHDESK_ACTIONS: FreshdeskAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getFreshdeskFeaturedActionNames(): string[] {
  return ALL_FRESHDESK_ACTIONS.map((a) => a.name);
}
export function getFreshdeskActionsByPriority(maxPriority: number = 3): FreshdeskAction[] {
  return ALL_FRESHDESK_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getFreshdeskActionNamesByPriority(maxPriority: number = 3): string[] {
  return getFreshdeskActionsByPriority(maxPriority).map((a) => a.name);
}
export function getFreshdeskActionsByCategory(
  category: FreshdeskActionCategory
): FreshdeskAction[] {
  return ALL_FRESHDESK_ACTIONS.filter((a) => a.category === category);
}
export function getFreshdeskActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_FRESHDESK_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownFreshdeskAction(toolName: string): boolean {
  return ALL_FRESHDESK_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveFreshdeskAction(toolName: string): boolean {
  return (
    ALL_FRESHDESK_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))
      ?.destructive === true
  );
}
export function sortByFreshdeskPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getFreshdeskActionPriority(a.name) - getFreshdeskActionPriority(b.name)
  );
}

export function getFreshdeskActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_FRESHDESK_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_FRESHDESK_ACTIONS.length, byPriority, byCategory };
}

export function getFreshdeskSystemPrompt(): string {
  return `
## Freshdesk Integration (Full Capabilities)

You have **full Freshdesk access** through the user's connected account. Use the \`composio_FRESHDESK_*\` tools.

### Tickets
- Create, update, and search support tickets
- Reply to tickets and add private notes
- View ticket conversations and history

### Contacts & Companies
- Create and manage customer contacts
- Organize contacts into companies
- Search across contacts and companies

### Team Management
- List agents and support groups
- View agent details and assignments

### Safety Rules
1. **Confirm before deleting tickets or contacts** - deletion is permanent
2. **Show ticket details before replying** - ensure correct context
3. **For status changes**, confirm the new status with the user
`;
}

export function getFreshdeskCapabilitySummary(): string {
  const stats = getFreshdeskActionStats();
  return `Freshdesk (${stats.total} actions: tickets, contacts, companies, agents, groups)`;
}

export function logFreshdeskToolkitStats(): void {
  const stats = getFreshdeskActionStats();
  log.info('Freshdesk Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
