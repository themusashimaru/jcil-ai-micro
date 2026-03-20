/**
 * COMPOSIO TIKTOK TOOLKIT
 * =======================
 *
 * Comprehensive TikTok integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Publish (upload videos, publish, post photos)
 * - Media (get videos, video details)
 * - Analytics (user stats)
 * - Profile (user info)
 */

import { logger } from '@/lib/logger';

const log = logger('TikTokToolkit');

// ============================================================================
// TIKTOK ACTION CATEGORIES
// ============================================================================

export type TikTokActionCategory = 'publish' | 'media' | 'analytics' | 'profile';

export interface TikTokAction {
  name: string; // Composio action name (e.g., TIKTOK_UPLOAD_VIDEO)
  label: string; // Human-readable label
  category: TikTokActionCategory;
  priority: number; // 1 = highest (always include), 3 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when TikTok connected)
// ============================================================================

const ESSENTIAL_ACTIONS: TikTokAction[] = [
  // Publish - Core
  {
    name: 'TIKTOK_UPLOAD_VIDEO',
    label: 'Upload Video',
    category: 'publish',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'TIKTOK_PUBLISH_VIDEO',
    label: 'Publish Video',
    category: 'publish',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'TIKTOK_POST_PHOTO',
    label: 'Post Photos',
    category: 'publish',
    priority: 1,
    writeOperation: true,
  },

  // Profile
  { name: 'TIKTOK_GET_USER_INFO', label: 'Get User Info', category: 'profile', priority: 1 },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: TikTokAction[] = [
  // Publish - Extended
  {
    name: 'TIKTOK_UPLOAD_VIDEOS',
    label: 'Batch Upload Videos',
    category: 'publish',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TIKTOK_GET_PUBLISH_STATUS',
    label: 'Check Publish Status',
    category: 'publish',
    priority: 2,
  },

  // Media
  { name: 'TIKTOK_GET_USER_VIDEOS', label: 'Get User Videos', category: 'media', priority: 2 },

  // Analytics
  {
    name: 'TIKTOK_GET_USER_STATS',
    label: 'Get User Statistics',
    category: 'analytics',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: TikTokAction[] = [
  // Media - Extended
  {
    name: 'TIKTOK_GET_VIDEO_DETAILS',
    label: 'Get Video Details',
    category: 'media',
    priority: 3,
  },

  // Media - Destructive
  {
    name: 'TIKTOK_DELETE_VIDEO',
    label: 'Delete Video',
    category: 'media',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_TIKTOK_ACTIONS: TikTokAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getTikTokFeaturedActionNames(): string[] {
  return ALL_TIKTOK_ACTIONS.map((a) => a.name);
}

export function getTikTokActionsByPriority(maxPriority: number = 3): TikTokAction[] {
  return ALL_TIKTOK_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getTikTokActionNamesByPriority(maxPriority: number = 3): string[] {
  return getTikTokActionsByPriority(maxPriority).map((a) => a.name);
}

export function getTikTokActionsByCategory(category: TikTokActionCategory): TikTokAction[] {
  return ALL_TIKTOK_ACTIONS.filter((a) => a.category === category);
}

export function getTikTokActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_TIKTOK_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownTikTokAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_TIKTOK_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveTikTokAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_TIKTOK_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by TikTok action priority.
 * Known TikTok actions sorted by priority (1-3), unknown actions last.
 */
export function sortByTikTokPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getTikTokActionPriority(a.name) - getTikTokActionPriority(b.name);
  });
}

export function getTikTokActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_TIKTOK_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_TIKTOK_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate TikTok-specific system prompt when user has TikTok connected.
 * Tells Claude exactly what it can do via the Composio TikTok toolkit.
 */
export function getTikTokSystemPrompt(): string {
  return `
## TikTok Integration (Full Capabilities)

You have **full TikTok access** through the user's connected account. Use the \`composio_TIKTOK_*\` tools.

### Publish Content
- Upload individual videos to TikTok
- Batch upload multiple videos at once
- Publish uploaded videos to the user's TikTok feed
- Post photo posts with 1-35 images
- Check the publish status of uploaded content

### Browse Media
- Fetch the user's video feed
- Get detailed information about specific videos (views, likes, comments, shares)

### Analytics & Statistics
- Get user-level statistics (follower count, following count, likes, video count)

### Profile
- View user profile information (username, display name, bio, avatar, verification status)

### Content Management
- Delete videos (with confirmation)

### Safety Rules
1. **ALWAYS preview before publishing** - show post details using the action-preview format:
\`\`\`action-preview
{
  "platform": "TikTok",
  "action": "Publish Video",
  "content": "Caption preview...",
  "mediaType": "VIDEO/PHOTO",
  "toolName": "composio_TIKTOK_PUBLISH_VIDEO",
  "toolParams": { "video_id": "...", "caption": "..." }
}
\`\`\`
2. **Confirm media before posting** - verify the video/image URL is correct and accessible
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For photo posts**, confirm all images (up to 35) before posting
5. **For batch uploads**, show the list of videos and confirm before uploading
6. **Handle rate limits gracefully** - check publish status before bulk operations
7. **Respect content guidelines** - flag potentially problematic content before posting
8. **Verify video format** - TikTok has specific format requirements; confirm compatibility
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getTikTokCapabilitySummary(): string {
  const stats = getTikTokActionStats();
  return `TikTok (${stats.total} actions: publish, media, analytics, profile)`;
}

export function logTikTokToolkitStats(): void {
  const stats = getTikTokActionStats();
  log.info('TikTok Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    categories: stats.byCategory,
  });
}
