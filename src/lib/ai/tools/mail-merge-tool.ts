/**
 * MAIL MERGE / BATCH DOCUMENT GENERATION TOOL
 *
 * Generates multiple personalized documents from a template + dataset.
 * Like mail merge in Word, but for PDF, DOCX, TXT, and even presentations.
 *
 * Features:
 * - Template with {{placeholder}} syntax
 * - Data from JSON array or CSV-style input
 * - Conditional sections: {{#if field}}...{{/if}}
 * - Loops: {{#each items}}...{{/each}}
 * - Computed fields: {{fullName}} from first + last
 * - Output as ZIP of individual files or single merged PDF
 * - Personalized filenames
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('MailMergeTool');

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const mailMergeTool: UnifiedTool = {
  name: 'mail_merge',
  description: `Generate multiple personalized documents from a template and dataset. Use this when:
- User needs to create many similar documents with different data (e.g., offer letters, certificates, invoices)
- User says "mail merge", "batch generate", "personalize for each..."
- User has a list/CSV of data and a template document

The template uses {{placeholder}} syntax. Supports:
- Simple replacement: {{name}}, {{email}}, {{company}}
- Conditionals: {{#if premium}}Premium member{{/if}}
- Formatting: {{date:YYYY-MM-DD}}, {{amount:currency}}
- Computed: {{fullName}} from {{firstName}} + {{lastName}}

Returns a ZIP file containing all generated documents, or a merged PDF.`,
  parameters: {
    type: 'object',
    properties: {
      template: {
        type: 'string',
        description:
          'Document template text with {{placeholder}} syntax. Supports markdown formatting, tables, headers, etc.',
      },
      data: {
        type: 'array',
        description:
          'Array of data objects. Each object generates one document. Example: [{"name": "John", "role": "Engineer"}, {"name": "Jane", "role": "Designer"}]',
        items: { type: 'object' },
      },
      output_format: {
        type: 'string',
        description: 'Format for each document: "pdf" (default), "txt", "docx"',
      },
      filename_template: {
        type: 'string',
        description: 'Filename pattern for each file: e.g., "letter_{{name}}" (without extension)',
      },
      merge_into_single_pdf: {
        type: 'boolean',
        description:
          'If true, merge all PDFs into one file instead of ZIP. Only works with pdf format.',
      },
      document_title: {
        type: 'string',
        description: 'Title for all generated documents',
      },
    },
    required: ['template', 'data'],
  },
};

// ============================================================================
// TEMPLATE ENGINE
// ============================================================================

function processTemplate(template: string, record: Record<string, unknown>): string {
  let result = template;

  // Process conditionals: {{#if field}}content{{/if}}
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, field, content) => {
      const value = record[field];
      if (value && value !== 'false' && value !== '0' && value !== 'no') {
        return content;
      }
      return '';
    }
  );

  // Process negative conditionals: {{#unless field}}content{{/unless}}
  result = result.replace(
    /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
    (_match, field, content) => {
      const value = record[field];
      if (!value || value === 'false' || value === '0' || value === 'no') {
        return content;
      }
      return '';
    }
  );

  // Process each loops: {{#each items}}...{{item}}...{{/each}}
  result = result.replace(
    /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_match, field, content) => {
      const items = record[field];
      if (!Array.isArray(items)) return '';
      return items
        .map((item, index) => {
          let itemContent = content;
          if (typeof item === 'object' && item !== null) {
            for (const [key, val] of Object.entries(item as Record<string, unknown>)) {
              itemContent = itemContent.replace(
                new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
                String(val ?? '')
              );
            }
          } else {
            itemContent = itemContent.replace(/\{\{item\}\}/g, String(item));
          }
          itemContent = itemContent.replace(/\{\{index\}\}/g, String(index + 1));
          return itemContent;
        })
        .join('');
    }
  );

  // Process computed fields
  if (record.firstName && record.lastName && !record.fullName) {
    record.fullName = `${record.firstName} ${record.lastName}`;
  }

  // Add today's date as a built-in
  if (!record.today) {
    record.today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  if (!record.todayISO) {
    record.todayISO = new Date().toISOString().split('T')[0];
  }

  // Process format specifiers: {{field:currency}}, {{field:uppercase}}, etc.
  result = result.replace(/\{\{(\w+):(\w+)\}\}/g, (_match, field, format) => {
    const value = record[field];
    if (value === undefined || value === null) return '';

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
          Number(value)
        );
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'capitalize':
        return String(value).charAt(0).toUpperCase() + String(value).slice(1);
      case 'number':
        return new Intl.NumberFormat('en-US').format(Number(value));
      case 'percent':
        return `${(Number(value) * 100).toFixed(1)}%`;
      default:
        return String(value);
    }
  });

  // Simple placeholder replacement: {{field}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, field) => {
    const value = record[field];
    if (value === undefined || value === null) return '';
    return String(value);
  });

  return result;
}

function generateFilename(
  template: string | undefined,
  record: Record<string, unknown>,
  index: number
): string {
  if (!template) return `document_${index + 1}`;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, field) => {
    const value = record[field];
    if (value === undefined || value === null) return `${index + 1}`;
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
  });
}

// ============================================================================
// DOCUMENT GENERATION
// ============================================================================

async function generateDocuments(args: {
  template: string;
  data: Record<string, unknown>[];
  output_format?: string;
  filename_template?: string;
  merge_into_single_pdf?: boolean;
  document_title?: string;
}): Promise<{
  success: boolean;
  data?: string;
  filename?: string;
  documentCount?: number;
  error?: string;
}> {
  const format = args.output_format || 'pdf';
  const documents: { name: string; content: string }[] = [];

  for (let i = 0; i < args.data.length; i++) {
    const record = args.data[i];
    const processedContent = processTemplate(args.template, record);
    const filename = generateFilename(args.filename_template, record, i);
    documents.push({ name: filename, content: processedContent });
  }

  if (format === 'txt') {
    // For text, create a ZIP of .txt files
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const doc of documents) {
      zip.file(`${doc.name}.txt`, doc.content);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    return {
      success: true,
      data: zipBuffer.toString('base64'),
      filename: `mail_merge_${documents.length}_docs.zip`,
      documentCount: documents.length,
    };
  }

  if (format === 'pdf') {
    if (args.merge_into_single_pdf) {
      // Generate single merged PDF
      const PDFDocument = (await import('pdfkit')).default;
      const { PassThrough } = await import('stream');

      return new Promise((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = new (PDFDocument as any)({
          size: 'letter',
          margins: { top: 72, bottom: 72, left: 72, right: 72 },
          bufferPages: true,
        });

        const stream = new PassThrough();
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            success: true,
            data: buffer.toString('base64'),
            filename: `${args.document_title || 'mail_merge'}.pdf`,
            documentCount: documents.length,
          });
        });

        doc.pipe(stream);

        for (let i = 0; i < documents.length; i++) {
          if (i > 0) doc.addPage();

          // Render each document's content as simple text
          const lines = documents[i].content.split('\n');
          for (const line of lines) {
            if (line.startsWith('# ')) {
              doc.fontSize(20).font('Helvetica-Bold').text(line.substring(2));
              doc.moveDown(0.5);
            } else if (line.startsWith('## ')) {
              doc.fontSize(16).font('Helvetica-Bold').text(line.substring(3));
              doc.moveDown(0.3);
            } else if (line.startsWith('### ')) {
              doc.fontSize(13).font('Helvetica-Bold').text(line.substring(4));
              doc.moveDown(0.2);
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
              doc
                .fontSize(11)
                .font('Helvetica')
                .text(`  \u2022 ${line.substring(2)}`, { indent: 10 });
            } else if (line.trim() === '---') {
              doc.addPage();
            } else if (line.trim() === '') {
              doc.moveDown(0.5);
            } else {
              doc.fontSize(11).font('Helvetica').text(line);
            }
          }
        }

        doc.end();
      });
    } else {
      // Generate ZIP of individual PDFs
      const PDFDocument = (await import('pdfkit')).default;
      const { PassThrough } = await import('stream');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (const docInfo of documents) {
        const pdfBuffer = await new Promise<Buffer>((resolve) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const doc = new (PDFDocument as any)({
            size: 'letter',
            margins: { top: 72, bottom: 72, left: 72, right: 72 },
          });

          const stream = new PassThrough();
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks)));

          doc.pipe(stream);

          const lines = docInfo.content.split('\n');
          for (const line of lines) {
            if (line.startsWith('# ')) {
              doc.fontSize(20).font('Helvetica-Bold').text(line.substring(2));
              doc.moveDown(0.5);
            } else if (line.startsWith('## ')) {
              doc.fontSize(16).font('Helvetica-Bold').text(line.substring(3));
              doc.moveDown(0.3);
            } else if (line.startsWith('### ')) {
              doc.fontSize(13).font('Helvetica-Bold').text(line.substring(4));
              doc.moveDown(0.2);
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
              doc
                .fontSize(11)
                .font('Helvetica')
                .text(`  \u2022 ${line.substring(2)}`, { indent: 10 });
            } else if (line.trim() === '') {
              doc.moveDown(0.5);
            } else {
              doc.fontSize(11).font('Helvetica').text(line);
            }
          }

          doc.end();
        });

        zip.file(`${docInfo.name}.pdf`, pdfBuffer);
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      return {
        success: true,
        data: zipBuffer.toString('base64'),
        filename: `mail_merge_${documents.length}_docs.zip`,
        documentCount: documents.length,
      };
    }
  }

  // DOCX format
  if (format === 'docx') {
    const docxLib = await import('docx');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docxLib;
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const docInfo of documents) {
      const paragraphs: InstanceType<typeof Paragraph>[] = [];
      const lines = docInfo.content.split('\n');

      for (const line of lines) {
        if (line.startsWith('# ')) {
          paragraphs.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: line.substring(2), bold: true })],
            })
          );
        } else if (line.startsWith('## ')) {
          paragraphs.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: line.substring(3), bold: true })],
            })
          );
        } else if (line.startsWith('### ')) {
          paragraphs.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_3,
              children: [new TextRun({ text: line.substring(4), bold: true })],
            })
          );
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          paragraphs.push(
            new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun(line.substring(2))],
            })
          );
        } else if (line.trim() === '') {
          paragraphs.push(new Paragraph({ children: [] }));
        } else {
          paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
        }
      }

      const doc = new Document({
        sections: [{ children: paragraphs }],
      });

      const buffer = await Packer.toBuffer(doc);
      zip.file(`${docInfo.name}.docx`, buffer);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    return {
      success: true,
      data: zipBuffer.toString('base64'),
      filename: `mail_merge_${documents.length}_docs.zip`,
      documentCount: documents.length,
    };
  }

  return { success: false, error: `Unsupported format: ${format}` };
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeMailMerge(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'mail_merge') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

  if (!args.template) {
    return { toolCallId: id, content: 'Template text is required', isError: true };
  }
  if (!args.data || !Array.isArray(args.data) || args.data.length === 0) {
    return {
      toolCallId: id,
      content: 'Data array with at least one record is required',
      isError: true,
    };
  }
  if (args.data.length > 500) {
    return { toolCallId: id, content: 'Maximum 500 documents per batch', isError: true };
  }

  log.info('Starting mail merge', {
    records: args.data.length,
    format: args.output_format || 'pdf',
  });

  try {
    const result = await generateDocuments(args);

    if (!result.success) {
      return { toolCallId: id, content: result.error || 'Mail merge failed', isError: true };
    }

    const mimeType = result.filename?.endsWith('.pdf') ? 'application/pdf' : 'application/zip';

    const content = JSON.stringify({
      success: true,
      filename: result.filename,
      documentCount: result.documentCount,
      format: args.output_format || 'pdf',
      data: result.data,
      mimeType,
    });

    return { toolCallId: id, content, isError: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error('Mail merge failed', { error: msg });
    return { toolCallId: id, content: `Mail merge failed: ${msg}`, isError: true };
  }
}

// ============================================================================
// AVAILABILITY
// ============================================================================

export function isMailMergeAvailable(): boolean {
  return true; // Uses pdfkit/docx/jszip which are already available
}
