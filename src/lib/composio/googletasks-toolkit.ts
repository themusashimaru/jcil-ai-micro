/**
 * COMPOSIO GOOGLE TASKS TOOLKIT
 * ==============================
 *
 * Comprehensive Google Tasks integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Tasks (list, get, create, update, complete, delete, move, patch)
 * - Task Lists (list, get, create, update, delete)
 */

import { logger } from '@/lib/logger';

const log = logger('GoogleTasksToolkit');

// ============================================================================
// GOOGLE TASKS ACTION CATEGORIES
// ============================================================================

export type GoogleTasksActionCategory = 'tasks' | 'tasklists';

export interface GoogleTasksAction {
  name: string; // Composio action name (e.g., GOOGLETASKS_CREATE_TASK)
  label: string; // Human-readable label
  category: GoogleTasksActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Google Tasks connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GoogleTasksAction[] = [
  // Tasks - Core
  {
    name: 'GOOGLETASKS_LIST_TASKS',
    label: 'List Tasks',
    category: 'tasks',
    priority: 1,
  },
  {
    name: 'GOOGLETASKS_GET_TASK',
    label: 'Get Task',
    category: 'tasks',
    priority: 1,
  },
  {
    name: 'GOOGLETASKS_CREATE_TASK',
    label: 'Create Task',
    category: 'tasks',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLETASKS_UPDATE_TASK',
    label: 'Update Task',
    category: 'tasks',
    priority: 1,
    writeOperation: true,
  },

  // Task Lists - Core
  {
    name: 'GOOGLETASKS_LIST_TASK_LISTS',
    label: 'List Task Lists',
    category: 'tasklists',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GoogleTasksAction[] = [
  // Tasks - Extended
  {
    name: 'GOOGLETASKS_COMPLETE_TASK',
    label: 'Complete Task',
    category: 'tasks',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLETASKS_DELETE_TASK',
    label: 'Delete Task',
    category: 'tasks',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },

  // Task Lists - Extended
  {
    name: 'GOOGLETASKS_CREATE_TASK_LIST',
    label: 'Create Task List',
    category: 'tasklists',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLETASKS_GET_TASK_LIST',
    label: 'Get Task List',
    category: 'tasklists',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GoogleTasksAction[] = [
  // Tasks - Extended
  {
    name: 'GOOGLETASKS_MOVE_TASK',
    label: 'Move Task',
    category: 'tasks',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLETASKS_CLEAR_COMPLETED',
    label: 'Clear Completed Tasks',
    category: 'tasks',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLETASKS_PATCH_TASK',
    label: 'Patch Task',
    category: 'tasks',
    priority: 3,
    writeOperation: true,
  },

  // Task Lists - Extended
  {
    name: 'GOOGLETASKS_UPDATE_TASK_LIST',
    label: 'Update Task List',
    category: 'tasklists',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: GoogleTasksAction[] = [
  {
    name: 'GOOGLETASKS_DELETE_TASK_LIST',
    label: 'Delete Task List',
    category: 'tasklists',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLETASKS_LIST_ALL_TASKS',
    label: 'List All Tasks',
    category: 'tasks',
    priority: 4,
  },
  {
    name: 'GOOGLETASKS_INSERT_TASK',
    label: 'Insert Task',
    category: 'tasks',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GOOGLE_TASKS_ACTIONS: GoogleTasksAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGoogleTasksFeaturedActionNames(): string[] {
  return ALL_GOOGLE_TASKS_ACTIONS.map((a) => a.name);
}

export function getGoogleTasksActionsByPriority(maxPriority: number = 3): GoogleTasksAction[] {
  return ALL_GOOGLE_TASKS_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGoogleTasksActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGoogleTasksActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGoogleTasksActionsByCategory(
  category: GoogleTasksActionCategory
): GoogleTasksAction[] {
  return ALL_GOOGLE_TASKS_ACTIONS.filter((a) => a.category === category);
}

export function getGoogleTasksActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GOOGLE_TASKS_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGoogleTasksAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_TASKS_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGoogleTasksAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_TASKS_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Google Tasks action priority.
 * Known Google Tasks actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGoogleTasksPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGoogleTasksActionPriority(a.name) - getGoogleTasksActionPriority(b.name);
  });
}

export function getGoogleTasksActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GOOGLE_TASKS_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GOOGLE_TASKS_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Google Tasks-specific system prompt when user has Google Tasks connected.
 * Tells Claude exactly what it can do via the Composio Google Tasks toolkit.
 */
export function getGoogleTasksSystemPrompt(): string {
  return `
## Google Tasks Integration (Full Capabilities)

You have **full Google Tasks access** through the user's connected account. Use the \`composio_GOOGLETASKS_*\` tools.

### Task Management
- List all tasks in a specific task list
- Get details for a specific task by ID
- Create new tasks with title, notes, and due date
- Update existing tasks (title, notes, due date, status)
- Mark tasks as completed
- Move tasks to reorder them or change their parent
- Patch tasks for partial updates
- Insert tasks at specific positions in a list

### Task Lists
- List all task lists in the user's account
- Get details for a specific task list
- Create new task lists with a title
- Update existing task list titles
- Delete entire task lists (with confirmation)

### Completing & Clearing Tasks
- Mark individual tasks as completed
- Clear all completed tasks from a task list in bulk

### Safety Rules
1. **ALWAYS confirm before deleting tasks** - show the task title and details before deletion:
\`\`\`action-preview
{
  "platform": "Google Tasks",
  "action": "Delete Task",
  "task": "Task title",
  "taskList": "Task list name",
  "toolName": "composio_GOOGLETASKS_DELETE_TASK",
  "toolParams": { "taskId": "...", "taskListId": "..." }
}
\`\`\`
2. **Confirm before clearing completed tasks** - show how many tasks will be removed and from which list
3. **Never delete a task list without explicit approval** - deletion removes all tasks in the list permanently
4. **Show task details before updating** - display the current state and proposed changes
5. **For bulk operations**, summarize what will happen and get explicit approval
6. **When creating tasks**, confirm the target task list if the user has multiple lists
7. **Handle due dates carefully** - always confirm date and timezone interpretation with the user
8. **For move operations**, show the current and target positions before executing
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGoogleTasksCapabilitySummary(): string {
  const stats = getGoogleTasksActionStats();
  return `Google Tasks (${stats.total} actions: tasks, task lists, completion, organization)`;
}

export function logGoogleTasksToolkitStats(): void {
  const stats = getGoogleTasksActionStats();
  log.info('Google Tasks Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
