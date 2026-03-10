/**
 * COMPOSIO BOX TOOLKIT
 * =====================
 *
 * Comprehensive Box integration via Composio's tools.
 *
 * Categories:
 * - Files (upload, download, search, copy, move)
 * - Folders (create, list, get, update)
 * - Sharing (create links, collaborators)
 * - Comments (add, list)
 * - Users (get, list)
 */

import { logger } from '@/lib/logger';

const log = logger('BoxToolkit');

export type BoxActionCategory = 'files' | 'folders' | 'sharing' | 'comments' | 'users';

export interface BoxAction {
  name: string;
  label: string;
  category: BoxActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: BoxAction[] = [
  {
    name: 'BOX_UPLOAD_FILE',
    label: 'Upload File',
    category: 'files',
    priority: 1,
    writeOperation: true,
  },
  { name: 'BOX_DOWNLOAD_FILE', label: 'Download File', category: 'files', priority: 1 },
  { name: 'BOX_SEARCH_FILES', label: 'Search Files', category: 'files', priority: 1 },
  { name: 'BOX_LIST_FOLDER', label: 'List Folder Contents', category: 'folders', priority: 1 },
  {
    name: 'BOX_CREATE_FOLDER',
    label: 'Create Folder',
    category: 'folders',
    priority: 1,
    writeOperation: true,
  },
  { name: 'BOX_GET_FILE_INFO', label: 'Get File Info', category: 'files', priority: 1 },
];

const IMPORTANT_ACTIONS: BoxAction[] = [
  {
    name: 'BOX_COPY_FILE',
    label: 'Copy File',
    category: 'files',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'BOX_MOVE_FILE',
    label: 'Move File',
    category: 'files',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'BOX_CREATE_SHARED_LINK',
    label: 'Create Shared Link',
    category: 'sharing',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'BOX_ADD_COLLABORATOR',
    label: 'Add Collaborator',
    category: 'sharing',
    priority: 2,
    writeOperation: true,
  },
  { name: 'BOX_GET_FOLDER_INFO', label: 'Get Folder Info', category: 'folders', priority: 2 },
];

const USEFUL_ACTIONS: BoxAction[] = [
  {
    name: 'BOX_UPDATE_FILE',
    label: 'Update File',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'BOX_ADD_COMMENT',
    label: 'Add Comment',
    category: 'comments',
    priority: 3,
    writeOperation: true,
  },
  { name: 'BOX_LIST_COMMENTS', label: 'List Comments', category: 'comments', priority: 3 },
  { name: 'BOX_LIST_COLLABORATORS', label: 'List Collaborators', category: 'sharing', priority: 3 },
  { name: 'BOX_GET_CURRENT_USER', label: 'Get Current User', category: 'users', priority: 3 },
  {
    name: 'BOX_UPDATE_FOLDER',
    label: 'Update Folder',
    category: 'folders',
    priority: 3,
    writeOperation: true,
  },
];

const ADVANCED_ACTIONS: BoxAction[] = [
  {
    name: 'BOX_DELETE_FILE',
    label: 'Delete File',
    category: 'files',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'BOX_DELETE_FOLDER',
    label: 'Delete Folder',
    category: 'folders',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'BOX_REMOVE_COLLABORATOR',
    label: 'Remove Collaborator',
    category: 'sharing',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  { name: 'BOX_LIST_USERS', label: 'List Users', category: 'users', priority: 4 },
];

export const ALL_BOX_ACTIONS: BoxAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getBoxFeaturedActionNames(): string[] {
  return ALL_BOX_ACTIONS.map((a) => a.name);
}
export function getBoxActionsByPriority(maxPriority: number = 3): BoxAction[] {
  return ALL_BOX_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getBoxActionNamesByPriority(maxPriority: number = 3): string[] {
  return getBoxActionsByPriority(maxPriority).map((a) => a.name);
}
export function getBoxActionsByCategory(category: BoxActionCategory): BoxAction[] {
  return ALL_BOX_ACTIONS.filter((a) => a.category === category);
}
export function getBoxActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_BOX_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownBoxAction(toolName: string): boolean {
  return ALL_BOX_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveBoxAction(toolName: string): boolean {
  return (
    ALL_BOX_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive === true
  );
}
export function sortByBoxPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => getBoxActionPriority(a.name) - getBoxActionPriority(b.name));
}

export function getBoxActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_BOX_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_BOX_ACTIONS.length, byPriority, byCategory };
}

export function getBoxSystemPrompt(): string {
  return `
## Box Integration (Full Capabilities)

You have **full Box access** through the user's connected account. Use the \`composio_BOX_*\` tools.

### Files
- Upload, download, search, copy, and move files
- Get file metadata and version info
- Update file content and properties

### Folders
- Create, list, and manage folders
- Navigate folder hierarchy

### Sharing & Collaboration
- Create shared links for files and folders
- Add and manage collaborators with role-based access

### Comments
- Add comments to files for discussion
- View comment threads

### Safety Rules
1. **Confirm before deleting files or folders** - deletion may be permanent
2. **Confirm before sharing externally** - show who will have access
3. **For bulk operations**, show the list of affected items first
`;
}

export function getBoxCapabilitySummary(): string {
  const stats = getBoxActionStats();
  return `Box (${stats.total} actions: files, folders, sharing, comments, users)`;
}

export function logBoxToolkitStats(): void {
  const stats = getBoxActionStats();
  log.info('Box Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
