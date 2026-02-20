/**
 * COMPOSIO AIRTABLE TOOLKIT
 * ==========================
 *
 * Comprehensive Airtable integration via Composio's 26 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Bases (list bases, get schema, create base, user info)
 * - Records (CRUD operations, bulk operations, natural language)
 * - Tables (create/update tables, create/update fields)
 * - Collaboration (comments)
 */

import { logger } from '@/lib/logger';

const log = logger('AirtableToolkit');

// ============================================================================
// AIRTABLE ACTION CATEGORIES
// ============================================================================

export type AirtableActionCategory = 'bases' | 'records' | 'tables' | 'collaboration';

export interface AirtableAction {
  name: string; // Composio action name (e.g., AIRTABLE_LIST_BASES)
  label: string; // Human-readable label
  category: AirtableActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Airtable connected)
// ============================================================================

const ESSENTIAL_ACTIONS: AirtableAction[] = [
  // Bases - Core
  { name: 'AIRTABLE_LIST_BASES', label: 'List Bases', category: 'bases', priority: 1 },
  { name: 'AIRTABLE_GET_BASE_SCHEMA', label: 'Get Schema', category: 'bases', priority: 1 },
  { name: 'AIRTABLE_GET_USER_INFO', label: 'Get User Info', category: 'bases', priority: 1 },

  // Records - Core
  { name: 'AIRTABLE_LIST_RECORDS', label: 'List Records', category: 'records', priority: 1 },
  { name: 'AIRTABLE_GET_RECORD', label: 'Get Record', category: 'records', priority: 1 },
  {
    name: 'AIRTABLE_CREATE_RECORD',
    label: 'Create Record',
    category: 'records',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'AIRTABLE_UPDATE_RECORD',
    label: 'Update Record',
    category: 'records',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'AIRTABLE_CREATE_MULTIPLE_RECORDS',
    label: 'Create Multiple Records',
    category: 'records',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: AirtableAction[] = [
  // Records - Extended
  {
    name: 'AIRTABLE_CREATE_RECORDS',
    label: 'Create Records (Alt)',
    category: 'records',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'AIRTABLE_UPDATE_MULTIPLE_RECORDS',
    label: 'Update Multiple Records',
    category: 'records',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'AIRTABLE_CREATE_RECORD_FROM_NATURAL_LANGUAGE',
    label: 'Create from NL',
    category: 'records',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'AIRTABLE_UPLOAD_ATTACHMENT',
    label: 'Upload Attachment',
    category: 'records',
    priority: 2,
    writeOperation: true,
  },

  // Bases - Extended
  {
    name: 'AIRTABLE_CREATE_BASE',
    label: 'Create Base',
    category: 'bases',
    priority: 2,
    writeOperation: true,
  },

  // Tables
  {
    name: 'AIRTABLE_CREATE_TABLE',
    label: 'Create Table',
    category: 'tables',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'AIRTABLE_CREATE_FIELD',
    label: 'Create Field',
    category: 'tables',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'AIRTABLE_UPDATE_FIELD',
    label: 'Update Field',
    category: 'tables',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: AirtableAction[] = [
  // Records - PUT variants
  {
    name: 'AIRTABLE_UPDATE_RECORD_PUT',
    label: 'Update Record (PUT)',
    category: 'records',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'AIRTABLE_UPDATE_MULTIPLE_RECORDS_PUT',
    label: 'Update Multiple (PUT)',
    category: 'records',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'AIRTABLE_UPLOAD_ATTACHMENT2',
    label: 'Upload Attachment (Alt)',
    category: 'records',
    priority: 3,
    writeOperation: true,
  },

  // Tables - Extended
  {
    name: 'AIRTABLE_UPDATE_TABLE',
    label: 'Update Table',
    category: 'tables',
    priority: 3,
    writeOperation: true,
  },

  // Collaboration
  {
    name: 'AIRTABLE_CREATE_COMMENT',
    label: 'Create Comment',
    category: 'collaboration',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'AIRTABLE_LIST_COMMENTS',
    label: 'List Comments',
    category: 'collaboration',
    priority: 3,
  },
  {
    name: 'AIRTABLE_UPDATE_COMMENT',
    label: 'Update Comment',
    category: 'collaboration',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: AirtableAction[] = [
  // Records - Destructive
  {
    name: 'AIRTABLE_DELETE_RECORD',
    label: 'Delete Record',
    category: 'records',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'AIRTABLE_DELETE_MULTIPLE_RECORDS',
    label: 'Delete Multiple Records',
    category: 'records',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Collaboration - Destructive
  {
    name: 'AIRTABLE_DELETE_COMMENT',
    label: 'Delete Comment',
    category: 'collaboration',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_AIRTABLE_ACTIONS: AirtableAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getAirtableFeaturedActionNames(): string[] {
  return ALL_AIRTABLE_ACTIONS.map((a) => a.name);
}

export function getAirtableActionsByPriority(maxPriority: number = 3): AirtableAction[] {
  return ALL_AIRTABLE_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getAirtableActionNamesByPriority(maxPriority: number = 3): string[] {
  return getAirtableActionsByPriority(maxPriority).map((a) => a.name);
}

export function getAirtableActionsByCategory(category: AirtableActionCategory): AirtableAction[] {
  return ALL_AIRTABLE_ACTIONS.filter((a) => a.category === category);
}

export function getAirtableActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_AIRTABLE_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownAirtableAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_AIRTABLE_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveAirtableAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_AIRTABLE_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Airtable action priority.
 * Known Airtable actions sorted by priority (1-4), unknown actions last.
 */
export function sortByAirtablePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getAirtableActionPriority(a.name) - getAirtableActionPriority(b.name);
  });
}

export function getAirtableActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_AIRTABLE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_AIRTABLE_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Airtable-specific system prompt when user has Airtable connected.
 * Tells Claude exactly what it can do via the Composio Airtable toolkit.
 */
export function getAirtableSystemPrompt(): string {
  return `
## Airtable Integration (Full Capabilities)

You have **full Airtable access** through the user's connected account. Use the \`composio_AIRTABLE_*\` tools.

### Bases & Schema
- List all accessible bases
- Get full base schema (tables, fields, views)
- Create new bases
- Get current user info

### Records
- List records with filtering, sorting, and field selection
- Get individual record details by ID
- Create single or multiple records
- Update records (PATCH for partial, PUT for full replacement)
- Bulk create and update operations
- Create records from natural language descriptions
- Upload attachments to records

### Tables & Fields
- Create new tables within a base
- Update table metadata (name, description)
- Create new fields with type configuration
- Update existing field properties

### Collaboration
- List comments on records
- Create new comments on records
- Update existing comments

### Safety Rules
1. **ALWAYS confirm before deleting records** - show record data and get explicit approval
2. **Show record data before bulk updates** - summarize what will change and get confirmation
3. **Never delete bases or tables** - these are destructive operations that should not be performed
4. **For bulk operations** (create/update multiple records), show a summary of changes first
5. **For destructive operations** (delete record, delete multiple records, delete comment), always require explicit user confirmation
6. **Handle sensitive data carefully** - flag if records appear to contain passwords, financial data, or PII
7. **When creating records**, confirm the target base and table before proceeding
8. **For field updates**, explain what the change will affect across existing records
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getAirtableCapabilitySummary(): string {
  const stats = getAirtableActionStats();
  return `Airtable (${stats.total} actions: bases, tables, records, fields, attachments, comments)`;
}

export function logAirtableToolkitStats(): void {
  const stats = getAirtableActionStats();
  log.info('Airtable Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
