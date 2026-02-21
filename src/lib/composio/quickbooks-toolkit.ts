/**
 * COMPOSIO QUICKBOOKS TOOLKIT
 * ============================
 *
 * Comprehensive QuickBooks integration via Composio's tools.
 *
 * Categories:
 * - Invoices (create, get, list, send, update, void)
 * - Customers (create, get, list, update)
 * - Payments (create, get, list)
 * - Items (create, get, list, update)
 * - Accounts (list, get)
 * - Reports (profit/loss, balance sheet)
 */

import { logger } from '@/lib/logger';

const log = logger('QuickBooksToolkit');

export type QuickBooksActionCategory =
  | 'invoices'
  | 'customers'
  | 'payments'
  | 'items'
  | 'accounts'
  | 'reports';

export interface QuickBooksAction {
  name: string;
  label: string;
  category: QuickBooksActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: QuickBooksAction[] = [
  {
    name: 'QUICKBOOKS_CREATE_INVOICE',
    label: 'Create Invoice',
    category: 'invoices',
    priority: 1,
    writeOperation: true,
  },
  { name: 'QUICKBOOKS_GET_INVOICE', label: 'Get Invoice', category: 'invoices', priority: 1 },
  { name: 'QUICKBOOKS_LIST_INVOICES', label: 'List Invoices', category: 'invoices', priority: 1 },
  {
    name: 'QUICKBOOKS_LIST_CUSTOMERS',
    label: 'List Customers',
    category: 'customers',
    priority: 1,
  },
  {
    name: 'QUICKBOOKS_CREATE_CUSTOMER',
    label: 'Create Customer',
    category: 'customers',
    priority: 1,
    writeOperation: true,
  },
  { name: 'QUICKBOOKS_GET_CUSTOMER', label: 'Get Customer', category: 'customers', priority: 1 },
];

const IMPORTANT_ACTIONS: QuickBooksAction[] = [
  {
    name: 'QUICKBOOKS_SEND_INVOICE',
    label: 'Send Invoice',
    category: 'invoices',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'QUICKBOOKS_CREATE_PAYMENT',
    label: 'Create Payment',
    category: 'payments',
    priority: 2,
    writeOperation: true,
  },
  { name: 'QUICKBOOKS_LIST_PAYMENTS', label: 'List Payments', category: 'payments', priority: 2 },
  { name: 'QUICKBOOKS_LIST_ITEMS', label: 'List Items', category: 'items', priority: 2 },
  { name: 'QUICKBOOKS_GET_ITEM', label: 'Get Item', category: 'items', priority: 2 },
  { name: 'QUICKBOOKS_LIST_ACCOUNTS', label: 'List Accounts', category: 'accounts', priority: 2 },
];

const USEFUL_ACTIONS: QuickBooksAction[] = [
  {
    name: 'QUICKBOOKS_UPDATE_INVOICE',
    label: 'Update Invoice',
    category: 'invoices',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'QUICKBOOKS_UPDATE_CUSTOMER',
    label: 'Update Customer',
    category: 'customers',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'QUICKBOOKS_CREATE_ITEM',
    label: 'Create Item',
    category: 'items',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'QUICKBOOKS_UPDATE_ITEM',
    label: 'Update Item',
    category: 'items',
    priority: 3,
    writeOperation: true,
  },
  { name: 'QUICKBOOKS_GET_PAYMENT', label: 'Get Payment', category: 'payments', priority: 3 },
  {
    name: 'QUICKBOOKS_GET_PROFIT_LOSS',
    label: 'Get Profit & Loss Report',
    category: 'reports',
    priority: 3,
  },
  {
    name: 'QUICKBOOKS_GET_BALANCE_SHEET',
    label: 'Get Balance Sheet',
    category: 'reports',
    priority: 3,
  },
];

const ADVANCED_ACTIONS: QuickBooksAction[] = [
  {
    name: 'QUICKBOOKS_VOID_INVOICE',
    label: 'Void Invoice',
    category: 'invoices',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'QUICKBOOKS_DELETE_PAYMENT',
    label: 'Delete Payment',
    category: 'payments',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  { name: 'QUICKBOOKS_GET_ACCOUNT', label: 'Get Account', category: 'accounts', priority: 4 },
  {
    name: 'QUICKBOOKS_GET_COMPANY_INFO',
    label: 'Get Company Info',
    category: 'accounts',
    priority: 4,
  },
];

export const ALL_QUICKBOOKS_ACTIONS: QuickBooksAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getQuickBooksFeaturedActionNames(): string[] {
  return ALL_QUICKBOOKS_ACTIONS.map((a) => a.name);
}
export function getQuickBooksActionsByPriority(maxPriority: number = 3): QuickBooksAction[] {
  return ALL_QUICKBOOKS_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getQuickBooksActionNamesByPriority(maxPriority: number = 3): string[] {
  return getQuickBooksActionsByPriority(maxPriority).map((a) => a.name);
}
export function getQuickBooksActionsByCategory(
  category: QuickBooksActionCategory
): QuickBooksAction[] {
  return ALL_QUICKBOOKS_ACTIONS.filter((a) => a.category === category);
}
export function getQuickBooksActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_QUICKBOOKS_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownQuickBooksAction(toolName: string): boolean {
  return ALL_QUICKBOOKS_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveQuickBooksAction(toolName: string): boolean {
  return (
    ALL_QUICKBOOKS_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))
      ?.destructive === true
  );
}
export function sortByQuickBooksPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getQuickBooksActionPriority(a.name) - getQuickBooksActionPriority(b.name)
  );
}

export function getQuickBooksActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_QUICKBOOKS_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_QUICKBOOKS_ACTIONS.length, byPriority, byCategory };
}

export function getQuickBooksSystemPrompt(): string {
  return `
## QuickBooks Integration (Full Capabilities)

You have **full QuickBooks access** through the user's connected account. Use the \`composio_QUICKBOOKS_*\` tools.

### Invoices
- Create invoices with line items, customer, and terms
- List and search invoices by status (paid, unpaid, overdue)
- Send invoices directly to customers via email
- Update invoice details and line items
- Void invoices that should no longer be collected

### Customers
- Create and update customer profiles
- List and search customers

### Payments & Items
- Record payments against invoices
- Manage products and service items with pricing

### Reports
- Generate Profit & Loss reports
- Generate Balance Sheet reports

### Safety Rules
1. **ALWAYS confirm before creating invoices** - show customer, line items, and total amount
2. **Confirm before sending invoices** - the customer will receive an email
3. **Confirm before voiding invoices** - voiding is permanent
4. **Handle financial data with care** - amounts and account numbers are sensitive
5. **For payment recording**, verify the amount and invoice being paid
`;
}

export function getQuickBooksCapabilitySummary(): string {
  const stats = getQuickBooksActionStats();
  return `QuickBooks (${stats.total} actions: invoices, customers, payments, items, accounts, reports)`;
}

export function logQuickBooksToolkitStats(): void {
  const stats = getQuickBooksActionStats();
  log.info('QuickBooks Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
