/**
 * COMPOSIO WORDPRESS TOOLKIT
 * ==========================
 *
 * Comprehensive WordPress integration via Composio's 24 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Posts (create, update, list, get, delete posts)
 * - Pages (create, update, list, get, delete pages)
 * - Media (upload, list, get, delete media)
 * - Comments (list, create, update, delete comments)
 * - Users (list, get users)
 * - Settings (get, update site settings)
 */

import { logger } from '@/lib/logger';

const log = logger('WordPressToolkit');

// ============================================================================
// WORDPRESS ACTION CATEGORIES
// ============================================================================

export type WordPressActionCategory =
  | 'posts'
  | 'pages'
  | 'media'
  | 'comments'
  | 'users'
  | 'settings';

export interface WordPressAction {
  name: string; // Composio action name (e.g., WORDPRESS_CREATE_POST)
  label: string; // Human-readable label
  category: WordPressActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when WordPress connected)
// ============================================================================

const ESSENTIAL_ACTIONS: WordPressAction[] = [
  // Posts - Core
  {
    name: 'WORDPRESS_CREATE_POST',
    label: 'Create Post',
    category: 'posts',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'WORDPRESS_GET_POSTS',
    label: 'List Posts',
    category: 'posts',
    priority: 1,
  },
  {
    name: 'WORDPRESS_GET_POST',
    label: 'Get Post',
    category: 'posts',
    priority: 1,
  },
  {
    name: 'WORDPRESS_UPDATE_POST',
    label: 'Update Post',
    category: 'posts',
    priority: 1,
    writeOperation: true,
  },

  // Pages - Core
  {
    name: 'WORDPRESS_CREATE_PAGE',
    label: 'Create Page',
    category: 'pages',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'WORDPRESS_GET_PAGES',
    label: 'List Pages',
    category: 'pages',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: WordPressAction[] = [
  // Media - Core
  {
    name: 'WORDPRESS_UPLOAD_MEDIA',
    label: 'Upload Media',
    category: 'media',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'WORDPRESS_GET_MEDIA',
    label: 'List Media',
    category: 'media',
    priority: 2,
  },
  {
    name: 'WORDPRESS_GET_MEDIA_ITEM',
    label: 'Get Media Item',
    category: 'media',
    priority: 2,
  },

  // Pages - Extended
  {
    name: 'WORDPRESS_GET_PAGE',
    label: 'Get Page',
    category: 'pages',
    priority: 2,
  },
  {
    name: 'WORDPRESS_UPDATE_PAGE',
    label: 'Update Page',
    category: 'pages',
    priority: 2,
    writeOperation: true,
  },

  // Comments - Core
  {
    name: 'WORDPRESS_GET_COMMENTS',
    label: 'List Comments',
    category: 'comments',
    priority: 2,
  },
  {
    name: 'WORDPRESS_CREATE_COMMENT',
    label: 'Create Comment',
    category: 'comments',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: WordPressAction[] = [
  // Users
  {
    name: 'WORDPRESS_GET_USERS',
    label: 'List Users',
    category: 'users',
    priority: 3,
  },
  {
    name: 'WORDPRESS_GET_USER',
    label: 'Get User',
    category: 'users',
    priority: 3,
  },
  {
    name: 'WORDPRESS_GET_CURRENT_USER',
    label: 'Get Current User',
    category: 'users',
    priority: 3,
  },

  // Settings
  {
    name: 'WORDPRESS_GET_SETTINGS',
    label: 'Get Site Settings',
    category: 'settings',
    priority: 3,
  },
  {
    name: 'WORDPRESS_UPDATE_SETTINGS',
    label: 'Update Site Settings',
    category: 'settings',
    priority: 3,
    writeOperation: true,
  },

  // Comments - Extended
  {
    name: 'WORDPRESS_UPDATE_COMMENT',
    label: 'Update Comment',
    category: 'comments',
    priority: 3,
    writeOperation: true,
  },

  // Posts - Extended
  {
    name: 'WORDPRESS_GET_POST_CATEGORIES',
    label: 'Get Categories',
    category: 'posts',
    priority: 3,
  },
  {
    name: 'WORDPRESS_GET_POST_TAGS',
    label: 'Get Tags',
    category: 'posts',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: WordPressAction[] = [
  // Posts - Destructive
  {
    name: 'WORDPRESS_DELETE_POST',
    label: 'Delete Post',
    category: 'posts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Pages - Destructive
  {
    name: 'WORDPRESS_DELETE_PAGE',
    label: 'Delete Page',
    category: 'pages',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Media - Destructive
  {
    name: 'WORDPRESS_DELETE_MEDIA',
    label: 'Delete Media',
    category: 'media',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Comments - Destructive
  {
    name: 'WORDPRESS_DELETE_COMMENT',
    label: 'Delete Comment',
    category: 'comments',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_WORDPRESS_ACTIONS: WordPressAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getWordPressFeaturedActionNames(): string[] {
  return ALL_WORDPRESS_ACTIONS.map((a) => a.name);
}

export function getWordPressActionsByPriority(maxPriority: number = 3): WordPressAction[] {
  return ALL_WORDPRESS_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getWordPressActionNamesByPriority(maxPriority: number = 3): string[] {
  return getWordPressActionsByPriority(maxPriority).map((a) => a.name);
}

export function getWordPressActionsByCategory(
  category: WordPressActionCategory
): WordPressAction[] {
  return ALL_WORDPRESS_ACTIONS.filter((a) => a.category === category);
}

export function getWordPressActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_WORDPRESS_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownWordPressAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_WORDPRESS_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveWordPressAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_WORDPRESS_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by WordPress action priority.
 * Known WordPress actions sorted by priority (1-4), unknown actions last.
 */
export function sortByWordPressPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getWordPressActionPriority(a.name) - getWordPressActionPriority(b.name);
  });
}

export function getWordPressActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_WORDPRESS_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_WORDPRESS_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate WordPress-specific system prompt when user has WordPress connected.
 * Tells Claude exactly what it can do via the Composio WordPress toolkit.
 */
export function getWordPressSystemPrompt(): string {
  return `
## WordPress Integration (Full Capabilities)

You have **full WordPress access** through the user's connected site. Use the \`composio_WORDPRESS_*\` tools.

### Posts
- Create new blog posts with title, content, status (draft/publish), categories, and tags
- List all posts with filtering and pagination
- Get individual post details
- Update existing posts (content, status, categories, tags)
- Delete posts (with confirmation)

### Pages
- Create new pages with title, content, and status
- List all pages with filtering
- Get individual page details
- Update existing pages
- Delete pages (with confirmation)

### Media
- Upload images, videos, and files to the media library
- List all media items with filtering
- Get individual media item details and URLs
- Delete media items (with confirmation)

### Comments
- List comments on posts with filtering and pagination
- Create new comments on posts
- Update existing comments (content, status)
- Delete comments (with confirmation)

### Users
- List all site users with role filtering
- Get individual user details
- Get current authenticated user profile

### Site Settings
- Get site settings (title, description, URL, timezone, etc.)
- Update site settings

### Safety Rules
1. **ALWAYS preview before publishing** - show post/page details using the action-preview format:
\`\`\`action-preview
{
  "platform": "WordPress",
  "action": "Create Post",
  "title": "Post title...",
  "status": "draft",
  "toolName": "composio_WORDPRESS_CREATE_POST",
  "toolParams": { "title": "...", "content": "...", "status": "draft" }
}
\`\`\`
2. **Default to draft status** - never publish directly without explicit user approval
3. **Confirm before deleting** - always show what will be deleted and get explicit approval
4. **Verify media uploads** - confirm file type and size before uploading
5. **Preview content changes** - show before/after for updates to existing content
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getWordPressCapabilitySummary(): string {
  const stats = getWordPressActionStats();
  return `WordPress (${stats.total} actions: posts, pages, media, comments, users, settings)`;
}

export function logWordPressToolkitStats(): void {
  const stats = getWordPressActionStats();
  log.info('WordPress Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
