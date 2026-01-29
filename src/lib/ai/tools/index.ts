/**
 * CHAT TOOLS INDEX
 *
 * Unified exports for all chat-level tools.
 * These tools extend the main chat with capabilities from Deep Strategy agent.
 *
 * Tools available:
 * - web_search: Search the web (Brave Search)
 * - fetch_url: Fetch and extract content from URLs
 * - run_code: Execute Python/JavaScript in E2B sandbox
 * - analyze_image: Vision analysis with Claude
 * - browser_visit: Full browser via Puppeteer
 * - extract_pdf_url: Extract text from PDF URLs
 * - extract_table: Vision-based table extraction
 * - parallel_research: Mini-agent orchestrator (5-10 agents max)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

export type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TOOL IMPORTS
// ============================================================================

// Web Search (existing)
export { webSearchTool, executeWebSearch, isWebSearchAvailable } from './web-search';

// URL Fetcher
export { fetchUrlTool, executeFetchUrl, isFetchUrlAvailable } from './fetch-url';

// Code Execution
export {
  runCodeTool,
  executeRunCode,
  isRunCodeAvailable,
  cleanupCodeSandbox,
} from './run-code';

// Vision Analysis
export {
  visionAnalyzeTool,
  executeVisionAnalyze,
  isVisionAnalyzeAvailable,
  analyzeConversationImage,
} from './vision-analyze';

// Browser Visit
export {
  browserVisitTool,
  executeBrowserVisitTool,
  isBrowserVisitAvailable,
  cleanupBrowserSandbox,
} from './browser-visit';

// PDF Extraction
export { extractPdfTool, executeExtractPdf, isExtractPdfAvailable } from './extract-pdf';

// Table Extraction
export {
  extractTableTool,
  executeExtractTable,
  isExtractTableAvailable,
} from './extract-table';

// Mini-Agent Orchestrator
export { miniAgentTool, executeMiniAgent, isMiniAgentAvailable } from './mini-agent';

// Quality Control
export {
  verifyCodeOutput,
  verifyResearchSynthesis,
  verifyTableExtraction,
  verifyOutput,
  shouldRunQC,
  QC_COST,
  QC_TRIGGERS,
  type QCResult,
} from './quality-control';

// Safety (re-exported from strategy)
export {
  // Blocked lists
  BLOCKED_TLDS,
  BLOCKED_DOMAINS,
  BLOCKED_URL_PATTERNS,
  ADULT_KEYWORDS,
  BLOCKED_FORM_ACTIONS,
  ALLOWED_FORM_TYPES,
  BLOCKED_INPUT_TYPES,
  BLOCKED_INPUT_PATTERNS,
  TRUSTED_DOMAINS,
  CONTENT_WARNING_KEYWORDS,
  // Rate limits
  RATE_LIMITS,
  // Types
  type SafetyCheckResult,
  // Safety check functions
  isUrlSafe,
  isFormActionSafe,
  isInputSafe,
  isDomainTrusted,
  sanitizeOutput,
  checkContentForWarnings,
  // Session tracking
  getSessionTracker,
  canVisitPage,
  recordPageVisit,
  canSubmitForm,
  recordFormSubmission,
  getBlockedAttempts,
  cleanupSessionTracker,
  stopSessionCleanupInterval,
  // Logging
  logRiskyAction,
  logBlockedAction,
  // AI prompts
  AI_SAFETY_PROMPT,
  getCondensedSafetyPrompt,
  // Chat-specific
  CHAT_COST_LIMITS,
  getChatSessionCosts,
  canExecuteTool,
  recordToolCost,
  getSessionCostSummary,
  clearSessionCosts,
} from './safety';

// ============================================================================
// TOOL REGISTRY
// ============================================================================

/**
 * All chat tools with their executors
 */
export const CHAT_TOOLS: {
  tool: UnifiedTool;
  executor: (call: UnifiedToolCall) => Promise<UnifiedToolResult>;
  checkAvailability: () => boolean | Promise<boolean>;
}[] = [];

// Lazy initialization to avoid circular dependencies
let toolsInitialized = false;

async function initializeTools() {
  if (toolsInitialized) return;

  const { webSearchTool, executeWebSearch, isWebSearchAvailable } = await import('./web-search');
  const { fetchUrlTool, executeFetchUrl, isFetchUrlAvailable } = await import('./fetch-url');
  const { runCodeTool, executeRunCode, isRunCodeAvailable } = await import('./run-code');
  const { visionAnalyzeTool, executeVisionAnalyze, isVisionAnalyzeAvailable } = await import(
    './vision-analyze'
  );
  const { browserVisitTool, executeBrowserVisitTool, isBrowserVisitAvailable } = await import(
    './browser-visit'
  );
  const { extractPdfTool, executeExtractPdf, isExtractPdfAvailable } = await import(
    './extract-pdf'
  );
  const { extractTableTool, executeExtractTable, isExtractTableAvailable } = await import(
    './extract-table'
  );
  const { miniAgentTool, executeMiniAgent, isMiniAgentAvailable } = await import('./mini-agent');

  CHAT_TOOLS.push(
    { tool: webSearchTool, executor: executeWebSearch, checkAvailability: isWebSearchAvailable },
    { tool: fetchUrlTool, executor: executeFetchUrl, checkAvailability: isFetchUrlAvailable },
    {
      tool: runCodeTool,
      executor: executeRunCode,
      checkAvailability: isRunCodeAvailable,
    },
    {
      tool: visionAnalyzeTool,
      executor: executeVisionAnalyze,
      checkAvailability: isVisionAnalyzeAvailable,
    },
    {
      tool: browserVisitTool,
      executor: executeBrowserVisitTool,
      checkAvailability: isBrowserVisitAvailable,
    },
    {
      tool: extractPdfTool,
      executor: executeExtractPdf,
      checkAvailability: isExtractPdfAvailable,
    },
    {
      tool: extractTableTool,
      executor: executeExtractTable,
      checkAvailability: isExtractTableAvailable,
    },
    { tool: miniAgentTool, executor: executeMiniAgent, checkAvailability: isMiniAgentAvailable }
  );

  toolsInitialized = true;
}

/**
 * Get all available chat tools
 */
export async function getAvailableChatTools(): Promise<UnifiedTool[]> {
  await initializeTools();

  const available: UnifiedTool[] = [];

  for (const { tool, checkAvailability } of CHAT_TOOLS) {
    const isAvailable = await checkAvailability();
    if (isAvailable) {
      available.push(tool);
    }
  }

  return available;
}

/**
 * Execute a tool by name
 */
export async function executeChatTool(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  await initializeTools();

  const toolEntry = CHAT_TOOLS.find((t) => t.tool.name === toolCall.name);

  if (!toolEntry) {
    return {
      toolCallId: toolCall.id,
      content: `Unknown tool: ${toolCall.name}`,
      isError: true,
    };
  }

  // Check availability
  const isAvailable = await toolEntry.checkAvailability();
  if (!isAvailable) {
    return {
      toolCallId: toolCall.id,
      content: `Tool ${toolCall.name} is not currently available. Required services may not be configured.`,
      isError: true,
    };
  }

  // Execute
  return toolEntry.executor(toolCall);
}

/**
 * Get tool definitions for Claude API
 */
export async function getChatToolDefinitions(): Promise<UnifiedTool[]> {
  return getAvailableChatTools();
}

/**
 * Legacy export for backward compatibility
 */
export function getAvailableTools(): UnifiedTool[] {
  // Synchronous version - only returns web_search
  // Use getAvailableChatTools() for full async version
  const { webSearchTool, isWebSearchAvailable } = require('./web-search');
  return isWebSearchAvailable() ? [webSearchTool] : [];
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Cleanup all sandbox resources
 * Call this when the application shuts down
 */
export async function cleanupAllSandboxes(): Promise<void> {
  const { cleanupCodeSandbox } = await import('./run-code');
  const { cleanupBrowserSandbox } = await import('./browser-visit');

  await Promise.all([cleanupCodeSandbox(), cleanupBrowserSandbox()]);
}
