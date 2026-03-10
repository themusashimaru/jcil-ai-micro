/**
 * COMPOSIO DROPBOX TOOLKIT
 * ========================
 *
 * Comprehensive Dropbox integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Files (list, upload, download, search, move, copy, delete, metadata)
 * - Folders (create, list, move, copy, delete)
 * - Sharing (shared links, folder sharing, members)
 * - Account (info, space usage)
 */

import { logger } from '@/lib/logger';

const log = logger('DropboxToolkit');

// ============================================================================
// DROPBOX ACTION CATEGORIES
// ============================================================================

export type DropboxActionCategory = 'files' | 'folders' | 'sharing' | 'account';

export interface DropboxAction {
  name: string; // Composio action name (e.g., DROPBOX_LIST_FILES)
  label: string; // Human-readable label
  category: DropboxActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Dropbox connected)
// ============================================================================

const ESSENTIAL_ACTIONS: DropboxAction[] = [
  // Files - Core
  {
    name: 'DROPBOX_LIST_FILES',
    label: 'List Files',
    category: 'files',
    priority: 1,
  },
  {
    name: 'DROPBOX_GET_FILE_METADATA',
    label: 'Get File Metadata',
    category: 'files',
    priority: 1,
  },
  {
    name: 'DROPBOX_UPLOAD_FILE',
    label: 'Upload File',
    category: 'files',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'DROPBOX_DOWNLOAD_FILE',
    label: 'Download File',
    category: 'files',
    priority: 1,
  },
  {
    name: 'DROPBOX_SEARCH_FILES',
    label: 'Search Files',
    category: 'files',
    priority: 1,
  },

  // Folders - Core
  {
    name: 'DROPBOX_CREATE_FOLDER',
    label: 'Create Folder',
    category: 'folders',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: DropboxAction[] = [
  // Files - Extended
  {
    name: 'DROPBOX_MOVE_FILE',
    label: 'Move File',
    category: 'files',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'DROPBOX_COPY_FILE',
    label: 'Copy File',
    category: 'files',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'DROPBOX_DELETE_FILE',
    label: 'Delete File',
    category: 'files',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'DROPBOX_GET_PREVIEW',
    label: 'Get Preview',
    category: 'files',
    priority: 2,
  },

  // Sharing
  {
    name: 'DROPBOX_CREATE_SHARED_LINK',
    label: 'Create Shared Link',
    category: 'sharing',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'DROPBOX_LIST_SHARED_LINKS',
    label: 'List Shared Links',
    category: 'sharing',
    priority: 2,
  },

  // Folders - Extended
  {
    name: 'DROPBOX_LIST_FOLDER',
    label: 'List Folder',
    category: 'folders',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: DropboxAction[] = [
  // Folders - Extended
  {
    name: 'DROPBOX_DELETE_FOLDER',
    label: 'Delete Folder',
    category: 'folders',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'DROPBOX_MOVE_FOLDER',
    label: 'Move Folder',
    category: 'folders',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'DROPBOX_COPY_FOLDER',
    label: 'Copy Folder',
    category: 'folders',
    priority: 3,
    writeOperation: true,
  },

  // Sharing - Extended
  {
    name: 'DROPBOX_SHARE_FOLDER',
    label: 'Share Folder',
    category: 'sharing',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'DROPBOX_LIST_FOLDER_MEMBERS',
    label: 'List Folder Members',
    category: 'sharing',
    priority: 3,
  },

  // Account
  {
    name: 'DROPBOX_GET_ACCOUNT_INFO',
    label: 'Get Account Info',
    category: 'account',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: DropboxAction[] = [
  {
    name: 'DROPBOX_REVOKE_SHARED_LINK',
    label: 'Revoke Shared Link',
    category: 'sharing',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'DROPBOX_PERMANENTLY_DELETE',
    label: 'Permanently Delete',
    category: 'files',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'DROPBOX_LIST_REVISIONS',
    label: 'List Revisions',
    category: 'files',
    priority: 4,
  },
  {
    name: 'DROPBOX_RESTORE_FILE',
    label: 'Restore File',
    category: 'files',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'DROPBOX_GET_SPACE_USAGE',
    label: 'Get Space Usage',
    category: 'account',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_DROPBOX_ACTIONS: DropboxAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getDropboxFeaturedActionNames(): string[] {
  return ALL_DROPBOX_ACTIONS.map((a) => a.name);
}

export function getDropboxActionsByPriority(maxPriority: number = 3): DropboxAction[] {
  return ALL_DROPBOX_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getDropboxActionNamesByPriority(maxPriority: number = 3): string[] {
  return getDropboxActionsByPriority(maxPriority).map((a) => a.name);
}

export function getDropboxActionsByCategory(category: DropboxActionCategory): DropboxAction[] {
  return ALL_DROPBOX_ACTIONS.filter((a) => a.category === category);
}

export function getDropboxActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_DROPBOX_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownDropboxAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_DROPBOX_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveDropboxAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_DROPBOX_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Dropbox action priority.
 * Known Dropbox actions sorted by priority (1-4), unknown actions last.
 */
export function sortByDropboxPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getDropboxActionPriority(a.name) - getDropboxActionPriority(b.name);
  });
}

export function getDropboxActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_DROPBOX_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_DROPBOX_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Dropbox-specific system prompt when user has Dropbox connected.
 * Tells Claude exactly what it can do via the Composio Dropbox toolkit.
 */
export function getDropboxSystemPrompt(): string {
  return `
## Dropbox Integration (Full Capabilities)

You have **full Dropbox access** through the user's connected account. Use the \`composio_DROPBOX_*\` tools.

### File Management
- List files and browse directory contents
- Upload files to any path in the user's Dropbox
- Download files from the user's Dropbox
- Search across all files by name or content
- Get file metadata (size, modified date, path, etc.)
- Get file previews for supported formats
- Move or copy files between locations
- View file revision history and restore previous versions

### Folder Operations
- Create new folders at any path
- List folder contents with detailed metadata
- Move or copy entire folders between locations
- Delete folders and their contents

### Sharing
- Create shared links for files and folders
- List all existing shared links
- Share folders with other users
- View folder membership and access levels
- Revoke shared links to remove external access

### Account
- View account information and profile details
- Check storage space usage and quota

### Safety Rules
1. **ALWAYS confirm before deleting files or folders** - show the full path and contents that will be affected:
\`\`\`action-preview
{
  "platform": "Dropbox",
  "action": "Delete File",
  "path": "/path/to/file.ext",
  "toolName": "composio_DROPBOX_DELETE_FILE",
  "toolParams": { "path": "..." }
}
\`\`\`
2. **Confirm before permanent deletion** - permanent deletes cannot be recovered, always warn the user explicitly
3. **Confirm before revoking shared links** - revoking a shared link will break access for anyone using it, show the link and associated file details first
4. **Show move/copy details before executing** - display source path, destination path, and confirm the operation
5. **For folder deletions**, list the folder contents first so the user understands what will be removed
6. **For sharing operations**, clearly show who will gain access and what permissions they will receive
7. **For bulk operations**, summarize all affected files/folders and get explicit approval
8. **Handle file paths carefully** - always double-check paths to avoid overwriting or deleting the wrong files
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getDropboxCapabilitySummary(): string {
  const stats = getDropboxActionStats();
  return `Dropbox (${stats.total} actions: files, folders, sharing, account)`;
}

export function logDropboxToolkitStats(): void {
  const stats = getDropboxActionStats();
  log.info('Dropbox Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
