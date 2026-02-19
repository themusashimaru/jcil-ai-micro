/**
 * COMPOSIO LINKEDIN TOOLKIT
 * =========================
 *
 * Comprehensive LinkedIn integration via Composio's 11 tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Posts (create, comment, delete posts)
 * - Profile (user info, company info)
 * - Media (images, videos, uploads)
 */

import { logger } from '@/lib/logger';

const log = logger('LinkedInToolkit');

// ============================================================================
// LINKEDIN ACTION CATEGORIES
// ============================================================================

export type LinkedInActionCategory = 'posts' | 'profile' | 'media';

export interface LinkedInAction {
  name: string; // Composio action name (e.g., LINKEDIN_CREATE_LINKED_IN_POST)
  label: string; // Human-readable label
  category: LinkedInActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when LinkedIn connected)
// ============================================================================

const ESSENTIAL_ACTIONS: LinkedInAction[] = [
  // Posts - Core
  {
    name: 'LINKEDIN_CREATE_LINKED_IN_POST',
    label: 'Create Post',
    category: 'posts',
    priority: 1,
    writeOperation: true,
  },

  // Profile - Core
  { name: 'LINKEDIN_GET_MY_INFO', label: 'Get My Profile', category: 'profile', priority: 1 },
  {
    name: 'LINKEDIN_GET_COMPANY_INFO',
    label: 'Get Company Info',
    category: 'profile',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: LinkedInAction[] = [
  // Posts - Extended
  {
    name: 'LINKEDIN_CREATE_COMMENT_ON_POST',
    label: 'Comment on Post',
    category: 'posts',
    priority: 2,
    writeOperation: true,
  },

  // Media
  {
    name: 'LINKEDIN_REGISTER_IMAGE_UPLOAD',
    label: 'Register Image Upload',
    category: 'media',
    priority: 2,
    writeOperation: true,
  },
  { name: 'LINKEDIN_GET_IMAGES', label: 'Get Images', category: 'media', priority: 2 },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: LinkedInAction[] = [
  // Media - Extended
  { name: 'LINKEDIN_GET_VIDEO', label: 'Get Video', category: 'media', priority: 3 },
  { name: 'LINKEDIN_GET_VIDEOS', label: 'Get Videos', category: 'media', priority: 3 },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive post operations)
// ============================================================================

const ADVANCED_ACTIONS: LinkedInAction[] = [
  {
    name: 'LINKEDIN_DELETE_LINKED_IN_POST',
    label: 'Delete Post',
    category: 'posts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'LINKEDIN_DELETE_UGC_POST',
    label: 'Delete UGC Post',
    category: 'posts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'LINKEDIN_DELETE_UGC_POSTS',
    label: 'Delete UGC Posts',
    category: 'posts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_LINKEDIN_ACTIONS: LinkedInAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getLinkedInFeaturedActionNames(): string[] {
  return ALL_LINKEDIN_ACTIONS.map((a) => a.name);
}

export function getLinkedInActionsByPriority(maxPriority: number = 3): LinkedInAction[] {
  return ALL_LINKEDIN_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getLinkedInActionNamesByPriority(maxPriority: number = 3): string[] {
  return getLinkedInActionsByPriority(maxPriority).map((a) => a.name);
}

export function getLinkedInActionsByCategory(category: LinkedInActionCategory): LinkedInAction[] {
  return ALL_LINKEDIN_ACTIONS.filter((a) => a.category === category);
}

export function getLinkedInActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_LINKEDIN_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownLinkedInAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_LINKEDIN_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveLinkedInAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_LINKEDIN_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by LinkedIn action priority.
 * Known LinkedIn actions sorted by priority (1-4), unknown actions last.
 */
export function sortByLinkedInPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getLinkedInActionPriority(a.name) - getLinkedInActionPriority(b.name);
  });
}

export function getLinkedInActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_LINKEDIN_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_LINKEDIN_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate LinkedIn-specific system prompt when user has LinkedIn connected.
 * Tells Claude exactly what it can do via the Composio LinkedIn toolkit.
 */
export function getLinkedInSystemPrompt(): string {
  return `
## LinkedIn Integration (Full Capabilities)

You have **full LinkedIn access** through the user's connected account. Use the \`composio_LINKEDIN_*\` tools.

### Posts & Engagement
- Create LinkedIn posts with text content
- Comment on existing posts
- Delete posts (standard posts and UGC posts)

### Profile & Company
- Get your own profile information (name, headline, connections, etc.)
- Look up company information by company ID

### Media
- Register image uploads for use in posts
- Retrieve uploaded images
- Get video details (single or multiple)

### Safety Rules
1. **ALWAYS preview posts before publishing** using the action-preview format:
\`\`\`action-preview
{
  "platform": "LinkedIn",
  "action": "Create Post",
  "content": "Post content preview...",
  "toolName": "composio_LINKEDIN_CREATE_LINKED_IN_POST",
  "toolParams": { "text": "..." }
}
\`\`\`
2. **Confirm recipient audience** - ensure the user knows who will see the post before publishing
3. **Never publish posts without explicit user confirmation** - always wait for Send button click
4. **For comments**, show the post being commented on and the comment text before submitting
5. **For delete operations**, clearly state which post will be deleted and get explicit approval
6. **Handle sensitive content carefully** - flag if post appears to contain confidential business information or PII
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getLinkedInCapabilitySummary(): string {
  const stats = getLinkedInActionStats();
  return `LinkedIn (${stats.total} actions: posts, profile, company info, media, comments)`;
}

export function logLinkedInToolkitStats(): void {
  const stats = getLinkedInActionStats();
  log.info('LinkedIn Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
