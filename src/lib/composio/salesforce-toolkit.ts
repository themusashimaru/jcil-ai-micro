/**
 * COMPOSIO SALESFORCE TOOLKIT
 * ===========================
 *
 * Comprehensive Salesforce CRM integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Leads (create, list, get, update, convert, delete)
 * - Contacts (create, list, get, update, delete)
 * - Accounts (create, list, get, update, delete)
 * - Opportunities (create, list, get, update, delete)
 * - Cases (create, list, get, update, close, delete)
 * - Tasks (create, list, update, complete, delete)
 * - Reports (list, run)
 * - Records (search, create, get, update, delete, SOQL, describe, batch)
 */

import { logger } from '@/lib/logger';

const log = logger('SalesforceToolkit');

// ============================================================================
// SALESFORCE ACTION CATEGORIES
// ============================================================================

export type SalesforceActionCategory =
  | 'leads'
  | 'contacts'
  | 'accounts'
  | 'opportunities'
  | 'cases'
  | 'tasks'
  | 'reports'
  | 'records';

export interface SalesforceAction {
  name: string; // Composio action name (e.g., SALESFORCE_CREATE_LEAD)
  label: string; // Human-readable label
  category: SalesforceActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Salesforce connected)
// ============================================================================

const ESSENTIAL_ACTIONS: SalesforceAction[] = [
  // Leads
  {
    name: 'SALESFORCE_CREATE_LEAD',
    label: 'Create Lead',
    category: 'leads',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_LIST_LEADS',
    label: 'List Leads',
    category: 'leads',
    priority: 1,
  },
  {
    name: 'SALESFORCE_GET_LEAD',
    label: 'Get Lead',
    category: 'leads',
    priority: 1,
  },
  {
    name: 'SALESFORCE_UPDATE_LEAD',
    label: 'Update Lead',
    category: 'leads',
    priority: 1,
    writeOperation: true,
  },

  // Contacts
  {
    name: 'SALESFORCE_CREATE_CONTACT',
    label: 'Create Contact',
    category: 'contacts',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_LIST_CONTACTS',
    label: 'List Contacts',
    category: 'contacts',
    priority: 1,
  },
  {
    name: 'SALESFORCE_GET_CONTACT',
    label: 'Get Contact',
    category: 'contacts',
    priority: 1,
  },

  // Opportunities
  {
    name: 'SALESFORCE_CREATE_OPPORTUNITY',
    label: 'Create Opportunity',
    category: 'opportunities',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_LIST_OPPORTUNITIES',
    label: 'List Opportunities',
    category: 'opportunities',
    priority: 1,
  },

  // Records
  {
    name: 'SALESFORCE_SEARCH_RECORDS',
    label: 'Search Records',
    category: 'records',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: SalesforceAction[] = [
  // Contacts - Extended
  {
    name: 'SALESFORCE_UPDATE_CONTACT',
    label: 'Update Contact',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },

  // Opportunities - Extended
  {
    name: 'SALESFORCE_UPDATE_OPPORTUNITY',
    label: 'Update Opportunity',
    category: 'opportunities',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_GET_OPPORTUNITY',
    label: 'Get Opportunity',
    category: 'opportunities',
    priority: 2,
  },

  // Accounts
  {
    name: 'SALESFORCE_CREATE_ACCOUNT',
    label: 'Create Account',
    category: 'accounts',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_LIST_ACCOUNTS',
    label: 'List Accounts',
    category: 'accounts',
    priority: 2,
  },
  {
    name: 'SALESFORCE_GET_ACCOUNT',
    label: 'Get Account',
    category: 'accounts',
    priority: 2,
  },
  {
    name: 'SALESFORCE_UPDATE_ACCOUNT',
    label: 'Update Account',
    category: 'accounts',
    priority: 2,
    writeOperation: true,
  },

  // Cases
  {
    name: 'SALESFORCE_CREATE_CASE',
    label: 'Create Case',
    category: 'cases',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_LIST_CASES',
    label: 'List Cases',
    category: 'cases',
    priority: 2,
  },
  {
    name: 'SALESFORCE_GET_CASE',
    label: 'Get Case',
    category: 'cases',
    priority: 2,
  },
  {
    name: 'SALESFORCE_UPDATE_CASE',
    label: 'Update Case',
    category: 'cases',
    priority: 2,
    writeOperation: true,
  },

  // Tasks
  {
    name: 'SALESFORCE_CREATE_TASK',
    label: 'Create Task',
    category: 'tasks',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_LIST_TASKS',
    label: 'List Tasks',
    category: 'tasks',
    priority: 2,
  },

  // Leads - Extended
  {
    name: 'SALESFORCE_CONVERT_LEAD',
    label: 'Convert Lead',
    category: 'leads',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: SalesforceAction[] = [
  // Leads - Destructive
  {
    name: 'SALESFORCE_DELETE_LEAD',
    label: 'Delete Lead',
    category: 'leads',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Contacts - Destructive
  {
    name: 'SALESFORCE_DELETE_CONTACT',
    label: 'Delete Contact',
    category: 'contacts',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Opportunities - Destructive
  {
    name: 'SALESFORCE_DELETE_OPPORTUNITY',
    label: 'Delete Opportunity',
    category: 'opportunities',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Accounts - Destructive
  {
    name: 'SALESFORCE_DELETE_ACCOUNT',
    label: 'Delete Account',
    category: 'accounts',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Cases - Extended
  {
    name: 'SALESFORCE_CLOSE_CASE',
    label: 'Close Case',
    category: 'cases',
    priority: 3,
    writeOperation: true,
  },

  // Tasks - Extended
  {
    name: 'SALESFORCE_UPDATE_TASK',
    label: 'Update Task',
    category: 'tasks',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_COMPLETE_TASK',
    label: 'Complete Task',
    category: 'tasks',
    priority: 3,
    writeOperation: true,
  },

  // Reports
  {
    name: 'SALESFORCE_LIST_REPORTS',
    label: 'List Reports',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'SALESFORCE_RUN_REPORT',
    label: 'Run Report',
    category: 'reports',
    priority: 3,
  },

  // Records - Extended
  {
    name: 'SALESFORCE_CREATE_NOTE',
    label: 'Create Note',
    category: 'records',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_LIST_RECORD_TYPES',
    label: 'List Record Types',
    category: 'records',
    priority: 3,
  },
  {
    name: 'SALESFORCE_GET_RECORD',
    label: 'Get Record',
    category: 'records',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations and low-level access)
// ============================================================================

const ADVANCED_ACTIONS: SalesforceAction[] = [
  // Cases - Destructive
  {
    name: 'SALESFORCE_DELETE_CASE',
    label: 'Delete Case',
    category: 'cases',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Tasks - Destructive
  {
    name: 'SALESFORCE_DELETE_TASK',
    label: 'Delete Task',
    category: 'tasks',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Records - Advanced
  {
    name: 'SALESFORCE_EXECUTE_SOQL',
    label: 'Execute SOQL Query',
    category: 'records',
    priority: 4,
  },
  {
    name: 'SALESFORCE_CREATE_RECORD',
    label: 'Create Record',
    category: 'records',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_UPDATE_RECORD',
    label: 'Update Record',
    category: 'records',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_DELETE_RECORD',
    label: 'Delete Record',
    category: 'records',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SALESFORCE_DESCRIBE_OBJECT',
    label: 'Describe Object',
    category: 'records',
    priority: 4,
  },
  {
    name: 'SALESFORCE_LIST_OBJECTS',
    label: 'List Objects',
    category: 'records',
    priority: 4,
  },
  {
    name: 'SALESFORCE_BATCH_CREATE_RECORDS',
    label: 'Batch Create Records',
    category: 'records',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_SALESFORCE_ACTIONS: SalesforceAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getSalesforceFeaturedActionNames(): string[] {
  return ALL_SALESFORCE_ACTIONS.map((a) => a.name);
}

export function getSalesforceActionsByPriority(maxPriority: number = 3): SalesforceAction[] {
  return ALL_SALESFORCE_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getSalesforceActionNamesByPriority(maxPriority: number = 3): string[] {
  return getSalesforceActionsByPriority(maxPriority).map((a) => a.name);
}

export function getSalesforceActionsByCategory(
  category: SalesforceActionCategory
): SalesforceAction[] {
  return ALL_SALESFORCE_ACTIONS.filter((a) => a.category === category);
}

export function getSalesforceActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_SALESFORCE_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownSalesforceAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SALESFORCE_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveSalesforceAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SALESFORCE_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Salesforce action priority.
 * Known Salesforce actions sorted by priority (1-4), unknown actions last.
 */
export function sortBySalesforcePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getSalesforceActionPriority(a.name) - getSalesforceActionPriority(b.name);
  });
}

export function getSalesforceActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_SALESFORCE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_SALESFORCE_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Salesforce-specific system prompt when user has Salesforce connected.
 * Tells Claude exactly what it can do via the Composio Salesforce toolkit.
 */
export function getSalesforceSystemPrompt(): string {
  return `
## Salesforce CRM Integration (Full Capabilities)

You have **full Salesforce CRM access** through the user's connected account. Use the \`composio_SALESFORCE_*\` tools.

### Lead Management
- Create new leads with company, contact, and source information
- List and search leads by status, source, or custom criteria
- Get detailed lead information including activity history
- Update lead fields (status, rating, owner, custom fields)
- Convert qualified leads into contacts, accounts, and opportunities

### Contact & Account Management
- Create and manage contacts with full profile details
- Associate contacts with accounts and track relationships
- Create and manage company accounts with hierarchy support
- Update account details, ownership, and custom fields
- Search across contacts and accounts with flexible criteria

### Opportunity Tracking
- Create opportunities with stage, amount, and close date
- List opportunities by stage, owner, or pipeline
- Get detailed opportunity information including products and history
- Update opportunity stages, amounts, and forecasting fields
- Track opportunity progression through the sales pipeline

### Case Management
- Create support cases with priority, status, and assignment
- List and filter cases by status, priority, or owner
- Get case details including comments and activity
- Update case status, priority, and resolution
- Close cases with resolution details

### Tasks & Activities
- Create tasks assigned to users with due dates and priorities
- List tasks by status, owner, or related records
- Update task details and assignments
- Mark tasks as complete

### SOQL Queries & Records
- Execute custom SOQL queries for advanced data retrieval
- Search records across all Salesforce objects
- Create, read, update, and delete any standard or custom object record
- Describe object schemas to understand available fields
- List available Salesforce objects
- Batch create records for bulk operations

### Reports
- List available Salesforce reports
- Run reports and retrieve results

### Safety Rules
1. **ALWAYS confirm before deleting CRM data** - deletion may be permanent and can break record relationships:
\`\`\`action-preview
{
  "platform": "Salesforce",
  "action": "Delete Record",
  "recordType": "Lead/Contact/Account/Opportunity",
  "recordName": "Record name or ID",
  "toolName": "composio_SALESFORCE_DELETE_*",
  "toolParams": { "id": "..." }
}
\`\`\`
2. **Confirm before converting leads** - lead conversion creates new contacts, accounts, and opportunities and cannot be easily undone
3. **Confirm before sending communications** - verify recipient, subject, and content before any email or notification actions
4. **Never bulk delete records without explicit approval** - show the full list of records that will be affected
5. **For opportunity updates**, clearly show stage changes, amount changes, and close date modifications before applying
6. **For case management**, confirm status changes and assignments before updating
7. **Handle CRM data carefully** - always double-check record IDs, field values, and ownership assignments
8. **For batch operations**, summarize what will be created/modified and get explicit approval
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getSalesforceCapabilitySummary(): string {
  const stats = getSalesforceActionStats();
  return `Salesforce (${stats.total} actions: leads, contacts, accounts, opportunities, cases, tasks, reports, records)`;
}

export function logSalesforceToolkitStats(): void {
  const stats = getSalesforceActionStats();
  log.info('Salesforce Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
