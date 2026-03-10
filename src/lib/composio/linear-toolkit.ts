/**
 * COMPOSIO LINEAR TOOLKIT
 * =======================
 *
 * Comprehensive Linear integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Issues (create, list, get, update, search, archive, relations, attachments)
 * - Projects (create, list, get, update, archive, updates)
 * - Cycles (list, get, create, update)
 * - Teams (list)
 * - Users (list, get)
 * - Labels (list, create, update, delete)
 * - Comments (create, list, update, delete)
 * - Workflows (workflow states, integrations)
 */

import { logger } from '@/lib/logger';

const log = logger('LinearToolkit');

// ============================================================================
// LINEAR ACTION CATEGORIES
// ============================================================================

export type LinearActionCategory =
  | 'issues'
  | 'projects'
  | 'cycles'
  | 'teams'
  | 'users'
  | 'labels'
  | 'comments'
  | 'workflows';

export interface LinearAction {
  name: string; // Composio action name (e.g., LINEAR_CREATE_LINEAR_ISSUE)
  label: string; // Human-readable label
  category: LinearActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Linear connected)
// ============================================================================

const ESSENTIAL_ACTIONS: LinearAction[] = [
  // Issues - Core
  {
    name: 'LINEAR_CREATE_LINEAR_ISSUE',
    label: 'Create Issue',
    category: 'issues',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'LINEAR_LIST_LINEAR_ISSUES',
    label: 'List Issues',
    category: 'issues',
    priority: 1,
  },
  {
    name: 'LINEAR_GET_LINEAR_ISSUE',
    label: 'Get Issue',
    category: 'issues',
    priority: 1,
  },
  {
    name: 'LINEAR_UPDATE_LINEAR_ISSUE',
    label: 'Update Issue',
    category: 'issues',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'LINEAR_SEARCH_LINEAR_ISSUES',
    label: 'Search Issues',
    category: 'issues',
    priority: 1,
  },

  // Projects - Core
  {
    name: 'LINEAR_LIST_LINEAR_PROJECTS',
    label: 'List Projects',
    category: 'projects',
    priority: 1,
  },
  {
    name: 'LINEAR_GET_LINEAR_PROJECT',
    label: 'Get Project',
    category: 'projects',
    priority: 1,
  },

  // Teams
  {
    name: 'LINEAR_LIST_LINEAR_TEAMS',
    label: 'List Teams',
    category: 'teams',
    priority: 1,
  },

  // Comments - Core
  {
    name: 'LINEAR_CREATE_LINEAR_COMMENT',
    label: 'Create Comment',
    category: 'comments',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'LINEAR_LIST_LINEAR_ISSUE_COMMENTS',
    label: 'List Issue Comments',
    category: 'comments',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: LinearAction[] = [
  // Projects - Extended
  {
    name: 'LINEAR_CREATE_LINEAR_PROJECT',
    label: 'Create Project',
    category: 'projects',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'LINEAR_UPDATE_LINEAR_PROJECT',
    label: 'Update Project',
    category: 'projects',
    priority: 2,
    writeOperation: true,
  },

  // Issues - Extended
  {
    name: 'LINEAR_DELETE_LINEAR_ISSUE',
    label: 'Delete Issue',
    category: 'issues',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'LINEAR_ASSIGN_LINEAR_ISSUE',
    label: 'Assign Issue',
    category: 'issues',
    priority: 2,
    writeOperation: true,
  },

  // Cycles
  {
    name: 'LINEAR_LIST_LINEAR_CYCLES',
    label: 'List Cycles',
    category: 'cycles',
    priority: 2,
  },
  {
    name: 'LINEAR_GET_LINEAR_CYCLE',
    label: 'Get Cycle',
    category: 'cycles',
    priority: 2,
  },
  {
    name: 'LINEAR_CREATE_LINEAR_CYCLE',
    label: 'Create Cycle',
    category: 'cycles',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'LINEAR_UPDATE_LINEAR_CYCLE',
    label: 'Update Cycle',
    category: 'cycles',
    priority: 2,
    writeOperation: true,
  },

  // Labels
  {
    name: 'LINEAR_LIST_LINEAR_LABELS',
    label: 'List Labels',
    category: 'labels',
    priority: 2,
  },
  {
    name: 'LINEAR_CREATE_LINEAR_LABEL',
    label: 'Create Label',
    category: 'labels',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'LINEAR_ADD_LINEAR_ISSUE_LABEL',
    label: 'Add Issue Label',
    category: 'issues',
    priority: 2,
    writeOperation: true,
  },

  // Users
  {
    name: 'LINEAR_LIST_LINEAR_USERS',
    label: 'List Users',
    category: 'users',
    priority: 2,
  },
  {
    name: 'LINEAR_GET_LINEAR_USER',
    label: 'Get User',
    category: 'users',
    priority: 2,
  },

  // Workflows
  {
    name: 'LINEAR_LIST_LINEAR_WORKFLOW_STATES',
    label: 'List Workflow States',
    category: 'workflows',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: LinearAction[] = [
  // Comments - Extended
  {
    name: 'LINEAR_UPDATE_LINEAR_COMMENT',
    label: 'Update Comment',
    category: 'comments',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'LINEAR_DELETE_LINEAR_COMMENT',
    label: 'Delete Comment',
    category: 'comments',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Issues - Relations & Subscribers
  {
    name: 'LINEAR_CREATE_LINEAR_ISSUE_RELATION',
    label: 'Create Issue Relation',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'LINEAR_LIST_LINEAR_ISSUE_RELATIONS',
    label: 'List Issue Relations',
    category: 'issues',
    priority: 3,
  },
  {
    name: 'LINEAR_ADD_LINEAR_ISSUE_SUBSCRIBER',
    label: 'Add Issue Subscriber',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },

  // Projects - Updates
  {
    name: 'LINEAR_CREATE_LINEAR_PROJECT_UPDATE',
    label: 'Create Project Update',
    category: 'projects',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'LINEAR_LIST_LINEAR_PROJECT_UPDATES',
    label: 'List Project Updates',
    category: 'projects',
    priority: 3,
  },

  // Issues - Archive & Attachments
  {
    name: 'LINEAR_ARCHIVE_LINEAR_ISSUE',
    label: 'Archive Issue',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },

  // Labels - Extended
  {
    name: 'LINEAR_UPDATE_LINEAR_LABEL',
    label: 'Update Label',
    category: 'labels',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'LINEAR_DELETE_LINEAR_LABEL',
    label: 'Delete Label',
    category: 'labels',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Attachments
  {
    name: 'LINEAR_CREATE_LINEAR_ATTACHMENT',
    label: 'Create Attachment',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'LINEAR_LIST_LINEAR_ATTACHMENTS',
    label: 'List Attachments',
    category: 'issues',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive and uncommon operations)
// ============================================================================

const ADVANCED_ACTIONS: LinearAction[] = [
  {
    name: 'LINEAR_DELETE_LINEAR_PROJECT',
    label: 'Delete Project',
    category: 'projects',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'LINEAR_DELETE_LINEAR_CYCLE',
    label: 'Delete Cycle',
    category: 'cycles',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'LINEAR_ARCHIVE_LINEAR_PROJECT',
    label: 'Archive Project',
    category: 'projects',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'LINEAR_UNARCHIVE_LINEAR_ISSUE',
    label: 'Unarchive Issue',
    category: 'issues',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'LINEAR_UNARCHIVE_LINEAR_PROJECT',
    label: 'Unarchive Project',
    category: 'projects',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'LINEAR_REMOVE_LINEAR_ISSUE_LABEL',
    label: 'Remove Issue Label',
    category: 'issues',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'LINEAR_REMOVE_LINEAR_ISSUE_SUBSCRIBER',
    label: 'Remove Issue Subscriber',
    category: 'issues',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'LINEAR_DELETE_LINEAR_ATTACHMENT',
    label: 'Delete Attachment',
    category: 'issues',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'LINEAR_LIST_LINEAR_INTEGRATIONS',
    label: 'List Integrations',
    category: 'workflows',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_LINEAR_ACTIONS: LinearAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getLinearFeaturedActionNames(): string[] {
  return ALL_LINEAR_ACTIONS.map((a) => a.name);
}

export function getLinearActionsByPriority(maxPriority: number = 3): LinearAction[] {
  return ALL_LINEAR_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getLinearActionNamesByPriority(maxPriority: number = 3): string[] {
  return getLinearActionsByPriority(maxPriority).map((a) => a.name);
}

export function getLinearActionsByCategory(category: LinearActionCategory): LinearAction[] {
  return ALL_LINEAR_ACTIONS.filter((a) => a.category === category);
}

export function getLinearActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_LINEAR_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownLinearAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_LINEAR_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveLinearAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_LINEAR_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Linear action priority.
 * Known Linear actions sorted by priority (1-4), unknown actions last.
 */
export function sortByLinearPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getLinearActionPriority(a.name) - getLinearActionPriority(b.name);
  });
}

export function getLinearActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_LINEAR_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_LINEAR_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Linear-specific system prompt when user has Linear connected.
 * Tells Claude exactly what it can do via the Composio Linear toolkit.
 */
export function getLinearSystemPrompt(): string {
  return `
## Linear Integration (Full Capabilities)

You have **full Linear access** through the user's connected account. Use the \`composio_LINEAR_*\` tools.

### Issue Management
- Create new issues with title, description, priority, and assignee
- List and search issues with filters (team, project, status, assignee)
- Get detailed issue information including comments and relations
- Update issue properties (title, description, status, priority, assignee)
- Assign issues to team members
- Archive and unarchive issues
- Create relations between issues (blocks, is blocked by, relates to, duplicates)
- Add and remove labels on issues
- Subscribe and unsubscribe users to issue notifications
- Create and list attachments on issues

### Project Tracking
- List and get project details (name, description, status, progress)
- Create new projects with team assignment and target dates
- Update project properties (name, status, lead, target date)
- Post project updates for stakeholder communication
- List project update history
- Archive and unarchive projects

### Cycle Planning
- List cycles for a team (upcoming, active, completed)
- Get cycle details including scope and progress
- Create new cycles with start and end dates
- Update cycle properties (name, dates, description)

### Labels & Organization
- List available labels for categorization
- Create new labels with name and color
- Update existing label properties
- Add and remove labels from issues

### Teams & Users
- List all teams in the workspace
- List users and get user profiles
- Look up team members for issue assignment

### Workflow States
- List workflow states (Backlog, Todo, In Progress, Done, Cancelled)
- Understand the workflow pipeline for status transitions

### Comments & Collaboration
- Create comments on issues for discussion
- List all comments on an issue
- Update and delete comments

### Safety Rules
1. **ALWAYS confirm before deleting** issues, projects, cycles, or labels - deletion is permanent:
\`\`\`action-preview
{
  "platform": "Linear",
  "action": "Delete Issue",
  "issue": "Issue identifier/title",
  "team": "Team name",
  "toolName": "composio_LINEAR_DELETE_LINEAR_ISSUE",
  "toolParams": { "issueId": "..." }
}
\`\`\`
2. **Confirm before archiving** - show issue/project details before archiving
3. **Verify assignee before assigning** - list team members and confirm the correct user
4. **For bulk operations**, summarize all changes and get explicit approval
5. **When changing issue status**, show current status and proposed new status
6. **For cycle modifications**, show current cycle dates and scope before updating
7. **Handle project updates carefully** - confirm content before posting to stakeholders
8. **For label deletion**, warn that it will be removed from all issues
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getLinearCapabilitySummary(): string {
  const stats = getLinearActionStats();
  return `Linear (${stats.total} actions: issues, projects, cycles, teams, labels, workflows)`;
}

export function logLinearToolkitStats(): void {
  const stats = getLinearActionStats();
  log.info('Linear Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
