/**
 * COMPOSIO OUTLOOK TOOLKIT
 * ========================
 *
 * Comprehensive Microsoft Outlook integration via Composio's 64 tools.
 * Provides categorized actions for email, calendar, contacts, and settings.
 *
 * Categories:
 * - Email (send, read, search, drafts, folders, attachments)
 * - Calendar (events, scheduling, reminders, availability)
 * - Contacts (create, update, list, organize)
 * - Settings (mailbox settings, rules, categories)
 */

import { logger } from '@/lib/logger';

const log = logger('OutlookToolkit');

// ============================================================================
// OUTLOOK ACTION CATEGORIES
// ============================================================================

export type OutlookActionCategory = 'email' | 'calendar' | 'contacts' | 'settings';

export interface OutlookAction {
  name: string;
  label: string;
  category: OutlookActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Outlook connected)
// ============================================================================

const ESSENTIAL_ACTIONS: OutlookAction[] = [
  // Email - Core
  {
    name: 'OUTLOOK_SEND_EMAIL',
    label: 'Send Email',
    category: 'email',
    priority: 1,
    writeOperation: true,
  },
  { name: 'OUTLOOK_LIST_MESSAGES', label: 'List Messages', category: 'email', priority: 1 },
  { name: 'OUTLOOK_GET_MESSAGE', label: 'Get Message', category: 'email', priority: 1 },
  {
    name: 'OUTLOOK_REPLY_EMAIL',
    label: 'Reply to Email',
    category: 'email',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_FORWARD_MESSAGE',
    label: 'Forward Message',
    category: 'email',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_CREATE_DRAFT',
    label: 'Create Draft',
    category: 'email',
    priority: 1,
    writeOperation: true,
  },
  { name: 'OUTLOOK_QUERY_EMAILS', label: 'Query Emails', category: 'email', priority: 1 },
  { name: 'OUTLOOK_SEARCH_MESSAGES', label: 'Search Messages', category: 'email', priority: 1 },

  // Calendar - Core
  {
    name: 'OUTLOOK_CALENDAR_CREATE_EVENT',
    label: 'Create Calendar Event',
    category: 'calendar',
    priority: 1,
    writeOperation: true,
  },
  { name: 'OUTLOOK_LIST_EVENTS', label: 'List Events', category: 'calendar', priority: 1 },
  { name: 'OUTLOOK_GET_EVENT', label: 'Get Event Details', category: 'calendar', priority: 1 },
  {
    name: 'OUTLOOK_GET_CALENDAR_VIEW',
    label: 'Get Calendar View',
    category: 'calendar',
    priority: 1,
  },

  // Profile
  { name: 'OUTLOOK_GET_PROFILE', label: 'Get Profile', category: 'settings', priority: 1 },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: OutlookAction[] = [
  // Email - Extended
  {
    name: 'OUTLOOK_SEND_DRAFT',
    label: 'Send Draft',
    category: 'email',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_CREATE_DRAFT_REPLY',
    label: 'Create Draft Reply',
    category: 'email',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_UPDATE_MESSAGE',
    label: 'Update Message',
    category: 'email',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_MOVE_MESSAGE',
    label: 'Move Message',
    category: 'email',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_ADD_MAIL_ATTACHMENT',
    label: 'Add Attachment',
    category: 'email',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_LIST_OUTLOOK_ATTACHMENTS',
    label: 'List Attachments',
    category: 'email',
    priority: 2,
  },
  {
    name: 'OUTLOOK_DOWNLOAD_OUTLOOK_ATTACHMENT',
    label: 'Download Attachment',
    category: 'email',
    priority: 2,
  },
  { name: 'OUTLOOK_LIST_MAIL_FOLDERS', label: 'List Folders', category: 'email', priority: 2 },
  {
    name: 'OUTLOOK_LIST_MAIL_FOLDER_MESSAGES',
    label: 'List Folder Messages',
    category: 'email',
    priority: 2,
  },
  {
    name: 'OUTLOOK_BATCH_MOVE_MESSAGES',
    label: 'Batch Move Messages',
    category: 'email',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_BATCH_UPDATE_MESSAGES',
    label: 'Batch Update Messages',
    category: 'email',
    priority: 2,
    writeOperation: true,
  },

  // Calendar - Extended
  {
    name: 'OUTLOOK_UPDATE_CALENDAR_EVENT',
    label: 'Update Event',
    category: 'calendar',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_DECLINE_EVENT',
    label: 'Decline Event',
    category: 'calendar',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_FIND_MEETING_TIMES',
    label: 'Find Meeting Times',
    category: 'calendar',
    priority: 2,
  },
  { name: 'OUTLOOK_GET_SCHEDULE', label: 'Get Schedule', category: 'calendar', priority: 2 },
  { name: 'OUTLOOK_LIST_CALENDARS', label: 'List Calendars', category: 'calendar', priority: 2 },
  { name: 'OUTLOOK_LIST_REMINDERS', label: 'List Reminders', category: 'calendar', priority: 2 },

  // Contacts - Core
  {
    name: 'OUTLOOK_LIST_CONTACTS',
    label: 'List Contacts',
    category: 'contacts',
    priority: 2,
  },
  { name: 'OUTLOOK_GET_CONTACT', label: 'Get Contact', category: 'contacts', priority: 2 },
  {
    name: 'OUTLOOK_CREATE_CONTACT',
    label: 'Create Contact',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: OutlookAction[] = [
  // Email - Management
  {
    name: 'OUTLOOK_CREATE_MAIL_FOLDER',
    label: 'Create Mail Folder',
    category: 'email',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_UPDATE_MAIL_FOLDER',
    label: 'Update Mail Folder',
    category: 'email',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_LIST_CHILD_MAIL_FOLDERS',
    label: 'List Child Folders',
    category: 'email',
    priority: 3,
  },
  {
    name: 'OUTLOOK_CREATE_EMAIL_RULE',
    label: 'Create Email Rule',
    category: 'email',
    priority: 3,
    writeOperation: true,
  },
  { name: 'OUTLOOK_LIST_EMAIL_RULES', label: 'List Email Rules', category: 'email', priority: 3 },
  { name: 'OUTLOOK_GET_MAIL_DELTA', label: 'Get Mail Changes', category: 'email', priority: 3 },
  { name: 'OUTLOOK_GET_MAIL_TIPS', label: 'Get Mail Tips', category: 'email', priority: 3 },
  {
    name: 'OUTLOOK_CREATE_ATTACHMENT_UPLOAD_SESSION',
    label: 'Upload Large Attachment',
    category: 'email',
    priority: 3,
    writeOperation: true,
  },

  // Calendar - Extended
  {
    name: 'OUTLOOK_CREATE_CALENDAR',
    label: 'Create Calendar',
    category: 'calendar',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_UPDATE_EVENT_RECURRENCE',
    label: 'Update Recurrence',
    category: 'calendar',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_ADD_EVENT_ATTACHMENT',
    label: 'Add Event Attachment',
    category: 'calendar',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_LIST_EVENT_ATTACHMENTS',
    label: 'List Event Attachments',
    category: 'calendar',
    priority: 3,
  },

  // Contacts - Extended
  {
    name: 'OUTLOOK_UPDATE_CONTACT',
    label: 'Update Contact',
    category: 'contacts',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_CREATE_CONTACT_FOLDER',
    label: 'Create Contact Folder',
    category: 'contacts',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'OUTLOOK_GET_CONTACT_FOLDERS',
    label: 'Get Contact Folders',
    category: 'contacts',
    priority: 3,
  },

  // Settings
  {
    name: 'OUTLOOK_GET_MAILBOX_SETTINGS',
    label: 'Get Mailbox Settings',
    category: 'settings',
    priority: 3,
  },
  {
    name: 'OUTLOOK_GET_MASTER_CATEGORIES',
    label: 'Get Categories',
    category: 'settings',
    priority: 3,
  },
  {
    name: 'OUTLOOK_CREATE_MASTER_CATEGORY',
    label: 'Create Category',
    category: 'settings',
    priority: 3,
    writeOperation: true,
  },

  // Teams Chat (if available)
  { name: 'OUTLOOK_LIST_CHATS', label: 'List Teams Chats', category: 'settings', priority: 3 },
  {
    name: 'OUTLOOK_LIST_CHAT_MESSAGES',
    label: 'List Chat Messages',
    category: 'settings',
    priority: 3,
  },
  {
    name: 'OUTLOOK_PIN_MESSAGE',
    label: 'Pin Chat Message',
    category: 'settings',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Admin and destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: OutlookAction[] = [
  // Destructive
  {
    name: 'OUTLOOK_DELETE_MESSAGE',
    label: 'Delete Message',
    category: 'email',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'OUTLOOK_PERMANENT_DELETE_MESSAGE',
    label: 'Permanently Delete Message',
    category: 'email',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'OUTLOOK_DELETE_MAIL_FOLDER',
    label: 'Delete Mail Folder',
    category: 'email',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'OUTLOOK_DELETE_EMAIL_RULE',
    label: 'Delete Email Rule',
    category: 'email',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'OUTLOOK_DELETE_EVENT',
    label: 'Delete Event',
    category: 'calendar',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'OUTLOOK_DELETE_CONTACT',
    label: 'Delete Contact',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'OUTLOOK_DELETE_MASTER_CATEGORY',
    label: 'Delete Category',
    category: 'settings',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Admin
  { name: 'OUTLOOK_LIST_USERS', label: 'List Directory Users', category: 'settings', priority: 4 },
  {
    name: 'OUTLOOK_GET_SUPPORTED_LANGUAGES',
    label: 'Get Languages',
    category: 'settings',
    priority: 4,
  },
  {
    name: 'OUTLOOK_GET_SUPPORTED_TIME_ZONES',
    label: 'Get Time Zones',
    category: 'settings',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_OUTLOOK_ACTIONS: OutlookAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getOutlookFeaturedActionNames(): string[] {
  return ALL_OUTLOOK_ACTIONS.map((a) => a.name);
}

export function getOutlookActionsByPriority(maxPriority: number = 3): OutlookAction[] {
  return ALL_OUTLOOK_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getOutlookActionNamesByPriority(maxPriority: number = 3): string[] {
  return getOutlookActionsByPriority(maxPriority).map((a) => a.name);
}

export function getOutlookActionsByCategory(category: OutlookActionCategory): OutlookAction[] {
  return ALL_OUTLOOK_ACTIONS.filter((a) => a.category === category);
}

export function getOutlookActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_OUTLOOK_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownOutlookAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_OUTLOOK_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveOutlookAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_OUTLOOK_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

export function sortByOutlookPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getOutlookActionPriority(a.name) - getOutlookActionPriority(b.name);
  });
}

export function getOutlookActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_OUTLOOK_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_OUTLOOK_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export function getOutlookSystemPrompt(): string {
  return `
## Outlook Integration (Full Capabilities)

You have **full Microsoft Outlook access** through the user's connected account. Use the \`composio_OUTLOOK_*\` tools.

### Email
- Send, reply, forward emails with attachments
- Create and send drafts
- Search and query emails with advanced filters
- Move, organize, and batch-update messages
- Manage mail folders and email rules

### Calendar
- Create, update, and manage calendar events
- Find optimal meeting times based on availability
- Check schedules and free/busy status
- Manage recurring events and reminders
- Decline meeting invitations

### Contacts
- Create, update, and list contacts
- Organize contacts into folders

### Teams Chat (if available)
- List and read Teams chat messages
- Pin important messages

### Safety Rules
1. **ALWAYS show a preview before sending any email** using the action-preview format
2. **Never send emails without explicit user confirmation**
3. **Show all recipients** (To, CC, BCC) in the preview before sending
4. **For calendar events**, confirm date/time/attendees before creating
5. **For bulk operations**, summarize and get explicit approval
6. **Never permanently delete** without clear confirmation - prefer move over delete
`;
}

export function getOutlookCapabilitySummary(): string {
  const stats = getOutlookActionStats();
  return `Outlook (${stats.total} actions: email, calendar, contacts, Teams chat, rules)`;
}

export function logOutlookToolkitStats(): void {
  const stats = getOutlookActionStats();
  log.info('Outlook Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
