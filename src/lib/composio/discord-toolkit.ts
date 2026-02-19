/**
 * COMPOSIO DISCORD TOOLKIT
 * ========================
 *
 * Read-only Discord integration via Composio's 15 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Users (user profiles, connections, OIDC info)
 * - Guilds (servers, members, invites, widgets, templates, stickers)
 * - Auth (OAuth2, public keys, entitlements)
 */

import { logger } from '@/lib/logger';

const log = logger('DiscordToolkit');

// ============================================================================
// DISCORD ACTION CATEGORIES
// ============================================================================

export type DiscordActionCategory = 'users' | 'guilds' | 'auth';

export interface DiscordAction {
  name: string; // Composio action name (e.g., DISCORD_GET_MY_USER)
  label: string; // Human-readable label
  category: DiscordActionCategory;
  priority: number; // 1 = highest (always include), 3 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Discord connected)
// ============================================================================

const ESSENTIAL_ACTIONS: DiscordAction[] = [
  // Users - Core
  {
    name: 'DISCORD_GET_MY_USER',
    label: 'Get My Profile',
    category: 'users',
    priority: 1,
  },

  // Guilds - Core
  {
    name: 'DISCORD_LIST_MY_GUILDS',
    label: 'List My Servers',
    category: 'guilds',
    priority: 1,
  },

  // Users - Lookup
  {
    name: 'DISCORD_GET_USER',
    label: 'Get User Info',
    category: 'users',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: DiscordAction[] = [
  // Guilds - Members & Invites
  {
    name: 'DISCORD_GET_MY_GUILD_MEMBER',
    label: 'Get My Guild Member',
    category: 'guilds',
    priority: 2,
  },
  {
    name: 'DISCORD_GET_INVITE',
    label: 'Get Invite Info',
    category: 'guilds',
    priority: 2,
  },
  {
    name: 'DISCORD_INVITE_RESOLVE',
    label: 'Resolve Invite',
    category: 'guilds',
    priority: 2,
  },

  // Users - Connections
  {
    name: 'DISCORD_LIST_MY_CONNECTIONS',
    label: 'List My Connections',
    category: 'users',
    priority: 2,
  },

  // Guilds - Widgets
  {
    name: 'DISCORD_GET_GUILD_WIDGET',
    label: 'Get Guild Widget',
    category: 'guilds',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: DiscordAction[] = [
  // Guilds - Extended
  {
    name: 'DISCORD_GET_GUILD_TEMPLATE',
    label: 'Get Guild Template',
    category: 'guilds',
    priority: 3,
  },
  {
    name: 'DISCORD_GET_GUILD_WIDGET_PNG',
    label: 'Get Guild Widget Image',
    category: 'guilds',
    priority: 3,
  },

  // Auth
  {
    name: 'DISCORD_GET_MY_OAUTH2_AUTHORIZATION',
    label: 'Get OAuth2 Auth',
    category: 'auth',
    priority: 3,
  },

  // Users - Extended
  {
    name: 'DISCORD_GET_OPENID_CONNECT_USERINFO',
    label: 'Get OIDC User Info',
    category: 'users',
    priority: 3,
  },

  // Auth - Extended
  {
    name: 'DISCORD_GET_PUBLIC_KEYS',
    label: 'Get Public Keys',
    category: 'auth',
    priority: 3,
  },
  {
    name: 'DISCORD_GET_CURRENT_USER_APPLICATION_ENTITLEMENTS',
    label: 'Get Entitlements',
    category: 'auth',
    priority: 3,
  },

  // Guilds - Stickers
  {
    name: 'DISCORD_LIST_STICKER_PACKS',
    label: 'List Sticker Packs',
    category: 'guilds',
    priority: 3,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_DISCORD_ACTIONS: DiscordAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getDiscordFeaturedActionNames(): string[] {
  return ALL_DISCORD_ACTIONS.map((a) => a.name);
}

export function getDiscordActionsByPriority(maxPriority: number = 3): DiscordAction[] {
  return ALL_DISCORD_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getDiscordActionNamesByPriority(maxPriority: number = 3): string[] {
  return getDiscordActionsByPriority(maxPriority).map((a) => a.name);
}

export function getDiscordActionsByCategory(category: DiscordActionCategory): DiscordAction[] {
  return ALL_DISCORD_ACTIONS.filter((a) => a.category === category);
}

export function getDiscordActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_DISCORD_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownDiscordAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_DISCORD_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveDiscordAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_DISCORD_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Discord action priority.
 * Known Discord actions sorted by priority (1-3), unknown actions last.
 */
export function sortByDiscordPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getDiscordActionPriority(a.name) - getDiscordActionPriority(b.name);
  });
}

export function getDiscordActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_DISCORD_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_DISCORD_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Discord-specific system prompt when user has Discord connected.
 * Tells Claude exactly what it can do via the Composio Discord toolkit.
 */
export function getDiscordSystemPrompt(): string {
  return `
## Discord Integration (Read-Only)

You have **limited read-only Discord access** through the user's connected account. Use the \`composio_DISCORD_*\` tools.

### User Profiles
- Get your own Discord profile (username, avatar, discriminator, etc.)
- Look up other users by ID
- List your connected accounts (Twitch, GitHub, Spotify, etc.)
- Get OpenID Connect user information

### Servers (Guilds)
- List all servers you're a member of
- Get your member info within a specific guild (roles, nickname, join date)
- Look up invite details and resolve invite codes
- Get guild widget data and widget images (PNG)
- Get guild templates
- Browse available sticker packs

### Auth & Metadata
- View your current OAuth2 authorization details
- Get Discord public keys
- List your application entitlements

### Safety Rules
1. **All operations are read-only** - no messages can be sent, no servers modified, no settings changed
2. **User data is sensitive** - do not expose user IDs, discriminators, or connection details unless the user explicitly asks
3. **Server listings may be large** - summarize when appropriate rather than listing all servers
4. **Invite codes** - do not share or expose invite codes unless the user explicitly requests them
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getDiscordCapabilitySummary(): string {
  const stats = getDiscordActionStats();
  return `Discord (${stats.total} actions: read-only user profiles, servers, connections, invites)`;
}

export function logDiscordToolkitStats(): void {
  const stats = getDiscordActionStats();
  log.info('Discord Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    categories: stats.byCategory,
  });
}
