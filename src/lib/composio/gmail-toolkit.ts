/**
 * COMPOSIO GMAIL TOOLKIT
 * ======================
 *
 * Comprehensive Gmail integration via Composio's 40 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Inbox (fetch, search, read emails and threads)
 * - Compose (send, draft, reply, forward)
 * - Organize (labels, trash, batch operations)
 * - Contacts (people, search contacts)
 * - Settings (account settings, filters, forwarding, vacation)
 * - Security (CSE identities, key pairs, S/MIME, protocol settings)
 */

import { logger } from '@/lib/logger';

const log = logger('GmailToolkit');

// ============================================================================
// GMAIL ACTION CATEGORIES
// ============================================================================

export type GmailActionCategory =
  | 'inbox'
  | 'compose'
  | 'organize'
  | 'contacts'
  | 'settings'
  | 'security';

export interface GmailAction {
  name: string; // Composio action name (e.g., GMAIL_SEND_EMAIL)
  label: string; // Human-readable label
  category: GmailActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Gmail connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GmailAction[] = [
  // Compose - Core
  {
    name: 'GMAIL_SEND_EMAIL',
    label: 'Send Email',
    category: 'compose',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GMAIL_CREATE_EMAIL_DRAFT',
    label: 'Create Draft',
    category: 'compose',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GMAIL_REPLY_TO_THREAD',
    label: 'Reply to Thread',
    category: 'compose',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GMAIL_FORWARD_MESSAGE',
    label: 'Forward Email',
    category: 'compose',
    priority: 1,
    writeOperation: true,
  },

  // Inbox - Core
  { name: 'GMAIL_FETCH_EMAILS', label: 'Fetch Emails', category: 'inbox', priority: 1 },
  {
    name: 'GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID',
    label: 'Get Message by ID',
    category: 'inbox',
    priority: 1,
  },
  {
    name: 'GMAIL_FETCH_MESSAGE_BY_THREAD_ID',
    label: 'Get Thread Messages',
    category: 'inbox',
    priority: 1,
  },
  { name: 'GMAIL_LIST_THREADS', label: 'List Threads', category: 'inbox', priority: 1 },
  { name: 'GMAIL_LIST_LABELS', label: 'List Labels', category: 'inbox', priority: 1 },
  { name: 'GMAIL_GET_PROFILE', label: 'Get Profile', category: 'inbox', priority: 1 },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GmailAction[] = [
  // Organize
  {
    name: 'GMAIL_ADD_LABEL_TO_EMAIL',
    label: 'Modify Email Labels',
    category: 'organize',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GMAIL_MODIFY_THREAD_LABELS',
    label: 'Modify Thread Labels',
    category: 'organize',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GMAIL_CREATE_LABEL',
    label: 'Create Label',
    category: 'organize',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GMAIL_MOVE_TO_TRASH',
    label: 'Move to Trash',
    category: 'organize',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GMAIL_BATCH_MODIFY_MESSAGES',
    label: 'Batch Modify Messages',
    category: 'organize',
    priority: 2,
    writeOperation: true,
  },

  // Drafts - Extended
  { name: 'GMAIL_LIST_DRAFTS', label: 'List Drafts', category: 'compose', priority: 2 },
  { name: 'GMAIL_GET_DRAFT', label: 'Get Draft', category: 'compose', priority: 2 },
  {
    name: 'GMAIL_UPDATE_DRAFT',
    label: 'Update Draft',
    category: 'compose',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GMAIL_SEND_DRAFT',
    label: 'Send Draft',
    category: 'compose',
    priority: 2,
    writeOperation: true,
  },

  // Attachments & Contacts
  { name: 'GMAIL_GET_ATTACHMENT', label: 'Get Attachment', category: 'inbox', priority: 2 },
  { name: 'GMAIL_GET_CONTACTS', label: 'Get Contacts', category: 'contacts', priority: 2 },
  { name: 'GMAIL_SEARCH_PEOPLE', label: 'Search Contacts', category: 'contacts', priority: 2 },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GmailAction[] = [
  // Destructive organize operations
  {
    name: 'GMAIL_BATCH_DELETE_MESSAGES',
    label: 'Batch Delete Messages',
    category: 'organize',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GMAIL_DELETE_MESSAGE',
    label: 'Delete Message',
    category: 'organize',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GMAIL_DELETE_DRAFT',
    label: 'Delete Draft',
    category: 'organize',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GMAIL_DELETE_LABEL',
    label: 'Delete Label',
    category: 'organize',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GMAIL_PATCH_LABEL',
    label: 'Update Label',
    category: 'organize',
    priority: 3,
    writeOperation: true,
  },

  // Contacts - Extended
  { name: 'GMAIL_GET_PEOPLE', label: 'Get People Details', category: 'contacts', priority: 3 },

  // Settings
  { name: 'GMAIL_LIST_SEND_AS', label: 'List Send-As Aliases', category: 'settings', priority: 3 },
  {
    name: 'GMAIL_GET_AUTO_FORWARDING',
    label: 'Get Auto-Forwarding',
    category: 'settings',
    priority: 3,
  },
  {
    name: 'GMAIL_GET_VACATION_SETTINGS',
    label: 'Get Vacation Settings',
    category: 'settings',
    priority: 3,
  },
  {
    name: 'GMAIL_GET_LANGUAGE_SETTINGS',
    label: 'Get Language Settings',
    category: 'settings',
    priority: 3,
  },
  { name: 'GMAIL_LIST_FILTERS', label: 'List Filters', category: 'settings', priority: 3 },
  { name: 'GMAIL_LIST_HISTORY', label: 'List History', category: 'settings', priority: 3 },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Security & protocol settings)
// ============================================================================

const ADVANCED_ACTIONS: GmailAction[] = [
  // Security
  {
    name: 'GMAIL_LIST_CSE_IDENTITIES',
    label: 'List CSE Identities',
    category: 'security',
    priority: 4,
  },
  {
    name: 'GMAIL_LIST_CSE_KEYPAIRS',
    label: 'List CSE Key Pairs',
    category: 'security',
    priority: 4,
  },
  {
    name: 'GMAIL_LIST_SMIME_INFO',
    label: 'List S/MIME Configs',
    category: 'security',
    priority: 4,
  },

  // Protocol settings
  {
    name: 'GMAIL_SETTINGS_GET_IMAP',
    label: 'Get IMAP Settings',
    category: 'settings',
    priority: 4,
  },
  { name: 'GMAIL_SETTINGS_GET_POP', label: 'Get POP Settings', category: 'settings', priority: 4 },
  {
    name: 'GMAIL_SETTINGS_SEND_AS_GET',
    label: 'Get Send-As Details',
    category: 'settings',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GMAIL_ACTIONS: GmailAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGmailFeaturedActionNames(): string[] {
  return ALL_GMAIL_ACTIONS.map((a) => a.name);
}

export function getGmailActionsByPriority(maxPriority: number = 3): GmailAction[] {
  return ALL_GMAIL_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGmailActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGmailActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGmailActionsByCategory(category: GmailActionCategory): GmailAction[] {
  return ALL_GMAIL_ACTIONS.filter((a) => a.category === category);
}

export function getGmailActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GMAIL_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGmailAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GMAIL_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGmailAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GMAIL_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Gmail action priority.
 * Known Gmail actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGmailPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGmailActionPriority(a.name) - getGmailActionPriority(b.name);
  });
}

export function getGmailActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GMAIL_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GMAIL_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Gmail-specific system prompt when user has Gmail connected.
 * Tells Claude exactly what it can do via the Composio Gmail toolkit.
 */
export function getGmailSystemPrompt(): string {
  return `
## Gmail Integration (Full Capabilities)

You have **full Gmail access** through the user's connected account. Use the \`composio_GMAIL_*\` tools.

### Send & Compose
- Send emails with To/CC/BCC, HTML or plain text body, attachments
- Create, update, and send drafts
- Reply to email threads (preserves thread context)
- Forward messages to other recipients
- Send from verified aliases (send-as)

### Read & Search
- Fetch emails with powerful Gmail search queries (from:, to:, subject:, has:attachment, after:, before:, is:unread, etc.)
- Get full message details by message ID or thread ID
- List and browse email threads
- Download attachments from messages

### Organize & Manage
- Apply/remove labels (system labels: INBOX, STARRED, IMPORTANT, UNREAD, SPAM, TRASH, CATEGORY_*)
- Create custom labels with colors
- Move messages to trash
- Batch modify labels on up to 1,000 messages at once
- List and manage drafts

### Contacts
- Get contacts from Google Contacts
- Search contacts by name, email, phone number
- Access "Other Contacts" (people interacted with but not saved)

### Account Settings
- View profile info (email, message counts)
- Check vacation/out-of-office settings
- View auto-forwarding configuration
- List email filters/rules
- View send-as aliases and signatures

### Safety Rules
1. **ALWAYS show a preview before sending any email** using the action-preview format:
\`\`\`action-preview
{
  "platform": "Gmail",
  "action": "Send Email",
  "recipient": "user@example.com",
  "subject": "Subject line here",
  "content": "Email body preview...",
  "toolName": "composio_GMAIL_SEND_EMAIL",
  "toolParams": { "recipient_email": "...", "subject": "...", "body": "..." }
}
\`\`\`
2. **Never send emails without explicit user confirmation** - always wait for Send button click
3. **Show all recipients** (To, CC, BCC) in the preview before sending
4. **For replies**, show the thread context so the user knows what they're replying to
5. **For batch operations** (batch delete, batch modify), summarize what will happen and get explicit approval
6. **Never permanently delete messages** without clear confirmation - prefer trash over delete
7. **For forwarding**, show what's being forwarded and to whom
8. **Handle sensitive content carefully** - flag if email appears to contain passwords, financial data, or PII
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGmailCapabilitySummary(): string {
  const stats = getGmailActionStats();
  return `Gmail (${stats.total} actions: send, read, search, drafts, labels, contacts, settings)`;
}

export function logGmailToolkitStats(): void {
  const stats = getGmailActionStats();
  log.info('Gmail Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
