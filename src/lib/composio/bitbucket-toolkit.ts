/**
 * COMPOSIO BITBUCKET TOOLKIT
 * ============================
 *
 * Comprehensive Bitbucket integration via Composio's tools.
 *
 * Categories:
 * - Repositories (list, create, get, update)
 * - Pull Requests (create, list, merge, review)
 * - Issues (create, list, update)
 * - Branches (list, create)
 * - Pipelines (list, trigger, get)
 */

import { logger } from '@/lib/logger';

const log = logger('BitbucketToolkit');

export type BitbucketActionCategory =
  | 'repositories'
  | 'pull_requests'
  | 'issues'
  | 'branches'
  | 'pipelines';

export interface BitbucketAction {
  name: string;
  label: string;
  category: BitbucketActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: BitbucketAction[] = [
  {
    name: 'BITBUCKET_LIST_REPOS',
    label: 'List Repositories',
    category: 'repositories',
    priority: 1,
  },
  { name: 'BITBUCKET_GET_REPO', label: 'Get Repository', category: 'repositories', priority: 1 },
  {
    name: 'BITBUCKET_CREATE_PR',
    label: 'Create Pull Request',
    category: 'pull_requests',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'BITBUCKET_LIST_PRS',
    label: 'List Pull Requests',
    category: 'pull_requests',
    priority: 1,
  },
  { name: 'BITBUCKET_GET_PR', label: 'Get Pull Request', category: 'pull_requests', priority: 1 },
  {
    name: 'BITBUCKET_CREATE_ISSUE',
    label: 'Create Issue',
    category: 'issues',
    priority: 1,
    writeOperation: true,
  },
];

const IMPORTANT_ACTIONS: BitbucketAction[] = [
  {
    name: 'BITBUCKET_MERGE_PR',
    label: 'Merge Pull Request',
    category: 'pull_requests',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'BITBUCKET_APPROVE_PR',
    label: 'Approve Pull Request',
    category: 'pull_requests',
    priority: 2,
    writeOperation: true,
  },
  { name: 'BITBUCKET_LIST_ISSUES', label: 'List Issues', category: 'issues', priority: 2 },
  { name: 'BITBUCKET_LIST_BRANCHES', label: 'List Branches', category: 'branches', priority: 2 },
  {
    name: 'BITBUCKET_CREATE_BRANCH',
    label: 'Create Branch',
    category: 'branches',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'BITBUCKET_ADD_PR_COMMENT',
    label: 'Add PR Comment',
    category: 'pull_requests',
    priority: 2,
    writeOperation: true,
  },
];

const USEFUL_ACTIONS: BitbucketAction[] = [
  {
    name: 'BITBUCKET_UPDATE_ISSUE',
    label: 'Update Issue',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'BITBUCKET_LIST_PIPELINES',
    label: 'List Pipelines',
    category: 'pipelines',
    priority: 3,
  },
  {
    name: 'BITBUCKET_GET_PIPELINE',
    label: 'Get Pipeline',
    category: 'pipelines',
    priority: 3,
  },
  {
    name: 'BITBUCKET_TRIGGER_PIPELINE',
    label: 'Trigger Pipeline',
    category: 'pipelines',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'BITBUCKET_CREATE_REPO',
    label: 'Create Repository',
    category: 'repositories',
    priority: 3,
    writeOperation: true,
  },
  { name: 'BITBUCKET_GET_COMMIT', label: 'Get Commit', category: 'repositories', priority: 3 },
];

const ADVANCED_ACTIONS: BitbucketAction[] = [
  {
    name: 'BITBUCKET_DECLINE_PR',
    label: 'Decline Pull Request',
    category: 'pull_requests',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'BITBUCKET_DELETE_BRANCH',
    label: 'Delete Branch',
    category: 'branches',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'BITBUCKET_DELETE_REPO',
    label: 'Delete Repository',
    category: 'repositories',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'BITBUCKET_STOP_PIPELINE',
    label: 'Stop Pipeline',
    category: 'pipelines',
    priority: 4,
    writeOperation: true,
  },
];

export const ALL_BITBUCKET_ACTIONS: BitbucketAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getBitbucketFeaturedActionNames(): string[] {
  return ALL_BITBUCKET_ACTIONS.map((a) => a.name);
}
export function getBitbucketActionsByPriority(maxPriority: number = 3): BitbucketAction[] {
  return ALL_BITBUCKET_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getBitbucketActionNamesByPriority(maxPriority: number = 3): string[] {
  return getBitbucketActionsByPriority(maxPriority).map((a) => a.name);
}
export function getBitbucketActionsByCategory(
  category: BitbucketActionCategory
): BitbucketAction[] {
  return ALL_BITBUCKET_ACTIONS.filter((a) => a.category === category);
}
export function getBitbucketActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_BITBUCKET_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownBitbucketAction(toolName: string): boolean {
  return ALL_BITBUCKET_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveBitbucketAction(toolName: string): boolean {
  return (
    ALL_BITBUCKET_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))
      ?.destructive === true
  );
}
export function sortByBitbucketPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getBitbucketActionPriority(a.name) - getBitbucketActionPriority(b.name)
  );
}

export function getBitbucketActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_BITBUCKET_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_BITBUCKET_ACTIONS.length, byPriority, byCategory };
}

export function getBitbucketSystemPrompt(): string {
  return `
## Bitbucket Integration (Full Capabilities)

You have **full Bitbucket access** through the user's connected account. Use the \`composio_BITBUCKET_*\` tools.

### Repositories
- List, create, and manage repositories
- View commits and repository details

### Pull Requests
- Create, review, approve, and merge pull requests
- Add comments to PR discussions
- Decline pull requests when needed

### Issues
- Create and manage project issues
- Track issue status and assignments

### Branches & Pipelines
- Create and manage branches
- Trigger and monitor CI/CD pipelines

### Safety Rules
1. **Confirm before merging PRs** - merges affect the main codebase
2. **NEVER delete repositories without explicit confirmation**
3. **Confirm before declining PRs** - this closes them
4. **For branch deletion**, verify it's not a protected branch
`;
}

export function getBitbucketCapabilitySummary(): string {
  const stats = getBitbucketActionStats();
  return `Bitbucket (${stats.total} actions: repos, PRs, issues, branches, pipelines)`;
}

export function logBitbucketToolkitStats(): void {
  const stats = getBitbucketActionStats();
  log.info('Bitbucket Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
