/**
 * COMPOSIO GOOGLE DRIVE TOOLKIT
 * ==============================
 *
 * Comprehensive Google Drive integration via Composio's 59 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Files (search, list, create, upload, download, copy, move, revisions, labels)
 * - Sharing (permissions, access proposals, approvals)
 * - Drives (shared drives, membership)
 * - Collaboration (comments, replies)
 * - Account (drive info)
 */

import { logger } from '@/lib/logger';

const log = logger('GoogleDriveToolkit');

// ============================================================================
// GOOGLE DRIVE ACTION CATEGORIES
// ============================================================================

export type GoogleDriveActionCategory =
  | 'files'
  | 'sharing'
  | 'drives'
  | 'collaboration'
  | 'account';

export interface GoogleDriveAction {
  name: string; // Composio action name (e.g., GOOGLEDRIVE_FIND_FILE)
  label: string; // Human-readable label
  category: GoogleDriveActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Google Drive connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GoogleDriveAction[] = [
  // Files - Core
  { name: 'GOOGLEDRIVE_FIND_FILE', label: 'Search Files', category: 'files', priority: 1 },
  { name: 'GOOGLEDRIVE_FIND_FOLDER', label: 'Search Folders', category: 'files', priority: 1 },
  { name: 'GOOGLEDRIVE_LIST_FILES', label: 'List Files', category: 'files', priority: 1 },
  {
    name: 'GOOGLEDRIVE_GET_FILE_METADATA',
    label: 'Get File Metadata',
    category: 'files',
    priority: 1,
  },
  {
    name: 'GOOGLEDRIVE_CREATE_FILE',
    label: 'Create File',
    category: 'files',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_CREATE_FILE_FROM_TEXT',
    label: 'Create File from Text',
    category: 'files',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_CREATE_FOLDER',
    label: 'Create Folder',
    category: 'files',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_UPLOAD_FILE',
    label: 'Upload File',
    category: 'files',
    priority: 1,
    writeOperation: true,
  },
  { name: 'GOOGLEDRIVE_DOWNLOAD_FILE', label: 'Download File', category: 'files', priority: 1 },

  // Account
  { name: 'GOOGLEDRIVE_GET_ABOUT', label: 'Get Drive Info', category: 'account', priority: 1 },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GoogleDriveAction[] = [
  // Files - Extended
  {
    name: 'GOOGLEDRIVE_COPY_FILE',
    label: 'Copy File',
    category: 'files',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_MOVE_FILE',
    label: 'Move File',
    category: 'files',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_EDIT_FILE',
    label: 'Edit File',
    category: 'files',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_UPLOAD_FROM_URL',
    label: 'Upload from URL',
    category: 'files',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_RESUMABLE_UPLOAD',
    label: 'Resumable Upload',
    category: 'files',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_CREATE_SHORTCUT_TO_FILE',
    label: 'Create Shortcut',
    category: 'files',
    priority: 2,
    writeOperation: true,
  },

  // Sharing
  {
    name: 'GOOGLEDRIVE_ADD_FILE_SHARING_PREFERENCE',
    label: 'Set Sharing',
    category: 'sharing',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_LIST_PERMISSIONS',
    label: 'List Permissions',
    category: 'sharing',
    priority: 2,
  },
  { name: 'GOOGLEDRIVE_GET_PERMISSION', label: 'Get Permission', category: 'sharing', priority: 2 },
  {
    name: 'GOOGLEDRIVE_UPDATE_PERMISSION',
    label: 'Update Permission',
    category: 'sharing',
    priority: 2,
    writeOperation: true,
  },

  // Drives
  {
    name: 'GOOGLEDRIVE_LIST_SHARED_DRIVES',
    label: 'List Shared Drives',
    category: 'drives',
    priority: 2,
  },
  {
    name: 'GOOGLEDRIVE_CREATE_DRIVE',
    label: 'Create Shared Drive',
    category: 'drives',
    priority: 2,
    writeOperation: true,
  },
  { name: 'GOOGLEDRIVE_GET_DRIVE', label: 'Get Shared Drive', category: 'drives', priority: 2 },

  // Collaboration
  {
    name: 'GOOGLEDRIVE_CREATE_COMMENT',
    label: 'Create Comment',
    category: 'collaboration',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_LIST_COMMENTS',
    label: 'List Comments',
    category: 'collaboration',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GoogleDriveAction[] = [
  // Files - Trash
  {
    name: 'GOOGLEDRIVE_TRASH_FILE',
    label: 'Trash File',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_UNTRASH_FILE',
    label: 'Untrash File',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },

  // Files - Metadata & Changes
  {
    name: 'GOOGLEDRIVE_UPDATE_FILE_PUT',
    label: 'Update File Metadata',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },
  { name: 'GOOGLEDRIVE_LIST_CHANGES', label: 'List Changes', category: 'files', priority: 3 },
  {
    name: 'GOOGLEDRIVE_GET_CHANGES_START_PAGE_TOKEN',
    label: 'Get Changes Token',
    category: 'files',
    priority: 3,
  },

  // Files - Watch
  {
    name: 'GOOGLEDRIVE_WATCH_FILE',
    label: 'Watch File',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_STOP_WATCH_CHANNEL',
    label: 'Stop Watch',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },

  // Files - Revisions
  { name: 'GOOGLEDRIVE_LIST_REVISIONS', label: 'List Revisions', category: 'files', priority: 3 },
  { name: 'GOOGLEDRIVE_GET_REVISION', label: 'Get Revision', category: 'files', priority: 3 },
  {
    name: 'GOOGLEDRIVE_UPDATE_FILE_REVISION_METADATA',
    label: 'Update Revision',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },

  // Files - Labels
  {
    name: 'GOOGLEDRIVE_FILES_MODIFY_LABELS',
    label: 'Modify Labels',
    category: 'files',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_LIST_FILE_LABELS',
    label: 'List Labels',
    category: 'files',
    priority: 3,
  },

  // Collaboration - Extended
  {
    name: 'GOOGLEDRIVE_GET_COMMENT',
    label: 'Get Comment',
    category: 'collaboration',
    priority: 3,
  },
  {
    name: 'GOOGLEDRIVE_UPDATE_COMMENT',
    label: 'Update Comment',
    category: 'collaboration',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_CREATE_REPLY',
    label: 'Create Reply',
    category: 'collaboration',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_LIST_REPLIES_TO_COMMENT',
    label: 'List Replies',
    category: 'collaboration',
    priority: 3,
  },
  {
    name: 'GOOGLEDRIVE_GET_REPLY',
    label: 'Get Reply',
    category: 'collaboration',
    priority: 3,
  },
  {
    name: 'GOOGLEDRIVE_UPDATE_REPLY',
    label: 'Update Reply',
    category: 'collaboration',
    priority: 3,
    writeOperation: true,
  },

  // Drives - Extended
  {
    name: 'GOOGLEDRIVE_ADD_SHARED_DRIVE_MEMBER',
    label: 'Add Drive Member',
    category: 'drives',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_UPDATE_DRIVE',
    label: 'Update Drive',
    category: 'drives',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & edge cases)
// ============================================================================

const ADVANCED_ACTIONS: GoogleDriveAction[] = [
  // Destructive - Files
  {
    name: 'GOOGLEDRIVE_GOOGLE_DRIVE_DELETE_FOLDER_OR_FILE_ACTION',
    label: 'Delete File/Folder',
    category: 'files',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEDRIVE_EMPTY_TRASH',
    label: 'Empty Trash',
    category: 'files',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Destructive - Sharing
  {
    name: 'GOOGLEDRIVE_DELETE_PERMISSION',
    label: 'Delete Permission',
    category: 'sharing',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Destructive - Drives
  {
    name: 'GOOGLEDRIVE_DELETE_DRIVE',
    label: 'Delete Shared Drive',
    category: 'drives',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Destructive - Collaboration
  {
    name: 'GOOGLEDRIVE_DELETE_COMMENT',
    label: 'Delete Comment',
    category: 'collaboration',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEDRIVE_DELETE_REPLY',
    label: 'Delete Reply',
    category: 'collaboration',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Drives - Visibility
  {
    name: 'GOOGLEDRIVE_HIDE_DRIVE',
    label: 'Hide Drive',
    category: 'drives',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDRIVE_UNHIDE_DRIVE',
    label: 'Unhide Drive',
    category: 'drives',
    priority: 4,
    writeOperation: true,
  },

  // Files - Utility
  { name: 'GOOGLEDRIVE_GENERATE_IDS', label: 'Generate IDs', category: 'files', priority: 4 },

  // Sharing - Extended
  {
    name: 'GOOGLEDRIVE_LIST_ACCESS_PROPOSALS',
    label: 'List Access Proposals',
    category: 'sharing',
    priority: 4,
  },
  {
    name: 'GOOGLEDRIVE_LIST_APPROVALS',
    label: 'List Approvals',
    category: 'sharing',
    priority: 4,
  },

  // Long-running & Deprecated
  {
    name: 'GOOGLEDRIVE_DOWNLOAD_FILE_OPERATION',
    label: 'Download (Long Running)',
    category: 'files',
    priority: 4,
  },
  {
    name: 'GOOGLEDRIVE_WATCH_FILE_OPERATION',
    label: 'Watch (Long Running)',
    category: 'files',
    priority: 4,
  },
  {
    name: 'GOOGLEDRIVE_PARSE_FILE',
    label: 'Parse File (Deprecated)',
    category: 'files',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GOOGLE_DRIVE_ACTIONS: GoogleDriveAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGoogleDriveFeaturedActionNames(): string[] {
  return ALL_GOOGLE_DRIVE_ACTIONS.map((a) => a.name);
}

export function getGoogleDriveActionsByPriority(maxPriority: number = 3): GoogleDriveAction[] {
  return ALL_GOOGLE_DRIVE_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGoogleDriveActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGoogleDriveActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGoogleDriveActionsByCategory(
  category: GoogleDriveActionCategory
): GoogleDriveAction[] {
  return ALL_GOOGLE_DRIVE_ACTIONS.filter((a) => a.category === category);
}

export function getGoogleDriveActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GOOGLE_DRIVE_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGoogleDriveAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_DRIVE_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGoogleDriveAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_DRIVE_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Google Drive action priority.
 * Known Google Drive actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGoogleDrivePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGoogleDriveActionPriority(a.name) - getGoogleDriveActionPriority(b.name);
  });
}

export function getGoogleDriveActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GOOGLE_DRIVE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GOOGLE_DRIVE_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Google Drive-specific system prompt when user has Google Drive connected.
 * Tells Claude exactly what it can do via the Composio Google Drive toolkit.
 */
export function getGoogleDriveSystemPrompt(): string {
  return `
## Google Drive Integration (Full Capabilities)

You have **full Google Drive access** through the user's connected account. Use the \`composio_GOOGLEDRIVE_*\` tools.

### File Management
- Search for files and folders by name, type, or content
- List files in any folder or across the entire drive
- Get detailed file metadata (size, dates, owners, permissions)
- Create new files, folders, and files from text content
- Upload files and upload from URLs (including resumable uploads for large files)
- Download files from Google Drive
- Copy, move, and edit existing files
- Create shortcuts to files

### Sharing & Permissions
- Set sharing preferences on files and folders (viewer, commenter, editor roles)
- List, get, and update permissions on any file
- Control access for specific users, groups, or domains
- Manage access proposals and approvals

### Shared Drives
- List all shared drives the user has access to
- Create new shared drives for team collaboration
- Get shared drive details and settings
- Add members to shared drives
- Update shared drive configuration

### Collaboration
- Create, list, and manage comments on files
- Reply to comments and manage reply threads
- Update and moderate comment discussions

### Revisions & History
- List and get file revisions (version history)
- Update revision metadata
- Track changes across the drive with change tokens
- Watch files for modifications

### Labels & Organization
- Modify and list labels on files
- Trash and untrash files (recoverable)
- Manage file organization across folders

### Safety Rules
1. **Confirm before deleting files/folders** - always show what will be deleted and get explicit approval
2. **Show sharing changes before applying** - display the current and proposed permissions before modifying access
3. **Never empty trash without explicit confirmation** - this is irreversible and affects all trashed items
4. **For destructive operations** (delete, empty trash, remove permissions), use the action-preview format:
\`\`\`action-preview
{
  "platform": "Google Drive",
  "action": "Delete File",
  "target": "filename.pdf",
  "warning": "This action is permanent and cannot be undone",
  "toolName": "composio_GOOGLEDRIVE_GOOGLE_DRIVE_DELETE_FOLDER_OR_FILE_ACTION",
  "toolParams": { "file_id": "..." }
}
\`\`\`
5. **For sharing changes**, show who currently has access and what will change
6. **Prefer trash over permanent delete** - use trash unless the user specifically requests permanent deletion
7. **Handle sensitive files carefully** - flag if operations involve shared confidential documents
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGoogleDriveCapabilitySummary(): string {
  const stats = getGoogleDriveActionStats();
  return `Google Drive (${stats.total} actions: files, sharing, shared drives, comments, revisions)`;
}

export function logGoogleDriveToolkitStats(): void {
  const stats = getGoogleDriveActionStats();
  log.info('Google Drive Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
