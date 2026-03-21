/**
 * COMPOSIO FACEBOOK TOOLKIT
 * =========================
 *
 * Comprehensive Facebook Page integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Publish (create posts, upload media)
 * - Media (photos, videos, albums)
 * - Engagement (comments, replies)
 * - Analytics (page insights)
 * - Events (page events)
 * - Profile (page info)
 */

import { logger } from '@/lib/logger';

const log = logger('FacebookToolkit');

// ============================================================================
// FACEBOOK ACTION CATEGORIES
// ============================================================================

export type FacebookActionCategory =
  | 'publish'
  | 'media'
  | 'engagement'
  | 'analytics'
  | 'events'
  | 'profile';

export interface FacebookAction {
  name: string; // Composio action name (e.g., FACEBOOK_CREATE_PAGE_POST)
  label: string; // Human-readable label
  category: FacebookActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Facebook connected)
// ============================================================================

const ESSENTIAL_ACTIONS: FacebookAction[] = [
  // Publish - Core
  {
    name: 'FACEBOOK_CREATE_PAGE_POST',
    label: 'Create Page Post',
    category: 'publish',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'FACEBOOK_UPLOAD_PHOTO',
    label: 'Upload Photo',
    category: 'media',
    priority: 1,
    writeOperation: true,
  },

  // Profile
  { name: 'FACEBOOK_GET_PAGE_INFO', label: 'Get Page Info', category: 'profile', priority: 1 },

  // Media - Core
  { name: 'FACEBOOK_GET_PAGE_FEED', label: 'Get Page Feed', category: 'publish', priority: 1 },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: FacebookAction[] = [
  // Media - Extended
  {
    name: 'FACEBOOK_UPLOAD_VIDEO',
    label: 'Upload Video',
    category: 'media',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'FACEBOOK_UPLOAD_PHOTOS_BATCH',
    label: 'Batch Upload Photos',
    category: 'media',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'FACEBOOK_CREATE_ALBUM',
    label: 'Create Album',
    category: 'media',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'FACEBOOK_ADD_PHOTO_TO_ALBUM',
    label: 'Add Photo to Album',
    category: 'media',
    priority: 2,
    writeOperation: true,
  },

  // Engagement - Core
  {
    name: 'FACEBOOK_GET_POST_COMMENTS',
    label: 'Get Post Comments',
    category: 'engagement',
    priority: 2,
  },
  {
    name: 'FACEBOOK_CREATE_COMMENT',
    label: 'Post Comment',
    category: 'engagement',
    priority: 2,
    writeOperation: true,
  },

  // Analytics
  {
    name: 'FACEBOOK_GET_PAGE_INSIGHTS',
    label: 'Get Page Insights',
    category: 'analytics',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: FacebookAction[] = [
  // Engagement - Extended
  {
    name: 'FACEBOOK_REPLY_TO_COMMENT',
    label: 'Reply to Comment',
    category: 'engagement',
    priority: 3,
    writeOperation: true,
  },

  // Events
  {
    name: 'FACEBOOK_GET_PAGE_EVENTS',
    label: 'Get Page Events',
    category: 'events',
    priority: 3,
  },
  {
    name: 'FACEBOOK_CREATE_EVENT',
    label: 'Create Event',
    category: 'events',
    priority: 3,
    writeOperation: true,
  },

  // Media - Extended
  {
    name: 'FACEBOOK_GET_PAGE_PHOTOS',
    label: 'Get Page Photos',
    category: 'media',
    priority: 3,
  },
  {
    name: 'FACEBOOK_GET_PAGE_VIDEOS',
    label: 'Get Page Videos',
    category: 'media',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: FacebookAction[] = [
  // Publish - Destructive
  {
    name: 'FACEBOOK_DELETE_POST',
    label: 'Delete Post',
    category: 'publish',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Engagement - Destructive
  {
    name: 'FACEBOOK_DELETE_COMMENT',
    label: 'Delete Comment',
    category: 'engagement',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Media - Destructive
  {
    name: 'FACEBOOK_DELETE_PHOTO',
    label: 'Delete Photo',
    category: 'media',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_FACEBOOK_ACTIONS: FacebookAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getFacebookFeaturedActionNames(): string[] {
  return ALL_FACEBOOK_ACTIONS.map((a) => a.name);
}

export function getFacebookActionsByPriority(maxPriority: number = 3): FacebookAction[] {
  return ALL_FACEBOOK_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getFacebookActionNamesByPriority(maxPriority: number = 3): string[] {
  return getFacebookActionsByPriority(maxPriority).map((a) => a.name);
}

export function getFacebookActionsByCategory(category: FacebookActionCategory): FacebookAction[] {
  return ALL_FACEBOOK_ACTIONS.filter((a) => a.category === category);
}

export function getFacebookActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_FACEBOOK_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownFacebookAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_FACEBOOK_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveFacebookAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_FACEBOOK_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Facebook action priority.
 * Known Facebook actions sorted by priority (1-4), unknown actions last.
 */
export function sortByFacebookPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getFacebookActionPriority(a.name) - getFacebookActionPriority(b.name);
  });
}

export function getFacebookActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_FACEBOOK_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_FACEBOOK_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Facebook-specific system prompt when user has Facebook connected.
 * Tells Claude exactly what it can do via the Composio Facebook toolkit.
 */
export function getFacebookSystemPrompt(): string {
  return `
## Facebook Page Integration (Full Capabilities)

You have **full Facebook Page access** through the user's connected account. Use the \`composio_FACEBOOK_*\` tools.

### Publish Content
- Create posts on a Facebook Page (text, links, media)
- Get the page feed to see existing posts
- Delete posts (with confirmation)

### Media Management
- Upload photos to a Page
- Upload videos to a Page
- Batch upload multiple photos at once
- Create photo albums
- Add photos to existing albums
- Browse page photos and videos
- Delete photos (with confirmation)

### Engagement
- Read comments on posts
- Post new comments on posts
- Reply to existing comments
- Delete comments (with confirmation)

### Analytics & Insights
- Get page-level insights (reach, impressions, engagement metrics)

### Events
- View page events
- Create new events on a Page

### Profile
- View page information (name, description, follower count, category)

### Safety Rules
1. **ALWAYS preview before publishing** - show post details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Facebook",
  "action": "Create Page Post",
  "content": "Post preview...",
  "toolName": "composio_FACEBOOK_CREATE_PAGE_POST",
  "toolParams": { "message": "...", "page_id": "..." }
}
\`\`\`
2. **Confirm media before posting** - verify the image/video URL is correct and accessible
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For comments**, show the comment text and which post it targets before posting
5. **For batch uploads**, confirm all media items before uploading
6. **For events**, show event details (name, date, location) before creating
7. **Handle rate limits gracefully** - monitor API usage during bulk operations
8. **Respect content guidelines** - flag potentially problematic content before posting
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getFacebookCapabilitySummary(): string {
  const stats = getFacebookActionStats();
  return `Facebook (${stats.total} actions: publish, media, comments, analytics, events, profile)`;
}

export function logFacebookToolkitStats(): void {
  const stats = getFacebookActionStats();
  log.info('Facebook Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
