/**
 * COMPOSIO HELPSCOUT TOOLKIT
 * ============================
 *
 * Comprehensive Help Scout integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Conversations (tickets/threads management)
 * - Customers (customer records)
 * - Mailboxes (mailbox configuration)
 * - Tags (tagging and organization)
 */

import { logger } from '@/lib/logger';

const log = logger('HelpScoutToolkit');

// ============================================================================
// HELPSCOUT ACTION CATEGORIES
// ============================================================================

export type HelpScoutActionCategory = 'conversations' | 'customers' | 'mailboxes' | 'tags';

export interface HelpScoutAction {
  name: string; // Composio action name (e.g., HELPSCOUT_CREATE_CONVERSATION)
  label: string; // Human-readable label
  category: HelpScoutActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Help Scout connected)
// ============================================================================

const ESSENTIAL_ACTIONS: HelpScoutAction[] = [
  // Conversations - Core
  {
    name: 'HELPSCOUT_CREATE_CONVERSATION',
    label: 'Create Conversation',
    category: 'conversations',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'HELPSCOUT_GET_CONVERSATIONS',
    label: 'Get Conversations',
    category: 'conversations',
    priority: 1,
  },
  {
    name: 'HELPSCOUT_GET_CONVERSATION',
    label: 'Get Conversation Details',
    category: 'conversations',
    priority: 1,
  },
  {
    name: 'HELPSCOUT_REPLY_CONVERSATION',
    label: 'Reply to Conversation',
    category: 'conversations',
    priority: 1,
    writeOperation: true,
  },

  // Customers - Core
  {
    name: 'HELPSCOUT_CREATE_CUSTOMER',
    label: 'Create Customer',
    category: 'customers',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'HELPSCOUT_GET_CUSTOMERS',
    label: 'Get Customers',
    category: 'customers',
    priority: 1,
  },

  // Mailboxes - Core
  {
    name: 'HELPSCOUT_LIST_MAILBOXES',
    label: 'List Mailboxes',
    category: 'mailboxes',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: HelpScoutAction[] = [
  // Conversations - Extended
  {
    name: 'HELPSCOUT_UPDATE_CONVERSATION',
    label: 'Update Conversation',
    category: 'conversations',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'HELPSCOUT_ADD_NOTE',
    label: 'Add Note to Conversation',
    category: 'conversations',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'HELPSCOUT_ASSIGN_CONVERSATION',
    label: 'Assign Conversation',
    category: 'conversations',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'HELPSCOUT_CHANGE_CONVERSATION_STATUS',
    label: 'Change Conversation Status',
    category: 'conversations',
    priority: 2,
    writeOperation: true,
  },

  // Customers - Extended
  {
    name: 'HELPSCOUT_GET_CUSTOMER',
    label: 'Get Customer Details',
    category: 'customers',
    priority: 2,
  },
  {
    name: 'HELPSCOUT_UPDATE_CUSTOMER',
    label: 'Update Customer',
    category: 'customers',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'HELPSCOUT_SEARCH_CUSTOMERS',
    label: 'Search Customers',
    category: 'customers',
    priority: 2,
  },

  // Tags - Core
  {
    name: 'HELPSCOUT_ADD_TAG',
    label: 'Add Tag',
    category: 'tags',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'HELPSCOUT_LIST_TAGS',
    label: 'List Tags',
    category: 'tags',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: HelpScoutAction[] = [
  // Conversations - Extended
  {
    name: 'HELPSCOUT_SEARCH_CONVERSATIONS',
    label: 'Search Conversations',
    category: 'conversations',
    priority: 3,
  },
  {
    name: 'HELPSCOUT_GET_CONVERSATION_THREADS',
    label: 'Get Conversation Threads',
    category: 'conversations',
    priority: 3,
  },
  {
    name: 'HELPSCOUT_FORWARD_CONVERSATION',
    label: 'Forward Conversation',
    category: 'conversations',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'HELPSCOUT_MOVE_CONVERSATION',
    label: 'Move Conversation to Mailbox',
    category: 'conversations',
    priority: 3,
    writeOperation: true,
  },

  // Mailboxes - Extended
  {
    name: 'HELPSCOUT_GET_MAILBOX',
    label: 'Get Mailbox Details',
    category: 'mailboxes',
    priority: 3,
  },
  {
    name: 'HELPSCOUT_GET_MAILBOX_FOLDERS',
    label: 'Get Mailbox Folders',
    category: 'mailboxes',
    priority: 3,
  },

  // Customers - Extended
  {
    name: 'HELPSCOUT_GET_CUSTOMER_CONVERSATIONS',
    label: 'Get Customer Conversations',
    category: 'customers',
    priority: 3,
  },

  // Tags - Extended
  {
    name: 'HELPSCOUT_REMOVE_TAG',
    label: 'Remove Tag',
    category: 'tags',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: HelpScoutAction[] = [
  // Conversations - Destructive
  {
    name: 'HELPSCOUT_DELETE_CONVERSATION',
    label: 'Delete Conversation',
    category: 'conversations',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'HELPSCOUT_CLOSE_CONVERSATION',
    label: 'Close Conversation',
    category: 'conversations',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'HELPSCOUT_SPAM_CONVERSATION',
    label: 'Mark as Spam',
    category: 'conversations',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Customers - Destructive
  {
    name: 'HELPSCOUT_DELETE_CUSTOMER',
    label: 'Delete Customer',
    category: 'customers',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Tags - Destructive
  {
    name: 'HELPSCOUT_DELETE_TAG',
    label: 'Delete Tag',
    category: 'tags',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_HELPSCOUT_ACTIONS: HelpScoutAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getHelpScoutFeaturedActionNames(): string[] {
  return ALL_HELPSCOUT_ACTIONS.map((a) => a.name);
}

export function getHelpScoutActionsByPriority(maxPriority: number = 3): HelpScoutAction[] {
  return ALL_HELPSCOUT_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getHelpScoutActionNamesByPriority(maxPriority: number = 3): string[] {
  return getHelpScoutActionsByPriority(maxPriority).map((a) => a.name);
}

export function getHelpScoutActionsByCategory(
  category: HelpScoutActionCategory
): HelpScoutAction[] {
  return ALL_HELPSCOUT_ACTIONS.filter((a) => a.category === category);
}

export function getHelpScoutActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_HELPSCOUT_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownHelpScoutAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_HELPSCOUT_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveHelpScoutAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_HELPSCOUT_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Help Scout action priority.
 * Known Help Scout actions sorted by priority (1-4), unknown actions last.
 */
export function sortByHelpScoutPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getHelpScoutActionPriority(a.name) - getHelpScoutActionPriority(b.name);
  });
}

export function getHelpScoutActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_HELPSCOUT_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_HELPSCOUT_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Help Scout-specific system prompt when user has Help Scout connected.
 * Tells Claude exactly what it can do via the Composio Help Scout toolkit.
 */
export function getHelpScoutSystemPrompt(): string {
  return `
## Help Scout Integration (Full Capabilities)

You have **full Help Scout access** through the user's connected account. Use the \`composio_HELPSCOUT_*\` tools.

### Conversations
- Create new support conversations
- Reply to existing conversations
- View conversation details and thread history
- Search conversations by keyword, status, or assignee
- Add internal notes to conversations
- Assign conversations to team members
- Change conversation status (active, pending, closed)
- Forward conversations to external addresses
- Move conversations between mailboxes
- Close conversations
- Delete conversations (with confirmation)
- Mark conversations as spam (with confirmation)

### Customers
- Create and manage customer records
- Search customers by name, email, or other attributes
- View customer details and history
- Get all conversations for a specific customer
- Update customer information
- Delete customers (with confirmation)

### Mailboxes
- List all available mailboxes
- View mailbox details and settings
- Get mailbox folder structure

### Tags
- Add tags to conversations for organization
- List all available tags
- Remove tags from conversations
- Delete tags (with confirmation)

### Safety Rules
1. **ALWAYS preview before replying** - show reply details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Help Scout",
  "action": "Reply to Conversation",
  "content": "Reply text preview...",
  "toolName": "composio_HELPSCOUT_REPLY_CONVERSATION",
  "toolParams": { "conversation_id": "...", "text": "..." }
}
\`\`\`
2. **Confirm recipient before replying** - verify who will receive the response
3. **Never delete without confirmation** - always show what will be removed
4. **For spam marking**, confirm the conversation is genuinely spam before proceeding
5. **For status changes**, explain the impact on the support workflow
6. **For customer deletion**, warn about losing all associated conversation history
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getHelpScoutCapabilitySummary(): string {
  const stats = getHelpScoutActionStats();
  return `Help Scout (${stats.total} actions: conversations, customers, mailboxes, tags)`;
}

export function logHelpScoutToolkitStats(): void {
  const stats = getHelpScoutActionStats();
  log.info('Help Scout Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
