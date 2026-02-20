/**
 * COMPOSIO GOOGLE DOCS TOOLKIT
 * =============================
 *
 * Comprehensive Google Docs integration via Composio's 35 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Create (create documents, copy, search, get, export)
 * - Edit (insert text, replace, update, delete, images, headers, footers, footnotes, named ranges)
 * - Format (bullets, document style, table row style)
 * - Tables (insert/delete tables, columns, rows, unmerge cells, charts)
 */

import { logger } from '@/lib/logger';

const log = logger('GoogleDocsToolkit');

// ============================================================================
// GOOGLE DOCS ACTION CATEGORIES
// ============================================================================

export type GoogleDocsActionCategory = 'create' | 'edit' | 'format' | 'tables';

export interface GoogleDocsAction {
  name: string; // Composio action name (e.g., GOOGLEDOCS_CREATE_DOCUMENT)
  label: string; // Human-readable label
  category: GoogleDocsActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Google Docs connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GoogleDocsAction[] = [
  // Create - Core
  {
    name: 'GOOGLEDOCS_CREATE_DOCUMENT',
    label: 'Create Document',
    category: 'create',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDOCS_GET_DOCUMENT_BY_ID',
    label: 'Get Document',
    category: 'create',
    priority: 1,
  },
  {
    name: 'GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT',
    label: 'Get Plain Text',
    category: 'create',
    priority: 1,
  },

  // Edit - Core
  {
    name: 'GOOGLEDOCS_INSERT_TEXT_ACTION',
    label: 'Insert Text',
    category: 'edit',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDOCS_REPLACE_ALL_TEXT',
    label: 'Find & Replace',
    category: 'edit',
    priority: 1,
    writeOperation: true,
  },

  // Search
  {
    name: 'GOOGLEDOCS_SEARCH_DOCUMENTS',
    label: 'Search Documents',
    category: 'create',
    priority: 1,
  },

  // Create from Markdown
  {
    name: 'GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN',
    label: 'Create from Markdown',
    category: 'create',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GoogleDocsAction[] = [
  // Edit - Markdown updates
  {
    name: 'GOOGLEDOCS_UPDATE_DOCUMENT_MARKDOWN',
    label: 'Update Doc with Markdown',
    category: 'edit',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDOCS_UPDATE_DOCUMENT_SECTION_MARKDOWN',
    label: 'Update Section Markdown',
    category: 'edit',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDOCS_UPDATE_EXISTING_DOCUMENT',
    label: 'Batch Update',
    category: 'edit',
    priority: 2,
    writeOperation: true,
  },

  // Create - Copy & Export
  {
    name: 'GOOGLEDOCS_COPY_DOCUMENT',
    label: 'Copy Document',
    category: 'create',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDOCS_EXPORT_DOCUMENT_AS_PDF',
    label: 'Export as PDF',
    category: 'create',
    priority: 2,
  },

  // Edit - Images & Tables
  {
    name: 'GOOGLEDOCS_INSERT_INLINE_IMAGE',
    label: 'Insert Image',
    category: 'edit',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDOCS_INSERT_TABLE_ACTION',
    label: 'Insert Table',
    category: 'tables',
    priority: 2,
    writeOperation: true,
  },

  // Edit - Destructive
  {
    name: 'GOOGLEDOCS_DELETE_CONTENT_RANGE',
    label: 'Delete Content',
    category: 'edit',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },

  // Edit - Headers & Footers
  {
    name: 'GOOGLEDOCS_CREATE_HEADER',
    label: 'Create Header',
    category: 'edit',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDOCS_CREATE_FOOTER',
    label: 'Create Footer',
    category: 'edit',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GoogleDocsAction[] = [
  // Edit - Page & Formatting
  {
    name: 'GOOGLEDOCS_INSERT_PAGE_BREAK',
    label: 'Insert Page Break',
    category: 'edit',
    priority: 3,
    writeOperation: true,
  },

  // Format - Bullets
  {
    name: 'GOOGLEDOCS_CREATE_PARAGRAPH_BULLETS',
    label: 'Create Bullets',
    category: 'format',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDOCS_DELETE_PARAGRAPH_BULLETS',
    label: 'Remove Bullets',
    category: 'format',
    priority: 3,
    writeOperation: true,
  },

  // Edit - Named Ranges
  {
    name: 'GOOGLEDOCS_CREATE_NAMED_RANGE',
    label: 'Create Named Range',
    category: 'edit',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDOCS_DELETE_NAMED_RANGE',
    label: 'Delete Named Range',
    category: 'edit',
    priority: 3,
    writeOperation: true,
  },

  // Edit - Footnote
  {
    name: 'GOOGLEDOCS_CREATE_FOOTNOTE',
    label: 'Create Footnote',
    category: 'edit',
    priority: 3,
    writeOperation: true,
  },

  // Tables - Extended
  {
    name: 'GOOGLEDOCS_INSERT_TABLE_COLUMN',
    label: 'Insert Table Column',
    category: 'tables',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDOCS_DELETE_TABLE_COLUMN',
    label: 'Delete Table Column',
    category: 'tables',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEDOCS_DELETE_TABLE_ROW',
    label: 'Delete Table Row',
    category: 'tables',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEDOCS_DELETE_TABLE',
    label: 'Delete Table',
    category: 'tables',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEDOCS_UNMERGE_TABLE_CELLS',
    label: 'Unmerge Cells',
    category: 'tables',
    priority: 3,
    writeOperation: true,
  },

  // Edit - Images & Style
  {
    name: 'GOOGLEDOCS_REPLACE_IMAGE',
    label: 'Replace Image',
    category: 'edit',
    priority: 3,
    writeOperation: true,
  },

  // Format - Styles
  {
    name: 'GOOGLEDOCS_UPDATE_DOCUMENT_STYLE',
    label: 'Update Doc Style',
    category: 'format',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEDOCS_UPDATE_TABLE_ROW_STYLE',
    label: 'Update Table Row Style',
    category: 'format',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Headers/footers deletion & charts)
// ============================================================================

const ADVANCED_ACTIONS: GoogleDocsAction[] = [
  // Edit - Destructive header/footer operations
  {
    name: 'GOOGLEDOCS_DELETE_HEADER',
    label: 'Delete Header',
    category: 'edit',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEDOCS_DELETE_FOOTER',
    label: 'Delete Footer',
    category: 'edit',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Tables - Charts
  {
    name: 'GOOGLEDOCS_GET_CHARTS_FROM_SPREADSHEET',
    label: 'Get Charts',
    category: 'tables',
    priority: 4,
  },
  {
    name: 'GOOGLEDOCS_LIST_SPREADSHEET_CHARTS_ACTION',
    label: 'List Charts',
    category: 'tables',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GOOGLE_DOCS_ACTIONS: GoogleDocsAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGoogleDocsFeaturedActionNames(): string[] {
  return ALL_GOOGLE_DOCS_ACTIONS.map((a) => a.name);
}

export function getGoogleDocsActionsByPriority(maxPriority: number = 3): GoogleDocsAction[] {
  return ALL_GOOGLE_DOCS_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGoogleDocsActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGoogleDocsActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGoogleDocsActionsByCategory(
  category: GoogleDocsActionCategory
): GoogleDocsAction[] {
  return ALL_GOOGLE_DOCS_ACTIONS.filter((a) => a.category === category);
}

export function getGoogleDocsActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GOOGLE_DOCS_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGoogleDocsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_DOCS_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGoogleDocsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_DOCS_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Google Docs action priority.
 * Known Google Docs actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGoogleDocsPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGoogleDocsActionPriority(a.name) - getGoogleDocsActionPriority(b.name);
  });
}

export function getGoogleDocsActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GOOGLE_DOCS_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GOOGLE_DOCS_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Google Docs-specific system prompt when user has Google Docs connected.
 * Tells Claude exactly what it can do via the Composio Google Docs toolkit.
 */
export function getGoogleDocsSystemPrompt(): string {
  return `
## Google Docs Integration (Full Capabilities)

You have **full Google Docs access** through the user's connected account. Use the \`composio_GOOGLEDOCS_*\` tools.

### Create & Search
- Create new documents (blank or from Markdown)
- Copy existing documents
- Search documents by query
- Get document content (structured or plain text)
- Export documents as PDF

### Edit & Update
- Insert text at specific positions
- Find and replace text across documents
- Update documents with Markdown content
- Update specific sections with Markdown
- Batch update documents with multiple changes
- Delete content ranges
- Insert inline images and replace images
- Insert page breaks
- Create and delete named ranges
- Create footnotes

### Headers & Footers
- Create headers and footers
- Delete headers and footers

### Format & Style
- Create and remove paragraph bullets
- Update document-level styles
- Update table row styles

### Tables
- Insert tables at specific positions
- Insert and delete table columns
- Delete table rows and entire tables
- Unmerge table cells
- Get and list charts from linked spreadsheets

### Safety Rules
1. **ALWAYS show a preview before modifying documents** using the action-preview format:
\`\`\`action-preview
{
  "platform": "Google Docs",
  "action": "Create Document",
  "title": "Document title here",
  "content": "Content preview...",
  "toolName": "composio_GOOGLEDOCS_CREATE_DOCUMENT",
  "toolParams": { "title": "...", "body": "..." }
}
\`\`\`
2. **Never modify documents without explicit user confirmation** - always wait for confirmation
3. **For destructive operations** (delete content, delete tables, delete headers/footers), summarize what will be removed and get explicit approval
4. **For batch updates**, show a summary of all changes before executing
5. **For find & replace**, show how many instances will be affected before proceeding
6. **Handle sensitive content carefully** - flag if document appears to contain confidential data or PII
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGoogleDocsCapabilitySummary(): string {
  const stats = getGoogleDocsActionStats();
  return `Google Docs (${stats.total} actions: create, edit, format, tables, search, export)`;
}

export function logGoogleDocsToolkitStats(): void {
  const stats = getGoogleDocsActionStats();
  log.info('Google Docs Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
