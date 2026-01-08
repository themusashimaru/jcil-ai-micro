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
 * SECURITY: Performs deep validation to prevent malformed data from reaching generators
 */
export function validateDocumentJSON(json: unknown): { valid: boolean; error?: string } {
  if (typeof json !== 'object' || json === null) {
    return { valid: false, error: 'JSON must be an object' };
  }

  const obj = json as Record<string, unknown>;

  if (!obj.type) {
    return { valid: false, error: 'Missing "type" field' };
  }

  if (typeof obj.type !== 'string') {
    return { valid: false, error: '"type" field must be a string' };
  }

  switch (obj.type) {
    case 'resume': {
      if (!obj.name || typeof obj.name !== 'string') {
        return { valid: false, error: 'Resume missing valid "name" field' };
      }
      if (!obj.contact || typeof obj.contact !== 'object') {
        return { valid: false, error: 'Resume missing valid "contact" object' };
      }
      // Validate experience array if present
      if (obj.experience !== undefined) {
        if (!Array.isArray(obj.experience)) {
          return { valid: false, error: 'Resume "experience" must be an array' };
        }
        for (let i = 0; i < obj.experience.length; i++) {
          const exp = obj.experience[i] as Record<string, unknown>;
          if (!exp.title || typeof exp.title !== 'string') {
            return { valid: false, error: `Experience[${i}] missing valid "title"` };
          }
          if (!exp.company || typeof exp.company !== 'string') {
            return { valid: false, error: `Experience[${i}] missing valid "company"` };
          }
        }
      }
      break;
    }

    case 'spreadsheet': {
      if (!obj.title || typeof obj.title !== 'string') {
        return { valid: false, error: 'Spreadsheet missing valid "title" field' };
      }
      if (!obj.sheets || !Array.isArray(obj.sheets)) {
        return { valid: false, error: 'Spreadsheet missing "sheets" array' };
      }
      if (obj.sheets.length === 0) {
        return { valid: false, error: 'Spreadsheet must have at least one sheet' };
      }
      // Validate each sheet structure
      for (let i = 0; i < obj.sheets.length; i++) {
        const sheet = obj.sheets[i] as Record<string, unknown>;
        if (!sheet.name || typeof sheet.name !== 'string') {
          return { valid: false, error: `Sheet[${i}] missing valid "name"` };
        }
        if (!sheet.rows || !Array.isArray(sheet.rows)) {
          return { valid: false, error: `Sheet[${i}] missing "rows" array` };
        }
        // Validate rows have cells
        for (let j = 0; j < sheet.rows.length; j++) {
          const row = sheet.rows[j] as Record<string, unknown>;
          if (!row.cells || !Array.isArray(row.cells)) {
            return { valid: false, error: `Sheet[${i}].row[${j}] missing "cells" array` };
          }
        }
      }
      break;
    }

    case 'document': {
      if (!obj.title || typeof obj.title !== 'string') {
        return { valid: false, error: 'Document missing valid "title" field' };
      }
      if (!obj.sections || !Array.isArray(obj.sections)) {
        return { valid: false, error: 'Document missing "sections" array' };
      }
      // Validate each section has a type
      const validSectionTypes = ['paragraph', 'table', 'pageBreak', 'horizontalRule'];
      for (let i = 0; i < obj.sections.length; i++) {
        const section = obj.sections[i] as Record<string, unknown>;
        if (!section.type || typeof section.type !== 'string') {
          return { valid: false, error: `Section[${i}] missing valid "type"` };
        }
        if (!validSectionTypes.includes(section.type)) {
          return { valid: false, error: `Section[${i}] has invalid type: ${section.type}` };
        }
      }
      break;
    }

    case 'invoice': {
      if (!obj.invoiceNumber || typeof obj.invoiceNumber !== 'string') {
        return { valid: false, error: 'Invoice missing valid "invoiceNumber" field' };
      }
      if (!obj.from || typeof obj.from !== 'object') {
        return { valid: false, error: 'Invoice missing valid "from" object' };
      }
      if (!obj.to || typeof obj.to !== 'object') {
        return { valid: false, error: 'Invoice missing valid "to" object' };
      }
      // Validate from.name and to.name
      const from = obj.from as Record<string, unknown>;
      const to = obj.to as Record<string, unknown>;
      if (!from.name || typeof from.name !== 'string') {
        return { valid: false, error: 'Invoice "from" missing valid "name"' };
      }
      if (!to.name || typeof to.name !== 'string') {
        return { valid: false, error: 'Invoice "to" missing valid "name"' };
      }
      if (!obj.items || !Array.isArray(obj.items)) {
        return { valid: false, error: 'Invoice missing "items" array' };
      }
      if (obj.items.length === 0) {
        return { valid: false, error: 'Invoice must have at least one item' };
      }
      // Validate each invoice item
      for (let i = 0; i < obj.items.length; i++) {
        const item = obj.items[i] as Record<string, unknown>;
        if (!item.description || typeof item.description !== 'string') {
          return { valid: false, error: `Item[${i}] missing valid "description"` };
        }
        if (typeof item.quantity !== 'number' || item.quantity < 0) {
          return { valid: false, error: `Item[${i}] missing valid "quantity" (must be non-negative number)` };
        }
        if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
          return { valid: false, error: `Item[${i}] missing valid "unitPrice" (must be non-negative number)` };
        }
      }
      break;
    }

    default:
      return { valid: false, error: `Unknown document type: ${obj.type}` };
  }

  return { valid: true };
}
