/**
 * COMPOSIO HUBSPOT TOOLKIT
 * ========================
 *
 * Comprehensive HubSpot CRM integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Contacts (create, update, search, manage contacts)
 * - Companies (create, update, search, manage companies)
 * - Deals (create, update, search, pipelines, stages)
 * - Tickets (create, update, manage support tickets)
 * - Lists (create, manage contact lists)
 * - Emails (send emails via HubSpot)
 * - Notes (create, manage engagement notes)
 * - Tasks (create, update, complete tasks)
 */

import { logger } from '@/lib/logger';

const log = logger('HubSpotToolkit');

// ============================================================================
// HUBSPOT ACTION CATEGORIES
// ============================================================================

export type HubSpotActionCategory =
  | 'contacts'
  | 'companies'
  | 'deals'
  | 'tickets'
  | 'lists'
  | 'emails'
  | 'notes'
  | 'tasks';

export interface HubSpotAction {
  name: string; // Composio action name (e.g., HUBSPOT_CREATE_CONTACT)
  label: string; // Human-readable label
  category: HubSpotActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when HubSpot connected)
// ============================================================================

const ESSENTIAL_ACTIONS: HubSpotAction[] = [
  // Contacts
  {
    name: 'HUBSPOT_CREATE_CONTACT',
    label: 'Create Contact',
    category: 'contacts',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_LIST_CONTACTS',
    label: 'List Contacts',
    category: 'contacts',
    priority: 1,
  },
  {
    name: 'HUBSPOT_GET_CONTACT',
    label: 'Get Contact',
    category: 'contacts',
    priority: 1,
  },
  {
    name: 'HUBSPOT_UPDATE_CONTACT',
    label: 'Update Contact',
    category: 'contacts',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_SEARCH_CONTACTS',
    label: 'Search Contacts',
    category: 'contacts',
    priority: 1,
  },

  // Deals
  {
    name: 'HUBSPOT_CREATE_DEAL',
    label: 'Create Deal',
    category: 'deals',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_LIST_DEALS',
    label: 'List Deals',
    category: 'deals',
    priority: 1,
  },
  {
    name: 'HUBSPOT_GET_DEAL',
    label: 'Get Deal',
    category: 'deals',
    priority: 1,
  },

  // Companies
  {
    name: 'HUBSPOT_CREATE_COMPANY',
    label: 'Create Company',
    category: 'companies',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_LIST_COMPANIES',
    label: 'List Companies',
    category: 'companies',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: HubSpotAction[] = [
  // Deals - Extended
  {
    name: 'HUBSPOT_UPDATE_DEAL',
    label: 'Update Deal',
    category: 'deals',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_SEARCH_DEALS',
    label: 'Search Deals',
    category: 'deals',
    priority: 2,
  },

  // Companies - Extended
  {
    name: 'HUBSPOT_GET_COMPANY',
    label: 'Get Company',
    category: 'companies',
    priority: 2,
  },
  {
    name: 'HUBSPOT_UPDATE_COMPANY',
    label: 'Update Company',
    category: 'companies',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_SEARCH_COMPANIES',
    label: 'Search Companies',
    category: 'companies',
    priority: 2,
  },

  // Tickets
  {
    name: 'HUBSPOT_CREATE_TICKET',
    label: 'Create Ticket',
    category: 'tickets',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_LIST_TICKETS',
    label: 'List Tickets',
    category: 'tickets',
    priority: 2,
  },
  {
    name: 'HUBSPOT_GET_TICKET',
    label: 'Get Ticket',
    category: 'tickets',
    priority: 2,
  },
  {
    name: 'HUBSPOT_UPDATE_TICKET',
    label: 'Update Ticket',
    category: 'tickets',
    priority: 2,
    writeOperation: true,
  },

  // Notes
  {
    name: 'HUBSPOT_CREATE_NOTE',
    label: 'Create Note',
    category: 'notes',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_LIST_NOTES',
    label: 'List Notes',
    category: 'notes',
    priority: 2,
  },

  // Tasks
  {
    name: 'HUBSPOT_CREATE_TASK',
    label: 'Create Task',
    category: 'tasks',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_LIST_TASKS',
    label: 'List Tasks',
    category: 'tasks',
    priority: 2,
  },

  // Emails
  {
    name: 'HUBSPOT_SEND_EMAIL',
    label: 'Send Email',
    category: 'emails',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: HubSpotAction[] = [
  // Contacts - Destructive
  {
    name: 'HUBSPOT_DELETE_CONTACT',
    label: 'Delete Contact',
    category: 'contacts',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Deals - Destructive
  {
    name: 'HUBSPOT_DELETE_DEAL',
    label: 'Delete Deal',
    category: 'deals',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Companies - Destructive
  {
    name: 'HUBSPOT_DELETE_COMPANY',
    label: 'Delete Company',
    category: 'companies',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Tickets - Destructive
  {
    name: 'HUBSPOT_DELETE_TICKET',
    label: 'Delete Ticket',
    category: 'tickets',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Lists
  {
    name: 'HUBSPOT_CREATE_LIST',
    label: 'Create List',
    category: 'lists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_LIST_LISTS',
    label: 'List Lists',
    category: 'lists',
    priority: 3,
  },
  {
    name: 'HUBSPOT_ADD_CONTACT_TO_LIST',
    label: 'Add Contact to List',
    category: 'lists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_REMOVE_CONTACT_FROM_LIST',
    label: 'Remove Contact from List',
    category: 'lists',
    priority: 3,
    writeOperation: true,
  },

  // Tasks - Extended
  {
    name: 'HUBSPOT_UPDATE_TASK',
    label: 'Update Task',
    category: 'tasks',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_COMPLETE_TASK',
    label: 'Complete Task',
    category: 'tasks',
    priority: 3,
    writeOperation: true,
  },

  // Associations
  {
    name: 'HUBSPOT_ASSOCIATE_OBJECTS',
    label: 'Associate Objects',
    category: 'contacts',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_LIST_ASSOCIATIONS',
    label: 'List Associations',
    category: 'contacts',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations and specialized tools)
// ============================================================================

const ADVANCED_ACTIONS: HubSpotAction[] = [
  {
    name: 'HUBSPOT_DELETE_NOTE',
    label: 'Delete Note',
    category: 'notes',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'HUBSPOT_DELETE_TASK',
    label: 'Delete Task',
    category: 'tasks',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'HUBSPOT_DELETE_LIST',
    label: 'Delete List',
    category: 'lists',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'HUBSPOT_BATCH_CREATE_CONTACTS',
    label: 'Batch Create Contacts',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_BATCH_UPDATE_CONTACTS',
    label: 'Batch Update Contacts',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_LIST_PIPELINES',
    label: 'List Pipelines',
    category: 'deals',
    priority: 4,
  },
  {
    name: 'HUBSPOT_GET_PIPELINE',
    label: 'Get Pipeline',
    category: 'deals',
    priority: 4,
  },
  {
    name: 'HUBSPOT_LIST_DEAL_STAGES',
    label: 'List Deal Stages',
    category: 'deals',
    priority: 4,
  },
  {
    name: 'HUBSPOT_LIST_OWNERS',
    label: 'List Owners',
    category: 'contacts',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_HUBSPOT_ACTIONS: HubSpotAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getHubSpotFeaturedActionNames(): string[] {
  return ALL_HUBSPOT_ACTIONS.map((a) => a.name);
}

export function getHubSpotActionsByPriority(maxPriority: number = 3): HubSpotAction[] {
  return ALL_HUBSPOT_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getHubSpotActionNamesByPriority(maxPriority: number = 3): string[] {
  return getHubSpotActionsByPriority(maxPriority).map((a) => a.name);
}

export function getHubSpotActionsByCategory(category: HubSpotActionCategory): HubSpotAction[] {
  return ALL_HUBSPOT_ACTIONS.filter((a) => a.category === category);
}

export function getHubSpotActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_HUBSPOT_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownHubSpotAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_HUBSPOT_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveHubSpotAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_HUBSPOT_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by HubSpot action priority.
 * Known HubSpot actions sorted by priority (1-4), unknown actions last.
 */
export function sortByHubSpotPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getHubSpotActionPriority(a.name) - getHubSpotActionPriority(b.name);
  });
}

export function getHubSpotActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_HUBSPOT_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_HUBSPOT_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate HubSpot-specific system prompt when user has HubSpot connected.
 * Tells Claude exactly what it can do via the Composio HubSpot toolkit.
 */
export function getHubSpotSystemPrompt(): string {
  return `
## HubSpot CRM Integration (Full Capabilities)

You have **full HubSpot CRM access** through the user's connected account. Use the \`composio_HUBSPOT_*\` tools.

### Contact Management
- Create, update, and search contacts by name, email, or properties
- List all contacts with pagination support
- Delete contacts when explicitly requested
- Batch create or update contacts for bulk operations
- Associate contacts with companies, deals, and tickets
- List contact associations to understand relationships

### Deal Tracking
- Create deals with pipeline, stage, amount, and close date
- Update deal properties (stage, amount, owner, etc.)
- Search deals by name, amount, stage, or custom properties
- List all deals across pipelines
- View deal pipelines and their stages
- Delete deals when explicitly requested

### Company Management
- Create and manage company records
- Update company properties (name, domain, industry, etc.)
- Search companies by name, domain, or properties
- Associate companies with contacts and deals

### Ticketing
- Create support tickets with priority and status
- Update ticket properties and status
- List and search tickets for support tracking
- Delete tickets when explicitly requested

### Email
- Send emails through HubSpot to contacts
- Track email engagement and delivery

### Notes & Tasks
- Create engagement notes on contacts, deals, and companies
- Create and manage tasks with due dates and assignments
- Update task status and mark tasks as complete
- List notes and tasks for activity tracking

### Lists
- Create static or dynamic contact lists
- Add or remove contacts from lists
- View all lists and their membership

### Account
- List owners for assignment to contacts, deals, and tickets

### Safety Rules
1. **ALWAYS confirm before sending emails** - show recipient, subject, and body for approval:
\`\`\`action-preview
{
  "platform": "HubSpot",
  "action": "Send Email",
  "to": "recipient@example.com",
  "subject": "Email subject",
  "toolName": "composio_HUBSPOT_SEND_EMAIL",
  "toolParams": { "to": "...", "subject": "...", "body": "..." }
}
\`\`\`
2. **Never delete CRM data without explicit approval** - deletion of contacts, deals, companies, and tickets is permanent
3. **Confirm before bulk operations** - batch create/update operations should be summarized and approved first
4. **Verify deal amounts and stages** before creating or updating deals - show pipeline, stage, and monetary values
5. **For contact updates**, confirm the correct contact before modifying properties
6. **For ticket operations**, clearly show priority, status, and assignment before creating
7. **Handle CRM data carefully** - always double-check names, emails, and association targets
8. **For batch operations**, summarize what will happen and get explicit approval
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getHubSpotCapabilitySummary(): string {
  const stats = getHubSpotActionStats();
  return `HubSpot CRM (${stats.total} actions: contacts, deals, companies, tickets, emails, tasks)`;
}

export function logHubSpotToolkitStats(): void {
  const stats = getHubSpotActionStats();
  log.info('HubSpot Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
