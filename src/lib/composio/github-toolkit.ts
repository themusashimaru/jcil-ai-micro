/**
 * COMPOSIO GITHUB TOOLKIT
 * =======================
 *
 * Comprehensive GitHub integration via Composio's 792+ tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Repository Management (create, configure, manage repos)
 * - Issues & Projects (full issue lifecycle, labels, milestones, projects)
 * - Pull Requests (create, review, merge, manage PRs)
 * - Code & Commits (file CRUD, commits, branches, tags)
 * - GitHub Actions (workflows, runs, artifacts, secrets)
 * - Releases & Deployments (releases, deploy environments)
 * - Users & Organizations (teams, members, permissions)
 * - Search & Discovery (code, repos, issues, users search)
 * - Gists & Miscellaneous (gists, notifications, stars)
 */

import { logger } from '@/lib/logger';

const log = logger('GitHubToolkit');

// ============================================================================
// GITHUB ACTION CATEGORIES
// ============================================================================

export type GitHubActionCategory =
  | 'repository'
  | 'issues'
  | 'pull_requests'
  | 'code'
  | 'actions'
  | 'releases'
  | 'organizations'
  | 'search'
  | 'gists';

export interface GitHubAction {
  name: string; // Composio action name (e.g., GITHUB_CREATE_ISSUE)
  label: string; // Human-readable label
  category: GitHubActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when GitHub connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GitHubAction[] = [
  // Issues
  {
    name: 'GITHUB_CREATE_ISSUE',
    label: 'Create Issue',
    category: 'issues',
    priority: 1,
    writeOperation: true,
  },
  { name: 'GITHUB_LIST_ISSUES', label: 'List Issues', category: 'issues', priority: 1 },
  { name: 'GITHUB_GET_ISSUE', label: 'Get Issue Details', category: 'issues', priority: 1 },
  {
    name: 'GITHUB_UPDATE_ISSUE',
    label: 'Update Issue',
    category: 'issues',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GITHUB_CREATE_ISSUE_COMMENT',
    label: 'Comment on Issue',
    category: 'issues',
    priority: 1,
    writeOperation: true,
  },

  // Pull Requests
  {
    name: 'GITHUB_CREATE_PULL_REQUEST',
    label: 'Create Pull Request',
    category: 'pull_requests',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GITHUB_LIST_PULL_REQUESTS',
    label: 'List Pull Requests',
    category: 'pull_requests',
    priority: 1,
  },
  {
    name: 'GITHUB_GET_PULL_REQUEST',
    label: 'Get PR Details',
    category: 'pull_requests',
    priority: 1,
  },
  {
    name: 'GITHUB_MERGE_PULL_REQUEST',
    label: 'Merge Pull Request',
    category: 'pull_requests',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GITHUB_CREATE_REVIEW_COMMENT',
    label: 'Review PR',
    category: 'pull_requests',
    priority: 1,
    writeOperation: true,
  },

  // Repository
  {
    name: 'GITHUB_GET_REPOSITORY',
    label: 'Get Repository Info',
    category: 'repository',
    priority: 1,
  },
  {
    name: 'GITHUB_LIST_REPOS_FOR_AUTHENTICATED_USER',
    label: 'List My Repos',
    category: 'repository',
    priority: 1,
  },
  {
    name: 'GITHUB_CREATE_REPOSITORY',
    label: 'Create Repository',
    category: 'repository',
    priority: 1,
    writeOperation: true,
  },

  // Code
  {
    name: 'GITHUB_GET_REPOSITORY_CONTENT',
    label: 'Get File Contents',
    category: 'code',
    priority: 1,
  },
  {
    name: 'GITHUB_CREATE_OR_UPDATE_FILE',
    label: 'Create/Update File',
    category: 'code',
    priority: 1,
    writeOperation: true,
  },
  { name: 'GITHUB_LIST_BRANCHES', label: 'List Branches', category: 'code', priority: 1 },

  // Search
  { name: 'GITHUB_SEARCH_CODE', label: 'Search Code', category: 'search', priority: 1 },
  {
    name: 'GITHUB_SEARCH_REPOSITORIES',
    label: 'Search Repositories',
    category: 'search',
    priority: 1,
  },
  {
    name: 'GITHUB_SEARCH_ISSUES_AND_PULL_REQUESTS',
    label: 'Search Issues & PRs',
    category: 'search',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GitHubAction[] = [
  // Issues - Extended
  {
    name: 'GITHUB_ADD_LABELS_TO_ISSUE',
    label: 'Add Labels',
    category: 'issues',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GITHUB_REMOVE_LABEL_FROM_ISSUE',
    label: 'Remove Label',
    category: 'issues',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GITHUB_ADD_ASSIGNEES_TO_ISSUE',
    label: 'Assign Issue',
    category: 'issues',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GITHUB_LIST_ISSUE_COMMENTS',
    label: 'List Issue Comments',
    category: 'issues',
    priority: 2,
  },
  {
    name: 'GITHUB_CREATE_LABEL',
    label: 'Create Label',
    category: 'issues',
    priority: 2,
    writeOperation: true,
  },
  { name: 'GITHUB_LIST_LABELS_FOR_REPO', label: 'List Labels', category: 'issues', priority: 2 },
  {
    name: 'GITHUB_CREATE_MILESTONE',
    label: 'Create Milestone',
    category: 'issues',
    priority: 2,
    writeOperation: true,
  },
  { name: 'GITHUB_LIST_MILESTONES', label: 'List Milestones', category: 'issues', priority: 2 },

  // Pull Requests - Extended
  {
    name: 'GITHUB_UPDATE_PULL_REQUEST',
    label: 'Update PR',
    category: 'pull_requests',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GITHUB_LIST_PULL_REQUEST_COMMITS',
    label: 'List PR Commits',
    category: 'pull_requests',
    priority: 2,
  },
  {
    name: 'GITHUB_LIST_PULL_REQUEST_FILES',
    label: 'List PR Files',
    category: 'pull_requests',
    priority: 2,
  },
  {
    name: 'GITHUB_REQUEST_REVIEWERS',
    label: 'Request Reviewers',
    category: 'pull_requests',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GITHUB_LIST_REVIEWS_FOR_PULL_REQUEST',
    label: 'List PR Reviews',
    category: 'pull_requests',
    priority: 2,
  },
  {
    name: 'GITHUB_CREATE_PULL_REQUEST_REVIEW',
    label: 'Submit PR Review',
    category: 'pull_requests',
    priority: 2,
    writeOperation: true,
  },

  // Code - Extended
  {
    name: 'GITHUB_CREATE_BRANCH',
    label: 'Create Branch',
    category: 'code',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GITHUB_DELETE_FILE',
    label: 'Delete File',
    category: 'code',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },
  { name: 'GITHUB_LIST_COMMITS', label: 'List Commits', category: 'code', priority: 2 },
  { name: 'GITHUB_GET_COMMIT', label: 'Get Commit Details', category: 'code', priority: 2 },
  { name: 'GITHUB_COMPARE_COMMITS', label: 'Compare Commits', category: 'code', priority: 2 },
  { name: 'GITHUB_GET_BRANCH', label: 'Get Branch Details', category: 'code', priority: 2 },

  // Repository - Extended
  {
    name: 'GITHUB_LIST_COLLABORATORS',
    label: 'List Collaborators',
    category: 'repository',
    priority: 2,
  },
  {
    name: 'GITHUB_ADD_COLLABORATOR',
    label: 'Add Collaborator',
    category: 'repository',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GITHUB_LIST_REPOSITORY_LANGUAGES',
    label: 'List Languages',
    category: 'repository',
    priority: 2,
  },
  {
    name: 'GITHUB_LIST_REPOSITORY_TOPICS',
    label: 'List Topics',
    category: 'repository',
    priority: 2,
  },
  { name: 'GITHUB_GET_README', label: 'Get README', category: 'repository', priority: 2 },

  // GitHub Actions
  {
    name: 'GITHUB_LIST_WORKFLOW_RUNS',
    label: 'List Workflow Runs',
    category: 'actions',
    priority: 2,
  },
  { name: 'GITHUB_GET_WORKFLOW_RUN', label: 'Get Workflow Run', category: 'actions', priority: 2 },
  {
    name: 'GITHUB_LIST_REPOSITORY_WORKFLOWS',
    label: 'List Workflows',
    category: 'actions',
    priority: 2,
  },
  {
    name: 'GITHUB_CREATE_WORKFLOW_DISPATCH',
    label: 'Trigger Workflow',
    category: 'actions',
    priority: 2,
    writeOperation: true,
  },

  // Releases
  {
    name: 'GITHUB_CREATE_RELEASE',
    label: 'Create Release',
    category: 'releases',
    priority: 2,
    writeOperation: true,
  },
  { name: 'GITHUB_LIST_RELEASES', label: 'List Releases', category: 'releases', priority: 2 },
  {
    name: 'GITHUB_GET_LATEST_RELEASE',
    label: 'Get Latest Release',
    category: 'releases',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GitHubAction[] = [
  // Issues - Project Management
  {
    name: 'GITHUB_LOCK_ISSUE',
    label: 'Lock Issue',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITHUB_UNLOCK_ISSUE',
    label: 'Unlock Issue',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITHUB_UPDATE_ISSUE_COMMENT',
    label: 'Update Comment',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITHUB_DELETE_ISSUE_COMMENT',
    label: 'Delete Comment',
    category: 'issues',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GITHUB_UPDATE_LABEL',
    label: 'Update Label',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITHUB_UPDATE_MILESTONE',
    label: 'Update Milestone',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },

  // Repository
  {
    name: 'GITHUB_UPDATE_REPOSITORY',
    label: 'Update Repo Settings',
    category: 'repository',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITHUB_CREATE_FORK',
    label: 'Fork Repository',
    category: 'repository',
    priority: 3,
    writeOperation: true,
  },
  { name: 'GITHUB_LIST_FORKS', label: 'List Forks', category: 'repository', priority: 3 },
  {
    name: 'GITHUB_CREATE_WEBHOOK',
    label: 'Create Webhook',
    category: 'repository',
    priority: 3,
    writeOperation: true,
  },
  { name: 'GITHUB_LIST_WEBHOOKS', label: 'List Webhooks', category: 'repository', priority: 3 },
  {
    name: 'GITHUB_REPLACE_ALL_REPOSITORY_TOPICS',
    label: 'Set Topics',
    category: 'repository',
    priority: 3,
    writeOperation: true,
  },

  // Branch Protection & Tags
  {
    name: 'GITHUB_GET_BRANCH_PROTECTION',
    label: 'Get Branch Protection',
    category: 'code',
    priority: 3,
  },
  {
    name: 'GITHUB_UPDATE_BRANCH_PROTECTION',
    label: 'Set Branch Protection',
    category: 'code',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITHUB_DELETE_BRANCH',
    label: 'Delete Branch',
    category: 'code',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GITHUB_CREATE_TAG',
    label: 'Create Tag',
    category: 'code',
    priority: 3,
    writeOperation: true,
  },

  // GitHub Actions - Extended
  {
    name: 'GITHUB_RE_RUN_WORKFLOW',
    label: 'Re-run Workflow',
    category: 'actions',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITHUB_CANCEL_WORKFLOW_RUN',
    label: 'Cancel Workflow',
    category: 'actions',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITHUB_LIST_WORKFLOW_RUN_LOGS',
    label: 'Get Workflow Logs',
    category: 'actions',
    priority: 3,
  },
  {
    name: 'GITHUB_LIST_ARTIFACTS_FOR_REPO',
    label: 'List Artifacts',
    category: 'actions',
    priority: 3,
  },
  {
    name: 'GITHUB_CREATE_OR_UPDATE_REPO_SECRET',
    label: 'Set Repo Secret',
    category: 'actions',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITHUB_LIST_REPO_SECRETS',
    label: 'List Repo Secrets',
    category: 'actions',
    priority: 3,
  },

  // Releases - Extended
  {
    name: 'GITHUB_UPDATE_RELEASE',
    label: 'Update Release',
    category: 'releases',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITHUB_DELETE_RELEASE',
    label: 'Delete Release',
    category: 'releases',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GITHUB_GENERATE_RELEASE_NOTES',
    label: 'Generate Release Notes',
    category: 'releases',
    priority: 3,
  },

  // Organizations
  {
    name: 'GITHUB_LIST_ORGANIZATION_REPOS',
    label: 'List Org Repos',
    category: 'organizations',
    priority: 3,
  },
  {
    name: 'GITHUB_LIST_ORGANIZATION_MEMBERS',
    label: 'List Org Members',
    category: 'organizations',
    priority: 3,
  },
  { name: 'GITHUB_LIST_TEAMS', label: 'List Teams', category: 'organizations', priority: 3 },
  { name: 'GITHUB_GET_TEAM', label: 'Get Team Details', category: 'organizations', priority: 3 },

  // Gists
  {
    name: 'GITHUB_CREATE_GIST',
    label: 'Create Gist',
    category: 'gists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GITHUB_LIST_GISTS_FOR_AUTHENTICATED_USER',
    label: 'List My Gists',
    category: 'gists',
    priority: 3,
  },
  { name: 'GITHUB_GET_GIST', label: 'Get Gist', category: 'gists', priority: 3 },

  // Search - Extended
  { name: 'GITHUB_SEARCH_USERS', label: 'Search Users', category: 'search', priority: 3 },
  { name: 'GITHUB_SEARCH_TOPICS', label: 'Search Topics', category: 'search', priority: 3 },
  { name: 'GITHUB_SEARCH_COMMITS', label: 'Search Commits', category: 'search', priority: 3 },

  // User
  {
    name: 'GITHUB_GET_AUTHENTICATED_USER',
    label: 'Get My Profile',
    category: 'organizations',
    priority: 3,
  },
  {
    name: 'GITHUB_LIST_FOLLOWERS',
    label: 'List Followers',
    category: 'organizations',
    priority: 3,
  },
  {
    name: 'GITHUB_LIST_STARRED_REPOS',
    label: 'List Starred Repos',
    category: 'search',
    priority: 3,
  },
  {
    name: 'GITHUB_STAR_REPO',
    label: 'Star Repository',
    category: 'repository',
    priority: 3,
    writeOperation: true,
  },

  // Notifications
  {
    name: 'GITHUB_LIST_NOTIFICATIONS',
    label: 'List Notifications',
    category: 'gists',
    priority: 3,
  },
  {
    name: 'GITHUB_MARK_NOTIFICATIONS_AS_READ',
    label: 'Mark Notifications Read',
    category: 'gists',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Power-user and admin operations)
// ============================================================================

const ADVANCED_ACTIONS: GitHubAction[] = [
  // Repository Admin
  {
    name: 'GITHUB_DELETE_REPOSITORY',
    label: 'Delete Repository',
    category: 'repository',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GITHUB_TRANSFER_REPOSITORY',
    label: 'Transfer Repository',
    category: 'repository',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GITHUB_CREATE_DEPLOY_KEY',
    label: 'Create Deploy Key',
    category: 'repository',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GITHUB_LIST_DEPLOY_KEYS',
    label: 'List Deploy Keys',
    category: 'repository',
    priority: 4,
  },
  {
    name: 'GITHUB_REMOVE_COLLABORATOR',
    label: 'Remove Collaborator',
    category: 'repository',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Deployments
  {
    name: 'GITHUB_CREATE_DEPLOYMENT',
    label: 'Create Deployment',
    category: 'releases',
    priority: 4,
    writeOperation: true,
  },
  { name: 'GITHUB_LIST_DEPLOYMENTS', label: 'List Deployments', category: 'releases', priority: 4 },
  {
    name: 'GITHUB_CREATE_DEPLOYMENT_STATUS',
    label: 'Update Deploy Status',
    category: 'releases',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GITHUB_LIST_ENVIRONMENTS',
    label: 'List Environments',
    category: 'releases',
    priority: 4,
  },

  // Check Runs & Status
  {
    name: 'GITHUB_CREATE_CHECK_RUN',
    label: 'Create Check Run',
    category: 'actions',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GITHUB_UPDATE_CHECK_RUN',
    label: 'Update Check Run',
    category: 'actions',
    priority: 4,
    writeOperation: true,
  },
  { name: 'GITHUB_LIST_CHECK_RUNS', label: 'List Check Runs', category: 'actions', priority: 4 },
  {
    name: 'GITHUB_CREATE_COMMIT_STATUS',
    label: 'Create Commit Status',
    category: 'actions',
    priority: 4,
    writeOperation: true,
  },

  // Organization Admin
  {
    name: 'GITHUB_CREATE_TEAM',
    label: 'Create Team',
    category: 'organizations',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GITHUB_ADD_TEAM_MEMBER',
    label: 'Add Team Member',
    category: 'organizations',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GITHUB_REMOVE_TEAM_MEMBER',
    label: 'Remove Team Member',
    category: 'organizations',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GITHUB_ADD_TEAM_REPOSITORY',
    label: 'Add Repo to Team',
    category: 'organizations',
    priority: 4,
    writeOperation: true,
  },

  // Projects V2
  {
    name: 'GITHUB_CREATE_PROJECT',
    label: 'Create Project',
    category: 'issues',
    priority: 4,
    writeOperation: true,
  },
  { name: 'GITHUB_LIST_PROJECTS', label: 'List Projects', category: 'issues', priority: 4 },
  {
    name: 'GITHUB_ADD_PROJECT_ITEM',
    label: 'Add to Project',
    category: 'issues',
    priority: 4,
    writeOperation: true,
  },

  // Gists - Extended
  {
    name: 'GITHUB_UPDATE_GIST',
    label: 'Update Gist',
    category: 'gists',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GITHUB_DELETE_GIST',
    label: 'Delete Gist',
    category: 'gists',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GITHUB_FORK_GIST',
    label: 'Fork Gist',
    category: 'gists',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GITHUB_ACTIONS: GitHubAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGitHubFeaturedActionNames(): string[] {
  return ALL_GITHUB_ACTIONS.map((a) => a.name);
}

export function getGitHubActionsByPriority(maxPriority: number = 3): GitHubAction[] {
  return ALL_GITHUB_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGitHubActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGitHubActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGitHubActionsByCategory(category: GitHubActionCategory): GitHubAction[] {
  return ALL_GITHUB_ACTIONS.filter((a) => a.category === category);
}

export function getGitHubActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GITHUB_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGitHubAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GITHUB_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGitHubAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GITHUB_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by GitHub action priority.
 * Known GitHub actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGitHubPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGitHubActionPriority(a.name) - getGitHubActionPriority(b.name);
  });
}

export function getGitHubActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GITHUB_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GITHUB_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate GitHub-specific system prompt when user has GitHub connected.
 * Tells Claude exactly what it can do via the Composio GitHub toolkit.
 */
export function getGitHubSystemPrompt(): string {
  return `
## GitHub Integration (Full Capabilities)

You have **full GitHub access** through the user's connected account. Use the \`composio_GITHUB_*\` tools.

### Repository Management
- Create, configure, fork, and manage repositories
- Manage collaborators, webhooks, deploy keys, topics/tags

### Issues & Project Management
- Create/update/close issues, add labels, assignees, milestones
- Comment on issues, lock/unlock conversations
- Create and manage GitHub Projects V2

### Pull Requests (Full Lifecycle)
- Create PRs with title, body, base/head branches
- Review: approve, request changes, comment line-by-line
- Merge (merge, squash, or rebase), request reviewers
- List changed files, commits, and reviews

### Code & Commits
- Read/write/delete files in repositories
- Create/delete branches, create tags
- Browse commits, diffs, and compare branches
- Configure branch protection rules

### GitHub Actions & CI/CD
- List/trigger/cancel/re-run workflows
- View logs and artifacts
- Manage repository secrets

### Releases & Deployments
- Create releases with auto-generated notes
- Manage environments and deployment status

### Organizations & Teams
- List org repos, members, teams
- Manage team membership and repo access

### Search & Discovery
- Search code, repos, issues, users, topics, commits
- Star repos, list notifications, manage gists

### Safety Rules
1. **Always confirm before destructive operations** (delete repo, remove collaborator, delete branch)
2. **Show a preview before creating issues/PRs** using the action-preview format:
\`\`\`action-preview
{
  "platform": "GitHub",
  "action": "Create Issue",
  "content": "Issue title and body here...",
  "toolName": "composio_GITHUB_CREATE_ISSUE",
  "toolParams": { "owner": "...", "repo": "...", "title": "...", "body": "..." }
}
\`\`\`
3. **For bulk operations**, summarize and get explicit approval
4. **Never force-push or delete protected branches** without explicit confirmation
5. **Merge PRs only after showing details** (title, checks status, review status)
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGitHubCapabilitySummary(): string {
  const stats = getGitHubActionStats();
  return `GitHub (${stats.total} actions: repos, issues, PRs, code, CI/CD, releases, teams, search)`;
}

export function logGitHubToolkitStats(): void {
  const stats = getGitHubActionStats();
  log.info('GitHub Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
