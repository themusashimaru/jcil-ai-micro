/**
 * PDF EXTRACTION TOOL
 *
 * Downloads and extracts text content from PDF documents at URLs.
 * Uses pdf-parse for extraction.
 *
 * Features:
 * - Download PDFs from URLs
 * - Extract text content
 * - Handle multi-page documents
 * - Safety checks for URL access
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import { isUrlSafe, canExecuteTool, recordToolCost } from './safety';

const log = logger('ExtractPdfTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOOL_COST = 0.005; // $0.005 per PDF extraction
const PDF_TIMEOUT_MS = 30000; // 30 seconds
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50MB max
const MAX_OUTPUT_LENGTH = 100000; // 100KB max text output

// Lazy load pdf-parse
let pdfParse: typeof import('pdf-parse') | null = null;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const extractPdfTool: UnifiedTool = {
  name: 'extract_pdf',
  description: `Download and extract text from a PDF document at a URL. Use this when:
- User shares a link to a PDF and asks about its content
- You need to read a report, whitepaper, or document in PDF format
- User asks to summarize or analyze a PDF document

This extracts the text content from all pages of the PDF.
Note: Works best with text-based PDFs. Scanned documents may have limited text extraction.`,
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL of the PDF document to extract',
      },
      pages: {
        type: 'string',
        description: 'Which pages to extract: "all", "first", or a range like "1-5"',
        default: 'all',
      },
    },
    required: ['url'],
  },
};

// ============================================================================
// PDF-PARSE INITIALIZATION
// ============================================================================

async function initPdfParse(): Promise<boolean> {
  if (pdfParse !== null) {
    return true;
  }

  try {
    pdfParse = (await import('pdf-parse')).default;
    log.info('pdf-parse loaded');
    return true;
  } catch (error) {
    log.error('Failed to load pdf-parse', { error: (error as Error).message });
    return false;
  }
}

// ============================================================================
// PDF FETCHING AND EXTRACTION
// ============================================================================

async function fetchPdf(url: string): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PDF_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/pdf,*/*',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `HTTP error: ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('pdf') && !url.toLowerCase().endsWith('.pdf')) {
      return { success: false, error: `Not a PDF: ${contentType}` };
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_PDF_SIZE_BYTES) {
      return {
        success: false,
        error: `PDF too large (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB > 50MB)`,
      };
    }

    return { success: true, buffer: Buffer.from(arrayBuffer) };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('abort')) {
      return { success: false, error: 'PDF download timed out' };
    }
    return { success: false, error: errMsg };
  }
}

async function extractPdfText(
  buffer: Buffer,
  pageOption: string
): Promise<{ success: boolean; text?: string; numPages?: number; error?: string }> {
  if (!pdfParse) {
    return { success: false, error: 'PDF parser not initialized' };
  }

  try {
    // Determine page range
    let maxPages: number | undefined;
    if (pageOption === 'first') {
      maxPages = 1;
    } else if (pageOption !== 'all') {
      // Parse range like "1-5"
      const match = pageOption.match(/^(\d+)-(\d+)$/);
      if (match) {
        maxPages = parseInt(match[2], 10);
      }
    }

    const options: { max?: number } = {};
    if (maxPages) {
      options.max = maxPages;
    }

    const result = await pdfParse(buffer, options);

    return {
      success: true,
      text: result.text.slice(0, MAX_OUTPUT_LENGTH),
      numPages: result.numpages,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('PDF extraction failed', { error: errMsg });
    return { success: false, error: errMsg };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeExtractPdf(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'extract_pdf') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  // Initialize pdf-parse
  const available = await initPdfParse();
  if (!available) {
    return {
      toolCallId: id,
      content: 'PDF extraction is not available. Parser failed to load.',
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? {} : rawArgs;
  let url = args.url as string;
  const pages = (args.pages as string) || 'all';

  if (!url) {
    return {
      toolCallId: id,
      content: 'No URL provided.',
      isError: true,
    };
  }

  // Normalize URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Safety check
  const urlSafety = isUrlSafe(url);
  if (!urlSafety.safe) {
    return {
      toolCallId: id,
      content: `Cannot access URL: ${urlSafety.reason}`,
      isError: true,
    };
  }

  // Cost check
  const sessionId = `chat_${Date.now()}`;
  const costCheck = canExecuteTool(sessionId, 'extract_pdf', TOOL_COST);
  if (!costCheck.allowed) {
    return {
      toolCallId: id,
      content: `Cannot extract PDF: ${costCheck.reason}`,
      isError: true,
    };
  }

  log.info('Extracting PDF', { url, pages });

  // Fetch PDF
  const fetchResult = await fetchPdf(url);
  if (!fetchResult.success) {
    return {
      toolCallId: id,
      content: `Failed to download PDF: ${fetchResult.error}`,
      isError: true,
    };
  }

  // Extract text
  const extractResult = await extractPdfText(fetchResult.buffer!, pages);

  // Record cost
  recordToolCost(sessionId, 'extract_pdf', TOOL_COST);

  if (!extractResult.success) {
    return {
      toolCallId: id,
      content: `Failed to extract PDF: ${extractResult.error}`,
      isError: true,
    };
  }

  // Format output
  const text = extractResult.text || '(No text content extracted)';
  const truncated = text.length >= MAX_OUTPUT_LENGTH;

  return {
    toolCallId: id,
    content:
      `**PDF Extracted** (${extractResult.numPages} pages)\n\n` +
      `---\n\n${text}${truncated ? '\n\n[Content truncated...]' : ''}\n\n---\n*Source: ${url}*`,
    isError: false,
  };
}

// ============================================================================
// HELPER EXPORTS
// ============================================================================

export async function isExtractPdfAvailable(): Promise<boolean> {
  return initPdfParse();
}
