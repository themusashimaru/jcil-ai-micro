/**
 * COMPOSIO HUBSPOT TOOLKIT
 * ========================
 *
 * Comprehensive HubSpot CRM integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Contacts (create, update, search, list, batch, delete)
 * - Deals (create, update, stage changes, pipelines, search)
 * - Companies (create, update, search, list)
 * - Tickets (create, update, search, manage support tickets)
 * - Emails (send, log, track email activity)
 * - Lists (create, manage, add/remove contacts)
 */

import { logger } from '@/lib/logger';

const log = logger('HubSpotToolkit');

// ============================================================================
// HUBSPOT ACTION CATEGORIES
// ============================================================================

export type HubSpotActionCategory =
  | 'contacts'
  | 'deals'
  | 'companies'
  | 'tickets'
  | 'emails'
  | 'lists';

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
  // Contacts - Core
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
    name: 'HUBSPOT_SEARCH_CONTACTS',
    label: 'Search Contacts',
    category: 'contacts',
    priority: 1,
  },

  // Deals - Core
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

  // Companies - Core
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
  // Contacts - Extended
  {
    name: 'HUBSPOT_UPDATE_CONTACT',
    label: 'Update Contact',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },

  // Deals - Extended
  {
    name: 'HUBSPOT_UPDATE_DEAL',
    label: 'Update Deal',
    category: 'deals',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_UPDATE_DEAL_STAGE',
    label: 'Update Deal Stage',
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

  // Tickets - Core
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

  // Emails - Core
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
  // Contacts - Batch
  {
    name: 'HUBSPOT_BATCH_CREATE_CONTACTS',
    label: 'Batch Create Contacts',
    category: 'contacts',
    priority: 3,
    writeOperation: true,
  },

  // Tickets - Extended
  {
    name: 'HUBSPOT_GET_TICKET',
    label: 'Get Ticket',
    category: 'tickets',
    priority: 3,
  },
  {
    name: 'HUBSPOT_UPDATE_TICKET',
    label: 'Update Ticket',
    category: 'tickets',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_SEARCH_TICKETS',
    label: 'Search Tickets',
    category: 'tickets',
    priority: 3,
  },

  // Emails - Extended
  {
    name: 'HUBSPOT_LOG_EMAIL',
    label: 'Log Email Activity',
    category: 'emails',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_GET_EMAIL_EVENTS',
    label: 'Get Email Events',
    category: 'emails',
    priority: 3,
  },

  // Lists - Core
  {
    name: 'HUBSPOT_CREATE_LIST',
    label: 'Create List',
    category: 'lists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'HUBSPOT_LIST_LISTS',
    label: 'List All Lists',
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

  // Deals - Pipeline
  {
    name: 'HUBSPOT_LIST_DEAL_PIPELINES',
    label: 'List Deal Pipelines',
    category: 'deals',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: HubSpotAction[] = [
  // Contacts - Destructive
  {
    name: 'HUBSPOT_DELETE_CONTACT',
    label: 'Delete Contact',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Deals - Destructive
  {
    name: 'HUBSPOT_DELETE_DEAL',
    label: 'Delete Deal',
    category: 'deals',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Companies - Destructive
  {
    name: 'HUBSPOT_DELETE_COMPANY',
    label: 'Delete Company',
    category: 'companies',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Tickets - Destructive
  {
    name: 'HUBSPOT_DELETE_TICKET',
    label: 'Delete Ticket',
    category: 'tickets',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Lists - Extended
  {
    name: 'HUBSPOT_REMOVE_CONTACT_FROM_LIST',
    label: 'Remove Contact from List',
    category: 'lists',
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

You have **full HubSpot CRM access** through the user's connected account. HubSpot is a CRM platform for managing contacts, deals, companies, support tickets, and email campaigns. Use the \`composio_HUBSPOT_*\` tools.

### Contacts
- Create new contacts with name, email, phone, and custom properties
- List and search contacts across the CRM
- Get detailed contact information by ID
- Update contact properties and details
- Batch create multiple contacts at once
- Delete contacts (with confirmation)

### Deals
- Create new deals with amount, stage, and associated contacts
- List and search deals across pipelines
- Get detailed deal information by ID
- Update deal properties and move deals between stages
- View deal pipeline configurations
- Delete deals (with confirmation)

### Companies
- Create new companies with name, domain, and industry
- List and search companies in the CRM
- Get detailed company information by ID
- Update company properties and details
- Delete companies (with confirmation)

### Tickets
- Create support tickets with priority and status
- List and search open tickets
- Get detailed ticket information by ID
- Update ticket status and properties
- Delete tickets (with confirmation)

### Emails
- Send emails through HubSpot to contacts
- Log email activity against contact records
- Track email open and click events

### Lists
- Create static or dynamic contact lists
- View all existing contact lists
- Add contacts to lists for segmentation
- Remove contacts from lists
- Delete lists (with confirmation)

### Safety Rules
1. **ALWAYS preview before creating** - show record details using the action-preview format:
\`\`\`action-preview
{
  "platform": "HubSpot",
  "action": "Create Contact",
  "details": "Name: John Doe, Email: john@example.com",
  "toolName": "composio_HUBSPOT_CREATE_CONTACT",
  "toolParams": { "email": "john@example.com", "firstname": "John", "lastname": "Doe" }
}
\`\`\`
2. **Confirm before sending emails** - show recipient, subject, and body before sending
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For deal stage changes**, show the current stage and proposed new stage before updating
5. **For batch operations**, show a summary of all records that will be affected
6. **Verify contact exists** before associating with deals, tickets, or lists
7. **Handle duplicate contacts gracefully** - search before creating to avoid duplicates
8. **Respect data integrity** - warn when updating critical fields like email or deal amount
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getHubSpotCapabilitySummary(): string {
  const stats = getHubSpotActionStats();
  return `HubSpot CRM (${stats.total} actions: contacts, deals, companies, tickets, emails, lists)`;
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
