/**
 * COMPOSIO MIRO TOOLKIT
 * =====================
 *
 * Comprehensive Miro integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Boards (create, get, update, delete boards)
 * - Items (sticky notes, shapes, text, images, cards)
 * - Frames (create, get, update frames)
 * - Widgets (connectors, tags, app cards)
 * - Sharing (share boards, manage collaborators)
 */

import { logger } from '@/lib/logger';

const log = logger('MiroToolkit');

// ============================================================================
// MIRO ACTION CATEGORIES
// ============================================================================

export type MiroActionCategory = 'boards' | 'items' | 'frames' | 'widgets' | 'sharing';

export interface MiroAction {
  name: string; // Composio action name (e.g., MIRO_CREATE_BOARD)
  label: string; // Human-readable label
  category: MiroActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Miro connected)
// ============================================================================

const ESSENTIAL_ACTIONS: MiroAction[] = [
  // Boards - Core
  {
    name: 'MIRO_CREATE_BOARD',
    label: 'Create Board',
    category: 'boards',
    priority: 1,
    writeOperation: true,
  },
  { name: 'MIRO_GET_BOARDS', label: 'Get Boards', category: 'boards', priority: 1 },
  { name: 'MIRO_GET_BOARD', label: 'Get Board Details', category: 'boards', priority: 1 },

  // Items - Core
  {
    name: 'MIRO_CREATE_STICKY_NOTE',
    label: 'Create Sticky Note',
    category: 'items',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'MIRO_CREATE_SHAPE',
    label: 'Create Shape',
    category: 'items',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'MIRO_CREATE_TEXT',
    label: 'Create Text',
    category: 'items',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: MiroAction[] = [
  // Items - Extended
  {
    name: 'MIRO_CREATE_IMAGE',
    label: 'Create Image',
    category: 'items',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'MIRO_CREATE_CARD',
    label: 'Create Card',
    category: 'items',
    priority: 2,
    writeOperation: true,
  },
  { name: 'MIRO_GET_ITEMS', label: 'Get Board Items', category: 'items', priority: 2 },
  {
    name: 'MIRO_UPDATE_STICKY_NOTE',
    label: 'Update Sticky Note',
    category: 'items',
    priority: 2,
    writeOperation: true,
  },

  // Widgets - Core
  {
    name: 'MIRO_ADD_CONNECTOR',
    label: 'Add Connector',
    category: 'widgets',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'MIRO_ADD_TAG',
    label: 'Add Tag',
    category: 'widgets',
    priority: 2,
    writeOperation: true,
  },

  // Frames - Core
  {
    name: 'MIRO_CREATE_FRAME',
    label: 'Create Frame',
    category: 'frames',
    priority: 2,
    writeOperation: true,
  },
  { name: 'MIRO_GET_FRAMES', label: 'Get Frames', category: 'frames', priority: 2 },

  // Sharing - Core
  {
    name: 'MIRO_SHARE_BOARD',
    label: 'Share Board',
    category: 'sharing',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: MiroAction[] = [
  // Boards - Extended
  {
    name: 'MIRO_UPDATE_BOARD',
    label: 'Update Board',
    category: 'boards',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MIRO_COPY_BOARD',
    label: 'Copy Board',
    category: 'boards',
    priority: 3,
    writeOperation: true,
  },

  // Items - Extended
  {
    name: 'MIRO_UPDATE_SHAPE',
    label: 'Update Shape',
    category: 'items',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'MIRO_UPDATE_TEXT',
    label: 'Update Text',
    category: 'items',
    priority: 3,
    writeOperation: true,
  },
  { name: 'MIRO_GET_ITEM', label: 'Get Item Details', category: 'items', priority: 3 },

  // Frames - Extended
  {
    name: 'MIRO_UPDATE_FRAME',
    label: 'Update Frame',
    category: 'frames',
    priority: 3,
    writeOperation: true,
  },
  { name: 'MIRO_GET_FRAME_ITEMS', label: 'Get Frame Items', category: 'frames', priority: 3 },

  // Widgets - Extended
  { name: 'MIRO_GET_CONNECTORS', label: 'Get Connectors', category: 'widgets', priority: 3 },
  {
    name: 'MIRO_CREATE_APP_CARD',
    label: 'Create App Card',
    category: 'widgets',
    priority: 3,
    writeOperation: true,
  },

  // Sharing - Extended
  {
    name: 'MIRO_GET_BOARD_MEMBERS',
    label: 'Get Board Members',
    category: 'sharing',
    priority: 3,
  },
  {
    name: 'MIRO_INVITE_BOARD_MEMBER',
    label: 'Invite Board Member',
    category: 'sharing',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: MiroAction[] = [
  // Boards - Destructive
  {
    name: 'MIRO_DELETE_BOARD',
    label: 'Delete Board',
    category: 'boards',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Items - Destructive
  {
    name: 'MIRO_DELETE_ITEM',
    label: 'Delete Item',
    category: 'items',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Frames - Destructive
  {
    name: 'MIRO_DELETE_FRAME',
    label: 'Delete Frame',
    category: 'frames',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Widgets - Destructive
  {
    name: 'MIRO_DELETE_CONNECTOR',
    label: 'Delete Connector',
    category: 'widgets',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Sharing - Destructive
  {
    name: 'MIRO_REMOVE_BOARD_MEMBER',
    label: 'Remove Board Member',
    category: 'sharing',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_MIRO_ACTIONS: MiroAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getMiroFeaturedActionNames(): string[] {
  return ALL_MIRO_ACTIONS.map((a) => a.name);
}

export function getMiroActionsByPriority(maxPriority: number = 3): MiroAction[] {
  return ALL_MIRO_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getMiroActionNamesByPriority(maxPriority: number = 3): string[] {
  return getMiroActionsByPriority(maxPriority).map((a) => a.name);
}

export function getMiroActionsByCategory(category: MiroActionCategory): MiroAction[] {
  return ALL_MIRO_ACTIONS.filter((a) => a.category === category);
}

export function getMiroActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_MIRO_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownMiroAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_MIRO_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveMiroAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_MIRO_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Miro action priority.
 * Known Miro actions sorted by priority (1-4), unknown actions last.
 */
export function sortByMiroPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getMiroActionPriority(a.name) - getMiroActionPriority(b.name);
  });
}

export function getMiroActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_MIRO_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_MIRO_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Miro-specific system prompt when user has Miro connected.
 * Tells Claude exactly what it can do via the Composio Miro toolkit.
 */
export function getMiroSystemPrompt(): string {
  return `
## Miro Integration (Full Capabilities)

You have **full Miro access** through the user's connected account. Use the \`composio_MIRO_*\` tools.

### Boards
- Create new boards with custom names and descriptions
- List all boards the user has access to
- Get detailed board information
- Update board settings and properties
- Copy existing boards as templates
- Delete boards (with confirmation)

### Items
- Create sticky notes with custom text, colors, and positions
- Create shapes (rectangles, circles, triangles, etc.)
- Create text elements with formatting
- Add images to boards
- Create cards with titles and descriptions
- Update and reposition items
- Get item details and list all board items

### Frames
- Create frames to organize board sections
- Get all frames on a board
- List items within a specific frame
- Update frame properties (size, position, title)

### Widgets
- Add connectors between items to show relationships
- Create app cards for external integrations
- Add tags to categorize and label items
- Get all connectors on a board

### Sharing & Collaboration
- Share boards with other users
- Invite new members to boards
- View current board members and their roles
- Remove board members (with confirmation)

### Safety Rules
1. **ALWAYS preview before creating** - show item details using the action-preview format:
\`\`\`action-preview
{
  "platform": "Miro",
  "action": "Create Sticky Note",
  "content": "Note text preview...",
  "boardName": "Target board",
  "toolName": "composio_MIRO_CREATE_STICKY_NOTE",
  "toolParams": { "content": "...", "position": { "x": 0, "y": 0 } }
}
\`\`\`
2. **Confirm board selection** - verify the target board before adding items
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For bulk operations**, confirm the scope and target board before proceeding
5. **Preserve existing content** - warn before operations that could affect existing board items
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getMiroCapabilitySummary(): string {
  const stats = getMiroActionStats();
  return `Miro (${stats.total} actions: boards, items, frames, widgets, sharing)`;
}

export function logMiroToolkitStats(): void {
  const stats = getMiroActionStats();
  log.info('Miro Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
