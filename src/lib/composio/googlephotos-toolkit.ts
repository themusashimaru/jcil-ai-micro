/**
 * COMPOSIO GOOGLE PHOTOS TOOLKIT
 * ===============================
 *
 * Comprehensive Google Photos integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Media (list, get, search, upload, batch get)
 * - Albums (create, get, list, add/remove media, update)
 * - Sharing (share, unshare, list shared, join, leave)
 */

import { logger } from '@/lib/logger';

const log = logger('GooglePhotosToolkit');

// ============================================================================
// GOOGLE PHOTOS ACTION CATEGORIES
// ============================================================================

export type GooglePhotosActionCategory = 'media' | 'albums' | 'sharing';

export interface GooglePhotosAction {
  name: string; // Composio action name (e.g., GOOGLEPHOTOS_LIST_MEDIA_ITEMS)
  label: string; // Human-readable label
  category: GooglePhotosActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Google Photos connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GooglePhotosAction[] = [
  // Media
  {
    name: 'GOOGLEPHOTOS_LIST_MEDIA_ITEMS',
    label: 'List Media Items',
    category: 'media',
    priority: 1,
  },
  {
    name: 'GOOGLEPHOTOS_GET_MEDIA_ITEM',
    label: 'Get Media Item',
    category: 'media',
    priority: 1,
  },
  {
    name: 'GOOGLEPHOTOS_SEARCH_MEDIA_ITEMS',
    label: 'Search Media Items',
    category: 'media',
    priority: 1,
  },

  // Albums
  {
    name: 'GOOGLEPHOTOS_LIST_ALBUMS',
    label: 'List Albums',
    category: 'albums',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GooglePhotosAction[] = [
  // Albums
  {
    name: 'GOOGLEPHOTOS_CREATE_ALBUM',
    label: 'Create Album',
    category: 'albums',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEPHOTOS_GET_ALBUM',
    label: 'Get Album',
    category: 'albums',
    priority: 2,
  },
  {
    name: 'GOOGLEPHOTOS_ADD_MEDIA_TO_ALBUM',
    label: 'Add Media to Album',
    category: 'albums',
    priority: 2,
    writeOperation: true,
  },

  // Media
  {
    name: 'GOOGLEPHOTOS_UPLOAD_MEDIA',
    label: 'Upload Media',
    category: 'media',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GooglePhotosAction[] = [
  // Sharing
  {
    name: 'GOOGLEPHOTOS_SHARE_ALBUM',
    label: 'Share Album',
    category: 'sharing',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEPHOTOS_UNSHARE_ALBUM',
    label: 'Unshare Album',
    category: 'sharing',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEPHOTOS_LIST_SHARED_ALBUMS',
    label: 'List Shared Albums',
    category: 'sharing',
    priority: 3,
  },

  // Media
  {
    name: 'GOOGLEPHOTOS_BATCH_GET_MEDIA_ITEMS',
    label: 'Batch Get Media Items',
    category: 'media',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive or rarely used operations)
// ============================================================================

const ADVANCED_ACTIONS: GooglePhotosAction[] = [
  {
    name: 'GOOGLEPHOTOS_REMOVE_MEDIA_FROM_ALBUM',
    label: 'Remove Media from Album',
    category: 'albums',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEPHOTOS_UPDATE_ALBUM',
    label: 'Update Album',
    category: 'albums',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GOOGLEPHOTOS_JOIN_SHARED_ALBUM',
    label: 'Join Shared Album',
    category: 'sharing',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GOOGLEPHOTOS_LEAVE_SHARED_ALBUM',
    label: 'Leave Shared Album',
    category: 'sharing',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GOOGLE_PHOTOS_ACTIONS: GooglePhotosAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGooglePhotosFeaturedActionNames(): string[] {
  return ALL_GOOGLE_PHOTOS_ACTIONS.map((a) => a.name);
}

export function getGooglePhotosActionsByPriority(maxPriority: number = 3): GooglePhotosAction[] {
  return ALL_GOOGLE_PHOTOS_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGooglePhotosActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGooglePhotosActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGooglePhotosActionsByCategory(
  category: GooglePhotosActionCategory
): GooglePhotosAction[] {
  return ALL_GOOGLE_PHOTOS_ACTIONS.filter((a) => a.category === category);
}

export function getGooglePhotosActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GOOGLE_PHOTOS_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGooglePhotosAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_PHOTOS_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGooglePhotosAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_PHOTOS_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Google Photos action priority.
 * Known Google Photos actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGooglePhotosPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGooglePhotosActionPriority(a.name) - getGooglePhotosActionPriority(b.name);
  });
}

export function getGooglePhotosActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GOOGLE_PHOTOS_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GOOGLE_PHOTOS_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Google Photos-specific system prompt when user has Google Photos connected.
 * Tells Claude exactly what it can do via the Composio Google Photos toolkit.
 */
export function getGooglePhotosSystemPrompt(): string {
  return `
## Google Photos Integration (Full Capabilities)

You have **full Google Photos access** through the user's connected account. Use the \`composio_GOOGLEPHOTOS_*\` tools.

### Media (Photos & Videos)
- List all media items in the user's library
- Get details for a specific media item (metadata, URL, dimensions)
- Search media items by date, content category, or media type
- Upload new photos or videos to the library
- Batch retrieve multiple media items by ID

### Albums
- List all albums in the user's library
- Get details for a specific album (title, cover photo, item count)
- Create new albums with a title
- Add existing media items to an album
- Remove media items from an album
- Update album metadata (title, cover photo)

### Sharing
- Share an album with others via a shareable link
- Unshare a previously shared album (revokes link access)
- List all shared albums visible to the user
- Join a shared album using a share token
- Leave a shared album the user previously joined

### Safety Rules
1. **ALWAYS confirm before sharing albums** - sharing creates a public link accessible to anyone with it:
\`\`\`action-preview
{
  "platform": "Google Photos",
  "action": "Share Album",
  "album": "Album title/ID",
  "toolName": "composio_GOOGLEPHOTOS_SHARE_ALBUM",
  "toolParams": { "albumId": "..." }
}
\`\`\`
2. **Confirm before removing media from albums** - show which media items will be removed and from which album
3. **Never unshare albums without explicit approval** - unsharing revokes access for all current viewers
4. **Show media details before bulk operations** - when batch getting or moving multiple items, summarize the list first
5. **Confirm before uploading media** - verify file details and target album before uploading
6. **Handle media privacy carefully** - photos and videos may contain sensitive personal content
7. **For album modifications**, clearly show the album name and what will change before proceeding
8. **For batch operations**, summarize what will happen and get explicit approval
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGooglePhotosCapabilitySummary(): string {
  const stats = getGooglePhotosActionStats();
  return `Google Photos (${stats.total} actions: media browsing, albums, sharing)`;
}

export function logGooglePhotosToolkitStats(): void {
  const stats = getGooglePhotosActionStats();
  log.info('Google Photos Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
