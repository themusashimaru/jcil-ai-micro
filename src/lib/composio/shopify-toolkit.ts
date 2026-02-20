/**
 * COMPOSIO SHOPIFY TOOLKIT
 * ========================
 *
 * Comprehensive Shopify integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Products (list, get, create, update, delete, search, variants, images)
 * - Orders (list, get, create, update, cancel, close, refunds)
 * - Customers (list, get, create, update, delete, search)
 * - Inventory (list items, update levels)
 * - Collections (list, create, update, delete)
 * - Discounts (list, create, delete)
 * - Fulfillment (list, create, update)
 * - Shop (get shop info, webhooks)
 */

import { logger } from '@/lib/logger';

const log = logger('ShopifyToolkit');

// ============================================================================
// SHOPIFY ACTION CATEGORIES
// ============================================================================

export type ShopifyActionCategory =
  | 'products'
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'collections'
  | 'discounts'
  | 'fulfillment'
  | 'shop';

export interface ShopifyAction {
  name: string; // Composio action name (e.g., SHOPIFY_LIST_PRODUCTS)
  label: string; // Human-readable label
  category: ShopifyActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Shopify connected)
// ============================================================================

const ESSENTIAL_ACTIONS: ShopifyAction[] = [
  // Products
  {
    name: 'SHOPIFY_LIST_PRODUCTS',
    label: 'List Products',
    category: 'products',
    priority: 1,
  },
  {
    name: 'SHOPIFY_GET_PRODUCT',
    label: 'Get Product',
    category: 'products',
    priority: 1,
  },
  {
    name: 'SHOPIFY_CREATE_PRODUCT',
    label: 'Create Product',
    category: 'products',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'SHOPIFY_SEARCH_PRODUCTS',
    label: 'Search Products',
    category: 'products',
    priority: 1,
  },

  // Orders
  {
    name: 'SHOPIFY_LIST_ORDERS',
    label: 'List Orders',
    category: 'orders',
    priority: 1,
  },
  {
    name: 'SHOPIFY_GET_ORDER',
    label: 'Get Order',
    category: 'orders',
    priority: 1,
  },

  // Customers
  {
    name: 'SHOPIFY_LIST_CUSTOMERS',
    label: 'List Customers',
    category: 'customers',
    priority: 1,
  },
  {
    name: 'SHOPIFY_GET_CUSTOMER',
    label: 'Get Customer',
    category: 'customers',
    priority: 1,
  },
  {
    name: 'SHOPIFY_CREATE_CUSTOMER',
    label: 'Create Customer',
    category: 'customers',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: ShopifyAction[] = [
  // Products - Extended
  {
    name: 'SHOPIFY_UPDATE_PRODUCT',
    label: 'Update Product',
    category: 'products',
    priority: 2,
    writeOperation: true,
  },

  // Orders - Extended
  {
    name: 'SHOPIFY_CREATE_ORDER',
    label: 'Create Order',
    category: 'orders',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SHOPIFY_UPDATE_ORDER',
    label: 'Update Order',
    category: 'orders',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SHOPIFY_SEARCH_ORDERS',
    label: 'Search Orders',
    category: 'orders',
    priority: 2,
  },

  // Customers - Extended
  {
    name: 'SHOPIFY_UPDATE_CUSTOMER',
    label: 'Update Customer',
    category: 'customers',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SHOPIFY_SEARCH_CUSTOMERS',
    label: 'Search Customers',
    category: 'customers',
    priority: 2,
  },

  // Inventory
  {
    name: 'SHOPIFY_LIST_INVENTORY_ITEMS',
    label: 'List Inventory Items',
    category: 'inventory',
    priority: 2,
  },
  {
    name: 'SHOPIFY_UPDATE_INVENTORY_LEVEL',
    label: 'Update Inventory Level',
    category: 'inventory',
    priority: 2,
    writeOperation: true,
  },

  // Collections
  {
    name: 'SHOPIFY_LIST_COLLECTIONS',
    label: 'List Collections',
    category: 'collections',
    priority: 2,
  },
  {
    name: 'SHOPIFY_CREATE_COLLECTION',
    label: 'Create Collection',
    category: 'collections',
    priority: 2,
    writeOperation: true,
  },

  // Discounts
  {
    name: 'SHOPIFY_CREATE_DISCOUNT',
    label: 'Create Discount',
    category: 'discounts',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SHOPIFY_LIST_DISCOUNTS',
    label: 'List Discounts',
    category: 'discounts',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: ShopifyAction[] = [
  // Products - Extended
  {
    name: 'SHOPIFY_DELETE_PRODUCT',
    label: 'Delete Product',
    category: 'products',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Orders - Extended
  {
    name: 'SHOPIFY_CANCEL_ORDER',
    label: 'Cancel Order',
    category: 'orders',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SHOPIFY_CLOSE_ORDER',
    label: 'Close Order',
    category: 'orders',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SHOPIFY_CREATE_REFUND',
    label: 'Create Refund',
    category: 'orders',
    priority: 3,
    writeOperation: true,
  },

  // Fulfillment
  {
    name: 'SHOPIFY_CREATE_FULFILLMENT',
    label: 'Create Fulfillment',
    category: 'fulfillment',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SHOPIFY_LIST_FULFILLMENTS',
    label: 'List Fulfillments',
    category: 'fulfillment',
    priority: 3,
  },
  {
    name: 'SHOPIFY_UPDATE_FULFILLMENT',
    label: 'Update Fulfillment',
    category: 'fulfillment',
    priority: 3,
    writeOperation: true,
  },

  // Customers - Extended
  {
    name: 'SHOPIFY_DELETE_CUSTOMER',
    label: 'Delete Customer',
    category: 'customers',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Collections - Extended
  {
    name: 'SHOPIFY_UPDATE_COLLECTION',
    label: 'Update Collection',
    category: 'collections',
    priority: 3,
    writeOperation: true,
  },

  // Discounts - Extended
  {
    name: 'SHOPIFY_DELETE_DISCOUNT',
    label: 'Delete Discount',
    category: 'discounts',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Shop
  {
    name: 'SHOPIFY_GET_SHOP',
    label: 'Get Shop Info',
    category: 'shop',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations and advanced features)
// ============================================================================

const ADVANCED_ACTIONS: ShopifyAction[] = [
  {
    name: 'SHOPIFY_DELETE_COLLECTION',
    label: 'Delete Collection',
    category: 'collections',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SHOPIFY_DELETE_ORDER',
    label: 'Delete Order',
    category: 'orders',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SHOPIFY_CREATE_PRODUCT_VARIANT',
    label: 'Create Product Variant',
    category: 'products',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SHOPIFY_UPDATE_PRODUCT_VARIANT',
    label: 'Update Product Variant',
    category: 'products',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SHOPIFY_LIST_PRODUCT_VARIANTS',
    label: 'List Product Variants',
    category: 'products',
    priority: 4,
  },
  {
    name: 'SHOPIFY_CREATE_PRODUCT_IMAGE',
    label: 'Create Product Image',
    category: 'products',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SHOPIFY_LIST_WEBHOOKS',
    label: 'List Webhooks',
    category: 'shop',
    priority: 4,
  },
  {
    name: 'SHOPIFY_CREATE_WEBHOOK',
    label: 'Create Webhook',
    category: 'shop',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_SHOPIFY_ACTIONS: ShopifyAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getShopifyFeaturedActionNames(): string[] {
  return ALL_SHOPIFY_ACTIONS.map((a) => a.name);
}

export function getShopifyActionsByPriority(maxPriority: number = 3): ShopifyAction[] {
  return ALL_SHOPIFY_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getShopifyActionNamesByPriority(maxPriority: number = 3): string[] {
  return getShopifyActionsByPriority(maxPriority).map((a) => a.name);
}

export function getShopifyActionsByCategory(category: ShopifyActionCategory): ShopifyAction[] {
  return ALL_SHOPIFY_ACTIONS.filter((a) => a.category === category);
}

export function getShopifyActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_SHOPIFY_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownShopifyAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SHOPIFY_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveShopifyAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SHOPIFY_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Shopify action priority.
 * Known Shopify actions sorted by priority (1-4), unknown actions last.
 */
export function sortByShopifyPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getShopifyActionPriority(a.name) - getShopifyActionPriority(b.name);
  });
}

export function getShopifyActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_SHOPIFY_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_SHOPIFY_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Shopify-specific system prompt when user has Shopify connected.
 * Tells Claude exactly what it can do via the Composio Shopify toolkit.
 */
export function getShopifySystemPrompt(): string {
  return `
## Shopify Integration (Full Capabilities)

You have **full Shopify access** through the user's connected account. Use the \`composio_SHOPIFY_*\` tools.

### Product Management
- List and search products in the store
- Get detailed product information including variants and images
- Create new products with titles, descriptions, pricing, and inventory
- Update existing product details (title, description, price, status)
- Manage product variants (create, update, list)
- Add product images
- Delete products when no longer needed

### Order Management
- List and search orders with filters (status, date range, customer)
- Get detailed order information including line items and fulfillment status
- Create new orders (draft or completed)
- Update order details and notes
- Cancel or close orders
- Process refunds (full or partial) on completed orders

### Customer Management
- List and search customers by name, email, or other attributes
- Get detailed customer profiles including order history
- Create new customer records with contact information
- Update customer details (name, email, address, tags)
- Delete customer records when required

### Inventory
- List inventory items and their stock levels
- Update inventory levels across locations

### Collections
- List product collections (smart and custom)
- Create new collections to organize products
- Update collection details and rules
- Delete collections

### Discounts
- List existing discount codes and automatic discounts
- Create new discount codes with rules and limits
- Delete discounts that are no longer active

### Fulfillment
- List fulfillments for orders
- Create fulfillments with tracking information
- Update fulfillment tracking details

### Shop Information
- Get shop details (name, domain, plan, settings)
- List and create webhooks for event notifications

### Safety Rules
1. **ALWAYS confirm before creating orders** - show line items, quantities, prices, and customer details:
\`\`\`action-preview
{
  "platform": "Shopify",
  "action": "Create Order",
  "customer": "Customer name/ID",
  "lineItems": "Product details and quantities",
  "total": "$XX.XX",
  "toolName": "composio_SHOPIFY_CREATE_ORDER",
  "toolParams": { "line_items": [...], "customer": "..." }
}
\`\`\`
2. **Confirm before processing refunds** - show original order details, refund amount, and reason
3. **Never delete products without explicit approval** - deletion is permanent and removes all variants and images
4. **Never delete customer data without explicit approval** - deletion is permanent
5. **Confirm inventory level changes** - show current level, proposed change, and affected location
6. **For discount creation**, clearly show discount type, value, applicable products, and usage limits before creating
7. **For fulfillment creation**, verify tracking number and carrier details before marking as fulfilled
8. **For batch operations**, summarize what will happen and get explicit approval
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getShopifyCapabilitySummary(): string {
  const stats = getShopifyActionStats();
  return `Shopify (${stats.total} actions: products, orders, customers, inventory, collections, discounts, fulfillment)`;
}

export function logShopifyToolkitStats(): void {
  const stats = getShopifyActionStats();
  log.info('Shopify Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
