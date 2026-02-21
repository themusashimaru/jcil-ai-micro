/**
 * COMPOSIO TRELLO TOOLKIT
 * =======================
 *
 * Comprehensive Trello integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Cards (create, get, update, delete, move, archive)
 * - Boards (create, get, list, update)
 * - Lists (create, get, update, move)
 * - Labels (create, update, delete)
 * - Members (get, list)
 * - Checklists (create, add items, update)
 * - Comments (add, list)
 */

import { logger } from '@/lib/logger';

const log = logger('TrelloToolkit');

// ============================================================================
// TRELLO ACTION CATEGORIES
// ============================================================================

export type TrelloActionCategory =
  | 'cards'
  | 'boards'
  | 'lists'
  | 'labels'
  | 'members'
  | 'checklists'
  | 'comments';

export interface TrelloAction {
  name: string;
  label: string;
  category: TrelloActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL
// ============================================================================

const ESSENTIAL_ACTIONS: TrelloAction[] = [
  {
    name: 'TRELLO_CREATE_CARD',
    label: 'Create Card',
    category: 'cards',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'TRELLO_GET_CARD',
    label: 'Get Card',
    category: 'cards',
    priority: 1,
  },
  {
    name: 'TRELLO_UPDATE_CARD',
    label: 'Update Card',
    category: 'cards',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'TRELLO_LIST_BOARDS',
    label: 'List Boards',
    category: 'boards',
    priority: 1,
  },
  {
    name: 'TRELLO_GET_BOARD',
    label: 'Get Board',
    category: 'boards',
    priority: 1,
  },
  {
    name: 'TRELLO_LIST_CARDS',
    label: 'List Cards',
    category: 'cards',
    priority: 1,
  },
  {
    name: 'TRELLO_LIST_LISTS',
    label: 'List Lists',
    category: 'lists',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT
// ============================================================================

const IMPORTANT_ACTIONS: TrelloAction[] = [
  {
    name: 'TRELLO_MOVE_CARD',
    label: 'Move Card',
    category: 'cards',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TRELLO_CREATE_LIST',
    label: 'Create List',
    category: 'lists',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TRELLO_ADD_COMMENT',
    label: 'Add Comment',
    category: 'comments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TRELLO_ADD_LABEL_TO_CARD',
    label: 'Add Label to Card',
    category: 'labels',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TRELLO_CREATE_BOARD',
    label: 'Create Board',
    category: 'boards',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TRELLO_SEARCH_CARDS',
    label: 'Search Cards',
    category: 'cards',
    priority: 2,
  },
  {
    name: 'TRELLO_LIST_MEMBERS',
    label: 'List Members',
    category: 'members',
    priority: 2,
  },
  {
    name: 'TRELLO_ASSIGN_MEMBER',
    label: 'Assign Member',
    category: 'cards',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL
// ============================================================================

const USEFUL_ACTIONS: TrelloAction[] = [
  {
    name: 'TRELLO_CREATE_CHECKLIST',
    label: 'Create Checklist',
    category: 'checklists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TRELLO_ADD_CHECKLIST_ITEM',
    label: 'Add Checklist Item',
    category: 'checklists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TRELLO_UPDATE_CHECKLIST_ITEM',
    label: 'Update Checklist Item',
    category: 'checklists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TRELLO_ARCHIVE_CARD',
    label: 'Archive Card',
    category: 'cards',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TRELLO_CREATE_LABEL',
    label: 'Create Label',
    category: 'labels',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TRELLO_UPDATE_LIST',
    label: 'Update List',
    category: 'lists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TRELLO_UPDATE_BOARD',
    label: 'Update Board',
    category: 'boards',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TRELLO_LIST_COMMENTS',
    label: 'List Comments',
    category: 'comments',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED
// ============================================================================

const ADVANCED_ACTIONS: TrelloAction[] = [
  {
    name: 'TRELLO_DELETE_CARD',
    label: 'Delete Card',
    category: 'cards',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TRELLO_DELETE_BOARD',
    label: 'Delete Board',
    category: 'boards',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TRELLO_DELETE_LABEL',
    label: 'Delete Label',
    category: 'labels',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TRELLO_GET_MEMBER',
    label: 'Get Member',
    category: 'members',
    priority: 4,
  },
  {
    name: 'TRELLO_LIST_BOARD_LABELS',
    label: 'List Board Labels',
    category: 'labels',
    priority: 4,
  },
  {
    name: 'TRELLO_GET_CHECKLISTS',
    label: 'Get Checklists',
    category: 'checklists',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_TRELLO_ACTIONS: TrelloAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getTrelloFeaturedActionNames(): string[] {
  return ALL_TRELLO_ACTIONS.map((a) => a.name);
}

export function getTrelloActionsByPriority(maxPriority: number = 3): TrelloAction[] {
  return ALL_TRELLO_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getTrelloActionNamesByPriority(maxPriority: number = 3): string[] {
  return getTrelloActionsByPriority(maxPriority).map((a) => a.name);
}

export function getTrelloActionsByCategory(category: TrelloActionCategory): TrelloAction[] {
  return ALL_TRELLO_ACTIONS.filter((a) => a.category === category);
}

export function getTrelloActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_TRELLO_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownTrelloAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_TRELLO_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveTrelloAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_TRELLO_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

export function sortByTrelloPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getTrelloActionPriority(a.name) - getTrelloActionPriority(b.name);
  });
}

export function getTrelloActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_TRELLO_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_TRELLO_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export function getTrelloSystemPrompt(): string {
  return `
## Trello Integration (Full Capabilities)

You have **full Trello access** through the user's connected account. Use the \`composio_TRELLO_*\` tools.

### Cards
- Create cards with descriptions, labels, due dates, and assignments
- Get card details and status
- Update card properties (name, description, due date, position)
- Move cards between lists (columns)
- Archive and delete cards
- Search across cards

### Boards & Lists
- List all boards the user has access to
- Create new boards with customizable backgrounds
- Create and manage lists (columns) within boards
- Update board and list settings

### Labels & Organization
- Create and manage labels with colors
- Add labels to cards for categorization
- View all labels on a board

### Checklists
- Create checklists on cards for task breakdown
- Add, update, and complete checklist items

### Comments & Members
- Add comments to cards for discussion
- List members on boards
- Assign members to cards

### Safety Rules
1. **ALWAYS confirm before creating cards** - show the board, list, and card details
2. **Confirm before deleting cards or boards** - deletion is permanent
3. **Confirm before archiving** - archived cards are hidden from view
4. **For batch operations**, summarize scope and get explicit approval
`;
}

export function getTrelloCapabilitySummary(): string {
  const stats = getTrelloActionStats();
  return `Trello (${stats.total} actions: cards, boards, lists, labels, checklists, comments)`;
}

export function logTrelloToolkitStats(): void {
  const stats = getTrelloActionStats();
  log.info('Trello Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
