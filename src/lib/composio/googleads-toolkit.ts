/**
 * COMPOSIO GOOGLE ADS TOOLKIT
 * ============================
 *
 * Comprehensive Google Ads integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Campaigns (list, get, create, update, pause, enable, remove)
 * - Ad Groups (list, create, update, pause, remove)
 * - Ads (list, create, pause, remove)
 * - Keywords (list, add, remove)
 * - Reports (get performance reports)
 * - Budgets (list, create, set)
 */

import { logger } from '@/lib/logger';

const log = logger('GoogleAdsToolkit');

// ============================================================================
// GOOGLE ADS ACTION CATEGORIES
// ============================================================================

export type GoogleAdsActionCategory =
  | 'campaigns'
  | 'adgroups'
  | 'ads'
  | 'keywords'
  | 'reports'
  | 'budgets';

export interface GoogleAdsAction {
  name: string; // Composio action name (e.g., GOOGLEADS_LIST_CAMPAIGNS)
  label: string; // Human-readable label
  category: GoogleAdsActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Google Ads connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GoogleAdsAction[] = [
  // Campaigns
  {
    name: 'GOOGLEADS_LIST_CAMPAIGNS',
    label: 'List Campaigns',
    category: 'campaigns',
    priority: 1,
  },
  {
    name: 'GOOGLEADS_GET_CAMPAIGN',
    label: 'Get Campaign',
    category: 'campaigns',
    priority: 1,
  },

  // Ad Groups
  {
    name: 'GOOGLEADS_LIST_AD_GROUPS',
    label: 'List Ad Groups',
    category: 'adgroups',
    priority: 1,
  },

  // Ads
  {
    name: 'GOOGLEADS_LIST_ADS',
    label: 'List Ads',
    category: 'ads',
    priority: 1,
  },

  // Reports
  {
    name: 'GOOGLEADS_GET_REPORT',
    label: 'Get Report',
    category: 'reports',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GoogleAdsAction[] = [
  // Campaigns
  {
    name: 'GOOGLEADS_CREATE_CAMPAIGN',
    label: 'Create Campaign',
    category: 'campaigns',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEADS_UPDATE_CAMPAIGN',
    label: 'Update Campaign',
    category: 'campaigns',
    priority: 2,
    writeOperation: true,
  },

  // Ad Groups
  {
    name: 'GOOGLEADS_CREATE_AD_GROUP',
    label: 'Create Ad Group',
    category: 'adgroups',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLEADS_UPDATE_AD_GROUP',
    label: 'Update Ad Group',
    category: 'adgroups',
    priority: 2,
    writeOperation: true,
  },

  // Ads
  {
    name: 'GOOGLEADS_CREATE_AD',
    label: 'Create Ad',
    category: 'ads',
    priority: 2,
    writeOperation: true,
  },

  // Keywords
  {
    name: 'GOOGLEADS_LIST_KEYWORDS',
    label: 'List Keywords',
    category: 'keywords',
    priority: 2,
  },

  // Budgets
  {
    name: 'GOOGLEADS_SET_BUDGET',
    label: 'Set Budget',
    category: 'budgets',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GoogleAdsAction[] = [
  // Campaigns
  {
    name: 'GOOGLEADS_PAUSE_CAMPAIGN',
    label: 'Pause Campaign',
    category: 'campaigns',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLEADS_ENABLE_CAMPAIGN',
    label: 'Enable Campaign',
    category: 'campaigns',
    priority: 3,
    writeOperation: true,
  },

  // Ad Groups
  {
    name: 'GOOGLEADS_PAUSE_AD_GROUP',
    label: 'Pause Ad Group',
    category: 'adgroups',
    priority: 3,
    writeOperation: true,
  },

  // Ads
  {
    name: 'GOOGLEADS_PAUSE_AD',
    label: 'Pause Ad',
    category: 'ads',
    priority: 3,
    writeOperation: true,
  },

  // Keywords
  {
    name: 'GOOGLEADS_ADD_KEYWORDS',
    label: 'Add Keywords',
    category: 'keywords',
    priority: 3,
    writeOperation: true,
  },

  // Budgets
  {
    name: 'GOOGLEADS_LIST_BUDGETS',
    label: 'List Budgets',
    category: 'budgets',
    priority: 3,
  },
  {
    name: 'GOOGLEADS_CREATE_BUDGET',
    label: 'Create Budget',
    category: 'budgets',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: GoogleAdsAction[] = [
  {
    name: 'GOOGLEADS_REMOVE_CAMPAIGN',
    label: 'Remove Campaign',
    category: 'campaigns',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEADS_REMOVE_AD_GROUP',
    label: 'Remove Ad Group',
    category: 'adgroups',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEADS_REMOVE_AD',
    label: 'Remove Ad',
    category: 'ads',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEADS_REMOVE_KEYWORDS',
    label: 'Remove Keywords',
    category: 'keywords',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLEADS_LIST_ACCOUNTS',
    label: 'List Accounts',
    category: 'campaigns',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GOOGLE_ADS_ACTIONS: GoogleAdsAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGoogleAdsFeaturedActionNames(): string[] {
  return ALL_GOOGLE_ADS_ACTIONS.map((a) => a.name);
}

export function getGoogleAdsActionsByPriority(maxPriority: number = 3): GoogleAdsAction[] {
  return ALL_GOOGLE_ADS_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGoogleAdsActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGoogleAdsActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGoogleAdsActionsByCategory(
  category: GoogleAdsActionCategory
): GoogleAdsAction[] {
  return ALL_GOOGLE_ADS_ACTIONS.filter((a) => a.category === category);
}

export function getGoogleAdsActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GOOGLE_ADS_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGoogleAdsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_ADS_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGoogleAdsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_ADS_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Google Ads action priority.
 * Known Google Ads actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGoogleAdsPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGoogleAdsActionPriority(a.name) - getGoogleAdsActionPriority(b.name);
  });
}

export function getGoogleAdsActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GOOGLE_ADS_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GOOGLE_ADS_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Google Ads-specific system prompt when user has Google Ads connected.
 * Tells Claude exactly what it can do via the Composio Google Ads toolkit.
 */
export function getGoogleAdsSystemPrompt(): string {
  return `
## Google Ads Integration (Full Capabilities)

You have **full Google Ads access** through the user's connected account. Use the \`composio_GOOGLEADS_*\` tools.

### Campaign Management
- List all campaigns with status, type, and performance metrics
- Get detailed information for a specific campaign
- Create new campaigns with targeting, bidding strategy, and budget
- Update campaign settings (name, status, bidding, targeting)
- Pause or enable campaigns to control ad delivery
- Remove campaigns that are no longer needed

### Ad Groups
- List ad groups within a campaign
- Create ad groups with targeting and bid settings
- Update ad group configurations (bids, targeting, status)
- Pause ad groups to stop serving ads within a campaign

### Ad Creation
- List ads within an ad group
- Create new ads (responsive search ads, display ads, etc.)
- Pause individual ads to stop them from serving

### Keyword Targeting
- List keywords and their match types for an ad group
- Add new keywords with match types (broad, phrase, exact)
- Remove underperforming or irrelevant keywords

### Budget Management
- List all campaign budgets and their allocation
- Create new shared or campaign-specific budgets
- Set or adjust budget amounts for campaigns

### Reporting
- Pull performance reports with key metrics (impressions, clicks, conversions, cost)
- Analyze campaign, ad group, and keyword-level performance data

### Safety Rules
1. **ALWAYS confirm before spending budget** - show campaign details, daily budget, and bidding strategy before creating or updating campaigns:
\`\`\`action-preview
{
  "platform": "Google Ads",
  "action": "Create Campaign",
  "campaignName": "Campaign name",
  "dailyBudget": "$XX.XX",
  "biddingStrategy": "...",
  "toolName": "composio_GOOGLEADS_CREATE_CAMPAIGN",
  "toolParams": { "name": "...", "budget": ..., "bidding_strategy": "..." }
}
\`\`\`
2. **Confirm before removing campaigns** - removal is permanent and will stop all ads, show campaign name, current status, and spend before proceeding
3. **Show budget impact clearly** - when setting or changing budgets, display the current budget, proposed budget, and estimated daily/monthly impact
4. **Never remove keywords without explicit approval** - show keyword list, match types, and performance data before removing
5. **For new ad creation**, show ad copy (headlines, descriptions) and targeting before submitting
6. **Confirm before enabling paused campaigns** - the campaign will start spending immediately, show budget and bid details
7. **For batch operations**, summarize all changes and get explicit approval before executing
8. **Handle reporting data carefully** - present metrics clearly with proper formatting and date ranges
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGoogleAdsCapabilitySummary(): string {
  const stats = getGoogleAdsActionStats();
  return `Google Ads (${stats.total} actions: campaigns, ad groups, ads, keywords, budgets, reports)`;
}

export function logGoogleAdsToolkitStats(): void {
  const stats = getGoogleAdsActionStats();
  log.info('Google Ads Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
