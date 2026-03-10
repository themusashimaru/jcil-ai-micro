/**
 * COMPOSIO CLOUDFLARE TOOLKIT
 * ============================
 *
 * Comprehensive Cloudflare integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - DNS (list, create, update, delete DNS records)
 * - Zones (list, get, create, update, delete zones, certificates, page rules)
 * - Workers (list, get, create, update, delete workers)
 * - Firewall (list, create, update, delete firewall rules)
 * - Cache (purge cache)
 * - Analytics (get analytics)
 * - Pages (list projects, create projects, list/create deployments)
 */

import { logger } from '@/lib/logger';

const log = logger('CloudflareToolkit');

// ============================================================================
// CLOUDFLARE ACTION CATEGORIES
// ============================================================================

export type CloudflareActionCategory =
  | 'dns'
  | 'zones'
  | 'workers'
  | 'firewall'
  | 'cache'
  | 'analytics'
  | 'pages';

export interface CloudflareAction {
  name: string; // Composio action name (e.g., CLOUDFLARE_LIST_ZONES)
  label: string; // Human-readable label
  category: CloudflareActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Cloudflare connected)
// ============================================================================

const ESSENTIAL_ACTIONS: CloudflareAction[] = [
  // Zones
  {
    name: 'CLOUDFLARE_LIST_ZONES',
    label: 'List Zones',
    category: 'zones',
    priority: 1,
  },
  {
    name: 'CLOUDFLARE_GET_ZONE',
    label: 'Get Zone',
    category: 'zones',
    priority: 1,
  },

  // DNS
  {
    name: 'CLOUDFLARE_LIST_DNS_RECORDS',
    label: 'List DNS Records',
    category: 'dns',
    priority: 1,
  },
  {
    name: 'CLOUDFLARE_CREATE_DNS_RECORD',
    label: 'Create DNS Record',
    category: 'dns',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'CLOUDFLARE_GET_DNS_RECORD',
    label: 'Get DNS Record',
    category: 'dns',
    priority: 1,
  },

  // Workers
  {
    name: 'CLOUDFLARE_LIST_WORKERS',
    label: 'List Workers',
    category: 'workers',
    priority: 1,
  },
  {
    name: 'CLOUDFLARE_GET_WORKER',
    label: 'Get Worker',
    category: 'workers',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: CloudflareAction[] = [
  // DNS - Extended
  {
    name: 'CLOUDFLARE_UPDATE_DNS_RECORD',
    label: 'Update DNS Record',
    category: 'dns',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'CLOUDFLARE_DELETE_DNS_RECORD',
    label: 'Delete DNS Record',
    category: 'dns',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },

  // Workers - Extended
  {
    name: 'CLOUDFLARE_CREATE_WORKER',
    label: 'Create Worker',
    category: 'workers',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'CLOUDFLARE_UPDATE_WORKER',
    label: 'Update Worker',
    category: 'workers',
    priority: 2,
    writeOperation: true,
  },

  // Firewall
  {
    name: 'CLOUDFLARE_LIST_FIREWALL_RULES',
    label: 'List Firewall Rules',
    category: 'firewall',
    priority: 2,
  },
  {
    name: 'CLOUDFLARE_CREATE_FIREWALL_RULE',
    label: 'Create Firewall Rule',
    category: 'firewall',
    priority: 2,
    writeOperation: true,
  },

  // Cache
  {
    name: 'CLOUDFLARE_PURGE_CACHE',
    label: 'Purge Cache',
    category: 'cache',
    priority: 2,
    writeOperation: true,
  },

  // Pages
  {
    name: 'CLOUDFLARE_LIST_PAGES_PROJECTS',
    label: 'List Pages Projects',
    category: 'pages',
    priority: 2,
  },
  {
    name: 'CLOUDFLARE_CREATE_PAGES_PROJECT',
    label: 'Create Pages Project',
    category: 'pages',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: CloudflareAction[] = [
  // Zones - Extended
  {
    name: 'CLOUDFLARE_CREATE_ZONE',
    label: 'Create Zone',
    category: 'zones',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'CLOUDFLARE_UPDATE_ZONE_SETTINGS',
    label: 'Update Zone Settings',
    category: 'zones',
    priority: 3,
    writeOperation: true,
  },

  // Workers - Extended
  {
    name: 'CLOUDFLARE_DELETE_WORKER',
    label: 'Delete Worker',
    category: 'workers',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Firewall - Extended
  {
    name: 'CLOUDFLARE_UPDATE_FIREWALL_RULE',
    label: 'Update Firewall Rule',
    category: 'firewall',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'CLOUDFLARE_DELETE_FIREWALL_RULE',
    label: 'Delete Firewall Rule',
    category: 'firewall',
    priority: 3,
    writeOperation: true,
    destructive: true,
  },

  // Analytics
  {
    name: 'CLOUDFLARE_GET_ANALYTICS',
    label: 'Get Analytics',
    category: 'analytics',
    priority: 3,
  },

  // Pages - Extended
  {
    name: 'CLOUDFLARE_LIST_DEPLOYMENTS',
    label: 'List Deployments',
    category: 'pages',
    priority: 3,
  },
  {
    name: 'CLOUDFLARE_CREATE_DEPLOYMENT',
    label: 'Create Deployment',
    category: 'pages',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: CloudflareAction[] = [
  {
    name: 'CLOUDFLARE_DELETE_ZONE',
    label: 'Delete Zone',
    category: 'zones',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'CLOUDFLARE_DELETE_PAGES_PROJECT',
    label: 'Delete Pages Project',
    category: 'pages',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'CLOUDFLARE_LIST_CERTIFICATES',
    label: 'List Certificates',
    category: 'zones',
    priority: 4,
  },
  {
    name: 'CLOUDFLARE_CREATE_CERTIFICATE',
    label: 'Create Certificate',
    category: 'zones',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'CLOUDFLARE_LIST_PAGE_RULES',
    label: 'List Page Rules',
    category: 'zones',
    priority: 4,
  },
  {
    name: 'CLOUDFLARE_CREATE_PAGE_RULE',
    label: 'Create Page Rule',
    category: 'zones',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_CLOUDFLARE_ACTIONS: CloudflareAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getCloudflareFeaturedActionNames(): string[] {
  return ALL_CLOUDFLARE_ACTIONS.map((a) => a.name);
}

export function getCloudflareActionsByPriority(maxPriority: number = 3): CloudflareAction[] {
  return ALL_CLOUDFLARE_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getCloudflareActionNamesByPriority(maxPriority: number = 3): string[] {
  return getCloudflareActionsByPriority(maxPriority).map((a) => a.name);
}

export function getCloudflareActionsByCategory(
  category: CloudflareActionCategory
): CloudflareAction[] {
  return ALL_CLOUDFLARE_ACTIONS.filter((a) => a.category === category);
}

export function getCloudflareActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_CLOUDFLARE_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownCloudflareAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_CLOUDFLARE_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveCloudflareAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_CLOUDFLARE_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Cloudflare action priority.
 * Known Cloudflare actions sorted by priority (1-4), unknown actions last.
 */
export function sortByCloudflarePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getCloudflareActionPriority(a.name) - getCloudflareActionPriority(b.name);
  });
}

export function getCloudflareActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_CLOUDFLARE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_CLOUDFLARE_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Cloudflare-specific system prompt when user has Cloudflare connected.
 * Tells Claude exactly what it can do via the Composio Cloudflare toolkit.
 */
export function getCloudflareSystemPrompt(): string {
  return `
## Cloudflare Integration (Full Capabilities)

You have **full Cloudflare access** through the user's connected account. Use the \`composio_CLOUDFLARE_*\` tools.

### DNS Management
- List all DNS records for a zone
- Create new DNS records (A, AAAA, CNAME, MX, TXT, SRV, etc.)
- Get details of a specific DNS record
- Update existing DNS records (change target, TTL, proxy status)
- Delete DNS records that are no longer needed

### Zones
- List all zones (domains) in the account
- Get detailed zone information (status, nameservers, settings)
- Create new zones for domain onboarding
- Update zone settings (SSL mode, security level, caching)
- Manage SSL/TLS certificates (list, create)
- Configure page rules for URL-based behavior

### Workers
- List all deployed Cloudflare Workers
- Get worker script details and configuration
- Create new Workers for edge computing
- Update existing worker scripts and bindings
- Delete workers that are no longer needed

### Firewall
- List active firewall rules for a zone
- Create new firewall rules (IP blocks, rate limiting, WAF rules)
- Update existing firewall rule expressions and actions
- Delete firewall rules that are no longer required

### Cache Management
- Purge cached content (by URL, tag, prefix, or everything)

### Analytics
- Retrieve zone analytics (requests, bandwidth, threats, page views)

### Pages
- List Cloudflare Pages projects
- Create new Pages projects for static site hosting
- List deployments for a Pages project
- Trigger new deployments

### Safety Rules
1. **ALWAYS confirm before modifying DNS records** - DNS changes propagate globally and can cause downtime. Show the record type, name, content, and TTL before creating or updating:
\`\`\`action-preview
{
  "platform": "Cloudflare",
  "action": "Create DNS Record",
  "zone": "example.com",
  "record": "A record: app.example.com -> 192.0.2.1",
  "ttl": "auto",
  "proxied": true,
  "toolName": "composio_CLOUDFLARE_CREATE_DNS_RECORD",
  "toolParams": { "zone_id": "...", "type": "A", "name": "app", "content": "192.0.2.1" }
}
\`\`\`
2. **Confirm before deleting workers** - worker deletion removes all associated routes and can break live traffic
3. **Confirm before changing firewall rules** - incorrect rules can block legitimate traffic or expose the site to attacks
4. **Never purge all cache without explicit approval** - full cache purges cause temporary performance degradation
5. **Confirm before deleting zones** - zone deletion removes all DNS records, workers, and settings permanently
6. **For DNS deletions**, show the existing record details and warn about potential impact on services
7. **For firewall rule changes**, clearly show the rule expression, action, and affected traffic
8. **For batch operations**, summarize what will happen and get explicit approval
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getCloudflareCapabilitySummary(): string {
  const stats = getCloudflareActionStats();
  return `Cloudflare (${stats.total} actions: dns, zones, workers, firewall, cache, analytics, pages)`;
}

export function logCloudflareToolkitStats(): void {
  const stats = getCloudflareActionStats();
  log.info('Cloudflare Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
