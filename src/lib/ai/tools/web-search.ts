/**
 * WEB SEARCH TOOL - Native Claude Tool Use
 *
 * Defines the web_search tool that Claude can call when it needs
 * current information. Uses Brave Search under the hood.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { search as braveSearch, isBraveConfigured } from '@/lib/brave';
import { logger } from '@/lib/logger';

const log = logger('WebSearchTool');

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * Web search tool definition for Claude
 * Claude will call this when it needs current/real-time information
 */
export const webSearchTool: UnifiedTool = {
  name: 'web_search',
  description: `Search the web for current information. Use this tool when you need:
- Current news, events, or recent developments
- Real-time data like stock prices, weather, sports scores
- Information that may have changed since your training data
- Facts you want to verify with current sources
- Information about recent events (2024-2026)

Always use this tool rather than saying "I don't have access to real-time information."`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query. Be specific and include relevant context.',
      },
      search_type: {
        type: 'string',
        description: 'Type of search to optimize results',
        enum: ['general', 'news', 'factcheck'],
        default: 'general',
      },
    },
    required: ['query'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

/**
 * Execute the web_search tool
 * Called when Claude uses the web_search tool
 */
export async function executeWebSearch(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'web_search') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  // Handle case where arguments might still be a string (should be parsed by now, but defensive)
  const args = typeof rawArgs === 'string' ? {} : rawArgs;
  const query = args.query as string;
  const searchType = (args.search_type as string) || 'general';

  if (!query) {
    return {
      toolCallId: id,
      content: 'No search query provided',
      isError: true,
    };
  }

  if (!isBraveConfigured()) {
    log.warn('Brave Search not configured, returning error');
    return {
      toolCallId: id,
      content: 'Web search is not currently available.',
      isError: true,
    };
  }

  log.info('Executing web search', { query, searchType });

  try {
    // Map search type to Brave mode
    const mode =
      searchType === 'factcheck' ? 'factcheck' : searchType === 'news' ? 'news' : 'search';

    const result = await braveSearch({
      query,
      mode,
    });

    // Format result for Claude
    let content = result.answer;

    // Add sources if available
    if (result.sources && result.sources.length > 0) {
      content += '\n\n**Sources:**\n';
      result.sources.slice(0, 5).forEach((source, i) => {
        content += `${i + 1}. [${source.title}](${source.url})\n`;
      });
    }

    log.info('Web search completed', {
      query,
      resultLength: content.length,
      sourceCount: result.sources?.length || 0,
    });

    return {
      toolCallId: id,
      content,
      isError: false,
    };
  } catch (error) {
    log.error('Web search failed', { query, error: (error as Error).message });
    return {
      toolCallId: id,
      content: `Search failed: ${(error as Error).message}`,
      isError: true,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if web search tool is available
 */
export function isWebSearchAvailable(): boolean {
  return isBraveConfigured();
}

/**
 * Get all available tools (currently just web_search)
 */
export function getAvailableTools(): UnifiedTool[] {
  const tools: UnifiedTool[] = [];

  if (isWebSearchAvailable()) {
    tools.push(webSearchTool);
  }

  return tools;
}
