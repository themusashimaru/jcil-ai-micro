/**
 * COMPOSIO TODOIST TOOLKIT
 * ==========================
 *
 * Comprehensive Todoist integration via Composio's tools.
 *
 * Categories:
 * - Tasks (create, get, list, update, complete, reopen)
 * - Projects (create, list, get, update)
 * - Sections (create, list)
 * - Labels (create, list)
 * - Comments (create, list)
 */

import { logger } from '@/lib/logger';

const log = logger('TodoistToolkit');

export type TodoistActionCategory = 'tasks' | 'projects' | 'sections' | 'labels' | 'comments';

export interface TodoistAction {
  name: string;
  label: string;
  category: TodoistActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: TodoistAction[] = [
  {
    name: 'TODOIST_CREATE_TASK',
    label: 'Create Task',
    category: 'tasks',
    priority: 1,
    writeOperation: true,
  },
  { name: 'TODOIST_GET_TASK', label: 'Get Task', category: 'tasks', priority: 1 },
  { name: 'TODOIST_LIST_TASKS', label: 'List Tasks', category: 'tasks', priority: 1 },
  {
    name: 'TODOIST_COMPLETE_TASK',
    label: 'Complete Task',
    category: 'tasks',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'TODOIST_UPDATE_TASK',
    label: 'Update Task',
    category: 'tasks',
    priority: 1,
    writeOperation: true,
  },
];

const IMPORTANT_ACTIONS: TodoistAction[] = [
  { name: 'TODOIST_LIST_PROJECTS', label: 'List Projects', category: 'projects', priority: 2 },
  {
    name: 'TODOIST_CREATE_PROJECT',
    label: 'Create Project',
    category: 'projects',
    priority: 2,
    writeOperation: true,
  },
  { name: 'TODOIST_GET_PROJECT', label: 'Get Project', category: 'projects', priority: 2 },
  {
    name: 'TODOIST_REOPEN_TASK',
    label: 'Reopen Task',
    category: 'tasks',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TODOIST_CREATE_COMMENT',
    label: 'Create Comment',
    category: 'comments',
    priority: 2,
    writeOperation: true,
  },
];

const USEFUL_ACTIONS: TodoistAction[] = [
  {
    name: 'TODOIST_CREATE_SECTION',
    label: 'Create Section',
    category: 'sections',
    priority: 3,
    writeOperation: true,
  },
  { name: 'TODOIST_LIST_SECTIONS', label: 'List Sections', category: 'sections', priority: 3 },
  {
    name: 'TODOIST_CREATE_LABEL',
    label: 'Create Label',
    category: 'labels',
    priority: 3,
    writeOperation: true,
  },
  { name: 'TODOIST_LIST_LABELS', label: 'List Labels', category: 'labels', priority: 3 },
  { name: 'TODOIST_LIST_COMMENTS', label: 'List Comments', category: 'comments', priority: 3 },
  {
    name: 'TODOIST_UPDATE_PROJECT',
    label: 'Update Project',
    category: 'projects',
    priority: 3,
    writeOperation: true,
  },
];

const ADVANCED_ACTIONS: TodoistAction[] = [
  {
    name: 'TODOIST_DELETE_TASK',
    label: 'Delete Task',
    category: 'tasks',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TODOIST_DELETE_PROJECT',
    label: 'Delete Project',
    category: 'projects',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TODOIST_DELETE_LABEL',
    label: 'Delete Label',
    category: 'labels',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TODOIST_DELETE_COMMENT',
    label: 'Delete Comment',
    category: 'comments',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

export const ALL_TODOIST_ACTIONS: TodoistAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getTodoistFeaturedActionNames(): string[] {
  return ALL_TODOIST_ACTIONS.map((a) => a.name);
}
export function getTodoistActionsByPriority(maxPriority: number = 3): TodoistAction[] {
  return ALL_TODOIST_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getTodoistActionNamesByPriority(maxPriority: number = 3): string[] {
  return getTodoistActionsByPriority(maxPriority).map((a) => a.name);
}
export function getTodoistActionsByCategory(category: TodoistActionCategory): TodoistAction[] {
  return ALL_TODOIST_ACTIONS.filter((a) => a.category === category);
}
export function getTodoistActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_TODOIST_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownTodoistAction(toolName: string): boolean {
  return ALL_TODOIST_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveTodoistAction(toolName: string): boolean {
  return (
    ALL_TODOIST_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortByTodoistPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getTodoistActionPriority(a.name) - getTodoistActionPriority(b.name)
  );
}

export function getTodoistActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_TODOIST_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_TODOIST_ACTIONS.length, byPriority, byCategory };
}

export function getTodoistSystemPrompt(): string {
  return `
## Todoist Integration (Full Capabilities)

You have **full Todoist access** through the user's connected account. Use the \`composio_TODOIST_*\` tools.

### Tasks
- Create tasks with due dates, priorities, and labels
- Complete and reopen tasks
- Update task details and assignments
- List and filter tasks across projects

### Projects & Organization
- Create and manage projects
- Organize with sections and labels
- Add comments for discussion

### Safety Rules
1. **Confirm before deleting tasks or projects** - deletion is permanent
2. **Show task details before completing** - ensure correct task
3. **For bulk operations**, list affected items first
`;
}

export function getTodoistCapabilitySummary(): string {
  const stats = getTodoistActionStats();
  return `Todoist (${stats.total} actions: tasks, projects, sections, labels, comments)`;
}

export function logTodoistToolkitStats(): void {
  const stats = getTodoistActionStats();
  log.info('Todoist Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
