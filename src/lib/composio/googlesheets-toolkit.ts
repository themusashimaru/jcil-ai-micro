/**
 * COMPOSIO GOOGLE SHEETS TOOLKIT
 * ===============================
 *
 * Comprehensive Google Sheets integration via Composio's 44 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Read (get values, search spreadsheets, lookup rows)
 * - Write (update values, append, create rows/columns)
 * - Manage (delete, format, charts, filters, validation)
 * - Analyze (aggregate, SQL queries, table queries)
 */

import { logger } from '@/lib/logger';

const log = logger('GoogleSheetsToolkit');

// ============================================================================
// GOOGLE SHEETS ACTION CATEGORIES
// ============================================================================

export type GoogleSheetsActionCategory = 'read' | 'write' | 'manage' | 'analyze';

export interface GoogleSheetsAction {
  name: string; // Composio action name (e.g., GOOGLESHEETS_VALUES_GET)
  label: string; // Human-readable label
  category: GoogleSheetsActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Google Sheets connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GoogleSheetsAction[] = [
  // Write - Core
  {
    name: 'GOOGLESHEETS_CREATE_GOOGLE_SHEET1',
    label: 'Create Spreadsheet',
    category: 'write',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_VALUES_UPDATE',
    label: 'Update Values',
    category: 'write',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_BATCH_UPDATE',
    label: 'Batch Update Values',
    category: 'write',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND',
    label: 'Append Values',
    category: 'write',
    priority: 1,
    writeOperation: true,
  },

  // Read - Core
  { name: 'GOOGLESHEETS_VALUES_GET', label: 'Get Values', category: 'read', priority: 1 },
  { name: 'GOOGLESHEETS_BATCH_GET', label: 'Batch Get Values', category: 'read', priority: 1 },
  {
    name: 'GOOGLESHEETS_GET_SPREADSHEET_INFO',
    label: 'Get Spreadsheet Info',
    category: 'read',
    priority: 1,
  },
  { name: 'GOOGLESHEETS_GET_SHEET_NAMES', label: 'Get Sheet Names', category: 'read', priority: 1 },
  {
    name: 'GOOGLESHEETS_SEARCH_SPREADSHEETS',
    label: 'Search Spreadsheets',
    category: 'read',
    priority: 1,
  },
  {
    name: 'GOOGLESHEETS_LOOKUP_SPREADSHEET_ROW',
    label: 'Lookup Row',
    category: 'read',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GoogleSheetsAction[] = [
  // Write - Extended
  {
    name: 'GOOGLESHEETS_CREATE_SPREADSHEET_ROW',
    label: 'Create Row',
    category: 'write',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_CREATE_SPREADSHEET_COLUMN',
    label: 'Create Column',
    category: 'write',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_ADD_SHEET',
    label: 'Add Sheet',
    category: 'write',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_DELETE_SHEET',
    label: 'Delete Sheet',
    category: 'manage',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLESHEETS_UPSERT_ROWS',
    label: 'Upsert Rows',
    category: 'write',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_SHEET_FROM_JSON',
    label: 'Sheet from JSON',
    category: 'write',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_CLEAR_VALUES',
    label: 'Clear Values',
    category: 'write',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_FIND_REPLACE',
    label: 'Find & Replace',
    category: 'write',
    priority: 2,
    writeOperation: true,
  },

  // Read - Extended
  {
    name: 'GOOGLESHEETS_FIND_WORKSHEET_BY_TITLE',
    label: 'Find Worksheet',
    category: 'read',
    priority: 2,
  },
  { name: 'GOOGLESHEETS_LIST_TABLES', label: 'List Tables', category: 'read', priority: 2 },
  {
    name: 'GOOGLESHEETS_GET_TABLE_SCHEMA',
    label: 'Get Table Schema',
    category: 'read',
    priority: 2,
  },

  // Analyze
  {
    name: 'GOOGLESHEETS_AGGREGATE_COLUMN_DATA',
    label: 'Aggregate Column',
    category: 'analyze',
    priority: 2,
  },
  { name: 'GOOGLESHEETS_EXECUTE_SQL', label: 'Execute SQL', category: 'analyze', priority: 2 },
  { name: 'GOOGLESHEETS_QUERY_TABLE', label: 'Query Table', category: 'analyze', priority: 2 },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GoogleSheetsAction[] = [
  // Write - Dimensional operations
  {
    name: 'GOOGLESHEETS_APPEND_DIMENSION',
    label: 'Append Rows/Cols',
    category: 'write',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_INSERT_DIMENSION',
    label: 'Insert Rows/Cols',
    category: 'write',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_DELETE_DIMENSION',
    label: 'Delete Rows/Cols',
    category: 'manage',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLESHEETS_SPREADSHEETS_SHEETS_COPY_TO',
    label: 'Copy Sheet',
    category: 'write',
    priority: 3,
    writeOperation: true,
  },

  // Manage - Formatting & Charts
  {
    name: 'GOOGLESHEETS_FORMAT_CELL',
    label: 'Format Cells',
    category: 'manage',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_CREATE_CHART',
    label: 'Create Chart',
    category: 'manage',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_UPDATE_SHEET_PROPERTIES',
    label: 'Update Sheet Properties',
    category: 'manage',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_UPDATE_SPREADSHEET_PROPERTIES',
    label: 'Update Spreadsheet Properties',
    category: 'manage',
    priority: 3,
    writeOperation: true,
  },

  // Manage - Filters
  {
    name: 'GOOGLESHEETS_SET_BASIC_FILTER',
    label: 'Set Basic Filter',
    category: 'manage',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_CLEAR_BASIC_FILTER',
    label: 'Clear Basic Filter',
    category: 'manage',
    priority: 3,
    writeOperation: true,
  },

  // Manage - Validation & Conditional Formatting
  {
    name: 'GOOGLESHEETS_SET_DATA_VALIDATION_RULE',
    label: 'Set Validation Rule',
    category: 'manage',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_GET_DATA_VALIDATION_RULES',
    label: 'Get Validation Rules',
    category: 'read',
    priority: 3,
  },
  {
    name: 'GOOGLESHEETS_GET_CONDITIONAL_FORMAT_RULES',
    label: 'Get Format Rules',
    category: 'read',
    priority: 3,
  },
  {
    name: 'GOOGLESHEETS_MUTATE_CONDITIONAL_FORMAT_RULES',
    label: 'Update Format Rules',
    category: 'manage',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Batch filter operations & metadata)
// ============================================================================

const ADVANCED_ACTIONS: GoogleSheetsAction[] = [
  // Batch filter operations
  {
    name: 'GOOGLESHEETS_BATCH_UPDATE_VALUES_BY_DATA_FILTER',
    label: 'Batch Update by Filter',
    category: 'manage',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GOOGLESHEETS_SPREADSHEETS_VALUES_BATCH_CLEAR',
    label: 'Batch Clear Values',
    category: 'manage',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLESHEETS_SPREADSHEETS_VALUES_BATCH_CLEAR_BY_DATA_FILTER',
    label: 'Batch Clear by Filter',
    category: 'manage',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLESHEETS_SPREADSHEETS_VALUES_BATCH_GET_BY_DATA_FILTER',
    label: 'Batch Get by Filter',
    category: 'read',
    priority: 4,
  },
  {
    name: 'GOOGLESHEETS_GET_SPREADSHEET_BY_DATA_FILTER',
    label: 'Get by Data Filter',
    category: 'read',
    priority: 4,
  },
  {
    name: 'GOOGLESHEETS_SEARCH_DEVELOPER_METADATA',
    label: 'Search Metadata',
    category: 'read',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GOOGLE_SHEETS_ACTIONS: GoogleSheetsAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGoogleSheetsFeaturedActionNames(): string[] {
  return ALL_GOOGLE_SHEETS_ACTIONS.map((a) => a.name);
}

export function getGoogleSheetsActionsByPriority(maxPriority: number = 3): GoogleSheetsAction[] {
  return ALL_GOOGLE_SHEETS_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGoogleSheetsActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGoogleSheetsActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGoogleSheetsActionsByCategory(
  category: GoogleSheetsActionCategory
): GoogleSheetsAction[] {
  return ALL_GOOGLE_SHEETS_ACTIONS.filter((a) => a.category === category);
}

export function getGoogleSheetsActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GOOGLE_SHEETS_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGoogleSheetsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_SHEETS_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGoogleSheetsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_SHEETS_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Google Sheets action priority.
 * Known Google Sheets actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGoogleSheetsPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGoogleSheetsActionPriority(a.name) - getGoogleSheetsActionPriority(b.name);
  });
}

export function getGoogleSheetsActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GOOGLE_SHEETS_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GOOGLE_SHEETS_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Google Sheets-specific system prompt when user has Google Sheets connected.
 * Tells Claude exactly what it can do via the Composio Google Sheets toolkit.
 */
export function getGoogleSheetsSystemPrompt(): string {
  return `
## Google Sheets Integration (Full Capabilities)

You have **full Google Sheets access** through the user's connected account. Use the \`composio_GOOGLESHEETS_*\` tools.

### Spreadsheet CRUD
- Create new spreadsheets from scratch or from JSON data
- Search and find existing spreadsheets by name
- Get spreadsheet info, sheet names, and table schemas
- Add, copy, and delete sheets within a spreadsheet
- Update spreadsheet and sheet properties (title, locale, etc.)

### Cell Value Read & Write
- Read values from individual ranges or batch-read multiple ranges
- Write/update values to specific cell ranges
- Append rows of data to the end of a sheet
- Create individual rows and columns
- Upsert rows (insert or update based on matching criteria)
- Clear values from specified ranges
- Find and replace text across sheets
- Lookup specific rows by column value

### Formulas & Calculations
- Write formulas to cells (use standard Google Sheets formula syntax)
- Aggregate column data with built-in functions (SUM, AVG, COUNT, etc.)
- Execute SQL-like queries against sheet data
- Query tables with structured filters

### Charts & Formatting
- Create charts from sheet data ranges
- Format cells (fonts, colors, borders, number formats, alignment)
- Set and manage conditional formatting rules
- Get existing conditional format rules for inspection

### Filtering & Validation
- Set basic filters on data ranges
- Clear basic filters
- Set data validation rules on cell ranges
- Get existing data validation rules

### Batch Operations
- Batch get values from multiple ranges in one call
- Batch update values across multiple ranges
- Batch clear values from multiple ranges
- Filter-based batch operations for advanced data manipulation

### SQL Queries & Analysis
- Execute SQL-like queries against spreadsheet data
- Query tables with structured conditions
- Aggregate column data with statistical functions
- List tables and get table schemas for structured data access

### Safety Rules
1. **ALWAYS show a preview before destructive operations** using the action-preview format:
\`\`\`action-preview
{
  "platform": "Google Sheets",
  "action": "Delete Sheet",
  "spreadsheet": "Spreadsheet Name",
  "target": "Sheet to delete",
  "toolName": "composio_GOOGLESHEETS_DELETE_SHEET",
  "toolParams": { "spreadsheet_id": "...", "sheet_id": "..." }
}
\`\`\`
2. **Confirm before deleting sheets, rows, or columns** - these operations cannot be undone
3. **Show preview of bulk write operations** - when updating or appending large ranges, summarize what will change
4. **For batch clear operations**, list all ranges that will be cleared and get explicit approval
5. **For find & replace**, show the search term, replacement, and scope before executing
6. **Handle formulas carefully** - verify formula syntax before writing to prevent errors
7. **When writing to existing data**, warn if the operation will overwrite non-empty cells
8. **For SQL queries**, show the query before execution so the user can verify the logic
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGoogleSheetsCapabilitySummary(): string {
  const stats = getGoogleSheetsActionStats();
  return `Google Sheets (${stats.total} actions: read, write, formulas, charts, filters, SQL queries, batch ops)`;
}

export function logGoogleSheetsToolkitStats(): void {
  const stats = getGoogleSheetsActionStats();
  log.info('Google Sheets Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
