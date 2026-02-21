/**
 * COMPOSIO FIGMA TOOLKIT
 * ======================
 *
 * Comprehensive Figma integration via Composio's tools.
 *
 * Categories:
 * - Files (get, list, export, versions)
 * - Components (list, get)
 * - Comments (add, list, get, delete)
 * - Projects (list, get files)
 * - Teams (list, get)
 * - Styles (list, get)
 */

import { logger } from '@/lib/logger';

const log = logger('FigmaToolkit');

export type FigmaActionCategory =
  | 'files'
  | 'components'
  | 'comments'
  | 'projects'
  | 'teams'
  | 'styles';

export interface FigmaAction {
  name: string;
  label: string;
  category: FigmaActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: FigmaAction[] = [
  { name: 'FIGMA_GET_FILE', label: 'Get File', category: 'files', priority: 1 },
  { name: 'FIGMA_LIST_FILES', label: 'List Files', category: 'files', priority: 1 },
  { name: 'FIGMA_GET_FILE_NODES', label: 'Get File Nodes', category: 'files', priority: 1 },
  { name: 'FIGMA_LIST_COMPONENTS', label: 'List Components', category: 'components', priority: 1 },
  { name: 'FIGMA_LIST_PROJECTS', label: 'List Projects', category: 'projects', priority: 1 },
  {
    name: 'FIGMA_ADD_COMMENT',
    label: 'Add Comment',
    category: 'comments',
    priority: 1,
    writeOperation: true,
  },
];

const IMPORTANT_ACTIONS: FigmaAction[] = [
  { name: 'FIGMA_EXPORT_FILE', label: 'Export File', category: 'files', priority: 2 },
  { name: 'FIGMA_GET_COMPONENT', label: 'Get Component', category: 'components', priority: 2 },
  { name: 'FIGMA_LIST_COMMENTS', label: 'List Comments', category: 'comments', priority: 2 },
  {
    name: 'FIGMA_GET_PROJECT_FILES',
    label: 'Get Project Files',
    category: 'projects',
    priority: 2,
  },
  { name: 'FIGMA_LIST_STYLES', label: 'List Styles', category: 'styles', priority: 2 },
  { name: 'FIGMA_GET_FILE_VERSIONS', label: 'Get File Versions', category: 'files', priority: 2 },
];

const USEFUL_ACTIONS: FigmaAction[] = [
  { name: 'FIGMA_GET_STYLE', label: 'Get Style', category: 'styles', priority: 3 },
  { name: 'FIGMA_GET_COMMENT', label: 'Get Comment', category: 'comments', priority: 3 },
  { name: 'FIGMA_LIST_TEAM_PROJECTS', label: 'List Team Projects', category: 'teams', priority: 3 },
  { name: 'FIGMA_GET_IMAGE_FILLS', label: 'Get Image Fills', category: 'files', priority: 3 },
  { name: 'FIGMA_EXPORT_IMAGES', label: 'Export Images', category: 'files', priority: 3 },
];

const ADVANCED_ACTIONS: FigmaAction[] = [
  {
    name: 'FIGMA_DELETE_COMMENT',
    label: 'Delete Comment',
    category: 'comments',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  { name: 'FIGMA_GET_TEAM', label: 'Get Team', category: 'teams', priority: 4 },
  {
    name: 'FIGMA_LIST_COMPONENT_SETS',
    label: 'List Component Sets',
    category: 'components',
    priority: 4,
  },
  {
    name: 'FIGMA_GET_FILE_COMPONENT_SETS',
    label: 'Get File Component Sets',
    category: 'components',
    priority: 4,
  },
];

export const ALL_FIGMA_ACTIONS: FigmaAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getFigmaFeaturedActionNames(): string[] {
  return ALL_FIGMA_ACTIONS.map((a) => a.name);
}
export function getFigmaActionsByPriority(maxPriority: number = 3): FigmaAction[] {
  return ALL_FIGMA_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getFigmaActionNamesByPriority(maxPriority: number = 3): string[] {
  return getFigmaActionsByPriority(maxPriority).map((a) => a.name);
}
export function getFigmaActionsByCategory(category: FigmaActionCategory): FigmaAction[] {
  return ALL_FIGMA_ACTIONS.filter((a) => a.category === category);
}
export function getFigmaActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_FIGMA_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownFigmaAction(toolName: string): boolean {
  return ALL_FIGMA_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveFigmaAction(toolName: string): boolean {
  return (
    ALL_FIGMA_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortByFigmaPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => getFigmaActionPriority(a.name) - getFigmaActionPriority(b.name));
}

export function getFigmaActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_FIGMA_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_FIGMA_ACTIONS.length, byPriority, byCategory };
}

export function getFigmaSystemPrompt(): string {
  return `
## Figma Integration (Full Capabilities)

You have **full Figma access** through the user's connected account. Use the \`composio_FIGMA_*\` tools.

### Files & Design
- Get file details, layers, and node information
- List files in projects
- Export files and images in various formats (PNG, SVG, PDF)
- View file version history

### Components & Styles
- List and get components from files and team libraries
- View component sets and variants
- List and get design styles (colors, text, effects)

### Comments & Collaboration
- Add comments to files at specific positions
- List and view comment threads
- Delete comments

### Projects & Teams
- List projects in a team
- Get files within a project
- View team information

### Safety Rules
1. **Confirm before adding comments** - show the file, position, and comment text
2. **Confirm before deleting comments** - deletion is permanent
3. **For exports**, confirm format and resolution settings
4. **Handle design files with care** - they may contain proprietary designs
`;
}

export function getFigmaCapabilitySummary(): string {
  const stats = getFigmaActionStats();
  return `Figma (${stats.total} actions: files, components, comments, projects, styles)`;
}

export function logFigmaToolkitStats(): void {
  const stats = getFigmaActionStats();
  log.info('Figma Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
