/**
 * COMPOSIO ACTIVECAMPAIGN TOOLKIT
 * =================================
 *
 * Comprehensive ActiveCampaign integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Contacts (create, update, manage contacts)
 * - Campaigns (email campaign management)
 * - Automations (automation workflows)
 * - Deals (CRM deal pipeline)
 * - Lists (subscription list management)
 */

import { logger } from '@/lib/logger';

const log = logger('ActiveCampaignToolkit');

// ============================================================================
// ACTIVECAMPAIGN ACTION CATEGORIES
// ============================================================================

export type ActiveCampaignActionCategory =
  | 'contacts'
  | 'campaigns'
  | 'automations'
  | 'deals'
  | 'lists';

export interface ActiveCampaignAction {
  name: string; // Composio action name (e.g., ACTIVECAMPAIGN_CREATE_CONTACT)
  label: string; // Human-readable label
  category: ActiveCampaignActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when ActiveCampaign connected)
// ============================================================================

const ESSENTIAL_ACTIONS: ActiveCampaignAction[] = [
  // Contacts - Core
  {
    name: 'ACTIVECAMPAIGN_CREATE_CONTACT',
    label: 'Create Contact',
    category: 'contacts',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'ACTIVECAMPAIGN_GET_CONTACT',
    label: 'Get Contact',
    category: 'contacts',
    priority: 1,
  },
  {
    name: 'ACTIVECAMPAIGN_LIST_CONTACTS',
    label: 'List Contacts',
    category: 'contacts',
    priority: 1,
  },
  {
    name: 'ACTIVECAMPAIGN_ADD_TAG',
    label: 'Add Tag to Contact',
    category: 'contacts',
    priority: 1,
    writeOperation: true,
  },

  // Campaigns - Core
  {
    name: 'ACTIVECAMPAIGN_CREATE_CAMPAIGN',
    label: 'Create Campaign',
    category: 'campaigns',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'ACTIVECAMPAIGN_LIST_CAMPAIGNS',
    label: 'List Campaigns',
    category: 'campaigns',
    priority: 1,
  },

  // Lists - Core
  {
    name: 'ACTIVECAMPAIGN_LIST_LISTS',
    label: 'List All Lists',
    category: 'lists',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: ActiveCampaignAction[] = [
  // Contacts - Extended
  {
    name: 'ACTIVECAMPAIGN_UPDATE_CONTACT',
    label: 'Update Contact',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'ACTIVECAMPAIGN_SEARCH_CONTACTS',
    label: 'Search Contacts',
    category: 'contacts',
    priority: 2,
  },
  {
    name: 'ACTIVECAMPAIGN_ADD_CONTACT_TO_LIST',
    label: 'Add Contact to List',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'ACTIVECAMPAIGN_REMOVE_TAG',
    label: 'Remove Tag from Contact',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },

  // Deals - Core
  {
    name: 'ACTIVECAMPAIGN_CREATE_DEAL',
    label: 'Create Deal',
    category: 'deals',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'ACTIVECAMPAIGN_LIST_DEALS',
    label: 'List Deals',
    category: 'deals',
    priority: 2,
  },
  {
    name: 'ACTIVECAMPAIGN_GET_DEAL',
    label: 'Get Deal Details',
    category: 'deals',
    priority: 2,
  },

  // Automations - Core
  {
    name: 'ACTIVECAMPAIGN_LIST_AUTOMATIONS',
    label: 'List Automations',
    category: 'automations',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: ActiveCampaignAction[] = [
  // Campaigns - Extended
  {
    name: 'ACTIVECAMPAIGN_GET_CAMPAIGN',
    label: 'Get Campaign Details',
    category: 'campaigns',
    priority: 3,
  },
  {
    name: 'ACTIVECAMPAIGN_SEND_CAMPAIGN',
    label: 'Send Campaign',
    category: 'campaigns',
    priority: 3,
    writeOperation: true,
  },

  // Deals - Extended
  {
    name: 'ACTIVECAMPAIGN_UPDATE_DEAL',
    label: 'Update Deal',
    category: 'deals',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'ACTIVECAMPAIGN_CREATE_DEAL_NOTE',
    label: 'Create Deal Note',
    category: 'deals',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'ACTIVECAMPAIGN_LIST_DEAL_STAGES',
    label: 'List Deal Stages',
    category: 'deals',
    priority: 3,
  },

  // Lists - Extended
  {
    name: 'ACTIVECAMPAIGN_CREATE_LIST',
    label: 'Create List',
    category: 'lists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'ACTIVECAMPAIGN_GET_LIST',
    label: 'Get List Details',
    category: 'lists',
    priority: 3,
  },

  // Automations - Extended
  {
    name: 'ACTIVECAMPAIGN_GET_AUTOMATION',
    label: 'Get Automation Details',
    category: 'automations',
    priority: 3,
  },
  {
    name: 'ACTIVECAMPAIGN_ADD_CONTACT_TO_AUTOMATION',
    label: 'Add Contact to Automation',
    category: 'automations',
    priority: 3,
    writeOperation: true,
  },

  // Contacts - Extended
  {
    name: 'ACTIVECAMPAIGN_GET_CONTACT_TAGS',
    label: 'Get Contact Tags',
    category: 'contacts',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: ActiveCampaignAction[] = [
  // Contacts - Destructive
  {
    name: 'ACTIVECAMPAIGN_DELETE_CONTACT',
    label: 'Delete Contact',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'ACTIVECAMPAIGN_REMOVE_CONTACT_FROM_LIST',
    label: 'Remove Contact from List',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Deals - Destructive
  {
    name: 'ACTIVECAMPAIGN_DELETE_DEAL',
    label: 'Delete Deal',
    category: 'deals',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Lists - Destructive
  {
    name: 'ACTIVECAMPAIGN_DELETE_LIST',
    label: 'Delete List',
    category: 'lists',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Automations - Destructive
  {
    name: 'ACTIVECAMPAIGN_REMOVE_CONTACT_FROM_AUTOMATION',
    label: 'Remove Contact from Automation',
    category: 'automations',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_ACTIVECAMPAIGN_ACTIONS: ActiveCampaignAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getActiveCampaignFeaturedActionNames(): string[] {
  return ALL_ACTIVECAMPAIGN_ACTIONS.map((a) => a.name);
}

export function getActiveCampaignActionsByPriority(
  maxPriority: number = 3
): ActiveCampaignAction[] {
  return ALL_ACTIVECAMPAIGN_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getActiveCampaignActionNamesByPriority(maxPriority: number = 3): string[] {
  return getActiveCampaignActionsByPriority(maxPriority).map((a) => a.name);
}

export function getActiveCampaignActionsByCategory(
  category: ActiveCampaignActionCategory
): ActiveCampaignAction[] {
  return ALL_ACTIVECAMPAIGN_ACTIONS.filter((a) => a.category === category);
}

export function getActiveCampaignActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_ACTIVECAMPAIGN_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownActiveCampaignAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_ACTIVECAMPAIGN_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveActiveCampaignAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_ACTIVECAMPAIGN_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by ActiveCampaign action priority.
 * Known ActiveCampaign actions sorted by priority (1-4), unknown actions last.
 */
export function sortByActiveCampaignPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getActiveCampaignActionPriority(a.name) - getActiveCampaignActionPriority(b.name);
  });
}

export function getActiveCampaignActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_ACTIVECAMPAIGN_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_ACTIVECAMPAIGN_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate ActiveCampaign-specific system prompt when user has ActiveCampaign connected.
 * Tells Claude exactly what it can do via the Composio ActiveCampaign toolkit.
 */
export function getActiveCampaignSystemPrompt(): string {
  return `
## ActiveCampaign Integration (Full Capabilities)

You have **full ActiveCampaign access** through the user's connected account. Use the \`composio_ACTIVECAMPAIGN_*\` tools.

### Contacts
- Create, update, and manage contacts
- Search contacts by email, name, or custom fields
- Add and remove tags on contacts
- Add or remove contacts from lists
- View contact tag assignments
- Delete contacts (with confirmation)

### Campaigns
- Create and manage email campaigns
- List all campaigns with status
- View campaign details and performance
- Send campaigns to targeted lists

### Automations
- List all automation workflows
- View automation details and steps
- Add contacts to automations to trigger sequences
- Remove contacts from automations (with confirmation)

### Deals (CRM)
- Create deals in the sales pipeline
- List and view deal details
- Update deal stage, value, and properties
- Add notes to deals for context
- View deal pipeline stages
- Delete deals (with confirmation)

### Lists
- View all subscription lists
- Create new lists for segmentation
- Get list details and subscriber counts
- Delete lists (with confirmation)

### Safety Rules
1. **ALWAYS preview before sending** - show campaign details using the action-preview format:
\`\`\`action-preview
{
  "platform": "ActiveCampaign",
  "action": "Send Campaign",
  "content": "Campaign subject and target list...",
  "toolName": "composio_ACTIVECAMPAIGN_SEND_CAMPAIGN",
  "toolParams": { "campaign_id": "..." }
}
\`\`\`
2. **Confirm recipient list before sending** - verify the target audience
3. **Never delete without confirmation** - always show what will be affected
4. **For tag operations**, confirm the tag name and affected contacts
5. **For automation enrollment**, explain what the automation does before adding contacts
6. **For deal updates**, show current vs proposed values before changing
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getActiveCampaignCapabilitySummary(): string {
  const stats = getActiveCampaignActionStats();
  return `ActiveCampaign (${stats.total} actions: contacts, campaigns, automations, deals, lists)`;
}

export function logActiveCampaignToolkitStats(): void {
  const stats = getActiveCampaignActionStats();
  log.info('ActiveCampaign Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
