/**
 * COMPOSIO REDDIT TOOLKIT
 * =======================
 *
 * Comprehensive Reddit integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Posts (submit, get, list, search, edit, delete, save)
 * - Comments (submit, list, edit, delete)
 * - Subreddits (search, info, subscribe, trending, rules)
 * - Users (profile, posts, block)
 * - Messages (send, list)
 * - Moderation (report posts, report comments)
 */

import { logger } from '@/lib/logger';

const log = logger('RedditToolkit');

// ============================================================================
// REDDIT ACTION CATEGORIES
// ============================================================================

export type RedditActionCategory =
  | 'posts'
  | 'comments'
  | 'subreddits'
  | 'users'
  | 'messages'
  | 'moderation';

export interface RedditAction {
  name: string; // Composio action name (e.g., REDDIT_SUBMIT_POST)
  label: string; // Human-readable label
  category: RedditActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Reddit connected)
// ============================================================================

const ESSENTIAL_ACTIONS: RedditAction[] = [
  // Posts
  {
    name: 'REDDIT_SUBMIT_POST',
    label: 'Submit Post',
    category: 'posts',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'REDDIT_GET_POST',
    label: 'Get Post',
    category: 'posts',
    priority: 1,
  },
  {
    name: 'REDDIT_LIST_SUBREDDIT_POSTS',
    label: 'List Subreddit Posts',
    category: 'posts',
    priority: 1,
  },

  // Comments
  {
    name: 'REDDIT_SUBMIT_COMMENT',
    label: 'Submit Comment',
    category: 'comments',
    priority: 1,
    writeOperation: true,
  },

  // Subreddits
  {
    name: 'REDDIT_SEARCH_SUBREDDITS',
    label: 'Search Subreddits',
    category: 'subreddits',
    priority: 1,
  },
  {
    name: 'REDDIT_GET_SUBREDDIT_INFO',
    label: 'Get Subreddit Info',
    category: 'subreddits',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: RedditAction[] = [
  // Comments
  {
    name: 'REDDIT_LIST_COMMENTS',
    label: 'List Comments',
    category: 'comments',
    priority: 2,
  },

  // Posts - Voting
  {
    name: 'REDDIT_UPVOTE',
    label: 'Upvote',
    category: 'posts',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'REDDIT_DOWNVOTE',
    label: 'Downvote',
    category: 'posts',
    priority: 2,
    writeOperation: true,
  },

  // Posts - Search
  {
    name: 'REDDIT_SEARCH_POSTS',
    label: 'Search Posts',
    category: 'posts',
    priority: 2,
  },

  // Users
  {
    name: 'REDDIT_GET_USER_PROFILE',
    label: 'Get User Profile',
    category: 'users',
    priority: 2,
  },
  {
    name: 'REDDIT_LIST_USER_POSTS',
    label: 'List User Posts',
    category: 'users',
    priority: 2,
  },

  // Messages
  {
    name: 'REDDIT_SEND_MESSAGE',
    label: 'Send Message',
    category: 'messages',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'REDDIT_LIST_MESSAGES',
    label: 'List Messages',
    category: 'messages',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: RedditAction[] = [
  // Posts - Destructive
  {
    name: 'REDDIT_DELETE_POST',
    label: 'Delete Post',
    category: 'posts',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Comments - Destructive
  {
    name: 'REDDIT_DELETE_COMMENT',
    label: 'Delete Comment',
    category: 'comments',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Posts - Edit
  {
    name: 'REDDIT_EDIT_POST',
    label: 'Edit Post',
    category: 'posts',
    priority: 3,
    writeOperation: true,
  },

  // Comments - Edit
  {
    name: 'REDDIT_EDIT_COMMENT',
    label: 'Edit Comment',
    category: 'comments',
    priority: 3,
    writeOperation: true,
  },

  // Subreddits - Subscription
  {
    name: 'REDDIT_SUBSCRIBE_SUBREDDIT',
    label: 'Subscribe to Subreddit',
    category: 'subreddits',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'REDDIT_UNSUBSCRIBE_SUBREDDIT',
    label: 'Unsubscribe from Subreddit',
    category: 'subreddits',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'REDDIT_LIST_SUBSCRIPTIONS',
    label: 'List Subscriptions',
    category: 'subreddits',
    priority: 3,
  },

  // Posts - Save
  {
    name: 'REDDIT_SAVE_POST',
    label: 'Save Post',
    category: 'posts',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Specialized operations)
// ============================================================================

const ADVANCED_ACTIONS: RedditAction[] = [
  {
    name: 'REDDIT_LIST_TRENDING',
    label: 'List Trending',
    category: 'subreddits',
    priority: 4,
  },
  {
    name: 'REDDIT_GET_SUBREDDIT_RULES',
    label: 'Get Subreddit Rules',
    category: 'subreddits',
    priority: 4,
  },
  {
    name: 'REDDIT_REPORT_POST',
    label: 'Report Post',
    category: 'moderation',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'REDDIT_REPORT_COMMENT',
    label: 'Report Comment',
    category: 'moderation',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'REDDIT_BLOCK_USER',
    label: 'Block User',
    category: 'users',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'REDDIT_LIST_SAVED',
    label: 'List Saved',
    category: 'posts',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_REDDIT_ACTIONS: RedditAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getRedditFeaturedActionNames(): string[] {
  return ALL_REDDIT_ACTIONS.map((a) => a.name);
}

export function getRedditActionsByPriority(maxPriority: number = 3): RedditAction[] {
  return ALL_REDDIT_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getRedditActionNamesByPriority(maxPriority: number = 3): string[] {
  return getRedditActionsByPriority(maxPriority).map((a) => a.name);
}

export function getRedditActionsByCategory(category: RedditActionCategory): RedditAction[] {
  return ALL_REDDIT_ACTIONS.filter((a) => a.category === category);
}

export function getRedditActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_REDDIT_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownRedditAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_REDDIT_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveRedditAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_REDDIT_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Reddit action priority.
 * Known Reddit actions sorted by priority (1-4), unknown actions last.
 */
export function sortByRedditPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getRedditActionPriority(a.name) - getRedditActionPriority(b.name);
  });
}

export function getRedditActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_REDDIT_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_REDDIT_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Reddit-specific system prompt when user has Reddit connected.
 * Tells Claude exactly what it can do via the Composio Reddit toolkit.
 */
export function getRedditSystemPrompt(): string {
  return `
## Reddit Integration (Full Capabilities)

You have **full Reddit access** through the user's connected account. Use the \`composio_REDDIT_*\` tools.

### Posts
- Submit new posts (text, link) to any subreddit
- Get details of a specific post by ID
- List posts from a subreddit (hot, new, top, rising)
- Search posts across Reddit or within specific subreddits
- Edit or delete your own posts
- Save posts for later viewing
- Upvote or downvote posts

### Comments
- Submit comments on posts or reply to existing comments
- List comments on a post or from a user
- Edit or delete your own comments

### Subreddits
- Search for subreddits by topic or keyword
- Get detailed subreddit information (description, rules, subscriber count)
- Subscribe or unsubscribe from subreddits
- List your current subscriptions
- View trending subreddits
- Get subreddit rules before posting

### Users
- View user profiles and account details
- List posts submitted by a specific user
- Block users to prevent interactions

### Messages
- Send private messages to other Reddit users
- List inbox messages (unread and read)

### Moderation
- Report posts that violate subreddit or site-wide rules
- Report comments that violate subreddit or site-wide rules

### Safety Rules
1. **ALWAYS confirm before posting or commenting publicly** - show the subreddit, title, and content preview:
\`\`\`action-preview
{
  "platform": "Reddit",
  "action": "Submit Post",
  "subreddit": "r/example",
  "title": "Post title here",
  "content": "Post body preview...",
  "toolName": "composio_REDDIT_SUBMIT_POST",
  "toolParams": { "subreddit": "...", "title": "...", "text": "..." }
}
\`\`\`
2. **Confirm before sending private messages** - show recipient, subject, and message body before sending
3. **Check subreddit rules before posting** - use Get Subreddit Rules to ensure the post complies with community guidelines
4. **Never delete posts or comments without explicit approval** - deletion is permanent and cannot be undone
5. **Confirm before voting** - clarify whether the user wants to upvote or downvote, and on which content
6. **For comments and replies**, show the full comment text and the context (parent post/comment) before submitting
7. **Handle user content carefully** - never post personal information, and respect Reddit's content policy
8. **For batch operations**, summarize what will happen and get explicit approval
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getRedditCapabilitySummary(): string {
  const stats = getRedditActionStats();
  return `Reddit (${stats.total} actions: posts, comments, subreddits, users, messages, moderation)`;
}

export function logRedditToolkitStats(): void {
  const stats = getRedditActionStats();
  log.info('Reddit Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
