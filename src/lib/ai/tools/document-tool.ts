/**
 * DOCUMENT GENERATION TOOL
 *
 * Generates professional documents (PDF, DOCX, TXT) on demand.
 * Uses pdfkit for PDFs and docx for Word documents.
 *
 * Features:
 * - PDF generation with rich styling, font selection, and logo/image embedding
 * - Word document (.docx) generation with images and formatting
 * - Plain text export
 * - Advanced markdown: bold/italic inline, numbered lists, tables, page breaks
 * - Inline image embedding via ![alt](url) syntax
 * - Brand color theming
 * - Page headers/footers with page numbers
 * - Table of contents generation
 * - Signature field support
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import { uploadDocument } from '@/lib/documents/storage';

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

async function fetchImageBuffer(
  url: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return null;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'JCIL-AI-DocumentGenerator/1.0' },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) return null;

    return { buffer: Buffer.from(arrayBuffer), contentType };
  } catch {
    return null;
  }
}

// ============================================================================
// FONT MAPPING
// ============================================================================

type FontFamily = 'helvetica' | 'times' | 'courier';

const FONT_MAP: Record<
  FontFamily,
  { regular: string; bold: string; italic: string; boldItalic: string }
> = {
  helvetica: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    boldItalic: 'Helvetica-BoldOblique',
  },
  times: {
    regular: 'Times-Roman',
    bold: 'Times-Bold',
    italic: 'Times-Italic',
    boldItalic: 'Times-BoldItalic',
  },
  courier: {
    regular: 'Courier',
    bold: 'Courier-Bold',
    italic: 'Courier-Oblique',
    boldItalic: 'Courier-BoldOblique',
  },
};

function getFonts(family?: string) {
  const key = (family || 'helvetica').toLowerCase() as FontFamily;
  return FONT_MAP[key] || FONT_MAP.helvetica;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const documentTool: UnifiedTool = {
  name: 'create_document',
  description: `Generate professional documents in various formats with rich formatting.

Use this when:
- User asks to create a PDF, Word document, or report
- Converting content into a downloadable document
- Creating formatted reports, letters, onboarding packets, or summaries
- User says "make me a PDF of..." or "create a document..."

Formats: pdf, docx, txt

Rich Markdown Support (in content field):
- # H1, ## H2, ### H3 headings
- **bold** and *italic* inline formatting
- - bullet lists and 1. numbered lists
- | col1 | col2 | tables with | header | separators
- ![alt text](image-url) inline images
- [text](url) clickable hyperlinks
- [QR:data-or-url] QR code generation
- --- horizontal rule = page break
- [TOC] placeholder = auto table of contents
- [SIGNATURE] placeholder = signature line

Features:
- Logo/header image from URL
- Brand color theming for headings
- Font family selection (helvetica, times, courier)
- Page headers and footers with page numbers
- Tables with borders and cell alignment
- Inline images anywhere in content
- Signature fields
- QR code generation via [QR:data] syntax
- Clickable hyperlinks via [text](url) syntax
- DOCX template filling: provide a templateData (base64 DOCX) and templateFields to replace {{placeholders}}

The document will be generated and returned as a downloadable base64 file.
Images from other tools (e.g., generated images, transformed images) can be embedded via their URL in logoUrl, signatureUrl, or ![](url) syntax.`,
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
          'Document content with rich markdown support. See tool description for supported syntax.',
      },
      author: {
        type: 'string',
        description: 'Author name (optional)',
      },
      sections: {
        type: 'array',
        description: 'Optional structured sections instead of content. Each: { heading?, body }',
        items: { type: 'object' },
      },
      logoUrl: {
        type: 'string',
        description: 'URL of a logo/header image (PNG, JPEG) to embed at top of first page.',
      },
      brandColor: {
        type: 'string',
        description: 'Hex color for headings and accents (e.g. "#1a1a2e"). Default: black.',
      },
      fontFamily: {
        type: 'string',
        enum: ['helvetica', 'times', 'courier'],
        description: 'Font family for the document. Default: helvetica.',
      },
      fontSize: {
        type: 'number',
        description: 'Base font size in points. Default: 12.',
      },
      includeTableOfContents: {
        type: 'boolean',
        description: 'Auto-generate a table of contents from headings. Default: false.',
      },
      signatureUrl: {
        type: 'string',
        description: 'URL of a signature image to embed at [SIGNATURE] placeholders.',
      },
      templateData: {
        type: 'string',
        description:
          'Base64-encoded DOCX template file. When provided, {{placeholders}} in the template will be replaced with values from templateFields. The format must be "docx".',
      },
      templateFields: {
        type: 'object',
        description:
          'Key-value pairs for DOCX template filling. Keys match {{placeholder}} names in the template. Example: {"name": "John Doe", "company": "Acme Corp"}',
      },
    },
    required: ['format', 'title', 'content'],
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface Section {
  heading?: string;
  body: string;
}

interface DocOptions {
  title: string;
  content: string;
  author?: string;
  sections?: Section[];
  logoBuffer?: Buffer | null;
  brandColor?: string;
  fontFamily?: string;
  fontSize?: number;
  includeTableOfContents?: boolean;
  signatureBuffer?: Buffer | null;
  inlineImages?: Map<string, Buffer>;
  qrCodeBuffers?: Map<string, Buffer>;
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

// ============================================================================
// TABLE PARSING
// ============================================================================

interface TableData {
  headers: string[];
  rows: string[][];
}

function parseMarkdownTable(
  lines: string[],
  startIdx: number
): { table: TableData; endIdx: number } | null {
  if (startIdx >= lines.length) return null;
  const headerLine = lines[startIdx];
  if (!headerLine.includes('|')) return null;

  const headers = headerLine
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  if (headers.length === 0) return null;

  // Check for separator line
  const sepIdx = startIdx + 1;
  if (sepIdx >= lines.length) return null;
  const sepLine = lines[sepIdx];
  if (!sepLine.match(/^[\s|:-]+$/)) return null;

  const rows: string[][] = [];
  let endIdx = sepIdx + 1;
  while (endIdx < lines.length && lines[endIdx].includes('|')) {
    const cells = lines[endIdx]
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    rows.push(cells);
    endIdx++;
  }

  return { table: { headers, rows }, endIdx };
}

// ============================================================================
// INLINE IMAGE PARSING
// ============================================================================

interface InlineImage {
  alt: string;
  url: string;
}

function parseInlineImage(line: string): InlineImage | null {
  const match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
  return match ? { alt: match[1], url: match[2] } : null;
}

/**
 * Pre-generate QR codes from [QR:data] placeholders in content.
 * Returns a map of data → PNG Buffer.
 */
async function prefetchQRCodes(content: string): Promise<Map<string, Buffer>> {
  const qrMap = new Map<string, Buffer>();
  const qrData = new Set<string>();

  for (const line of content.split('\n')) {
    const match = line.trim().match(/^\[QR:(.+)\]$/);
    if (match) qrData.add(match[1]);
  }

  if (qrData.size === 0) return qrMap;

  try {
    const QRCode = await import('qrcode');
    await Promise.allSettled(
      [...qrData].map(async (data) => {
        try {
          const buffer = await QRCode.toBuffer(data, {
            type: 'png',
            width: 200,
            margin: 1,
            errorCorrectionLevel: 'M',
          });
          qrMap.set(data, buffer);
        } catch {
          log.warn('Failed to generate QR code', { data: data.slice(0, 50) });
        }
      })
    );
  } catch {
    log.warn('QR code library not available');
  }

  return qrMap;
}

/**
 * Pre-fetch all inline images from content so they're available during sync rendering.
 * Returns a map of URL → Buffer.
 */
async function prefetchInlineImages(content: string): Promise<Map<string, Buffer>> {
  const imageMap = new Map<string, Buffer>();
  const urls = new Set<string>();

  for (const line of content.split('\n')) {
    const img = parseInlineImage(line);
    if (img) urls.add(img.url);
  }

  if (urls.size === 0) return imageMap;

  const results = await Promise.allSettled(
    [...urls].map(async (url) => {
      const result = await fetchImageBuffer(url);
      if (result) imageMap.set(url, result.buffer);
    })
  );

  log.info('Pre-fetched inline images', {
    requested: urls.size,
    fetched: imageMap.size,
    failed: results.filter((r) => r.status === 'rejected').length,
  });

  return imageMap;
}

// ============================================================================
// PDF GENERATION (ENHANCED)
// ============================================================================

function drawTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  table: TableData,
  fonts: ReturnType<typeof getFonts>,
  headingColor: [number, number, number]
) {
  const pageWidth = 612 - 72 - 72; // LETTER minus margins
  const colCount = table.headers.length;
  const colWidth = pageWidth / colCount;
  const cellPadding = 4;
  const rowHeight = 20;
  const startX = 72;
  let y = doc.y;

  // Check if table fits on current page, add new page if not
  const totalHeight = (table.rows.length + 1) * rowHeight + 10;
  if (y + totalHeight > 720) {
    doc.addPage();
    y = doc.y;
  }

  // Header row background
  doc.save();
  doc
    .rect(startX, y, pageWidth, rowHeight)
    .fill(headingColor.map((c) => c / 255) as unknown as string);

  // Header text
  doc.fillColor([255, 255, 255]).font(fonts.bold).fontSize(10);
  table.headers.forEach((header, i) => {
    doc.text(header, startX + i * colWidth + cellPadding, y + cellPadding, {
      width: colWidth - cellPadding * 2,
      height: rowHeight,
      align: 'left',
    });
  });
  y += rowHeight;

  // Data rows
  doc.font(fonts.regular).fontSize(10).fillColor([0, 0, 0]);
  table.rows.forEach((row, rowIdx) => {
    // Alternating row background
    if (rowIdx % 2 === 0) {
      doc.save();
      doc.rect(startX, y, pageWidth, rowHeight).fill([245, 245, 250] as unknown as string);
      doc.restore();
      doc.fillColor([0, 0, 0]);
    }

    row.forEach((cell, i) => {
      if (i < colCount) {
        doc.text(cell, startX + i * colWidth + cellPadding, y + cellPadding, {
          width: colWidth - cellPadding * 2,
          height: rowHeight,
          align: 'left',
        });
      }
    });
    y += rowHeight;
  });

  // Table border
  doc.save();
  doc.strokeColor([180, 180, 180]).lineWidth(0.5);
  // Outer border
  const tableHeight = (table.rows.length + 1) * rowHeight;
  doc.rect(startX, y - tableHeight, pageWidth, tableHeight).stroke();
  // Column lines
  for (let i = 1; i < colCount; i++) {
    doc
      .moveTo(startX + i * colWidth, y - tableHeight)
      .lineTo(startX + i * colWidth, y)
      .stroke();
  }
  // Row lines
  for (let r = 0; r <= table.rows.length; r++) {
    const rowY = y - tableHeight + (r + 1) * rowHeight;
    doc
      .moveTo(startX, rowY)
      .lineTo(startX + pageWidth, rowY)
      .stroke();
  }
  doc.restore();

  doc.y = y + 10;
  doc.x = 72;
}

function drawSignature(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  signatureBuffer: Buffer | null,
  fonts: ReturnType<typeof getFonts>
) {
  doc.moveDown(1);
  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, doc.x, doc.y, { fit: [200, 60] });
      doc.moveDown(3);
    } catch {
      // Fallback to line
    }
  }
  // Signature line
  const lineY = doc.y;
  doc.save();
  doc.strokeColor([0, 0, 0]).lineWidth(1);
  doc.moveTo(72, lineY).lineTo(300, lineY).stroke();
  doc.restore();
  doc.font(fonts.regular).fontSize(10).fillColor([100, 100, 100]);
  doc.text('Signature', 72, lineY + 4);
  doc.moveDown(0.5);
  doc.text(`Date: ${new Date().toLocaleDateString()}`);
  doc.moveDown(1);
}

async function generatePdf(
  opts: DocOptions
): Promise<{ success: boolean; data?: string; error?: string }> {
  const loaded = await initPdfkit();
  if (!loaded || !pdfkitModule) {
    return { success: false, error: 'PDF generation library not available' };
  }

  return new Promise((resolve) => {
    try {
      const PDFDocument = pdfkitModule as unknown as typeof import('pdfkit');
      const fonts = getFonts(opts.fontFamily);
      const baseFontSize = opts.fontSize || 12;
      const headingColor = parseHexColor(opts.brandColor) || [0, 0, 0];
      const pageWidth = 612 - 72 - 72;

      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        bufferPages: true,
        info: {
          Title: opts.title,
          Author: opts.author || 'JCIL AI',
          Creator: 'JCIL AI Document Generator',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        resolve({ success: true, data: Buffer.concat(chunks).toString('base64') });
      });
      doc.on('error', (err: Error) => {
        resolve({ success: false, error: err.message });
      });

      // Collect headings for TOC
      const tocEntries: { text: string; level: number; page: number }[] = [];
      let currentPage = 1;

      doc.on('pageAdded', () => {
        currentPage++;
        // Header on subsequent pages
        doc.save();
        doc
          .fontSize(8)
          .font(fonts.regular)
          .fillColor([128, 128, 128])
          .text(opts.title, 72, 30, { width: pageWidth / 2, align: 'left' })
          .text(`Page ${currentPage}`, 72 + pageWidth / 2, 30, {
            width: pageWidth / 2,
            align: 'right',
          });
        doc
          .strokeColor([200, 200, 200])
          .lineWidth(0.5)
          .moveTo(72, 50)
          .lineTo(612 - 72, 50)
          .stroke();
        doc.restore();
        doc.y = 72;
      });

      // Logo
      if (opts.logoBuffer) {
        try {
          doc.image(opts.logoBuffer, { fit: [pageWidth, 150], align: 'center', valign: 'center' });
          doc.moveDown(1.5);
        } catch (e) {
          log.warn('Failed to embed logo in PDF', { error: (e as Error).message });
        }
      }

      // Decorative line
      if (opts.brandColor) {
        doc.save();
        doc.strokeColor(headingColor).lineWidth(2);
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
        .font(fonts.bold)
        .fillColor(headingColor)
        .text(opts.title, { align: 'center' });
      doc.moveDown();

      // Author and date
      doc.fillColor([0, 0, 0]);
      if (opts.author) {
        doc
          .fontSize(baseFontSize)
          .font(fonts.italic)
          .text(`By ${opts.author}`, { align: 'center' });
      }
      doc
        .fontSize(10)
        .font(fonts.regular)
        .text(new Date().toLocaleDateString(), { align: 'center' });
      doc.moveDown(2);

      // Content rendering
      if (opts.sections && opts.sections.length > 0) {
        for (const section of opts.sections) {
          if (section.heading) {
            tocEntries.push({ text: section.heading, level: 1, page: currentPage });
            doc.fontSize(16).font(fonts.bold).fillColor(headingColor).text(section.heading);
            doc.moveDown(0.5);
          }
          renderRichMarkdown(
            doc,
            section.body,
            fonts,
            baseFontSize,
            headingColor,
            tocEntries,
            currentPage,
            opts.signatureBuffer,
            opts.inlineImages,
            opts.qrCodeBuffers
          );
          doc.moveDown();
        }
      } else {
        renderRichMarkdown(
          doc,
          opts.content,
          fonts,
          baseFontSize,
          headingColor,
          tocEntries,
          currentPage,
          opts.signatureBuffer,
          opts.inlineImages,
          opts.qrCodeBuffers
        );
      }

      // Footers on all pages
      const totalPages = doc.bufferedPageRange();
      for (let i = 0; i < totalPages.count; i++) {
        doc.switchToPage(i);
        doc.save();
        doc
          .strokeColor([200, 200, 200])
          .lineWidth(0.5)
          .moveTo(72, 756)
          .lineTo(612 - 72, 756)
          .stroke();
        doc
          .fontSize(8)
          .font(fonts.regular)
          .fillColor([128, 128, 128])
          .text(`Page ${i + 1} of ${totalPages.count}`, 72, 762, {
            width: pageWidth,
            align: 'center',
          });
        doc.restore();
      }

      doc.end();
    } catch (error) {
      resolve({ success: false, error: (error as Error).message });
    }
  });
}

/**
 * Render rich markdown content into a pdfkit document.
 * Supports: headings, bold/italic, numbered lists, bullet lists, tables,
 * inline images, page breaks (---), [TOC], [SIGNATURE].
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderRichMarkdown(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  content: string,
  fonts: ReturnType<typeof getFonts>,
  baseFontSize: number,
  headingColor: [number, number, number],
  tocEntries: { text: string; level: number; page: number }[],
  currentPage: number,
  signatureBuffer?: Buffer | null,
  inlineImages?: Map<string, Buffer>,
  qrCodeBuffers?: Map<string, Buffer>
) {
  const lines = content.split('\n');
  let i = 0;
  let numberedListCounter = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Page break
    if (line.trim() === '---' || line.trim() === '***') {
      doc.addPage();
      numberedListCounter = 0;
      i++;
      continue;
    }

    // TOC placeholder
    if (line.trim() === '[TOC]') {
      doc.fontSize(16).font(fonts.bold).fillColor(headingColor).text('Table of Contents');
      doc.moveDown(0.5);
      doc
        .fontSize(baseFontSize)
        .font(fonts.regular)
        .fillColor([0, 0, 0])
        .text('(Table of contents will appear here based on document headings)', { oblique: true });
      doc.moveDown(1);
      i++;
      continue;
    }

    // Signature placeholder
    if (line.trim() === '[SIGNATURE]') {
      drawSignature(doc, signatureBuffer || null, fonts);
      i++;
      continue;
    }

    // QR code placeholder: [QR:data] or [QR:url]
    const qrMatch = line.trim().match(/^\[QR:(.+)\]$/);
    if (qrMatch) {
      const qrBuffer = qrCodeBuffers?.get(qrMatch[1]);
      if (qrBuffer) {
        try {
          doc.image(qrBuffer, doc.x, doc.y, { fit: [120, 120] });
          doc.moveDown(6);
        } catch {
          doc
            .fontSize(baseFontSize)
            .font(fonts.italic)
            .fillColor([100, 100, 100])
            .text(`[QR Code: ${qrMatch[1]}]`);
        }
      } else {
        doc
          .fontSize(baseFontSize)
          .font(fonts.italic)
          .fillColor([100, 100, 100])
          .text(`[QR Code: ${qrMatch[1]}]`);
      }
      doc.fillColor([0, 0, 0]);
      i++;
      continue;
    }

    // Inline image: ![alt](url)
    const inlineImg = parseInlineImage(line);
    if (inlineImg) {
      const imgBuffer = inlineImages?.get(inlineImg.url);
      if (imgBuffer) {
        try {
          const pageWidth = 612 - 72 - 72;
          doc.image(imgBuffer, { fit: [pageWidth, 300], align: 'center' });
          if (inlineImg.alt) {
            doc
              .fontSize(9)
              .font(fonts.italic)
              .fillColor([100, 100, 100])
              .text(inlineImg.alt, { align: 'center' });
            doc.fillColor([0, 0, 0]);
          }
          doc.moveDown(0.5);
        } catch {
          doc
            .fontSize(baseFontSize)
            .font(fonts.italic)
            .fillColor([100, 100, 100])
            .text(`[Image: ${inlineImg.alt || inlineImg.url}]`);
          doc.fillColor([0, 0, 0]);
          doc.moveDown(0.5);
        }
      } else {
        doc
          .fontSize(baseFontSize)
          .font(fonts.italic)
          .fillColor([100, 100, 100])
          .text(`[Image: ${inlineImg.alt || inlineImg.url}]`);
        doc.fillColor([0, 0, 0]);
        doc.moveDown(0.5);
      }
      i++;
      continue;
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1]?.match(/^[\s|:-]+$/)) {
      const tableResult = parseMarkdownTable(lines, i);
      if (tableResult) {
        drawTable(doc, tableResult.table, fonts, headingColor);
        i = tableResult.endIdx;
        continue;
      }
    }

    // Headings
    if (line.startsWith('# ')) {
      tocEntries.push({ text: line.slice(2), level: 1, page: currentPage });
      doc.fontSize(20).font(fonts.bold).fillColor(headingColor).text(line.slice(2));
      doc.moveDown(0.5);
      numberedListCounter = 0;
    } else if (line.startsWith('## ')) {
      tocEntries.push({ text: line.slice(3), level: 2, page: currentPage });
      doc.fontSize(16).font(fonts.bold).fillColor(headingColor).text(line.slice(3));
      doc.moveDown(0.5);
      numberedListCounter = 0;
    } else if (line.startsWith('### ')) {
      tocEntries.push({ text: line.slice(4), level: 3, page: currentPage });
      doc.fontSize(14).font(fonts.bold).fillColor(headingColor).text(line.slice(4));
      doc.moveDown(0.5);
      numberedListCounter = 0;
    }
    // Bullet lists
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      numberedListCounter = 0;
      const text = renderInlineFormatting(line.slice(2));
      doc.fontSize(baseFontSize).font(fonts.regular).fillColor([0, 0, 0]);
      doc.text(`  • ${text}`, { indent: 15 });
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(line)) {
      numberedListCounter++;
      const text = renderInlineFormatting(line.replace(/^\d+\.\s/, ''));
      doc.fontSize(baseFontSize).font(fonts.regular).fillColor([0, 0, 0]);
      doc.text(`  ${numberedListCounter}. ${text}`, { indent: 15 });
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      numberedListCounter = 0;
      doc.save();
      // Draw left bar
      doc.strokeColor(headingColor).lineWidth(3);
      doc
        .moveTo(80, doc.y)
        .lineTo(80, doc.y + 16)
        .stroke();
      doc.restore();
      const text = renderInlineFormatting(line.slice(2));
      doc
        .fontSize(baseFontSize)
        .font(fonts.italic)
        .fillColor([80, 80, 80])
        .text(text, { indent: 20, align: 'left' });
      doc.fillColor([0, 0, 0]);
    }
    // Empty line
    else if (line.trim() === '') {
      doc.moveDown(0.5);
      numberedListCounter = 0;
    }
    // Regular paragraph with inline formatting and hyperlinks
    else {
      numberedListCounter = 0;
      renderTextWithLinks(doc, line, fonts, baseFontSize);
    }

    i++;
  }
}

/**
 * Process inline **bold** and *italic* markers.
 * Returns cleaned text (pdfkit doesn't support mixed-font inline, so we strip markers).
 */
function renderInlineFormatting(text: string): string {
  // Strip bold and italic markers for now (pdfkit can't mix fonts inline easily)
  let result = text;
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/\*([^*]+)\*/g, '$1');
  result = result.replace(/__([^_]+)__/g, '$1');
  result = result.replace(/_([^_]+)_/g, '$1');
  result = result.replace(/`([^`]+)`/g, '$1');
  return result;
}

/**
 * Render a line of text with clickable hyperlinks in pdfkit.
 * Supports markdown [text](url) links and bare https:// URLs.
 */
function renderTextWithLinks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  line: string,
  fonts: ReturnType<typeof getFonts>,
  baseFontSize: number
) {
  // Match markdown links [text](url) or bare URLs
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/\S+)/g;
  let lastIndex = 0;
  let hasLinks = false;

  const segments: { text: string; link?: string }[] = [];
  let match;

  while ((match = linkRegex.exec(line)) !== null) {
    hasLinks = true;
    // Text before the link
    if (match.index > lastIndex) {
      segments.push({ text: renderInlineFormatting(line.slice(lastIndex, match.index)) });
    }
    if (match[1] && match[2]) {
      // Markdown link [text](url)
      segments.push({ text: match[1], link: match[2] });
    } else if (match[3]) {
      // Bare URL
      segments.push({ text: match[3], link: match[3] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (!hasLinks) {
    // No links — render as plain text
    const text = renderInlineFormatting(line);
    doc
      .fontSize(baseFontSize)
      .font(fonts.regular)
      .fillColor([0, 0, 0])
      .text(text, { align: 'justify' });
    return;
  }

  // Remaining text after last link
  if (lastIndex < line.length) {
    segments.push({ text: renderInlineFormatting(line.slice(lastIndex)) });
  }

  // Render segments inline using pdfkit's continued text
  doc.fontSize(baseFontSize);
  segments.forEach((seg, idx) => {
    const isLast = idx === segments.length - 1;
    if (seg.link) {
      doc.font(fonts.regular).fillColor([0, 102, 204]).text(seg.text, {
        link: seg.link,
        underline: true,
        continued: !isLast,
      });
    } else {
      doc.font(fonts.regular).fillColor([0, 0, 0]).text(seg.text, {
        continued: !isLast,
      });
    }
  });
}

// ============================================================================
// DOCX GENERATION (ENHANCED)
// ============================================================================

async function generateDocx(
  opts: DocOptions
): Promise<{ success: boolean; data?: string; error?: string }> {
  const loaded = await initDocx();
  if (!loaded || !docxModule) {
    return { success: false, error: 'DOCX generation library not available' };
  }

  try {
    const {
      Document,
      Packer,
      Paragraph,
      TextRun,
      HeadingLevel,
      AlignmentType,
      ImageRun,
      Table,
      TableRow,
      TableCell,
      WidthType,
      BorderStyle,
      Header,
      Footer,
      PageNumber,
      NumberFormat,
    } = docxModule;

    const children: (typeof Paragraph.prototype)[] = [];
    const headingColorHex = (opts.brandColor || '000000').replace('#', '');

    // Logo
    if (opts.logoBuffer) {
      try {
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: opts.logoBuffer,
                transformation: { width: 200, height: 80 },
                type: 'png',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );
      } catch {
        log.warn('Failed to embed logo in DOCX');
      }
    }

    // Title
    children.push(
      new Paragraph({
        children: [new TextRun({ text: opts.title, bold: true, size: 48, color: headingColorHex })],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      })
    );

    if (opts.author) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `By ${opts.author}`, italics: true })],
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
    const content = opts.sections
      ? opts.sections.map((s) => (s.heading ? `## ${s.heading}\n${s.body}` : s.body)).join('\n\n')
      : opts.content;

    const lines = content.split('\n');

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];

      // Page break
      if (line.trim() === '---' || line.trim() === '***') {
        children.push(new Paragraph({ children: [], pageBreakBefore: true }));
        continue;
      }

      // Signature
      if (line.trim() === '[SIGNATURE]') {
        children.push(
          new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 400 } })
        );
        children.push(
          new Paragraph({
            children: [new TextRun({ text: '________________________________' })],
          })
        );
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Signature', italics: true, size: 18, color: '666666' }),
            ],
          })
        );
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Date: ${new Date().toLocaleDateString()}`,
                size: 18,
                color: '666666',
              }),
            ],
          })
        );
        continue;
      }

      // Table
      if (line.includes('|') && li + 1 < lines.length && lines[li + 1]?.match(/^[\s|:-]+$/)) {
        const tableResult = parseMarkdownTable(lines, li);
        if (tableResult) {
          const { table } = tableResult;
          const tableRows = [];

          // Header row
          tableRows.push(
            new TableRow({
              children: table.headers.map(
                (h) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20 })],
                      }),
                    ],
                    shading: {
                      fill: headingColorHex,
                      type: 'clear' as unknown as undefined,
                      color: headingColorHex,
                    },
                  })
              ),
            })
          );

          // Data rows
          table.rows.forEach((row) => {
            tableRows.push(
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: cell, size: 20 })] }),
                      ],
                    })
                ),
              })
            );
          });

          children.push(
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              },
            }) as unknown as typeof Paragraph.prototype
          );
          children.push(new Paragraph({ children: [] })); // spacing
          li = tableResult.endIdx - 1;
          continue;
        }
      }

      // Headings
      if (line.startsWith('# ')) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: line.slice(2), bold: true, size: 36, color: headingColorHex }),
            ],
            heading: HeadingLevel.HEADING_1,
          })
        );
      } else if (line.startsWith('## ')) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: line.slice(3), bold: true, size: 28, color: headingColorHex }),
            ],
            heading: HeadingLevel.HEADING_2,
          })
        );
      } else if (line.startsWith('### ')) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: line.slice(4), bold: true, size: 24, color: headingColorHex }),
            ],
            heading: HeadingLevel.HEADING_3,
          })
        );
      }
      // Bullet lists
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        children.push(
          new Paragraph({
            children: parseInlineRuns(line.slice(2), docxModule!),
            bullet: { level: 0 },
          })
        );
      }
      // Numbered lists
      else if (/^\d+\.\s/.test(line)) {
        const text = line.replace(/^\d+\.\s/, '');
        children.push(
          new Paragraph({
            children: parseInlineRuns(text, docxModule!),
            numbering: { reference: 'default-numbering', level: 0 },
          })
        );
      }
      // Blockquote
      else if (line.startsWith('> ')) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line.slice(2), italics: true, color: '555555' })],
            indent: { left: 720 },
            border: { left: { style: BorderStyle.SINGLE, size: 6, color: headingColorHex } },
          })
        );
      }
      // Regular text
      else if (line.trim() !== '') {
        children.push(new Paragraph({ children: parseInlineRuns(line, docxModule!) }));
      }
    }

    // Create doc with header/footer
    const doc = new Document({
      creator: 'JCIL AI',
      title: opts.title,
      numbering: {
        config: [
          {
            reference: 'default-numbering',
            levels: [
              {
                level: 0,
                format: NumberFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.START,
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: opts.title, size: 16, color: '888888' })],
                  alignment: AlignmentType.LEFT,
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
                      size: 16,
                      color: '888888',
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return { success: true, data: buffer.toString('base64') };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Parse inline **bold** and *italic* into docx TextRuns.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseInlineRuns(text: string, docx: any): any[] {
  const { TextRun } = docx;
  const runs: unknown[] = [];
  // Split on bold/italic markers
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_)/g);

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
    } else if (part.startsWith('__') && part.endsWith('__')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (part.startsWith('_') && part.endsWith('_')) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
    } else if (part) {
      runs.push(new TextRun({ text: part }));
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}

// ============================================================================
// DOCX TEMPLATE FILLING
// ============================================================================

async function fillDocxTemplate(
  toolCallId: string,
  title: string,
  templateBase64: string,
  fields: Record<string, string>
): Promise<UnifiedToolResult> {
  const loaded = await initDocx();
  if (!loaded || !docxModule) {
    return {
      toolCallId,
      content: 'DOCX library not available for template filling',
      isError: true,
    };
  }

  try {
    const { patchDocument, PatchType, TextRun } = docxModule;
    const templateBuffer = Buffer.from(templateBase64, 'base64');

    // Build patches from fields — each key maps to a {{key}} placeholder in template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patches: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      patches[key] = {
        type: PatchType.PARAGRAPH,
        children: [new TextRun(value)],
      };
    }

    const resultUint8Array = await patchDocument({
      outputType: 'uint8array' as const,
      data: templateBuffer,
      patches,
    });

    const base64 = Buffer.from(resultUint8Array as Uint8Array).toString('base64');
    const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
    const dataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`;

    log.info('DOCX template filled', { title, fieldsCount: Object.keys(fields).length });

    return {
      toolCallId,
      content: `Template filled successfully!\n\n**Title:** ${title}\n**Fields filled:** ${Object.keys(fields).length}\n**Filename:** ${filename}\n\n[Download ${filename}](${dataUrl})`,
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId,
      content: `Template filling failed: ${(error as Error).message}`,
      isError: true,
    };
  }
}

// ============================================================================
// TXT GENERATION
// ============================================================================

function generateTxt(opts: DocOptions): { success: boolean; data?: string; error?: string } {
  try {
    let text = `${opts.title}\n${'='.repeat(opts.title.length)}\n\n`;

    if (opts.author) text += `By ${opts.author}\n`;
    text += `Date: ${new Date().toLocaleDateString()}\n\n`;
    text += '-'.repeat(40) + '\n\n';

    if (opts.sections && opts.sections.length > 0) {
      for (const section of opts.sections) {
        if (section.heading)
          text += `${section.heading}\n${'-'.repeat(section.heading.length)}\n\n`;
        text += `${section.body}\n\n`;
      }
    } else {
      let cleanContent = opts.content;
      cleanContent = cleanContent.replace(/^#{1,3} /gm, '');
      cleanContent = cleanContent.replace(/\*\*([^*]+)\*\*/g, '$1');
      cleanContent = cleanContent.replace(/\*([^*]+)\*/g, '$1');
      text += cleanContent;
    }

    return { success: true, data: Buffer.from(text, 'utf-8').toString('base64') };
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
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  let args: Record<string, unknown>;
  if (typeof rawArgs === 'string') {
    try {
      args = JSON.parse(rawArgs) as Record<string, unknown>;
    } catch {
      return {
        toolCallId: id,
        content:
          'Failed to parse document arguments — the request may have been truncated. ' +
          'Try simplifying the document (fewer sections or shorter content) and try again.',
        isError: true,
      };
    }
  } else {
    args = rawArgs as Record<string, unknown>;
  }
  const format = args.format as string;
  const title = args.title as string;
  const content = args.content as string;
  const author = args.author as string | undefined;
  const sections = args.sections as Section[] | undefined;
  const logoUrl = args.logoUrl as string | undefined;
  const brandColor = args.brandColor as string | undefined;
  const fontFamily = args.fontFamily as string | undefined;
  const fontSize = args.fontSize as number | undefined;
  const includeTableOfContents = args.includeTableOfContents as boolean | undefined;
  const signatureUrl = args.signatureUrl as string | undefined;
  const templateData = args.templateData as string | undefined;
  const templateFields = args.templateFields as Record<string, string> | undefined;

  if (!format || !['pdf', 'docx', 'txt'].includes(format)) {
    return { toolCallId: id, content: 'Invalid format. Use pdf, docx, or txt.', isError: true };
  }
  if (!title) {
    return { toolCallId: id, content: 'Document title is required', isError: true };
  }

  // DOCX template filling mode
  if (templateData && templateFields && format === 'docx') {
    return fillDocxTemplate(id, title, templateData, templateFields);
  }

  if (!content && (!sections || sections.length === 0)) {
    return { toolCallId: id, content: 'Document content is required', isError: true };
  }

  log.info('Generating document', { format, title, hasLogo: !!logoUrl, brandColor, fontFamily });

  // Fetch all images and generate QR codes in parallel
  const allContent = sections ? sections.map((s) => s.body).join('\n') : content;
  const [logoResult, signatureResult, inlineImages, qrCodeBuffers] = await Promise.all([
    logoUrl ? fetchImageBuffer(logoUrl) : Promise.resolve(null),
    signatureUrl ? fetchImageBuffer(signatureUrl) : Promise.resolve(null),
    prefetchInlineImages(allContent),
    prefetchQRCodes(allContent),
  ]);

  const opts: DocOptions = {
    title,
    content,
    author,
    sections,
    logoBuffer: logoResult?.buffer || null,
    brandColor,
    fontFamily,
    fontSize,
    includeTableOfContents,
    signatureBuffer: signatureResult?.buffer || null,
    inlineImages,
    qrCodeBuffers,
  };

  let result: { success: boolean; data?: string; error?: string };

  switch (format) {
    case 'pdf':
      result = await generatePdf(opts);
      break;
    case 'docx':
      result = await generateDocx(opts);
      break;
    case 'txt':
      result = generateTxt(opts);
      break;
    default:
      result = { success: false, error: 'Unknown format' };
  }

  if (!result.success) {
    return { toolCallId: id, content: result.error || 'Document generation failed', isError: true };
  }

  log.info('Document generated successfully', { format, title });

  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  };

  const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.${format}`;
  const buffer = Buffer.from(result.data!, 'base64');

  // Upload to Supabase storage if userId is available (passed through toolCall context)
  const userId = (toolCall as unknown as Record<string, unknown>).userId as string | undefined;
  if (userId) {
    try {
      const uploadResult = await uploadDocument(userId, buffer, filename, mimeTypes[format]);
      if (uploadResult.storage === 'supabase') {
        return {
          toolCallId: id,
          content: `Document generated successfully!\n\n**Title:** ${title}\n**Format:** ${format.toUpperCase()}\n**Filename:** ${filename}\n\n[Download ${filename}](${uploadResult.url})`,
          isError: false,
        };
      }
    } catch (uploadError) {
      log.warn('Document upload failed, falling back to data URL', {
        error: (uploadError as Error).message,
      });
    }
  }

  // Fallback to base64 data URL
  const dataUrl = `data:${mimeTypes[format]};base64,${result.data}`;
  return {
    toolCallId: id,
    content: `Document generated successfully!\n\n**Title:** ${title}\n**Format:** ${format.toUpperCase()}\n**Filename:** ${filename}\n\n[Download ${filename}](${dataUrl})`,
    isError: false,
  };
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isDocumentAvailable(): boolean {
  return true;
}
