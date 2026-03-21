/**
 * COMPOSIO FRESHBOOKS TOOLKIT
 * ============================
 *
 * Comprehensive FreshBooks integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Invoices (create, send, list, update invoices)
 * - Clients (create, update, search clients)
 * - Expenses (create, list, categorize expenses)
 * - Payments (get payments, record payments)
 * - Reports (profit/loss, tax summary, account aging)
 */

import { logger } from '@/lib/logger';

const log = logger('FreshBooksToolkit');

// ============================================================================
// FRESHBOOKS ACTION CATEGORIES
// ============================================================================

export type FreshBooksActionCategory = 'invoices' | 'clients' | 'expenses' | 'payments' | 'reports';

export interface FreshBooksAction {
  name: string; // Composio action name (e.g., FRESHBOOKS_CREATE_INVOICE)
  label: string; // Human-readable label
  category: FreshBooksActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when FreshBooks connected)
// ============================================================================

const ESSENTIAL_ACTIONS: FreshBooksAction[] = [
  // Invoices - Core
  {
    name: 'FRESHBOOKS_CREATE_INVOICE',
    label: 'Create Invoice',
    category: 'invoices',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'FRESHBOOKS_SEND_INVOICE',
    label: 'Send Invoice',
    category: 'invoices',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'FRESHBOOKS_LIST_INVOICES',
    label: 'List Invoices',
    category: 'invoices',
    priority: 1,
  },
  {
    name: 'FRESHBOOKS_GET_INVOICE',
    label: 'Get Invoice Details',
    category: 'invoices',
    priority: 1,
  },

  // Clients - Core
  {
    name: 'FRESHBOOKS_CREATE_CLIENT',
    label: 'Create Client',
    category: 'clients',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'FRESHBOOKS_LIST_CLIENTS',
    label: 'List Clients',
    category: 'clients',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: FreshBooksAction[] = [
  // Expenses - Core
  {
    name: 'FRESHBOOKS_CREATE_EXPENSE',
    label: 'Create Expense',
    category: 'expenses',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'FRESHBOOKS_LIST_EXPENSES',
    label: 'List Expenses',
    category: 'expenses',
    priority: 2,
  },
  {
    name: 'FRESHBOOKS_GET_EXPENSE',
    label: 'Get Expense Details',
    category: 'expenses',
    priority: 2,
  },

  // Payments - Core
  {
    name: 'FRESHBOOKS_GET_PAYMENTS',
    label: 'Get Payments',
    category: 'payments',
    priority: 2,
  },
  {
    name: 'FRESHBOOKS_RECORD_PAYMENT',
    label: 'Record Payment',
    category: 'payments',
    priority: 2,
    writeOperation: true,
  },

  // Clients - Extended
  {
    name: 'FRESHBOOKS_GET_CLIENT',
    label: 'Get Client Details',
    category: 'clients',
    priority: 2,
  },
  {
    name: 'FRESHBOOKS_UPDATE_CLIENT',
    label: 'Update Client',
    category: 'clients',
    priority: 2,
    writeOperation: true,
  },

  // Invoices - Extended
  {
    name: 'FRESHBOOKS_UPDATE_INVOICE',
    label: 'Update Invoice',
    category: 'invoices',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: FreshBooksAction[] = [
  // Reports
  {
    name: 'FRESHBOOKS_GET_PROFIT_LOSS',
    label: 'Get Profit & Loss Report',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'FRESHBOOKS_GET_TAX_SUMMARY',
    label: 'Get Tax Summary',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'FRESHBOOKS_GET_ACCOUNT_AGING',
    label: 'Get Account Aging Report',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'FRESHBOOKS_GET_EXPENSE_REPORT',
    label: 'Get Expense Report',
    category: 'reports',
    priority: 3,
  },

  // Expenses - Extended
  {
    name: 'FRESHBOOKS_UPDATE_EXPENSE',
    label: 'Update Expense',
    category: 'expenses',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'FRESHBOOKS_CATEGORIZE_EXPENSE',
    label: 'Categorize Expense',
    category: 'expenses',
    priority: 3,
    writeOperation: true,
  },

  // Invoices - Extended
  {
    name: 'FRESHBOOKS_MARK_INVOICE_PAID',
    label: 'Mark Invoice as Paid',
    category: 'invoices',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'FRESHBOOKS_DUPLICATE_INVOICE',
    label: 'Duplicate Invoice',
    category: 'invoices',
    priority: 3,
    writeOperation: true,
  },

  // Payments - Extended
  {
    name: 'FRESHBOOKS_GET_PAYMENT_DETAILS',
    label: 'Get Payment Details',
    category: 'payments',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: FreshBooksAction[] = [
  // Invoices - Destructive
  {
    name: 'FRESHBOOKS_DELETE_INVOICE',
    label: 'Delete Invoice',
    category: 'invoices',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'FRESHBOOKS_VOID_INVOICE',
    label: 'Void Invoice',
    category: 'invoices',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Clients - Destructive
  {
    name: 'FRESHBOOKS_DELETE_CLIENT',
    label: 'Delete Client',
    category: 'clients',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Expenses - Destructive
  {
    name: 'FRESHBOOKS_DELETE_EXPENSE',
    label: 'Delete Expense',
    category: 'expenses',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Payments - Destructive
  {
    name: 'FRESHBOOKS_DELETE_PAYMENT',
    label: 'Delete Payment',
    category: 'payments',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_FRESHBOOKS_ACTIONS: FreshBooksAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getFreshBooksFeaturedActionNames(): string[] {
  return ALL_FRESHBOOKS_ACTIONS.map((a) => a.name);
}

export function getFreshBooksActionsByPriority(maxPriority: number = 3): FreshBooksAction[] {
  return ALL_FRESHBOOKS_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getFreshBooksActionNamesByPriority(maxPriority: number = 3): string[] {
  return getFreshBooksActionsByPriority(maxPriority).map((a) => a.name);
}

export function getFreshBooksActionsByCategory(
  category: FreshBooksActionCategory
): FreshBooksAction[] {
  return ALL_FRESHBOOKS_ACTIONS.filter((a) => a.category === category);
}

export function getFreshBooksActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_FRESHBOOKS_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownFreshBooksAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_FRESHBOOKS_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveFreshBooksAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_FRESHBOOKS_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by FreshBooks action priority.
 * Known FreshBooks actions sorted by priority (1-4), unknown actions last.
 */
export function sortByFreshBooksPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getFreshBooksActionPriority(a.name) - getFreshBooksActionPriority(b.name);
  });
}

export function getFreshBooksActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_FRESHBOOKS_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_FRESHBOOKS_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate FreshBooks-specific system prompt when user has FreshBooks connected.
 * Tells Claude exactly what it can do via the Composio FreshBooks toolkit.
 */
export function getFreshBooksSystemPrompt(): string {
  return `
## FreshBooks Integration (Full Capabilities)

You have **full FreshBooks access** through the user's connected account. Use the \`composio_FRESHBOOKS_*\` tools.

### Invoices
- Create and send professional invoices
- List and search invoices by status, date, or client
- Get detailed invoice information
- Update existing invoices
- Mark invoices as paid
- Duplicate invoices for recurring billing
- Delete or void invoices (with confirmation)

### Clients
- Create new client profiles with contact details
- List and search clients
- Get client details and history
- Update client information
- Delete clients (with confirmation)

### Expenses
- Create and record business expenses
- List and search expenses by category or date
- Get expense details
- Update and categorize expenses
- Delete expenses (with confirmation)

### Payments
- View payment history and details
- Record manual payments against invoices
- Get detailed payment information
- Delete payment records (with confirmation)

### Reports
- Generate Profit & Loss reports
- View tax summaries for tax preparation
- Get account aging reports for outstanding receivables
- Generate expense reports by category and period

### Safety Rules
1. **ALWAYS preview before creating** - show invoice/expense details using the action-preview format:
\`\`\`action-preview
{
  "platform": "FreshBooks",
  "action": "Create Invoice",
  "client": "Client Name",
  "amount": "$XX.XX",
  "toolName": "composio_FRESHBOOKS_CREATE_INVOICE",
  "toolParams": { "client_id": "...", "lines": [...] }
}
\`\`\`
2. **Confirm amounts before sending** - verify invoice totals and line items with the user
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For payments**, show the invoice and payment amount before recording
5. **For expenses**, confirm the category and amount before creating
6. **Handle currency correctly** - verify the user's default currency
7. **For reports**, confirm the date range before generating
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getFreshBooksCapabilitySummary(): string {
  const stats = getFreshBooksActionStats();
  return `FreshBooks (${stats.total} actions: invoices, clients, expenses, payments, reports)`;
}

export function logFreshBooksToolkitStats(): void {
  const stats = getFreshBooksActionStats();
  log.info('FreshBooks Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
