/**
 * COMPOSIO YOUTUBE TOOLKIT
 * ========================
 *
 * Comprehensive YouTube integration via Composio's 24 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Search (search videos, trending)
 * - Videos (details, upload, update, delete, captions)
 * - Channels (stats, videos, activities, subscriptions)
 * - Playlists (list, create, add items)
 * - Engagement (comments)
 */

import { logger } from '@/lib/logger';

const log = logger('YouTubeToolkit');

// ============================================================================
// YOUTUBE ACTION CATEGORIES
// ============================================================================

export type YouTubeActionCategory = 'search' | 'videos' | 'channels' | 'playlists' | 'engagement';

export interface YouTubeAction {
  name: string; // Composio action name (e.g., YOUTUBE_SEARCH_YOU_TUBE)
  label: string; // Human-readable label
  category: YouTubeActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when YouTube connected)
// ============================================================================

const ESSENTIAL_ACTIONS: YouTubeAction[] = [
  // Search
  {
    name: 'YOUTUBE_SEARCH_YOU_TUBE',
    label: 'Search YouTube',
    category: 'search',
    priority: 1,
  },

  // Videos
  {
    name: 'YOUTUBE_VIDEO_DETAILS',
    label: 'Get Video Details',
    category: 'videos',
    priority: 1,
  },
  {
    name: 'YOUTUBE_GET_VIDEO_DETAILS_BATCH',
    label: 'Get Videos Batch',
    category: 'videos',
    priority: 1,
  },

  // Channels
  {
    name: 'YOUTUBE_LIST_CHANNEL_VIDEOS',
    label: 'List Channel Videos',
    category: 'channels',
    priority: 1,
  },
  {
    name: 'YOUTUBE_GET_CHANNEL_STATISTICS',
    label: 'Get Channel Stats',
    category: 'channels',
    priority: 1,
  },
  {
    name: 'YOUTUBE_GET_CHANNEL_ID_BY_HANDLE',
    label: 'Get Channel by Handle',
    category: 'channels',
    priority: 1,
  },

  // Playlists
  {
    name: 'YOUTUBE_LIST_USER_PLAYLISTS',
    label: 'List My Playlists',
    category: 'playlists',
    priority: 1,
  },
  {
    name: 'YOUTUBE_LIST_PLAYLIST_ITEMS',
    label: 'List Playlist Items',
    category: 'playlists',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: YouTubeAction[] = [
  // Videos - Upload & Update
  {
    name: 'YOUTUBE_UPLOAD_VIDEO',
    label: 'Upload Video',
    category: 'videos',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'YOUTUBE_MULTIPART_UPLOAD_VIDEO',
    label: 'Multipart Upload',
    category: 'videos',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'YOUTUBE_UPDATE_VIDEO',
    label: 'Update Video',
    category: 'videos',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'YOUTUBE_UPDATE_THUMBNAIL',
    label: 'Update Thumbnail',
    category: 'videos',
    priority: 2,
    writeOperation: true,
  },

  // Playlists - Management
  {
    name: 'YOUTUBE_CREATE_PLAYLIST',
    label: 'Create Playlist',
    category: 'playlists',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'YOUTUBE_ADD_VIDEO_TO_PLAYLIST',
    label: 'Add to Playlist',
    category: 'playlists',
    priority: 2,
    writeOperation: true,
  },

  // Engagement
  {
    name: 'YOUTUBE_POST_COMMENT',
    label: 'Post Comment',
    category: 'engagement',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'YOUTUBE_LIST_COMMENT_THREADS',
    label: 'List Comments',
    category: 'engagement',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: YouTubeAction[] = [
  // Search - Extended
  {
    name: 'YOUTUBE_LIST_MOST_POPULAR_VIDEOS',
    label: 'Trending Videos',
    category: 'search',
    priority: 3,
  },

  // Channels - Extended
  {
    name: 'YOUTUBE_GET_CHANNEL_ACTIVITIES',
    label: 'Get Activities',
    category: 'channels',
    priority: 3,
  },
  {
    name: 'YOUTUBE_LIST_USER_SUBSCRIPTIONS',
    label: 'List Subscriptions',
    category: 'channels',
    priority: 3,
  },
  {
    name: 'YOUTUBE_SUBSCRIBE_CHANNEL',
    label: 'Subscribe',
    category: 'channels',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'YOUTUBE_UNSUBSCRIBE_CHANNEL',
    label: 'Unsubscribe',
    category: 'channels',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & captions)
// ============================================================================

const ADVANCED_ACTIONS: YouTubeAction[] = [
  // Videos - Destructive
  {
    name: 'YOUTUBE_DELETE_VIDEO',
    label: 'Delete Video',
    category: 'videos',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Videos - Captions
  {
    name: 'YOUTUBE_LIST_CAPTION_TRACK',
    label: 'List Captions',
    category: 'videos',
    priority: 4,
  },
  {
    name: 'YOUTUBE_LOAD_CAPTIONS',
    label: 'Download Captions',
    category: 'videos',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_YOUTUBE_ACTIONS: YouTubeAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getYouTubeFeaturedActionNames(): string[] {
  return ALL_YOUTUBE_ACTIONS.map((a) => a.name);
}

export function getYouTubeActionsByPriority(maxPriority: number = 3): YouTubeAction[] {
  return ALL_YOUTUBE_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getYouTubeActionNamesByPriority(maxPriority: number = 3): string[] {
  return getYouTubeActionsByPriority(maxPriority).map((a) => a.name);
}

export function getYouTubeActionsByCategory(category: YouTubeActionCategory): YouTubeAction[] {
  return ALL_YOUTUBE_ACTIONS.filter((a) => a.category === category);
}

export function getYouTubeActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_YOUTUBE_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownYouTubeAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_YOUTUBE_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveYouTubeAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_YOUTUBE_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by YouTube action priority.
 * Known YouTube actions sorted by priority (1-4), unknown actions last.
 */
export function sortByYouTubePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getYouTubeActionPriority(a.name) - getYouTubeActionPriority(b.name);
  });
}

export function getYouTubeActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_YOUTUBE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_YOUTUBE_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate YouTube-specific system prompt when user has YouTube connected.
 * Tells Claude exactly what it can do via the Composio YouTube toolkit.
 */
export function getYouTubeSystemPrompt(): string {
  return `
## YouTube Integration (Full Capabilities)

You have **full YouTube access** through the user's connected account. Use the \`composio_YOUTUBE_*\` tools.

### Search & Discovery
- Search YouTube for videos, channels, and playlists by keywords
- Browse trending/most popular videos by region and category
- Get detailed video information (title, description, stats, duration, tags)
- Batch-fetch details for multiple videos at once

### Channel Management
- Look up channels by handle (e.g., @channel)
- Get channel statistics (subscribers, views, video count)
- List videos published by a channel
- View channel activity feed
- List and manage subscriptions (subscribe/unsubscribe)

### Video Management
- Upload videos with title, description, tags, and privacy settings
- Update video metadata (title, description, tags, category)
- Update video thumbnails
- List and download caption tracks
- Delete videos (with confirmation)

### Playlists
- List the user's playlists
- View items in any playlist
- Create new playlists with title, description, and privacy settings
- Add videos to existing playlists

### Engagement
- List comment threads on videos
- Post comments on videos

### Safety Rules
1. **ALWAYS confirm before uploading or deleting videos** using the action-preview format:
\`\`\`action-preview
{
  "platform": "YouTube",
  "action": "Upload Video",
  "details": "Title, description, privacy setting...",
  "toolName": "composio_YOUTUBE_UPLOAD_VIDEO",
  "toolParams": { "title": "...", "description": "...", "privacyStatus": "..." }
}
\`\`\`
2. **Never upload or delete videos without explicit user confirmation** - always wait for approval
3. **Preview comments before posting** - show the comment text and target video
4. **For destructive operations** (delete video, unsubscribe), summarize what will happen and get explicit approval
5. **Handle privacy settings carefully** - always clarify if a video should be public, unlisted, or private before uploading
6. **For bulk operations** (batch video details, playlist management), summarize the scope before executing
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getYouTubeCapabilitySummary(): string {
  const stats = getYouTubeActionStats();
  return `YouTube (${stats.total} actions: search, video management, playlists, comments, channel stats)`;
}

export function logYouTubeToolkitStats(): void {
  const stats = getYouTubeActionStats();
  log.info('YouTube Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
