/**
 * COMPOSIO SUPABASE TOOLKIT
 * =========================
 *
 * Comprehensive Supabase integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Database (SQL execution, CRUD operations, tables, policies)
 * - Auth (user management, creation, deletion)
 * - Storage (buckets, file upload/download/delete)
 * - Functions (edge functions, invocation, creation)
 * - Projects (list, get, create, delete projects)
 * - Realtime (realtime subscriptions and channels)
 */

import { logger } from '@/lib/logger';

const log = logger('SupabaseToolkit');

// ============================================================================
// SUPABASE ACTION CATEGORIES
// ============================================================================

export type SupabaseActionCategory =
  | 'database'
  | 'auth'
  | 'storage'
  | 'functions'
  | 'projects'
  | 'realtime';

export interface SupabaseAction {
  name: string; // Composio action name (e.g., SUPABASE_EXECUTE_SQL)
  label: string; // Human-readable label
  category: SupabaseActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Supabase connected)
// ============================================================================

const ESSENTIAL_ACTIONS: SupabaseAction[] = [
  // Projects
  {
    name: 'SUPABASE_LIST_PROJECTS',
    label: 'List Projects',
    category: 'projects',
    priority: 1,
  },
  {
    name: 'SUPABASE_GET_PROJECT',
    label: 'Get Project',
    category: 'projects',
    priority: 1,
  },

  // Database - Core
  {
    name: 'SUPABASE_EXECUTE_SQL',
    label: 'Execute SQL',
    category: 'database',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SUPABASE_LIST_TABLES',
    label: 'List Tables',
    category: 'database',
    priority: 1,
  },
  {
    name: 'SUPABASE_INSERT_ROW',
    label: 'Insert Row',
    category: 'database',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SUPABASE_SELECT_ROWS',
    label: 'Select Rows',
    category: 'database',
    priority: 1,
  },

  // Functions
  {
    name: 'SUPABASE_LIST_FUNCTIONS',
    label: 'List Functions',
    category: 'functions',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: SupabaseAction[] = [
  // Database - Extended
  {
    name: 'SUPABASE_UPDATE_ROW',
    label: 'Update Row',
    category: 'database',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SUPABASE_DELETE_ROW',
    label: 'Delete Row',
    category: 'database',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SUPABASE_CREATE_TABLE',
    label: 'Create Table',
    category: 'database',
    priority: 2,
    writeOperation: true,
  },

  // Auth
  {
    name: 'SUPABASE_LIST_USERS',
    label: 'List Users',
    category: 'auth',
    priority: 2,
  },
  {
    name: 'SUPABASE_GET_USER',
    label: 'Get User',
    category: 'auth',
    priority: 2,
  },
  {
    name: 'SUPABASE_CREATE_USER',
    label: 'Create User',
    category: 'auth',
    priority: 2,
    writeOperation: true,
  },

  // Storage
  {
    name: 'SUPABASE_LIST_BUCKETS',
    label: 'List Buckets',
    category: 'storage',
    priority: 2,
  },
  {
    name: 'SUPABASE_UPLOAD_FILE',
    label: 'Upload File',
    category: 'storage',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SUPABASE_LIST_FILES',
    label: 'List Files',
    category: 'storage',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: SupabaseAction[] = [
  // Projects - Extended
  {
    name: 'SUPABASE_CREATE_PROJECT',
    label: 'Create Project',
    category: 'projects',
    priority: 3,
    writeOperation: true,
  },

  // Auth - Extended
  {
    name: 'SUPABASE_UPDATE_USER',
    label: 'Update User',
    category: 'auth',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SUPABASE_DELETE_USER',
    label: 'Delete User',
    category: 'auth',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Functions - Extended
  {
    name: 'SUPABASE_INVOKE_FUNCTION',
    label: 'Invoke Function',
    category: 'functions',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SUPABASE_CREATE_FUNCTION',
    label: 'Create Function',
    category: 'functions',
    priority: 3,
    writeOperation: true,
  },

  // Storage - Extended
  {
    name: 'SUPABASE_CREATE_BUCKET',
    label: 'Create Bucket',
    category: 'storage',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SUPABASE_DOWNLOAD_FILE',
    label: 'Download File',
    category: 'storage',
    priority: 3,
  },
  {
    name: 'SUPABASE_DELETE_FILE',
    label: 'Delete File',
    category: 'storage',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: SupabaseAction[] = [
  {
    name: 'SUPABASE_DROP_TABLE',
    label: 'Drop Table',
    category: 'database',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SUPABASE_DELETE_PROJECT',
    label: 'Delete Project',
    category: 'projects',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SUPABASE_DELETE_BUCKET',
    label: 'Delete Bucket',
    category: 'storage',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SUPABASE_DELETE_FUNCTION',
    label: 'Delete Function',
    category: 'functions',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SUPABASE_LIST_POLICIES',
    label: 'List Policies',
    category: 'database',
    priority: 4,
  },
  {
    name: 'SUPABASE_CREATE_POLICY',
    label: 'Create Policy',
    category: 'database',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_SUPABASE_ACTIONS: SupabaseAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getSupabaseFeaturedActionNames(): string[] {
  return ALL_SUPABASE_ACTIONS.map((a) => a.name);
}

export function getSupabaseActionsByPriority(maxPriority: number = 3): SupabaseAction[] {
  return ALL_SUPABASE_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getSupabaseActionNamesByPriority(maxPriority: number = 3): string[] {
  return getSupabaseActionsByPriority(maxPriority).map((a) => a.name);
}

export function getSupabaseActionsByCategory(category: SupabaseActionCategory): SupabaseAction[] {
  return ALL_SUPABASE_ACTIONS.filter((a) => a.category === category);
}

export function getSupabaseActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_SUPABASE_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownSupabaseAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SUPABASE_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveSupabaseAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SUPABASE_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Supabase action priority.
 * Known Supabase actions sorted by priority (1-4), unknown actions last.
 */
export function sortBySupabasePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getSupabaseActionPriority(a.name) - getSupabaseActionPriority(b.name);
  });
}

export function getSupabaseActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_SUPABASE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_SUPABASE_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Supabase-specific system prompt when user has Supabase connected.
 * Tells Claude exactly what it can do via the Composio Supabase toolkit.
 */
export function getSupabaseSystemPrompt(): string {
  return `
## Supabase Integration (Full Capabilities)

You have **full Supabase access** through the user's connected account. Use the \`composio_SUPABASE_*\` tools.

### Database Operations
- Execute raw SQL queries against the Postgres database
- List all tables in the database schema
- Perform CRUD operations: insert, select, update, and delete rows
- Create new tables with custom schemas
- Drop tables when no longer needed
- List and create Row Level Security (RLS) policies

### Authentication & User Management
- List all users in the auth system
- Get detailed user information by ID
- Create new users with email/password or phone
- Update user metadata, email, or password
- Delete users from the auth system

### File Storage
- List all storage buckets
- Create new storage buckets with access policies
- Upload files to storage buckets
- List files within a bucket
- Download files from storage
- Delete files from storage
- Delete entire storage buckets

### Edge Functions
- List all deployed edge functions
- Invoke edge functions with custom payloads
- Create new edge functions
- Delete edge functions

### Project Management
- List all Supabase projects in the organization
- Get project details (API keys, URLs, status)
- Create new Supabase projects
- Delete Supabase projects

### Safety Rules
1. **ALWAYS confirm before executing SQL** - show the full SQL query and explain what it will do:
\`\`\`action-preview
{
  "platform": "Supabase",
  "action": "Execute SQL",
  "query": "SQL query here",
  "description": "What this query does",
  "toolName": "composio_SUPABASE_EXECUTE_SQL",
  "toolParams": { "query": "..." }
}
\`\`\`
2. **Confirm before deleting data** - show which rows will be affected, the table name, and filter conditions
3. **Never drop tables without explicit approval** - dropping tables is permanent and destroys all data in the table
4. **Show row counts before bulk operations** - run a SELECT COUNT(*) first to show how many rows will be affected
5. **For user deletion**, clearly show the user's email and ID before proceeding - deletion is permanent
6. **For storage operations**, confirm bucket name and file paths before uploading or deleting
7. **For edge function invocation**, show the function name and payload before calling
8. **For destructive project operations**, require the project name to be confirmed - project deletion is irreversible
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getSupabaseCapabilitySummary(): string {
  const stats = getSupabaseActionStats();
  return `Supabase (${stats.total} actions: database, auth, storage, functions, projects, realtime)`;
}

export function logSupabaseToolkitStats(): void {
  const stats = getSupabaseActionStats();
  log.info('Supabase Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
