/**
 * COMPOSIO WEBFLOW TOOLKIT
 * ==========================
 *
 * Comprehensive Webflow integration via Composio's tools.
 *
 * Categories:
 * - Sites (list, get, publish)
 * - Collections (list, get, items)
 * - CMS Items (create, update, list, get)
 * - Domains (list, get)
 * - Forms (list, submissions)
 */

import { logger } from '@/lib/logger';

const log = logger('WebflowToolkit');

export type WebflowActionCategory = 'sites' | 'collections' | 'cms_items' | 'domains' | 'forms';

export interface WebflowAction {
  name: string;
  label: string;
  category: WebflowActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: WebflowAction[] = [
  { name: 'WEBFLOW_LIST_SITES', label: 'List Sites', category: 'sites', priority: 1 },
  { name: 'WEBFLOW_GET_SITE', label: 'Get Site', category: 'sites', priority: 1 },
  {
    name: 'WEBFLOW_LIST_COLLECTIONS',
    label: 'List Collections',
    category: 'collections',
    priority: 1,
  },
  { name: 'WEBFLOW_LIST_ITEMS', label: 'List CMS Items', category: 'cms_items', priority: 1 },
  {
    name: 'WEBFLOW_CREATE_ITEM',
    label: 'Create CMS Item',
    category: 'cms_items',
    priority: 1,
    writeOperation: true,
  },
];

const IMPORTANT_ACTIONS: WebflowAction[] = [
  { name: 'WEBFLOW_GET_ITEM', label: 'Get CMS Item', category: 'cms_items', priority: 2 },
  {
    name: 'WEBFLOW_UPDATE_ITEM',
    label: 'Update CMS Item',
    category: 'cms_items',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'WEBFLOW_PUBLISH_SITE',
    label: 'Publish Site',
    category: 'sites',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'WEBFLOW_GET_COLLECTION',
    label: 'Get Collection',
    category: 'collections',
    priority: 2,
  },
  {
    name: 'WEBFLOW_LIST_FORM_SUBMISSIONS',
    label: 'List Form Submissions',
    category: 'forms',
    priority: 2,
  },
];

const USEFUL_ACTIONS: WebflowAction[] = [
  { name: 'WEBFLOW_LIST_DOMAINS', label: 'List Domains', category: 'domains', priority: 3 },
  { name: 'WEBFLOW_GET_DOMAIN', label: 'Get Domain', category: 'domains', priority: 3 },
  { name: 'WEBFLOW_LIST_FORMS', label: 'List Forms', category: 'forms', priority: 3 },
  {
    name: 'WEBFLOW_PUBLISH_ITEMS',
    label: 'Publish CMS Items',
    category: 'cms_items',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'WEBFLOW_PATCH_ITEM',
    label: 'Patch CMS Item',
    category: 'cms_items',
    priority: 3,
    writeOperation: true,
  },
];

const ADVANCED_ACTIONS: WebflowAction[] = [
  {
    name: 'WEBFLOW_DELETE_ITEM',
    label: 'Delete CMS Item',
    category: 'cms_items',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'WEBFLOW_UNPUBLISH_ITEM',
    label: 'Unpublish CMS Item',
    category: 'cms_items',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'WEBFLOW_DELETE_FORM_SUBMISSION',
    label: 'Delete Form Submission',
    category: 'forms',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

export const ALL_WEBFLOW_ACTIONS: WebflowAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getWebflowFeaturedActionNames(): string[] {
  return ALL_WEBFLOW_ACTIONS.map((a) => a.name);
}
export function getWebflowActionsByPriority(maxPriority: number = 3): WebflowAction[] {
  return ALL_WEBFLOW_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getWebflowActionNamesByPriority(maxPriority: number = 3): string[] {
  return getWebflowActionsByPriority(maxPriority).map((a) => a.name);
}
export function getWebflowActionsByCategory(category: WebflowActionCategory): WebflowAction[] {
  return ALL_WEBFLOW_ACTIONS.filter((a) => a.category === category);
}
export function getWebflowActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_WEBFLOW_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownWebflowAction(toolName: string): boolean {
  return ALL_WEBFLOW_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveWebflowAction(toolName: string): boolean {
  return (
    ALL_WEBFLOW_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortByWebflowPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getWebflowActionPriority(a.name) - getWebflowActionPriority(b.name)
  );
}

export function getWebflowActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_WEBFLOW_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_WEBFLOW_ACTIONS.length, byPriority, byCategory };
}

export function getWebflowSystemPrompt(): string {
  return `
## Webflow Integration (Full Capabilities)

You have **full Webflow access** through the user's connected account. Use the \`composio_WEBFLOW_*\` tools.

### Sites
- List and manage Webflow sites
- Publish sites to make changes live

### CMS Collections & Items
- List collections and browse CMS content
- Create, update, and publish CMS items
- Manage content across multiple collections

### Domains & Forms
- View domain configurations
- List form submissions from site visitors

### Safety Rules
1. **Confirm before publishing sites** - changes go live immediately
2. **Confirm before deleting CMS items** - deletion is permanent
3. **Show item details before updates** - prevent accidental overwrites
`;
}

export function getWebflowCapabilitySummary(): string {
  const stats = getWebflowActionStats();
  return `Webflow (${stats.total} actions: sites, collections, CMS items, domains, forms)`;
}

export function logWebflowToolkitStats(): void {
  const stats = getWebflowActionStats();
  log.info('Webflow Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
