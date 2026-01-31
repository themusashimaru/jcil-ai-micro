/**
 * PDF MANIPULATION TOOL
 *
 * Create, modify, and manipulate PDF documents using pdf-lib.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Create PDFs from text/HTML
 * - Merge multiple PDFs
 * - Split PDFs by pages
 * - Add watermarks
 * - Extract pages
 * - Add annotations
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded pdf-lib
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PDFLib: any = null;

async function initPDFLib(): Promise<boolean> {
  if (PDFLib) return true;
  try {
    PDFLib = await import('pdf-lib');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const pdfTool: UnifiedTool = {
  name: 'pdf_manipulate',
  description: `Create and manipulate PDF documents.

Operations:
- create: Create a new PDF from text content
- merge: Combine multiple PDFs into one
- split: Extract specific pages from a PDF
- watermark: Add text watermark to all pages
- add_text: Add text to existing PDF
- get_info: Get PDF metadata and page count

Features:
- No external API calls - runs locally
- Supports text content and basic formatting
- Page manipulation (merge, split, extract)
- Watermarks and annotations

Returns: Base64 encoded PDF or metadata`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'merge', 'split', 'watermark', 'add_text', 'get_info'],
        description: 'The PDF operation to perform',
      },
      content: {
        type: 'string',
        description: 'For create: text content for the PDF',
      },
      title: {
        type: 'string',
        description: 'PDF title/filename',
      },
      pdf_data: {
        type: 'string',
        description: 'Base64 encoded PDF data for operations on existing PDFs',
      },
      pdf_data_list: {
        type: 'array',
        items: { type: 'string' },
        description: 'For merge: array of base64 encoded PDFs to combine',
      },
      pages: {
        type: 'array',
        items: { type: 'number' },
        description: 'For split: page numbers to extract (1-indexed)',
      },
      watermark_text: {
        type: 'string',
        description: 'For watermark: text to add as watermark',
      },
      text: {
        type: 'string',
        description: 'For add_text: text to add',
      },
      x: {
        type: 'number',
        description: 'X position for text (default: 50)',
      },
      y: {
        type: 'number',
        description: 'Y position for text (default: 50)',
      },
      page_number: {
        type: 'number',
        description: 'Page number for add_text (1-indexed, default: 1)',
      },
      font_size: {
        type: 'number',
        description: 'Font size (default: 12)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isPDFAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executePDF(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    content?: string;
    title?: string;
    pdf_data?: string;
    pdf_data_list?: string[];
    pages?: number[];
    watermark_text?: string;
    text?: string;
    x?: number;
    y?: number;
    page_number?: number;
    font_size?: number;
  };

  if (!args.operation) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation is required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initPDFLib();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize pdf-lib' }),
        isError: true,
      };
    }

    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'create': {
        if (!args.content) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Content required for create operation' }),
            isError: true,
          };
        }

        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const fontSize = args.font_size || 12;

        // Split content into lines and pages
        const lines = args.content.split('\n');
        const linesPerPage = Math.floor(700 / (fontSize + 4));

        for (let i = 0; i < lines.length; i += linesPerPage) {
          const page = doc.addPage([612, 792]); // Letter size
          const pageLines = lines.slice(i, i + linesPerPage);

          pageLines.forEach((line, idx) => {
            page.drawText(line.substring(0, 80), {
              x: 50,
              y: 742 - idx * (fontSize + 4),
              size: fontSize,
              font,
            });
          });
        }

        if (args.title) {
          doc.setTitle(args.title);
        }

        const pdfBytes = await doc.save();
        const base64 = Buffer.from(pdfBytes).toString('base64');

        result = {
          operation: 'create',
          title: args.title || 'document.pdf',
          pages: doc.getPageCount(),
          pdf_base64: base64,
          size_bytes: pdfBytes.length,
        };
        break;
      }

      case 'merge': {
        if (!args.pdf_data_list || args.pdf_data_list.length < 2) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'At least 2 PDFs required for merge' }),
            isError: true,
          };
        }

        const mergedDoc = await PDFDocument.create();

        for (const pdfBase64 of args.pdf_data_list) {
          const pdfBytes = Buffer.from(pdfBase64, 'base64');
          const srcDoc = await PDFDocument.load(pdfBytes);
          const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
          pages.forEach((page: unknown) => mergedDoc.addPage(page));
        }

        const mergedBytes = await mergedDoc.save();
        const base64 = Buffer.from(mergedBytes).toString('base64');

        result = {
          operation: 'merge',
          input_count: args.pdf_data_list.length,
          total_pages: mergedDoc.getPageCount(),
          pdf_base64: base64,
          size_bytes: mergedBytes.length,
        };
        break;
      }

      case 'split': {
        if (!args.pdf_data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'PDF data required for split' }),
            isError: true,
          };
        }
        if (!args.pages || args.pages.length === 0) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Pages array required for split' }),
            isError: true,
          };
        }

        const srcBytes = Buffer.from(args.pdf_data, 'base64');
        const srcDoc = await PDFDocument.load(srcBytes);
        const newDoc = await PDFDocument.create();

        const pageIndices = args.pages.map((p) => p - 1); // Convert to 0-indexed
        const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
        copiedPages.forEach((page: unknown) => newDoc.addPage(page));

        const splitBytes = await newDoc.save();
        const base64 = Buffer.from(splitBytes).toString('base64');

        result = {
          operation: 'split',
          extracted_pages: args.pages,
          pdf_base64: base64,
          size_bytes: splitBytes.length,
        };
        break;
      }

      case 'watermark': {
        if (!args.pdf_data || !args.watermark_text) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'PDF data and watermark text required' }),
            isError: true,
          };
        }

        const pdfBytes = Buffer.from(args.pdf_data, 'base64');
        const doc = await PDFDocument.load(pdfBytes);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pages = doc.getPages();

        for (const page of pages) {
          const { width, height } = page.getSize();
          page.drawText(args.watermark_text, {
            x: width / 4,
            y: height / 2,
            size: 50,
            font,
            color: rgb(0.75, 0.75, 0.75),
            rotate: { angle: 45, type: 'degrees' } as unknown as undefined,
            opacity: 0.3,
          });
        }

        const watermarkedBytes = await doc.save();
        const base64 = Buffer.from(watermarkedBytes).toString('base64');

        result = {
          operation: 'watermark',
          watermark: args.watermark_text,
          pages_watermarked: pages.length,
          pdf_base64: base64,
          size_bytes: watermarkedBytes.length,
        };
        break;
      }

      case 'add_text': {
        if (!args.pdf_data || !args.text) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'PDF data and text required' }),
            isError: true,
          };
        }

        const pdfBytes = Buffer.from(args.pdf_data, 'base64');
        const doc = await PDFDocument.load(pdfBytes);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pageNum = (args.page_number || 1) - 1;
        const page = doc.getPage(pageNum);

        page.drawText(args.text, {
          x: args.x || 50,
          y: args.y || 50,
          size: args.font_size || 12,
          font,
        });

        const modifiedBytes = await doc.save();
        const base64 = Buffer.from(modifiedBytes).toString('base64');

        result = {
          operation: 'add_text',
          text_added: args.text,
          page: args.page_number || 1,
          pdf_base64: base64,
          size_bytes: modifiedBytes.length,
        };
        break;
      }

      case 'get_info': {
        if (!args.pdf_data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'PDF data required' }),
            isError: true,
          };
        }

        const pdfBytes = Buffer.from(args.pdf_data, 'base64');
        const doc = await PDFDocument.load(pdfBytes);

        result = {
          operation: 'get_info',
          page_count: doc.getPageCount(),
          title: doc.getTitle() || null,
          author: doc.getAuthor() || null,
          subject: doc.getSubject() || null,
          creator: doc.getCreator() || null,
          producer: doc.getProducer() || null,
          creation_date: doc.getCreationDate()?.toISOString() || null,
          modification_date: doc.getModificationDate()?.toISOString() || null,
        };
        break;
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown operation: ${args.operation}` }),
          isError: true,
        };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'PDF operation failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}
