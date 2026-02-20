/**
 * COMPOSIO GOOGLE SLIDES TOOLKIT
 * ================================
 *
 * Comprehensive Google Slides integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Presentations (create, get, batch update)
 * - Slides (create, list, get, update, delete, duplicate, move, speaker notes)
 * - Elements (text, images, shapes, tables, videos, replace)
 * - Formatting (text style, shape properties, page properties)
 * - Collaboration (sharing, permissions)
 */

import { logger } from '@/lib/logger';

const log = logger('GoogleSlidesToolkit');

// ============================================================================
// GOOGLE SLIDES ACTION CATEGORIES
// ============================================================================

export type GoogleSlidesActionCategory =
  | 'presentations'
  | 'slides'
  | 'elements'
  | 'formatting'
  | 'collaboration';

export interface GoogleSlidesAction {
  name: string; // Composio action name (e.g., GOOGLESLIDES_CREATE_PRESENTATION)
  label: string; // Human-readable label
  category: GoogleSlidesActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Google Slides connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GoogleSlidesAction[] = [
  // Presentations
  {
    name: 'GOOGLESLIDES_CREATE_PRESENTATION',
    label: 'Create Presentation',
    category: 'presentations',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLESLIDES_GET_PRESENTATION',
    label: 'Get Presentation',
    category: 'presentations',
    priority: 1,
  },

  // Slides
  {
    name: 'GOOGLESLIDES_LIST_SLIDES',
    label: 'List Slides',
    category: 'slides',
    priority: 1,
  },
  {
    name: 'GOOGLESLIDES_CREATE_SLIDE',
    label: 'Create Slide',
    category: 'slides',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'GOOGLESLIDES_GET_SLIDE',
    label: 'Get Slide',
    category: 'slides',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GoogleSlidesAction[] = [
  // Slides - Extended
  {
    name: 'GOOGLESLIDES_UPDATE_SLIDE',
    label: 'Update Slide',
    category: 'slides',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLESLIDES_DELETE_SLIDE',
    label: 'Delete Slide',
    category: 'slides',
    priority: 2,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLESLIDES_DUPLICATE_SLIDE',
    label: 'Duplicate Slide',
    category: 'slides',
    priority: 2,
    writeOperation: true,
  },

  // Elements
  {
    name: 'GOOGLESLIDES_ADD_TEXT',
    label: 'Add Text',
    category: 'elements',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLESLIDES_ADD_IMAGE',
    label: 'Add Image',
    category: 'elements',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLESLIDES_ADD_SHAPE',
    label: 'Add Shape',
    category: 'elements',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'GOOGLESLIDES_ADD_TABLE',
    label: 'Add Table',
    category: 'elements',
    priority: 2,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GoogleSlidesAction[] = [
  // Formatting
  {
    name: 'GOOGLESLIDES_UPDATE_TEXT_STYLE',
    label: 'Update Text Style',
    category: 'formatting',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLESLIDES_UPDATE_SHAPE_PROPERTIES',
    label: 'Update Shape Properties',
    category: 'formatting',
    priority: 3,
    writeOperation: true,
  },

  // Elements - Extended
  {
    name: 'GOOGLESLIDES_REPLACE_ALL_TEXT',
    label: 'Replace All Text',
    category: 'elements',
    priority: 3,
    writeOperation: true,
  },

  // Slides - Extended
  {
    name: 'GOOGLESLIDES_MOVE_SLIDE',
    label: 'Move Slide',
    category: 'slides',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'GOOGLESLIDES_ADD_SPEAKER_NOTES',
    label: 'Add Speaker Notes',
    category: 'slides',
    priority: 3,
    writeOperation: true,
  },

  // Presentations - Extended
  {
    name: 'GOOGLESLIDES_BATCH_UPDATE',
    label: 'Batch Update',
    category: 'presentations',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive or specialized operations)
// ============================================================================

const ADVANCED_ACTIONS: GoogleSlidesAction[] = [
  {
    name: 'GOOGLESLIDES_DELETE_ELEMENT',
    label: 'Delete Element',
    category: 'elements',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'GOOGLESLIDES_CREATE_VIDEO',
    label: 'Create Video',
    category: 'elements',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GOOGLESLIDES_UPDATE_PAGE_PROPERTIES',
    label: 'Update Page Properties',
    category: 'formatting',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'GOOGLESLIDES_REPLACE_ALL_SHAPES_WITH_IMAGE',
    label: 'Replace All Shapes With Image',
    category: 'elements',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GOOGLE_SLIDES_ACTIONS: GoogleSlidesAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGoogleSlidesFeaturedActionNames(): string[] {
  return ALL_GOOGLE_SLIDES_ACTIONS.map((a) => a.name);
}

export function getGoogleSlidesActionsByPriority(maxPriority: number = 3): GoogleSlidesAction[] {
  return ALL_GOOGLE_SLIDES_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGoogleSlidesActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGoogleSlidesActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGoogleSlidesActionsByCategory(
  category: GoogleSlidesActionCategory
): GoogleSlidesAction[] {
  return ALL_GOOGLE_SLIDES_ACTIONS.filter((a) => a.category === category);
}

export function getGoogleSlidesActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GOOGLE_SLIDES_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGoogleSlidesAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_SLIDES_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGoogleSlidesAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_SLIDES_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Google Slides action priority.
 * Known Google Slides actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGoogleSlidesPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGoogleSlidesActionPriority(a.name) - getGoogleSlidesActionPriority(b.name);
  });
}

export function getGoogleSlidesActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GOOGLE_SLIDES_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GOOGLE_SLIDES_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Google Slides-specific system prompt when user has Google Slides connected.
 * Tells Claude exactly what it can do via the Composio Google Slides toolkit.
 */
export function getGoogleSlidesSystemPrompt(): string {
  return `
## Google Slides Integration (Full Capabilities)

You have **full Google Slides access** through the user's connected account. Use the \`composio_GOOGLESLIDES_*\` tools.

### Presentations
- Create new presentations with a title
- Retrieve presentation details (metadata, slides, layouts)
- Perform batch updates for complex multi-step operations

### Slide Management
- List all slides in a presentation
- Create new slides with predefined or custom layouts
- Get details of a specific slide (elements, properties, notes)
- Update slide content and layout
- Duplicate existing slides for reuse
- Reorder slides by moving them to new positions
- Add speaker notes to slides for presenter guidance
- Delete slides that are no longer needed

### Adding Content (Elements)
- Add text boxes with custom content and positioning
- Insert images from URLs or Google Drive
- Add shapes (rectangles, circles, arrows, callouts, etc.)
- Create tables with specified rows and columns
- Embed videos from YouTube or Google Drive
- Replace all occurrences of text across the entire presentation
- Replace all matching shapes with an image for template-based workflows

### Formatting & Styling
- Update text style (font, size, color, bold, italic, underline)
- Modify shape properties (fill color, border, shadow, size, position)
- Update page-level properties (background color, transitions)

### Safety Rules
1. **ALWAYS confirm before deleting slides** - show slide number, title/content preview, and presentation name:
\`\`\`action-preview
{
  "platform": "Google Slides",
  "action": "Delete Slide",
  "presentationId": "...",
  "slideIndex": ...,
  "toolName": "composio_GOOGLESLIDES_DELETE_SLIDE",
  "toolParams": { "presentationId": "...", "slideObjectId": "..." }
}
\`\`\`
2. **Confirm before deleting elements** - show element type, content preview, and which slide it belongs to
3. **For batch updates**, summarize all changes that will be made and get explicit approval
4. **For replace-all operations** (text or shapes), show what will be matched and replaced across the presentation
5. **When creating presentations**, confirm the title and initial structure before proceeding
6. **When adding content**, describe positioning and dimensions so the user knows where elements will appear
7. **For formatting changes**, describe the style changes before applying them
8. **Handle presentation data carefully** - always verify the correct presentation ID before making modifications
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGoogleSlidesCapabilitySummary(): string {
  const stats = getGoogleSlidesActionStats();
  return `Google Slides (${stats.total} actions: presentations, slides, elements, formatting, collaboration)`;
}

export function logGoogleSlidesToolkitStats(): void {
  const stats = getGoogleSlidesActionStats();
  log.info('Google Slides Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
