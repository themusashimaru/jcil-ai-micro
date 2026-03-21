/**
 * COMPOSIO XERO TOOLKIT
 * =====================
 *
 * Comprehensive Xero accounting integration via Composio's 39 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Invoices (create, list, get, update invoices and credit notes)
 * - Contacts (create, list, get, update contacts)
 * - Accounts (list accounts, tax rates, tracking categories)
 * - Payments (create, list payments and bank transactions)
 * - Reports (profit & loss, balance sheet, budgets, journals)
 */

import { logger } from '@/lib/logger';

const log = logger('XeroToolkit');

// ============================================================================
// XERO ACTION CATEGORIES
// ============================================================================

export type XeroActionCategory = 'invoices' | 'contacts' | 'accounts' | 'payments' | 'reports';

export interface XeroAction {
  name: string; // Composio action name (e.g., XERO_CREATE_INVOICE)
  label: string; // Human-readable label
  category: XeroActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Xero connected)
// ============================================================================

const ESSENTIAL_ACTIONS: XeroAction[] = [
  // Connection
  {
    name: 'XERO_GET_CONNECTIONS',
    label: 'Get Connections',
    category: 'accounts',
    priority: 1,
  },
  {
    name: 'XERO_GET_ORGANISATION',
    label: 'Get Organisation',
    category: 'accounts',
    priority: 1,
  },

  // Invoices - Core
  {
    name: 'XERO_CREATE_INVOICE',
    label: 'Create Invoice',
    category: 'invoices',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'XERO_LIST_INVOICES',
    label: 'List Invoices',
    category: 'invoices',
    priority: 1,
  },
  {
    name: 'XERO_GET_INVOICE',
    label: 'Get Invoice',
    category: 'invoices',
    priority: 1,
  },

  // Contacts - Core
  {
    name: 'XERO_CREATE_CONTACT',
    label: 'Create Contact',
    category: 'contacts',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'XERO_GET_CONTACTS',
    label: 'List Contacts',
    category: 'contacts',
    priority: 1,
  },

  // Payments - Core
  {
    name: 'XERO_CREATE_PAYMENT',
    label: 'Create Payment',
    category: 'payments',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: XeroAction[] = [
  // Invoices - Extended
  {
    name: 'XERO_POST_INVOICE_UPDATE',
    label: 'Update Invoice',
    category: 'invoices',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'XERO_LIST_CREDIT_NOTES',
    label: 'List Credit Notes',
    category: 'invoices',
    priority: 2,
  },

  // Contacts - Extended
  {
    name: 'XERO_UPDATE_CONTACT',
    label: 'Update Contact',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },

  // Accounts - Core
  {
    name: 'XERO_LIST_ACCOUNTS',
    label: 'List Accounts',
    category: 'accounts',
    priority: 2,
  },
  {
    name: 'XERO_GET_ACCOUNT',
    label: 'Get Account',
    category: 'accounts',
    priority: 2,
  },

  // Payments - Extended
  {
    name: 'XERO_LIST_PAYMENTS',
    label: 'List Payments',
    category: 'payments',
    priority: 2,
  },
  {
    name: 'XERO_CREATE_BANK_TRANSACTION',
    label: 'Create Bank Transaction',
    category: 'payments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'XERO_LIST_BANK_TRANSACTIONS',
    label: 'List Bank Transactions',
    category: 'payments',
    priority: 2,
  },

  // Reports - Core
  {
    name: 'XERO_GET_PROFIT_LOSS_REPORT',
    label: 'Get Profit & Loss Report',
    category: 'reports',
    priority: 2,
  },
  {
    name: 'XERO_GET_BALANCE_SHEET_REPORT',
    label: 'Get Balance Sheet Report',
    category: 'reports',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: XeroAction[] = [
  // Items
  {
    name: 'XERO_CREATE_ITEM',
    label: 'Create Item',
    category: 'accounts',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'XERO_LIST_ITEMS',
    label: 'List Items',
    category: 'accounts',
    priority: 3,
  },
  {
    name: 'XERO_GET_ITEM',
    label: 'Get Item',
    category: 'accounts',
    priority: 3,
  },

  // Purchase Orders
  {
    name: 'XERO_CREATE_PURCHASE_ORDER',
    label: 'Create Purchase Order',
    category: 'payments',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'XERO_LIST_PURCHASE_ORDERS',
    label: 'List Purchase Orders',
    category: 'payments',
    priority: 3,
  },
  {
    name: 'XERO_GET_PURCHASE_ORDER',
    label: 'Get Purchase Order',
    category: 'payments',
    priority: 3,
  },

  // Quotes
  {
    name: 'XERO_GET_QUOTES',
    label: 'List Quotes',
    category: 'invoices',
    priority: 3,
  },

  // Tax & Tracking
  {
    name: 'XERO_LIST_TAX_RATES',
    label: 'List Tax Rates',
    category: 'accounts',
    priority: 3,
  },
  {
    name: 'XERO_LIST_TRACKING_CATEGORIES',
    label: 'List Tracking Categories',
    category: 'accounts',
    priority: 3,
  },

  // Reports - Extended
  {
    name: 'XERO_GET_BUDGET',
    label: 'Get Budget',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'XERO_LIST_JOURNALS',
    label: 'List Journals',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'XERO_GET_MANUAL_JOURNAL',
    label: 'Get Manual Journal',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'XERO_LIST_MANUAL_JOURNALS',
    label: 'List Manual Journals',
    category: 'reports',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Specialized operations & asset management)
// ============================================================================

const ADVANCED_ACTIONS: XeroAction[] = [
  // Assets
  {
    name: 'XERO_GET_ASSET',
    label: 'Get Asset',
    category: 'accounts',
    priority: 4,
  },
  {
    name: 'XERO_LIST_ASSETS',
    label: 'List Assets',
    category: 'accounts',
    priority: 4,
  },

  // Files
  {
    name: 'XERO_LIST_FILES',
    label: 'List Files',
    category: 'reports',
    priority: 4,
  },
  {
    name: 'XERO_LIST_FOLDERS',
    label: 'List Folders',
    category: 'reports',
    priority: 4,
  },
  {
    name: 'XERO_LIST_ATTACHMENTS',
    label: 'List Attachments',
    category: 'reports',
    priority: 4,
  },
  {
    name: 'XERO_UPLOAD_ATTACHMENT',
    label: 'Upload Attachment',
    category: 'reports',
    priority: 4,
    writeOperation: true,
  },

  // Projects
  {
    name: 'XERO_GET_PROJECT',
    label: 'Get Project',
    category: 'reports',
    priority: 4,
  },
  {
    name: 'XERO_LIST_PROJECTS',
    label: 'List Projects',
    category: 'reports',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_XERO_ACTIONS: XeroAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getXeroFeaturedActionNames(): string[] {
  return ALL_XERO_ACTIONS.map((a) => a.name);
}

export function getXeroActionsByPriority(maxPriority: number = 3): XeroAction[] {
  return ALL_XERO_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getXeroActionNamesByPriority(maxPriority: number = 3): string[] {
  return getXeroActionsByPriority(maxPriority).map((a) => a.name);
}

export function getXeroActionsByCategory(category: XeroActionCategory): XeroAction[] {
  return ALL_XERO_ACTIONS.filter((a) => a.category === category);
}

export function getXeroActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_XERO_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownXeroAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_XERO_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveXeroAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_XERO_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Xero action priority.
 * Known Xero actions sorted by priority (1-4), unknown actions last.
 */
export function sortByXeroPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getXeroActionPriority(a.name) - getXeroActionPriority(b.name);
  });
}

export function getXeroActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_XERO_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_XERO_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Xero-specific system prompt when user has Xero connected.
 * Tells Claude exactly what it can do via the Composio Xero toolkit.
 */
export function getXeroSystemPrompt(): string {
  return `
## Xero Integration (Full Capabilities)

You have **full Xero access** through the user's connected account. Use the \`composio_XERO_*\` tools.

### Invoices & Billing
- Create sales invoices and purchase bills with line items
- List all invoices with filtering and pagination
- Get individual invoice details
- Update existing invoices (status, amounts, due dates, line items)
- List credit notes
- List and filter quotes

### Contacts
- Create new contacts (customers, suppliers)
- List all contacts with filtering and search
- Update existing contact details

### Chart of Accounts
- List all accounts in the chart of accounts
- Get individual account details
- Create and manage inventory items
- List tax rates for invoice line items
- List tracking categories for cost allocation
- View and list fixed assets
- Get organisation details

### Payments & Banking
- Create payments linked to invoices
- List all payments with filtering
- Create bank transactions (spend/receive)
- List bank transactions
- Create purchase orders
- List and view purchase orders

### Reports & Analytics
- Generate Profit & Loss reports
- Generate Balance Sheet reports
- View budget data
- List and view journals and manual journals
- List projects and get project details
- Manage files, folders, and attachments

### Safety Rules
1. **ALWAYS preview before creating** - show invoice/payment details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Xero",
  "action": "Create Invoice",
  "contact": "Customer Name",
  "amount": "$1,500.00",
  "toolName": "composio_XERO_CREATE_INVOICE",
  "toolParams": { "contact_id": "...", "line_items": [...], "due_date": "..." }
}
\`\`\`
2. **Verify tenant connection** - always call XERO_GET_CONNECTIONS first to get the correct tenant ID
3. **Confirm all financial operations** - never create invoices, payments, or transactions without explicit user approval
4. **Double-check amounts and tax rates** - always verify monetary values and applicable tax rates
5. **Preview updates** - show before/after for invoice and contact updates
6. **Use correct account codes** - list accounts first to find the right account codes for transactions
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getXeroCapabilitySummary(): string {
  const stats = getXeroActionStats();
  return `Xero (${stats.total} actions: invoices, contacts, accounts, payments, reports)`;
}

export function logXeroToolkitStats(): void {
  const stats = getXeroActionStats();
  log.info('Xero Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
