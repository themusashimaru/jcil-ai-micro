/**
 * COMPOSIO WIX TOOLKIT
 * ====================
 *
 * Comprehensive Wix integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Sites (site info, settings, properties)
 * - Pages (create, get, update pages)
 * - Blog (posts, drafts, categories)
 * - Contacts (create, get, update contacts)
 * - Ecommerce (products, orders, inventory)
 */

import { logger } from '@/lib/logger';

const log = logger('WixToolkit');

// ============================================================================
// WIX ACTION CATEGORIES
// ============================================================================

export type WixActionCategory = 'sites' | 'pages' | 'blog' | 'contacts' | 'ecommerce';

export interface WixAction {
  name: string; // Composio action name (e.g., WIX_CREATE_BLOG_POST)
  label: string; // Human-readable label
  category: WixActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Wix connected)
// ============================================================================

const ESSENTIAL_ACTIONS: WixAction[] = [
  // Sites - Core
  { name: 'WIX_GET_SITE_INFO', label: 'Get Site Info', category: 'sites', priority: 1 },
  { name: 'WIX_GET_SITE_PAGES', label: 'Get Site Pages', category: 'pages', priority: 1 },

  // Blog - Core
  {
    name: 'WIX_CREATE_BLOG_POST',
    label: 'Create Blog Post',
    category: 'blog',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'WIX_PUBLISH_POST',
    label: 'Publish Post',
    category: 'blog',
    priority: 1,
    writeOperation: true,
  },
  { name: 'WIX_GET_BLOG_POSTS', label: 'Get Blog Posts', category: 'blog', priority: 1 },

  // Contacts - Core
  {
    name: 'WIX_CREATE_CONTACT',
    label: 'Create Contact',
    category: 'contacts',
    priority: 1,
    writeOperation: true,
  },
  { name: 'WIX_GET_CONTACTS', label: 'Get Contacts', category: 'contacts', priority: 1 },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: WixAction[] = [
  // Blog - Extended
  { name: 'WIX_GET_BLOG_POST', label: 'Get Blog Post', category: 'blog', priority: 2 },
  {
    name: 'WIX_UPDATE_BLOG_POST',
    label: 'Update Blog Post',
    category: 'blog',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'WIX_CREATE_DRAFT_POST',
    label: 'Create Draft Post',
    category: 'blog',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'WIX_GET_BLOG_CATEGORIES',
    label: 'Get Blog Categories',
    category: 'blog',
    priority: 2,
  },

  // Ecommerce - Core
  { name: 'WIX_GET_PRODUCTS', label: 'Get Products', category: 'ecommerce', priority: 2 },
  { name: 'WIX_GET_PRODUCT', label: 'Get Product Details', category: 'ecommerce', priority: 2 },
  {
    name: 'WIX_CREATE_ORDER',
    label: 'Create Order',
    category: 'ecommerce',
    priority: 2,
    writeOperation: true,
  },
  { name: 'WIX_GET_ORDERS', label: 'Get Orders', category: 'ecommerce', priority: 2 },

  // Contacts - Extended
  { name: 'WIX_GET_CONTACT', label: 'Get Contact Details', category: 'contacts', priority: 2 },
  {
    name: 'WIX_UPDATE_CONTACT',
    label: 'Update Contact',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: WixAction[] = [
  // Sites - Extended
  { name: 'WIX_GET_SITE_PROPERTIES', label: 'Get Site Properties', category: 'sites', priority: 3 },

  // Pages - Extended
  {
    name: 'WIX_CREATE_PAGE',
    label: 'Create Page',
    category: 'pages',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'WIX_UPDATE_PAGE',
    label: 'Update Page',
    category: 'pages',
    priority: 3,
    writeOperation: true,
  },
  { name: 'WIX_GET_PAGE', label: 'Get Page Details', category: 'pages', priority: 3 },

  // Blog - Extended
  {
    name: 'WIX_CREATE_BLOG_CATEGORY',
    label: 'Create Blog Category',
    category: 'blog',
    priority: 3,
    writeOperation: true,
  },
  { name: 'WIX_GET_DRAFT_POSTS', label: 'Get Draft Posts', category: 'blog', priority: 3 },

  // Ecommerce - Extended
  {
    name: 'WIX_CREATE_PRODUCT',
    label: 'Create Product',
    category: 'ecommerce',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'WIX_UPDATE_PRODUCT',
    label: 'Update Product',
    category: 'ecommerce',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'WIX_GET_INVENTORY',
    label: 'Get Inventory',
    category: 'ecommerce',
    priority: 3,
  },
  { name: 'WIX_GET_ORDER', label: 'Get Order Details', category: 'ecommerce', priority: 3 },

  // Contacts - Extended
  {
    name: 'WIX_QUERY_CONTACTS',
    label: 'Query Contacts',
    category: 'contacts',
    priority: 3,
  },
  {
    name: 'WIX_LABEL_CONTACT',
    label: 'Label Contact',
    category: 'contacts',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: WixAction[] = [
  // Blog - Destructive
  {
    name: 'WIX_DELETE_BLOG_POST',
    label: 'Delete Blog Post',
    category: 'blog',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Pages - Destructive
  {
    name: 'WIX_DELETE_PAGE',
    label: 'Delete Page',
    category: 'pages',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Contacts - Destructive
  {
    name: 'WIX_DELETE_CONTACT',
    label: 'Delete Contact',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Ecommerce - Destructive
  {
    name: 'WIX_DELETE_PRODUCT',
    label: 'Delete Product',
    category: 'ecommerce',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'WIX_CANCEL_ORDER',
    label: 'Cancel Order',
    category: 'ecommerce',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_WIX_ACTIONS: WixAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getWixFeaturedActionNames(): string[] {
  return ALL_WIX_ACTIONS.map((a) => a.name);
}

export function getWixActionsByPriority(maxPriority: number = 3): WixAction[] {
  return ALL_WIX_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getWixActionNamesByPriority(maxPriority: number = 3): string[] {
  return getWixActionsByPriority(maxPriority).map((a) => a.name);
}

export function getWixActionsByCategory(category: WixActionCategory): WixAction[] {
  return ALL_WIX_ACTIONS.filter((a) => a.category === category);
}

export function getWixActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_WIX_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownWixAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_WIX_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveWixAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_WIX_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Wix action priority.
 * Known Wix actions sorted by priority (1-4), unknown actions last.
 */
export function sortByWixPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getWixActionPriority(a.name) - getWixActionPriority(b.name);
  });
}

export function getWixActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_WIX_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_WIX_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Wix-specific system prompt when user has Wix connected.
 * Tells Claude exactly what it can do via the Composio Wix toolkit.
 */
export function getWixSystemPrompt(): string {
  return `
## Wix Integration (Full Capabilities)

You have **full Wix access** through the user's connected account. Use the \`composio_WIX_*\` tools.

### Sites
- Get site information (name, URL, status)
- View site properties and settings

### Pages
- List all site pages
- Get page details and content
- Create new pages
- Update existing page content
- Delete pages (with confirmation)

### Blog
- Create new blog posts with rich content
- Publish posts or save as drafts
- Update existing blog posts
- Get all blog posts or individual post details
- View draft posts
- Manage blog categories
- Delete blog posts (with confirmation)

### Contacts
- Create new contacts with email, phone, name
- Get all contacts or individual contact details
- Update contact information
- Query contacts with filters
- Add labels to contacts for organization
- Delete contacts (with confirmation)

### Ecommerce
- View products and product details
- Create new products with descriptions and pricing
- Update product information
- Get orders and order details
- Create new orders
- View inventory levels
- Cancel orders (with confirmation)
- Delete products (with confirmation)

### Safety Rules
1. **ALWAYS preview before publishing** - show content details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Wix",
  "action": "Publish Blog Post",
  "content": "Post title and excerpt...",
  "toolName": "composio_WIX_PUBLISH_POST",
  "toolParams": { "postId": "...", "title": "..." }
}
\`\`\`
2. **Confirm before publishing** - always show draft content and get approval before publishing
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For ecommerce operations**, double-check product details and pricing before creating
5. **For contact operations**, verify contact data before creating or updating
6. **For order cancellations**, confirm the order details and impact before proceeding
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getWixCapabilitySummary(): string {
  const stats = getWixActionStats();
  return `Wix (${stats.total} actions: sites, pages, blog, contacts, ecommerce)`;
}

export function logWixToolkitStats(): void {
  const stats = getWixActionStats();
  log.info('Wix Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
