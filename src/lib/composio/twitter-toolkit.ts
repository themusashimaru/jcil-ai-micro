/**
 * COMPOSIO TWITTER/X TOOLKIT
 * ===========================
 *
 * Comprehensive Twitter/X integration via Composio's 75 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Tweets (create, lookup, retweet, bookmark, likes, quotes)
 * - Search (recent search, full archive, counts)
 * - DMs (send, reply, conversations, events)
 * - Users (follow, unfollow, followers, mute, block)
 * - Lists (create, members, timelines, pin, follow)
 * - Spaces (search, lookup, tweets, ticket buyers)
 * - Admin (compliance, labels, API spec)
 */

import { logger } from '@/lib/logger';

const log = logger('TwitterToolkit');

// ============================================================================
// TWITTER ACTION CATEGORIES
// ============================================================================

export type TwitterActionCategory =
  | 'tweets'
  | 'search'
  | 'dms'
  | 'users'
  | 'lists'
  | 'spaces'
  | 'admin';

export interface TwitterAction {
  name: string; // Composio action name (e.g., TWITTER_CREATION_OF_A_POST)
  label: string; // Human-readable label
  category: TwitterActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Twitter connected)
// ============================================================================

const ESSENTIAL_ACTIONS: TwitterAction[] = [
  // Tweets - Core
  {
    name: 'TWITTER_CREATION_OF_A_POST',
    label: 'Create Tweet',
    category: 'tweets',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'TWITTER_POST_LOOKUP_BY_POST_ID',
    label: 'Get Tweet',
    category: 'tweets',
    priority: 1,
  },
  {
    name: 'TWITTER_POST_LOOKUP_BY_POST_IDS',
    label: 'Get Tweets Batch',
    category: 'tweets',
    priority: 1,
  },
  {
    name: 'TWITTER_RETWEET_POST',
    label: 'Retweet',
    category: 'tweets',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'TWITTER_ADD_POST_TO_BOOKMARKS',
    label: 'Bookmark Tweet',
    category: 'tweets',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'TWITTER_BOOKMARKS_BY_USER',
    label: 'Get Bookmarks',
    category: 'tweets',
    priority: 1,
  },

  // Search - Core
  {
    name: 'TWITTER_RECENT_SEARCH',
    label: 'Search Recent Tweets',
    category: 'search',
    priority: 1,
  },

  // DMs - Core
  {
    name: 'TWITTER_SEND_A_NEW_MESSAGE_TO_A_USER',
    label: 'Send DM',
    category: 'dms',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'TWITTER_SEND_A_NEW_MESSAGE_TO_A_DM_CONVERSATION',
    label: 'Reply in DM',
    category: 'dms',
    priority: 1,
    writeOperation: true,
  },

  // Users - Core
  {
    name: 'TWITTER_FOLLOW_USER',
    label: 'Follow User',
    category: 'users',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'TWITTER_UNFOLLOW_USER',
    label: 'Unfollow User',
    category: 'users',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'TWITTER_FOLLOWERS_BY_USER_ID',
    label: 'Get Followers',
    category: 'users',
    priority: 1,
  },
  {
    name: 'TWITTER_FOLLOWING_BY_USER_ID',
    label: 'Get Following',
    category: 'users',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: TwitterAction[] = [
  // Search - Extended
  {
    name: 'TWITTER_FULL_ARCHIVE_SEARCH',
    label: 'Full Archive Search',
    category: 'search',
    priority: 2,
  },
  {
    name: 'TWITTER_RECENT_SEARCH_COUNTS',
    label: 'Recent Search Counts',
    category: 'search',
    priority: 2,
  },
  {
    name: 'TWITTER_FULL_ARCHIVE_SEARCH_COUNTS',
    label: 'Full Archive Counts',
    category: 'search',
    priority: 2,
  },

  // Lists - Core
  {
    name: 'TWITTER_CREATE_LIST',
    label: 'Create List',
    category: 'lists',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TWITTER_ADD_A_LIST_MEMBER',
    label: 'Add List Member',
    category: 'lists',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TWITTER_REMOVE_A_LIST_MEMBER',
    label: 'Remove List Member',
    category: 'lists',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TWITTER_FETCH_LIST_MEMBERS_BY_ID',
    label: 'Get List Members',
    category: 'lists',
    priority: 2,
  },
  {
    name: 'TWITTER_LIST_LOOKUP_BY_LIST_ID',
    label: 'Get List',
    category: 'lists',
    priority: 2,
  },
  {
    name: 'TWITTER_LIST_POSTS_TIMELINE_BY_LIST_ID',
    label: 'Get List Timeline',
    category: 'lists',
    priority: 2,
  },
  {
    name: 'TWITTER_GET_A_USER_S_OWNED_LISTS',
    label: 'Get My Lists',
    category: 'lists',
    priority: 2,
  },
  {
    name: 'TWITTER_GET_A_USER_S_LIST_MEMBERSHIPS',
    label: 'Get List Memberships',
    category: 'lists',
    priority: 2,
  },

  // Tweets - Engagement
  {
    name: 'TWITTER_LIST_POST_LIKERS',
    label: 'Get Post Likers',
    category: 'tweets',
    priority: 2,
  },
  {
    name: 'TWITTER_GET_POST_RETWEETERS_ACTION',
    label: 'Get Retweeters',
    category: 'tweets',
    priority: 2,
  },
  {
    name: 'TWITTER_RETRIEVE_POSTS_THAT_QUOTE_A_POST',
    label: 'Get Quote Tweets',
    category: 'tweets',
    priority: 2,
  },
  {
    name: 'TWITTER_RETRIEVE_POSTS_THAT_REPOST_A_POST',
    label: 'Get Reposts',
    category: 'tweets',
    priority: 2,
  },

  // Users - Engagement
  {
    name: 'TWITTER_RETURNS_POST_OBJECTS_LIKED_BY_THE_PROVIDED_USER_ID',
    label: 'Get User Likes',
    category: 'users',
    priority: 2,
  },

  // DMs - Extended
  {
    name: 'TWITTER_GET_RECENT_DM_EVENTS',
    label: 'Get Recent DMs',
    category: 'dms',
    priority: 2,
  },
  {
    name: 'TWITTER_GET_DM_EVENTS_BY_ID',
    label: 'Get DM Event',
    category: 'dms',
    priority: 2,
  },
  {
    name: 'TWITTER_GET_DM_EVENTS_FOR_A_DM_CONVERSATION',
    label: 'Get DM Conversation',
    category: 'dms',
    priority: 2,
  },
  {
    name: 'TWITTER_CREATE_A_NEW_DM_CONVERSATION',
    label: 'Create DM Group',
    category: 'dms',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: TwitterAction[] = [
  // Tweets - Extended
  {
    name: 'TWITTER_UNRETWEET_POST',
    label: 'Unretweet',
    category: 'tweets',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TWITTER_UNLIKE_POST',
    label: 'Unlike',
    category: 'tweets',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TWITTER_REMOVE_A_BOOKMARKED_POST',
    label: 'Remove Bookmark',
    category: 'tweets',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TWITTER_HIDE_REPLIES',
    label: 'Hide Reply',
    category: 'tweets',
    priority: 3,
    writeOperation: true,
  },

  // Lists - Extended
  {
    name: 'TWITTER_FOLLOW_A_LIST',
    label: 'Follow List',
    category: 'lists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TWITTER_UNFOLLOW_A_LIST',
    label: 'Unfollow List',
    category: 'lists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TWITTER_PIN_A_LIST',
    label: 'Pin List',
    category: 'lists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TWITTER_UNPIN_A_LIST',
    label: 'Unpin List',
    category: 'lists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TWITTER_GET_A_USER_S_PINNED_LISTS',
    label: 'Get Pinned Lists',
    category: 'lists',
    priority: 3,
  },
  {
    name: 'TWITTER_GET_LIST_FOLLOWERS',
    label: 'Get List Followers',
    category: 'lists',
    priority: 3,
  },
  {
    name: 'TWITTER_GET_USER_S_FOLLOWED_LISTS',
    label: 'Get Followed Lists',
    category: 'lists',
    priority: 3,
  },

  // Users - Extended
  {
    name: 'TWITTER_GET_BLOCKED_USERS',
    label: 'Get Blocked Users',
    category: 'users',
    priority: 3,
  },
  {
    name: 'TWITTER_GET_MUTED_USERS',
    label: 'Get Muted Users',
    category: 'users',
    priority: 3,
  },
  {
    name: 'TWITTER_MUTE_USER_BY_USER_ID',
    label: 'Mute User',
    category: 'users',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TWITTER_UNMUTE_USER_BY_USER_ID',
    label: 'Unmute User',
    category: 'users',
    priority: 3,
    writeOperation: true,
  },

  // Spaces
  {
    name: 'TWITTER_SEARCH_FOR_SPACES',
    label: 'Search Spaces',
    category: 'spaces',
    priority: 3,
  },
  {
    name: 'TWITTER_SPACE_LOOKUP_BY_SPACE_ID',
    label: 'Get Space',
    category: 'spaces',
    priority: 3,
  },
  {
    name: 'TWITTER_SPACE_LOOKUP_BY_THEIR_CREATORS',
    label: 'Get Spaces by Creator',
    category: 'spaces',
    priority: 3,
  },
  {
    name: 'TWITTER_SPACE_LOOKUP_UP_SPACE_IDS',
    label: 'Get Spaces Batch',
    category: 'spaces',
    priority: 3,
  },
  {
    name: 'TWITTER_RETRIEVE_POSTS_FROM_A_SPACE',
    label: 'Get Space Tweets',
    category: 'spaces',
    priority: 3,
  },
  {
    name: 'TWITTER_FETCH_SPACE_TICKET_BUYERS_LIST',
    label: 'Get Space Ticket Buyers',
    category: 'spaces',
    priority: 3,
  },

  // DMs - Extended
  {
    name: 'TWITTER_RETRIEVE_DM_CONVERSATION_EVENTS',
    label: 'Get DM Events',
    category: 'dms',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & admin)
// ============================================================================

const ADVANCED_ACTIONS: TwitterAction[] = [
  // Destructive operations
  {
    name: 'TWITTER_POST_DELETE_BY_POST_ID',
    label: 'Delete Tweet',
    category: 'tweets',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TWITTER_DELETE_LIST',
    label: 'Delete List',
    category: 'lists',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TWITTER_DELETE_DM',
    label: 'Delete DM',
    category: 'dms',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Tweets - Advanced
  {
    name: 'TWITTER_GET_MEDIA_UPLOAD_STATUS',
    label: 'Get Media Status',
    category: 'tweets',
    priority: 4,
  },
  {
    name: 'TWITTER_POST_USAGE',
    label: 'Get Post Usage',
    category: 'tweets',
    priority: 4,
  },

  // Admin
  {
    name: 'TWITTER_CREATE_COMPLIANCE_JOB_REQUEST',
    label: 'Create Compliance Job',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'TWITTER_RETRIEVE_COMPLIANCE_JOB_BY_ID',
    label: 'Get Compliance Job',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'TWITTER_RETRIEVE_COMPLIANCE_JOBS',
    label: 'List Compliance Jobs',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'TWITTER_POSTS_LABEL_STREAM',
    label: 'Label Stream',
    category: 'admin',
    priority: 4,
  },
  {
    name: 'TWITTER_RETURNS_THE_OPEN_API_SPECIFICATION_DOCUMENT',
    label: 'Get API Spec',
    category: 'admin',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_TWITTER_ACTIONS: TwitterAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getTwitterFeaturedActionNames(): string[] {
  return ALL_TWITTER_ACTIONS.map((a) => a.name);
}

export function getTwitterActionsByPriority(maxPriority: number = 3): TwitterAction[] {
  return ALL_TWITTER_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getTwitterActionNamesByPriority(maxPriority: number = 3): string[] {
  return getTwitterActionsByPriority(maxPriority).map((a) => a.name);
}

export function getTwitterActionsByCategory(category: TwitterActionCategory): TwitterAction[] {
  return ALL_TWITTER_ACTIONS.filter((a) => a.category === category);
}

export function getTwitterActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_TWITTER_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownTwitterAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_TWITTER_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveTwitterAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_TWITTER_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Twitter action priority.
 * Known Twitter actions sorted by priority (1-4), unknown actions last.
 */
export function sortByTwitterPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getTwitterActionPriority(a.name) - getTwitterActionPriority(b.name);
  });
}

export function getTwitterActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_TWITTER_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_TWITTER_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Twitter-specific system prompt when user has Twitter connected.
 * Tells Claude exactly what it can do via the Composio Twitter toolkit.
 */
export function getTwitterSystemPrompt(): string {
  return `
## Twitter/X Integration (Full Capabilities)

You have **full Twitter/X access** through the user's connected account. Use the \`composio_TWITTER_*\` tools.

### Post & Engage
- Create tweets (text, threads, replies, quotes)
- Retweet and unretweet posts
- Bookmark and unbookmark tweets
- Like and unlike posts
- Hide replies on your tweets

### Search & Discover
- Search recent tweets with powerful query syntax (from:, to:, has:media, is:retweet, lang:, etc.)
- Full archive search for historical tweets
- Get search result counts (recent and full archive)

### Direct Messages
- Send DMs to users
- Reply in existing DM conversations
- Create group DM conversations
- Get recent DM events and conversation history
- Browse DM conversations by ID

### Users & Relationships
- Follow and unfollow users
- Get followers and following lists by user ID
- Mute and unmute users
- View blocked and muted user lists
- Get posts liked by a user

### Lists
- Create and delete lists
- Add and remove list members
- Get list details, members, and timelines
- View owned lists and list memberships
- Follow/unfollow and pin/unpin lists
- Get list followers and followed lists

### Spaces
- Search for Twitter Spaces
- Get Space details by ID or creator
- Retrieve tweets from a Space
- Get Space ticket buyers

### Admin & Compliance
- Create and manage compliance jobs
- Access label streams
- Get API specification

### Safety Rules
1. **ALWAYS show a preview before posting any tweet** using the action-preview format:
\`\`\`action-preview
{
  "platform": "Twitter/X",
  "action": "Create Tweet",
  "content": "Tweet text preview...",
  "toolName": "composio_TWITTER_CREATION_OF_A_POST",
  "toolParams": { "text": "..." }
}
\`\`\`
2. **Never post tweets without explicit user confirmation** - always wait for Send button click
3. **Confirm before sending DMs** - show the recipient and message content for approval
4. **Never delete tweets, lists, or DMs without explicit confirmation** - these actions are irreversible
5. **For retweets and follows**, confirm the action and target user/post before executing
6. **For batch operations** (multiple follows, list member additions), summarize what will happen and get explicit approval
7. **Handle sensitive content carefully** - flag if tweet content appears to contain personal information, controversial statements, or potentially harmful content
8. **Rate limit awareness** - Twitter has strict rate limits; inform the user if actions may be throttled
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getTwitterCapabilitySummary(): string {
  const stats = getTwitterActionStats();
  return `Twitter/X (${stats.total} actions: tweets, search, DMs, lists, spaces, followers/following)`;
}

export function logTwitterToolkitStats(): void {
  const stats = getTwitterActionStats();
  log.info('Twitter Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
