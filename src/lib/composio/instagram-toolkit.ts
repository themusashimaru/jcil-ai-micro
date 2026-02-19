/**
 * COMPOSIO INSTAGRAM TOOLKIT
 * ==========================
 *
 * Comprehensive Instagram integration via Composio's 32 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Publish (create media containers, post, carousels, reels)
 * - Media (fetch user media, media details, stories, tags)
 * - Engagement (comments, replies, mentions)
 * - Messaging (DMs, conversations)
 * - Analytics (post insights, media insights, user insights)
 * - Profile (user info)
 */

import { logger } from '@/lib/logger';

const log = logger('InstagramToolkit');

// ============================================================================
// INSTAGRAM ACTION CATEGORIES
// ============================================================================

export type InstagramActionCategory =
  | 'publish'
  | 'media'
  | 'engagement'
  | 'messaging'
  | 'analytics'
  | 'profile';

export interface InstagramAction {
  name: string; // Composio action name (e.g., INSTAGRAM_CREATE_POST)
  label: string; // Human-readable label
  category: InstagramActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Instagram connected)
// ============================================================================

const ESSENTIAL_ACTIONS: InstagramAction[] = [
  // Publish - Core
  {
    name: 'INSTAGRAM_CREATE_MEDIA_CONTAINER',
    label: 'Create Media Container',
    category: 'publish',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'INSTAGRAM_CREATE_POST',
    label: 'Publish Post',
    category: 'publish',
    priority: 1,
    writeOperation: true,
  },

  // Profile
  { name: 'INSTAGRAM_GET_USER_INFO', label: 'Get User Info', category: 'profile', priority: 1 },

  // Media - Core
  { name: 'INSTAGRAM_GET_USER_MEDIA', label: 'Get User Media', category: 'media', priority: 1 },
  {
    name: 'INSTAGRAM_GET_IG_USER_MEDIA',
    label: 'Get IG User Media',
    category: 'media',
    priority: 1,
  },
  { name: 'INSTAGRAM_GET_IG_MEDIA', label: 'Get Media Details', category: 'media', priority: 1 },

  // Messaging - Core
  {
    name: 'INSTAGRAM_SEND_TEXT_MESSAGE',
    label: 'Send DM Text',
    category: 'messaging',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'INSTAGRAM_SEND_IMAGE',
    label: 'Send DM Image',
    category: 'messaging',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: InstagramAction[] = [
  // Publish - Extended
  {
    name: 'INSTAGRAM_CREATE_CAROUSEL_CONTAINER',
    label: 'Create Carousel',
    category: 'publish',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'INSTAGRAM_POST_IG_USER_MEDIA',
    label: 'Create IG Media',
    category: 'publish',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH',
    label: 'Publish IG Media',
    category: 'publish',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'INSTAGRAM_GET_POST_STATUS',
    label: 'Check Post Status',
    category: 'publish',
    priority: 2,
  },

  // Engagement - Core
  {
    name: 'INSTAGRAM_GET_POST_COMMENTS',
    label: 'Get Comments',
    category: 'engagement',
    priority: 2,
  },
  {
    name: 'INSTAGRAM_GET_IG_MEDIA_COMMENTS',
    label: 'Get Media Comments',
    category: 'engagement',
    priority: 2,
  },
  {
    name: 'INSTAGRAM_POST_IG_MEDIA_COMMENTS',
    label: 'Post Comment',
    category: 'engagement',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'INSTAGRAM_REPLY_TO_COMMENT',
    label: 'Reply to Comment',
    category: 'engagement',
    priority: 2,
    writeOperation: true,
  },

  // Messaging - Extended
  {
    name: 'INSTAGRAM_LIST_ALL_CONVERSATIONS',
    label: 'List DM Conversations',
    category: 'messaging',
    priority: 2,
  },
  {
    name: 'INSTAGRAM_LIST_ALL_MESSAGES',
    label: 'List DM Messages',
    category: 'messaging',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: InstagramAction[] = [
  // Engagement - Extended
  {
    name: 'INSTAGRAM_GET_IG_COMMENT_REPLIES',
    label: 'Get Comment Replies',
    category: 'engagement',
    priority: 3,
  },
  {
    name: 'INSTAGRAM_POST_IG_COMMENT_REPLIES',
    label: 'Post Comment Reply',
    category: 'engagement',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'INSTAGRAM_POST_IG_USER_MENTIONS',
    label: 'Reply to Mention',
    category: 'engagement',
    priority: 3,
    writeOperation: true,
  },

  // Analytics
  {
    name: 'INSTAGRAM_GET_POST_INSIGHTS',
    label: 'Get Post Insights',
    category: 'analytics',
    priority: 3,
  },
  {
    name: 'INSTAGRAM_GET_IG_MEDIA_INSIGHTS',
    label: 'Get Media Insights',
    category: 'analytics',
    priority: 3,
  },
  {
    name: 'INSTAGRAM_GET_USER_INSIGHTS',
    label: 'Get User Insights',
    category: 'analytics',
    priority: 3,
  },

  // Publish - Extended
  {
    name: 'INSTAGRAM_GET_IG_USER_CONTENT_PUBLISHING_LIMIT',
    label: 'Get Publishing Limit',
    category: 'publish',
    priority: 3,
  },

  // Media - Extended
  {
    name: 'INSTAGRAM_GET_IG_USER_STORIES',
    label: 'Get Stories',
    category: 'media',
    priority: 3,
  },
  { name: 'INSTAGRAM_GET_IG_USER_TAGS', label: 'Get User Tags', category: 'media', priority: 3 },
  {
    name: 'INSTAGRAM_GET_IG_MEDIA_CHILDREN',
    label: 'Get Carousel Children',
    category: 'media',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: InstagramAction[] = [
  // Engagement - Destructive
  {
    name: 'INSTAGRAM_DELETE_COMMENT',
    label: 'Delete Comment',
    category: 'engagement',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Messaging - Extended
  {
    name: 'INSTAGRAM_GET_CONVERSATION',
    label: 'Get DM Conversation',
    category: 'messaging',
    priority: 4,
  },
  {
    name: 'INSTAGRAM_MARK_SEEN',
    label: 'Mark DM Seen',
    category: 'messaging',
    priority: 4,
    writeOperation: true,
  },

  // Media - Specialized
  {
    name: 'INSTAGRAM_GET_IG_USER_LIVE_MEDIA',
    label: 'Get Live Media',
    category: 'media',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_INSTAGRAM_ACTIONS: InstagramAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getInstagramFeaturedActionNames(): string[] {
  return ALL_INSTAGRAM_ACTIONS.map((a) => a.name);
}

export function getInstagramActionsByPriority(maxPriority: number = 3): InstagramAction[] {
  return ALL_INSTAGRAM_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getInstagramActionNamesByPriority(maxPriority: number = 3): string[] {
  return getInstagramActionsByPriority(maxPriority).map((a) => a.name);
}

export function getInstagramActionsByCategory(
  category: InstagramActionCategory
): InstagramAction[] {
  return ALL_INSTAGRAM_ACTIONS.filter((a) => a.category === category);
}

export function getInstagramActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_INSTAGRAM_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownInstagramAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_INSTAGRAM_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveInstagramAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_INSTAGRAM_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Instagram action priority.
 * Known Instagram actions sorted by priority (1-4), unknown actions last.
 */
export function sortByInstagramPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getInstagramActionPriority(a.name) - getInstagramActionPriority(b.name);
  });
}

export function getInstagramActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_INSTAGRAM_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_INSTAGRAM_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Instagram-specific system prompt when user has Instagram connected.
 * Tells Claude exactly what it can do via the Composio Instagram toolkit.
 */
export function getInstagramSystemPrompt(): string {
  return `
## Instagram Integration (Full Capabilities)

You have **full Instagram access** through the user's connected account. Use the \`composio_INSTAGRAM_*\` tools.

### Publish Content
- Create media containers for photos, videos, and reels
- Publish posts directly to the user's Instagram feed
- Create and publish carousel posts with multiple images/videos
- Check post publishing status
- View content publishing rate limits

### Browse Media
- Fetch user's media feed and individual media details
- View Instagram Stories
- Get carousel children (individual items in a carousel post)
- View tagged posts and live media
- Access full media metadata (captions, timestamps, media type, URLs)

### Engagement
- Read comments on posts and media
- Post new comments on media
- Reply to existing comments and comment threads
- Respond to @mentions
- Delete comments (with confirmation)

### Direct Messages
- Send text messages via Instagram DMs
- Send images via Instagram DMs
- List all DM conversations
- View messages within conversations
- Get specific conversation details
- Mark messages as seen

### Analytics & Insights
- Get post-level insights (reach, impressions, engagement)
- Get media-level insights (detailed performance metrics)
- Get user-level insights (follower demographics, activity patterns)

### Profile
- View user profile information (username, bio, follower/following counts, profile picture)

### Safety Rules
1. **ALWAYS preview before publishing** - show post details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Instagram",
  "action": "Publish Post",
  "content": "Caption preview...",
  "mediaType": "IMAGE/VIDEO/CAROUSEL",
  "toolName": "composio_INSTAGRAM_CREATE_POST",
  "toolParams": { "creation_id": "...", "caption": "..." }
}
\`\`\`
2. **Confirm media before posting** - verify the image/video URL is correct and accessible
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For DMs**, show message preview and recipient before sending
5. **For comments**, show the comment text and which post it targets before posting
6. **For carousel posts**, confirm all media items before creating the container
7. **Handle rate limits gracefully** - check publishing limits before bulk operations
8. **Respect content guidelines** - flag potentially problematic content before posting
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getInstagramCapabilitySummary(): string {
  const stats = getInstagramActionStats();
  return `Instagram (${stats.total} actions: publish, media, comments, DMs, analytics, profile)`;
}

export function logInstagramToolkitStats(): void {
  const stats = getInstagramActionStats();
  log.info('Instagram Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
