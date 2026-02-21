/**
 * COMPOSIO CONFLUENCE TOOLKIT
 * ============================
 *
 * Comprehensive Confluence integration via Composio's tools.
 *
 * Categories:
 * - Pages (create, get, update, delete, search, list)
 * - Spaces (list, get, create)
 * - Comments (add, list, get)
 * - Labels (add, remove, list)
 * - Attachments (upload, list, get)
 * - Users (get, list)
 */

import { logger } from '@/lib/logger';

const log = logger('ConfluenceToolkit');

export type ConfluenceActionCategory =
  | 'pages'
  | 'spaces'
  | 'comments'
  | 'labels'
  | 'attachments'
  | 'users';

export interface ConfluenceAction {
  name: string;
  label: string;
  category: ConfluenceActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: ConfluenceAction[] = [
  {
    name: 'CONFLUENCE_CREATE_PAGE',
    label: 'Create Page',
    category: 'pages',
    priority: 1,
    writeOperation: true,
  },
  { name: 'CONFLUENCE_GET_PAGE', label: 'Get Page', category: 'pages', priority: 1 },
  {
    name: 'CONFLUENCE_UPDATE_PAGE',
    label: 'Update Page',
    category: 'pages',
    priority: 1,
    writeOperation: true,
  },
  { name: 'CONFLUENCE_SEARCH', label: 'Search Content', category: 'pages', priority: 1 },
  { name: 'CONFLUENCE_LIST_SPACES', label: 'List Spaces', category: 'spaces', priority: 1 },
  { name: 'CONFLUENCE_GET_SPACE', label: 'Get Space', category: 'spaces', priority: 1 },
];

const IMPORTANT_ACTIONS: ConfluenceAction[] = [
  { name: 'CONFLUENCE_LIST_PAGES', label: 'List Pages', category: 'pages', priority: 2 },
  {
    name: 'CONFLUENCE_ADD_COMMENT',
    label: 'Add Comment',
    category: 'comments',
    priority: 2,
    writeOperation: true,
  },
  { name: 'CONFLUENCE_LIST_COMMENTS', label: 'List Comments', category: 'comments', priority: 2 },
  {
    name: 'CONFLUENCE_ADD_LABEL',
    label: 'Add Label',
    category: 'labels',
    priority: 2,
    writeOperation: true,
  },
  { name: 'CONFLUENCE_LIST_LABELS', label: 'List Labels', category: 'labels', priority: 2 },
  {
    name: 'CONFLUENCE_GET_PAGE_CHILDREN',
    label: 'Get Page Children',
    category: 'pages',
    priority: 2,
  },
  {
    name: 'CONFLUENCE_LIST_ATTACHMENTS',
    label: 'List Attachments',
    category: 'attachments',
    priority: 2,
  },
];

const USEFUL_ACTIONS: ConfluenceAction[] = [
  {
    name: 'CONFLUENCE_CREATE_SPACE',
    label: 'Create Space',
    category: 'spaces',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'CONFLUENCE_UPLOAD_ATTACHMENT',
    label: 'Upload Attachment',
    category: 'attachments',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'CONFLUENCE_GET_ATTACHMENT',
    label: 'Get Attachment',
    category: 'attachments',
    priority: 3,
  },
  {
    name: 'CONFLUENCE_REMOVE_LABEL',
    label: 'Remove Label',
    category: 'labels',
    priority: 3,
    writeOperation: true,
  },
  { name: 'CONFLUENCE_GET_COMMENT', label: 'Get Comment', category: 'comments', priority: 3 },
  {
    name: 'CONFLUENCE_GET_PAGE_HISTORY',
    label: 'Get Page History',
    category: 'pages',
    priority: 3,
  },
];

const ADVANCED_ACTIONS: ConfluenceAction[] = [
  {
    name: 'CONFLUENCE_DELETE_PAGE',
    label: 'Delete Page',
    category: 'pages',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'CONFLUENCE_MOVE_PAGE',
    label: 'Move Page',
    category: 'pages',
    priority: 4,
    writeOperation: true,
  },
  { name: 'CONFLUENCE_LIST_USERS', label: 'List Users', category: 'users', priority: 4 },
  { name: 'CONFLUENCE_GET_USER', label: 'Get User', category: 'users', priority: 4 },
  {
    name: 'CONFLUENCE_DELETE_ATTACHMENT',
    label: 'Delete Attachment',
    category: 'attachments',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

export const ALL_CONFLUENCE_ACTIONS: ConfluenceAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getConfluenceFeaturedActionNames(): string[] {
  return ALL_CONFLUENCE_ACTIONS.map((a) => a.name);
}
export function getConfluenceActionsByPriority(maxPriority: number = 3): ConfluenceAction[] {
  return ALL_CONFLUENCE_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getConfluenceActionNamesByPriority(maxPriority: number = 3): string[] {
  return getConfluenceActionsByPriority(maxPriority).map((a) => a.name);
}
export function getConfluenceActionsByCategory(
  category: ConfluenceActionCategory
): ConfluenceAction[] {
  return ALL_CONFLUENCE_ACTIONS.filter((a) => a.category === category);
}
export function getConfluenceActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_CONFLUENCE_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownConfluenceAction(toolName: string): boolean {
  return ALL_CONFLUENCE_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveConfluenceAction(toolName: string): boolean {
  return (
    ALL_CONFLUENCE_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))
      ?.destructive === true
  );
}
export function sortByConfluencePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getConfluenceActionPriority(a.name) - getConfluenceActionPriority(b.name)
  );
}

export function getConfluenceActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_CONFLUENCE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_CONFLUENCE_ACTIONS.length, byPriority, byCategory };
}

export function getConfluenceSystemPrompt(): string {
  return `
## Confluence Integration (Full Capabilities)

You have **full Confluence access** through the user's connected account. Use the \`composio_CONFLUENCE_*\` tools.

### Pages
- Create pages with rich content (wiki markup or storage format)
- Get page details, content, and metadata
- Update page content and properties
- Search across all pages with CQL (Confluence Query Language)
- View page children and hierarchy
- View page version history

### Spaces
- List all spaces in the Confluence instance
- Get space details and homepage
- Create new spaces for team organization

### Comments, Labels & Attachments
- Add comments and discussions to pages
- Manage labels for page categorization
- Upload, list, and download file attachments

### Safety Rules
1. **ALWAYS confirm before creating/updating pages** - show space, title, and content preview
2. **Confirm before deleting pages** - deletion removes all child pages too
3. **For space creation**, confirm the space key and name
4. **Handle wiki content carefully** - preserve existing formatting when updating
`;
}

export function getConfluenceCapabilitySummary(): string {
  const stats = getConfluenceActionStats();
  return `Confluence (${stats.total} actions: pages, spaces, comments, labels, attachments)`;
}

export function logConfluenceToolkitStats(): void {
  const stats = getConfluenceActionStats();
  log.info('Confluence Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
