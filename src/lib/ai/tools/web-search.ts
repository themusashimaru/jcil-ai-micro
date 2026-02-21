/**
 * WEB SEARCH TOOL - Native Anthropic Server Tool
 *
 * Uses Anthropic's native web_search_20260209 server tool with dynamic filtering.
 * The search is executed server-side by Anthropic — we never handle it ourselves.
 * Dynamic filtering (Sonnet 4.6+ / Opus 4.6) writes code to filter results before
 * they enter the context window: 11% more accurate, 24% fewer tokens.
 *
 * When this tool is active, the chat route auto-escalates to Sonnet 4.6
 * to ensure dynamic filtering is available.
 *
 * Cost: $10 per 1,000 searches ($0.01/search) + standard token costs.
 */

import { logger } from '@/lib/logger';

const log = logger('WebSearchTool');

// ============================================================================
// NATIVE WEB SEARCH TOOL (Anthropic Server Tool)
// ============================================================================

/**
 * Sentinel name used to identify the native web search tool in the tools array.
 * The Anthropic adapter detects this and converts it to the native format.
 */
export const NATIVE_WEB_SEARCH_SENTINEL = '__native_web_search__';

/**
 * Native web search tool configuration.
 * This is NOT a custom tool — it's a server tool handled by Anthropic.
 * The Anthropic adapter converts this into the proper API format:
 * { type: "web_search_20260209", name: "web_search", max_uses: 5 }
 */
export const webSearchTool = {
  name: NATIVE_WEB_SEARCH_SENTINEL,
  description: 'Native Anthropic web search with dynamic filtering (server-side)',
  parameters: {
    type: 'object' as const,
    properties: {},
    required: [] as string[],
  },
  // Metadata for the Anthropic adapter
  _nativeWebSearch: true,
  _nativeConfig: {
    type: 'web_search_20260209' as const,
    name: 'web_search',
    max_uses: 5,
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

/**
 * Web search is always available — it's a native Anthropic capability.
 * No external API keys required.
 */
export function isWebSearchAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR (NO-OP — handled by Anthropic server)
// ============================================================================

/**
 * The native web search tool is executed server-side by Anthropic.
 * If this function is ever called, something went wrong in the routing.
 */
export async function executeWebSearch(toolCall: { id: string; name: string }): Promise<{
  toolCallId: string;
  content: string;
  isError: boolean;
}> {
  log.warn('executeWebSearch called but native search is server-side', {
    toolCallId: toolCall.id,
    toolName: toolCall.name,
  });
  return {
    toolCallId: toolCall.id,
    content: 'Web search is handled natively by the AI model. No manual execution needed.',
    isError: false,
  };
}

/**
 * Check if a tool name is the native web search tool (server-side).
 * Used by the tool executor to skip execution for server-handled tools.
 */
export function isNativeServerTool(toolName: string): boolean {
  return toolName === 'web_search' || toolName === NATIVE_WEB_SEARCH_SENTINEL;
}
