/**
 * DOCUMENT GENERATION TOOL
 *
 * Generates professional documents (PDF, DOCX, TXT) on demand.
 * Uses pdfkit for PDFs and docx for Word documents.
 *
 * Features:
 * - PDF generation with styling
 * - Word document (.docx) generation
 * - Plain text export
 * - Markdown to document conversion
 * - Tables, lists, and formatting support
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('DocumentTool');

// ============================================================================
// LAZY LOADING
// ============================================================================

let pdfkitModule: typeof import('pdfkit') | null = null;
let docxModule: typeof import('docx') | null = null;

async function initPdfkit(): Promise<boolean> {
  if (pdfkitModule) return true;
  try {
    pdfkitModule = (await import('pdfkit')).default;
    return true;
  } catch (error) {
    log.error('Failed to load pdfkit', { error: (error as Error).message });
    return false;
  }
}

async function initDocx(): Promise<boolean> {
  if (docxModule) return true;
  try {
    docxModule = await import('docx');
    return true;
  } catch (error) {
    log.error('Failed to load docx', { error: (error as Error).message });
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const documentTool: UnifiedTool = {
  name: 'create_document',
  description: `Generate professional documents in various formats. Use this when:
- User asks to create a PDF, Word document, or report
- Converting content into a downloadable document
- Creating formatted reports, letters, or summaries
- User says "make me a PDF of..." or "create a document..."

Formats available:
- pdf: Professional PDF with formatting
- docx: Microsoft Word document
- txt: Plain text file

The document will be generated and returned as a downloadable base64 file.`,
  parameters: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        description: 'Output format',
        enum: ['pdf', 'docx', 'txt'],
      },
      title: {
        type: 'string',
        description: 'Document title',
      },
      content: {
        type: 'string',
        description:
          'Document content. Supports basic markdown: # headings, **bold**, *italic*, - lists, and paragraphs.',
      },
      author: {
        type: 'string',
        description: 'Author name (optional)',
      },
      sections: {
        type: 'array',
        description:
          'Optional structured sections instead of content. Each section should have: heading (string, optional), body (string, required). Example: [{"heading": "Introduction", "body": "Content here..."}]',
        items: { type: 'object' },
      },
    },
    required: ['format', 'title', 'content'],
  },
};

// ============================================================================
// PDF GENERATION
// ============================================================================

interface Section {
  heading?: string;
  body: string;
}

async function generatePdf(
  title: string,
  content: string,
  author?: string,
  sections?: Section[]
): Promise<{ success: boolean; data?: string; error?: string }> {
  const loaded = await initPdfkit();
  if (!loaded || !pdfkitModule) {
    return { success: false, error: 'PDF generation library not available' };
  }

  return new Promise((resolve) => {
    try {
      const PDFDocument = pdfkitModule as unknown as typeof import('pdfkit');
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        info: {
          Title: title,
          Author: author || 'JCIL AI',
          Creator: 'JCIL AI Document Generator',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        resolve({ success: true, data: base64 });
      });
      doc.on('error', (err: Error) => {
        resolve({ success: false, error: err.message });
      });

      // Title
      doc.fontSize(24).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown();

      // Author and date
      if (author) {
        doc.fontSize(12).font('Helvetica').text(`By ${author}`, { align: 'center' });
      }
      doc.fontSize(10).text(new Date().toLocaleDateString(), { align: 'center' });
      doc.moveDown(2);

      // Content
      if (sections && sections.length > 0) {
        for (const section of sections) {
          if (section.heading) {
            doc.fontSize(16).font('Helvetica-Bold').text(section.heading);
            doc.moveDown(0.5);
          }
          doc.fontSize(12).font('Helvetica').text(section.body, { align: 'justify' });
          doc.moveDown();
        }
      } else {
        // Parse basic markdown
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.startsWith('# ')) {
            doc.fontSize(20).font('Helvetica-Bold').text(line.slice(2));
            doc.moveDown(0.5);
          } else if (line.startsWith('## ')) {
            doc.fontSize(16).font('Helvetica-Bold').text(line.slice(3));
            doc.moveDown(0.5);
          } else if (line.startsWith('### ')) {
            doc.fontSize(14).font('Helvetica-Bold').text(line.slice(4));
            doc.moveDown(0.5);
          } else if (line.startsWith('- ') || line.startsWith('* ')) {
            doc
              .fontSize(12)
              .font('Helvetica')
              .text(`• ${line.slice(2)}`, { indent: 20 });
          } else if (line.trim() === '') {
            doc.moveDown(0.5);
          } else {
            // Handle bold and italic
            let text = line;
            text = text.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove bold markers (simplified)
            text = text.replace(/\*([^*]+)\*/g, '$1'); // Remove italic markers
            doc.fontSize(12).font('Helvetica').text(text, { align: 'justify' });
          }
        }
      }

      doc.end();
    } catch (error) {
      resolve({ success: false, error: (error as Error).message });
    }
  });
}

// ============================================================================
// DOCX GENERATION
// ============================================================================

async function generateDocx(
  title: string,
  content: string,
  author?: string,
  sections?: Section[]
): Promise<{ success: boolean; data?: string; error?: string }> {
  const loaded = await initDocx();
  if (!loaded || !docxModule) {
    return { success: false, error: 'DOCX generation library not available' };
  }

  try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docxModule;

    const children: (typeof Paragraph.prototype)[] = [];

    // Title
    children.push(
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 48 })],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      })
    );

    // Author and date
    if (author) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `By ${author}`, italics: true })],
          alignment: AlignmentType.CENTER,
        })
      );
    }
    children.push(
      new Paragraph({
        children: [new TextRun({ text: new Date().toLocaleDateString(), size: 20 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );

    // Content
    if (sections && sections.length > 0) {
      for (const section of sections) {
        if (section.heading) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: section.heading, bold: true, size: 28 })],
              heading: HeadingLevel.HEADING_1,
            })
          );
        }
        children.push(
          new Paragraph({
            children: [new TextRun({ text: section.body })],
          })
        );
      }
    } else {
      // Parse content
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('# ')) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: line.slice(2), bold: true, size: 36 })],
              heading: HeadingLevel.HEADING_1,
            })
          );
        } else if (line.startsWith('## ')) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: line.slice(3), bold: true, size: 28 })],
              heading: HeadingLevel.HEADING_2,
            })
          );
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: line.slice(2) })],
              bullet: { level: 0 },
            })
          );
        } else if (line.trim() !== '') {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: line })],
            })
          );
        }
      }
    }

    const doc = new Document({
      creator: 'JCIL AI',
      title,
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);
    const base64 = buffer.toString('base64');

    return { success: true, data: base64 };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============================================================================
// TXT GENERATION
// ============================================================================

function generateTxt(
  title: string,
  content: string,
  author?: string,
  sections?: Section[]
): { success: boolean; data?: string; error?: string } {
  try {
    let text = `${title}\n${'='.repeat(title.length)}\n\n`;

    if (author) {
      text += `By ${author}\n`;
    }
    text += `Date: ${new Date().toLocaleDateString()}\n\n`;
    text += '-'.repeat(40) + '\n\n';

    if (sections && sections.length > 0) {
      for (const section of sections) {
        if (section.heading) {
          text += `${section.heading}\n${'-'.repeat(section.heading.length)}\n\n`;
        }
        text += `${section.body}\n\n`;
      }
    } else {
      // Clean up markdown
      let cleanContent = content;
      cleanContent = cleanContent.replace(/^# /gm, '');
      cleanContent = cleanContent.replace(/^## /gm, '');
      cleanContent = cleanContent.replace(/^### /gm, '');
      cleanContent = cleanContent.replace(/\*\*([^*]+)\*\*/g, '$1');
      cleanContent = cleanContent.replace(/\*([^*]+)\*/g, '$1');
      text += cleanContent;
    }

    const base64 = Buffer.from(text, 'utf-8').toString('base64');
    return { success: true, data: base64 };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeDocument(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'create_document') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
  const format = args.format as string;
  const title = args.title as string;
  const content = args.content as string;
  const author = args.author as string | undefined;
  const sections = args.sections as Section[] | undefined;

  if (!format || !['pdf', 'docx', 'txt'].includes(format)) {
    return { toolCallId: id, content: 'Invalid format. Use pdf, docx, or txt.', isError: true };
  }
  if (!title) {
    return { toolCallId: id, content: 'Document title is required', isError: true };
  }
  if (!content && (!sections || sections.length === 0)) {
    return { toolCallId: id, content: 'Document content is required', isError: true };
  }

  log.info('Generating document', { format, title });

  let result: { success: boolean; data?: string; error?: string };

  switch (format) {
    case 'pdf':
      result = await generatePdf(title, content, author, sections);
      break;
    case 'docx':
      result = await generateDocx(title, content, author, sections);
      break;
    case 'txt':
      result = generateTxt(title, content, author, sections);
      break;
    default:
      result = { success: false, error: 'Unknown format' };
  }

  if (!result.success) {
    return {
      toolCallId: id,
      content: result.error || 'Document generation failed',
      isError: true,
    };
  }

  log.info('Document generated successfully', { format, title });

  // Create a data URL for download
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  };

  const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.${format}`;
  const dataUrl = `data:${mimeTypes[format]};base64,${result.data}`;

  const response = `Document generated successfully!\n\n**Title:** ${title}\n**Format:** ${format.toUpperCase()}\n**Filename:** ${filename}\n\n[Download ${filename}](${dataUrl})`;

  return {
    toolCallId: id,
    content: response,
    isError: false,
  };
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isDocumentAvailable(): boolean {
  return true; // Always available - gracefully handles missing packages
}
