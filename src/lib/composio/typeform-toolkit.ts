/**
 * COMPOSIO TYPEFORM TOOLKIT
 * ===========================
 *
 * Comprehensive Typeform integration via Composio's tools.
 *
 * Categories:
 * - Forms (create, get, list, update)
 * - Responses (list, get, delete)
 * - Workspaces (list, get)
 * - Themes (list, get)
 */

import { logger } from '@/lib/logger';

const log = logger('TypeformToolkit');

export type TypeformActionCategory = 'forms' | 'responses' | 'workspaces' | 'themes';

export interface TypeformAction {
  name: string;
  label: string;
  category: TypeformActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: TypeformAction[] = [
  { name: 'TYPEFORM_LIST_FORMS', label: 'List Forms', category: 'forms', priority: 1 },
  { name: 'TYPEFORM_GET_FORM', label: 'Get Form', category: 'forms', priority: 1 },
  {
    name: 'TYPEFORM_LIST_RESPONSES',
    label: 'List Responses',
    category: 'responses',
    priority: 1,
  },
  {
    name: 'TYPEFORM_CREATE_FORM',
    label: 'Create Form',
    category: 'forms',
    priority: 1,
    writeOperation: true,
  },
  { name: 'TYPEFORM_GET_RESPONSE', label: 'Get Response', category: 'responses', priority: 1 },
];

const IMPORTANT_ACTIONS: TypeformAction[] = [
  {
    name: 'TYPEFORM_UPDATE_FORM',
    label: 'Update Form',
    category: 'forms',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TYPEFORM_LIST_WORKSPACES',
    label: 'List Workspaces',
    category: 'workspaces',
    priority: 2,
  },
  {
    name: 'TYPEFORM_GET_WORKSPACE',
    label: 'Get Workspace',
    category: 'workspaces',
    priority: 2,
  },
  {
    name: 'TYPEFORM_GET_RESPONSE_COUNT',
    label: 'Get Response Count',
    category: 'responses',
    priority: 2,
  },
];

const USEFUL_ACTIONS: TypeformAction[] = [
  { name: 'TYPEFORM_LIST_THEMES', label: 'List Themes', category: 'themes', priority: 3 },
  { name: 'TYPEFORM_GET_THEME', label: 'Get Theme', category: 'themes', priority: 3 },
  {
    name: 'TYPEFORM_DUPLICATE_FORM',
    label: 'Duplicate Form',
    category: 'forms',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TYPEFORM_CREATE_WORKSPACE',
    label: 'Create Workspace',
    category: 'workspaces',
    priority: 3,
    writeOperation: true,
  },
];

const ADVANCED_ACTIONS: TypeformAction[] = [
  {
    name: 'TYPEFORM_DELETE_FORM',
    label: 'Delete Form',
    category: 'forms',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TYPEFORM_DELETE_RESPONSES',
    label: 'Delete Responses',
    category: 'responses',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TYPEFORM_DELETE_WORKSPACE',
    label: 'Delete Workspace',
    category: 'workspaces',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

export const ALL_TYPEFORM_ACTIONS: TypeformAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getTypeformFeaturedActionNames(): string[] {
  return ALL_TYPEFORM_ACTIONS.map((a) => a.name);
}
export function getTypeformActionsByPriority(maxPriority: number = 3): TypeformAction[] {
  return ALL_TYPEFORM_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getTypeformActionNamesByPriority(maxPriority: number = 3): string[] {
  return getTypeformActionsByPriority(maxPriority).map((a) => a.name);
}
export function getTypeformActionsByCategory(category: TypeformActionCategory): TypeformAction[] {
  return ALL_TYPEFORM_ACTIONS.filter((a) => a.category === category);
}
export function getTypeformActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_TYPEFORM_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownTypeformAction(toolName: string): boolean {
  return ALL_TYPEFORM_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveTypeformAction(toolName: string): boolean {
  return (
    ALL_TYPEFORM_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortByTypeformPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getTypeformActionPriority(a.name) - getTypeformActionPriority(b.name)
  );
}

export function getTypeformActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_TYPEFORM_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_TYPEFORM_ACTIONS.length, byPriority, byCategory };
}

export function getTypeformSystemPrompt(): string {
  return `
## Typeform Integration (Full Capabilities)

You have **full Typeform access** through the user's connected account. Use the \`composio_TYPEFORM_*\` tools.

### Forms
- Create and manage forms and surveys
- Update form questions and settings
- Duplicate existing forms

### Responses
- List and retrieve form responses
- Get response counts and analytics
- Export response data

### Workspaces & Themes
- Organize forms into workspaces
- Apply and manage visual themes

### Safety Rules
1. **Confirm before deleting forms** - deletion is permanent and removes all responses
2. **Confirm before deleting responses** - data cannot be recovered
3. **Show form details before updates** - ensure correct form is being modified
`;
}

export function getTypeformCapabilitySummary(): string {
  const stats = getTypeformActionStats();
  return `Typeform (${stats.total} actions: forms, responses, workspaces, themes)`;
}

export function logTypeformToolkitStats(): void {
  const stats = getTypeformActionStats();
  log.info('Typeform Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
