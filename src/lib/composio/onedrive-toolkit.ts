/**
 * COMPOSIO ONEDRIVE TOOLKIT
 * =========================
 *
 * Comprehensive OneDrive integration via Composio's 20 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Files (download, get item, copy, metadata, versions, thumbnails)
 * - Folders (list drives, list root changes, activities)
 * - Sharing (create link, invite user, get permissions)
 * - Search (recent items, shared items, SharePoint lists/sites)
 */

import { logger } from '@/lib/logger';

const log = logger('OneDriveToolkit');

// ============================================================================
// ONEDRIVE ACTION CATEGORIES
// ============================================================================

export type OneDriveActionCategory = 'files' | 'folders' | 'sharing' | 'search';

export interface OneDriveAction {
  name: string; // Composio action name (e.g., ONE_DRIVE_DOWNLOAD_FILE)
  label: string; // Human-readable label
  category: OneDriveActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when OneDrive connected)
// ============================================================================

const ESSENTIAL_ACTIONS: OneDriveAction[] = [
  // Files - Core
  {
    name: 'ONE_DRIVE_DOWNLOAD_FILE',
    label: 'Download File',
    category: 'files',
    priority: 1,
  },
  {
    name: 'ONE_DRIVE_GET_ITEM',
    label: 'Get Item Metadata',
    category: 'files',
    priority: 1,
  },
  {
    name: 'ONE_DRIVE_COPY_ITEM',
    label: 'Copy Item',
    category: 'files',
    priority: 1,
    writeOperation: true,
  },

  // Folders - Core
  {
    name: 'ONE_DRIVE_LIST_DRIVES',
    label: 'List Drives',
    category: 'folders',
    priority: 1,
  },
  {
    name: 'ONE_DRIVE_GET_DRIVE',
    label: 'Get Drive',
    category: 'folders',
    priority: 1,
  },

  // Search - Core
  {
    name: 'ONE_DRIVE_GET_RECENT_ITEMS',
    label: 'Get Recent Items',
    category: 'search',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: OneDriveAction[] = [
  // Sharing - Core
  {
    name: 'ONE_DRIVE_CREATE_LINK',
    label: 'Create Sharing Link',
    category: 'sharing',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'ONE_DRIVE_GET_ITEM_PERMISSIONS',
    label: 'Get Item Permissions',
    category: 'sharing',
    priority: 2,
  },
  {
    name: 'ONE_DRIVE_INVITE_USER_TO_DRIVE_ITEM',
    label: 'Invite User to Item',
    category: 'sharing',
    priority: 2,
    writeOperation: true,
  },

  // Search - Extended
  {
    name: 'ONE_DRIVE_GET_SHARED_ITEMS',
    label: 'Get Shared Items',
    category: 'search',
    priority: 2,
  },

  // Files - Extended
  {
    name: 'ONE_DRIVE_GET_ITEM_VERSIONS',
    label: 'Get Item Version History',
    category: 'files',
    priority: 2,
  },
  {
    name: 'ONE_DRIVE_GET_QUOTA',
    label: 'Get Storage Quota',
    category: 'folders',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: OneDriveAction[] = [
  // Files - Media
  {
    name: 'ONE_DRIVE_GET_ITEM_THUMBNAILS',
    label: 'Get Item Thumbnails',
    category: 'files',
    priority: 3,
  },

  // Folders - Extended
  {
    name: 'ONE_DRIVE_LIST_DRIVE_ITEM_ACTIVITIES',
    label: 'List Item Activities',
    category: 'folders',
    priority: 3,
  },
  {
    name: 'ONE_DRIVE_LIST_ROOT_DRIVE_CHANGES',
    label: 'List Root Drive Changes',
    category: 'folders',
    priority: 3,
  },

  // SharePoint
  {
    name: 'ONE_DRIVE_GET_SITE_DETAILS',
    label: 'Get SharePoint Site Details',
    category: 'search',
    priority: 3,
  },
  {
    name: 'ONE_DRIVE_GET_SHAREPOINT_LIST_ITEMS',
    label: 'Get SharePoint List Items',
    category: 'search',
    priority: 3,
  },
  {
    name: 'ONE_DRIVE_GET_SHAREPOINT_SITE_PAGE_CONTENT',
    label: 'Get SharePoint Page Content',
    category: 'search',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: OneDriveAction[] = [
  // Files - Destructive
  {
    name: 'ONE_DRIVE_DELETE_ITEM',
    label: 'Delete Item',
    category: 'files',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // SharePoint - Specialized
  {
    name: 'ONE_DRIVE_LIST_SHAREPOINT_LIST_ITEMS_DELTA',
    label: 'Get SharePoint List Changes',
    category: 'search',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_ONEDRIVE_ACTIONS: OneDriveAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getOneDriveFeaturedActionNames(): string[] {
  return ALL_ONEDRIVE_ACTIONS.map((a) => a.name);
}

export function getOneDriveActionsByPriority(maxPriority: number = 3): OneDriveAction[] {
  return ALL_ONEDRIVE_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getOneDriveActionNamesByPriority(maxPriority: number = 3): string[] {
  return getOneDriveActionsByPriority(maxPriority).map((a) => a.name);
}

export function getOneDriveActionsByCategory(category: OneDriveActionCategory): OneDriveAction[] {
  return ALL_ONEDRIVE_ACTIONS.filter((a) => a.category === category);
}

export function getOneDriveActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_ONEDRIVE_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownOneDriveAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_ONEDRIVE_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveOneDriveAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_ONEDRIVE_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by OneDrive action priority.
 * Known OneDrive actions sorted by priority (1-4), unknown actions last.
 */
export function sortByOneDrivePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getOneDriveActionPriority(a.name) - getOneDriveActionPriority(b.name);
  });
}

export function getOneDriveActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_ONEDRIVE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_ONEDRIVE_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate OneDrive-specific system prompt when user has OneDrive connected.
 * Tells Claude exactly what it can do via the Composio OneDrive toolkit.
 */
export function getOneDriveSystemPrompt(): string {
  return `
## OneDrive Integration (Full Capabilities)

You have **full OneDrive access** through the user's connected account. Use the \`composio_ONE_DRIVE_*\` tools.

### File Management
- Download files from OneDrive
- Get file/folder metadata by ID
- Copy files and folders to new locations
- Get file version history
- Get file thumbnails for previews
- Delete files and folders (with confirmation)

### Drive & Folder Navigation
- List all available drives (personal, shared, group)
- Get drive details by ID
- Check storage quota (total, used, remaining)
- List item activities (recent changes)
- Track root drive changes (delta sync)

### Sharing & Collaboration
- Create shareable links for files and folders
- Invite users to access specific items
- View item permissions (who has access and at what level)

### Search & Discovery
- Get recently used items across OneDrive
- View items shared with the current user
- Access SharePoint site details
- Get SharePoint list items
- Get SharePoint site page content
- Track SharePoint list changes (delta)

### Safety Rules
1. **ALWAYS confirm before sharing** - show sharing details using the action-preview format:
\`\`\`action-preview
{
  "platform": "OneDrive",
  "action": "Create Sharing Link",
  "item": "filename.docx",
  "permissions": "view",
  "toolName": "composio_ONE_DRIVE_CREATE_LINK",
  "toolParams": { "item_id": "...", "type": "view", "scope": "..." }
}
\`\`\`
2. **Confirm before deleting** - always show what will be deleted and get explicit approval
3. **Verify file identity** - confirm the correct file/folder before copying or moving
4. **Check permissions before sharing** - review existing permissions to avoid conflicts
5. **Handle large files carefully** - warn about download size for large files
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getOneDriveCapabilitySummary(): string {
  const stats = getOneDriveActionStats();
  return `OneDrive (${stats.total} actions: files, folders, sharing, search)`;
}

export function logOneDriveToolkitStats(): void {
  const stats = getOneDriveActionStats();
  log.info('OneDrive Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
