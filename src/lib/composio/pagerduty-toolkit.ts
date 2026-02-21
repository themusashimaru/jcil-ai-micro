/**
 * COMPOSIO PAGERDUTY TOOLKIT
 * ============================
 *
 * Comprehensive PagerDuty integration via Composio's tools.
 *
 * Categories:
 * - Incidents (create, list, get, update, resolve)
 * - Services (list, get, create)
 * - Users (list, get, on-call)
 * - Schedules (list, get)
 * - Escalation Policies (list, get)
 */

import { logger } from '@/lib/logger';

const log = logger('PagerDutyToolkit');

export type PagerDutyActionCategory =
  | 'incidents'
  | 'services'
  | 'users'
  | 'schedules'
  | 'escalation_policies';

export interface PagerDutyAction {
  name: string;
  label: string;
  category: PagerDutyActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: PagerDutyAction[] = [
  { name: 'PAGERDUTY_LIST_INCIDENTS', label: 'List Incidents', category: 'incidents', priority: 1 },
  { name: 'PAGERDUTY_GET_INCIDENT', label: 'Get Incident', category: 'incidents', priority: 1 },
  {
    name: 'PAGERDUTY_CREATE_INCIDENT',
    label: 'Create Incident',
    category: 'incidents',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'PAGERDUTY_UPDATE_INCIDENT',
    label: 'Update Incident',
    category: 'incidents',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'PAGERDUTY_RESOLVE_INCIDENT',
    label: 'Resolve Incident',
    category: 'incidents',
    priority: 1,
    writeOperation: true,
  },
];

const IMPORTANT_ACTIONS: PagerDutyAction[] = [
  {
    name: 'PAGERDUTY_ACKNOWLEDGE_INCIDENT',
    label: 'Acknowledge Incident',
    category: 'incidents',
    priority: 2,
    writeOperation: true,
  },
  { name: 'PAGERDUTY_LIST_SERVICES', label: 'List Services', category: 'services', priority: 2 },
  { name: 'PAGERDUTY_GET_SERVICE', label: 'Get Service', category: 'services', priority: 2 },
  { name: 'PAGERDUTY_LIST_USERS', label: 'List Users', category: 'users', priority: 2 },
  {
    name: 'PAGERDUTY_LIST_ONCALLS',
    label: 'List On-Calls',
    category: 'users',
    priority: 2,
  },
  {
    name: 'PAGERDUTY_ADD_NOTE',
    label: 'Add Incident Note',
    category: 'incidents',
    priority: 2,
    writeOperation: true,
  },
];

const USEFUL_ACTIONS: PagerDutyAction[] = [
  { name: 'PAGERDUTY_GET_USER', label: 'Get User', category: 'users', priority: 3 },
  {
    name: 'PAGERDUTY_LIST_SCHEDULES',
    label: 'List Schedules',
    category: 'schedules',
    priority: 3,
  },
  { name: 'PAGERDUTY_GET_SCHEDULE', label: 'Get Schedule', category: 'schedules', priority: 3 },
  {
    name: 'PAGERDUTY_LIST_ESCALATION_POLICIES',
    label: 'List Escalation Policies',
    category: 'escalation_policies',
    priority: 3,
  },
  {
    name: 'PAGERDUTY_REASSIGN_INCIDENT',
    label: 'Reassign Incident',
    category: 'incidents',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'PAGERDUTY_SNOOZE_INCIDENT',
    label: 'Snooze Incident',
    category: 'incidents',
    priority: 3,
    writeOperation: true,
  },
];

const ADVANCED_ACTIONS: PagerDutyAction[] = [
  {
    name: 'PAGERDUTY_CREATE_SERVICE',
    label: 'Create Service',
    category: 'services',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'PAGERDUTY_MERGE_INCIDENTS',
    label: 'Merge Incidents',
    category: 'incidents',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'PAGERDUTY_GET_ESCALATION_POLICY',
    label: 'Get Escalation Policy',
    category: 'escalation_policies',
    priority: 4,
  },
  {
    name: 'PAGERDUTY_LIST_INCIDENT_LOG',
    label: 'List Incident Log',
    category: 'incidents',
    priority: 4,
  },
];

export const ALL_PAGERDUTY_ACTIONS: PagerDutyAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getPagerDutyFeaturedActionNames(): string[] {
  return ALL_PAGERDUTY_ACTIONS.map((a) => a.name);
}
export function getPagerDutyActionsByPriority(maxPriority: number = 3): PagerDutyAction[] {
  return ALL_PAGERDUTY_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getPagerDutyActionNamesByPriority(maxPriority: number = 3): string[] {
  return getPagerDutyActionsByPriority(maxPriority).map((a) => a.name);
}
export function getPagerDutyActionsByCategory(
  category: PagerDutyActionCategory
): PagerDutyAction[] {
  return ALL_PAGERDUTY_ACTIONS.filter((a) => a.category === category);
}
export function getPagerDutyActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_PAGERDUTY_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownPagerDutyAction(toolName: string): boolean {
  return ALL_PAGERDUTY_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructivePagerDutyAction(toolName: string): boolean {
  return (
    ALL_PAGERDUTY_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))
      ?.destructive === true
  );
}
export function sortByPagerDutyPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getPagerDutyActionPriority(a.name) - getPagerDutyActionPriority(b.name)
  );
}

export function getPagerDutyActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_PAGERDUTY_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_PAGERDUTY_ACTIONS.length, byPriority, byCategory };
}

export function getPagerDutySystemPrompt(): string {
  return `
## PagerDuty Integration (Full Capabilities)

You have **full PagerDuty access** through the user's connected account. Use the \`composio_PAGERDUTY_*\` tools.

### Incidents
- Create, update, acknowledge, and resolve incidents
- Add notes and reassign incidents
- Snooze and merge related incidents
- View incident logs and timelines

### Services & Escalations
- List and manage monitored services
- View escalation policies and routing
- Create new services for monitoring

### On-Call & Schedules
- View who's currently on-call
- List and manage on-call schedules
- View user details and contact methods

### Safety Rules
1. **Confirm before creating incidents** - this triggers alerts and pages people
2. **Confirm before resolving incidents** - ensure the issue is actually fixed
3. **For merging incidents**, show both incident details first
4. **Be mindful of on-call hours** - avoid unnecessary pages
`;
}

export function getPagerDutyCapabilitySummary(): string {
  const stats = getPagerDutyActionStats();
  return `PagerDuty (${stats.total} actions: incidents, services, users, schedules, escalations)`;
}

export function logPagerDutyToolkitStats(): void {
  const stats = getPagerDutyActionStats();
  log.info('PagerDuty Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
