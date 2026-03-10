/**
 * COMPOSIO JIRA TOOLKIT
 * =====================
 *
 * Comprehensive Jira integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Issues (create, get, update, delete, search, transition, assign)
 * - Projects (list, get, create)
 * - Comments (add, list, update, delete)
 * - Sprints (list, get, create, manage)
 * - Boards (list, get)
 * - Users (search, get)
 * - Labels (list, create)
 * - Attachments (add, get, delete)
 */

import { logger } from '@/lib/logger';

const log = logger('JiraToolkit');

// ============================================================================
// JIRA ACTION CATEGORIES
// ============================================================================

export type JiraActionCategory =
  | 'issues'
  | 'projects'
  | 'comments'
  | 'sprints'
  | 'boards'
  | 'users'
  | 'labels'
  | 'attachments';

export interface JiraAction {
  name: string;
  label: string;
  category: JiraActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Jira connected)
// ============================================================================

const ESSENTIAL_ACTIONS: JiraAction[] = [
  {
    name: 'JIRA_CREATE_ISSUE',
    label: 'Create Issue',
    category: 'issues',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'JIRA_GET_ISSUE',
    label: 'Get Issue',
    category: 'issues',
    priority: 1,
  },
  {
    name: 'JIRA_UPDATE_ISSUE',
    label: 'Update Issue',
    category: 'issues',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'JIRA_SEARCH_ISSUES',
    label: 'Search Issues (JQL)',
    category: 'issues',
    priority: 1,
  },
  {
    name: 'JIRA_TRANSITION_ISSUE',
    label: 'Transition Issue',
    category: 'issues',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'JIRA_LIST_PROJECTS',
    label: 'List Projects',
    category: 'projects',
    priority: 1,
  },
  {
    name: 'JIRA_ADD_COMMENT',
    label: 'Add Comment',
    category: 'comments',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'JIRA_ASSIGN_ISSUE',
    label: 'Assign Issue',
    category: 'issues',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: JiraAction[] = [
  {
    name: 'JIRA_GET_PROJECT',
    label: 'Get Project',
    category: 'projects',
    priority: 2,
  },
  {
    name: 'JIRA_LIST_COMMENTS',
    label: 'List Comments',
    category: 'comments',
    priority: 2,
  },
  {
    name: 'JIRA_LIST_SPRINTS',
    label: 'List Sprints',
    category: 'sprints',
    priority: 2,
  },
  {
    name: 'JIRA_GET_SPRINT',
    label: 'Get Sprint',
    category: 'sprints',
    priority: 2,
  },
  {
    name: 'JIRA_LIST_BOARDS',
    label: 'List Boards',
    category: 'boards',
    priority: 2,
  },
  {
    name: 'JIRA_GET_TRANSITIONS',
    label: 'Get Transitions',
    category: 'issues',
    priority: 2,
  },
  {
    name: 'JIRA_SEARCH_USERS',
    label: 'Search Users',
    category: 'users',
    priority: 2,
  },
  {
    name: 'JIRA_LIST_ISSUE_TYPES',
    label: 'List Issue Types',
    category: 'issues',
    priority: 2,
  },
  {
    name: 'JIRA_LIST_PRIORITIES',
    label: 'List Priorities',
    category: 'issues',
    priority: 2,
  },
  {
    name: 'JIRA_LIST_STATUSES',
    label: 'List Statuses',
    category: 'issues',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: JiraAction[] = [
  {
    name: 'JIRA_CREATE_SPRINT',
    label: 'Create Sprint',
    category: 'sprints',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'JIRA_UPDATE_SPRINT',
    label: 'Update Sprint',
    category: 'sprints',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'JIRA_MOVE_TO_SPRINT',
    label: 'Move to Sprint',
    category: 'sprints',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'JIRA_GET_BOARD',
    label: 'Get Board',
    category: 'boards',
    priority: 3,
  },
  {
    name: 'JIRA_LIST_LABELS',
    label: 'List Labels',
    category: 'labels',
    priority: 3,
  },
  {
    name: 'JIRA_CREATE_LABEL',
    label: 'Create Label',
    category: 'labels',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'JIRA_ADD_ATTACHMENT',
    label: 'Add Attachment',
    category: 'attachments',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'JIRA_UPDATE_COMMENT',
    label: 'Update Comment',
    category: 'comments',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'JIRA_CREATE_PROJECT',
    label: 'Create Project',
    category: 'projects',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'JIRA_LINK_ISSUES',
    label: 'Link Issues',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'JIRA_LIST_SPRINT_ISSUES',
    label: 'List Sprint Issues',
    category: 'sprints',
    priority: 3,
  },
  {
    name: 'JIRA_GET_USER',
    label: 'Get User',
    category: 'users',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Specialized operations)
// ============================================================================

const ADVANCED_ACTIONS: JiraAction[] = [
  {
    name: 'JIRA_DELETE_ISSUE',
    label: 'Delete Issue',
    category: 'issues',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'JIRA_DELETE_COMMENT',
    label: 'Delete Comment',
    category: 'comments',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'JIRA_DELETE_ATTACHMENT',
    label: 'Delete Attachment',
    category: 'attachments',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'JIRA_BULK_UPDATE_ISSUES',
    label: 'Bulk Update Issues',
    category: 'issues',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'JIRA_GET_CHANGELOG',
    label: 'Get Changelog',
    category: 'issues',
    priority: 4,
  },
  {
    name: 'JIRA_LIST_WORKFLOWS',
    label: 'List Workflows',
    category: 'issues',
    priority: 4,
  },
  {
    name: 'JIRA_GET_BOARD_CONFIGURATION',
    label: 'Get Board Configuration',
    category: 'boards',
    priority: 4,
  },
  {
    name: 'JIRA_LIST_SPRINT_BACKLOG',
    label: 'List Sprint Backlog',
    category: 'sprints',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_JIRA_ACTIONS: JiraAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getJiraFeaturedActionNames(): string[] {
  return ALL_JIRA_ACTIONS.map((a) => a.name);
}

export function getJiraActionsByPriority(maxPriority: number = 3): JiraAction[] {
  return ALL_JIRA_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getJiraActionNamesByPriority(maxPriority: number = 3): string[] {
  return getJiraActionsByPriority(maxPriority).map((a) => a.name);
}

export function getJiraActionsByCategory(category: JiraActionCategory): JiraAction[] {
  return ALL_JIRA_ACTIONS.filter((a) => a.category === category);
}

export function getJiraActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_JIRA_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownJiraAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_JIRA_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveJiraAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_JIRA_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

export function sortByJiraPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getJiraActionPriority(a.name) - getJiraActionPriority(b.name);
  });
}

export function getJiraActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_JIRA_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_JIRA_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export function getJiraSystemPrompt(): string {
  return `
## Jira Integration (Full Capabilities)

You have **full Jira access** through the user's connected account. Use the \`composio_JIRA_*\` tools.

### Issues
- Create issues with type, priority, assignee, labels, and description
- Get issue details including status, comments, and history
- Update issue fields (summary, description, priority, labels, assignee)
- Search issues using JQL (Jira Query Language)
- Transition issues between workflow states (To Do → In Progress → Done)
- Assign issues to team members
- Link related issues together
- Bulk update multiple issues at once

### Projects & Boards
- List all accessible projects
- Get project details and configuration
- Create new projects
- List boards (Scrum, Kanban) and their configurations
- View board details

### Sprints
- List sprints in a board
- Get sprint details and progress
- Create new sprints
- Update sprint dates and goals
- Move issues to sprints
- View sprint backlog

### Comments & Attachments
- Add comments to issues
- List and read existing comments
- Update comments
- Add file attachments to issues

### Safety Rules
1. **ALWAYS confirm before creating issues** - show the project, type, summary, and assignee:
\`\`\`action-preview
{
  "platform": "Jira",
  "action": "Create Issue",
  "project": "PROJECT-KEY",
  "type": "Story/Bug/Task",
  "summary": "Issue summary",
  "toolName": "composio_JIRA_CREATE_ISSUE",
  "toolParams": { "project": "...", "issuetype": "...", "summary": "..." }
}
\`\`\`
2. **Confirm before transitioning issues** - show current and target status
3. **Never delete issues without explicit approval** - deletion is permanent
4. **Confirm before bulk updates** - show the scope and changes
5. **For sprint management**, confirm dates and issue movements
`;
}

export function getJiraCapabilitySummary(): string {
  const stats = getJiraActionStats();
  return `Jira (${stats.total} actions: issues, projects, sprints, boards, comments, attachments)`;
}

export function logJiraToolkitStats(): void {
  const stats = getJiraActionStats();
  log.info('Jira Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
