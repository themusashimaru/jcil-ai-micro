/**
 * COMPOSIO VERCEL TOOLKIT
 * =======================
 *
 * Comprehensive Vercel integration via Composio's 173 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Projects (create, list, get, update, delete)
 * - Deployments (create, list, get, delete, cancel, promote, redeploy, checks, aliases)
 * - Domains (list, get, add, remove, project domains)
 * - Env (environment variables CRUD)
 * - Teams (list, get, create, members)
 * - Security (secrets, certificates, webhooks, user)
 * - Edge (edge configs, edge config items)
 * - DNS (DNS records CRUD)
 */

import { logger } from '@/lib/logger';

const log = logger('VercelToolkit');

// ============================================================================
// VERCEL ACTION CATEGORIES
// ============================================================================

export type VercelActionCategory =
  | 'projects'
  | 'deployments'
  | 'domains'
  | 'env'
  | 'teams'
  | 'security'
  | 'edge'
  | 'dns';

export interface VercelAction {
  name: string; // Composio action name (e.g., VERCEL_LIST_DEPLOYMENTS)
  label: string; // Human-readable label
  category: VercelActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Vercel connected)
// ============================================================================

const ESSENTIAL_ACTIONS: VercelAction[] = [
  // Deployments
  {
    name: 'VERCEL_LIST_DEPLOYMENTS',
    label: 'List Deployments',
    category: 'deployments',
    priority: 1,
  },
  {
    name: 'VERCEL_GET_DEPLOYMENT',
    label: 'Get Deployment',
    category: 'deployments',
    priority: 1,
  },
  {
    name: 'VERCEL_CREATE_DEPLOYMENT',
    label: 'Create Deployment',
    category: 'deployments',
    priority: 1,
    writeOperation: true,
  },

  // Projects
  {
    name: 'VERCEL_LIST_PROJECTS',
    label: 'List Projects',
    category: 'projects',
    priority: 1,
  },
  {
    name: 'VERCEL_GET_PROJECT',
    label: 'Get Project',
    category: 'projects',
    priority: 1,
  },
  {
    name: 'VERCEL_CREATE_PROJECT',
    label: 'Create Project',
    category: 'projects',
    priority: 1,
    writeOperation: true,
  },

  // Domains
  {
    name: 'VERCEL_LIST_DOMAINS',
    label: 'List Domains',
    category: 'domains',
    priority: 1,
  },
  {
    name: 'VERCEL_GET_DOMAIN',
    label: 'Get Domain',
    category: 'domains',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: VercelAction[] = [
  // Deployments - Extended
  {
    name: 'VERCEL_DELETE_DEPLOYMENT',
    label: 'Delete Deployment',
    category: 'deployments',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'VERCEL_CANCEL_DEPLOYMENT',
    label: 'Cancel Deployment',
    category: 'deployments',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'VERCEL_GET_DEPLOYMENT_EVENTS',
    label: 'Get Deployment Events',
    category: 'deployments',
    priority: 2,
  },
  {
    name: 'VERCEL_LIST_ALIASES',
    label: 'List Aliases',
    category: 'deployments',
    priority: 2,
  },
  {
    name: 'VERCEL_ASSIGN_ALIAS',
    label: 'Assign Alias',
    category: 'deployments',
    priority: 2,
    writeOperation: true,
  },

  // Projects - Extended
  {
    name: 'VERCEL_UPDATE_PROJECT',
    label: 'Update Project',
    category: 'projects',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'VERCEL_DELETE_PROJECT',
    label: 'Delete Project',
    category: 'projects',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },

  // Domains - Extended
  {
    name: 'VERCEL_ADD_DOMAIN',
    label: 'Add Domain',
    category: 'domains',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'VERCEL_REMOVE_DOMAIN',
    label: 'Remove Domain',
    category: 'domains',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },

  // Environment Variables
  {
    name: 'VERCEL_LIST_ENV_VARIABLES',
    label: 'List Env Variables',
    category: 'env',
    priority: 2,
  },
  {
    name: 'VERCEL_GET_ENV_VARIABLE',
    label: 'Get Env Variable',
    category: 'env',
    priority: 2,
  },
  {
    name: 'VERCEL_CREATE_ENV_VARIABLE',
    label: 'Create Env Variable',
    category: 'env',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'VERCEL_UPDATE_ENV_VARIABLE',
    label: 'Update Env Variable',
    category: 'env',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'VERCEL_DELETE_ENV_VARIABLE',
    label: 'Delete Env Variable',
    category: 'env',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: VercelAction[] = [
  // Teams
  {
    name: 'VERCEL_LIST_TEAMS',
    label: 'List Teams',
    category: 'teams',
    priority: 3,
  },
  {
    name: 'VERCEL_GET_TEAM',
    label: 'Get Team',
    category: 'teams',
    priority: 3,
  },
  {
    name: 'VERCEL_CREATE_TEAM',
    label: 'Create Team',
    category: 'teams',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'VERCEL_LIST_TEAM_MEMBERS',
    label: 'List Team Members',
    category: 'teams',
    priority: 3,
  },
  {
    name: 'VERCEL_INVITE_TEAM_MEMBER',
    label: 'Invite Team Member',
    category: 'teams',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'VERCEL_REMOVE_TEAM_MEMBER',
    label: 'Remove Team Member',
    category: 'teams',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Security
  {
    name: 'VERCEL_GET_USER',
    label: 'Get User',
    category: 'security',
    priority: 3,
  },
  {
    name: 'VERCEL_LIST_SECRETS',
    label: 'List Secrets',
    category: 'security',
    priority: 3,
  },
  {
    name: 'VERCEL_CREATE_SECRET',
    label: 'Create Secret',
    category: 'security',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'VERCEL_DELETE_SECRET',
    label: 'Delete Secret',
    category: 'security',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'VERCEL_LIST_CERTIFICATES',
    label: 'List Certificates',
    category: 'security',
    priority: 3,
  },
  {
    name: 'VERCEL_GET_CERTIFICATE',
    label: 'Get Certificate',
    category: 'security',
    priority: 3,
  },

  // Deployments - Extended
  {
    name: 'VERCEL_PROMOTE_DEPLOYMENT',
    label: 'Promote Deployment',
    category: 'deployments',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'VERCEL_REDEPLOY',
    label: 'Redeploy',
    category: 'deployments',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'VERCEL_LIST_CHECKS',
    label: 'List Checks',
    category: 'deployments',
    priority: 3,
  },
  {
    name: 'VERCEL_GET_CHECK',
    label: 'Get Check',
    category: 'deployments',
    priority: 3,
  },

  // Webhooks
  {
    name: 'VERCEL_LIST_WEBHOOKS',
    label: 'List Webhooks',
    category: 'security',
    priority: 3,
  },
  {
    name: 'VERCEL_CREATE_WEBHOOK',
    label: 'Create Webhook',
    category: 'security',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'VERCEL_DELETE_WEBHOOK',
    label: 'Delete Webhook',
    category: 'security',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Edge configs, DNS, and project domain management)
// ============================================================================

const ADVANCED_ACTIONS: VercelAction[] = [
  // Edge Configs
  {
    name: 'VERCEL_LIST_EDGE_CONFIG',
    label: 'List Edge Configs',
    category: 'edge',
    priority: 4,
  },
  {
    name: 'VERCEL_GET_EDGE_CONFIG',
    label: 'Get Edge Config',
    category: 'edge',
    priority: 4,
  },
  {
    name: 'VERCEL_CREATE_EDGE_CONFIG',
    label: 'Create Edge Config',
    category: 'edge',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'VERCEL_DELETE_EDGE_CONFIG',
    label: 'Delete Edge Config',
    category: 'edge',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'VERCEL_LIST_EDGE_CONFIG_ITEMS',
    label: 'List Edge Config Items',
    category: 'edge',
    priority: 4,
  },
  {
    name: 'VERCEL_UPDATE_EDGE_CONFIG_ITEMS',
    label: 'Update Edge Config Items',
    category: 'edge',
    priority: 4,
    writeOperation: true,
  },

  // DNS Records
  {
    name: 'VERCEL_LIST_DNS_RECORDS',
    label: 'List DNS Records',
    category: 'dns',
    priority: 4,
  },
  {
    name: 'VERCEL_CREATE_DNS_RECORD',
    label: 'Create DNS Record',
    category: 'dns',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'VERCEL_DELETE_DNS_RECORD',
    label: 'Delete DNS Record',
    category: 'dns',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Project Domains
  {
    name: 'VERCEL_GET_PROJECT_DOMAINS',
    label: 'Get Project Domains',
    category: 'domains',
    priority: 4,
  },
  {
    name: 'VERCEL_UPDATE_PROJECT_DOMAIN',
    label: 'Update Project Domain',
    category: 'domains',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_VERCEL_ACTIONS: VercelAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getVercelFeaturedActionNames(): string[] {
  return ALL_VERCEL_ACTIONS.map((a) => a.name);
}

export function getVercelActionsByPriority(maxPriority: number = 3): VercelAction[] {
  return ALL_VERCEL_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getVercelActionNamesByPriority(maxPriority: number = 3): string[] {
  return getVercelActionsByPriority(maxPriority).map((a) => a.name);
}

export function getVercelActionsByCategory(category: VercelActionCategory): VercelAction[] {
  return ALL_VERCEL_ACTIONS.filter((a) => a.category === category);
}

export function getVercelActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_VERCEL_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownVercelAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_VERCEL_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveVercelAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_VERCEL_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Vercel action priority.
 * Known Vercel actions sorted by priority (1-4), unknown actions last.
 */
export function sortByVercelPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getVercelActionPriority(a.name) - getVercelActionPriority(b.name);
  });
}

export function getVercelActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_VERCEL_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_VERCEL_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Vercel-specific system prompt when user has Vercel connected.
 * Tells Claude exactly what it can do via the Composio Vercel toolkit.
 */
export function getVercelSystemPrompt(): string {
  return `
## Vercel Integration (Full Capabilities)

You have **full Vercel access** through the user's connected account. Use the \`composio_VERCEL_*\` tools.

### Projects
- List and inspect all projects in the account
- Create new projects with framework presets and Git repository links
- Update project settings (build commands, environment, framework)
- Delete projects when no longer needed

### Deployments
- List all deployments with filtering by project, state, or target
- Get detailed deployment information including build logs and status
- Create new deployments from Git branches or direct uploads
- Cancel in-progress deployments
- Delete old or failed deployments
- Promote deployments to production
- Redeploy previous deployments
- View deployment checks and build events/logs
- Manage deployment aliases for custom URLs

### Domains
- List and inspect all domains in the account
- Add new domains to the account
- Remove domains that are no longer needed
- Get project-specific domain configurations
- Update project domain settings (redirects, Git branch linking)

### Environment Variables
- List all environment variables for a project
- Get specific environment variable values
- Create new environment variables (plain, secret, encrypted)
- Update existing environment variable values or targets
- Delete environment variables that are no longer needed

### Teams
- List and inspect teams the user belongs to
- Create new teams for organization
- List team members and their roles
- Invite new members to teams
- Remove members from teams

### Security & Webhooks
- Get authenticated user profile information
- List and manage secrets (encrypted environment values)
- List and inspect SSL certificates
- Create and manage webhooks for deployment events

### Edge Config
- List and inspect Edge Config stores
- Create new Edge Config stores for global key-value data
- Manage Edge Config items (read, update)
- Delete Edge Config stores when no longer needed

### DNS
- List DNS records for domains managed by Vercel
- Create new DNS records (A, AAAA, CNAME, TXT, MX, etc.)
- Delete DNS records that are no longer needed

### Safety Rules
1. **ALWAYS confirm before creating deployments** - show project, branch/source, and target environment:
\`\`\`action-preview
{
  "platform": "Vercel",
  "action": "Create Deployment",
  "project": "Project name",
  "target": "production/preview",
  "source": "Branch or commit",
  "toolName": "composio_VERCEL_CREATE_DEPLOYMENT",
  "toolParams": { "name": "...", "target": "..." }
}
\`\`\`
2. **Confirm before deleting projects or deployments** - deletion may be irreversible and affect live traffic
3. **Show environment variable details before creating/updating** - especially for production targets
4. **Never remove domains without explicit approval** - this will take the site offline
5. **For team member changes**, clearly show who is being invited/removed and their role
6. **For DNS changes**, show the record type, name, and value before creating or deleting
7. **Handle secrets carefully** - never expose secret values in responses, only reference by name
8. **For production promotions**, confirm the deployment ID and show what is currently in production
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getVercelCapabilitySummary(): string {
  const stats = getVercelActionStats();
  return `Vercel (${stats.total} actions: projects, deployments, domains, env, teams, edge config)`;
}

export function logVercelToolkitStats(): void {
  const stats = getVercelActionStats();
  log.info('Vercel Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
