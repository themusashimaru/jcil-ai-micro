/**
 * COMPOSIO SLACK TOOLKIT
 * ======================
 *
 * Comprehensive Slack integration via Composio's 155 tools.
 * Provides categorized actions for messaging, channels, users, files, and admin.
 *
 * Categories:
 * - Messaging (send, reply, threads, reactions, scheduled messages)
 * - Channels (create, manage, archive, invite)
 * - Users (find, status, presence, user groups)
 * - Files (upload, share, download, canvases)
 * - Workflows (reminders, bookmarks, stars, pins)
 * - Admin (workspace, enterprise, audit, apps)
 */

import { logger } from '@/lib/logger';

const log = logger('SlackToolkit');

// ============================================================================
// SLACK ACTION CATEGORIES
// ============================================================================

export type SlackActionCategory =
  | 'messaging'
  | 'channels'
  | 'users'
  | 'files'
  | 'workflows'
  | 'admin';

export interface SlackAction {
  name: string;
  label: string;
  category: SlackActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Slack connected)
// ============================================================================

const ESSENTIAL_ACTIONS: SlackAction[] = [
  // Messaging - Core
  {
    name: 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL',
    label: 'Send Message',
    category: 'messaging',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SLACK_SEND_ME_A_DIRECT_MESSAGE_ON_SLACK',
    label: 'Send DM',
    category: 'messaging',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SLACK_FETCH_CONVERSATION_HISTORY',
    label: 'Get Channel History',
    category: 'messaging',
    priority: 1,
  },
  {
    name: 'SLACK_FETCH_MESSAGE_THREAD_FROM_A_CONVERSATION',
    label: 'Get Thread Replies',
    category: 'messaging',
    priority: 1,
  },
  {
    name: 'SLACK_ADD_REACTION_TO_AN_ITEM',
    label: 'Add Reaction',
    category: 'messaging',
    priority: 1,
    writeOperation: true,
  },

  // Channels - Core
  { name: 'SLACK_LIST_ALL_CHANNELS', label: 'List Channels', category: 'channels', priority: 1 },
  { name: 'SLACK_FIND_CHANNELS', label: 'Find Channels', category: 'channels', priority: 1 },
  {
    name: 'SLACK_CREATE_CHANNEL',
    label: 'Create Channel',
    category: 'channels',
    priority: 1,
    writeOperation: true,
  },

  // Users - Core
  { name: 'SLACK_LIST_ALL_USERS', label: 'List Users', category: 'users', priority: 1 },
  { name: 'SLACK_FIND_USERS', label: 'Find Users', category: 'users', priority: 1 },
  {
    name: 'SLACK_FIND_USER_BY_EMAIL_ADDRESS',
    label: 'Find User by Email',
    category: 'users',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: SlackAction[] = [
  // Messaging - Extended
  {
    name: 'SLACK_SEND_SLACK_MESSAGE_BLOCKS',
    label: 'Send Rich Message',
    category: 'messaging',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SLACK_UPDATES_A_MESSAGE_IN_A_SLACK_CHANNEL',
    label: 'Update Message',
    category: 'messaging',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SLACK_SCHEDULE_A_MESSAGE_IN_A_CHAT',
    label: 'Schedule Message',
    category: 'messaging',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SLACK_FETCH_ITEM_REACTIONS',
    label: 'Get Reactions',
    category: 'messaging',
    priority: 2,
  },
  {
    name: 'SLACK_REMOVE_REACTION_FROM_MESSAGE',
    label: 'Remove Reaction',
    category: 'messaging',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SLACK_LIST_SCHEDULED_MESSAGES',
    label: 'List Scheduled Messages',
    category: 'messaging',
    priority: 2,
  },

  // Channels - Extended
  {
    name: 'SLACK_LIST_CONVERSATIONS',
    label: 'List Conversations',
    category: 'channels',
    priority: 2,
  },
  {
    name: 'SLACK_INVITE_USERS_TO_A_SLACK_CHANNEL',
    label: 'Invite to Channel',
    category: 'channels',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SLACK_JOIN_AN_EXISTING_CONVERSATION',
    label: 'Join Channel',
    category: 'channels',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SLACK_SET_CHANNEL_TOPIC',
    label: 'Set Channel Topic',
    category: 'channels',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SLACK_SET_CHANNEL_PURPOSE',
    label: 'Set Channel Purpose',
    category: 'channels',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SLACK_GET_CHANNEL_CONVERSATION_PREFERENCES',
    label: 'Get Channel Preferences',
    category: 'channels',
    priority: 2,
  },

  // Users - Extended
  {
    name: 'SLACK_GET_USER_PRESENCE_INFO',
    label: 'Get User Presence',
    category: 'users',
    priority: 2,
  },
  {
    name: 'SLACK_SET_STATUS',
    label: 'Set Status',
    category: 'users',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SLACK_CLEAR_STATUS',
    label: 'Clear Status',
    category: 'users',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SLACK_LIST_USER_GROUPS_FOR_TEAM_WITH_OPTIONS',
    label: 'List User Groups',
    category: 'users',
    priority: 2,
  },
  {
    name: 'SLACK_LIST_ALL_USERS_IN_A_USER_GROUP',
    label: 'List Group Members',
    category: 'users',
    priority: 2,
  },

  // Files
  {
    name: 'SLACK_LIST_FILES_WITH_FILTERS_IN_SLACK',
    label: 'List Files',
    category: 'files',
    priority: 2,
  },
  {
    name: 'SLACK_DOWNLOAD_SLACK_FILE',
    label: 'Download File',
    category: 'files',
    priority: 2,
  },
  {
    name: 'SLACK_UPLOAD_FILE_TO_SLACK_V2',
    label: 'Upload File',
    category: 'files',
    priority: 2,
    writeOperation: true,
  },

  // Workflows
  {
    name: 'SLACK_CREATE_A_REMINDER',
    label: 'Create Reminder',
    category: 'workflows',
    priority: 2,
    writeOperation: true,
  },
  { name: 'SLACK_LIST_REMINDERS', label: 'List Reminders', category: 'workflows', priority: 2 },
  {
    name: 'SLACK_LISTS_PINNED_ITEMS_IN_A_CHANNEL',
    label: 'List Pinned Items',
    category: 'workflows',
    priority: 2,
  },
  {
    name: 'SLACK_PIN_A_MESSAGE_TO_A_CHANNEL',
    label: 'Pin Message',
    category: 'workflows',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: SlackAction[] = [
  // Messaging - Management
  {
    name: 'SLACK_DELETES_A_MESSAGE_FROM_A_CHAT',
    label: 'Delete Message',
    category: 'messaging',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SLACK_DELETE_A_SCHEDULED_MESSAGE_IN_A_CHAT',
    label: 'Delete Scheduled Message',
    category: 'messaging',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SLACK_CUSTOMIZ_URL_UNFURL',
    label: 'Customize URL Preview',
    category: 'messaging',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_LIST_USER_REACTIONS',
    label: 'List User Reactions',
    category: 'messaging',
    priority: 3,
  },

  // Channels - Management
  {
    name: 'SLACK_ARCHIVE_A_SLACK_CONVERSATION',
    label: 'Archive Channel',
    category: 'channels',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_UNARCHIVE_A_CONVERSATION',
    label: 'Unarchive Channel',
    category: 'channels',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_RENAME_A_CONVERSATION',
    label: 'Rename Channel',
    category: 'channels',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_CONVERT_PUBLIC_CHANNEL_TO_PRIVATE',
    label: 'Make Channel Private',
    category: 'channels',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_LEAVE_A_CONVERSATION',
    label: 'Leave Channel',
    category: 'channels',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_REMOVE_USER_FROM_CONVERSATION',
    label: 'Remove User from Channel',
    category: 'channels',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_CREATE_CHANNEL_BASED_CONVERSATION',
    label: 'Create Advanced Channel',
    category: 'channels',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_CLOSE_DM_OR_MULTI_PERSON_DM',
    label: 'Close DM',
    category: 'channels',
    priority: 3,
    writeOperation: true,
  },

  // Users - Management
  {
    name: 'SLACK_CREATE_A_SLACK_USER_GROUP',
    label: 'Create User Group',
    category: 'users',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_UPDATE_A_SLACK_USER_GROUP',
    label: 'Update User Group',
    category: 'users',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_DISABLE_AN_EXISTING_SLACK_USER_GROUP',
    label: 'Disable User Group',
    category: 'users',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_ENABLE_A_SPECIFIED_USER_GROUP',
    label: 'Enable User Group',
    category: 'users',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_SET_SNOOZE',
    label: 'Set Snooze',
    category: 'users',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_END_SNOOZE',
    label: 'End Snooze',
    category: 'users',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_END_USER_DO_NOT_DISTURB_SESSION',
    label: 'End DND',
    category: 'users',
    priority: 3,
    writeOperation: true,
  },

  // Files - Extended
  {
    name: 'SLACK_ENABLE_PUBLIC_SHARING_OF_A_FILE',
    label: 'Enable File Sharing',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_ADD_A_REMOTE_FILE_FROM_A_SERVICE',
    label: 'Add Remote File',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_LIST_REMOTE_FILES',
    label: 'List Remote Files',
    category: 'files',
    priority: 3,
  },
  {
    name: 'SLACK_GET_REMOTE_FILE',
    label: 'Get Remote File',
    category: 'files',
    priority: 3,
  },

  // Canvases
  {
    name: 'SLACK_CREATE_CANVAS',
    label: 'Create Canvas',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_GET_CANVAS',
    label: 'Get Canvas',
    category: 'files',
    priority: 3,
  },
  {
    name: 'SLACK_EDIT_CANVAS',
    label: 'Edit Canvas',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_LIST_CANVASES',
    label: 'List Canvases',
    category: 'files',
    priority: 3,
  },

  // Workflows - Extended
  {
    name: 'SLACK_GET_REMINDER_INFORMATION',
    label: 'Get Reminder Info',
    category: 'workflows',
    priority: 3,
  },
  {
    name: 'SLACK_DELETE_A_SLACK_REMINDER',
    label: 'Delete Reminder',
    category: 'workflows',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SLACK_UNPIN_A_MESSAGE_FROM_A_CHANNEL',
    label: 'Unpin Message',
    category: 'workflows',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_ADD_A_STAR_TO_AN_ITEM',
    label: 'Star Item',
    category: 'workflows',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SLACK_LIST_STARRED_ITEMS',
    label: 'List Starred Items',
    category: 'workflows',
    priority: 3,
  },
  {
    name: 'SLACK_REMOVE_A_STAR_FROM_AN_ITEM',
    label: 'Unstar Item',
    category: 'workflows',
    priority: 3,
    writeOperation: true,
  },

  // Team info
  { name: 'SLACK_FETCH_TEAM_INFO', label: 'Get Team Info', category: 'admin', priority: 3 },
  {
    name: 'SLACK_LIST_TEAM_CUSTOM_EMOJIS',
    label: 'List Custom Emojis',
    category: 'admin',
    priority: 3,
  },
  {
    name: 'SLACK_FETCH_WORKSPACE_SETTINGS_INFORMATION',
    label: 'Get Workspace Settings',
    category: 'admin',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Admin, enterprise, and destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: SlackAction[] = [
  // Destructive
  {
    name: 'SLACK_DELETE_A_PUBLIC_OR_PRIVATE_CHANNEL',
    label: 'Delete Channel',
    category: 'channels',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SLACK_DELETE_A_FILE_BY_ID',
    label: 'Delete File',
    category: 'files',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SLACK_DELETE_CANVAS',
    label: 'Delete Canvas',
    category: 'files',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SLACK_DELETE_A_COMMENT_ON_A_FILE',
    label: 'Delete File Comment',
    category: 'files',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SLACK_DELETE_USER_PROFILE_PHOTO',
    label: 'Delete Profile Photo',
    category: 'users',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Emoji management
  {
    name: 'SLACK_ADD_EMOJI',
    label: 'Add Custom Emoji',
    category: 'admin',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SLACK_ADD_AN_EMOJI_ALIAS_IN_SLACK',
    label: 'Add Emoji Alias',
    category: 'admin',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SLACK_LIST_ADMIN_EMOJI',
    label: 'List Admin Emoji',
    category: 'admin',
    priority: 4,
  },

  // Enterprise / Admin
  {
    name: 'SLACK_ADMIN_CONVERSATIONS_SEARCH',
    label: 'Admin Channel Search',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_ADMIN_APPS_APPROVED_LIST',
    label: 'List Approved Apps',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_ADMIN_APPS_REQUESTS_LIST',
    label: 'List App Requests',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_LIST_RESTRICTED_APPS_FOR_ORG_OR_WORKSPACE',
    label: 'List Restricted Apps',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_CREATE_ENTERPRISE_TEAM',
    label: 'Create Enterprise Team',
    category: 'admin',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SLACK_LIST_ENTERPRISE_TEAMS',
    label: 'List Enterprise Teams',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_ADD_ENTERPRISE_USER_TO_WORKSPACE',
    label: 'Add Enterprise User',
    category: 'admin',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SLACK_INVITE_USER_TO_WORKSPACE',
    label: 'Invite to Workspace',
    category: 'admin',
    priority: 4,
    writeOperation: true,
  },

  // Audit
  {
    name: 'SLACK_GET_AUDIT_ACTION_TYPES',
    label: 'Get Audit Actions',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_GET_AUDIT_SCHEMAS',
    label: 'Get Audit Schemas',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_GET_APP_PERMISSION_SCOPES',
    label: 'Get Permission Scopes',
    category: 'admin',
    priority: 4,
  },

  // Misc
  {
    name: 'SLACK_LIST_AUTH_TEAMS',
    label: 'List Auth Teams',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_API_TEST',
    label: 'API Test',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_FETCH_BOT_USER_INFORMATION',
    label: 'Get Bot Info',
    category: 'admin',
    priority: 4,
  },

  // Calls
  {
    name: 'SLACK_ADD_CALL_PARTICIPANTS',
    label: 'Add Call Participants',
    category: 'admin',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SLACK_END_A_CALL_WITH_DURATION_AND_ID',
    label: 'End Call',
    category: 'admin',
    priority: 4,
    writeOperation: true,
  },

  // Workspace invites
  {
    name: 'SLACK_LIST_APPROVED_WORKSPACE_INVITE_REQUESTS',
    label: 'List Approved Invites',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_LIST_DENIED_WORKSPACE_INVITE_REQUESTS',
    label: 'List Denied Invites',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_LIST_PENDING_WORKSPACE_INVITE_REQUESTS',
    label: 'List Pending Invites',
    category: 'admin',
    priority: 4,
  },

  // Channel connections
  {
    name: 'SLACK_GET_WORKSPACE_CONNECTIONS_FOR_CHANNEL',
    label: 'Get Channel Connections',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_LIST_IDP_GROUPS_LINKED_TO_CHANNEL',
    label: 'List IDP Groups',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'SLACK_INVITE_USER_TO_CHANNEL',
    label: 'Invite User (Enterprise)',
    category: 'admin',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SLACK_FETCH_DND_STATUS_FOR_MULTIPLE_TEAM_MEMBERS',
    label: 'Get Team DND Status',
    category: 'admin',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_SLACK_ACTIONS: SlackAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getSlackFeaturedActionNames(): string[] {
  return ALL_SLACK_ACTIONS.map((a) => a.name);
}

export function getSlackActionsByPriority(maxPriority: number = 3): SlackAction[] {
  return ALL_SLACK_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getSlackActionNamesByPriority(maxPriority: number = 3): string[] {
  return getSlackActionsByPriority(maxPriority).map((a) => a.name);
}

export function getSlackActionsByCategory(category: SlackActionCategory): SlackAction[] {
  return ALL_SLACK_ACTIONS.filter((a) => a.category === category);
}

export function getSlackActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_SLACK_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownSlackAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SLACK_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveSlackAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SLACK_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

export function sortBySlackPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getSlackActionPriority(a.name) - getSlackActionPriority(b.name);
  });
}

export function getSlackActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_SLACK_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_SLACK_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export function getSlackSystemPrompt(): string {
  return `
## Slack Integration (Full Capabilities)

You have **full Slack access** through the user's connected workspace. Use the \`composio_SLACK_*\` tools.

### Messaging
- Send messages to any channel or user (DM)
- Send rich messages with Block Kit formatting
- Reply in threads, update and delete messages
- Add/remove emoji reactions
- Schedule messages for later delivery
- Pin/unpin important messages

### Channels
- Create public/private channels
- List, find, and join channels
- Set channel topic and purpose
- Invite/remove users from channels
- Archive/unarchive channels

### Users & Groups
- Find users by name or email
- Check user presence and status
- Set/clear your Slack status
- Manage user groups (create, update, enable/disable)
- Control Do Not Disturb and snooze

### Files & Canvases
- Upload, download, and list files
- Share files publicly
- Create, edit, and manage Slack Canvases
- Manage remote files from external services

### Workflows & Organization
- Create and manage reminders
- Star/unstar items
- List and manage bookmarks
- View team info and custom emoji

### Safety Rules
1. **Always confirm before sending messages** to channels or users
2. **Show message preview** using the action-preview format before sending:
\`\`\`action-preview
{
  "platform": "Slack",
  "action": "Send Message",
  "content": "#channel-name: Your message here...",
  "toolName": "composio_SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
  "toolParams": { "channel": "C0123456", "text": "..." }
}
\`\`\`
3. **Never delete messages or channels** without explicit confirmation
4. **For bulk operations**, summarize and get approval
5. **Verify the channel** before sending - confirm channel name with user
6. **For DMs**, always confirm the recipient
`;
}

export function getSlackCapabilitySummary(): string {
  const stats = getSlackActionStats();
  return `Slack (${stats.total} actions: messages, channels, users, files, canvases, reminders)`;
}

export function logSlackToolkitStats(): void {
  const stats = getSlackActionStats();
  log.info('Slack Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
