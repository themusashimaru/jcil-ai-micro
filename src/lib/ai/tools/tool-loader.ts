/**
 * LAZY TOOL LOADER
 *
 * Central registry that maps tool names to lazy-loading functions.
 * Executors are loaded via dynamic import() only when Claude actually calls a tool.
 * Tool definitions (schemas) are loaded once per server lifetime and cached.
 *
 * This replaces:
 * 1. The 55 static imports at the top of route.ts
 * 2. The 90+ case switch statement in route.ts
 * 3. The parallel initializeTools() in index.ts
 *
 * Benefits:
 * - Cold start only imports the tools actually used per request
 * - Adding new tools = adding one entry here + one tool file
 * - No switch statement to maintain
 *
 * Last updated: 2026-02-22
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { TOOL_REGISTRY, type ToolRegistryEntry } from './registry';

// ============================================================================
// TYPES
// ============================================================================

/** A tool module must export these three members */
interface ToolModule {
  /** The tool definition (name, description, parameters) */
  tool: UnifiedTool;
  /** Execute the tool */
  execute: (call: UnifiedToolCall) => Promise<UnifiedToolResult>;
  /** Check if the tool's dependencies are available */
  checkAvailability: () => boolean | Promise<boolean>;
}

/** Maps tool name → module path (relative to tools/) and export names */
interface ToolLoaderEntry {
  /** File path for dynamic import (relative to this directory) */
  importPath: string;
  /** Name of the tool definition export (e.g., 'chartTool') */
  toolExport: string;
  /** Name of the executor export (e.g., 'executeChart') */
  executorExport: string;
  /** Name of the availability check export (e.g., 'isChartAvailable') */
  availabilityExport: string;
}

// ============================================================================
// TOOL LOADER REGISTRY
// ============================================================================

/**
 * Maps each tool name to its lazy-loadable module info.
 * This is the ONLY place tool name → module mappings need to be maintained.
 */
const TOOL_LOADER_MAP: Record<string, ToolLoaderEntry> = {
  // Core API tools
  web_search: {
    importPath: './web-search',
    toolExport: 'webSearchTool',
    executorExport: 'executeWebSearch',
    availabilityExport: 'isWebSearchAvailable',
  },
  fetch_url: {
    importPath: './fetch-url',
    toolExport: 'fetchUrlTool',
    executorExport: 'executeFetchUrl',
    availabilityExport: 'isFetchUrlAvailable',
  },
  run_code: {
    importPath: './run-code',
    toolExport: 'runCodeTool',
    executorExport: 'executeRunCode',
    availabilityExport: 'isRunCodeAvailable',
  },
  analyze_image: {
    importPath: './vision-analyze',
    toolExport: 'visionAnalyzeTool',
    executorExport: 'executeVisionAnalyze',
    availabilityExport: 'isVisionAnalyzeAvailable',
  },
  parallel_research: {
    importPath: './mini-agent',
    toolExport: 'miniAgentTool',
    executorExport: 'executeMiniAgent',
    availabilityExport: 'isMiniAgentAvailable',
  },
  create_and_run_tool: {
    importPath: './dynamic-tool',
    toolExport: 'dynamicToolTool',
    executorExport: 'executeDynamicTool',
    availabilityExport: 'isDynamicToolAvailable',
  },

  // Web tools
  browser_visit: {
    importPath: './browser-visit',
    toolExport: 'browserVisitTool',
    executorExport: 'executeBrowserVisitTool',
    availabilityExport: 'isBrowserVisitAvailable',
  },
  screenshot: {
    importPath: './screenshot-tool',
    toolExport: 'screenshotTool',
    executorExport: 'executeScreenshot',
    availabilityExport: 'isScreenshotAvailable',
  },
  capture_webpage: {
    importPath: './web-capture-tool',
    toolExport: 'webCaptureTool',
    executorExport: 'executeWebCapture',
    availabilityExport: 'isWebCaptureAvailable',
  },
  youtube_transcript: {
    importPath: './youtube-transcript',
    toolExport: 'youtubeTranscriptTool',
    executorExport: 'executeYouTubeTranscript',
    availabilityExport: 'isYouTubeTranscriptAvailable',
  },
  github: {
    importPath: './github-tool',
    toolExport: 'githubTool',
    executorExport: 'executeGitHub',
    availabilityExport: 'isGitHubAvailable',
  },
  http_request: {
    importPath: './http-request-tool',
    toolExport: 'httpRequestTool',
    executorExport: 'executeHttpRequest',
    availabilityExport: 'isHttpRequestAvailable',
  },
  shorten_link: {
    importPath: './link-shorten-tool',
    toolExport: 'linkShortenTool',
    executorExport: 'executeLinkShorten',
    availabilityExport: 'isLinkShortenAvailable',
  },

  // Code tools
  fix_error: {
    importPath: './error-fixer-tool',
    toolExport: 'errorFixerTool',
    executorExport: 'executeErrorFixer',
    availabilityExport: 'isErrorFixerAvailable',
  },
  refactor_code: {
    importPath: './refactor-tool',
    toolExport: 'refactorTool',
    executorExport: 'executeRefactor',
    availabilityExport: 'isRefactorAvailable',
  },
  format_code: {
    importPath: './prettier-tool',
    toolExport: 'prettierTool',
    executorExport: 'executePrettier',
    availabilityExport: 'isPrettierAvailable',
  },
  diff_compare: {
    importPath: './diff-tool',
    toolExport: 'diffTool',
    executorExport: 'executeDiff',
    availabilityExport: 'isDiffAvailable',
  },
  query_data_sql: {
    importPath: './sql-tool',
    toolExport: 'sqlTool',
    executorExport: 'executeSQL',
    availabilityExport: 'isSQLAvailable',
  },
  feature_flag: {
    importPath: './feature-flag-tool',
    toolExport: 'featureFlagTool',
    executorExport: 'executeFeatureFlag',
    availabilityExport: 'isFeatureFlagAvailable',
  },
  migration_generator: {
    importPath: './migration-generator-tool',
    toolExport: 'migrationGeneratorTool',
    executorExport: 'executeMigrationGenerator',
    availabilityExport: 'isMigrationGeneratorAvailable',
  },

  // Document tools
  create_document: {
    importPath: './document-tool',
    toolExport: 'documentTool',
    executorExport: 'executeDocument',
    availabilityExport: 'isDocumentAvailable',
  },
  extract_pdf: {
    importPath: './extract-pdf',
    toolExport: 'extractPdfTool',
    executorExport: 'executeExtractPdf',
    availabilityExport: 'isExtractPdfAvailable',
  },
  extract_table: {
    importPath: './extract-table',
    toolExport: 'extractTableTool',
    executorExport: 'executeExtractTable',
    availabilityExport: 'isExtractTableAvailable',
  },
  pdf_manipulate: {
    importPath: './pdf-tool',
    toolExport: 'pdfTool',
    executorExport: 'executePDF',
    availabilityExport: 'isPDFAvailable',
  },
  create_spreadsheet: {
    importPath: './spreadsheet-tool',
    toolExport: 'spreadsheetTool',
    executorExport: 'executeSpreadsheet',
    availabilityExport: 'isSpreadsheetAvailable',
  },
  excel_advanced: {
    importPath: './excel-tool',
    toolExport: 'excelTool',
    executorExport: 'executeExcel',
    availabilityExport: 'isExcelAvailable',
  },

  // Media tools
  transform_image: {
    importPath: './image-transform-tool',
    toolExport: 'imageTransformTool',
    executorExport: 'executeImageTransform',
    availabilityExport: 'isImageTransformAvailable',
  },
  transcribe_audio: {
    importPath: './audio-transcribe',
    toolExport: 'audioTranscribeTool',
    executorExport: 'executeAudioTranscribe',
    availabilityExport: 'isAudioTranscribeAvailable',
  },
  audio_synth: {
    importPath: './audio-synth-tool',
    toolExport: 'audioSynthTool',
    executorExport: 'executeAudioSynth',
    availabilityExport: 'isAudioSynthAvailable',
  },
  media_process: {
    importPath: './media-tool',
    toolExport: 'mediaTool',
    executorExport: 'executeMedia',
    availabilityExport: 'isMediaAvailable',
  },
  image_metadata: {
    importPath: './exif-tool',
    toolExport: 'exifTool',
    executorExport: 'executeExif',
    availabilityExport: 'isExifAvailable',
  },
  ocr_extract_text: {
    importPath: './ocr-tool',
    toolExport: 'ocrTool',
    executorExport: 'executeOCR',
    availabilityExport: 'isOCRAvailable',
  },
  create_chart: {
    importPath: './chart-tool',
    toolExport: 'chartTool',
    executorExport: 'executeChart',
    availabilityExport: 'isChartAvailable',
  },
  graphics_3d: {
    importPath: './graphics-3d-tool',
    toolExport: 'graphics3dTool',
    executorExport: 'executeGraphics3D',
    availabilityExport: 'isGraphics3DAvailable',
  },
  hough_vision: {
    importPath: './hough-vision-tool',
    toolExport: 'houghVisionTool',
    executorExport: 'executeHoughVision',
    availabilityExport: 'isHoughVisionAvailable',
  },
  ray_tracing: {
    importPath: './ray-tracing-tool',
    toolExport: 'rayTracingTool',
    executorExport: 'executeRayTracing',
    availabilityExport: 'isRayTracingAvailable',
  },

  // Data tools
  generate_fake_data: {
    importPath: './faker-tool',
    toolExport: 'fakerTool',
    executorExport: 'executeFaker',
    availabilityExport: 'isFakerAvailable',
  },
  validate_data: {
    importPath: './validator-tool',
    toolExport: 'validatorTool',
    executorExport: 'executeValidator',
    availabilityExport: 'isValidatorAvailable',
  },
  convert_file: {
    importPath: './file-convert-tool',
    toolExport: 'fileConvertTool',
    executorExport: 'executeFileConvert',
    availabilityExport: 'isFileConvertAvailable',
  },
  generate_qr_code: {
    importPath: './qr-code-tool',
    toolExport: 'qrCodeTool',
    executorExport: 'executeQRCode',
    availabilityExport: 'isQRCodeAvailable',
  },
  generate_barcode: {
    importPath: './barcode-tool',
    toolExport: 'barcodeTool',
    executorExport: 'executeBarcode',
    availabilityExport: 'isBarcodeAvailable',
  },
  zip_files: {
    importPath: './zip-tool',
    toolExport: 'zipTool',
    executorExport: 'executeZip',
    availabilityExport: 'isZipAvailable',
  },
  search_index: {
    importPath: './search-index-tool',
    toolExport: 'searchIndexTool',
    executorExport: 'executeSearchIndex',
    availabilityExport: 'isSearchIndexAvailable',
  },
  analyze_text_nlp: {
    importPath: './nlp-tool',
    toolExport: 'nlpTool',
    executorExport: 'executeNLP',
    availabilityExport: 'isNLPAvailable',
  },

  // Scientific tools
  geo_calculate: {
    importPath: './geospatial-tool',
    toolExport: 'geospatialTool',
    executorExport: 'executeGeospatial',
    availabilityExport: 'isGeospatialAvailable',
  },
  analyze_sequence: {
    importPath: './dna-bio-tool',
    toolExport: 'dnaBioTool',
    executorExport: 'executeDnaBio',
    availabilityExport: 'isDnaBioAvailable',
  },
  signal_process: {
    importPath: './signal-tool',
    toolExport: 'signalTool',
    executorExport: 'executeSignal',
    availabilityExport: 'isSignalAvailable',
  },
  sequence_analyze: {
    importPath: './sequence-analyze-tool',
    toolExport: 'sequenceAnalyzeTool',
    executorExport: 'executeSequenceAnalyze',
    availabilityExport: 'isSequenceAnalyzeAvailable',
  },
  medical_calc: {
    importPath: './medical-calc-tool',
    toolExport: 'medicalCalcTool',
    executorExport: 'executeMedicalCalc',
    availabilityExport: 'isMedicalCalcAvailable',
  },
  solve_constraints: {
    importPath: './constraint-tool',
    toolExport: 'constraintTool',
    executorExport: 'executeConstraint',
    availabilityExport: 'isConstraintAvailable',
  },
  parse_grammar: {
    importPath: './parser-tool',
    toolExport: 'parserTool',
    executorExport: 'executeParser',
    availabilityExport: 'isParserAvailable',
  },

  // Security tools
  crypto_toolkit: {
    importPath: './crypto-tool',
    toolExport: 'cryptoTool',
    executorExport: 'executeCryptoTool',
    availabilityExport: 'isCryptoToolAvailable',
  },
  phone_validate: {
    importPath: './phone-tool',
    toolExport: 'phoneTool',
    executorExport: 'executePhone',
    availabilityExport: 'isPhoneAvailable',
  },
  check_accessibility: {
    importPath: './accessibility-tool',
    toolExport: 'accessibilityTool',
    executorExport: 'executeAccessibility',
    availabilityExport: 'isAccessibilityAvailable',
  },

  // DevTools (beta)
  ml_model_serving: {
    importPath: './ml-model-serving-tool',
    toolExport: 'mlModelServingTool',
    executorExport: 'executeMlModelServing',
    availabilityExport: 'isMlModelServingAvailable',
  },
};

// ============================================================================
// MODULE CACHE
// ============================================================================

/**
 * Cache for loaded tool modules.
 * Once a tool file is dynamically imported, we cache the extracted
 * { tool, execute, checkAvailability } so we don't re-parse exports on every call.
 */
const moduleCache = new Map<string, ToolModule>();

/**
 * Dynamically import a tool module and cache it.
 */
async function loadToolModule(toolName: string): Promise<ToolModule | null> {
  // Check cache first
  const cached = moduleCache.get(toolName);
  if (cached) return cached;

  const entry = TOOL_LOADER_MAP[toolName];
  if (!entry) return null;

  // Dynamic import — only loads the file when first needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import(/* webpackIgnore: true */ entry.importPath);

  const toolModule: ToolModule = {
    tool: mod[entry.toolExport],
    execute: mod[entry.executorExport],
    checkAvailability: mod[entry.availabilityExport],
  };

  moduleCache.set(toolName, toolModule);
  return toolModule;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get all tool names that have loader entries.
 */
export function getRegisteredToolNames(): string[] {
  return Object.keys(TOOL_LOADER_MAP);
}

/**
 * Check if a tool name has a loader entry.
 */
export function hasToolLoader(toolName: string): boolean {
  return toolName in TOOL_LOADER_MAP;
}

/**
 * Cached tool definitions with TTL to avoid re-running availability checks
 * on every request within the same server instance.
 */
let cachedToolDefs: UnifiedTool[] | null = null;
let cachedToolDefsTimestamp = 0;
const TOOL_DEFS_TTL_MS = 60_000; // 1 minute

/**
 * Load available tool definitions for sending to Claude.
 * Only includes tools that are:
 * 1. In the loader map
 * 2. In the registry as 'active' or 'beta'
 * 3. Pass their availability check
 *
 * Results are cached for 1 minute to avoid re-running availability checks
 * on every request within the same server instance.
 *
 * Returns lightweight tool definition objects (name + description + parameters).
 */
export async function loadAvailableToolDefinitions(): Promise<UnifiedTool[]> {
  // Return cached definitions if still fresh
  if (cachedToolDefs && Date.now() - cachedToolDefsTimestamp < TOOL_DEFS_TTL_MS) {
    return cachedToolDefs;
  }

  const tools: UnifiedTool[] = [];

  // Only load tools that are active or beta in the registry
  const activeTools = TOOL_REGISTRY.filter(
    (entry: ToolRegistryEntry) => entry.status === 'active' || entry.status === 'beta'
  );

  // Load tool modules in parallel for faster initialization
  const loadPromises = activeTools
    .filter((entry: ToolRegistryEntry) => entry.name in TOOL_LOADER_MAP)
    .map(async (entry: ToolRegistryEntry) => {
      try {
        const mod = await loadToolModule(entry.name);
        if (!mod) return null;

        const available = await mod.checkAvailability();
        if (!available) return null;

        return mod.tool;
      } catch {
        // Tool failed to load — skip it, don't crash the request
        return null;
      }
    });

  const results = await Promise.all(loadPromises);
  for (const tool of results) {
    if (tool) tools.push(tool);
  }

  // Cache the result
  cachedToolDefs = tools;
  cachedToolDefsTimestamp = Date.now();

  return tools;
}

/**
 * Execute a tool by name.
 * Dynamically imports the tool module only when called.
 *
 * @returns Result, or null if tool not found in the loader.
 */
export async function executeToolByName(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult | null> {
  const mod = await loadToolModule(toolCall.name);
  if (!mod) return null; // Not a built-in tool (might be MCP/Composio)

  return mod.execute(toolCall);
}

/**
 * Clear the module cache and definitions cache (for testing).
 */
export function clearToolModuleCache(): void {
  moduleCache.clear();
  cachedToolDefs = null;
  cachedToolDefsTimestamp = 0;
}
