/**
 * DOCUMENT GENERATION TOOL
 *
 * Generates professional documents (PDF, DOCX, TXT) on demand.
 * Uses pdfkit for PDFs and docx for Word documents.
 *
 * Features:
 * - PDF generation with styling and logo/image embedding
 * - Word document (.docx) generation with images
 * - Plain text export
 * - Markdown to document conversion
 * - Tables, lists, and formatting support
 * - Brand color theming
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
// IMAGE FETCHING
// ============================================================================

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Fetch an image from a URL and return it as a Buffer.
 * Validates content type, enforces size limits, and handles errors gracefully.
 */
async function fetchImageBuffer(
  url: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      log.warn('Invalid image URL protocol', { url });
      return null;
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'JCIL-AI-DocumentGenerator/1.0' },
    });

    if (!response.ok) {
      log.warn('Failed to fetch image', { url, status: response.status });
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      log.warn('URL did not return an image', { url, contentType });
      return null;
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
      log.warn('Image too large', { url, size: contentLength });
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
      log.warn('Image too large after download', { url, size: arrayBuffer.byteLength });
      return null;
    }

    return { buffer: Buffer.from(arrayBuffer), contentType };
  } catch (error) {
    log.warn('Error fetching image', { url, error: (error as Error).message });
    return null;
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
- pdf: Professional PDF with formatting and optional logo
- docx: Microsoft Word document with optional logo
- txt: Plain text file

Supports optional logo/header image from a URL, and brand color theming.
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
      logoUrl: {
        type: 'string',
        description:
          'URL of a logo or header image to embed at the top of the document. Must be a direct image URL (PNG, JPEG, etc). The image will be centered at the top of the first page.',
      },
      brandColor: {
        type: 'string',
        description: 'Hex color code for headings and accents (e.g. "#1a1a2e"). Defaults to black.',
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

function parseHexColor(hex: string | undefined): [number, number, number] | null {
  if (!hex) return null;
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

async function generatePdf(
  title: string,
  content: string,
  author?: string,
  sections?: Section[],
  logoBuffer?: Buffer | null,
  brandColor?: string
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

      const headingColor = parseHexColor(brandColor) || [0, 0, 0];
      const pageWidth = 612 - 72 - 72; // LETTER width minus margins
      let pageNumber = 1;

      // Page header/footer on every new page (after page 1)
      doc.on('pageAdded', () => {
        pageNumber++;
        // Header: title (left) and page number (right)
        doc.save();
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor([128, 128, 128])
          .text(title, 72, 30, { width: pageWidth / 2, align: 'left' })
          .text(`Page ${pageNumber}`, 72 + pageWidth / 2, 30, {
            width: pageWidth / 2,
            align: 'right',
          });
        // Thin line under header
        doc
          .strokeColor([200, 200, 200])
          .lineWidth(0.5)
          .moveTo(72, 50)
          .lineTo(612 - 72, 50)
          .stroke();
        doc.restore();
        // Reset cursor below header
        doc.y = 72;
      });

      // Footer on first page (subsequent pages get footer via 'pageAdded' + end handler)
      // We'll add footers via a range approach at the end

      // Logo (centered, max 150px tall)
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, {
            fit: [pageWidth, 150],
            align: 'center',
            valign: 'center',
          });
          doc.moveDown(1.5);
        } catch (imgErr) {
          log.warn('Failed to embed logo in PDF', { error: (imgErr as Error).message });
        }
      }

      // Decorative line under logo/before title
      if (brandColor) {
        const [r, g, b] = headingColor;
        doc.save();
        doc.strokeColor([r, g, b]).lineWidth(2);
        doc
          .moveTo(72, doc.y)
          .lineTo(612 - 72, doc.y)
          .stroke();
        doc.restore();
        doc.moveDown(0.5);
      }

      // Title
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .fillColor(headingColor)
        .text(title, { align: 'center' });
      doc.moveDown();

      // Author and date
      doc.fillColor([0, 0, 0]); // reset to black
      if (author) {
        doc.fontSize(12).font('Helvetica').text(`By ${author}`, { align: 'center' });
      }
      doc.fontSize(10).text(new Date().toLocaleDateString(), { align: 'center' });
      doc.moveDown(2);

      // Content
      if (sections && sections.length > 0) {
        for (const section of sections) {
          if (section.heading) {
            doc.fontSize(16).font('Helvetica-Bold').fillColor(headingColor).text(section.heading);
            doc.moveDown(0.5);
          }
          doc
            .fontSize(12)
            .font('Helvetica')
            .fillColor([0, 0, 0])
            .text(section.body, { align: 'justify' });
          doc.moveDown();
        }
      } else {
        renderMarkdownToPdf(doc, content, headingColor);
      }

      // Add footer with page numbers to all pages
      const totalPages = doc.bufferedPageRange();
      for (let i = 0; i < totalPages.count; i++) {
        doc.switchToPage(i);
        doc.save();
        // Footer line
        doc
          .strokeColor([200, 200, 200])
          .lineWidth(0.5)
          .moveTo(72, 756)
          .lineTo(612 - 72, 756)
          .stroke();
        // Footer text
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor([128, 128, 128])
          .text(`Page ${i + 1}`, 72, 762, { width: pageWidth, align: 'center' });
        doc.restore();
      }

      doc.end();
    } catch (error) {
      resolve({ success: false, error: (error as Error).message });
    }
  });
}

/**
 * Render markdown content into a pdfkit document with heading colors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMarkdownToPdf(doc: any, content: string, headingColor: [number, number, number]) {
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ')) {
      doc.fontSize(20).font('Helvetica-Bold').fillColor(headingColor).text(line.slice(2));
      doc.moveDown(0.5);
    } else if (line.startsWith('## ')) {
      doc.fontSize(16).font('Helvetica-Bold').fillColor(headingColor).text(line.slice(3));
      doc.moveDown(0.5);
    } else if (line.startsWith('### ')) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor(headingColor).text(line.slice(4));
      doc.moveDown(0.5);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor([0, 0, 0])
        .text(`• ${line.slice(2)}`, { indent: 20 });
    } else if (line.trim() === '') {
      doc.moveDown(0.5);
    } else {
      let text = line;
      text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
      text = text.replace(/\*([^*]+)\*/g, '$1');
      doc.fontSize(12).font('Helvetica').fillColor([0, 0, 0]).text(text, { align: 'justify' });
    }
  }
}

// ============================================================================
// DOCX GENERATION
// ============================================================================

async function generateDocx(
  title: string,
  content: string,
  author?: string,
  sections?: Section[],
  logoBuffer?: Buffer | null,
  brandColor?: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  const loaded = await initDocx();
  if (!loaded || !docxModule) {
    return { success: false, error: 'DOCX generation library not available' };
  }

  try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } =
      docxModule;

    const children: (typeof Paragraph.prototype)[] = [];
    const headingColorHex = brandColor || '000000';

    // Logo
    if (logoBuffer) {
      try {
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: logoBuffer,
                transformation: { width: 200, height: 80 },
                type: 'png',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );
      } catch (imgErr) {
        log.warn('Failed to embed logo in DOCX', { error: (imgErr as Error).message });
      }
    }

    // Title
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 48,
            color: headingColorHex.replace('#', ''),
          }),
        ],
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
              children: [
                new TextRun({
                  text: section.heading,
                  bold: true,
                  size: 28,
                  color: headingColorHex.replace('#', ''),
                }),
              ],
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
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('# ')) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.slice(2),
                  bold: true,
                  size: 36,
                  color: headingColorHex.replace('#', ''),
                }),
              ],
              heading: HeadingLevel.HEADING_1,
            })
          );
        } else if (line.startsWith('## ')) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.slice(3),
                  bold: true,
                  size: 28,
                  color: headingColorHex.replace('#', ''),
                }),
              ],
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
  const logoUrl = args.logoUrl as string | undefined;
  const brandColor = args.brandColor as string | undefined;

  if (!format || !['pdf', 'docx', 'txt'].includes(format)) {
    return { toolCallId: id, content: 'Invalid format. Use pdf, docx, or txt.', isError: true };
  }
  if (!title) {
    return { toolCallId: id, content: 'Document title is required', isError: true };
  }
  if (!content && (!sections || sections.length === 0)) {
    return { toolCallId: id, content: 'Document content is required', isError: true };
  }

  log.info('Generating document', { format, title, hasLogo: !!logoUrl, brandColor });

  // Fetch logo image if provided
  let logoBuffer: Buffer | null = null;
  if (logoUrl) {
    const imageResult = await fetchImageBuffer(logoUrl);
    if (imageResult) {
      logoBuffer = imageResult.buffer;
      log.info('Logo fetched successfully', { url: logoUrl, size: logoBuffer.length });
    } else {
      log.warn('Could not fetch logo, generating document without it', { url: logoUrl });
    }
  }

  let result: { success: boolean; data?: string; error?: string };

  switch (format) {
    case 'pdf':
      result = await generatePdf(title, content, author, sections, logoBuffer, brandColor);
      break;
    case 'docx':
      result = await generateDocx(title, content, author, sections, logoBuffer, brandColor);
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
