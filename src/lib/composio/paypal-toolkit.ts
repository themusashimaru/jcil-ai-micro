/**
 * COMPOSIO PAYPAL TOOLKIT
 * =======================
 *
 * Comprehensive PayPal integration via Composio's 25 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Payments (capture, refund, get transaction details)
 * - Invoices (create, send, list, get, cancel invoices)
 * - Orders (create, get, capture orders)
 * - Subscriptions (create plans, list, manage subscriptions)
 * - Payouts (create, get batch payouts)
 */

import { logger } from '@/lib/logger';

const log = logger('PayPalToolkit');

// ============================================================================
// PAYPAL ACTION CATEGORIES
// ============================================================================

export type PayPalActionCategory = 'payments' | 'invoices' | 'orders' | 'subscriptions' | 'payouts';

export interface PayPalAction {
  name: string; // Composio action name (e.g., PAYPAL_CREATE_INVOICE)
  label: string; // Human-readable label
  category: PayPalActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when PayPal connected)
// ============================================================================

const ESSENTIAL_ACTIONS: PayPalAction[] = [
  // Invoices - Core
  {
    name: 'PAYPAL_CREATE_INVOICE',
    label: 'Create Invoice',
    category: 'invoices',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'PAYPAL_LIST_INVOICES',
    label: 'List Invoices',
    category: 'invoices',
    priority: 1,
  },
  {
    name: 'PAYPAL_GET_INVOICE',
    label: 'Get Invoice',
    category: 'invoices',
    priority: 1,
  },
  {
    name: 'PAYPAL_SEND_INVOICE',
    label: 'Send Invoice',
    category: 'invoices',
    priority: 1,
    writeOperation: true,
  },

  // Orders - Core
  {
    name: 'PAYPAL_CREATE_ORDER',
    label: 'Create Order',
    category: 'orders',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'PAYPAL_GET_ORDER',
    label: 'Get Order',
    category: 'orders',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: PayPalAction[] = [
  // Orders - Extended
  {
    name: 'PAYPAL_CAPTURE_ORDER',
    label: 'Capture Order',
    category: 'orders',
    priority: 2,
    writeOperation: true,
  },

  // Payments - Core
  {
    name: 'PAYPAL_GET_TRANSACTION_DETAILS',
    label: 'Get Transaction Details',
    category: 'payments',
    priority: 2,
  },
  {
    name: 'PAYPAL_LIST_TRANSACTIONS',
    label: 'List Transactions',
    category: 'payments',
    priority: 2,
  },
  {
    name: 'PAYPAL_CREATE_REFUND',
    label: 'Create Refund',
    category: 'payments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'PAYPAL_GET_REFUND_DETAILS',
    label: 'Get Refund Details',
    category: 'payments',
    priority: 2,
  },

  // Invoices - Extended
  {
    name: 'PAYPAL_SEND_INVOICE_REMINDER',
    label: 'Send Invoice Reminder',
    category: 'invoices',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'PAYPAL_GENERATE_INVOICE_QR_CODE',
    label: 'Generate Invoice QR Code',
    category: 'invoices',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: PayPalAction[] = [
  // Subscriptions
  {
    name: 'PAYPAL_CREATE_PRODUCT',
    label: 'Create Product',
    category: 'subscriptions',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'PAYPAL_LIST_PRODUCTS',
    label: 'List Products',
    category: 'subscriptions',
    priority: 3,
  },
  {
    name: 'PAYPAL_CREATE_SUBSCRIPTION_PLAN',
    label: 'Create Subscription Plan',
    category: 'subscriptions',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'PAYPAL_LIST_SUBSCRIPTION_PLANS',
    label: 'List Subscription Plans',
    category: 'subscriptions',
    priority: 3,
  },
  {
    name: 'PAYPAL_GET_SUBSCRIPTION_PLAN',
    label: 'Get Subscription Plan',
    category: 'subscriptions',
    priority: 3,
  },

  // Payouts - Core
  {
    name: 'PAYPAL_CREATE_PAYOUT',
    label: 'Create Payout',
    category: 'payouts',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'PAYPAL_GET_PAYOUT_BATCH',
    label: 'Get Payout Batch',
    category: 'payouts',
    priority: 3,
  },
  {
    name: 'PAYPAL_GET_PAYOUT_ITEM',
    label: 'Get Payout Item',
    category: 'payouts',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: PayPalAction[] = [
  // Invoices - Destructive
  {
    name: 'PAYPAL_CANCEL_INVOICE',
    label: 'Cancel Invoice',
    category: 'invoices',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'PAYPAL_DELETE_INVOICE',
    label: 'Delete Invoice',
    category: 'invoices',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Subscriptions - Destructive
  {
    name: 'PAYPAL_CANCEL_SUBSCRIPTION',
    label: 'Cancel Subscription',
    category: 'subscriptions',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Payouts - Destructive
  {
    name: 'PAYPAL_CANCEL_PAYOUT_ITEM',
    label: 'Cancel Payout Item',
    category: 'payouts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_PAYPAL_ACTIONS: PayPalAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getPayPalFeaturedActionNames(): string[] {
  return ALL_PAYPAL_ACTIONS.map((a) => a.name);
}

export function getPayPalActionsByPriority(maxPriority: number = 3): PayPalAction[] {
  return ALL_PAYPAL_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getPayPalActionNamesByPriority(maxPriority: number = 3): string[] {
  return getPayPalActionsByPriority(maxPriority).map((a) => a.name);
}

export function getPayPalActionsByCategory(category: PayPalActionCategory): PayPalAction[] {
  return ALL_PAYPAL_ACTIONS.filter((a) => a.category === category);
}

export function getPayPalActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_PAYPAL_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownPayPalAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_PAYPAL_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructivePayPalAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_PAYPAL_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by PayPal action priority.
 * Known PayPal actions sorted by priority (1-4), unknown actions last.
 */
export function sortByPayPalPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getPayPalActionPriority(a.name) - getPayPalActionPriority(b.name);
  });
}

export function getPayPalActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_PAYPAL_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_PAYPAL_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate PayPal-specific system prompt when user has PayPal connected.
 * Tells Claude exactly what it can do via the Composio PayPal toolkit.
 */
export function getPayPalSystemPrompt(): string {
  return `
## PayPal Integration (Full Capabilities)

You have **full PayPal access** through the user's connected account. Use the \`composio_PAYPAL_*\` tools.

### Invoices
- Create professional invoices with line items, tax, and discounts
- Send invoices to recipients via email
- List all invoices with filtering and pagination
- Get individual invoice details and status
- Send invoice reminders to recipients
- Generate QR codes for invoices
- Cancel or delete invoices (with confirmation)

### Orders
- Create payment orders with amount, currency, and description
- Get order details and status
- Capture authorized orders to complete payment

### Payments & Transactions
- Get detailed transaction information
- List transactions with date range and filtering
- Create refunds for completed payments
- Get refund details and status

### Subscriptions
- Create products for subscription billing
- List available products
- Create subscription plans with pricing tiers
- List and view subscription plan details
- Cancel subscriptions (with confirmation)

### Payouts
- Create batch payouts to multiple recipients
- Get payout batch status and details
- Get individual payout item details
- Cancel unclaimed payout items (with confirmation)

### Safety Rules
1. **ALWAYS preview before sending** - show invoice/order details using the action-preview format:
\`\`\`action-preview
{
  "platform": "PayPal",
  "action": "Send Invoice",
  "recipient": "email@example.com",
  "amount": "$100.00",
  "toolName": "composio_PAYPAL_SEND_INVOICE",
  "toolParams": { "invoice_id": "...", "subject": "...", "note": "..." }
}
\`\`\`
2. **Confirm all financial operations** - never create orders, send invoices, or process payouts without explicit user approval
3. **Double-check amounts and currencies** - always verify monetary values before submitting
4. **Never cancel without confirmation** - always show what will be cancelled and get explicit approval
5. **Show refund details** - display original transaction, refund amount, and reason before processing
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getPayPalCapabilitySummary(): string {
  const stats = getPayPalActionStats();
  return `PayPal (${stats.total} actions: payments, invoices, orders, subscriptions, payouts)`;
}

export function logPayPalToolkitStats(): void {
  const stats = getPayPalActionStats();
  log.info('PayPal Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
