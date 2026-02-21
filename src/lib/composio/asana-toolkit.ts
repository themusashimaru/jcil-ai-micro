/**
 * COMPOSIO ASANA TOOLKIT
 * ======================
 *
 * Comprehensive Asana integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Tasks (create, get, update, delete, search, subtasks)
 * - Projects (create, get, list, update, sections)
 * - Sections (create, list, reorder)
 * - Workspaces (list, get)
 * - Tags (create, list, get)
 * - Comments (add, list)
 * - Users (get, list)
 */

import { logger } from '@/lib/logger';

const log = logger('AsanaToolkit');

// ============================================================================
// ASANA ACTION CATEGORIES
// ============================================================================

export type AsanaActionCategory =
  | 'tasks'
  | 'projects'
  | 'sections'
  | 'workspaces'
  | 'tags'
  | 'comments'
  | 'users';

export interface AsanaAction {
  name: string;
  label: string;
  category: AsanaActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL
// ============================================================================

const ESSENTIAL_ACTIONS: AsanaAction[] = [
  {
    name: 'ASANA_CREATE_TASK',
    label: 'Create Task',
    category: 'tasks',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'ASANA_GET_TASK',
    label: 'Get Task',
    category: 'tasks',
    priority: 1,
  },
  {
    name: 'ASANA_UPDATE_TASK',
    label: 'Update Task',
    category: 'tasks',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'ASANA_SEARCH_TASKS',
    label: 'Search Tasks',
    category: 'tasks',
    priority: 1,
  },
  {
    name: 'ASANA_LIST_PROJECTS',
    label: 'List Projects',
    category: 'projects',
    priority: 1,
  },
  {
    name: 'ASANA_GET_PROJECT',
    label: 'Get Project',
    category: 'projects',
    priority: 1,
  },
  {
    name: 'ASANA_LIST_WORKSPACES',
    label: 'List Workspaces',
    category: 'workspaces',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT
// ============================================================================

const IMPORTANT_ACTIONS: AsanaAction[] = [
  {
    name: 'ASANA_LIST_TASKS',
    label: 'List Tasks',
    category: 'tasks',
    priority: 2,
  },
  {
    name: 'ASANA_CREATE_PROJECT',
    label: 'Create Project',
    category: 'projects',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'ASANA_ADD_COMMENT',
    label: 'Add Comment',
    category: 'comments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'ASANA_LIST_SECTIONS',
    label: 'List Sections',
    category: 'sections',
    priority: 2,
  },
  {
    name: 'ASANA_CREATE_SUBTASK',
    label: 'Create Subtask',
    category: 'tasks',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'ASANA_LIST_PROJECT_TASKS',
    label: 'List Project Tasks',
    category: 'projects',
    priority: 2,
  },
  {
    name: 'ASANA_COMPLETE_TASK',
    label: 'Complete Task',
    category: 'tasks',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'ASANA_ASSIGN_TASK',
    label: 'Assign Task',
    category: 'tasks',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL
// ============================================================================

const USEFUL_ACTIONS: AsanaAction[] = [
  {
    name: 'ASANA_CREATE_SECTION',
    label: 'Create Section',
    category: 'sections',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'ASANA_MOVE_TASK_TO_SECTION',
    label: 'Move Task to Section',
    category: 'tasks',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'ASANA_UPDATE_PROJECT',
    label: 'Update Project',
    category: 'projects',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'ASANA_LIST_COMMENTS',
    label: 'List Comments',
    category: 'comments',
    priority: 3,
  },
  {
    name: 'ASANA_CREATE_TAG',
    label: 'Create Tag',
    category: 'tags',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'ASANA_LIST_TAGS',
    label: 'List Tags',
    category: 'tags',
    priority: 3,
  },
  {
    name: 'ASANA_ADD_TAG_TO_TASK',
    label: 'Add Tag to Task',
    category: 'tasks',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'ASANA_LIST_USERS',
    label: 'List Users',
    category: 'users',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED
// ============================================================================

const ADVANCED_ACTIONS: AsanaAction[] = [
  {
    name: 'ASANA_DELETE_TASK',
    label: 'Delete Task',
    category: 'tasks',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'ASANA_DELETE_PROJECT',
    label: 'Delete Project',
    category: 'projects',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'ASANA_GET_USER',
    label: 'Get User',
    category: 'users',
    priority: 4,
  },
  {
    name: 'ASANA_GET_WORKSPACE',
    label: 'Get Workspace',
    category: 'workspaces',
    priority: 4,
  },
  {
    name: 'ASANA_LIST_SUBTASKS',
    label: 'List Subtasks',
    category: 'tasks',
    priority: 4,
  },
  {
    name: 'ASANA_ADD_TASK_TO_PROJECT',
    label: 'Add Task to Project',
    category: 'tasks',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_ASANA_ACTIONS: AsanaAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getAsanaFeaturedActionNames(): string[] {
  return ALL_ASANA_ACTIONS.map((a) => a.name);
}

export function getAsanaActionsByPriority(maxPriority: number = 3): AsanaAction[] {
  return ALL_ASANA_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getAsanaActionNamesByPriority(maxPriority: number = 3): string[] {
  return getAsanaActionsByPriority(maxPriority).map((a) => a.name);
}

export function getAsanaActionsByCategory(category: AsanaActionCategory): AsanaAction[] {
  return ALL_ASANA_ACTIONS.filter((a) => a.category === category);
}

export function getAsanaActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_ASANA_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownAsanaAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_ASANA_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveAsanaAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_ASANA_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

export function sortByAsanaPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getAsanaActionPriority(a.name) - getAsanaActionPriority(b.name);
  });
}

export function getAsanaActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_ASANA_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_ASANA_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export function getAsanaSystemPrompt(): string {
  return `
## Asana Integration (Full Capabilities)

You have **full Asana access** through the user's connected account. Use the \`composio_ASANA_*\` tools.

### Tasks
- Create tasks with assignee, due date, description, and tags
- Get task details and status
- Update tasks (title, description, assignee, due date, completion)
- Search across tasks with filters
- Create subtasks for task breakdown
- Move tasks between sections
- Complete and assign tasks

### Projects
- List all projects in workspaces
- Get project details and members
- Create new projects with templates
- Update project settings and descriptions
- List all tasks in a project

### Sections & Organization
- List sections within a project
- Create new sections for organization
- Move tasks between sections

### Comments & Collaboration
- Add comments and status updates to tasks
- List comment threads on tasks

### Safety Rules
1. **ALWAYS confirm before creating tasks/projects** - show the workspace, project, title, and assignee
2. **Confirm before deleting tasks or projects** - deletion is permanent
3. **For batch operations**, summarize scope and get explicit approval
4. **Confirm before completing tasks** - verify the right task is being marked done
`;
}

export function getAsanaCapabilitySummary(): string {
  const stats = getAsanaActionStats();
  return `Asana (${stats.total} actions: tasks, projects, sections, comments, tags)`;
}

export function logAsanaToolkitStats(): void {
  const stats = getAsanaActionStats();
  log.info('Asana Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
