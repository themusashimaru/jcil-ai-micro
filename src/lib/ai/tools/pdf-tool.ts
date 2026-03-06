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
 * - Add text at precise coordinates on any page
 * - Embed images (PNG/JPEG) at precise coordinates on any page
 * - Fill PDF form fields (AcroForm)
 * - Overlay text on non-fillable PDFs (smart form filling)
 * - Get PDF info and form field metadata
 *
 * Created: 2026-01-31
 * Updated: 2026-03-06 — Added image embedding, form filling, multi-field overlay
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('PDFTool');

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

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Fetch an image from a URL and return it as a Buffer with content type.
 */
async function fetchImageForPdf(url: string): Promise<{ buffer: Buffer; isPng: boolean } | null> {
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return null;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'JCIL-AI-PDFTool/1.0' },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) return null;

    return {
      buffer: Buffer.from(arrayBuffer),
      isPng: contentType.includes('png'),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const pdfTool: UnifiedTool = {
  name: 'pdf_manipulate',
  description: `Advanced PDF manipulation tool. Create, modify, fill forms, embed images, and draw shapes in PDFs.

Operations:
- create: Create a new PDF from text content
- merge: Combine multiple PDFs into one
- split: Extract specific pages from a PDF
- watermark: Add text watermark to all pages
- add_text: Add text at precise x,y coordinates on any page (for filling non-form PDFs)
- add_image: Embed a PNG/JPEG image at precise x,y coordinates on any page
- fill_form: Fill PDF form fields (AcroForm) by field name
- overlay_fields: Add multiple text fields at precise positions in one call (batch form filling)
- draw_shapes: Draw lines, rectangles, circles, and checkboxes on any page
- get_info: Get PDF metadata, page count, page dimensions, and form field names/types

Use add_text or overlay_fields for PDFs that look like forms but don't have fillable fields.
Use fill_form for PDFs with actual AcroForm fields.
Use add_image to insert logos, photos, signatures, or any image into a PDF.
Use draw_shapes to add lines, boxes, checkboxes, or circles for form structure.

Coordinate system: origin (0,0) is bottom-left of the page. Y increases upward.
Typical letter page: 612 x 792 points (8.5 x 11 inches, 72 points per inch).

Returns: Base64 encoded PDF or metadata`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'create',
          'merge',
          'split',
          'watermark',
          'add_text',
          'add_image',
          'fill_form',
          'overlay_fields',
          'get_info',
          'draw_shapes',
        ],
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
        description: 'X position in points from left edge (default: 50)',
      },
      y: {
        type: 'number',
        description: 'Y position in points from bottom edge (default: 50)',
      },
      width: {
        type: 'number',
        description: 'For add_image: display width in points',
      },
      height: {
        type: 'number',
        description: 'For add_image: display height in points',
      },
      page_number: {
        type: 'number',
        description: 'Page number (1-indexed, default: 1)',
      },
      font_size: {
        type: 'number',
        description: 'Font size in points (default: 12)',
      },
      color: {
        type: 'string',
        description: 'Text color as hex (e.g. "#000000"). Default: black',
      },
      image_url: {
        type: 'string',
        description: 'For add_image: URL of PNG or JPEG image to embed',
      },
      image_data: {
        type: 'string',
        description:
          'For add_image: Base64 encoded image data (PNG or JPEG). Use this for user-uploaded images.',
      },
      image_type: {
        type: 'string',
        enum: ['png', 'jpg'],
        description: 'Image format when using image_data (default: png)',
      },
      form_fields: {
        type: 'object',
        description:
          'For fill_form: object mapping field names to values. Example: {"firstName": "John", "lastName": "Doe"}',
      },
      fields: {
        type: 'array',
        description: `For overlay_fields: array of text placements. Each item: { text, x, y, page_number?, font_size?, color? }. Example: [{"text": "John Doe", "x": 150, "y": 680, "font_size": 11}, {"text": "03/06/2026", "x": 400, "y": 680}]`,
        items: { type: 'object' },
      },
      shapes: {
        type: 'array',
        description: `For draw_shapes: array of shape definitions. Each shape has a "type" field.
Types:
- line: { type: "line", x1, y1, x2, y2, color?, line_width?, page_number? }
- rectangle: { type: "rectangle", x, y, width, height, color?, fill_color?, line_width?, page_number? }
- circle: { type: "circle", cx, cy, radius, color?, fill_color?, line_width?, page_number? }
- checkbox: { type: "checkbox", x, y, size?, checked?, color?, page_number? }
Example: [{"type": "checkbox", "x": 72, "y": 700, "checked": true}, {"type": "line", "x1": 72, "y1": 650, "x2": 300, "y2": 650}]`,
        items: { type: 'object' },
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
// HELPERS
// ============================================================================

function parseHexToRgb(hex: string | undefined): [number, number, number] {
  if (!hex) return [0, 0, 0];
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [0, 0, 0];
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

interface OverlayField {
  text: string;
  x: number;
  y: number;
  page_number?: number;
  font_size?: number;
  color?: string;
}

interface ShapeDefinition {
  type: 'line' | 'rectangle' | 'circle' | 'checkbox';
  // Line: x1,y1 to x2,y2
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // Rectangle/Circle/Checkbox: position and size
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  cx?: number;
  cy?: number;
  radius?: number;
  size?: number;
  checked?: boolean;
  color?: string;
  fill_color?: string;
  line_width?: number;
  page_number?: number;
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
    width?: number;
    height?: number;
    page_number?: number;
    font_size?: number;
    color?: string;
    image_url?: string;
    image_data?: string;
    image_type?: string;
    form_fields?: Record<string, string>;
    fields?: OverlayField[];
    shapes?: ShapeDefinition[];
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
      // ────────────────────────────────────────────────────────────────
      // CREATE
      // ────────────────────────────────────────────────────────────────
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

        const lines = args.content.split('\n');
        const linesPerPage = Math.floor(700 / (fontSize + 4));

        for (let i = 0; i < lines.length; i += linesPerPage) {
          const page = doc.addPage([612, 792]);
          const pageLines = lines.slice(i, i + linesPerPage);

          pageLines.forEach((line: string, idx: number) => {
            page.drawText(line.substring(0, 80), {
              x: 50,
              y: 742 - idx * (fontSize + 4),
              size: fontSize,
              font,
            });
          });
        }

        if (args.title) doc.setTitle(args.title);

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

      // ────────────────────────────────────────────────────────────────
      // MERGE
      // ────────────────────────────────────────────────────────────────
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

      // ────────────────────────────────────────────────────────────────
      // SPLIT
      // ────────────────────────────────────────────────────────────────
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

        const pageIndices = args.pages.map((p) => p - 1);
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

      // ────────────────────────────────────────────────────────────────
      // WATERMARK
      // ────────────────────────────────────────────────────────────────
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

      // ────────────────────────────────────────────────────────────────
      // ADD TEXT (single field at precise coordinates)
      // ────────────────────────────────────────────────────────────────
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
        const [r, g, b] = parseHexToRgb(args.color);

        page.drawText(args.text, {
          x: args.x || 50,
          y: args.y || 50,
          size: args.font_size || 12,
          font,
          color: rgb(r, g, b),
        });

        const modifiedBytes = await doc.save();
        const base64 = Buffer.from(modifiedBytes).toString('base64');

        result = {
          operation: 'add_text',
          text_added: args.text,
          page: args.page_number || 1,
          position: { x: args.x || 50, y: args.y || 50 },
          pdf_base64: base64,
          size_bytes: modifiedBytes.length,
        };
        break;
      }

      // ────────────────────────────────────────────────────────────────
      // ADD IMAGE (embed PNG/JPEG at precise coordinates)
      // ────────────────────────────────────────────────────────────────
      case 'add_image': {
        if (!args.pdf_data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'PDF data required for add_image' }),
            isError: true,
          };
        }
        if (!args.image_url && !args.image_data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({
              error: 'Either image_url or image_data (base64) is required',
            }),
            isError: true,
          };
        }

        const pdfBytes = Buffer.from(args.pdf_data, 'base64');
        const doc = await PDFDocument.load(pdfBytes);
        const pageNum = (args.page_number || 1) - 1;
        const page = doc.getPage(pageNum);

        // Get image buffer
        let imageBuffer: Buffer;
        let isPng = true;

        if (args.image_data) {
          // User-uploaded base64 image
          imageBuffer = Buffer.from(args.image_data, 'base64');
          isPng = args.image_type !== 'jpg';
        } else {
          // Fetch from URL
          const fetched = await fetchImageForPdf(args.image_url!);
          if (!fetched) {
            return {
              toolCallId: toolCall.id,
              content: JSON.stringify({ error: 'Failed to fetch image from URL' }),
              isError: true,
            };
          }
          imageBuffer = fetched.buffer;
          isPng = fetched.isPng;
        }

        // Embed image in PDF
        const embeddedImage = isPng
          ? await doc.embedPng(imageBuffer)
          : await doc.embedJpg(imageBuffer);

        // Calculate dimensions — preserve aspect ratio if only one dimension given
        const naturalWidth = embeddedImage.width;
        const naturalHeight = embeddedImage.height;
        let drawWidth = args.width || naturalWidth;
        let drawHeight = args.height || naturalHeight;

        if (args.width && !args.height) {
          drawHeight = (naturalHeight / naturalWidth) * args.width;
        } else if (args.height && !args.width) {
          drawWidth = (naturalWidth / naturalHeight) * args.height;
        }

        page.drawImage(embeddedImage, {
          x: args.x || 50,
          y: args.y || 50,
          width: drawWidth,
          height: drawHeight,
        });

        const modifiedBytes = await doc.save();
        const base64 = Buffer.from(modifiedBytes).toString('base64');

        log.info('Image embedded in PDF', {
          page: pageNum + 1,
          size: `${drawWidth}x${drawHeight}`,
          format: isPng ? 'PNG' : 'JPEG',
        });

        result = {
          operation: 'add_image',
          page: args.page_number || 1,
          position: { x: args.x || 50, y: args.y || 50 },
          dimensions: { width: drawWidth, height: drawHeight },
          format: isPng ? 'PNG' : 'JPEG',
          pdf_base64: base64,
          size_bytes: modifiedBytes.length,
        };
        break;
      }

      // ────────────────────────────────────────────────────────────────
      // FILL FORM (AcroForm fields by name)
      // ────────────────────────────────────────────────────────────────
      case 'fill_form': {
        if (!args.pdf_data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'PDF data required for fill_form' }),
            isError: true,
          };
        }
        if (!args.form_fields || Object.keys(args.form_fields).length === 0) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'form_fields object required' }),
            isError: true,
          };
        }

        const pdfBytes = Buffer.from(args.pdf_data, 'base64');
        const doc = await PDFDocument.load(pdfBytes);

        let form;
        try {
          form = doc.getForm();
        } catch {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({
              error:
                'This PDF does not contain fillable form fields. Use overlay_fields or add_text instead to place text at specific coordinates.',
            }),
            isError: true,
          };
        }

        const filledFields: string[] = [];
        const failedFields: string[] = [];

        for (const [fieldName, value] of Object.entries(args.form_fields)) {
          try {
            const field = form.getTextField(fieldName);
            field.setText(value);
            filledFields.push(fieldName);
          } catch {
            // Try other field types
            try {
              const checkbox = form.getCheckBox(fieldName);
              if (value === 'true' || value === 'yes' || value === '1') {
                checkbox.check();
              } else {
                checkbox.uncheck();
              }
              filledFields.push(fieldName);
            } catch {
              try {
                const dropdown = form.getDropdown(fieldName);
                dropdown.select(value);
                filledFields.push(fieldName);
              } catch {
                failedFields.push(fieldName);
              }
            }
          }
        }

        // Flatten form so fields are no longer editable (looks clean)
        form.flatten();

        const filledBytes = await doc.save();
        const base64 = Buffer.from(filledBytes).toString('base64');

        log.info('PDF form filled', { filled: filledFields.length, failed: failedFields.length });

        result = {
          operation: 'fill_form',
          filled_fields: filledFields,
          failed_fields: failedFields,
          pdf_base64: base64,
          size_bytes: filledBytes.length,
        };
        break;
      }

      // ────────────────────────────────────────────────────────────────
      // OVERLAY FIELDS (batch text placement — smart form filling)
      // ────────────────────────────────────────────────────────────────
      case 'overlay_fields': {
        if (!args.pdf_data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'PDF data required for overlay_fields' }),
            isError: true,
          };
        }
        if (!args.fields || args.fields.length === 0) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'fields array required for overlay_fields' }),
            isError: true,
          };
        }

        const pdfBytes = Buffer.from(args.pdf_data, 'base64');
        const doc = await PDFDocument.load(pdfBytes);
        const font = await doc.embedFont(StandardFonts.Helvetica);

        let placedCount = 0;

        for (const field of args.fields) {
          if (!field.text || field.x === undefined || field.y === undefined) continue;

          const pageIdx = (field.page_number || 1) - 1;
          if (pageIdx < 0 || pageIdx >= doc.getPageCount()) continue;

          const page = doc.getPage(pageIdx);
          const [r, g, b] = parseHexToRgb(field.color);

          page.drawText(String(field.text), {
            x: field.x,
            y: field.y,
            size: field.font_size || 12,
            font,
            color: rgb(r, g, b),
          });
          placedCount++;
        }

        const modifiedBytes = await doc.save();
        const base64 = Buffer.from(modifiedBytes).toString('base64');

        log.info('PDF overlay fields placed', {
          requested: args.fields.length,
          placed: placedCount,
        });

        result = {
          operation: 'overlay_fields',
          fields_placed: placedCount,
          fields_requested: args.fields.length,
          pdf_base64: base64,
          size_bytes: modifiedBytes.length,
        };
        break;
      }

      // ────────────────────────────────────────────────────────────────
      // DRAW SHAPES (lines, rectangles, circles, checkboxes)
      // ────────────────────────────────────────────────────────────────
      case 'draw_shapes': {
        if (!args.pdf_data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'PDF data required for draw_shapes' }),
            isError: true,
          };
        }
        if (!args.shapes || args.shapes.length === 0) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'shapes array required for draw_shapes' }),
            isError: true,
          };
        }

        const pdfBytes = Buffer.from(args.pdf_data, 'base64');
        const doc = await PDFDocument.load(pdfBytes);
        let drawnCount = 0;

        for (const shape of args.shapes) {
          if (!shape.type) continue;

          const pageIdx = (shape.page_number || 1) - 1;
          if (pageIdx < 0 || pageIdx >= doc.getPageCount()) continue;

          const page = doc.getPage(pageIdx);
          const [sr, sg, sb] = parseHexToRgb(shape.color);
          const strokeColor = rgb(sr, sg, sb);
          const lineWidth = shape.line_width || 1;

          switch (shape.type) {
            case 'line': {
              if (shape.x1 == null || shape.y1 == null || shape.x2 == null || shape.y2 == null)
                continue;
              page.drawLine({
                start: { x: shape.x1, y: shape.y1 },
                end: { x: shape.x2, y: shape.y2 },
                thickness: lineWidth,
                color: strokeColor,
              });
              drawnCount++;
              break;
            }

            case 'rectangle': {
              if (shape.x == null || shape.y == null || !shape.width || !shape.height) continue;
              const rectOpts: Record<string, unknown> = {
                x: shape.x,
                y: shape.y,
                width: shape.width,
                height: shape.height,
                borderWidth: lineWidth,
                borderColor: strokeColor,
              };
              if (shape.fill_color) {
                const [fr, fg, fb] = parseHexToRgb(shape.fill_color);
                rectOpts.color = rgb(fr, fg, fb);
              }
              page.drawRectangle(rectOpts);
              drawnCount++;
              break;
            }

            case 'circle': {
              if (shape.cx == null || shape.cy == null || !shape.radius) continue;
              const circleOpts: Record<string, unknown> = {
                x: shape.cx,
                y: shape.cy,
                size: shape.radius,
                borderWidth: lineWidth,
                borderColor: strokeColor,
              };
              if (shape.fill_color) {
                const [fr, fg, fb] = parseHexToRgb(shape.fill_color);
                circleOpts.color = rgb(fr, fg, fb);
              }
              page.drawCircle(circleOpts);
              drawnCount++;
              break;
            }

            case 'checkbox': {
              const cbSize = shape.size || 12;
              const cbX = shape.x || 0;
              const cbY = shape.y || 0;
              // Draw box
              page.drawRectangle({
                x: cbX,
                y: cbY,
                width: cbSize,
                height: cbSize,
                borderWidth: lineWidth,
                borderColor: strokeColor,
              });
              // Draw check mark if checked
              if (shape.checked) {
                page.drawLine({
                  start: { x: cbX + 2, y: cbY + cbSize * 0.4 },
                  end: { x: cbX + cbSize * 0.4, y: cbY + 2 },
                  thickness: lineWidth + 0.5,
                  color: strokeColor,
                });
                page.drawLine({
                  start: { x: cbX + cbSize * 0.4, y: cbY + 2 },
                  end: { x: cbX + cbSize - 2, y: cbY + cbSize - 2 },
                  thickness: lineWidth + 0.5,
                  color: strokeColor,
                });
              }
              drawnCount++;
              break;
            }
          }
        }

        const modifiedBytes = await doc.save();
        const base64 = Buffer.from(modifiedBytes).toString('base64');

        log.info('PDF shapes drawn', { requested: args.shapes.length, drawn: drawnCount });

        result = {
          operation: 'draw_shapes',
          shapes_drawn: drawnCount,
          shapes_requested: args.shapes.length,
          pdf_base64: base64,
          size_bytes: modifiedBytes.length,
        };
        break;
      }

      // ────────────────────────────────────────────────────────────────
      // GET INFO (metadata, page sizes, form fields)
      // ────────────────────────────────────────────────────────────────
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

        // Page dimensions
        const pageSizes = doc
          .getPages()
          .map((page: { getSize: () => { width: number; height: number } }, idx: number) => {
            const { width, height } = page.getSize();
            return { page: idx + 1, width: Math.round(width), height: Math.round(height) };
          });

        // Form field detection
        let formFields: { name: string; type: string }[] = [];
        try {
          const form = doc.getForm();
          const fields = form.getFields();
          formFields = fields.map(
            (field: { getName: () => string; constructor: { name: string } }) => ({
              name: field.getName(),
              type: field.constructor.name.replace('PDF', '').replace('Field', '').toLowerCase(),
            })
          );
        } catch {
          // No form in this PDF
        }

        result = {
          operation: 'get_info',
          page_count: doc.getPageCount(),
          page_sizes: pageSizes,
          title: doc.getTitle() || null,
          author: doc.getAuthor() || null,
          subject: doc.getSubject() || null,
          creator: doc.getCreator() || null,
          producer: doc.getProducer() || null,
          creation_date: doc.getCreationDate()?.toISOString() || null,
          modification_date: doc.getModificationDate()?.toISOString() || null,
          has_form: formFields.length > 0,
          form_fields: formFields.length > 0 ? formFields : undefined,
          hint:
            formFields.length > 0
              ? 'This PDF has fillable form fields. Use fill_form with field names above.'
              : 'This PDF has no fillable fields. Use overlay_fields or add_text to place text at x,y coordinates.',
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
