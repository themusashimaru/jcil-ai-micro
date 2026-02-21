/**
 * COMPOSIO MONDAY.COM TOOLKIT
 * ============================
 *
 * Comprehensive Monday.com integration via Composio's tools.
 *
 * Categories:
 * - Items (create, get, update, delete, move)
 * - Boards (list, get, create)
 * - Groups (list, create, move)
 * - Columns (list, update values)
 * - Updates (create, list)
 * - Users (list, get)
 */

import { logger } from '@/lib/logger';

const log = logger('MondayToolkit');

export type MondayActionCategory = 'items' | 'boards' | 'groups' | 'columns' | 'updates' | 'users';

export interface MondayAction {
  name: string;
  label: string;
  category: MondayActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: MondayAction[] = [
  {
    name: 'MONDAY_CREATE_ITEM',
    label: 'Create Item',
    category: 'items',
    priority: 1,
    writeOperation: true,
  },
  { name: 'MONDAY_GET_ITEMS', label: 'Get Items', category: 'items', priority: 1 },
  {
    name: 'MONDAY_UPDATE_ITEM',
    label: 'Update Item',
    category: 'items',
    priority: 1,
    writeOperation: true,
  },
  { name: 'MONDAY_LIST_BOARDS', label: 'List Boards', category: 'boards', priority: 1 },
  { name: 'MONDAY_GET_BOARD', label: 'Get Board', category: 'boards', priority: 1 },
  {
    name: 'MONDAY_CREATE_UPDATE',
    label: 'Create Update',
    category: 'updates',
    priority: 1,
    writeOperation: true,
  },
];

const IMPORTANT_ACTIONS: MondayAction[] = [
  { name: 'MONDAY_LIST_GROUPS', label: 'List Groups', category: 'groups', priority: 2 },
  { name: 'MONDAY_LIST_COLUMNS', label: 'List Columns', category: 'columns', priority: 2 },
  {
    name: 'MONDAY_CHANGE_COLUMN_VALUE',
    label: 'Change Column Value',
    category: 'columns',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'MONDAY_MOVE_ITEM_TO_GROUP',
    label: 'Move Item to Group',
    category: 'items',
    priority: 2,
    writeOperation: true,
  },
  { name: 'MONDAY_LIST_UPDATES', label: 'List Updates', category: 'updates', priority: 2 },
  { name: 'MONDAY_SEARCH_ITEMS', label: 'Search Items', category: 'items', priority: 2 },
];

const USEFUL_ACTIONS: MondayAction[] = [
  {
    name: 'MONDAY_CREATE_BOARD',
    label: 'Create Board',
    category: 'boards',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MONDAY_CREATE_GROUP',
    label: 'Create Group',
    category: 'groups',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MONDAY_CREATE_SUBITEM',
    label: 'Create Subitem',
    category: 'items',
    priority: 3,
    writeOperation: true,
  },
  { name: 'MONDAY_LIST_USERS', label: 'List Users', category: 'users', priority: 3 },
  { name: 'MONDAY_GET_USER', label: 'Get User', category: 'users', priority: 3 },
];

const ADVANCED_ACTIONS: MondayAction[] = [
  {
    name: 'MONDAY_DELETE_ITEM',
    label: 'Delete Item',
    category: 'items',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'MONDAY_ARCHIVE_ITEM',
    label: 'Archive Item',
    category: 'items',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'MONDAY_DELETE_UPDATE',
    label: 'Delete Update',
    category: 'updates',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'MONDAY_ARCHIVE_BOARD',
    label: 'Archive Board',
    category: 'boards',
    priority: 4,
    writeOperation: true,
  },
];

export const ALL_MONDAY_ACTIONS: MondayAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getMondayFeaturedActionNames(): string[] {
  return ALL_MONDAY_ACTIONS.map((a) => a.name);
}
export function getMondayActionsByPriority(maxPriority: number = 3): MondayAction[] {
  return ALL_MONDAY_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getMondayActionNamesByPriority(maxPriority: number = 3): string[] {
  return getMondayActionsByPriority(maxPriority).map((a) => a.name);
}
export function getMondayActionsByCategory(category: MondayActionCategory): MondayAction[] {
  return ALL_MONDAY_ACTIONS.filter((a) => a.category === category);
}
export function getMondayActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_MONDAY_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownMondayAction(toolName: string): boolean {
  return ALL_MONDAY_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveMondayAction(toolName: string): boolean {
  return (
    ALL_MONDAY_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortByMondayPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getMondayActionPriority(a.name) - getMondayActionPriority(b.name)
  );
}

export function getMondayActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_MONDAY_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_MONDAY_ACTIONS.length, byPriority, byCategory };
}

export function getMondaySystemPrompt(): string {
  return `
## Monday.com Integration (Full Capabilities)

You have **full Monday.com access** through the user's connected account. Use the \`composio_MONDAY_*\` tools.

### Items (Tasks/Rows)
- Create items with column values and group placement
- Get and search items across boards
- Update item names, column values, and status
- Move items between groups
- Create subitems for task breakdown

### Boards & Groups
- List and get board details with columns and groups
- Create new boards
- Create and manage groups (sections) within boards

### Columns & Updates
- List columns and their types for a board
- Change column values (status, date, person, text, etc.)
- Create updates (comments/notes) on items
- List update history

### Safety Rules
1. **ALWAYS confirm before creating items** - show board, group, and item details
2. **Confirm before deleting items** - deletion is permanent
3. **For column value changes**, show current and new values
4. **Confirm before archiving boards** - affects all items within
`;
}

export function getMondayCapabilitySummary(): string {
  const stats = getMondayActionStats();
  return `Monday.com (${stats.total} actions: items, boards, groups, columns, updates)`;
}

export function logMondayToolkitStats(): void {
  const stats = getMondayActionStats();
  log.info('Monday Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
