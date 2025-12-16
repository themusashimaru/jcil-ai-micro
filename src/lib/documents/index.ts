/**
 * DOCUMENT GENERATION MODULE
 * Exports all document generators and types
 *
 * AI outputs structured JSON → Backend converts to actual files
 */

// Types
export * from './types';

// Generators
export { generateResumeDocx } from './resumeGenerator';
export { generateSpreadsheetXlsx, createBudgetTemplate } from './spreadsheetGenerator';
export { generateInvoicePdf } from './invoiceGenerator';
export { generateWordDocx, createLetterTemplate } from './documentGenerator';

// Type guards (re-exported for convenience)
export {
  isResumeDocument,
  isSpreadsheetDocument,
  isWordDocument,
  isInvoiceDocument,
} from './types';

/**
 * Generate a document from JSON data
 * Automatically detects document type and uses appropriate generator
 */
import type { DocumentData } from './types';
import { isResumeDocument, isSpreadsheetDocument, isWordDocument, isInvoiceDocument } from './types';
import { generateResumeDocx } from './resumeGenerator';
import { generateSpreadsheetXlsx } from './spreadsheetGenerator';
import { generateInvoicePdf } from './invoiceGenerator';
import { generateWordDocx } from './documentGenerator';

export interface GeneratedDocument {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  extension: string;
}

/**
 * Generate a document from JSON data
 * Returns the file buffer, filename, and mime type
 */
export async function generateDocument(data: DocumentData, customFilename?: string): Promise<GeneratedDocument> {
  if (isResumeDocument(data)) {
    const buffer = await generateResumeDocx(data);
    const filename = customFilename || `${sanitizeFilename(data.name)}_Resume.docx`;
    return {
      buffer,
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
    };
  }

  if (isSpreadsheetDocument(data)) {
    const buffer = await generateSpreadsheetXlsx(data);
    const filename = customFilename || `${sanitizeFilename(data.title)}.xlsx`;
    return {
      buffer,
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    };
  }

  if (isWordDocument(data)) {
    const buffer = await generateWordDocx(data);
    const filename = customFilename || `${sanitizeFilename(data.title)}.docx`;
    return {
      buffer,
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
    };
  }

  if (isInvoiceDocument(data)) {
    const buffer = await generateInvoicePdf(data);
    const filename = customFilename || `Invoice_${sanitizeFilename(data.invoiceNumber)}.pdf`;
    return {
      buffer,
      filename,
      mimeType: 'application/pdf',
      extension: 'pdf',
    };
  }

  throw new Error(`Unknown document type: ${(data as { type: string }).type}`);
}

/**
 * Sanitize a string for use as a filename
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 50); // Limit length
}

/**
 * Detect document type from JSON
 */
export function detectDocumentType(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) {
    return null;
  }

  const obj = json as { type?: string };
  if (!obj.type) {
    return null;
  }

  const validTypes = ['resume', 'spreadsheet', 'document', 'invoice'];
  return validTypes.includes(obj.type) ? obj.type : null;
}

/**
 * Validate document JSON structure
 */
export function validateDocumentJSON(json: unknown): { valid: boolean; error?: string } {
  if (typeof json !== 'object' || json === null) {
    return { valid: false, error: 'JSON must be an object' };
  }

  const obj = json as Record<string, unknown>;

  if (!obj.type) {
    return { valid: false, error: 'Missing "type" field' };
  }

  switch (obj.type) {
    case 'resume':
      if (!obj.name) return { valid: false, error: 'Resume missing "name" field' };
      if (!obj.contact) return { valid: false, error: 'Resume missing "contact" field' };
      break;

    case 'spreadsheet':
      if (!obj.title) return { valid: false, error: 'Spreadsheet missing "title" field' };
      if (!obj.sheets || !Array.isArray(obj.sheets))
        return { valid: false, error: 'Spreadsheet missing "sheets" array' };
      break;

    case 'document':
      if (!obj.title) return { valid: false, error: 'Document missing "title" field' };
      if (!obj.sections || !Array.isArray(obj.sections))
        return { valid: false, error: 'Document missing "sections" array' };
      break;

    case 'invoice':
      if (!obj.invoiceNumber) return { valid: false, error: 'Invoice missing "invoiceNumber" field' };
      if (!obj.from) return { valid: false, error: 'Invoice missing "from" field' };
      if (!obj.to) return { valid: false, error: 'Invoice missing "to" field' };
      if (!obj.items || !Array.isArray(obj.items))
        return { valid: false, error: 'Invoice missing "items" array' };
      break;

    default:
      return { valid: false, error: `Unknown document type: ${obj.type}` };
  }

  return { valid: true };
}
