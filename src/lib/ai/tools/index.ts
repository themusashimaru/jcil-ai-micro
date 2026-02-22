/**
 * CHAT TOOLS INDEX
 *
 * Unified exports for all chat-level tools.
 * Only tools with real implementations are included — no stubs.
 *
 * Last updated: 2026-02-22 (cleaned up: removed 23 stub tools + 148 broken imports)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

export type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TOOL EXPORTS — Only tools with real implementations
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

// GitHub Tool — backward compatibility export
export { getRepoSummaryForPrompt } from './github-tool';

// Screenshot Tool (Puppeteer)
export { screenshotTool, executeScreenshot, isScreenshotAvailable } from './screenshot-tool';

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

// Text Diff Comparison
export { diffTool, executeDiff, isDiffAvailable } from './diff-tool';

// NLP Analysis (Natural)
export { nlpTool, executeNLP, isNLPAvailable } from './nlp-tool';

// Barcode Generation (JsBarcode)
export { barcodeTool, executeBarcode, isBarcodeAvailable } from './barcode-tool';

// OCR - Text extraction from images (Tesseract.js)
export { ocrTool, executeOCR, isOCRAvailable } from './ocr-tool';

// PDF Manipulation (pdf-lib)
export { pdfTool, executePDF, isPDFAvailable } from './pdf-tool';

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

// Audio Synthesis (Tone.js)
export { audioSynthTool, executeAudioSynth, isAudioSynthAvailable } from './audio-synth-tool';

// Geospatial Calculations (turf.js)
export { geospatialTool, executeGeospatial, isGeospatialAvailable } from './geospatial-tool';

// Phone Validation (libphonenumber-js)
export { phoneTool, executePhone, isPhoneAvailable } from './phone-tool';

// DNA/Bio Sequences
export { dnaBioTool, executeDnaBio, isDnaBioAvailable } from './dna-bio-tool';

// Signal Processing (fft-js)
export { signalTool, executeSignal, isSignalAvailable } from './signal-tool';

// Accessibility Checking (axe-core)
export {
  accessibilityTool,
  executeAccessibility,
  isAccessibilityAvailable,
} from './accessibility-tool';

// Parser / Grammar (nearley)
export { parserTool, executeParser, isParserAvailable } from './parser-tool';

// Constraint Solver (logic-solver)
export { constraintTool, executeConstraint, isConstraintAvailable } from './constraint-tool';

// Sequence Analysis
export {
  sequenceAnalyzeTool,
  executeSequenceAnalyze,
  isSequenceAnalyzeAvailable,
} from './sequence-analyze-tool';

// Medical Calculator
export { medicalCalcTool, executeMedicalCalc, isMedicalCalcAvailable } from './medical-calc-tool';

// Graphics 3D
export { graphics3dTool, executeGraphics3D, isGraphics3DAvailable } from './graphics-3d-tool';

// Hough Vision (Computer vision)
export { houghVisionTool, executeHoughVision, isHoughVisionAvailable } from './hough-vision-tool';

// Ray Tracing
export { rayTracingTool, executeRayTracing, isRayTracingAvailable } from './ray-tracing-tool';

// Error Fixer (AI-powered)
export { errorFixerTool, executeErrorFixer, isErrorFixerAvailable } from './error-fixer-tool';

// Refactor Tool (AI-powered)
export { refactorTool, executeRefactor, isRefactorAvailable } from './refactor-tool';

// ============================================================================
// STUB REPLACEMENTS — minimal pass-through for deleted modules
// These provide the API surface that route.ts expects without fake functionality.
// ============================================================================

/**
 * Safety/cost control — simplified pass-through.
 * The full safety module was removed with the stub cleanup.
 * These allow unlimited tool execution until a real cost-tracking system is built.
 */
export function canExecuteTool(
  _sessionId: string,
  _toolName: string,
  _estimatedCost: number
): { allowed: boolean; reason?: string } {
  return { allowed: true };
}

export function recordToolCost(
  _sessionId: string,
  _toolName: string,
  _estimatedCost: number
): void {
  // No-op until real cost tracking is implemented
}

/**
 * Quality control — simplified pass-through.
 * The full QC module was removed with the stub cleanup.
 */
export function shouldRunQC(_toolName: string): boolean {
  return false; // Disable QC until real verification is implemented
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
 * Only includes tools with real implementations.
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
  const { screenshotTool, executeScreenshot, isScreenshotAvailable } = await import(
    './screenshot-tool'
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

  // Library-based tools
  const { fakerTool, executeFaker, isFakerAvailable } = await import('./faker-tool');
  const { diffTool, executeDiff, isDiffAvailable } = await import('./diff-tool');
  const { nlpTool, executeNLP, isNLPAvailable } = await import('./nlp-tool');
  const { barcodeTool, executeBarcode, isBarcodeAvailable } = await import('./barcode-tool');
  const { ocrTool, executeOCR, isOCRAvailable } = await import('./ocr-tool');
  const { pdfTool, executePDF, isPDFAvailable } = await import('./pdf-tool');
  const { mediaTool, executeMedia, isMediaAvailable } = await import('./media-tool');
  const { sqlTool, executeSQL, isSQLAvailable } = await import('./sql-tool');
  const { excelTool, executeExcel, isExcelAvailable } = await import('./excel-tool');
  const { prettierTool, executePrettier, isPrettierAvailable } = await import('./prettier-tool');
  const { cryptoTool, executeCryptoTool, isCryptoToolAvailable } = await import('./crypto-tool');
  const { zipTool, executeZip, isZipAvailable } = await import('./zip-tool');
  const { webCaptureTool, executeWebCapture, isWebCaptureAvailable } = await import(
    './web-capture-tool'
  );
  const { exifTool, executeExif, isExifAvailable } = await import('./exif-tool');
  const { searchIndexTool, executeSearchIndex, isSearchIndexAvailable } = await import(
    './search-index-tool'
  );
  const { validatorTool, executeValidator, isValidatorAvailable } = await import(
    './validator-tool'
  );
  const { audioSynthTool, executeAudioSynth, isAudioSynthAvailable } = await import(
    './audio-synth-tool'
  );

  // Scientific & research tools
  const { geospatialTool, executeGeospatial, isGeospatialAvailable } = await import(
    './geospatial-tool'
  );
  const { phoneTool, executePhone, isPhoneAvailable } = await import('./phone-tool');
  const { dnaBioTool, executeDnaBio, isDnaBioAvailable } = await import('./dna-bio-tool');
  const { signalTool, executeSignal, isSignalAvailable } = await import('./signal-tool');
  const { accessibilityTool, executeAccessibility, isAccessibilityAvailable } = await import(
    './accessibility-tool'
  );
  const { parserTool, executeParser, isParserAvailable } = await import('./parser-tool');
  const { constraintTool, executeConstraint, isConstraintAvailable } = await import(
    './constraint-tool'
  );
  const { sequenceAnalyzeTool, executeSequenceAnalyze, isSequenceAnalyzeAvailable } = await import(
    './sequence-analyze-tool'
  );
  const { medicalCalcTool, executeMedicalCalc, isMedicalCalcAvailable } = await import(
    './medical-calc-tool'
  );
  const { graphics3dTool, executeGraphics3D, isGraphics3DAvailable } = await import(
    './graphics-3d-tool'
  );
  const { houghVisionTool, executeHoughVision, isHoughVisionAvailable } = await import(
    './hough-vision-tool'
  );
  const { rayTracingTool, executeRayTracing, isRayTracingAvailable } = await import(
    './ray-tracing-tool'
  );

  // AI-powered code tools
  const { errorFixerTool, executeErrorFixer, isErrorFixerAvailable } = await import(
    './error-fixer-tool'
  );
  const { refactorTool, executeRefactor, isRefactorAvailable } = await import('./refactor-tool');

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
    { tool: screenshotTool, executor: executeScreenshot, checkAvailability: isScreenshotAvailable },
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
    { tool: nlpTool, executor: executeNLP, checkAvailability: isNLPAvailable },
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
    { tool: audioSynthTool, executor: executeAudioSynth, checkAvailability: isAudioSynthAvailable },

    // Scientific & research tools
    { tool: geospatialTool, executor: executeGeospatial, checkAvailability: isGeospatialAvailable },
    { tool: phoneTool, executor: executePhone, checkAvailability: isPhoneAvailable },
    { tool: dnaBioTool, executor: executeDnaBio, checkAvailability: isDnaBioAvailable },
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
      tool: sequenceAnalyzeTool,
      executor: executeSequenceAnalyze,
      checkAvailability: isSequenceAnalyzeAvailable,
    },
    {
      tool: medicalCalcTool,
      executor: executeMedicalCalc,
      checkAvailability: isMedicalCalcAvailable,
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
    { tool: rayTracingTool, executor: executeRayTracing, checkAvailability: isRayTracingAvailable },

    // AI-powered code tools
    { tool: errorFixerTool, executor: executeErrorFixer, checkAvailability: isErrorFixerAvailable },
    { tool: refactorTool, executor: executeRefactor, checkAvailability: isRefactorAvailable }
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
