/**
 * COMPOSIO MICROSOFT TEAMS TOOLKIT
 * =================================
 *
 * Comprehensive Microsoft Teams integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Messaging (send, reply, update, delete messages, chats)
 * - Channels (create, list, update, delete channels)
 * - Teams (create, list, update, archive, delete teams)
 * - Meetings (create, list, update, cancel meetings)
 * - Users (list, add, remove members)
 * - Files (upload, list, get, delete files)
 * - Apps (install, list, remove apps)
 */

import { logger } from '@/lib/logger';

const log = logger('MicrosoftTeamsToolkit');

// ============================================================================
// MICROSOFT TEAMS ACTION CATEGORIES
// ============================================================================

export type MicrosoftTeamsActionCategory =
  | 'messaging'
  | 'channels'
  | 'teams'
  | 'meetings'
  | 'users'
  | 'files'
  | 'apps';

export interface MicrosoftTeamsAction {
  name: string; // Composio action name (e.g., MICROSOFTTEAMS_SEND_MESSAGE)
  label: string; // Human-readable label
  category: MicrosoftTeamsActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Microsoft Teams connected)
// ============================================================================

const ESSENTIAL_ACTIONS: MicrosoftTeamsAction[] = [
  // Messaging
  {
    name: 'MICROSOFTTEAMS_SEND_MESSAGE',
    label: 'Send Message',
    category: 'messaging',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'MICROSOFTTEAMS_SEND_REPLY',
    label: 'Send Reply',
    category: 'messaging',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'MICROSOFTTEAMS_LIST_MESSAGES',
    label: 'List Messages',
    category: 'messaging',
    priority: 1,
  },

  // Channels
  {
    name: 'MICROSOFTTEAMS_LIST_CHANNELS',
    label: 'List Channels',
    category: 'channels',
    priority: 1,
  },
  {
    name: 'MICROSOFTTEAMS_GET_CHANNEL',
    label: 'Get Channel',
    category: 'channels',
    priority: 1,
  },
  {
    name: 'MICROSOFTTEAMS_CREATE_CHANNEL',
    label: 'Create Channel',
    category: 'channels',
    priority: 1,
    writeOperation: true,
  },

  // Teams
  {
    name: 'MICROSOFTTEAMS_LIST_TEAMS',
    label: 'List Teams',
    category: 'teams',
    priority: 1,
  },
  {
    name: 'MICROSOFTTEAMS_GET_TEAM',
    label: 'Get Team',
    category: 'teams',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: MicrosoftTeamsAction[] = [
  // Teams
  {
    name: 'MICROSOFTTEAMS_CREATE_TEAM',
    label: 'Create Team',
    category: 'teams',
    priority: 2,
    writeOperation: true,
  },

  // Channels
  {
    name: 'MICROSOFTTEAMS_UPDATE_CHANNEL',
    label: 'Update Channel',
    category: 'channels',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'MICROSOFTTEAMS_DELETE_CHANNEL',
    label: 'Delete Channel',
    category: 'channels',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },

  // Users
  {
    name: 'MICROSOFTTEAMS_LIST_MEMBERS',
    label: 'List Members',
    category: 'users',
    priority: 2,
  },
  {
    name: 'MICROSOFTTEAMS_ADD_MEMBER',
    label: 'Add Member',
    category: 'users',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'MICROSOFTTEAMS_REMOVE_MEMBER',
    label: 'Remove Member',
    category: 'users',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },

  // Meetings
  {
    name: 'MICROSOFTTEAMS_CREATE_MEETING',
    label: 'Create Meeting',
    category: 'meetings',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'MICROSOFTTEAMS_GET_MEETING',
    label: 'Get Meeting',
    category: 'meetings',
    priority: 2,
  },
  {
    name: 'MICROSOFTTEAMS_LIST_MEETINGS',
    label: 'List Meetings',
    category: 'meetings',
    priority: 2,
  },

  // Messaging - Extended
  {
    name: 'MICROSOFTTEAMS_UPDATE_MESSAGE',
    label: 'Update Message',
    category: 'messaging',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'MICROSOFTTEAMS_DELETE_MESSAGE',
    label: 'Delete Message',
    category: 'messaging',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'MICROSOFTTEAMS_GET_MESSAGE',
    label: 'Get Message',
    category: 'messaging',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: MicrosoftTeamsAction[] = [
  // Teams - Extended
  {
    name: 'MICROSOFTTEAMS_UPDATE_TEAM',
    label: 'Update Team',
    category: 'teams',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MICROSOFTTEAMS_ARCHIVE_TEAM',
    label: 'Archive Team',
    category: 'teams',
    priority: 3,
    writeOperation: true,
  },

  // Messaging - Extended
  {
    name: 'MICROSOFTTEAMS_LIST_CHANNEL_MESSAGES',
    label: 'List Channel Messages',
    category: 'messaging',
    priority: 3,
  },
  {
    name: 'MICROSOFTTEAMS_CREATE_CHAT',
    label: 'Create Chat',
    category: 'messaging',
    priority: 3,
    writeOperation: true,
  },

  // Files
  {
    name: 'MICROSOFTTEAMS_UPLOAD_FILE',
    label: 'Upload File',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MICROSOFTTEAMS_LIST_FILES',
    label: 'List Files',
    category: 'files',
    priority: 3,
  },
  {
    name: 'MICROSOFTTEAMS_GET_FILE',
    label: 'Get File',
    category: 'files',
    priority: 3,
  },

  // Apps
  {
    name: 'MICROSOFTTEAMS_INSTALL_APP',
    label: 'Install App',
    category: 'apps',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MICROSOFTTEAMS_LIST_APPS',
    label: 'List Apps',
    category: 'apps',
    priority: 3,
  },

  // Meetings - Extended
  {
    name: 'MICROSOFTTEAMS_UPDATE_MEETING',
    label: 'Update Meeting',
    category: 'meetings',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MICROSOFTTEAMS_CANCEL_MEETING',
    label: 'Cancel Meeting',
    category: 'meetings',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Users - Extended
  {
    name: 'MICROSOFTTEAMS_LIST_CHANNEL_MEMBERS',
    label: 'List Channel Members',
    category: 'users',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: MicrosoftTeamsAction[] = [
  {
    name: 'MICROSOFTTEAMS_DELETE_TEAM',
    label: 'Delete Team',
    category: 'teams',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'MICROSOFTTEAMS_UNARCHIVE_TEAM',
    label: 'Unarchive Team',
    category: 'teams',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'MICROSOFTTEAMS_DELETE_FILE',
    label: 'Delete File',
    category: 'files',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'MICROSOFTTEAMS_REMOVE_APP',
    label: 'Remove App',
    category: 'apps',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'MICROSOFTTEAMS_LIST_CHATS',
    label: 'List Chats',
    category: 'messaging',
    priority: 4,
  },
  {
    name: 'MICROSOFTTEAMS_GET_CHAT',
    label: 'Get Chat',
    category: 'messaging',
    priority: 4,
  },
  {
    name: 'MICROSOFTTEAMS_LIST_CHAT_MEMBERS',
    label: 'List Chat Members',
    category: 'users',
    priority: 4,
  },
  {
    name: 'MICROSOFTTEAMS_ADD_CHAT_MEMBER',
    label: 'Add Chat Member',
    category: 'users',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_MICROSOFT_TEAMS_ACTIONS: MicrosoftTeamsAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getMicrosoftTeamsFeaturedActionNames(): string[] {
  return ALL_MICROSOFT_TEAMS_ACTIONS.map((a) => a.name);
}

export function getMicrosoftTeamsActionsByPriority(
  maxPriority: number = 3
): MicrosoftTeamsAction[] {
  return ALL_MICROSOFT_TEAMS_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getMicrosoftTeamsActionNamesByPriority(maxPriority: number = 3): string[] {
  return getMicrosoftTeamsActionsByPriority(maxPriority).map((a) => a.name);
}

export function getMicrosoftTeamsActionsByCategory(
  category: MicrosoftTeamsActionCategory
): MicrosoftTeamsAction[] {
  return ALL_MICROSOFT_TEAMS_ACTIONS.filter((a) => a.category === category);
}

export function getMicrosoftTeamsActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_MICROSOFT_TEAMS_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownMicrosoftTeamsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_MICROSOFT_TEAMS_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveMicrosoftTeamsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_MICROSOFT_TEAMS_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Microsoft Teams action priority.
 * Known Microsoft Teams actions sorted by priority (1-4), unknown actions last.
 */
export function sortByMicrosoftTeamsPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getMicrosoftTeamsActionPriority(a.name) - getMicrosoftTeamsActionPriority(b.name);
  });
}

export function getMicrosoftTeamsActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_MICROSOFT_TEAMS_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_MICROSOFT_TEAMS_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Microsoft Teams-specific system prompt when user has Teams connected.
 * Tells Claude exactly what it can do via the Composio Microsoft Teams toolkit.
 */
export function getMicrosoftTeamsSystemPrompt(): string {
  return `
## Microsoft Teams Integration (Full Capabilities)

You have **full Microsoft Teams access** through the user's connected account. Use the \`composio_MICROSOFTTEAMS_*\` tools.

### Messaging
- Send messages to channels and chats
- Reply to existing message threads
- List, get, update, and delete messages
- List channel messages for conversation history
- Create new chats (1:1 or group) and list existing chats

### Channels
- List all channels in a team
- Get detailed channel information
- Create new channels for team collaboration
- Update channel name, description, and settings
- Delete channels that are no longer needed

### Teams
- List all teams the user belongs to
- Get detailed team information and settings
- Create new teams for projects or departments
- Update team name, description, and settings
- Archive teams to preserve history while hiding from active view
- Unarchive teams to restore them to active use

### Meetings
- Create online meetings with specified attendees and schedule
- List upcoming and past meetings
- Get detailed meeting information (join URL, attendees, time)
- Update meeting details (time, subject, attendees)
- Cancel meetings that are no longer needed

### Users & Members
- List members of a team or channel
- Add new members to teams
- Remove members from teams
- List and add members in chat conversations

### Files
- Upload files to team channels for sharing
- List files shared in a channel
- Get file details and download links
- Delete files that are no longer needed

### Apps
- Install apps to teams for extended functionality
- List installed apps in a team
- Remove apps that are no longer needed

### Safety Rules
1. **ALWAYS confirm before sending messages** - show the channel/chat, recipient, and message content:
\`\`\`action-preview
{
  "platform": "Microsoft Teams",
  "action": "Send Message",
  "channel": "Channel/Chat name",
  "message": "Message preview...",
  "toolName": "composio_MICROSOFTTEAMS_SEND_MESSAGE",
  "toolParams": { "channel": "...", "message": "..." }
}
\`\`\`
2. **Confirm before creating teams or channels** - show the name, description, and membership details
3. **Never delete teams, channels, or messages without explicit approval** - deletion is permanent
4. **Confirm before removing members** - show the member name and the team/channel they will be removed from
5. **For meetings**, clearly show the subject, time, duration, and attendees before creating
6. **Confirm before archiving teams** - archiving makes the team read-only for all members
7. **Handle file operations carefully** - confirm before uploading or deleting files
8. **For batch operations**, summarize what will happen and get explicit approval
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getMicrosoftTeamsCapabilitySummary(): string {
  const stats = getMicrosoftTeamsActionStats();
  return `Microsoft Teams (${stats.total} actions: messaging, channels, teams, meetings, users, files, apps)`;
}

export function logMicrosoftTeamsToolkitStats(): void {
  const stats = getMicrosoftTeamsActionStats();
  log.info('Microsoft Teams Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
