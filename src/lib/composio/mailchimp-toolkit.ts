/**
 * COMPOSIO MAILCHIMP TOOLKIT
 * ==========================
 *
 * Comprehensive Mailchimp integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Campaigns (create, send, list, get, update, delete)
 * - Audiences (create, list, get, update)
 * - Members (add, update, remove, list, search)
 * - Templates (list, get)
 * - Reports (get campaign, list)
 * - Tags (add, remove, list)
 */

import { logger } from '@/lib/logger';

const log = logger('MailchimpToolkit');

// ============================================================================
// MAILCHIMP ACTION CATEGORIES
// ============================================================================

export type MailchimpActionCategory =
  | 'campaigns'
  | 'audiences'
  | 'members'
  | 'templates'
  | 'reports'
  | 'tags';

export interface MailchimpAction {
  name: string;
  label: string;
  category: MailchimpActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL
// ============================================================================

const ESSENTIAL_ACTIONS: MailchimpAction[] = [
  {
    name: 'MAILCHIMP_LIST_CAMPAIGNS',
    label: 'List Campaigns',
    category: 'campaigns',
    priority: 1,
  },
  {
    name: 'MAILCHIMP_GET_CAMPAIGN',
    label: 'Get Campaign',
    category: 'campaigns',
    priority: 1,
  },
  {
    name: 'MAILCHIMP_CREATE_CAMPAIGN',
    label: 'Create Campaign',
    category: 'campaigns',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'MAILCHIMP_LIST_AUDIENCES',
    label: 'List Audiences',
    category: 'audiences',
    priority: 1,
  },
  {
    name: 'MAILCHIMP_LIST_MEMBERS',
    label: 'List Members',
    category: 'members',
    priority: 1,
  },
  {
    name: 'MAILCHIMP_ADD_MEMBER',
    label: 'Add Member',
    category: 'members',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'MAILCHIMP_SEARCH_MEMBERS',
    label: 'Search Members',
    category: 'members',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT
// ============================================================================

const IMPORTANT_ACTIONS: MailchimpAction[] = [
  {
    name: 'MAILCHIMP_SEND_CAMPAIGN',
    label: 'Send Campaign',
    category: 'campaigns',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'MAILCHIMP_UPDATE_CAMPAIGN',
    label: 'Update Campaign',
    category: 'campaigns',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'MAILCHIMP_GET_AUDIENCE',
    label: 'Get Audience',
    category: 'audiences',
    priority: 2,
  },
  {
    name: 'MAILCHIMP_UPDATE_MEMBER',
    label: 'Update Member',
    category: 'members',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'MAILCHIMP_GET_MEMBER',
    label: 'Get Member',
    category: 'members',
    priority: 2,
  },
  {
    name: 'MAILCHIMP_GET_CAMPAIGN_REPORT',
    label: 'Get Campaign Report',
    category: 'reports',
    priority: 2,
  },
  {
    name: 'MAILCHIMP_LIST_TEMPLATES',
    label: 'List Templates',
    category: 'templates',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL
// ============================================================================

const USEFUL_ACTIONS: MailchimpAction[] = [
  {
    name: 'MAILCHIMP_CREATE_AUDIENCE',
    label: 'Create Audience',
    category: 'audiences',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MAILCHIMP_UPDATE_AUDIENCE',
    label: 'Update Audience',
    category: 'audiences',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MAILCHIMP_GET_TEMPLATE',
    label: 'Get Template',
    category: 'templates',
    priority: 3,
  },
  {
    name: 'MAILCHIMP_ADD_TAG',
    label: 'Add Tag',
    category: 'tags',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MAILCHIMP_LIST_TAGS',
    label: 'List Tags',
    category: 'tags',
    priority: 3,
  },
  {
    name: 'MAILCHIMP_SCHEDULE_CAMPAIGN',
    label: 'Schedule Campaign',
    category: 'campaigns',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MAILCHIMP_LIST_REPORTS',
    label: 'List Reports',
    category: 'reports',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED
// ============================================================================

const ADVANCED_ACTIONS: MailchimpAction[] = [
  {
    name: 'MAILCHIMP_DELETE_CAMPAIGN',
    label: 'Delete Campaign',
    category: 'campaigns',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'MAILCHIMP_REMOVE_MEMBER',
    label: 'Remove Member',
    category: 'members',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'MAILCHIMP_REMOVE_TAG',
    label: 'Remove Tag',
    category: 'tags',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'MAILCHIMP_UNSCHEDULE_CAMPAIGN',
    label: 'Unschedule Campaign',
    category: 'campaigns',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'MAILCHIMP_REPLICATE_CAMPAIGN',
    label: 'Replicate Campaign',
    category: 'campaigns',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_MAILCHIMP_ACTIONS: MailchimpAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getMailchimpFeaturedActionNames(): string[] {
  return ALL_MAILCHIMP_ACTIONS.map((a) => a.name);
}

export function getMailchimpActionsByPriority(maxPriority: number = 3): MailchimpAction[] {
  return ALL_MAILCHIMP_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getMailchimpActionNamesByPriority(maxPriority: number = 3): string[] {
  return getMailchimpActionsByPriority(maxPriority).map((a) => a.name);
}

export function getMailchimpActionsByCategory(
  category: MailchimpActionCategory
): MailchimpAction[] {
  return ALL_MAILCHIMP_ACTIONS.filter((a) => a.category === category);
}

export function getMailchimpActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_MAILCHIMP_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownMailchimpAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_MAILCHIMP_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveMailchimpAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_MAILCHIMP_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

export function sortByMailchimpPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getMailchimpActionPriority(a.name) - getMailchimpActionPriority(b.name);
  });
}

export function getMailchimpActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_MAILCHIMP_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_MAILCHIMP_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export function getMailchimpSystemPrompt(): string {
  return `
## Mailchimp Integration (Full Capabilities)

You have **full Mailchimp access** through the user's connected account. Use the \`composio_MAILCHIMP_*\` tools.

### Campaigns
- Create email campaigns with subject, content, and audience targeting
- List and get campaign details and status
- Update campaign content, settings, and recipients
- Send campaigns immediately or schedule for later
- View campaign performance reports (opens, clicks, bounces)
- Replicate successful campaigns

### Audiences (Lists)
- List all audiences/lists in the account
- Get audience details including member counts
- Create and update audiences with merge fields and settings

### Members (Subscribers)
- Add new subscribers to audiences
- List and search members across audiences
- Update subscriber information and preferences
- Remove subscribers (unsubscribe or archive)

### Templates & Reports
- List available email templates
- Get template details and content
- View campaign reports with open/click metrics

### Tags & Segments
- Add and remove tags from subscribers
- List available tags for organization

### Safety Rules
1. **ALWAYS confirm before sending campaigns** - show audience, subject, and preview:
\`\`\`action-preview
{
  "platform": "Mailchimp",
  "action": "Send Campaign",
  "audience": "Audience name",
  "subject": "Email subject line",
  "recipientCount": "Number of recipients",
  "toolName": "composio_MAILCHIMP_SEND_CAMPAIGN",
  "toolParams": { "campaign_id": "..." }
}
\`\`\`
2. **Campaign sends are irreversible** - once sent, the email goes to all recipients
3. **Confirm before removing subscribers** - they will stop receiving emails
4. **Confirm before deleting campaigns** - deletion is permanent
5. **For scheduled sends**, clearly show the scheduled date and timezone
6. **Show subscriber counts** before any bulk operations
`;
}

export function getMailchimpCapabilitySummary(): string {
  const stats = getMailchimpActionStats();
  return `Mailchimp (${stats.total} actions: campaigns, audiences, members, templates, reports, tags)`;
}

export function logMailchimpToolkitStats(): void {
  const stats = getMailchimpActionStats();
  log.info('Mailchimp Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
