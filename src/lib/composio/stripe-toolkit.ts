/**
 * COMPOSIO STRIPE TOOLKIT
 * =======================
 *
 * Comprehensive Stripe integration via Composio's 624 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Payments (intents, charges, refunds, checkout, payment links, methods)
 * - Customers (create, manage, balance, tax IDs)
 * - Subscriptions (create, cancel, items, billing portal, usage)
 * - Invoicing (invoices, credit notes, quotes, previews)
 * - Products (products, prices, coupons, promotions, tax/shipping rates)
 * - Terminal (locations, readers)
 * - Account (files, reports, ephemeral keys)
 */

import { logger } from '@/lib/logger';

const log = logger('StripeToolkit');

// ============================================================================
// STRIPE ACTION CATEGORIES
// ============================================================================

export type StripeActionCategory =
  | 'payments'
  | 'customers'
  | 'subscriptions'
  | 'invoicing'
  | 'products'
  | 'terminal'
  | 'account';

export interface StripeAction {
  name: string; // Composio action name (e.g., STRIPE_CREATE_CUSTOMER)
  label: string; // Human-readable label
  category: StripeActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Stripe connected)
// ============================================================================

const ESSENTIAL_ACTIONS: StripeAction[] = [
  // Customers
  {
    name: 'STRIPE_CREATE_CUSTOMER',
    label: 'Create Customer',
    category: 'customers',
    priority: 1,
    writeOperation: true,
  },

  // Payments - Core
  {
    name: 'STRIPE_CREATE_PAYMENT_INTENT',
    label: 'Create Payment Intent',
    category: 'payments',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_CHECKOUT_SESSION',
    label: 'Create Checkout',
    category: 'payments',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CONFIRM_PAYMENT_INTENT',
    label: 'Confirm Payment',
    category: 'payments',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CAPTURE_PAYMENT_INTENT',
    label: 'Capture Payment',
    category: 'payments',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_REFUND',
    label: 'Create Refund',
    category: 'payments',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_PAYMENT_LINK',
    label: 'Create Payment Link',
    category: 'payments',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'STRIPE_ATTACH_PAYMENT_METHOD',
    label: 'Attach Payment Method',
    category: 'payments',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_PAYMENT_METHOD',
    label: 'Create Payment Method',
    category: 'payments',
    priority: 1,
    writeOperation: true,
  },

  // Invoicing
  {
    name: 'STRIPE_CREATE_INVOICE',
    label: 'Create Invoice',
    category: 'invoicing',
    priority: 1,
    writeOperation: true,
  },

  // Products
  {
    name: 'STRIPE_CREATE_PRODUCT',
    label: 'Create Product',
    category: 'products',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_PRICE',
    label: 'Create Price',
    category: 'products',
    priority: 1,
    writeOperation: true,
  },

  // Subscriptions
  {
    name: 'STRIPE_CREATE_SUBSCRIPTION',
    label: 'Create Subscription',
    category: 'subscriptions',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CANCEL_SUBSCRIPTION',
    label: 'Cancel Subscription',
    category: 'subscriptions',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_BILLING_PORTAL_SESSION',
    label: 'Billing Portal',
    category: 'subscriptions',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: StripeAction[] = [
  // Payments - Extended
  {
    name: 'STRIPE_CANCEL_PAYMENT_INTENT',
    label: 'Cancel Payment',
    category: 'payments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CAPTURE_CHARGE',
    label: 'Capture Charge',
    category: 'payments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_SETUP_INTENT',
    label: 'Create Setup Intent',
    category: 'payments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CONFIRM_SETUP_INTENT',
    label: 'Confirm Setup',
    category: 'payments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CANCEL_SETUP_INTENT',
    label: 'Cancel Setup',
    category: 'payments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_SOURCE',
    label: 'Create Source',
    category: 'payments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_PAYMENT_METHOD_DOMAIN',
    label: 'Payment Method Domain',
    category: 'payments',
    priority: 2,
    writeOperation: true,
  },

  // Products - Extended
  {
    name: 'STRIPE_CREATE_COUPON',
    label: 'Create Coupon',
    category: 'products',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_PROMOTION_CODE',
    label: 'Create Promo Code',
    category: 'products',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_TAX_RATE',
    label: 'Create Tax Rate',
    category: 'products',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_SHIPPING_RATE',
    label: 'Create Shipping Rate',
    category: 'products',
    priority: 2,
    writeOperation: true,
  },

  // Invoicing - Extended
  {
    name: 'STRIPE_CREATE_CREDIT_NOTE',
    label: 'Create Credit Note',
    category: 'invoicing',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_QUOTE',
    label: 'Create Quote',
    category: 'invoicing',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_ACCEPT_QUOTE',
    label: 'Accept Quote',
    category: 'invoicing',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CANCEL_QUOTE',
    label: 'Cancel Quote',
    category: 'invoicing',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_ADD_INVOICE_LINES',
    label: 'Add Invoice Lines',
    category: 'invoicing',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_PREVIEW_INVOICE',
    label: 'Preview Invoice',
    category: 'invoicing',
    priority: 2,
  },

  // Subscriptions - Extended
  {
    name: 'STRIPE_CREATE_SUBSCRIPTION_ITEM',
    label: 'Add Sub Item',
    category: 'subscriptions',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_USAGE_RECORD',
    label: 'Track Usage',
    category: 'subscriptions',
    priority: 2,
    writeOperation: true,
  },

  // Customers - Extended
  {
    name: 'STRIPE_CREATE_CUSTOMER_BALANCE_TRANSACTION',
    label: 'Customer Balance',
    category: 'customers',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_APPLY_CUSTOMER_BALANCE',
    label: 'Apply Balance',
    category: 'customers',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_CUSTOMER_TAX_ID',
    label: 'Add Tax ID',
    category: 'customers',
    priority: 2,
    writeOperation: true,
  },

  // Account
  {
    name: 'STRIPE_CREATE_FILE',
    label: 'Upload File',
    category: 'account',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_FILE_LINK',
    label: 'Create File Link',
    category: 'account',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_REPORT_RUN',
    label: 'Create Report',
    category: 'account',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: StripeAction[] = [
  // Payments - Extended
  {
    name: 'STRIPE_CREATE_CARD',
    label: 'Create Card',
    category: 'payments',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_CVC_UPDATE_TOKEN',
    label: 'CVC Update Token',
    category: 'payments',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_TEST_CONFIRMATION_TOKEN',
    label: 'Test Token',
    category: 'payments',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'STRIPE_APPLY_CUSTOMER_BALANCE_TO_PAYMENT_INTENT',
    label: 'Apply Balance to Payment',
    category: 'payments',
    priority: 3,
    writeOperation: true,
  },

  // Customers - Extended
  {
    name: 'STRIPE_CREATE_CUSTOMER_SESSION',
    label: 'Customer Session',
    category: 'customers',
    priority: 3,
    writeOperation: true,
  },

  // Terminal
  {
    name: 'STRIPE_CREATE_TERMINAL_LOCATION',
    label: 'Terminal Location',
    category: 'terminal',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'STRIPE_CREATE_TERMINAL_READER',
    label: 'Terminal Reader',
    category: 'terminal',
    priority: 3,
    writeOperation: true,
  },

  // Account - Extended
  {
    name: 'STRIPE_CREATE_EPHEMERAL_KEY',
    label: 'Ephemeral Key',
    category: 'account',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: StripeAction[] = [
  {
    name: 'STRIPE_DELETE_CUSTOMER',
    label: 'Delete Customer',
    category: 'customers',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'STRIPE_DELETE_COUPON',
    label: 'Delete Coupon',
    category: 'products',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'STRIPE_DELETE_APPLE_PAY_DOMAIN',
    label: 'Delete Apple Pay Domain',
    category: 'payments',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_STRIPE_ACTIONS: StripeAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getStripeFeaturedActionNames(): string[] {
  return ALL_STRIPE_ACTIONS.map((a) => a.name);
}

export function getStripeActionsByPriority(maxPriority: number = 3): StripeAction[] {
  return ALL_STRIPE_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getStripeActionNamesByPriority(maxPriority: number = 3): string[] {
  return getStripeActionsByPriority(maxPriority).map((a) => a.name);
}

export function getStripeActionsByCategory(category: StripeActionCategory): StripeAction[] {
  return ALL_STRIPE_ACTIONS.filter((a) => a.category === category);
}

export function getStripeActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_STRIPE_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownStripeAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_STRIPE_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveStripeAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_STRIPE_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Stripe action priority.
 * Known Stripe actions sorted by priority (1-4), unknown actions last.
 */
export function sortByStripePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getStripeActionPriority(a.name) - getStripeActionPriority(b.name);
  });
}

export function getStripeActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_STRIPE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_STRIPE_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Stripe-specific system prompt when user has Stripe connected.
 * Tells Claude exactly what it can do via the Composio Stripe toolkit.
 */
export function getStripeSystemPrompt(): string {
  return `
## Stripe Integration (Full Capabilities)

You have **full Stripe access** through the user's connected account. Use the \`composio_STRIPE_*\` tools.

### Payments
- Create and confirm Payment Intents for one-time charges
- Capture authorized payments or cancel pending intents
- Create Checkout Sessions for hosted payment pages
- Generate Payment Links for shareable payment URLs
- Process refunds (full or partial) on completed charges
- Manage payment methods (create, attach to customers)
- Set up future payments with Setup Intents

### Customers
- Create and manage customer profiles
- Track customer balance transactions
- Apply customer balance to payments
- Add tax IDs for invoicing compliance
- Create customer sessions for embedded components

### Subscriptions
- Create recurring subscriptions with flexible billing
- Add or remove subscription items (multi-product subscriptions)
- Cancel subscriptions (immediately or at period end)
- Generate billing portal sessions for customer self-service
- Track metered usage for usage-based billing

### Invoicing
- Create and send invoices to customers
- Preview invoices before finalizing
- Add line items to draft invoices
- Issue credit notes for adjustments
- Create and manage quotes (create, accept, cancel)

### Products & Pricing
- Create products with descriptions and metadata
- Define prices (one-time, recurring, tiered, metered)
- Create coupons and promotion codes for discounts
- Set up tax rates and shipping rates

### Terminal
- Register terminal locations for in-person payments
- Configure terminal readers

### Account & Reporting
- Upload files (receipts, documents, identity verification)
- Create file links for shareable document URLs
- Generate financial reports

### Safety Rules
1. **ALWAYS confirm payment amounts** before processing - show currency, amount, and customer details:
\`\`\`action-preview
{
  "platform": "Stripe",
  "action": "Create Payment Intent",
  "amount": "$XX.XX",
  "currency": "USD",
  "customer": "Customer name/ID",
  "toolName": "composio_STRIPE_CREATE_PAYMENT_INTENT",
  "toolParams": { "amount": ..., "currency": "...", "customer": "..." }
}
\`\`\`
2. **Show invoice preview before sending** - always use preview invoice first, then confirm
3. **Confirm before refunds** - show original charge details, refund amount, and reason
4. **Never delete customer data without explicit approval** - deletion is permanent
5. **For subscriptions**, clearly show billing interval, amount, and trial periods before creating
6. **For checkout sessions**, show all line items and total before generating the link
7. **Handle financial data carefully** - always double-check amounts, currencies, and recipient details
8. **For batch operations**, summarize what will happen and get explicit approval
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getStripeCapabilitySummary(): string {
  const stats = getStripeActionStats();
  return `Stripe (${stats.total} actions: payments, customers, subscriptions, invoicing, products, checkout)`;
}

export function logStripeToolkitStats(): void {
  const stats = getStripeActionStats();
  log.info('Stripe Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
