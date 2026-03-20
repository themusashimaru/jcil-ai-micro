/**
 * COMPOSIO SPOTIFY TOOLKIT
 * ========================
 *
 * Comprehensive Spotify integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Playback (current track, play, pause, skip)
 * - Playlists (create, add tracks, list playlists)
 * - Podcasts (get episodes, show details)
 * - Search (search tracks, artists, albums)
 * - Library (saved tracks, albums, following)
 */

import { logger } from '@/lib/logger';

const log = logger('SpotifyToolkit');

// ============================================================================
// SPOTIFY ACTION CATEGORIES
// ============================================================================

export type SpotifyActionCategory = 'playback' | 'playlists' | 'podcasts' | 'search' | 'library';

export interface SpotifyAction {
  name: string; // Composio action name (e.g., SPOTIFY_SEARCH)
  label: string; // Human-readable label
  category: SpotifyActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Spotify connected)
// ============================================================================

const ESSENTIAL_ACTIONS: SpotifyAction[] = [
  // Search - Core
  {
    name: 'SPOTIFY_SEARCH',
    label: 'Search Spotify',
    category: 'search',
    priority: 1,
  },

  // Playback - Core
  {
    name: 'SPOTIFY_GET_CURRENT_TRACK',
    label: 'Get Current Track',
    category: 'playback',
    priority: 1,
  },
  {
    name: 'SPOTIFY_GET_PLAYBACK_STATE',
    label: 'Get Playback State',
    category: 'playback',
    priority: 1,
  },

  // Playlists - Core
  {
    name: 'SPOTIFY_GET_USER_PLAYLISTS',
    label: 'Get User Playlists',
    category: 'playlists',
    priority: 1,
  },
  {
    name: 'SPOTIFY_CREATE_PLAYLIST',
    label: 'Create Playlist',
    category: 'playlists',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SPOTIFY_ADD_TO_PLAYLIST',
    label: 'Add Tracks to Playlist',
    category: 'playlists',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: SpotifyAction[] = [
  // Playback - Extended
  {
    name: 'SPOTIFY_PLAY',
    label: 'Start Playback',
    category: 'playback',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SPOTIFY_PAUSE',
    label: 'Pause Playback',
    category: 'playback',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SPOTIFY_SKIP_NEXT',
    label: 'Skip to Next Track',
    category: 'playback',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SPOTIFY_SKIP_PREVIOUS',
    label: 'Skip to Previous Track',
    category: 'playback',
    priority: 2,
    writeOperation: true,
  },

  // Playlists - Extended
  {
    name: 'SPOTIFY_GET_PLAYLIST',
    label: 'Get Playlist Details',
    category: 'playlists',
    priority: 2,
  },
  {
    name: 'SPOTIFY_GET_PLAYLIST_TRACKS',
    label: 'Get Playlist Tracks',
    category: 'playlists',
    priority: 2,
  },

  // Library - Core
  {
    name: 'SPOTIFY_GET_SAVED_TRACKS',
    label: 'Get Saved Tracks',
    category: 'library',
    priority: 2,
  },
  {
    name: 'SPOTIFY_SAVE_TRACK',
    label: 'Save Track to Library',
    category: 'library',
    priority: 2,
    writeOperation: true,
  },

  // Podcasts - Core
  {
    name: 'SPOTIFY_GET_PODCAST_EPISODES',
    label: 'Get Podcast Episodes',
    category: 'podcasts',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: SpotifyAction[] = [
  // Playback - Extended
  {
    name: 'SPOTIFY_SET_VOLUME',
    label: 'Set Volume',
    category: 'playback',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SPOTIFY_SET_SHUFFLE',
    label: 'Toggle Shuffle',
    category: 'playback',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SPOTIFY_SET_REPEAT',
    label: 'Set Repeat Mode',
    category: 'playback',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SPOTIFY_GET_QUEUE',
    label: 'Get Playback Queue',
    category: 'playback',
    priority: 3,
  },
  {
    name: 'SPOTIFY_ADD_TO_QUEUE',
    label: 'Add to Queue',
    category: 'playback',
    priority: 3,
    writeOperation: true,
  },

  // Library - Extended
  {
    name: 'SPOTIFY_GET_SAVED_ALBUMS',
    label: 'Get Saved Albums',
    category: 'library',
    priority: 3,
  },
  {
    name: 'SPOTIFY_SAVE_ALBUM',
    label: 'Save Album to Library',
    category: 'library',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SPOTIFY_GET_TOP_TRACKS',
    label: 'Get Top Tracks',
    category: 'library',
    priority: 3,
  },
  {
    name: 'SPOTIFY_GET_TOP_ARTISTS',
    label: 'Get Top Artists',
    category: 'library',
    priority: 3,
  },

  // Podcasts - Extended
  {
    name: 'SPOTIFY_GET_SHOW_DETAILS',
    label: 'Get Podcast Show Details',
    category: 'podcasts',
    priority: 3,
  },
  {
    name: 'SPOTIFY_GET_SAVED_SHOWS',
    label: 'Get Saved Podcasts',
    category: 'podcasts',
    priority: 3,
  },

  // Playlists - Extended
  {
    name: 'SPOTIFY_UPDATE_PLAYLIST',
    label: 'Update Playlist Details',
    category: 'playlists',
    priority: 3,
    writeOperation: true,
  },

  // Search - Extended
  {
    name: 'SPOTIFY_GET_RECOMMENDATIONS',
    label: 'Get Recommendations',
    category: 'search',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: SpotifyAction[] = [
  // Playlists - Destructive
  {
    name: 'SPOTIFY_REMOVE_FROM_PLAYLIST',
    label: 'Remove from Playlist',
    category: 'playlists',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SPOTIFY_UNFOLLOW_PLAYLIST',
    label: 'Unfollow Playlist',
    category: 'playlists',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Library - Destructive
  {
    name: 'SPOTIFY_REMOVE_SAVED_TRACK',
    label: 'Remove Saved Track',
    category: 'library',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SPOTIFY_REMOVE_SAVED_ALBUM',
    label: 'Remove Saved Album',
    category: 'library',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Playback - Specialized
  {
    name: 'SPOTIFY_TRANSFER_PLAYBACK',
    label: 'Transfer Playback Device',
    category: 'playback',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SPOTIFY_GET_DEVICES',
    label: 'Get Available Devices',
    category: 'playback',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_SPOTIFY_ACTIONS: SpotifyAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getSpotifyFeaturedActionNames(): string[] {
  return ALL_SPOTIFY_ACTIONS.map((a) => a.name);
}

export function getSpotifyActionsByPriority(maxPriority: number = 3): SpotifyAction[] {
  return ALL_SPOTIFY_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getSpotifyActionNamesByPriority(maxPriority: number = 3): string[] {
  return getSpotifyActionsByPriority(maxPriority).map((a) => a.name);
}

export function getSpotifyActionsByCategory(category: SpotifyActionCategory): SpotifyAction[] {
  return ALL_SPOTIFY_ACTIONS.filter((a) => a.category === category);
}

export function getSpotifyActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_SPOTIFY_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownSpotifyAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SPOTIFY_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveSpotifyAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SPOTIFY_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Spotify action priority.
 * Known Spotify actions sorted by priority (1-4), unknown actions last.
 */
export function sortBySpotifyPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getSpotifyActionPriority(a.name) - getSpotifyActionPriority(b.name);
  });
}

export function getSpotifyActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_SPOTIFY_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_SPOTIFY_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Spotify-specific system prompt when user has Spotify connected.
 * Tells Claude exactly what it can do via the Composio Spotify toolkit.
 */
export function getSpotifySystemPrompt(): string {
  return `
## Spotify Integration (Full Capabilities)

You have **full Spotify access** through the user's connected account. Use the \`composio_SPOTIFY_*\` tools.

### Search & Discovery
- Search for tracks, artists, albums, playlists, and podcasts
- Get personalized recommendations based on seed tracks/artists
- View top tracks and top artists over different time ranges

### Playback Control
- Get the currently playing track and playback state
- Play, pause, skip forward/backward
- Set volume, toggle shuffle, set repeat mode
- View and add to the playback queue
- Transfer playback between devices
- Get available playback devices

### Playlists
- List user's playlists
- Create new playlists (public or private)
- Add tracks to playlists
- Get playlist details and track listings
- Update playlist name, description, and visibility
- Remove tracks from playlists (with confirmation)
- Unfollow playlists (with confirmation)

### Podcasts
- Get podcast episode listings
- View podcast show details
- Get saved/followed podcasts

### Library
- Get saved tracks and albums
- Save tracks and albums to library
- Remove saved tracks and albums (with confirmation)

### Safety Rules
1. **ALWAYS preview before modifying playlists** - show details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Spotify",
  "action": "Add to Playlist",
  "playlist": "Playlist Name",
  "tracks": ["Track 1", "Track 2"],
  "toolName": "composio_SPOTIFY_ADD_TO_PLAYLIST",
  "toolParams": { "playlist_id": "...", "uris": [...] }
}
\`\`\`
2. **Confirm before removing tracks** - show what will be removed and get explicit approval
3. **Never unfollow playlists without confirmation** - show the playlist details first
4. **For playback control**, indicate what action will be taken
5. **For playlist creation**, confirm name and visibility (public/private) before creating
6. **Show track details** when searching - include artist, album, and duration
7. **Handle premium-only features gracefully** - some playback controls require Spotify Premium
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getSpotifyCapabilitySummary(): string {
  const stats = getSpotifyActionStats();
  return `Spotify (${stats.total} actions: playback, playlists, podcasts, search, library)`;
}

export function logSpotifyToolkitStats(): void {
  const stats = getSpotifyActionStats();
  log.info('Spotify Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
