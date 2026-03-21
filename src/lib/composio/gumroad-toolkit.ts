/**
 * COMPOSIO GUMROAD TOOLKIT
 * ========================
 *
 * Comprehensive Gumroad integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Products (create, get, update, delete products)
 * - Sales (get sales data, refunds)
 * - Subscribers (manage subscribers, subscriptions)
 * - Offers (create, get, update offers and discounts)
 */

import { logger } from '@/lib/logger';

const log = logger('GumroadToolkit');

// ============================================================================
// GUMROAD ACTION CATEGORIES
// ============================================================================

export type GumroadActionCategory = 'products' | 'sales' | 'subscribers' | 'offers';

export interface GumroadAction {
  name: string; // Composio action name (e.g., GUMROAD_CREATE_PRODUCT)
  label: string; // Human-readable label
  category: GumroadActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Gumroad connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GumroadAction[] = [
  // Products - Core
  {
    name: 'GUMROAD_CREATE_PRODUCT',
    label: 'Create Product',
    category: 'products',
    priority: 1,
    writeOperation: true,
  },
  { name: 'GUMROAD_GET_PRODUCTS', label: 'Get Products', category: 'products', priority: 1 },
  { name: 'GUMROAD_GET_PRODUCT', label: 'Get Product Details', category: 'products', priority: 1 },

  // Sales - Core
  { name: 'GUMROAD_GET_SALES', label: 'Get Sales', category: 'sales', priority: 1 },

  // Subscribers - Core
  {
    name: 'GUMROAD_GET_SUBSCRIBERS',
    label: 'Get Subscribers',
    category: 'subscribers',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GumroadAction[] = [
  // Products - Extended
  {
    name: 'GUMROAD_UPDATE_PRODUCT',
    label: 'Update Product',
    category: 'products',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GUMROAD_ENABLE_PRODUCT',
    label: 'Enable Product',
    category: 'products',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GUMROAD_DISABLE_PRODUCT',
    label: 'Disable Product',
    category: 'products',
    priority: 2,
    writeOperation: true,
  },

  // Sales - Extended
  { name: 'GUMROAD_GET_SALE', label: 'Get Sale Details', category: 'sales', priority: 2 },

  // Offers - Core
  {
    name: 'GUMROAD_CREATE_OFFER',
    label: 'Create Offer',
    category: 'offers',
    priority: 2,
    writeOperation: true,
  },
  { name: 'GUMROAD_GET_OFFERS', label: 'Get Offers', category: 'offers', priority: 2 },

  // Subscribers - Extended
  {
    name: 'GUMROAD_GET_SUBSCRIBER',
    label: 'Get Subscriber Details',
    category: 'subscribers',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GumroadAction[] = [
  // Products - Extended
  {
    name: 'GUMROAD_CREATE_VARIANT',
    label: 'Create Product Variant',
    category: 'products',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GUMROAD_GET_VARIANTS',
    label: 'Get Product Variants',
    category: 'products',
    priority: 3,
  },
  {
    name: 'GUMROAD_UPDATE_VARIANT',
    label: 'Update Product Variant',
    category: 'products',
    priority: 3,
    writeOperation: true,
  },

  // Offers - Extended
  { name: 'GUMROAD_GET_OFFER', label: 'Get Offer Details', category: 'offers', priority: 3 },
  {
    name: 'GUMROAD_UPDATE_OFFER',
    label: 'Update Offer',
    category: 'offers',
    priority: 3,
    writeOperation: true,
  },

  // Sales - Analytics
  {
    name: 'GUMROAD_GET_SALES_SUMMARY',
    label: 'Get Sales Summary',
    category: 'sales',
    priority: 3,
  },

  // Subscribers - Extended
  {
    name: 'GUMROAD_GET_SUBSCRIBER_COUNT',
    label: 'Get Subscriber Count',
    category: 'subscribers',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: GumroadAction[] = [
  // Products - Destructive
  {
    name: 'GUMROAD_DELETE_PRODUCT',
    label: 'Delete Product',
    category: 'products',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GUMROAD_DELETE_VARIANT',
    label: 'Delete Product Variant',
    category: 'products',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Offers - Destructive
  {
    name: 'GUMROAD_DELETE_OFFER',
    label: 'Delete Offer',
    category: 'offers',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Sales - Destructive
  {
    name: 'GUMROAD_REFUND_SALE',
    label: 'Refund Sale',
    category: 'sales',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Subscribers - Destructive
  {
    name: 'GUMROAD_CANCEL_SUBSCRIPTION',
    label: 'Cancel Subscription',
    category: 'subscribers',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GUMROAD_ACTIONS: GumroadAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGumroadFeaturedActionNames(): string[] {
  return ALL_GUMROAD_ACTIONS.map((a) => a.name);
}

export function getGumroadActionsByPriority(maxPriority: number = 3): GumroadAction[] {
  return ALL_GUMROAD_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGumroadActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGumroadActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGumroadActionsByCategory(category: GumroadActionCategory): GumroadAction[] {
  return ALL_GUMROAD_ACTIONS.filter((a) => a.category === category);
}

export function getGumroadActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GUMROAD_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGumroadAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GUMROAD_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGumroadAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GUMROAD_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Gumroad action priority.
 * Known Gumroad actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGumroadPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGumroadActionPriority(a.name) - getGumroadActionPriority(b.name);
  });
}

export function getGumroadActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GUMROAD_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GUMROAD_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Gumroad-specific system prompt when user has Gumroad connected.
 * Tells Claude exactly what it can do via the Composio Gumroad toolkit.
 */
export function getGumroadSystemPrompt(): string {
  return `
## Gumroad Integration (Full Capabilities)

You have **full Gumroad access** through the user's connected account. Use the \`composio_GUMROAD_*\` tools.

### Products
- Create new digital products with name, description, and pricing
- List all products in the store
- Get detailed product information
- Update product details (name, description, price, content)
- Enable or disable products for sale
- Create and manage product variants (different tiers/options)
- Delete products (with confirmation)

### Sales
- View all sales data and transaction history
- Get individual sale details (buyer, amount, date)
- View sales summaries and revenue analytics
- Process refunds for sales (with confirmation)

### Subscribers
- List all subscribers across products
- Get individual subscriber details
- View subscriber counts per product
- Cancel subscriptions (with confirmation)

### Offers & Discounts
- Create discount offers for products (percentage or fixed amount)
- List all active offers
- Get offer details
- Update offer terms and conditions
- Delete offers (with confirmation)

### Safety Rules
1. **ALWAYS preview before creating** - show product/offer details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Gumroad",
  "action": "Create Product",
  "content": "Product name and price preview...",
  "toolName": "composio_GUMROAD_CREATE_PRODUCT",
  "toolParams": { "name": "...", "price": 0 }
}
\`\`\`
2. **Confirm pricing before creating** - verify product prices and offer discounts are correct
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For refunds**, confirm the sale details and refund amount before processing
5. **For subscription cancellations**, show the subscriber and subscription details first
6. **Double-check product visibility** - confirm whether a product should be enabled or disabled
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGumroadCapabilitySummary(): string {
  const stats = getGumroadActionStats();
  return `Gumroad (${stats.total} actions: products, sales, subscribers, offers)`;
}

export function logGumroadToolkitStats(): void {
  const stats = getGumroadActionStats();
  log.info('Gumroad Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
