/**
 * CHAT TOOLS INDEX
 *
 * Unified exports for all chat-level tools.
 * These tools extend the main chat with capabilities from Deep Strategy agent.
 *
 * Tools available (22 total):
 * - web_search: Search the web (Brave Search)
 * - fetch_url: Fetch and extract content from URLs
 * - run_code: Execute Python/JavaScript in E2B sandbox
 * - analyze_image: Vision analysis with Claude
 * - browser_visit: Full browser via Puppeteer
 * - extract_pdf_url: Extract text from PDF URLs
 * - extract_table: Vision-based table extraction
 * - parallel_research: Mini-agent orchestrator (5-10 agents max)
 * - create_and_run_tool: Dynamic tool creation (cost-limited)
 * - youtube_transcript: Extract transcripts from YouTube videos
 * - github: Search and browse GitHub repos, code, issues
 * - screenshot: Capture screenshots of any webpage
 * - calculator: Advanced math with Wolfram Alpha
 * - create_chart: Generate charts and data visualizations
 * - create_document: Generate PDF, DOCX, TXT documents
 * - transcribe_audio: Transcribe audio files with Whisper
 * - create_spreadsheet: Generate Excel files with formulas (ExcelJS)
 * - http_request: Make HTTP requests to APIs and webhooks
 * - generate_qr_code: Create QR codes from text/URLs
 * - transform_image: Resize, compress, convert, watermark images
 * - convert_file: Convert between file formats
 * - shorten_link: Create shortened URLs
 *
 * Workflow utilities:
 * - Workflow tasks: Claude Code style todo lists with borders
 *
 * Last updated: 2026-01-31 12:00 PM UTC
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
export { runCodeTool, executeRunCode, isRunCodeAvailable, cleanupCodeSandbox } from './run-code';

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
export { extractTableTool, executeExtractTable, isExtractTableAvailable } from './extract-table';

// Mini-Agent Orchestrator
export { miniAgentTool, executeMiniAgent, isMiniAgentAvailable } from './mini-agent';

// Dynamic Tool Creation
export {
  dynamicToolTool,
  executeDynamicTool,
  isDynamicToolAvailable,
  getDynamicToolSessionInfo,
  DYNAMIC_TOOL_LIMITS,
} from './dynamic-tool';

// YouTube Transcript
export {
  youtubeTranscriptTool,
  executeYouTubeTranscript,
  isYouTubeTranscriptAvailable,
} from './youtube-transcript';

// GitHub Tool
export { githubTool, executeGitHub, isGitHubAvailable } from './github-tool';

// Screenshot Tool
export { screenshotTool, executeScreenshot, isScreenshotAvailable } from './screenshot-tool';

// Calculator/Math Tool
export { calculatorTool, executeCalculator, isCalculatorAvailable } from './calculator-tool';

// Chart/Data Visualization Tool
export { chartTool, executeChart, isChartAvailable } from './chart-tool';

// Document Generation Tool
export { documentTool, executeDocument, isDocumentAvailable } from './document-tool';

// Audio Transcription (Whisper)
export {
  audioTranscribeTool,
  executeAudioTranscribe,
  isAudioTranscribeAvailable,
} from './audio-transcribe';

// Spreadsheet Generation (Excel)
export { spreadsheetTool, executeSpreadsheet, isSpreadsheetAvailable } from './spreadsheet-tool';

// HTTP Request (API calls, webhooks)
export { httpRequestTool, executeHttpRequest, isHttpRequestAvailable } from './http-request-tool';

// QR Code Generation
export { qrCodeTool, executeQRCode, isQRCodeAvailable } from './qr-code-tool';

// Image Transform (resize, compress, convert, watermark)
export {
  imageTransformTool,
  executeImageTransform,
  isImageTransformAvailable,
} from './image-transform-tool';

// File Conversion (format conversion)
export { fileConvertTool, executeFileConvert, isFileConvertAvailable } from './file-convert-tool';

// Link Shortening
export { linkShortenTool, executeLinkShorten, isLinkShortenAvailable } from './link-shorten-tool';

// Workflow Tasks (Claude Code style todo lists)
export {
  // Types
  type TaskStatus,
  type WorkflowTask,
  type Workflow,
  // Workflow management
  createWorkflow,
  getWorkflow,
  updateTaskStatus,
  startNextTask,
  completeCurrentTask,
  deleteWorkflow,
  clearAllWorkflows,
  // Formatting (Claude Code style with borders)
  formatWorkflow,
  formatTaskList,
  formatTaskUpdate,
  formatWorkflowProgress,
  formatProgressLine,
  formatStatusUpdate,
  // Streaming helpers
  createWorkflowChunk,
  containsWorkflowChunk,
  extractWorkflowFromChunk,
} from './workflow-tasks';

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
  const { dynamicToolTool, executeDynamicTool, isDynamicToolAvailable } = await import(
    './dynamic-tool'
  );
  const { youtubeTranscriptTool, executeYouTubeTranscript, isYouTubeTranscriptAvailable } =
    await import('./youtube-transcript');
  const { githubTool, executeGitHub, isGitHubAvailable } = await import('./github-tool');
  const { screenshotTool, executeScreenshot, isScreenshotAvailable } = await import(
    './screenshot-tool'
  );
  const { calculatorTool, executeCalculator, isCalculatorAvailable } = await import(
    './calculator-tool'
  );
  const { chartTool, executeChart, isChartAvailable } = await import('./chart-tool');
  const { documentTool, executeDocument, isDocumentAvailable } = await import('./document-tool');
  const { audioTranscribeTool, executeAudioTranscribe, isAudioTranscribeAvailable } = await import(
    './audio-transcribe'
  );
  const { spreadsheetTool, executeSpreadsheet, isSpreadsheetAvailable } = await import(
    './spreadsheet-tool'
  );
  const { httpRequestTool, executeHttpRequest, isHttpRequestAvailable } = await import(
    './http-request-tool'
  );
  const { qrCodeTool, executeQRCode, isQRCodeAvailable } = await import('./qr-code-tool');
  const { imageTransformTool, executeImageTransform, isImageTransformAvailable } = await import(
    './image-transform-tool'
  );
  const { fileConvertTool, executeFileConvert, isFileConvertAvailable } = await import(
    './file-convert-tool'
  );
  const { linkShortenTool, executeLinkShorten, isLinkShortenAvailable } = await import(
    './link-shorten-tool'
  );

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
    { tool: miniAgentTool, executor: executeMiniAgent, checkAvailability: isMiniAgentAvailable },
    {
      tool: dynamicToolTool,
      executor: executeDynamicTool,
      checkAvailability: isDynamicToolAvailable,
    },
    {
      tool: youtubeTranscriptTool,
      executor: executeYouTubeTranscript,
      checkAvailability: isYouTubeTranscriptAvailable,
    },
    { tool: githubTool, executor: executeGitHub, checkAvailability: isGitHubAvailable },
    { tool: screenshotTool, executor: executeScreenshot, checkAvailability: isScreenshotAvailable },
    { tool: calculatorTool, executor: executeCalculator, checkAvailability: isCalculatorAvailable },
    { tool: chartTool, executor: executeChart, checkAvailability: isChartAvailable },
    { tool: documentTool, executor: executeDocument, checkAvailability: isDocumentAvailable },
    {
      tool: audioTranscribeTool,
      executor: executeAudioTranscribe,
      checkAvailability: isAudioTranscribeAvailable,
    },
    {
      tool: spreadsheetTool,
      executor: executeSpreadsheet,
      checkAvailability: isSpreadsheetAvailable,
    },
    {
      tool: httpRequestTool,
      executor: executeHttpRequest,
      checkAvailability: isHttpRequestAvailable,
    },
    { tool: qrCodeTool, executor: executeQRCode, checkAvailability: isQRCodeAvailable },
    {
      tool: imageTransformTool,
      executor: executeImageTransform,
      checkAvailability: isImageTransformAvailable,
    },
    {
      tool: fileConvertTool,
      executor: executeFileConvert,
      checkAvailability: isFileConvertAvailable,
    },
    {
      tool: linkShortenTool,
      executor: executeLinkShorten,
      checkAvailability: isLinkShortenAvailable,
    }
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
 * Note: This is async now - callers should use getAvailableChatTools() instead
 */
export async function getAvailableTools(): Promise<UnifiedTool[]> {
  const { webSearchTool, isWebSearchAvailable } = await import('./web-search');
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
