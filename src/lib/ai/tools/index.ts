/**
 * AI TOOLS INDEX
 *
 * Exports all available tools for Claude native tool use
 */

export {
  webSearchTool,
  executeWebSearch,
  isWebSearchAvailable,
  getAvailableTools,
} from './web-search';

export type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
