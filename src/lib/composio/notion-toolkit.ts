/**
 * COMPOSIO NOTION TOOLKIT
 * =======================
 *
 * Comprehensive Notion integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Pages (create, get, update, archive, search)
 * - Databases (create, query, get, update)
 * - Blocks (get, update, append, delete, list children)
 * - Users (list, get)
 * - Comments (create, list)
 * - Search (search all)
 */

import { logger } from '@/lib/logger';

const log = logger('NotionToolkit');

// ============================================================================
// NOTION ACTION CATEGORIES
// ============================================================================

export type NotionActionCategory =
  | 'pages'
  | 'databases'
  | 'blocks'
  | 'users'
  | 'comments'
  | 'search';

export interface NotionAction {
  name: string;
  label: string;
  category: NotionActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Notion connected)
// ============================================================================

const ESSENTIAL_ACTIONS: NotionAction[] = [
  // Pages
  {
    name: 'NOTION_CREATE_PAGE',
    label: 'Create Page',
    category: 'pages',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'NOTION_GET_PAGE',
    label: 'Get Page',
    category: 'pages',
    priority: 1,
  },
  {
    name: 'NOTION_UPDATE_PAGE',
    label: 'Update Page',
    category: 'pages',
    priority: 1,
    writeOperation: true,
  },

  // Databases
  {
    name: 'NOTION_QUERY_DATABASE',
    label: 'Query Database',
    category: 'databases',
    priority: 1,
  },
  {
    name: 'NOTION_GET_DATABASE',
    label: 'Get Database',
    category: 'databases',
    priority: 1,
  },

  // Search
  {
    name: 'NOTION_SEARCH',
    label: 'Search',
    category: 'search',
    priority: 1,
  },

  // Blocks
  {
    name: 'NOTION_APPEND_BLOCK_CHILDREN',
    label: 'Append Block Children',
    category: 'blocks',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'NOTION_GET_BLOCK',
    label: 'Get Block',
    category: 'blocks',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: NotionAction[] = [
  {
    name: 'NOTION_CREATE_DATABASE',
    label: 'Create Database',
    category: 'databases',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'NOTION_UPDATE_DATABASE',
    label: 'Update Database',
    category: 'databases',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'NOTION_LIST_BLOCK_CHILDREN',
    label: 'List Block Children',
    category: 'blocks',
    priority: 2,
  },
  {
    name: 'NOTION_UPDATE_BLOCK',
    label: 'Update Block',
    category: 'blocks',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'NOTION_CREATE_COMMENT',
    label: 'Create Comment',
    category: 'comments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'NOTION_LIST_COMMENTS',
    label: 'List Comments',
    category: 'comments',
    priority: 2,
  },
  {
    name: 'NOTION_GET_PAGE_PROPERTY',
    label: 'Get Page Property',
    category: 'pages',
    priority: 2,
  },
  {
    name: 'NOTION_LIST_USERS',
    label: 'List Users',
    category: 'users',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: NotionAction[] = [
  {
    name: 'NOTION_ARCHIVE_PAGE',
    label: 'Archive Page',
    category: 'pages',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'NOTION_RESTORE_PAGE',
    label: 'Restore Page',
    category: 'pages',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'NOTION_GET_USER',
    label: 'Get User',
    category: 'users',
    priority: 3,
  },
  {
    name: 'NOTION_GET_SELF',
    label: 'Get Self',
    category: 'users',
    priority: 3,
  },
  {
    name: 'NOTION_LIST_ALL_DATABASES',
    label: 'List All Databases',
    category: 'databases',
    priority: 3,
  },
  {
    name: 'NOTION_LIST_ALL_PAGES',
    label: 'List All Pages',
    category: 'pages',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Specialized operations)
// ============================================================================

const ADVANCED_ACTIONS: NotionAction[] = [
  {
    name: 'NOTION_DELETE_BLOCK',
    label: 'Delete Block',
    category: 'blocks',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'NOTION_DUPLICATE_PAGE',
    label: 'Duplicate Page',
    category: 'pages',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'NOTION_GET_PAGE_CONTENT',
    label: 'Get Page Content',
    category: 'pages',
    priority: 4,
  },
  {
    name: 'NOTION_CREATE_PAGE_IN_DATABASE',
    label: 'Create Page in Database',
    category: 'databases',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_NOTION_ACTIONS: NotionAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getNotionFeaturedActionNames(): string[] {
  return ALL_NOTION_ACTIONS.map((a) => a.name);
}

export function getNotionActionsByPriority(maxPriority: number = 3): NotionAction[] {
  return ALL_NOTION_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getNotionActionNamesByPriority(maxPriority: number = 3): string[] {
  return getNotionActionsByPriority(maxPriority).map((a) => a.name);
}

export function getNotionActionsByCategory(category: NotionActionCategory): NotionAction[] {
  return ALL_NOTION_ACTIONS.filter((a) => a.category === category);
}

export function getNotionActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_NOTION_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownNotionAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_NOTION_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveNotionAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_NOTION_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

export function sortByNotionPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getNotionActionPriority(a.name) - getNotionActionPriority(b.name);
  });
}

export function getNotionActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_NOTION_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_NOTION_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export function getNotionSystemPrompt(): string {
  return `
## Notion Integration (Full Capabilities)

You have **full Notion access** through the user's connected account. Use the \`composio_NOTION_*\` tools.

### Pages
- Create new pages with rich content (text, headings, lists, code blocks)
- Get page details including properties and metadata
- Update page properties and content
- Archive and restore pages
- Search across all pages

### Databases
- Create databases with custom schemas and properties
- Query databases with filters, sorts, and pagination
- Get database schema and properties
- Update database titles and properties
- Add new entries (pages) to databases

### Blocks
- Get block content by ID
- List child blocks of a page or block
- Append new content blocks to pages
- Update existing block content
- Delete blocks (with confirmation)

### Users & Comments
- List workspace users and their details
- Get specific user information
- Create comments on pages or blocks
- List existing comments and discussions

### Safety Rules
1. **ALWAYS confirm before creating pages** - show the parent, title, and content preview:
\`\`\`action-preview
{
  "platform": "Notion",
  "action": "Create Page",
  "parent": "Parent page/database",
  "title": "Page title here",
  "toolName": "composio_NOTION_CREATE_PAGE",
  "toolParams": { "parent": "...", "properties": { "title": "..." } }
}
\`\`\`
2. **Confirm before archiving pages** - archived pages can be restored but may disrupt workflows
3. **Never delete blocks without explicit approval** - deletion is permanent
4. **Confirm before updating database schemas** - changes affect all entries
5. **For batch operations**, summarize what will happen and get explicit approval
`;
}

export function getNotionCapabilitySummary(): string {
  const stats = getNotionActionStats();
  return `Notion (${stats.total} actions: pages, databases, blocks, users, comments, search)`;
}

export function logNotionToolkitStats(): void {
  const stats = getNotionActionStats();
  log.info('Notion Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
