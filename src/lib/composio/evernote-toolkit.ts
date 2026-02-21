/**
 * COMPOSIO EVERNOTE TOOLKIT
 * ===========================
 *
 * Comprehensive Evernote integration via Composio's tools.
 *
 * Categories:
 * - Notes (create, get, list, update, search)
 * - Notebooks (create, list, get)
 * - Tags (create, list)
 * - Search (full-text search)
 */

import { logger } from '@/lib/logger';

const log = logger('EvernoteToolkit');

export type EvernoteActionCategory = 'notes' | 'notebooks' | 'tags' | 'search';

export interface EvernoteAction {
  name: string;
  label: string;
  category: EvernoteActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: EvernoteAction[] = [
  {
    name: 'EVERNOTE_CREATE_NOTE',
    label: 'Create Note',
    category: 'notes',
    priority: 1,
    writeOperation: true,
  },
  { name: 'EVERNOTE_GET_NOTE', label: 'Get Note', category: 'notes', priority: 1 },
  { name: 'EVERNOTE_LIST_NOTES', label: 'List Notes', category: 'notes', priority: 1 },
  { name: 'EVERNOTE_SEARCH_NOTES', label: 'Search Notes', category: 'search', priority: 1 },
  {
    name: 'EVERNOTE_UPDATE_NOTE',
    label: 'Update Note',
    category: 'notes',
    priority: 1,
    writeOperation: true,
  },
];

const IMPORTANT_ACTIONS: EvernoteAction[] = [
  { name: 'EVERNOTE_LIST_NOTEBOOKS', label: 'List Notebooks', category: 'notebooks', priority: 2 },
  {
    name: 'EVERNOTE_CREATE_NOTEBOOK',
    label: 'Create Notebook',
    category: 'notebooks',
    priority: 2,
    writeOperation: true,
  },
  { name: 'EVERNOTE_GET_NOTEBOOK', label: 'Get Notebook', category: 'notebooks', priority: 2 },
  { name: 'EVERNOTE_LIST_TAGS', label: 'List Tags', category: 'tags', priority: 2 },
];

const USEFUL_ACTIONS: EvernoteAction[] = [
  {
    name: 'EVERNOTE_CREATE_TAG',
    label: 'Create Tag',
    category: 'tags',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'EVERNOTE_MOVE_NOTE',
    label: 'Move Note to Notebook',
    category: 'notes',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'EVERNOTE_TAG_NOTE',
    label: 'Tag Note',
    category: 'notes',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'EVERNOTE_UPDATE_NOTEBOOK',
    label: 'Update Notebook',
    category: 'notebooks',
    priority: 3,
    writeOperation: true,
  },
];

const ADVANCED_ACTIONS: EvernoteAction[] = [
  {
    name: 'EVERNOTE_DELETE_NOTE',
    label: 'Delete Note',
    category: 'notes',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'EVERNOTE_DELETE_NOTEBOOK',
    label: 'Delete Notebook',
    category: 'notebooks',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'EVERNOTE_EXPUNGE_NOTE',
    label: 'Permanently Delete Note',
    category: 'notes',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

export const ALL_EVERNOTE_ACTIONS: EvernoteAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getEvernoteFeaturedActionNames(): string[] {
  return ALL_EVERNOTE_ACTIONS.map((a) => a.name);
}
export function getEvernoteActionsByPriority(maxPriority: number = 3): EvernoteAction[] {
  return ALL_EVERNOTE_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getEvernoteActionNamesByPriority(maxPriority: number = 3): string[] {
  return getEvernoteActionsByPriority(maxPriority).map((a) => a.name);
}
export function getEvernoteActionsByCategory(category: EvernoteActionCategory): EvernoteAction[] {
  return ALL_EVERNOTE_ACTIONS.filter((a) => a.category === category);
}
export function getEvernoteActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_EVERNOTE_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownEvernoteAction(toolName: string): boolean {
  return ALL_EVERNOTE_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveEvernoteAction(toolName: string): boolean {
  return (
    ALL_EVERNOTE_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortByEvernotePriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getEvernoteActionPriority(a.name) - getEvernoteActionPriority(b.name)
  );
}

export function getEvernoteActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_EVERNOTE_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_EVERNOTE_ACTIONS.length, byPriority, byCategory };
}

export function getEvernoteSystemPrompt(): string {
  return `
## Evernote Integration (Full Capabilities)

You have **full Evernote access** through the user's connected account. Use the \`composio_EVERNOTE_*\` tools.

### Notes
- Create rich-text notes with formatting
- Search across all notes using full-text search
- Update note content and metadata
- Move notes between notebooks

### Notebooks & Tags
- Organize notes into notebooks
- Tag notes for flexible categorization
- List and manage notebooks

### Safety Rules
1. **Confirm before deleting notes** - deletion moves to trash
2. **NEVER permanently expunge notes without explicit confirmation**
3. **Show note content before updates** - prevent accidental overwrites
`;
}

export function getEvernoteCapabilitySummary(): string {
  const stats = getEvernoteActionStats();
  return `Evernote (${stats.total} actions: notes, notebooks, tags, search)`;
}

export function logEvernoteToolkitStats(): void {
  const stats = getEvernoteActionStats();
  log.info('Evernote Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
