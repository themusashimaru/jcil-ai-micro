/**
 * COMPOSIO PERPLEXITY AI TOOLKIT
 * ===============================
 *
 * Perplexity AI integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Search (web search, citations, questions)
 * - Chat (completions, models, streaming)
 * - Research (topics, summaries, comparisons, fact-checking)
 */

import { logger } from '@/lib/logger';

const log = logger('PerplexityAIToolkit');

// ============================================================================
// PERPLEXITY AI ACTION CATEGORIES
// ============================================================================

export type PerplexityAIActionCategory = 'search' | 'chat' | 'research';

export interface PerplexityAIAction {
  name: string; // Composio action name (e.g., PERPLEXITYAI_SEARCH)
  label: string; // Human-readable label
  category: PerplexityAIActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Perplexity AI connected)
// ============================================================================

const ESSENTIAL_ACTIONS: PerplexityAIAction[] = [
  // Search
  {
    name: 'PERPLEXITYAI_SEARCH',
    label: 'Search',
    category: 'search',
    priority: 1,
  },
  {
    name: 'PERPLEXITYAI_ASK',
    label: 'Ask',
    category: 'search',
    priority: 1,
  },

  // Chat
  {
    name: 'PERPLEXITYAI_CHAT_COMPLETION',
    label: 'Chat Completion',
    category: 'chat',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: PerplexityAIAction[] = [
  // Search - Extended
  {
    name: 'PERPLEXITYAI_SEARCH_WITH_CITATIONS',
    label: 'Search with Citations',
    category: 'search',
    priority: 2,
  },

  // Research
  {
    name: 'PERPLEXITYAI_RESEARCH_TOPIC',
    label: 'Research Topic',
    category: 'research',
    priority: 2,
  },
  {
    name: 'PERPLEXITYAI_SUMMARIZE',
    label: 'Summarize',
    category: 'research',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: PerplexityAIAction[] = [
  // Research - Extended
  {
    name: 'PERPLEXITYAI_COMPARE_TOPICS',
    label: 'Compare Topics',
    category: 'research',
    priority: 3,
  },
  {
    name: 'PERPLEXITYAI_FACT_CHECK',
    label: 'Fact Check',
    category: 'research',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Specialized operations)
// ============================================================================

const ADVANCED_ACTIONS: PerplexityAIAction[] = [
  {
    name: 'PERPLEXITYAI_LIST_MODELS',
    label: 'List Models',
    category: 'chat',
    priority: 4,
  },
  {
    name: 'PERPLEXITYAI_STREAM_COMPLETION',
    label: 'Stream Completion',
    category: 'chat',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_PERPLEXITY_AI_ACTIONS: PerplexityAIAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getPerplexityAIFeaturedActionNames(): string[] {
  return ALL_PERPLEXITY_AI_ACTIONS.map((a) => a.name);
}

export function getPerplexityAIActionsByPriority(maxPriority: number = 3): PerplexityAIAction[] {
  return ALL_PERPLEXITY_AI_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getPerplexityAIActionNamesByPriority(maxPriority: number = 3): string[] {
  return getPerplexityAIActionsByPriority(maxPriority).map((a) => a.name);
}

export function getPerplexityAIActionsByCategory(
  category: PerplexityAIActionCategory
): PerplexityAIAction[] {
  return ALL_PERPLEXITY_AI_ACTIONS.filter((a) => a.category === category);
}

export function getPerplexityAIActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_PERPLEXITY_AI_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownPerplexityAIAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_PERPLEXITY_AI_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructivePerplexityAIAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_PERPLEXITY_AI_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Perplexity AI action priority.
 * Known Perplexity AI actions sorted by priority (1-4), unknown actions last.
 */
export function sortByPerplexityAIPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getPerplexityAIActionPriority(a.name) - getPerplexityAIActionPriority(b.name);
  });
}

export function getPerplexityAIActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_PERPLEXITY_AI_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_PERPLEXITY_AI_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Perplexity AI-specific system prompt when user has Perplexity AI connected.
 * Tells Claude exactly what it can do via the Composio Perplexity AI toolkit.
 */
export function getPerplexityAISystemPrompt(): string {
  return `
## Perplexity AI Integration (Full Capabilities)

You have **full Perplexity AI access** through the user's connected account. Use the \`composio_PERPLEXITYAI_*\` tools.

### Search
- Perform AI-powered web searches with up-to-date information
- Ask natural language questions and get comprehensive answers
- Search with citations to provide source-backed responses

### Chat
- Generate chat completions using Perplexity AI models
- Stream completions for real-time response generation
- List available models to select the best one for the task

### Research
- Research topics in depth with comprehensive analysis
- Summarize content, articles, or complex topics concisely
- Compare multiple topics side-by-side with detailed breakdowns
- Fact-check claims against current web sources

### Safety Rules
1. **All operations are read-only** - Perplexity AI tools query information and generate responses but do not modify external data
2. **No destructive actions** - There are no delete or irreversible operations in this toolkit
3. **Verify critical facts** - When fact-checking or researching, present sources and confidence levels
4. **Cite sources** - When using search with citations, always present the sources to the user
5. **Be transparent about model limitations** - Indicate when information may be outdated or uncertain
6. **For comparisons**, present balanced and objective analysis of all topics
7. **For summaries**, preserve key details and note any omissions
8. **Handle sensitive topics carefully** - flag potentially controversial or disputed claims
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getPerplexityAICapabilitySummary(): string {
  const stats = getPerplexityAIActionStats();
  return `Perplexity AI (${stats.total} actions: search, chat, research, fact-checking, topic comparison)`;
}

export function logPerplexityAIToolkitStats(): void {
  const stats = getPerplexityAIActionStats();
  log.info('Perplexity AI Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
