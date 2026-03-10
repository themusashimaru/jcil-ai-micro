/**
 * COMPOSIO SENDGRID TOOLKIT
 * =========================
 *
 * Comprehensive SendGrid integration via Composio's tools.
 *
 * Categories:
 * - Mail (send, send template)
 * - Contacts (add, list, search, delete)
 * - Lists (create, list, get, delete)
 * - Templates (list, get, create)
 * - Stats (get global, get category)
 * - Senders (list, get, verify)
 */

import { logger } from '@/lib/logger';

const log = logger('SendGridToolkit');

export type SendGridActionCategory =
  | 'mail'
  | 'contacts'
  | 'lists'
  | 'templates'
  | 'stats'
  | 'senders';

export interface SendGridAction {
  name: string;
  label: string;
  category: SendGridActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: SendGridAction[] = [
  {
    name: 'SENDGRID_SEND_EMAIL',
    label: 'Send Email',
    category: 'mail',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SENDGRID_SEND_TEMPLATE_EMAIL',
    label: 'Send Template Email',
    category: 'mail',
    priority: 1,
    writeOperation: true,
  },
  { name: 'SENDGRID_LIST_CONTACTS', label: 'List Contacts', category: 'contacts', priority: 1 },
  {
    name: 'SENDGRID_ADD_CONTACTS',
    label: 'Add Contacts',
    category: 'contacts',
    priority: 1,
    writeOperation: true,
  },
  { name: 'SENDGRID_LIST_TEMPLATES', label: 'List Templates', category: 'templates', priority: 1 },
];

const IMPORTANT_ACTIONS: SendGridAction[] = [
  { name: 'SENDGRID_SEARCH_CONTACTS', label: 'Search Contacts', category: 'contacts', priority: 2 },
  { name: 'SENDGRID_GET_TEMPLATE', label: 'Get Template', category: 'templates', priority: 2 },
  { name: 'SENDGRID_LIST_LISTS', label: 'List Contact Lists', category: 'lists', priority: 2 },
  { name: 'SENDGRID_GET_GLOBAL_STATS', label: 'Get Global Stats', category: 'stats', priority: 2 },
  { name: 'SENDGRID_LIST_SENDERS', label: 'List Senders', category: 'senders', priority: 2 },
];

const USEFUL_ACTIONS: SendGridAction[] = [
  {
    name: 'SENDGRID_CREATE_LIST',
    label: 'Create Contact List',
    category: 'lists',
    priority: 3,
    writeOperation: true,
  },
  { name: 'SENDGRID_GET_LIST', label: 'Get Contact List', category: 'lists', priority: 3 },
  {
    name: 'SENDGRID_CREATE_TEMPLATE',
    label: 'Create Template',
    category: 'templates',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SENDGRID_GET_CATEGORY_STATS',
    label: 'Get Category Stats',
    category: 'stats',
    priority: 3,
  },
  { name: 'SENDGRID_GET_SENDER', label: 'Get Sender', category: 'senders', priority: 3 },
  {
    name: 'SENDGRID_VERIFY_SENDER',
    label: 'Verify Sender',
    category: 'senders',
    priority: 3,
    writeOperation: true,
  },
];

const ADVANCED_ACTIONS: SendGridAction[] = [
  {
    name: 'SENDGRID_DELETE_CONTACTS',
    label: 'Delete Contacts',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SENDGRID_DELETE_LIST',
    label: 'Delete Contact List',
    category: 'lists',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SENDGRID_DELETE_TEMPLATE',
    label: 'Delete Template',
    category: 'templates',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  { name: 'SENDGRID_GET_BOUNCE_STATS', label: 'Get Bounce Stats', category: 'stats', priority: 4 },
];

export const ALL_SENDGRID_ACTIONS: SendGridAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getSendGridFeaturedActionNames(): string[] {
  return ALL_SENDGRID_ACTIONS.map((a) => a.name);
}
export function getSendGridActionsByPriority(maxPriority: number = 3): SendGridAction[] {
  return ALL_SENDGRID_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getSendGridActionNamesByPriority(maxPriority: number = 3): string[] {
  return getSendGridActionsByPriority(maxPriority).map((a) => a.name);
}
export function getSendGridActionsByCategory(category: SendGridActionCategory): SendGridAction[] {
  return ALL_SENDGRID_ACTIONS.filter((a) => a.category === category);
}
export function getSendGridActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_SENDGRID_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownSendGridAction(toolName: string): boolean {
  return ALL_SENDGRID_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveSendGridAction(toolName: string): boolean {
  return (
    ALL_SENDGRID_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortBySendGridPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getSendGridActionPriority(a.name) - getSendGridActionPriority(b.name)
  );
}

export function getSendGridActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_SENDGRID_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_SENDGRID_ACTIONS.length, byPriority, byCategory };
}

export function getSendGridSystemPrompt(): string {
  return `
## SendGrid Integration (Full Capabilities)

You have **full SendGrid access** through the user's connected account. Use the \`composio_SENDGRID_*\` tools.

### Email Sending
- Send transactional emails with custom content
- Send emails using pre-built templates with dynamic data
- Support for HTML and plain text content

### Contacts & Lists
- Add and manage contacts in the marketing database
- Search contacts by email or custom fields
- Create and manage contact lists for segmentation

### Templates
- List and browse available email templates
- Get template details including versions and content
- Create new templates

### Stats & Analytics
- View global email delivery stats (delivered, opened, clicked, bounced)
- Get category-specific stats for tracking campaigns

### Safety Rules
1. **ALWAYS confirm before sending emails** - show recipients, subject, and content preview
2. **Email sends are irreversible** - once sent, the email is delivered
3. **Confirm before deleting contacts or lists** - deletion is permanent
4. **For bulk contact operations**, show the count and get explicit approval
5. **Verify sender identity** before sending from new addresses
`;
}

export function getSendGridCapabilitySummary(): string {
  const stats = getSendGridActionStats();
  return `SendGrid (${stats.total} actions: mail, contacts, lists, templates, stats)`;
}

export function logSendGridToolkitStats(): void {
  const stats = getSendGridActionStats();
  log.info('SendGrid Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
