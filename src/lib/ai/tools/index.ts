/**
 * CHAT TOOLS INDEX
 *
 * Unified exports for all chat-level tools.
 * These tools extend the main chat with capabilities from Deep Strategy agent.
 *
 * Tools available (58 total):
 * - web_search: Search the web (Brave Search)
 * - fetch_url: Fetch and extract content from URLs
 * - run_code: Execute Python/JavaScript in E2B sandbox
 * - analyze_image: Vision analysis with Claude
 * - browser_visit: Full browser via Puppeteer
 * - extract_pdf: Extract text from PDF URLs
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
 * - generate_diagram: Create diagrams with Mermaid.js (flowcharts, sequence, etc.)
 * - generate_fake_data: Generate realistic fake data with Faker.js
 * - diff_compare: Compare texts and show differences
 * - analyze_text_nlp: NLP analysis (sentiment, tokenize, stem, etc.)
 * - extract_entities: Extract named entities from text
 * - generate_barcode: Create barcodes (CODE128, EAN, UPC, etc.)
 * - ocr_extract_text: Extract text from images (Tesseract.js OCR)
 * - pdf_manipulate: Create, merge, split, watermark PDFs (pdf-lib)
 * - media_process: Audio/video processing (FFmpeg.js)
 * - query_data_sql: SQL queries on data (SQL.js)
 * - excel_advanced: Advanced Excel manipulation (SheetJS)
 * - format_code: Code formatting (Prettier)
 * - crypto_toolkit: JWT, encryption, hashing (jose)
 * - zip_files: Create/extract ZIP archives (JSZip)
 * - capture_webpage: Web screenshots and PDFs (Puppeteer)
 * - math_compute: Advanced math and unit conversion (math.js)
 * - image_metadata: EXIF/metadata extraction (exifr)
 * - search_index: Full-text search indexing (Lunr.js)
 * - ascii_art: ASCII art text generation (FIGlet)
 * - color_tools: Color manipulation and palettes (chroma-js)
 * - validate_data: Data validation (validator.js)
 * - cron_explain: Cron expression parsing
 * - convert_units: Unit conversions (convert-units)
 * - audio_synth: Audio tone generation specs (Tone.js)
 * - analyze_statistics: Statistical analysis (simple-statistics + jstat)
 * - geo_calculate: Geospatial calculations (turf.js)
 * - phone_validate: Phone number validation (libphonenumber-js)
 * - analyze_password: Password strength analysis (zxcvbn)
 * - analyze_molecule: Chemistry/molecule analysis (openchemlib-js)
 * - analyze_sequence: DNA/RNA/protein sequences (custom)
 * - matrix_compute: Matrix/linear algebra (ml-matrix)
 * - analyze_graph: Graph/network analysis (graphology)
 * - periodic_table: Element properties lookup (custom)
 * - physics_constants: Physical constants (custom)
 * - signal_process: Signal processing/FFT (fft-js)
 * - check_accessibility: WCAG accessibility checking (axe-core)
 *
 * Workflow utilities:
 * - Workflow tasks: Claude Code style todo lists with borders
 *
 * Last updated: 2026-01-31 04:00 PM UTC
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

// Mermaid Diagram Generation
export {
  mermaidDiagramTool,
  executeMermaidDiagram,
  isMermaidDiagramAvailable,
} from './mermaid-diagram-tool';

// Fake Data Generation (Faker.js)
export { fakerTool, executeFaker, isFakerAvailable } from './faker-tool';

// Text Diff Comparison
export { diffTool, executeDiff, isDiffAvailable } from './diff-tool';

// NLP Analysis (Natural)
export { nlpTool, executeNLP, isNLPAvailable } from './nlp-tool';

// Entity Extraction (Compromise)
export {
  entityExtractionTool,
  executeEntityExtraction,
  isEntityExtractionAvailable,
} from './entity-extraction-tool';

// Barcode Generation (JsBarcode)
export { barcodeTool, executeBarcode, isBarcodeAvailable } from './barcode-tool';

// ============================================================================
// NEW TIER S/A/B TOOLS (19 new tools)
// ============================================================================

// OCR - Text extraction from images (Tesseract.js)
export { ocrTool, executeOCR, isOCRAvailable } from './ocr-tool';

// PDF Manipulation (pdf-lib)
export { pdfTool, executePDF, isPDFAvailable } from './pdf-tool';

// Media Processing (FFmpeg.js)
export { mediaTool, executeMedia, isMediaAvailable } from './media-tool';

// SQL Queries (SQL.js)
export { sqlTool, executeSQL, isSQLAvailable } from './sql-tool';

// Advanced Excel (SheetJS xlsx)
export { excelTool, executeExcel, isExcelAvailable } from './excel-tool';

// Code Formatting (Prettier)
export { prettierTool, executePrettier, isPrettierAvailable } from './prettier-tool';

// Cryptography (jose)
export { cryptoTool, executeCryptoTool, isCryptoToolAvailable } from './crypto-tool';

// ZIP Files (JSZip)
export { zipTool, executeZip, isZipAvailable } from './zip-tool';

// Web Capture (Puppeteer)
export { webCaptureTool, executeWebCapture, isWebCaptureAvailable } from './web-capture-tool';

// Advanced Math (math.js)
export { mathTool, executeMath, isMathAvailable } from './math-tool';

// EXIF/Image Metadata (exifr)
export { exifTool, executeExif, isExifAvailable } from './exif-tool';

// Search Index (Lunr.js)
export { searchIndexTool, executeSearchIndex, isSearchIndexAvailable } from './search-index-tool';

// ASCII Art (FIGlet)
export { asciiArtTool, executeAsciiArt, isAsciiArtAvailable } from './ascii-art-tool';

// Color Tools (chroma-js)
export { colorTool, executeColor, isColorAvailable } from './color-tool';

// Data Validation (validator.js)
export { validatorTool, executeValidator, isValidatorAvailable } from './validator-tool';

// Cron Expression (cron-parser)
export { cronTool, executeCron, isCronAvailable } from './cron-tool';

// Unit Conversion (convert-units)
export { unitConvertTool, executeUnitConvert, isUnitConvertAvailable } from './unit-convert-tool';

// Audio Synthesis (Tone.js)
export { audioSynthTool, executeAudioSynth, isAudioSynthAvailable } from './audio-synth-tool';

// ============================================================================
// SCIENTIFIC & RESEARCH TOOLS (12 new tools)
// ============================================================================

// Statistical Analysis (simple-statistics + jstat)
export { statisticsTool, executeStatistics, isStatisticsAvailable } from './statistics-tool';

// Geospatial Calculations (turf.js)
export { geospatialTool, executeGeospatial, isGeospatialAvailable } from './geospatial-tool';

// Phone Validation (libphonenumber-js)
export { phoneTool, executePhone, isPhoneAvailable } from './phone-tool';

// Password Strength (zxcvbn)
export {
  passwordStrengthTool,
  executePasswordStrength,
  isPasswordStrengthAvailable,
} from './password-strength-tool';

// Chemistry/Molecules (openchemlib-js)
export { chemistryTool, executeChemistry, isChemistryAvailable } from './chemistry-tool';

// DNA/Bio Sequences (custom)
export { dnaBioTool, executeDnaBio, isDnaBioAvailable } from './dna-bio-tool';

// Matrix/Linear Algebra (ml-matrix)
export { matrixTool, executeMatrix, isMatrixAvailable } from './matrix-tool';

// Graph/Network Analysis (graphology)
export { graphTool, executeGraph, isGraphAvailable } from './graph-tool';

// Periodic Table (custom)
export {
  periodicTableTool,
  executePeriodicTable,
  isPeriodicTableAvailable,
} from './periodic-table-tool';

// Physics Constants (custom)
export {
  physicsConstantsTool,
  executePhysicsConstants,
  isPhysicsConstantsAvailable,
} from './physics-constants-tool';

// Signal Processing (fft-js)
export { signalTool, executeSignal, isSignalAvailable } from './signal-tool';

// Accessibility Checking (axe-core)
export {
  accessibilityTool,
  executeAccessibility,
  isAccessibilityAvailable,
} from './accessibility-tool';

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
  const { mermaidDiagramTool, executeMermaidDiagram, isMermaidDiagramAvailable } = await import(
    './mermaid-diagram-tool'
  );
  const { fakerTool, executeFaker, isFakerAvailable } = await import('./faker-tool');
  const { diffTool, executeDiff, isDiffAvailable } = await import('./diff-tool');
  const { nlpTool, executeNLP, isNLPAvailable } = await import('./nlp-tool');
  const { entityExtractionTool, executeEntityExtraction, isEntityExtractionAvailable } =
    await import('./entity-extraction-tool');
  const { barcodeTool, executeBarcode, isBarcodeAvailable } = await import('./barcode-tool');

  // New Tier S/A/B tools (19 new tools)
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
  const { mathTool, executeMath, isMathAvailable } = await import('./math-tool');
  const { exifTool, executeExif, isExifAvailable } = await import('./exif-tool');
  const { searchIndexTool, executeSearchIndex, isSearchIndexAvailable } = await import(
    './search-index-tool'
  );
  const { asciiArtTool, executeAsciiArt, isAsciiArtAvailable } = await import('./ascii-art-tool');
  const { colorTool, executeColor, isColorAvailable } = await import('./color-tool');
  const { validatorTool, executeValidator, isValidatorAvailable } = await import(
    './validator-tool'
  );
  const { cronTool, executeCron, isCronAvailable } = await import('./cron-tool');
  const { unitConvertTool, executeUnitConvert, isUnitConvertAvailable } = await import(
    './unit-convert-tool'
  );
  const { audioSynthTool, executeAudioSynth, isAudioSynthAvailable } = await import(
    './audio-synth-tool'
  );

  // Scientific & Research tools (12 new)
  const { statisticsTool, executeStatistics, isStatisticsAvailable } = await import(
    './statistics-tool'
  );
  const { geospatialTool, executeGeospatial, isGeospatialAvailable } = await import(
    './geospatial-tool'
  );
  const { phoneTool, executePhone, isPhoneAvailable } = await import('./phone-tool');
  const { passwordStrengthTool, executePasswordStrength, isPasswordStrengthAvailable } =
    await import('./password-strength-tool');
  const { chemistryTool, executeChemistry, isChemistryAvailable } = await import(
    './chemistry-tool'
  );
  const { dnaBioTool, executeDnaBio, isDnaBioAvailable } = await import('./dna-bio-tool');
  const { matrixTool, executeMatrix, isMatrixAvailable } = await import('./matrix-tool');
  const { graphTool, executeGraph, isGraphAvailable } = await import('./graph-tool');
  const { periodicTableTool, executePeriodicTable, isPeriodicTableAvailable } = await import(
    './periodic-table-tool'
  );
  const { physicsConstantsTool, executePhysicsConstants, isPhysicsConstantsAvailable } =
    await import('./physics-constants-tool');
  const { signalTool, executeSignal, isSignalAvailable } = await import('./signal-tool');
  const { accessibilityTool, executeAccessibility, isAccessibilityAvailable } = await import(
    './accessibility-tool'
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
    },
    {
      tool: mermaidDiagramTool,
      executor: executeMermaidDiagram,
      checkAvailability: isMermaidDiagramAvailable,
    },
    { tool: fakerTool, executor: executeFaker, checkAvailability: isFakerAvailable },
    { tool: diffTool, executor: executeDiff, checkAvailability: isDiffAvailable },
    { tool: nlpTool, executor: executeNLP, checkAvailability: isNLPAvailable },
    {
      tool: entityExtractionTool,
      executor: executeEntityExtraction,
      checkAvailability: isEntityExtractionAvailable,
    },
    { tool: barcodeTool, executor: executeBarcode, checkAvailability: isBarcodeAvailable },
    // New Tier S/A/B tools (19 new)
    { tool: ocrTool, executor: executeOCR, checkAvailability: isOCRAvailable },
    { tool: pdfTool, executor: executePDF, checkAvailability: isPDFAvailable },
    { tool: mediaTool, executor: executeMedia, checkAvailability: isMediaAvailable },
    { tool: sqlTool, executor: executeSQL, checkAvailability: isSQLAvailable },
    { tool: excelTool, executor: executeExcel, checkAvailability: isExcelAvailable },
    { tool: prettierTool, executor: executePrettier, checkAvailability: isPrettierAvailable },
    { tool: cryptoTool, executor: executeCryptoTool, checkAvailability: isCryptoToolAvailable },
    { tool: zipTool, executor: executeZip, checkAvailability: isZipAvailable },
    { tool: webCaptureTool, executor: executeWebCapture, checkAvailability: isWebCaptureAvailable },
    { tool: mathTool, executor: executeMath, checkAvailability: isMathAvailable },
    { tool: exifTool, executor: executeExif, checkAvailability: isExifAvailable },
    {
      tool: searchIndexTool,
      executor: executeSearchIndex,
      checkAvailability: isSearchIndexAvailable,
    },
    { tool: asciiArtTool, executor: executeAsciiArt, checkAvailability: isAsciiArtAvailable },
    { tool: colorTool, executor: executeColor, checkAvailability: isColorAvailable },
    { tool: validatorTool, executor: executeValidator, checkAvailability: isValidatorAvailable },
    { tool: cronTool, executor: executeCron, checkAvailability: isCronAvailable },
    {
      tool: unitConvertTool,
      executor: executeUnitConvert,
      checkAvailability: isUnitConvertAvailable,
    },
    { tool: audioSynthTool, executor: executeAudioSynth, checkAvailability: isAudioSynthAvailable },
    // Scientific & Research tools (12 new)
    { tool: statisticsTool, executor: executeStatistics, checkAvailability: isStatisticsAvailable },
    { tool: geospatialTool, executor: executeGeospatial, checkAvailability: isGeospatialAvailable },
    { tool: phoneTool, executor: executePhone, checkAvailability: isPhoneAvailable },
    {
      tool: passwordStrengthTool,
      executor: executePasswordStrength,
      checkAvailability: isPasswordStrengthAvailable,
    },
    { tool: chemistryTool, executor: executeChemistry, checkAvailability: isChemistryAvailable },
    { tool: dnaBioTool, executor: executeDnaBio, checkAvailability: isDnaBioAvailable },
    { tool: matrixTool, executor: executeMatrix, checkAvailability: isMatrixAvailable },
    { tool: graphTool, executor: executeGraph, checkAvailability: isGraphAvailable },
    {
      tool: periodicTableTool,
      executor: executePeriodicTable,
      checkAvailability: isPeriodicTableAvailable,
    },
    {
      tool: physicsConstantsTool,
      executor: executePhysicsConstants,
      checkAvailability: isPhysicsConstantsAvailable,
    },
    { tool: signalTool, executor: executeSignal, checkAvailability: isSignalAvailable },
    {
      tool: accessibilityTool,
      executor: executeAccessibility,
      checkAvailability: isAccessibilityAvailable,
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
