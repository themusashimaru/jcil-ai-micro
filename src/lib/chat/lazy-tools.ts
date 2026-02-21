/**
 * LAZY TOOL LOADING
 *
 * Instead of importing all 40+ tools at startup, this module provides
 * on-demand loading of tools. This improves:
 * - Cold start times
 * - Memory usage
 * - Bundle size for serverless functions
 *
 * Tools are loaded only when first used, then cached.
 */

import { logger } from '@/lib/logger';
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '@/lib/ai/providers/types';

const log = logger('LazyTools');

// ============================================================================
// TYPES
// ============================================================================

export type ToolDefinition = UnifiedTool;

export interface ToolModule {
  tool: UnifiedTool;
  execute: (toolCall: UnifiedToolCall) => Promise<UnifiedToolResult>;
  isAvailable: () => boolean | Promise<boolean>;
}

type ToolLoader = () => Promise<ToolModule>;

// ============================================================================
// TOOL REGISTRY
// ============================================================================

/**
 * Registry of tool loaders
 * Each entry maps a tool name to a function that dynamically imports the tool
 */
const toolLoaders: Record<string, ToolLoader> = {
  // Search & Web
  web_search: async () => {
    const { webSearchTool, executeWebSearch, isWebSearchAvailable } = await import(
      '@/lib/ai/tools'
    );
    return { tool: webSearchTool, execute: executeWebSearch, isAvailable: isWebSearchAvailable };
  },
  fetch_url: async () => {
    const { fetchUrlTool, executeFetchUrl, isFetchUrlAvailable } = await import('@/lib/ai/tools');
    return { tool: fetchUrlTool, execute: executeFetchUrl, isAvailable: isFetchUrlAvailable };
  },
  browser_visit: async () => {
    const { browserVisitTool, executeBrowserVisitTool, isBrowserVisitAvailable } = await import(
      '@/lib/ai/tools'
    );
    return {
      tool: browserVisitTool,
      execute: executeBrowserVisitTool,
      isAvailable: isBrowserVisitAvailable,
    };
  },

  // Code Execution
  run_code: async () => {
    const { runCodeTool, executeRunCode, isRunCodeAvailable } = await import('@/lib/ai/tools');
    return { tool: runCodeTool, execute: executeRunCode, isAvailable: isRunCodeAvailable };
  },

  // Vision & Analysis
  analyze_image: async () => {
    const { visionAnalyzeTool, executeVisionAnalyze, isVisionAnalyzeAvailable } = await import(
      '@/lib/ai/tools'
    );
    return {
      tool: visionAnalyzeTool,
      execute: executeVisionAnalyze,
      isAvailable: isVisionAnalyzeAvailable,
    };
  },

  // PDF & Documents
  extract_pdf_url: async () => {
    const { extractPdfTool, executeExtractPdf, isExtractPdfAvailable } = await import(
      '@/lib/ai/tools'
    );
    return { tool: extractPdfTool, execute: executeExtractPdf, isAvailable: isExtractPdfAvailable };
  },
  extract_table: async () => {
    const { extractTableTool, executeExtractTable, isExtractTableAvailable } = await import(
      '@/lib/ai/tools'
    );
    return {
      tool: extractTableTool,
      execute: executeExtractTable,
      isAvailable: isExtractTableAvailable,
    };
  },

  // Research
  parallel_research: async () => {
    const { miniAgentTool, executeMiniAgent, isMiniAgentAvailable } = await import(
      '@/lib/ai/tools'
    );
    return { tool: miniAgentTool, execute: executeMiniAgent, isAvailable: isMiniAgentAvailable };
  },

  // Document Generation
  generate_document: async () => {
    const { documentTool, executeDocument, isDocumentAvailable } = await import('@/lib/ai/tools');
    return { tool: documentTool, execute: executeDocument, isAvailable: isDocumentAvailable };
  },
  generate_spreadsheet: async () => {
    const { spreadsheetTool, executeSpreadsheet, isSpreadsheetAvailable } = await import(
      '@/lib/ai/tools'
    );
    return {
      tool: spreadsheetTool,
      execute: executeSpreadsheet,
      isAvailable: isSpreadsheetAvailable,
    };
  },

  // Charts & Visualization
  generate_chart: async () => {
    const { chartTool, executeChart, isChartAvailable } = await import('@/lib/ai/tools');
    return { tool: chartTool, execute: executeChart, isAvailable: isChartAvailable };
  },

  // Utilities
  calculator: async () => {
    const { calculatorTool, executeCalculator, isCalculatorAvailable } = await import(
      '@/lib/ai/tools'
    );
    return { tool: calculatorTool, execute: executeCalculator, isAvailable: isCalculatorAvailable };
  },
  screenshot: async () => {
    const { screenshotTool, executeScreenshot, isScreenshotAvailable } = await import(
      '@/lib/ai/tools'
    );
    return { tool: screenshotTool, execute: executeScreenshot, isAvailable: isScreenshotAvailable };
  },
  qr_code: async () => {
    const { qrCodeTool, executeQRCode, isQRCodeAvailable } = await import('@/lib/ai/tools');
    return { tool: qrCodeTool, execute: executeQRCode, isAvailable: isQRCodeAvailable };
  },

  // Media
  audio_transcribe: async () => {
    const { audioTranscribeTool, executeAudioTranscribe, isAudioTranscribeAvailable } =
      await import('@/lib/ai/tools');
    return {
      tool: audioTranscribeTool,
      execute: executeAudioTranscribe,
      isAvailable: isAudioTranscribeAvailable,
    };
  },
  youtube_transcript: async () => {
    const { youtubeTranscriptTool, executeYouTubeTranscript, isYouTubeTranscriptAvailable } =
      await import('@/lib/ai/tools');
    return {
      tool: youtubeTranscriptTool,
      execute: executeYouTubeTranscript,
      isAvailable: isYouTubeTranscriptAvailable,
    };
  },

  // GitHub - REMOVED: Now handled by Composio GitHub connector

  // File Operations
  image_transform: async () => {
    const { imageTransformTool, executeImageTransform, isImageTransformAvailable } = await import(
      '@/lib/ai/tools'
    );
    return {
      tool: imageTransformTool,
      execute: executeImageTransform,
      isAvailable: isImageTransformAvailable,
    };
  },
  file_convert: async () => {
    const { fileConvertTool, executeFileConvert, isFileConvertAvailable } = await import(
      '@/lib/ai/tools'
    );
    return {
      tool: fileConvertTool,
      execute: executeFileConvert,
      isAvailable: isFileConvertAvailable,
    };
  },

  // Diagrams
  mermaid_diagram: async () => {
    const { mermaidDiagramTool, executeMermaidDiagram, isMermaidDiagramAvailable } = await import(
      '@/lib/ai/tools'
    );
    return {
      tool: mermaidDiagramTool,
      execute: executeMermaidDiagram,
      isAvailable: isMermaidDiagramAvailable,
    };
  },

  // Data Tools
  ocr: async () => {
    const { ocrTool, executeOCR, isOCRAvailable } = await import('@/lib/ai/tools');
    return { tool: ocrTool, execute: executeOCR, isAvailable: isOCRAvailable };
  },
  pdf_tool: async () => {
    const { pdfTool, executePDF, isPDFAvailable } = await import('@/lib/ai/tools');
    return { tool: pdfTool, execute: executePDF, isAvailable: isPDFAvailable };
  },
  excel_tool: async () => {
    const { excelTool, executeExcel, isExcelAvailable } = await import('@/lib/ai/tools');
    return { tool: excelTool, execute: executeExcel, isAvailable: isExcelAvailable };
  },

  // Validation & Analysis
  validator: async () => {
    const { validatorTool, executeValidator, isValidatorAvailable } = await import(
      '@/lib/ai/tools'
    );
    return { tool: validatorTool, execute: executeValidator, isAvailable: isValidatorAvailable };
  },
  nlp: async () => {
    const { nlpTool, executeNLP, isNLPAvailable } = await import('@/lib/ai/tools');
    return { tool: nlpTool, execute: executeNLP, isAvailable: isNLPAvailable };
  },

  // More tools can be added here...
};

// ============================================================================
// TOOL CACHE
// ============================================================================

const loadedTools = new Map<string, ToolModule>();

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get a tool by name, loading it if necessary
 */
export async function getTool(name: string): Promise<ToolModule | null> {
  // Check cache first
  const cached = loadedTools.get(name);
  if (cached) {
    return cached;
  }

  // Check if we have a loader for this tool
  const loader = toolLoaders[name];
  if (!loader) {
    log.warn('Unknown tool requested', { name });
    return null;
  }

  // Load the tool
  try {
    log.debug('Loading tool on demand', { name });
    const toolModule = await loader();

    // Check if tool is available
    if (!toolModule.isAvailable()) {
      log.debug('Tool not available', { name });
      return null;
    }

    // Cache the loaded tool
    loadedTools.set(name, toolModule);
    return toolModule;
  } catch (error) {
    log.error('Failed to load tool', {
      name,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

/**
 * Execute a tool by name
 */
export async function executeTool(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const tool = await getTool(toolCall.name);

  if (!tool) {
    return {
      toolCallId: toolCall.id,
      content: `Tool '${toolCall.name}' not found or not available`,
      isError: true,
    };
  }

  try {
    return await tool.execute(toolCall);
  } catch (error) {
    log.error('Tool execution failed', {
      name: toolCall.name,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return {
      toolCallId: toolCall.id,
      content: error instanceof Error ? error.message : 'Tool execution failed',
      isError: true,
    };
  }
}

/**
 * Get all available tool definitions
 * This preloads tools to get their definitions
 */
export async function getAllToolDefinitions(): Promise<ToolDefinition[]> {
  const definitions: ToolDefinition[] = [];

  for (const name of Object.keys(toolLoaders)) {
    const tool = await getTool(name);
    if (tool) {
      definitions.push(tool.tool);
    }
  }

  return definitions;
}

/**
 * Get tool definitions for specific tools only
 * Use this when you know which tools you need
 */
export async function getToolDefinitions(names: string[]): Promise<ToolDefinition[]> {
  const definitions: ToolDefinition[] = [];

  for (const name of names) {
    const tool = await getTool(name);
    if (tool) {
      definitions.push(tool.tool);
    }
  }

  return definitions;
}

/**
 * Preload specific tools (useful for frequently used tools)
 */
export async function preloadTools(names: string[]): Promise<void> {
  await Promise.all(names.map((name) => getTool(name)));
}

/**
 * Get list of registered tool names
 */
export function getRegisteredToolNames(): string[] {
  return Object.keys(toolLoaders);
}

/**
 * Check if a tool is registered
 */
export function isToolRegistered(name: string): boolean {
  return name in toolLoaders;
}

/**
 * Clear the tool cache (useful for testing)
 */
export function clearToolCache(): void {
  loadedTools.clear();
}

/**
 * Get tool loading statistics
 */
export function getToolStats(): { registered: number; loaded: number; loadedTools: string[] } {
  return {
    registered: Object.keys(toolLoaders).length,
    loaded: loadedTools.size,
    loadedTools: Array.from(loadedTools.keys()),
  };
}

// ============================================================================
// COMMONLY USED TOOL SETS
// ============================================================================

/**
 * Core tools that should be preloaded for most chat interactions
 */
export const CORE_TOOLS = ['web_search', 'run_code', 'calculator'];

/**
 * Document-related tools
 */
export const DOCUMENT_TOOLS = [
  'generate_document',
  'generate_spreadsheet',
  'extract_pdf_url',
  'extract_table',
  'pdf_tool',
  'excel_tool',
];

/**
 * Media tools
 */
export const MEDIA_TOOLS = [
  'analyze_image',
  'audio_transcribe',
  'youtube_transcript',
  'screenshot',
  'image_transform',
];

/**
 * Developer tools
 */
export const DEVELOPER_TOOLS = ['run_code', 'github', 'mermaid_diagram', 'validator'];
