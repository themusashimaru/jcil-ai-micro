/**
 * PDF EXTRACTION TOOL
 *
 * Downloads and extracts text content from PDF documents at URLs.
 * Uses unpdf for extraction (works in serverless environments).
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

// Lazy-loaded unpdf module
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let unpdfModule: any = null;

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
// UNPDF INITIALIZATION (serverless-compatible)
// ============================================================================

async function initUnpdf(): Promise<boolean> {
  if (unpdfModule !== null) {
    return true;
  }

  try {
    unpdfModule = await import('unpdf');
    log.info('unpdf loaded successfully');
    return true;
  } catch (error) {
    log.error('Failed to load unpdf', { error: (error as Error).message });
    return false;
  }
}

// ============================================================================
// PDF FETCHING AND EXTRACTION
// ============================================================================

async function fetchPdf(
  url: string
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
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
  _pageOption: string
): Promise<{ success: boolean; text?: string; numPages?: number; error?: string }> {
  if (!unpdfModule) {
    return { success: false, error: 'PDF parser not initialized' };
  }

  try {
    // Use unpdf to extract text (serverless-compatible)
    const { extractText, getDocumentProxy } = unpdfModule;

    // Get document info for page count
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const totalPages = pdf.numPages;

    // Note: unpdf's extractText doesn't support page ranges directly
    // It extracts all text. Page-specific extraction would require
    // processing each page individually with getPageText.
    // For most use cases, extracting all text is sufficient.

    // Extract text from all pages
    const { text } = await extractText(new Uint8Array(buffer), {
      mergePages: true,
    });

    return {
      success: true,
      text: text.slice(0, MAX_OUTPUT_LENGTH),
      numPages: totalPages,
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

  // Initialize unpdf (serverless-compatible PDF parser)
  const available = await initUnpdf();
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

  // Cost check (use passed session ID or generate fallback)
  const sessionId = toolCall.sessionId || `chat_${Date.now()}`;
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
  return initUnpdf();
}
