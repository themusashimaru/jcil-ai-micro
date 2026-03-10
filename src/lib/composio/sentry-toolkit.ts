/**
 * COMPOSIO SENTRY TOOLKIT
 * =======================
 *
 * Comprehensive Sentry integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Issues (list, get, update, resolve, assign, ignore, merge, delete)
 * - Events (list, get, list issue events)
 * - Projects (list, get, create, delete)
 * - Releases (list, get, create, update, delete)
 * - Alerts (list rules, create rules, update rules, delete rules)
 * - Teams (list, create, delete)
 * - Performance (project stats, organization stats)
 */

import { logger } from '@/lib/logger';

const log = logger('SentryToolkit');

// ============================================================================
// SENTRY ACTION CATEGORIES
// ============================================================================

export type SentryActionCategory =
  | 'issues'
  | 'events'
  | 'projects'
  | 'releases'
  | 'alerts'
  | 'teams'
  | 'performance';

export interface SentryAction {
  name: string; // Composio action name (e.g., SENTRY_LIST_ISSUES)
  label: string; // Human-readable label
  category: SentryActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Sentry connected)
// ============================================================================

const ESSENTIAL_ACTIONS: SentryAction[] = [
  // Issues
  {
    name: 'SENTRY_LIST_ISSUES',
    label: 'List Issues',
    category: 'issues',
    priority: 1,
  },
  {
    name: 'SENTRY_GET_ISSUE',
    label: 'Get Issue',
    category: 'issues',
    priority: 1,
  },
  {
    name: 'SENTRY_UPDATE_ISSUE',
    label: 'Update Issue',
    category: 'issues',
    priority: 1,
    writeOperation: true,
  },

  // Projects
  {
    name: 'SENTRY_LIST_PROJECTS',
    label: 'List Projects',
    category: 'projects',
    priority: 1,
  },
  {
    name: 'SENTRY_GET_PROJECT',
    label: 'Get Project',
    category: 'projects',
    priority: 1,
  },

  // Events
  {
    name: 'SENTRY_LIST_EVENTS',
    label: 'List Events',
    category: 'events',
    priority: 1,
  },
  {
    name: 'SENTRY_GET_EVENT',
    label: 'Get Event',
    category: 'events',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: SentryAction[] = [
  // Issues - Extended
  {
    name: 'SENTRY_RESOLVE_ISSUE',
    label: 'Resolve Issue',
    category: 'issues',
    priority: 2,
    writeOperation: true,
  },

  // Events - Extended
  {
    name: 'SENTRY_LIST_ISSUE_EVENTS',
    label: 'List Issue Events',
    category: 'events',
    priority: 2,
  },

  // Releases
  {
    name: 'SENTRY_LIST_RELEASES',
    label: 'List Releases',
    category: 'releases',
    priority: 2,
  },
  {
    name: 'SENTRY_CREATE_RELEASE',
    label: 'Create Release',
    category: 'releases',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'SENTRY_GET_RELEASE',
    label: 'Get Release',
    category: 'releases',
    priority: 2,
  },

  // Alerts
  {
    name: 'SENTRY_LIST_ALERT_RULES',
    label: 'List Alert Rules',
    category: 'alerts',
    priority: 2,
  },
  {
    name: 'SENTRY_CREATE_ALERT_RULE',
    label: 'Create Alert Rule',
    category: 'alerts',
    priority: 2,
    writeOperation: true,
  },

  // Teams
  {
    name: 'SENTRY_LIST_TEAMS',
    label: 'List Teams',
    category: 'teams',
    priority: 2,
  },

  // Performance
  {
    name: 'SENTRY_LIST_PROJECT_STATS',
    label: 'Project Stats',
    category: 'performance',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: SentryAction[] = [
  // Issues - Extended
  {
    name: 'SENTRY_ASSIGN_ISSUE',
    label: 'Assign Issue',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SENTRY_IGNORE_ISSUE',
    label: 'Ignore Issue',
    category: 'issues',
    priority: 3,
    writeOperation: true,
  },

  // Releases - Extended
  {
    name: 'SENTRY_UPDATE_RELEASE',
    label: 'Update Release',
    category: 'releases',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SENTRY_DELETE_RELEASE',
    label: 'Delete Release',
    category: 'releases',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Alerts - Extended
  {
    name: 'SENTRY_UPDATE_ALERT_RULE',
    label: 'Update Alert Rule',
    category: 'alerts',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'SENTRY_DELETE_ALERT_RULE',
    label: 'Delete Alert Rule',
    category: 'alerts',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Projects - Extended
  {
    name: 'SENTRY_CREATE_PROJECT',
    label: 'Create Project',
    category: 'projects',
    priority: 3,
    writeOperation: true,
  },

  // Issues - Tags
  {
    name: 'SENTRY_LIST_TAGS',
    label: 'List Tags',
    category: 'issues',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: SentryAction[] = [
  {
    name: 'SENTRY_DELETE_ISSUE',
    label: 'Delete Issue',
    category: 'issues',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SENTRY_DELETE_PROJECT',
    label: 'Delete Project',
    category: 'projects',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'SENTRY_MERGE_ISSUES',
    label: 'Merge Issues',
    category: 'issues',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SENTRY_LIST_ORGANIZATION_STATS',
    label: 'Organization Stats',
    category: 'performance',
    priority: 4,
  },
  {
    name: 'SENTRY_CREATE_TEAM',
    label: 'Create Team',
    category: 'teams',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'SENTRY_DELETE_TEAM',
    label: 'Delete Team',
    category: 'teams',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_SENTRY_ACTIONS: SentryAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getSentryFeaturedActionNames(): string[] {
  return ALL_SENTRY_ACTIONS.map((a) => a.name);
}

export function getSentryActionsByPriority(maxPriority: number = 3): SentryAction[] {
  return ALL_SENTRY_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getSentryActionNamesByPriority(maxPriority: number = 3): string[] {
  return getSentryActionsByPriority(maxPriority).map((a) => a.name);
}

export function getSentryActionsByCategory(category: SentryActionCategory): SentryAction[] {
  return ALL_SENTRY_ACTIONS.filter((a) => a.category === category);
}

export function getSentryActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_SENTRY_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownSentryAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SENTRY_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveSentryAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_SENTRY_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Sentry action priority.
 * Known Sentry actions sorted by priority (1-4), unknown actions last.
 */
export function sortBySentryPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getSentryActionPriority(a.name) - getSentryActionPriority(b.name);
  });
}

export function getSentryActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_SENTRY_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_SENTRY_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Sentry-specific system prompt when user has Sentry connected.
 * Tells Claude exactly what it can do via the Composio Sentry toolkit.
 */
export function getSentrySystemPrompt(): string {
  return `
## Sentry Integration (Full Capabilities)

You have **full Sentry access** through the user's connected account. Use the \`composio_SENTRY_*\` tools.

### Error Tracking & Issues
- List and search issues across projects with filters (status, priority, assignee)
- Get detailed issue information including stack traces and breadcrumbs
- Update issue status, priority, and metadata
- Resolve issues (mark as resolved, resolved in next release, etc.)
- Assign issues to team members
- Ignore issues with optional ignore conditions (count, window, etc.)
- Merge duplicate issues together
- List tags associated with issues for filtering and analysis

### Events
- List events across a project to see recent errors and transactions
- Get detailed event information including full stack traces and context
- List events for a specific issue to understand error patterns

### Project Management
- List all projects in the organization
- Get detailed project configuration and settings
- Create new projects for tracking errors in new applications

### Release Management
- List releases to track deployment history
- Create new releases to associate errors with specific deployments
- Get release details including commit information and deploy status
- Update release metadata (e.g., marking as finalized)
- Delete releases that are no longer needed

### Alerting
- List alert rules to see current monitoring configuration
- Create new alert rules for error thresholds, performance metrics, etc.
- Update existing alert rules to adjust thresholds and conditions
- Delete alert rules that are no longer relevant

### Teams
- List teams in the organization
- Create new teams for organizing project access

### Performance & Stats
- View project-level statistics (error counts, event volume, etc.)
- View organization-level statistics for cross-project insights

### Safety Rules
1. **ALWAYS confirm before resolving issues** - show issue details, error count, and affected users:
\`\`\`action-preview
{
  "platform": "Sentry",
  "action": "Resolve Issue",
  "issue": "Issue title/ID",
  "errorCount": "XX occurrences",
  "affectedUsers": "XX users",
  "toolName": "composio_SENTRY_RESOLVE_ISSUE",
  "toolParams": { "issue_id": "..." }
}
\`\`\`
2. **Confirm before deleting issues** - deletion is permanent and removes all associated event data
3. **Never delete projects without explicit approval** - this removes all historical error data
4. **Confirm before merging issues** - merging cannot be undone and combines event histories
5. **For alert rule changes**, show the current rule configuration before modifying or deleting
6. **For release operations**, verify the release version and project before creating or deleting
7. **For ignore operations**, clearly explain the ignore conditions and duration before applying
8. **For batch operations**, summarize what will happen and get explicit approval
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getSentryCapabilitySummary(): string {
  const stats = getSentryActionStats();
  return `Sentry (${stats.total} actions: issues, events, projects, releases, alerts, teams, performance)`;
}

export function logSentryToolkitStats(): void {
  const stats = getSentryActionStats();
  log.info('Sentry Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
