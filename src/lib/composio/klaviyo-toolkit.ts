/**
 * COMPOSIO KLAVIYO TOOLKIT
 * =========================
 *
 * Comprehensive Klaviyo integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Campaigns (create, send, schedule campaigns)
 * - Lists (create, manage subscriber lists)
 * - Profiles (manage subscriber profiles)
 * - Flows (automation flows)
 * - Metrics (analytics and tracking metrics)
 */

import { logger } from '@/lib/logger';

const log = logger('KlaviyoToolkit');

// ============================================================================
// KLAVIYO ACTION CATEGORIES
// ============================================================================

export type KlaviyoActionCategory = 'campaigns' | 'lists' | 'profiles' | 'flows' | 'metrics';

export interface KlaviyoAction {
  name: string; // Composio action name (e.g., KLAVIYO_CREATE_CAMPAIGN)
  label: string; // Human-readable label
  category: KlaviyoActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Klaviyo connected)
// ============================================================================

const ESSENTIAL_ACTIONS: KlaviyoAction[] = [
  // Campaigns - Core
  {
    name: 'KLAVIYO_CREATE_CAMPAIGN',
    label: 'Create Campaign',
    category: 'campaigns',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'KLAVIYO_GET_CAMPAIGNS',
    label: 'Get Campaigns',
    category: 'campaigns',
    priority: 1,
  },
  {
    name: 'KLAVIYO_GET_CAMPAIGN',
    label: 'Get Campaign Details',
    category: 'campaigns',
    priority: 1,
  },

  // Lists - Core
  {
    name: 'KLAVIYO_CREATE_LIST',
    label: 'Create List',
    category: 'lists',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'KLAVIYO_GET_LISTS',
    label: 'Get Lists',
    category: 'lists',
    priority: 1,
  },

  // Profiles - Core
  {
    name: 'KLAVIYO_ADD_PROFILE_TO_LIST',
    label: 'Add Profile to List',
    category: 'profiles',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'KLAVIYO_GET_PROFILES',
    label: 'Get Profiles',
    category: 'profiles',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: KlaviyoAction[] = [
  // Campaigns - Extended
  {
    name: 'KLAVIYO_SEND_CAMPAIGN',
    label: 'Send Campaign',
    category: 'campaigns',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'KLAVIYO_UPDATE_CAMPAIGN',
    label: 'Update Campaign',
    category: 'campaigns',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'KLAVIYO_CREATE_TEMPLATE',
    label: 'Create Template',
    category: 'campaigns',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'KLAVIYO_GET_TEMPLATES',
    label: 'Get Templates',
    category: 'campaigns',
    priority: 2,
  },

  // Profiles - Extended
  {
    name: 'KLAVIYO_CREATE_PROFILE',
    label: 'Create Profile',
    category: 'profiles',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'KLAVIYO_UPDATE_PROFILE',
    label: 'Update Profile',
    category: 'profiles',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'KLAVIYO_GET_PROFILE',
    label: 'Get Profile Details',
    category: 'profiles',
    priority: 2,
  },

  // Metrics - Core
  {
    name: 'KLAVIYO_GET_METRICS',
    label: 'Get Metrics',
    category: 'metrics',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: KlaviyoAction[] = [
  // Campaigns - Extended
  {
    name: 'KLAVIYO_SCHEDULE_CAMPAIGN',
    label: 'Schedule Campaign',
    category: 'campaigns',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'KLAVIYO_CLONE_CAMPAIGN',
    label: 'Clone Campaign',
    category: 'campaigns',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'KLAVIYO_GET_CAMPAIGN_RECIPIENTS',
    label: 'Get Campaign Recipients',
    category: 'campaigns',
    priority: 3,
  },

  // Lists - Extended
  {
    name: 'KLAVIYO_UPDATE_LIST',
    label: 'Update List',
    category: 'lists',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'KLAVIYO_GET_LIST_PROFILES',
    label: 'Get List Profiles',
    category: 'lists',
    priority: 3,
  },

  // Flows - Core
  {
    name: 'KLAVIYO_GET_FLOWS',
    label: 'Get Flows',
    category: 'flows',
    priority: 3,
  },
  {
    name: 'KLAVIYO_GET_FLOW',
    label: 'Get Flow Details',
    category: 'flows',
    priority: 3,
  },
  {
    name: 'KLAVIYO_GET_FLOW_ACTIONS',
    label: 'Get Flow Actions',
    category: 'flows',
    priority: 3,
  },

  // Metrics - Extended
  {
    name: 'KLAVIYO_QUERY_METRIC_AGGREGATES',
    label: 'Query Metric Aggregates',
    category: 'metrics',
    priority: 3,
  },
  {
    name: 'KLAVIYO_GET_METRIC',
    label: 'Get Metric Details',
    category: 'metrics',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: KlaviyoAction[] = [
  // Campaigns - Destructive
  {
    name: 'KLAVIYO_DELETE_CAMPAIGN',
    label: 'Delete Campaign',
    category: 'campaigns',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'KLAVIYO_CANCEL_CAMPAIGN_SEND',
    label: 'Cancel Campaign Send',
    category: 'campaigns',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Lists - Destructive
  {
    name: 'KLAVIYO_DELETE_LIST',
    label: 'Delete List',
    category: 'lists',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'KLAVIYO_REMOVE_PROFILE_FROM_LIST',
    label: 'Remove Profile from List',
    category: 'lists',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Profiles - Destructive
  {
    name: 'KLAVIYO_SUPPRESS_PROFILES',
    label: 'Suppress Profiles',
    category: 'profiles',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Flows - Extended
  {
    name: 'KLAVIYO_UPDATE_FLOW_STATUS',
    label: 'Update Flow Status',
    category: 'flows',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_KLAVIYO_ACTIONS: KlaviyoAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getKlaviyoFeaturedActionNames(): string[] {
  return ALL_KLAVIYO_ACTIONS.map((a) => a.name);
}

export function getKlaviyoActionsByPriority(maxPriority: number = 3): KlaviyoAction[] {
  return ALL_KLAVIYO_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getKlaviyoActionNamesByPriority(maxPriority: number = 3): string[] {
  return getKlaviyoActionsByPriority(maxPriority).map((a) => a.name);
}

export function getKlaviyoActionsByCategory(category: KlaviyoActionCategory): KlaviyoAction[] {
  return ALL_KLAVIYO_ACTIONS.filter((a) => a.category === category);
}

export function getKlaviyoActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_KLAVIYO_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownKlaviyoAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_KLAVIYO_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveKlaviyoAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_KLAVIYO_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Klaviyo action priority.
 * Known Klaviyo actions sorted by priority (1-4), unknown actions last.
 */
export function sortByKlaviyoPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getKlaviyoActionPriority(a.name) - getKlaviyoActionPriority(b.name);
  });
}

export function getKlaviyoActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_KLAVIYO_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_KLAVIYO_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Klaviyo-specific system prompt when user has Klaviyo connected.
 * Tells Claude exactly what it can do via the Composio Klaviyo toolkit.
 */
export function getKlaviyoSystemPrompt(): string {
  return `
## Klaviyo Integration (Full Capabilities)

You have **full Klaviyo access** through the user's connected account. Use the \`composio_KLAVIYO_*\` tools.

### Campaigns
- Create, update, and send email campaigns
- Schedule campaigns for future delivery
- Clone existing campaigns as templates
- View campaign details and recipient lists
- Cancel scheduled campaign sends
- Delete campaigns (with confirmation)

### Lists
- Create and manage subscriber lists
- View all lists and list membership
- Get profiles within a specific list
- Update list details
- Delete lists (with confirmation)
- Remove profiles from lists

### Profiles
- Create and update subscriber profiles
- Add profiles to lists for targeting
- View profile details and history
- Browse all profiles in the account
- Suppress profiles from communications (with confirmation)

### Flows
- View automation flows and their status
- Get flow details and action sequences
- Update flow status (enable/disable)

### Metrics
- View available tracking metrics
- Get detailed metric information
- Query metric aggregates for reporting and analytics

### Safety Rules
1. **ALWAYS preview before sending** - show campaign details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Klaviyo",
  "action": "Send Campaign",
  "content": "Campaign subject and preview...",
  "toolName": "composio_KLAVIYO_SEND_CAMPAIGN",
  "toolParams": { "campaign_id": "..." }
}
\`\`\`
2. **Confirm recipient list before sending** - verify the target audience size and segments
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For suppressions**, confirm the profiles and explain the impact before proceeding
5. **For flow status changes**, explain what the flow does before enabling/disabling
6. **Review template content** before associating with a campaign
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getKlaviyoCapabilitySummary(): string {
  const stats = getKlaviyoActionStats();
  return `Klaviyo (${stats.total} actions: campaigns, lists, profiles, flows, metrics)`;
}

export function logKlaviyoToolkitStats(): void {
  const stats = getKlaviyoActionStats();
  log.info('Klaviyo Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
