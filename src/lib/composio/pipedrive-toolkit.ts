/**
 * COMPOSIO PIPEDRIVE TOOLKIT
 * ==========================
 *
 * Comprehensive Pipedrive integration via Composio's tools.
 *
 * Categories:
 * - Deals (create, get, list, update, delete, search)
 * - Contacts (create, get, list, update, search)
 * - Organizations (create, get, list, update)
 * - Activities (create, get, list, update, delete)
 * - Pipelines (list, get)
 * - Notes (create, list, get)
 */

import { logger } from '@/lib/logger';

const log = logger('PipedriveToolkit');

export type PipedriveActionCategory =
  | 'deals'
  | 'contacts'
  | 'organizations'
  | 'activities'
  | 'pipelines'
  | 'notes';

export interface PipedriveAction {
  name: string;
  label: string;
  category: PipedriveActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: PipedriveAction[] = [
  {
    name: 'PIPEDRIVE_CREATE_DEAL',
    label: 'Create Deal',
    category: 'deals',
    priority: 1,
    writeOperation: true,
  },
  { name: 'PIPEDRIVE_GET_DEAL', label: 'Get Deal', category: 'deals', priority: 1 },
  { name: 'PIPEDRIVE_LIST_DEALS', label: 'List Deals', category: 'deals', priority: 1 },
  {
    name: 'PIPEDRIVE_UPDATE_DEAL',
    label: 'Update Deal',
    category: 'deals',
    priority: 1,
    writeOperation: true,
  },
  { name: 'PIPEDRIVE_SEARCH_DEALS', label: 'Search Deals', category: 'deals', priority: 1 },
  {
    name: 'PIPEDRIVE_CREATE_PERSON',
    label: 'Create Person',
    category: 'contacts',
    priority: 1,
    writeOperation: true,
  },
  { name: 'PIPEDRIVE_LIST_PERSONS', label: 'List Persons', category: 'contacts', priority: 1 },
];

const IMPORTANT_ACTIONS: PipedriveAction[] = [
  { name: 'PIPEDRIVE_GET_PERSON', label: 'Get Person', category: 'contacts', priority: 2 },
  {
    name: 'PIPEDRIVE_UPDATE_PERSON',
    label: 'Update Person',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },
  { name: 'PIPEDRIVE_SEARCH_PERSONS', label: 'Search Persons', category: 'contacts', priority: 2 },
  {
    name: 'PIPEDRIVE_CREATE_ACTIVITY',
    label: 'Create Activity',
    category: 'activities',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'PIPEDRIVE_LIST_ACTIVITIES',
    label: 'List Activities',
    category: 'activities',
    priority: 2,
  },
  { name: 'PIPEDRIVE_LIST_PIPELINES', label: 'List Pipelines', category: 'pipelines', priority: 2 },
  {
    name: 'PIPEDRIVE_CREATE_NOTE',
    label: 'Create Note',
    category: 'notes',
    priority: 2,
    writeOperation: true,
  },
];

const USEFUL_ACTIONS: PipedriveAction[] = [
  {
    name: 'PIPEDRIVE_CREATE_ORGANIZATION',
    label: 'Create Organization',
    category: 'organizations',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'PIPEDRIVE_GET_ORGANIZATION',
    label: 'Get Organization',
    category: 'organizations',
    priority: 3,
  },
  {
    name: 'PIPEDRIVE_LIST_ORGANIZATIONS',
    label: 'List Organizations',
    category: 'organizations',
    priority: 3,
  },
  {
    name: 'PIPEDRIVE_UPDATE_ORGANIZATION',
    label: 'Update Organization',
    category: 'organizations',
    priority: 3,
    writeOperation: true,
  },
  { name: 'PIPEDRIVE_GET_ACTIVITY', label: 'Get Activity', category: 'activities', priority: 3 },
  {
    name: 'PIPEDRIVE_UPDATE_ACTIVITY',
    label: 'Update Activity',
    category: 'activities',
    priority: 3,
    writeOperation: true,
  },
  { name: 'PIPEDRIVE_GET_PIPELINE', label: 'Get Pipeline', category: 'pipelines', priority: 3 },
  { name: 'PIPEDRIVE_LIST_NOTES', label: 'List Notes', category: 'notes', priority: 3 },
];

const ADVANCED_ACTIONS: PipedriveAction[] = [
  {
    name: 'PIPEDRIVE_DELETE_DEAL',
    label: 'Delete Deal',
    category: 'deals',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'PIPEDRIVE_DELETE_PERSON',
    label: 'Delete Person',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'PIPEDRIVE_DELETE_ACTIVITY',
    label: 'Delete Activity',
    category: 'activities',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  { name: 'PIPEDRIVE_GET_NOTE', label: 'Get Note', category: 'notes', priority: 4 },
  {
    name: 'PIPEDRIVE_LIST_DEAL_ACTIVITIES',
    label: 'List Deal Activities',
    category: 'deals',
    priority: 4,
  },
];

export const ALL_PIPEDRIVE_ACTIONS: PipedriveAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getPipedriveFeaturedActionNames(): string[] {
  return ALL_PIPEDRIVE_ACTIONS.map((a) => a.name);
}
export function getPipedriveActionsByPriority(maxPriority: number = 3): PipedriveAction[] {
  return ALL_PIPEDRIVE_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getPipedriveActionNamesByPriority(maxPriority: number = 3): string[] {
  return getPipedriveActionsByPriority(maxPriority).map((a) => a.name);
}
export function getPipedriveActionsByCategory(
  category: PipedriveActionCategory
): PipedriveAction[] {
  return ALL_PIPEDRIVE_ACTIONS.filter((a) => a.category === category);
}
export function getPipedriveActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_PIPEDRIVE_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownPipedriveAction(toolName: string): boolean {
  return ALL_PIPEDRIVE_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructivePipedriveAction(toolName: string): boolean {
  return (
    ALL_PIPEDRIVE_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))
      ?.destructive === true
  );
}
export function sortByPipedrivePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getPipedriveActionPriority(a.name) - getPipedriveActionPriority(b.name)
  );
}

export function getPipedriveActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_PIPEDRIVE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_PIPEDRIVE_ACTIONS.length, byPriority, byCategory };
}

export function getPipedriveSystemPrompt(): string {
  return `
## Pipedrive Integration (Full Capabilities)

You have **full Pipedrive access** through the user's connected account. Use the \`composio_PIPEDRIVE_*\` tools.

### Deals (Sales Pipeline)
- Create deals with value, currency, pipeline, and stage
- List and search deals with filters
- Update deal stage, value, and properties
- Track deal activities and notes

### Contacts (Persons)
- Create and manage contact records
- Search contacts by name, email, or phone
- Associate contacts with deals and organizations

### Organizations & Activities
- Manage company/organization records
- Create and track activities (calls, meetings, tasks)
- Schedule follow-ups linked to deals

### Pipelines & Notes
- View pipeline stages and configuration
- Add notes to deals, contacts, and organizations

### Safety Rules
1. **ALWAYS confirm before creating deals** - show pipeline, stage, value, and contact
2. **Confirm before deleting deals or contacts** - deletion is permanent
3. **Handle financial data carefully** - deal values and currencies are business-critical
4. **For bulk operations**, summarize scope and get approval
`;
}

export function getPipedriveCapabilitySummary(): string {
  const stats = getPipedriveActionStats();
  return `Pipedrive (${stats.total} actions: deals, contacts, organizations, activities, pipelines, notes)`;
}

export function logPipedriveToolkitStats(): void {
  const stats = getPipedriveActionStats();
  log.info('Pipedrive Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
