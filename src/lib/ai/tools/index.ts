/**
 * CHAT TOOLS INDEX
 *
 * Unified exports for all chat-level tools.
 * Only tools with real implementations that extend Claude's native capabilities.
 *
 * Last updated: 2026-03-25 (removed 48 redundant tools — document formatters,
 * text analysis, Claude-calling-Claude tools)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

export type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TOOL EXPORTS — Only tools that extend Claude's native capabilities
// ============================================================================

// Web Search (native Anthropic server tool)
import { isNativeServerTool as _isNativeServerTool } from './web-search';
export {
  webSearchTool,
  executeWebSearch,
  isWebSearchAvailable,
  isNativeServerTool,
  NATIVE_WEB_SEARCH_SENTINEL,
} from './web-search';

// URL Fetcher
export { fetchUrlTool, executeFetchUrl, isFetchUrlAvailable } from './fetch-url';

// Code Execution (E2B sandbox)
export { runCodeTool, executeRunCode, isRunCodeAvailable, cleanupCodeSandbox } from './run-code';

// Vision Analysis (Claude)
export {
  visionAnalyzeTool,
  executeVisionAnalyze,
  isVisionAnalyzeAvailable,
  analyzeConversationImage,
} from './vision-analyze';

// Browser Visit (Puppeteer)
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
export {
  githubTool,
  executeGitHub,
  isGitHubAvailable,
  getRepoSummaryForPrompt,
} from './github-tool';

// Chart/Data Visualization
export { chartTool, executeChart, isChartAvailable } from './chart-tool';

// Document Generation
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

// File Conversion
export { fileConvertTool, executeFileConvert, isFileConvertAvailable } from './file-convert-tool';

// Link Shortening
export { linkShortenTool, executeLinkShorten, isLinkShortenAvailable } from './link-shorten-tool';

// Fake Data Generation (Faker.js)
export { fakerTool, executeFaker, isFakerAvailable } from './faker-tool';

// Text Diff Comparison (diff library)
export { diffTool, executeDiff, isDiffAvailable } from './diff-tool';

// Barcode Generation (JsBarcode)
export { barcodeTool, executeBarcode, isBarcodeAvailable } from './barcode-tool';

// OCR - Text extraction from images (Tesseract.js)
export { ocrTool, executeOCR, isOCRAvailable } from './ocr-tool';

// PDF Manipulation (pdf-lib)
export { pdfTool, executePDF, isPDFAvailable } from './pdf-tool';

// Presentation / PowerPoint (pptxgenjs)
export {
  presentationTool,
  executePresentation,
  isPresentationAvailable,
} from './presentation-tool';

// Task Scheduling
export {
  scheduleTaskTool,
  executeScheduleTask,
  isScheduleTaskAvailable,
} from './schedule-task-tool';

// Spawn Agent (parallel sub-agent orchestration)
export {
  spawnAgentTool,
  executeSpawnAgent,
  isSpawnAgentAvailable,
  setSpawnContext,
  clearSpawnContext,
} from './spawn-agent-tool';

// Media Processing (FFmpeg.js)
export { mediaTool, executeMedia, isMediaAvailable } from './media-tool';

// SQL Queries (SQL.js)
export { sqlTool, executeSQL, isSQLAvailable } from './sql-tool';

// Advanced Excel (SheetJS)
export { excelTool, executeExcel, isExcelAvailable } from './excel-tool';

// Code Formatting (Prettier)
export { prettierTool, executePrettier, isPrettierAvailable } from './prettier-tool';

// Cryptography (jose)
export { cryptoTool, executeCryptoTool, isCryptoToolAvailable } from './crypto-tool';

// ZIP Files (JSZip)
export { zipTool, executeZip, isZipAvailable } from './zip-tool';

// Web Capture (Puppeteer)
export { webCaptureTool, executeWebCapture, isWebCaptureAvailable } from './web-capture-tool';

// EXIF/Image Metadata (exifr)
export { exifTool, executeExif, isExifAvailable } from './exif-tool';

// Search Index (Lunr.js)
export { searchIndexTool, executeSearchIndex, isSearchIndexAvailable } from './search-index-tool';

// Data Validation (validator.js)
export { validatorTool, executeValidator, isValidatorAvailable } from './validator-tool';

// Geospatial Calculations (turf.js)
export { geospatialTool, executeGeospatial, isGeospatialAvailable } from './geospatial-tool';

// Phone Validation (libphonenumber-js)
export { phoneTool, executePhone, isPhoneAvailable } from './phone-tool';

// Signal Processing (fft-js)
export { signalTool, executeSignal, isSignalAvailable } from './signal-tool';

// Accessibility Checking
export {
  accessibilityTool,
  executeAccessibility,
  isAccessibilityAvailable,
} from './accessibility-tool';

// Parser / Grammar (nearley)
export { parserTool, executeParser, isParserAvailable } from './parser-tool';

// Constraint Solver (logic-solver)
export { constraintTool, executeConstraint, isConstraintAvailable } from './constraint-tool';

// Graphics 3D
export { graphics3dTool, executeGraphics3D, isGraphics3DAvailable } from './graphics-3d-tool';

// Hough Vision (Computer vision)
export { houghVisionTool, executeHoughVision, isHoughVisionAvailable } from './hough-vision-tool';

// ============================================================================
// PASS-THROUGH MODULES — re-export from safety.ts and QC stubs
// ============================================================================

// Safety/cost control — pass-through implementations in safety.ts
export { canExecuteTool, recordToolCost } from './safety';

// Quality control — simplified pass-through (no real QC module yet)
export function shouldRunQC(_toolName: string): boolean {
  return false;
}

export async function verifyOutput(
  _toolName: string,
  _input: string,
  _output: string
): Promise<{ passed: boolean; issues: string[] }> {
  return { passed: true, issues: [] };
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

/**
 * All chat tools with their executors.
 * Only includes tools with real implementations that extend Claude's native capabilities.
 * 48 redundant tools removed 2026-03-25.
 */
export const CHAT_TOOLS: {
  tool: UnifiedTool;
  executor: (call: UnifiedToolCall) => Promise<UnifiedToolResult>;
  checkAvailability: () => boolean | Promise<boolean>;
}[] = [];

let toolsInitialized = false;

async function initializeTools() {
  if (toolsInitialized) return;

  // Core API tools
  const { webSearchTool, executeWebSearch, isWebSearchAvailable } = await import('./web-search');
  const { fetchUrlTool, executeFetchUrl, isFetchUrlAvailable } = await import('./fetch-url');
  const { runCodeTool, executeRunCode, isRunCodeAvailable } = await import('./run-code');
  const { visionAnalyzeTool, executeVisionAnalyze, isVisionAnalyzeAvailable } =
    await import('./vision-analyze');
  const { browserVisitTool, executeBrowserVisitTool, isBrowserVisitAvailable } =
    await import('./browser-visit');
  const { extractPdfTool, executeExtractPdf, isExtractPdfAvailable } =
    await import('./extract-pdf');
  const { extractTableTool, executeExtractTable, isExtractTableAvailable } =
    await import('./extract-table');
  const { dynamicToolTool, executeDynamicTool, isDynamicToolAvailable } =
    await import('./dynamic-tool');
  const { youtubeTranscriptTool, executeYouTubeTranscript, isYouTubeTranscriptAvailable } =
    await import('./youtube-transcript');
  const { chartTool, executeChart, isChartAvailable } = await import('./chart-tool');
  const { documentTool, executeDocument, isDocumentAvailable } = await import('./document-tool');
  const { audioTranscribeTool, executeAudioTranscribe, isAudioTranscribeAvailable } =
    await import('./audio-transcribe');
  const { spreadsheetTool, executeSpreadsheet, isSpreadsheetAvailable } =
    await import('./spreadsheet-tool');
  const { httpRequestTool, executeHttpRequest, isHttpRequestAvailable } =
    await import('./http-request-tool');
  const { qrCodeTool, executeQRCode, isQRCodeAvailable } = await import('./qr-code-tool');
  const { imageTransformTool, executeImageTransform, isImageTransformAvailable } =
    await import('./image-transform-tool');
  const { fileConvertTool, executeFileConvert, isFileConvertAvailable } =
    await import('./file-convert-tool');
  const { linkShortenTool, executeLinkShorten, isLinkShortenAvailable } =
    await import('./link-shorten-tool');

  // Library-based tools
  const { fakerTool, executeFaker, isFakerAvailable } = await import('./faker-tool');
  const { diffTool, executeDiff, isDiffAvailable } = await import('./diff-tool');
  const { barcodeTool, executeBarcode, isBarcodeAvailable } = await import('./barcode-tool');
  const { ocrTool, executeOCR, isOCRAvailable } = await import('./ocr-tool');
  const { pdfTool, executePDF, isPDFAvailable } = await import('./pdf-tool');
  const { mediaTool, executeMedia, isMediaAvailable } = await import('./media-tool');
  const { sqlTool, executeSQL, isSQLAvailable } = await import('./sql-tool');
  const { excelTool, executeExcel, isExcelAvailable } = await import('./excel-tool');
  const { prettierTool, executePrettier, isPrettierAvailable } = await import('./prettier-tool');
  const { cryptoTool, executeCryptoTool, isCryptoToolAvailable } = await import('./crypto-tool');
  const { zipTool, executeZip, isZipAvailable } = await import('./zip-tool');
  const { webCaptureTool, executeWebCapture, isWebCaptureAvailable } =
    await import('./web-capture-tool');
  const { exifTool, executeExif, isExifAvailable } = await import('./exif-tool');
  const { searchIndexTool, executeSearchIndex, isSearchIndexAvailable } =
    await import('./search-index-tool');
  const { validatorTool, executeValidator, isValidatorAvailable } =
    await import('./validator-tool');

  // Scientific & research tools
  const { geospatialTool, executeGeospatial, isGeospatialAvailable } =
    await import('./geospatial-tool');
  const { phoneTool, executePhone, isPhoneAvailable } = await import('./phone-tool');
  const { signalTool, executeSignal, isSignalAvailable } = await import('./signal-tool');
  const { accessibilityTool, executeAccessibility, isAccessibilityAvailable } =
    await import('./accessibility-tool');
  const { parserTool, executeParser, isParserAvailable } = await import('./parser-tool');
  const { constraintTool, executeConstraint, isConstraintAvailable } =
    await import('./constraint-tool');
  const { graphics3dTool, executeGraphics3D, isGraphics3DAvailable } =
    await import('./graphics-3d-tool');
  const { houghVisionTool, executeHoughVision, isHoughVisionAvailable } =
    await import('./hough-vision-tool');

  // GitHub
  const { githubTool, executeGitHub, isGitHubAvailable } = await import('./github-tool');

  // Presentation / PowerPoint
  const { presentationTool, executePresentation, isPresentationAvailable } =
    await import('./presentation-tool');

  // Task Scheduling
  const { scheduleTaskTool, executeScheduleTask, isScheduleTaskAvailable } =
    await import('./schedule-task-tool');

  // Spawn Agent (parallel sub-agent orchestration)
  const { spawnAgentTool, executeSpawnAgent, isSpawnAgentAvailable } =
    await import('./spawn-agent-tool');

  // Register all tools
  CHAT_TOOLS.push(
    // Core API tools
    { tool: webSearchTool, executor: executeWebSearch, checkAvailability: isWebSearchAvailable },
    { tool: fetchUrlTool, executor: executeFetchUrl, checkAvailability: isFetchUrlAvailable },
    { tool: runCodeTool, executor: executeRunCode, checkAvailability: isRunCodeAvailable },
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
    },

    // Library-based tools
    { tool: fakerTool, executor: executeFaker, checkAvailability: isFakerAvailable },
    { tool: diffTool, executor: executeDiff, checkAvailability: isDiffAvailable },
    { tool: barcodeTool, executor: executeBarcode, checkAvailability: isBarcodeAvailable },
    { tool: ocrTool, executor: executeOCR, checkAvailability: isOCRAvailable },
    { tool: pdfTool, executor: executePDF, checkAvailability: isPDFAvailable },
    { tool: mediaTool, executor: executeMedia, checkAvailability: isMediaAvailable },
    { tool: sqlTool, executor: executeSQL, checkAvailability: isSQLAvailable },
    { tool: excelTool, executor: executeExcel, checkAvailability: isExcelAvailable },
    { tool: prettierTool, executor: executePrettier, checkAvailability: isPrettierAvailable },
    { tool: cryptoTool, executor: executeCryptoTool, checkAvailability: isCryptoToolAvailable },
    { tool: zipTool, executor: executeZip, checkAvailability: isZipAvailable },
    { tool: webCaptureTool, executor: executeWebCapture, checkAvailability: isWebCaptureAvailable },
    { tool: exifTool, executor: executeExif, checkAvailability: isExifAvailable },
    {
      tool: searchIndexTool,
      executor: executeSearchIndex,
      checkAvailability: isSearchIndexAvailable,
    },
    { tool: validatorTool, executor: executeValidator, checkAvailability: isValidatorAvailable },

    // Scientific & research tools
    { tool: geospatialTool, executor: executeGeospatial, checkAvailability: isGeospatialAvailable },
    { tool: phoneTool, executor: executePhone, checkAvailability: isPhoneAvailable },
    { tool: signalTool, executor: executeSignal, checkAvailability: isSignalAvailable },
    {
      tool: accessibilityTool,
      executor: executeAccessibility,
      checkAvailability: isAccessibilityAvailable,
    },
    { tool: parserTool, executor: executeParser, checkAvailability: isParserAvailable },
    {
      tool: constraintTool,
      executor: executeConstraint,
      checkAvailability: isConstraintAvailable,
    },
    {
      tool: graphics3dTool,
      executor: executeGraphics3D,
      checkAvailability: isGraphics3DAvailable,
    },
    {
      tool: houghVisionTool,
      executor: executeHoughVision,
      checkAvailability: isHoughVisionAvailable,
    },

    // GitHub
    { tool: githubTool, executor: executeGitHub, checkAvailability: isGitHubAvailable },

    // Document ecosystem
    {
      tool: presentationTool,
      executor: executePresentation,
      checkAvailability: isPresentationAvailable,
    },

    // Task scheduling
    {
      tool: scheduleTaskTool,
      executor: executeScheduleTask,
      checkAvailability: isScheduleTaskAvailable,
    },

    // Spawn agent (parallel sub-agent orchestration)
    {
      tool: spawnAgentTool,
      executor: executeSpawnAgent,
      checkAvailability: isSpawnAgentAvailable,
    }
  );

  toolsInitialized = true;
}

// ============================================================================
// PUBLIC API
// ============================================================================

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
  // Skip native server tools (web_search) — handled by Anthropic server-side
  if (_isNativeServerTool(toolCall.name)) {
    return {
      toolCallId: toolCall.id,
      content: 'Handled by server',
      isError: false,
    };
  }

  await initializeTools();

  const toolEntry = CHAT_TOOLS.find((t) => t.tool.name === toolCall.name);

  if (!toolEntry) {
    return {
      toolCallId: toolCall.id,
      content: `Unknown tool: ${toolCall.name}`,
      isError: true,
    };
  }

  const isAvailable = await toolEntry.checkAvailability();
  if (!isAvailable) {
    return {
      toolCallId: toolCall.id,
      content: `Tool ${toolCall.name} is not currently available. Required services may not be configured.`,
      isError: true,
    };
  }

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
export async function getAvailableTools(): Promise<UnifiedTool[]> {
  const { webSearchTool, isWebSearchAvailable } = await import('./web-search');
  return isWebSearchAvailable() ? [webSearchTool] : [];
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Cleanup all sandbox resources
 */
export async function cleanupAllSandboxes(): Promise<void> {
  const { cleanupCodeSandbox } = await import('./run-code');
  const { cleanupBrowserSandbox } = await import('./browser-visit');

  await Promise.all([cleanupCodeSandbox(), cleanupBrowserSandbox()]);
}
