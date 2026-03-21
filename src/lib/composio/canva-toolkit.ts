/**
 * COMPOSIO CANVA TOOLKIT
 * ======================
 *
 * Comprehensive Canva integration via Composio's 20 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Design (create designs, list designs, autofill, metadata)
 * - Media (upload assets, fetch status, retrieve metadata, delete)
 * - Brand (brand templates, template datasets)
 * - Templates (list pages, folder items)
 * - Export (export jobs, download results)
 */

import { logger } from '@/lib/logger';

const log = logger('CanvaToolkit');

// ============================================================================
// CANVA ACTION CATEGORIES
// ============================================================================

export type CanvaActionCategory = 'design' | 'media' | 'brand' | 'templates' | 'export';

export interface CanvaAction {
  name: string; // Composio action name (e.g., CANVA_CREATE_CANVA_DESIGN_WITH_OPTIONAL_ASSET)
  label: string; // Human-readable label
  category: CanvaActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Canva connected)
// ============================================================================

const ESSENTIAL_ACTIONS: CanvaAction[] = [
  // Design - Core
  {
    name: 'CANVA_CREATE_CANVA_DESIGN_WITH_OPTIONAL_ASSET',
    label: 'Create Design',
    category: 'design',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'CANVA_LIST_USER_DESIGNS',
    label: 'List User Designs',
    category: 'design',
    priority: 1,
  },
  {
    name: 'CANVA_FETCH_DESIGN_METADATA_AND_ACCESS_INFORMATION',
    label: 'Get Design Metadata',
    category: 'design',
    priority: 1,
  },
  {
    name: 'CANVA_FETCH_CURRENT_USER_DETAILS',
    label: 'Get Current User',
    category: 'design',
    priority: 1,
  },

  // Export - Core
  {
    name: 'CANVA_INITIATES_CANVA_DESIGN_EXPORT_JOB',
    label: 'Export Design',
    category: 'export',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'CANVA_GET_DESIGN_EXPORT_JOB_RESULT',
    label: 'Get Export Result',
    category: 'export',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: CanvaAction[] = [
  // Design - Extended
  {
    name: 'CANVA_INITIATE_CANVA_DESIGN_AUTOFILL_JOB',
    label: 'Autofill Design',
    category: 'design',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'CANVA_LIST_DESIGN_PAGES_WITH_PAGINATION',
    label: 'List Design Pages',
    category: 'design',
    priority: 2,
  },

  // Brand - Core
  {
    name: 'CANVA_ACCESS_USER_SPECIFIC_BRAND_TEMPLATES_LIST',
    label: 'List Brand Templates',
    category: 'brand',
    priority: 2,
  },
  {
    name: 'CANVA_RETRIEVE_BRAND_TEMPLATE_DATASET_DEFINITION',
    label: 'Get Brand Template Dataset',
    category: 'brand',
    priority: 2,
  },

  // Templates - Folders
  {
    name: 'CANVA_CREATE_USER_OR_SUB_FOLDER',
    label: 'Create Folder',
    category: 'templates',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'CANVA_LIST_FOLDER_ITEMS_BY_TYPE_WITH_SORTING',
    label: 'List Folder Items',
    category: 'templates',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: CanvaAction[] = [
  // Media - Asset Management
  {
    name: 'CANVA_FETCH_ASSET_UPLOAD_JOB_STATUS',
    label: 'Get Asset Upload Status',
    category: 'media',
    priority: 3,
  },
  {
    name: 'CANVA_RETRIEVE_ASSET_METADATA_BY_ID',
    label: 'Get Asset Metadata',
    category: 'media',
    priority: 3,
  },

  // Design - Comments
  {
    name: 'CANVA_CREATE_DESIGN_COMMENT_IN_PREVIEW_API',
    label: 'Create Design Comment',
    category: 'design',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'CANVA_CREATE_COMMENT_REPLY_IN_DESIGN',
    label: 'Reply to Design Comment',
    category: 'design',
    priority: 3,
    writeOperation: true,
  },

  // Templates - Organization
  {
    name: 'CANVA_MOVE_ITEM_TO_SPECIFIED_FOLDER',
    label: 'Move Item to Folder',
    category: 'templates',
    priority: 3,
    writeOperation: true,
  },

  // Auth
  {
    name: 'CANVA_FETCH_CANVA_CONNECT_SIGNING_PUBLIC_KEYS',
    label: 'Get Connect Signing Keys',
    category: 'export',
    priority: 3,
  },
  {
    name: 'CANVA_RETRIEVE_APP_PUBLIC_KEY_SET',
    label: 'Get App Public Keys',
    category: 'export',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: CanvaAction[] = [
  // Media - Destructive
  {
    name: 'CANVA_DELETE_ASSET_BY_ID',
    label: 'Delete Asset',
    category: 'media',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Templates - Destructive
  {
    name: 'CANVA_REMOVE_FOLDER_AND_MOVE_CONTENTS_TO_TRASH',
    label: 'Delete Folder',
    category: 'templates',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Auth - Specialized
  {
    name: 'CANVA_EXCHANGE_OAUTH20_ACCESS_OR_REFRESH_TOKEN',
    label: 'Exchange OAuth Token',
    category: 'export',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_CANVA_ACTIONS: CanvaAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getCanvaFeaturedActionNames(): string[] {
  return ALL_CANVA_ACTIONS.map((a) => a.name);
}

export function getCanvaActionsByPriority(maxPriority: number = 3): CanvaAction[] {
  return ALL_CANVA_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getCanvaActionNamesByPriority(maxPriority: number = 3): string[] {
  return getCanvaActionsByPriority(maxPriority).map((a) => a.name);
}

export function getCanvaActionsByCategory(category: CanvaActionCategory): CanvaAction[] {
  return ALL_CANVA_ACTIONS.filter((a) => a.category === category);
}

export function getCanvaActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_CANVA_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownCanvaAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_CANVA_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveCanvaAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_CANVA_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Canva action priority.
 * Known Canva actions sorted by priority (1-4), unknown actions last.
 */
export function sortByCanvaPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getCanvaActionPriority(a.name) - getCanvaActionPriority(b.name);
  });
}

export function getCanvaActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_CANVA_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_CANVA_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Canva-specific system prompt when user has Canva connected.
 * Tells Claude exactly what it can do via the Composio Canva toolkit.
 */
export function getCanvaSystemPrompt(): string {
  return `
## Canva Integration (Full Capabilities)

You have **full Canva access** through the user's connected account. Use the \`composio_CANVA_*\` tools.

### Design Creation
- Create new designs with optional assets using preset or custom dimensions
- Autofill brand templates with dynamic data
- List all user designs with search and filtering
- Get design metadata and access information
- List design pages with pagination

### Asset Management
- Check asset upload job status
- Retrieve asset metadata by ID
- Delete assets (with confirmation)

### Brand Templates
- Access user-specific brand templates list
- Retrieve brand template dataset definitions for autofill

### Folder Organization
- Create user folders and sub-folders
- List folder items by type with sorting
- Move items between folders
- Delete folders and move contents to trash (with confirmation)

### Export & Download
- Initiate design export jobs in multiple formats (PNG, PDF, etc.)
- Get export job results with download links

### Collaboration
- Create comments on designs (preview API)
- Reply to design comments

### Safety Rules
1. **ALWAYS preview before creating** - show design details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Canva",
  "action": "Create Design",
  "details": "Design type and dimensions...",
  "toolName": "composio_CANVA_CREATE_CANVA_DESIGN_WITH_OPTIONAL_ASSET",
  "toolParams": { "design_type": "...", "width": "...", "height": "..." }
}
\`\`\`
2. **Confirm before deleting** - always show what will be deleted and get explicit approval
3. **Check export status** - after initiating an export, poll for results before providing download links
4. **Verify brand template data** - confirm autofill data matches template fields before submitting
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getCanvaCapabilitySummary(): string {
  const stats = getCanvaActionStats();
  return `Canva (${stats.total} actions: design, media, brand, templates, export)`;
}

export function logCanvaToolkitStats(): void {
  const stats = getCanvaActionStats();
  log.info('Canva Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
