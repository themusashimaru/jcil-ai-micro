/**
 * COMPOSIO CLICKUP TOOLKIT
 * ========================
 *
 * Comprehensive ClickUp integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Tasks (create, get, update, delete, search)
 * - Spaces (list, get, create)
 * - Lists (create, get, list)
 * - Folders (create, get, list)
 * - Comments (create, list, update)
 * - Goals (create, list, update)
 * - Tags (list, add, remove)
 * - Time (track, list entries)
 */

import { logger } from '@/lib/logger';

const log = logger('ClickUpToolkit');

// ============================================================================
// CLICKUP ACTION CATEGORIES
// ============================================================================

export type ClickUpActionCategory =
  | 'tasks'
  | 'spaces'
  | 'lists'
  | 'folders'
  | 'comments'
  | 'goals'
  | 'tags'
  | 'time';

export interface ClickUpAction {
  name: string;
  label: string;
  category: ClickUpActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL
// ============================================================================

const ESSENTIAL_ACTIONS: ClickUpAction[] = [
  {
    name: 'CLICKUP_CREATE_TASK',
    label: 'Create Task',
    category: 'tasks',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'CLICKUP_GET_TASK',
    label: 'Get Task',
    category: 'tasks',
    priority: 1,
  },
  {
    name: 'CLICKUP_UPDATE_TASK',
    label: 'Update Task',
    category: 'tasks',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'CLICKUP_LIST_TASKS',
    label: 'List Tasks',
    category: 'tasks',
    priority: 1,
  },
  {
    name: 'CLICKUP_LIST_SPACES',
    label: 'List Spaces',
    category: 'spaces',
    priority: 1,
  },
  {
    name: 'CLICKUP_LIST_LISTS',
    label: 'List Lists',
    category: 'lists',
    priority: 1,
  },
  {
    name: 'CLICKUP_SEARCH_TASKS',
    label: 'Search Tasks',
    category: 'tasks',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT
// ============================================================================

const IMPORTANT_ACTIONS: ClickUpAction[] = [
  {
    name: 'CLICKUP_CREATE_COMMENT',
    label: 'Create Comment',
    category: 'comments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'CLICKUP_LIST_COMMENTS',
    label: 'List Comments',
    category: 'comments',
    priority: 2,
  },
  {
    name: 'CLICKUP_GET_SPACE',
    label: 'Get Space',
    category: 'spaces',
    priority: 2,
  },
  {
    name: 'CLICKUP_LIST_FOLDERS',
    label: 'List Folders',
    category: 'folders',
    priority: 2,
  },
  {
    name: 'CLICKUP_GET_LIST',
    label: 'Get List',
    category: 'lists',
    priority: 2,
  },
  {
    name: 'CLICKUP_CREATE_LIST',
    label: 'Create List',
    category: 'lists',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'CLICKUP_LIST_TAGS',
    label: 'List Tags',
    category: 'tags',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL
// ============================================================================

const USEFUL_ACTIONS: ClickUpAction[] = [
  {
    name: 'CLICKUP_CREATE_FOLDER',
    label: 'Create Folder',
    category: 'folders',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'CLICKUP_GET_FOLDER',
    label: 'Get Folder',
    category: 'folders',
    priority: 3,
  },
  {
    name: 'CLICKUP_CREATE_SPACE',
    label: 'Create Space',
    category: 'spaces',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'CLICKUP_ADD_TAG_TO_TASK',
    label: 'Add Tag to Task',
    category: 'tags',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'CLICKUP_CREATE_GOAL',
    label: 'Create Goal',
    category: 'goals',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'CLICKUP_LIST_GOALS',
    label: 'List Goals',
    category: 'goals',
    priority: 3,
  },
  {
    name: 'CLICKUP_TRACK_TIME',
    label: 'Track Time',
    category: 'time',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'CLICKUP_LIST_TIME_ENTRIES',
    label: 'List Time Entries',
    category: 'time',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED
// ============================================================================

const ADVANCED_ACTIONS: ClickUpAction[] = [
  {
    name: 'CLICKUP_DELETE_TASK',
    label: 'Delete Task',
    category: 'tasks',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'CLICKUP_DELETE_FOLDER',
    label: 'Delete Folder',
    category: 'folders',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'CLICKUP_DELETE_LIST',
    label: 'Delete List',
    category: 'lists',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'CLICKUP_UPDATE_COMMENT',
    label: 'Update Comment',
    category: 'comments',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'CLICKUP_UPDATE_GOAL',
    label: 'Update Goal',
    category: 'goals',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'CLICKUP_REMOVE_TAG_FROM_TASK',
    label: 'Remove Tag from Task',
    category: 'tags',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_CLICKUP_ACTIONS: ClickUpAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getClickUpFeaturedActionNames(): string[] {
  return ALL_CLICKUP_ACTIONS.map((a) => a.name);
}

export function getClickUpActionsByPriority(maxPriority: number = 3): ClickUpAction[] {
  return ALL_CLICKUP_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getClickUpActionNamesByPriority(maxPriority: number = 3): string[] {
  return getClickUpActionsByPriority(maxPriority).map((a) => a.name);
}

export function getClickUpActionsByCategory(category: ClickUpActionCategory): ClickUpAction[] {
  return ALL_CLICKUP_ACTIONS.filter((a) => a.category === category);
}

export function getClickUpActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_CLICKUP_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownClickUpAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_CLICKUP_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveClickUpAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_CLICKUP_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

export function sortByClickUpPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getClickUpActionPriority(a.name) - getClickUpActionPriority(b.name);
  });
}

export function getClickUpActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_CLICKUP_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_CLICKUP_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export function getClickUpSystemPrompt(): string {
  return `
## ClickUp Integration (Full Capabilities)

You have **full ClickUp access** through the user's connected account. Use the \`composio_CLICKUP_*\` tools.

### Tasks
- Create tasks with descriptions, assignees, due dates, priorities, and tags
- Get task details and status
- Update task properties and status
- Search across tasks with filters
- Delete tasks (with confirmation)

### Spaces, Folders & Lists
- List and navigate the workspace hierarchy (Spaces → Folders → Lists)
- Create new spaces, folders, and lists for organization
- Get details about any organizational unit

### Comments & Collaboration
- Create comments on tasks
- List comment threads
- Update existing comments

### Goals & Time Tracking
- Create goals with targets and deadlines
- List and track goal progress
- Track time on tasks
- View time entry reports

### Tags
- List available tags in a space
- Add and remove tags from tasks

### Safety Rules
1. **ALWAYS confirm before creating tasks** - show the list, title, and assignee details
2. **Confirm before deleting tasks, folders, or lists** - deletion is permanent
3. **For batch operations**, summarize scope and get explicit approval
4. **Include workspace context** when navigating hierarchy
`;
}

export function getClickUpCapabilitySummary(): string {
  const stats = getClickUpActionStats();
  return `ClickUp (${stats.total} actions: tasks, spaces, lists, folders, comments, goals, time tracking)`;
}

export function logClickUpToolkitStats(): void {
  const stats = getClickUpActionStats();
  log.info('ClickUp Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
