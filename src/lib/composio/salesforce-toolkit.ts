/**
 * COMPOSIO SALESFORCE TOOLKIT
 * ===========================
 *
 * Comprehensive Salesforce CRM integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Leads (create, update, convert, qualify, assign, search)
 * - Opportunities (create, update, stage management, pipeline, history)
 * - Accounts (create, update, search, manage business accounts)
 * - Contacts (create, update, search, manage contact records)
 * - Cases (create, update, close, escalate, manage support cases)
 * - Reports (run reports, dashboards, analytics, SOQL queries)
 */

import { logger } from '@/lib/logger';

const log = logger('SalesforceToolkit');

// ============================================================================
// SALESFORCE ACTION CATEGORIES
// ============================================================================

export type SalesforceActionCategory =
  | 'leads'
  | 'opportunities'
  | 'accounts'
  | 'contacts'
  | 'cases'
  | 'reports';

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
  // Leads - Core
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
    name: 'SALESFORCE_SEARCH_LEADS',
    label: 'Search Leads',
    category: 'leads',
    priority: 1,
  },

  // Opportunities - Core
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
  {
    name: 'SALESFORCE_GET_OPPORTUNITY',
    label: 'Get Opportunity',
    category: 'opportunities',
    priority: 1,
  },

  // Accounts - Core
  {
    name: 'SALESFORCE_CREATE_ACCOUNT',
    label: 'Create Account',
    category: 'accounts',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_LIST_ACCOUNTS',
    label: 'List Accounts',
    category: 'accounts',
    priority: 1,
  },
  {
    name: 'SALESFORCE_GET_ACCOUNT',
    label: 'Get Account',
    category: 'accounts',
    priority: 1,
  },

  // Contacts - Core
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
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: SalesforceAction[] = [
  // Leads - Extended
  {
    name: 'SALESFORCE_UPDATE_LEAD',
    label: 'Update Lead',
    category: 'leads',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_CONVERT_LEAD',
    label: 'Convert Lead to Opportunity',
    category: 'leads',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_QUALIFY_LEAD',
    label: 'Qualify Lead',
    category: 'leads',
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
    name: 'SALESFORCE_UPDATE_OPPORTUNITY_STAGE',
    label: 'Update Opportunity Stage',
    category: 'opportunities',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_SEARCH_OPPORTUNITIES',
    label: 'Search Opportunities',
    category: 'opportunities',
    priority: 2,
  },

  // Accounts - Extended
  {
    name: 'SALESFORCE_UPDATE_ACCOUNT',
    label: 'Update Account',
    category: 'accounts',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_SEARCH_ACCOUNTS',
    label: 'Search Accounts',
    category: 'accounts',
    priority: 2,
  },

  // Contacts - Extended
  {
    name: 'SALESFORCE_GET_CONTACT',
    label: 'Get Contact',
    category: 'contacts',
    priority: 2,
  },
  {
    name: 'SALESFORCE_UPDATE_CONTACT',
    label: 'Update Contact',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_SEARCH_CONTACTS',
    label: 'Search Contacts',
    category: 'contacts',
    priority: 2,
  },

  // Cases - Core
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
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: SalesforceAction[] = [
  // Cases - Extended
  {
    name: 'SALESFORCE_GET_CASE',
    label: 'Get Case',
    category: 'cases',
    priority: 3,
  },
  {
    name: 'SALESFORCE_UPDATE_CASE',
    label: 'Update Case',
    category: 'cases',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_SEARCH_CASES',
    label: 'Search Cases',
    category: 'cases',
    priority: 3,
  },
  {
    name: 'SALESFORCE_CLOSE_CASE',
    label: 'Close Case',
    category: 'cases',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SALESFORCE_ESCALATE_CASE',
    label: 'Escalate Case',
    category: 'cases',
    priority: 3,
    writeOperation: true,
  },

  // Reports - Core
  {
    name: 'SALESFORCE_RUN_REPORT',
    label: 'Run Report',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'SALESFORCE_LIST_REPORTS',
    label: 'List Reports',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'SALESFORCE_GET_REPORT',
    label: 'Get Report Details',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'SALESFORCE_GET_DASHBOARD',
    label: 'Get Dashboard',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'SALESFORCE_LIST_DASHBOARDS',
    label: 'List Dashboards',
    category: 'reports',
    priority: 3,
  },

  // Opportunities - Pipeline
  {
    name: 'SALESFORCE_GET_PIPELINE_STAGES',
    label: 'Get Pipeline Stages',
    category: 'opportunities',
    priority: 3,
  },
  {
    name: 'SALESFORCE_GET_OPPORTUNITY_HISTORY',
    label: 'Get Opportunity History',
    category: 'opportunities',
    priority: 3,
  },

  // Leads - Extended
  {
    name: 'SALESFORCE_ASSIGN_LEAD',
    label: 'Assign Lead to Owner',
    category: 'leads',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: SalesforceAction[] = [
  // Leads - Destructive
  {
    name: 'SALESFORCE_DELETE_LEAD',
    label: 'Delete Lead',
    category: 'leads',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Opportunities - Destructive
  {
    name: 'SALESFORCE_DELETE_OPPORTUNITY',
    label: 'Delete Opportunity',
    category: 'opportunities',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Accounts - Destructive
  {
    name: 'SALESFORCE_DELETE_ACCOUNT',
    label: 'Delete Account',
    category: 'accounts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Contacts - Destructive
  {
    name: 'SALESFORCE_DELETE_CONTACT',
    label: 'Delete Contact',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Cases - Destructive
  {
    name: 'SALESFORCE_DELETE_CASE',
    label: 'Delete Case',
    category: 'cases',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Reports - Advanced
  {
    name: 'SALESFORCE_EXECUTE_SOQL',
    label: 'Execute SOQL Query',
    category: 'reports',
    priority: 4,
  },
  {
    name: 'SALESFORCE_EXPORT_REPORT',
    label: 'Export Report Data',
    category: 'reports',
    priority: 4,
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

You have **full Salesforce CRM access** through the user's connected account. Salesforce is an enterprise CRM for managing the full sales pipeline, customer relationships, support cases, and business analytics. Use the \`composio_SALESFORCE_*\` tools.

### Leads
- Create new leads with name, company, email, phone, and source
- List and search leads across the CRM
- Get detailed lead information by ID
- Update lead properties and status
- Qualify leads and update lead scoring
- Convert leads into opportunities, accounts, and contacts
- Assign leads to specific sales representatives
- Delete leads (with confirmation)

### Opportunities
- Create new opportunities with amount, stage, close date, and account
- List and search opportunities across the pipeline
- Get detailed opportunity information by ID
- Update opportunity properties and move between stages
- View pipeline stage configurations
- Track opportunity history and stage progression
- Delete opportunities (with confirmation)

### Accounts
- Create new business accounts with name, industry, and revenue
- List and search accounts across the CRM
- Get detailed account information by ID
- Update account properties and details
- Delete accounts (with confirmation)

### Contacts
- Create new contacts associated with accounts
- List and search contacts across the CRM
- Get detailed contact information by ID
- Update contact properties and details
- Delete contacts (with confirmation)

### Cases
- Create support cases with priority, status, and description
- List and search open cases
- Get detailed case information by ID
- Update case status and properties
- Close cases with resolution details
- Escalate cases to higher priority or different teams
- Delete cases (with confirmation)

### Reports & Analytics
- Run existing Salesforce reports and retrieve results
- List available reports and dashboards
- Get detailed report metadata and configurations
- View dashboard components and data
- Execute custom SOQL queries for advanced data retrieval
- Export report data for analysis

### Safety Rules
1. **ALWAYS preview before creating** - show record details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Salesforce",
  "action": "Create Lead",
  "details": "Name: Jane Smith, Company: Acme Corp, Email: jane@acme.com",
  "toolName": "composio_SALESFORCE_CREATE_LEAD",
  "toolParams": { "FirstName": "Jane", "LastName": "Smith", "Company": "Acme Corp" }
}
\`\`\`
2. **Confirm before converting leads** - show what opportunity, account, and contact will be created
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For stage changes**, show the current stage and proposed new stage before updating
5. **For SOQL queries**, preview the query before executing to avoid unintended data access
6. **Verify account exists** before associating contacts, opportunities, or cases
7. **Handle duplicate records gracefully** - search before creating to avoid duplicates
8. **Respect data integrity** - warn when updating critical fields like opportunity amount or close date
9. **For case escalation**, confirm the new priority and assignment before proceeding
10. **For bulk operations**, show a summary of all records that will be affected
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getSalesforceCapabilitySummary(): string {
  const stats = getSalesforceActionStats();
  return `Salesforce CRM (${stats.total} actions: leads, opportunities, accounts, contacts, cases, reports)`;
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
