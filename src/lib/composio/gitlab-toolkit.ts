/**
 * COMPOSIO GITLAB TOOLKIT
 * =======================
 *
 * Comprehensive GitLab integration via Composio's tools.
 *
 * Categories:
 * - Projects (list, get, create, update, fork)
 * - Issues (create, get, update, list, search, close)
 * - MergeRequests (create, get, list, update, merge, approve)
 * - Branches (list, create, delete)
 * - Pipelines (list, get, trigger, cancel)
 * - Users (get, list, search)
 * - Commits (list, get)
 * - Labels (list, create)
 */

import { logger } from '@/lib/logger';

const log = logger('GitLabToolkit');

export type GitLabActionCategory =
  | 'projects'
  | 'issues'
  | 'merge_requests'
  | 'branches'
  | 'pipelines'
  | 'users'
  | 'commits'
  | 'labels';

export interface GitLabAction {
  name: string;
  label: string;
  category: GitLabActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: GitLabAction[] = [
  { name: 'GITLAB_LIST_PROJECTS', label: 'List Projects', category: 'projects', priority: 1 },
  { name: 'GITLAB_GET_PROJECT', label: 'Get Project', category: 'projects', priority: 1 },
  {
    name: 'GITLAB_CREATE_ISSUE',
    label: 'Create Issue',
    category: 'issues',
    priority: 1,
    writeOperation: true,
  },
  { name: 'GITLAB_GET_ISSUE', label: 'Get Issue', category: 'issues', priority: 1 },
  { name: 'GITLAB_LIST_ISSUES', label: 'List Issues', category: 'issues', priority: 1 },
  {
    name: 'GITLAB_CREATE_MERGE_REQUEST',
    label: 'Create Merge Request',
    category: 'merge_requests',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GITLAB_GET_MERGE_REQUEST',
    label: 'Get Merge Request',
    category: 'merge_requests',
    priority: 1,
  },
  {
    name: 'GITLAB_LIST_MERGE_REQUESTS',
    label: 'List Merge Requests',
    category: 'merge_requests',
    priority: 1,
  },
];

const IMPORTANT_ACTIONS: GitLabAction[] = [
  {
    name: 'GITLAB_UPDATE_ISSUE',
    label: 'Update Issue',
    category: 'issues',
    priority: 2,
    writeOperation: true,
  },
  { name: 'GITLAB_SEARCH_ISSUES', label: 'Search Issues', category: 'issues', priority: 2 },
  {
    name: 'GITLAB_UPDATE_MERGE_REQUEST',
    label: 'Update Merge Request',
    category: 'merge_requests',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GITLAB_MERGE_MERGE_REQUEST',
    label: 'Merge MR',
    category: 'merge_requests',
    priority: 2,
    writeOperation: true,
  },
  { name: 'GITLAB_LIST_BRANCHES', label: 'List Branches', category: 'branches', priority: 2 },
  { name: 'GITLAB_LIST_PIPELINES', label: 'List Pipelines', category: 'pipelines', priority: 2 },
  { name: 'GITLAB_GET_PIPELINE', label: 'Get Pipeline', category: 'pipelines', priority: 2 },
  { name: 'GITLAB_LIST_COMMITS', label: 'List Commits', category: 'commits', priority: 2 },
  {
    name: 'GITLAB_ADD_ISSUE_COMMENT',
    label: 'Add Issue Comment',
    category: 'issues',
    priority: 2,
    writeOperation: true,
  },
];

const USEFUL_ACTIONS: GitLabAction[] = [
  {
    name: 'GITLAB_CREATE_PROJECT',
    label: 'Create Project',
    category: 'projects',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITLAB_FORK_PROJECT',
    label: 'Fork Project',
    category: 'projects',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITLAB_CREATE_BRANCH',
    label: 'Create Branch',
    category: 'branches',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITLAB_TRIGGER_PIPELINE',
    label: 'Trigger Pipeline',
    category: 'pipelines',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITLAB_APPROVE_MERGE_REQUEST',
    label: 'Approve MR',
    category: 'merge_requests',
    priority: 3,
    writeOperation: true,
  },
  { name: 'GITLAB_LIST_LABELS', label: 'List Labels', category: 'labels', priority: 3 },
  {
    name: 'GITLAB_CREATE_LABEL',
    label: 'Create Label',
    category: 'labels',
    priority: 3,
    writeOperation: true,
  },
  { name: 'GITLAB_GET_COMMIT', label: 'Get Commit', category: 'commits', priority: 3 },
  {
    name: 'GITLAB_CLOSE_ISSUE',
    label: 'Close Issue',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },
  { name: 'GITLAB_SEARCH_USERS', label: 'Search Users', category: 'users', priority: 3 },
];

const ADVANCED_ACTIONS: GitLabAction[] = [
  {
    name: 'GITLAB_DELETE_BRANCH',
    label: 'Delete Branch',
    category: 'branches',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GITLAB_CANCEL_PIPELINE',
    label: 'Cancel Pipeline',
    category: 'pipelines',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GITLAB_UPDATE_PROJECT',
    label: 'Update Project',
    category: 'projects',
    priority: 4,
    writeOperation: true,
  },
  { name: 'GITLAB_GET_USER', label: 'Get User', category: 'users', priority: 4 },
  {
    name: 'GITLAB_LIST_PROJECT_MEMBERS',
    label: 'List Project Members',
    category: 'users',
    priority: 4,
  },
  {
    name: 'GITLAB_DELETE_ISSUE',
    label: 'Delete Issue',
    category: 'issues',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GITLAB_RETRY_PIPELINE',
    label: 'Retry Pipeline',
    category: 'pipelines',
    priority: 4,
    writeOperation: true,
  },
];

export const ALL_GITLAB_ACTIONS: GitLabAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getGitLabFeaturedActionNames(): string[] {
  return ALL_GITLAB_ACTIONS.map((a) => a.name);
}
export function getGitLabActionsByPriority(maxPriority: number = 3): GitLabAction[] {
  return ALL_GITLAB_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getGitLabActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGitLabActionsByPriority(maxPriority).map((a) => a.name);
}
export function getGitLabActionsByCategory(category: GitLabActionCategory): GitLabAction[] {
  return ALL_GITLAB_ACTIONS.filter((a) => a.category === category);
}
export function getGitLabActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_GITLAB_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownGitLabAction(toolName: string): boolean {
  return ALL_GITLAB_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveGitLabAction(toolName: string): boolean {
  return (
    ALL_GITLAB_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortByGitLabPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getGitLabActionPriority(a.name) - getGitLabActionPriority(b.name)
  );
}

export function getGitLabActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GITLAB_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GITLAB_ACTIONS.length, byPriority, byCategory };
}

export function getGitLabSystemPrompt(): string {
  return `
## GitLab Integration (Full Capabilities)

You have **full GitLab access** through the user's connected account. Use the \`composio_GITLAB_*\` tools.

### Projects
- List, get, create, update, and fork projects
- View project details, members, and settings

### Issues
- Create, get, update, close, and delete issues
- Search issues with filters (state, labels, assignee)
- Add comments to issues

### Merge Requests
- Create, get, list, and update merge requests
- Merge approved MRs
- Approve merge requests for code review

### Branches & Commits
- List and create branches
- View commit history and details
- Delete merged branches

### CI/CD Pipelines
- List and get pipeline details and status
- Trigger new pipeline runs
- Cancel or retry pipelines

### Safety Rules
1. **Confirm before merging MRs** - show source/target branches and pipeline status
2. **Confirm before deleting branches** - ensure they are fully merged
3. **Confirm before triggering pipelines** - show the branch and pipeline config
4. **Never delete issues without explicit approval**
`;
}

export function getGitLabCapabilitySummary(): string {
  const stats = getGitLabActionStats();
  return `GitLab (${stats.total} actions: projects, issues, MRs, branches, pipelines, commits)`;
}

export function logGitLabToolkitStats(): void {
  const stats = getGitLabActionStats();
  log.info('GitLab Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
