/**
 * COMPOSIO SQUARE TOOLKIT
 * =======================
 *
 * Comprehensive Square integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Payments (create payments, refunds, checkout)
 * - Invoices (create, send, list invoices)
 * - Orders (create, update, search orders)
 * - Customers (create, update, search customers)
 * - Catalog (list, search, create catalog items)
 */

import { logger } from '@/lib/logger';

const log = logger('SquareToolkit');

// ============================================================================
// SQUARE ACTION CATEGORIES
// ============================================================================

export type SquareActionCategory = 'payments' | 'invoices' | 'orders' | 'customers' | 'catalog';

export interface SquareAction {
  name: string; // Composio action name (e.g., SQUARE_CREATE_PAYMENT)
  label: string; // Human-readable label
  category: SquareActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Square connected)
// ============================================================================

const ESSENTIAL_ACTIONS: SquareAction[] = [
  // Payments - Core
  {
    name: 'SQUARE_CREATE_PAYMENT',
    label: 'Create Payment',
    category: 'payments',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SQUARE_LIST_PAYMENTS',
    label: 'List Payments',
    category: 'payments',
    priority: 1,
  },
  {
    name: 'SQUARE_GET_PAYMENT',
    label: 'Get Payment Details',
    category: 'payments',
    priority: 1,
  },

  // Customers - Core
  {
    name: 'SQUARE_CREATE_CUSTOMER',
    label: 'Create Customer',
    category: 'customers',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SQUARE_SEARCH_CUSTOMERS',
    label: 'Search Customers',
    category: 'customers',
    priority: 1,
  },

  // Orders - Core
  {
    name: 'SQUARE_CREATE_ORDER',
    label: 'Create Order',
    category: 'orders',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SQUARE_GET_ORDER',
    label: 'Get Order Details',
    category: 'orders',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: SquareAction[] = [
  // Invoices
  {
    name: 'SQUARE_CREATE_INVOICE',
    label: 'Create Invoice',
    category: 'invoices',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SQUARE_SEND_INVOICE',
    label: 'Send Invoice',
    category: 'invoices',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SQUARE_LIST_INVOICES',
    label: 'List Invoices',
    category: 'invoices',
    priority: 2,
  },
  {
    name: 'SQUARE_GET_INVOICE',
    label: 'Get Invoice Details',
    category: 'invoices',
    priority: 2,
  },

  // Payments - Extended
  {
    name: 'SQUARE_CREATE_CHECKOUT',
    label: 'Create Checkout',
    category: 'payments',
    priority: 2,
    writeOperation: true,
  },

  // Catalog - Core
  {
    name: 'SQUARE_LIST_CATALOG',
    label: 'List Catalog Items',
    category: 'catalog',
    priority: 2,
  },
  {
    name: 'SQUARE_SEARCH_CATALOG',
    label: 'Search Catalog',
    category: 'catalog',
    priority: 2,
  },

  // Orders - Extended
  {
    name: 'SQUARE_SEARCH_ORDERS',
    label: 'Search Orders',
    category: 'orders',
    priority: 2,
  },
  {
    name: 'SQUARE_UPDATE_ORDER',
    label: 'Update Order',
    category: 'orders',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: SquareAction[] = [
  // Payments - Extended
  {
    name: 'SQUARE_CREATE_REFUND',
    label: 'Create Refund',
    category: 'payments',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SQUARE_GET_REFUND',
    label: 'Get Refund Details',
    category: 'payments',
    priority: 3,
  },

  // Customers - Extended
  {
    name: 'SQUARE_GET_CUSTOMER',
    label: 'Get Customer Details',
    category: 'customers',
    priority: 3,
  },
  {
    name: 'SQUARE_UPDATE_CUSTOMER',
    label: 'Update Customer',
    category: 'customers',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SQUARE_LIST_CUSTOMERS',
    label: 'List Customers',
    category: 'customers',
    priority: 3,
  },

  // Catalog - Extended
  {
    name: 'SQUARE_CREATE_CATALOG_ITEM',
    label: 'Create Catalog Item',
    category: 'catalog',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SQUARE_GET_CATALOG_ITEM',
    label: 'Get Catalog Item',
    category: 'catalog',
    priority: 3,
  },

  // Invoices - Extended
  {
    name: 'SQUARE_UPDATE_INVOICE',
    label: 'Update Invoice',
    category: 'invoices',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SQUARE_PUBLISH_INVOICE',
    label: 'Publish Invoice',
    category: 'invoices',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: SquareAction[] = [
  // Payments - Destructive
  {
    name: 'SQUARE_CANCEL_PAYMENT',
    label: 'Cancel Payment',
    category: 'payments',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Invoices - Destructive
  {
    name: 'SQUARE_CANCEL_INVOICE',
    label: 'Cancel Invoice',
    category: 'invoices',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SQUARE_DELETE_INVOICE',
    label: 'Delete Invoice',
    category: 'invoices',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Customers - Destructive
  {
    name: 'SQUARE_DELETE_CUSTOMER',
    label: 'Delete Customer',
    category: 'customers',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Catalog - Destructive
  {
    name: 'SQUARE_DELETE_CATALOG_ITEM',
    label: 'Delete Catalog Item',
    category: 'catalog',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Orders - Destructive
  {
    name: 'SQUARE_CANCEL_ORDER',
    label: 'Cancel Order',
    category: 'orders',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_SQUARE_ACTIONS: SquareAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getSquareFeaturedActionNames(): string[] {
  return ALL_SQUARE_ACTIONS.map((a) => a.name);
}

export function getSquareActionsByPriority(maxPriority: number = 3): SquareAction[] {
  return ALL_SQUARE_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getSquareActionNamesByPriority(maxPriority: number = 3): string[] {
  return getSquareActionsByPriority(maxPriority).map((a) => a.name);
}

export function getSquareActionsByCategory(category: SquareActionCategory): SquareAction[] {
  return ALL_SQUARE_ACTIONS.filter((a) => a.category === category);
}

export function getSquareActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_SQUARE_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownSquareAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SQUARE_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveSquareAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SQUARE_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Square action priority.
 * Known Square actions sorted by priority (1-4), unknown actions last.
 */
export function sortBySquarePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getSquareActionPriority(a.name) - getSquareActionPriority(b.name);
  });
}

export function getSquareActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_SQUARE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_SQUARE_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Square-specific system prompt when user has Square connected.
 * Tells Claude exactly what it can do via the Composio Square toolkit.
 */
export function getSquareSystemPrompt(): string {
  return `
## Square Integration (Full Capabilities)

You have **full Square access** through the user's connected account. Use the \`composio_SQUARE_*\` tools.

### Payments
- Create payments and process transactions
- List and search payment history
- Get detailed payment information
- Create checkout links for customers
- Process refunds on existing payments
- Cancel pending payments (with confirmation)

### Invoices
- Create, send, and publish invoices
- List and search invoices
- Get invoice details and status
- Update existing invoices
- Cancel or delete invoices (with confirmation)

### Orders
- Create new orders with line items
- Search and filter orders
- Get order details
- Update existing orders
- Cancel orders (with confirmation)

### Customers
- Create new customer profiles
- Search and list customers
- Get customer details
- Update customer information
- Delete customers (with confirmation)

### Catalog
- List and search catalog items
- Get catalog item details
- Create new catalog items
- Delete catalog items (with confirmation)

### Safety Rules
1. **ALWAYS preview before creating** - show transaction details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Square",
  "action": "Create Payment",
  "amount": "$XX.XX",
  "toolName": "composio_SQUARE_CREATE_PAYMENT",
  "toolParams": { "amount_money": { "amount": 0, "currency": "USD" } }
}
\`\`\`
2. **Confirm amounts before processing** - verify payment amounts with the user
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For refunds**, show the original payment and refund amount before processing
5. **For invoices**, preview all line items and recipient before sending
6. **Handle currency correctly** - Square uses the smallest currency unit (cents for USD)
7. **Respect idempotency** - use idempotency keys for payment operations
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getSquareCapabilitySummary(): string {
  const stats = getSquareActionStats();
  return `Square (${stats.total} actions: payments, invoices, orders, customers, catalog)`;
}

export function logSquareToolkitStats(): void {
  const stats = getSquareActionStats();
  log.info('Square Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
