/**
 * COMPOSIO LOOM TOOLKIT
 * =======================
 *
 * Comprehensive Loom integration via Composio's tools.
 *
 * Categories:
 * - Videos (list, get, search, update)
 * - Folders (list, get, create)
 * - Sharing (get link, update access)
 * - Comments (list, get)
 */

import { logger } from '@/lib/logger';

const log = logger('LoomToolkit');

export type LoomActionCategory = 'videos' | 'folders' | 'sharing' | 'comments';

export interface LoomAction {
  name: string;
  label: string;
  category: LoomActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: LoomAction[] = [
  { name: 'LOOM_LIST_VIDEOS', label: 'List Videos', category: 'videos', priority: 1 },
  { name: 'LOOM_GET_VIDEO', label: 'Get Video', category: 'videos', priority: 1 },
  { name: 'LOOM_SEARCH_VIDEOS', label: 'Search Videos', category: 'videos', priority: 1 },
  { name: 'LOOM_GET_SHARE_LINK', label: 'Get Share Link', category: 'sharing', priority: 1 },
];

const IMPORTANT_ACTIONS: LoomAction[] = [
  {
    name: 'LOOM_UPDATE_VIDEO',
    label: 'Update Video',
    category: 'videos',
    priority: 2,
    writeOperation: true,
  },
  { name: 'LOOM_LIST_FOLDERS', label: 'List Folders', category: 'folders', priority: 2 },
  { name: 'LOOM_GET_FOLDER', label: 'Get Folder', category: 'folders', priority: 2 },
  {
    name: 'LOOM_UPDATE_ACCESS',
    label: 'Update Share Access',
    category: 'sharing',
    priority: 2,
    writeOperation: true,
  },
];

const USEFUL_ACTIONS: LoomAction[] = [
  {
    name: 'LOOM_CREATE_FOLDER',
    label: 'Create Folder',
    category: 'folders',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'LOOM_MOVE_VIDEO',
    label: 'Move Video to Folder',
    category: 'videos',
    priority: 3,
    writeOperation: true,
  },
  { name: 'LOOM_LIST_COMMENTS', label: 'List Comments', category: 'comments', priority: 3 },
  { name: 'LOOM_GET_TRANSCRIPT', label: 'Get Transcript', category: 'videos', priority: 3 },
];

const ADVANCED_ACTIONS: LoomAction[] = [
  {
    name: 'LOOM_DELETE_VIDEO',
    label: 'Delete Video',
    category: 'videos',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'LOOM_DELETE_FOLDER',
    label: 'Delete Folder',
    category: 'folders',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'LOOM_ARCHIVE_VIDEO',
    label: 'Archive Video',
    category: 'videos',
    priority: 4,
    writeOperation: true,
  },
];

export const ALL_LOOM_ACTIONS: LoomAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getLoomFeaturedActionNames(): string[] {
  return ALL_LOOM_ACTIONS.map((a) => a.name);
}
export function getLoomActionsByPriority(maxPriority: number = 3): LoomAction[] {
  return ALL_LOOM_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getLoomActionNamesByPriority(maxPriority: number = 3): string[] {
  return getLoomActionsByPriority(maxPriority).map((a) => a.name);
}
export function getLoomActionsByCategory(category: LoomActionCategory): LoomAction[] {
  return ALL_LOOM_ACTIONS.filter((a) => a.category === category);
}
export function getLoomActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_LOOM_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownLoomAction(toolName: string): boolean {
  return ALL_LOOM_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveLoomAction(toolName: string): boolean {
  return (
    ALL_LOOM_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortByLoomPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => getLoomActionPriority(a.name) - getLoomActionPriority(b.name));
}

export function getLoomActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_LOOM_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_LOOM_ACTIONS.length, byPriority, byCategory };
}

export function getLoomSystemPrompt(): string {
  return `
## Loom Integration (Full Capabilities)

You have **full Loom access** through the user's connected account. Use the \`composio_LOOM_*\` tools.

### Videos
- List and search recorded videos
- Get video details and transcripts
- Update video titles and descriptions
- Move videos between folders

### Folders
- Organize videos into folders
- Create new folders for projects

### Sharing
- Get shareable links for videos
- Update access permissions

### Safety Rules
1. **Confirm before deleting videos** - deletion is permanent
2. **Confirm before changing share access** - may expose content
3. **Show video details before updates** - verify correct video
`;
}

export function getLoomCapabilitySummary(): string {
  const stats = getLoomActionStats();
  return `Loom (${stats.total} actions: videos, folders, sharing, comments)`;
}

export function logLoomToolkitStats(): void {
  const stats = getLoomActionStats();
  log.info('Loom Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
