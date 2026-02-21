/**
 * COMPOSIO INTERCOM TOOLKIT
 * =========================
 *
 * Comprehensive Intercom integration via Composio's tools.
 *
 * Categories:
 * - Conversations (create, get, list, reply, close, open, assign)
 * - Contacts (create, get, list, search, update, delete)
 * - Companies (create, get, list, update)
 * - Articles (create, get, list, update)
 * - Tags (list, tag, untag)
 * - Admins (list, get)
 */

import { logger } from '@/lib/logger';

const log = logger('IntercomToolkit');

export type IntercomActionCategory =
  | 'conversations'
  | 'contacts'
  | 'companies'
  | 'articles'
  | 'tags'
  | 'admins';

export interface IntercomAction {
  name: string;
  label: string;
  category: IntercomActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: IntercomAction[] = [
  {
    name: 'INTERCOM_LIST_CONVERSATIONS',
    label: 'List Conversations',
    category: 'conversations',
    priority: 1,
  },
  {
    name: 'INTERCOM_GET_CONVERSATION',
    label: 'Get Conversation',
    category: 'conversations',
    priority: 1,
  },
  {
    name: 'INTERCOM_REPLY_CONVERSATION',
    label: 'Reply to Conversation',
    category: 'conversations',
    priority: 1,
    writeOperation: true,
  },
  { name: 'INTERCOM_SEARCH_CONTACTS', label: 'Search Contacts', category: 'contacts', priority: 1 },
  { name: 'INTERCOM_GET_CONTACT', label: 'Get Contact', category: 'contacts', priority: 1 },
  {
    name: 'INTERCOM_CREATE_CONTACT',
    label: 'Create Contact',
    category: 'contacts',
    priority: 1,
    writeOperation: true,
  },
];

const IMPORTANT_ACTIONS: IntercomAction[] = [
  {
    name: 'INTERCOM_CLOSE_CONVERSATION',
    label: 'Close Conversation',
    category: 'conversations',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'INTERCOM_ASSIGN_CONVERSATION',
    label: 'Assign Conversation',
    category: 'conversations',
    priority: 2,
    writeOperation: true,
  },
  { name: 'INTERCOM_LIST_CONTACTS', label: 'List Contacts', category: 'contacts', priority: 2 },
  {
    name: 'INTERCOM_UPDATE_CONTACT',
    label: 'Update Contact',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },
  { name: 'INTERCOM_LIST_COMPANIES', label: 'List Companies', category: 'companies', priority: 2 },
  { name: 'INTERCOM_GET_COMPANY', label: 'Get Company', category: 'companies', priority: 2 },
  { name: 'INTERCOM_LIST_TAGS', label: 'List Tags', category: 'tags', priority: 2 },
];

const USEFUL_ACTIONS: IntercomAction[] = [
  {
    name: 'INTERCOM_CREATE_CONVERSATION',
    label: 'Create Conversation',
    category: 'conversations',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'INTERCOM_OPEN_CONVERSATION',
    label: 'Open Conversation',
    category: 'conversations',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'INTERCOM_CREATE_COMPANY',
    label: 'Create Company',
    category: 'companies',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'INTERCOM_UPDATE_COMPANY',
    label: 'Update Company',
    category: 'companies',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'INTERCOM_TAG_CONTACT',
    label: 'Tag Contact',
    category: 'tags',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'INTERCOM_CREATE_ARTICLE',
    label: 'Create Article',
    category: 'articles',
    priority: 3,
    writeOperation: true,
  },
  { name: 'INTERCOM_LIST_ARTICLES', label: 'List Articles', category: 'articles', priority: 3 },
  { name: 'INTERCOM_LIST_ADMINS', label: 'List Admins', category: 'admins', priority: 3 },
];

const ADVANCED_ACTIONS: IntercomAction[] = [
  {
    name: 'INTERCOM_DELETE_CONTACT',
    label: 'Delete Contact',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'INTERCOM_UNTAG_CONTACT',
    label: 'Untag Contact',
    category: 'tags',
    priority: 4,
    writeOperation: true,
  },
  { name: 'INTERCOM_GET_ARTICLE', label: 'Get Article', category: 'articles', priority: 4 },
  {
    name: 'INTERCOM_UPDATE_ARTICLE',
    label: 'Update Article',
    category: 'articles',
    priority: 4,
    writeOperation: true,
  },
  { name: 'INTERCOM_GET_ADMIN', label: 'Get Admin', category: 'admins', priority: 4 },
];

export const ALL_INTERCOM_ACTIONS: IntercomAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getIntercomFeaturedActionNames(): string[] {
  return ALL_INTERCOM_ACTIONS.map((a) => a.name);
}
export function getIntercomActionsByPriority(maxPriority: number = 3): IntercomAction[] {
  return ALL_INTERCOM_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getIntercomActionNamesByPriority(maxPriority: number = 3): string[] {
  return getIntercomActionsByPriority(maxPriority).map((a) => a.name);
}
export function getIntercomActionsByCategory(category: IntercomActionCategory): IntercomAction[] {
  return ALL_INTERCOM_ACTIONS.filter((a) => a.category === category);
}
export function getIntercomActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_INTERCOM_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownIntercomAction(toolName: string): boolean {
  return ALL_INTERCOM_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveIntercomAction(toolName: string): boolean {
  return (
    ALL_INTERCOM_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortByIntercomPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getIntercomActionPriority(a.name) - getIntercomActionPriority(b.name)
  );
}

export function getIntercomActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_INTERCOM_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_INTERCOM_ACTIONS.length, byPriority, byCategory };
}

export function getIntercomSystemPrompt(): string {
  return `
## Intercom Integration (Full Capabilities)

You have **full Intercom access** through the user's connected account. Use the \`composio_INTERCOM_*\` tools.

### Conversations
- List and search conversations with status filters
- View full conversation threads and messages
- Reply to conversations (as admin)
- Close, reopen, and assign conversations
- Create new outbound conversations

### Contacts & Companies
- Search and list contacts (leads and users)
- Create and update contact profiles
- Manage company records and associations
- Tag and organize contacts

### Help Center Articles
- Create and manage help center articles
- List articles by collection or section

### Safety Rules
1. **ALWAYS confirm before replying to conversations** - show the customer, conversation context, and reply
2. **Confirm before closing conversations** - ensure the customer's issue is resolved
3. **Confirm before deleting contacts** - deletion is permanent
4. **For outbound messages**, show the recipient and message content before sending
`;
}

export function getIntercomCapabilitySummary(): string {
  const stats = getIntercomActionStats();
  return `Intercom (${stats.total} actions: conversations, contacts, companies, articles, tags)`;
}

export function logIntercomToolkitStats(): void {
  const stats = getIntercomActionStats();
  log.info('Intercom Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
