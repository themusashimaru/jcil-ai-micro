/**
 * Tests for document generation index module
 *
 * Tests generateDocument, detectDocumentType, validateDocumentJSON, and re-exports
 */

vi.mock('./resumeGenerator', () => ({
  generateResumeDocx: vi.fn().mockResolvedValue(Buffer.from('mock-resume-docx')),
}));

vi.mock('./spreadsheetGenerator', () => ({
  generateSpreadsheetXlsx: vi.fn().mockResolvedValue(Buffer.from('mock-spreadsheet-xlsx')),
  createBudgetTemplate: vi.fn(),
}));

vi.mock('./invoiceGenerator', () => ({
  generateInvoicePdf: vi.fn().mockResolvedValue(Buffer.from('mock-invoice-pdf')),
}));

vi.mock('./documentGenerator', () => ({
  generateWordDocx: vi.fn().mockResolvedValue(Buffer.from('mock-word-docx')),
  createLetterTemplate: vi.fn(),
}));

vi.mock('./generalPdfGenerator', () => ({
  generateGeneralPdf: vi.fn().mockResolvedValue(Buffer.from('mock-general-pdf')),
}));

import { describe, it, expect, vi } from 'vitest';
import { generateDocument, detectDocumentType, validateDocumentJSON } from './index';
import type { DocumentData } from './types';

// ============================================================================
// generateDocument
// ============================================================================

describe('generateDocument', () => {
  it('should generate a resume document', async () => {
    const data: DocumentData = {
      type: 'resume',
      name: 'John Doe',
      contact: { email: 'john@example.com' },
      experience: [],
      education: [],
    };

    const result = await generateDocument(data);
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.extension).toBe('docx');
    expect(result.mimeType).toContain('wordprocessingml');
    expect(result.filename).toContain('John_Doe');
    expect(result.filename).toContain('Resume.docx');
  });

  it('should generate a spreadsheet document', async () => {
    const data: DocumentData = {
      type: 'spreadsheet',
      title: 'Budget 2026',
      sheets: [{ name: 'Sheet1', rows: [] }],
    };

    const result = await generateDocument(data);
    expect(result.extension).toBe('xlsx');
    expect(result.mimeType).toContain('spreadsheetml');
    expect(result.filename).toContain('Budget_2026.xlsx');
  });

  it('should generate a word document', async () => {
    const data: DocumentData = {
      type: 'document',
      title: 'My Letter',
      sections: [],
    };

    const result = await generateDocument(data);
    expect(result.extension).toBe('docx');
    expect(result.filename).toContain('My_Letter.docx');
  });

  it('should generate an invoice document', async () => {
    const data: DocumentData = {
      type: 'invoice',
      invoiceNumber: 'INV-001',
      date: '2026-01-01',
      from: { name: 'Seller' },
      to: { name: 'Buyer' },
      items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
    };

    const result = await generateDocument(data);
    expect(result.extension).toBe('pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.filename).toContain('Invoice_INV-001.pdf');
  });

  it('should generate a general PDF document', async () => {
    const data: DocumentData = {
      type: 'general_pdf',
      title: 'Report',
      sections: [],
    };

    const result = await generateDocument(data);
    expect(result.extension).toBe('pdf');
    expect(result.filename).toContain('Report.pdf');
  });

  it('should use custom filename when provided', async () => {
    const data: DocumentData = {
      type: 'general_pdf',
      title: 'Report',
      sections: [],
    };

    const result = await generateDocument(data, 'custom-name.pdf');
    expect(result.filename).toBe('custom-name.pdf');
  });

  it('should throw for unknown document type', async () => {
    const data = { type: 'unknown' } as unknown as DocumentData;
    await expect(generateDocument(data)).rejects.toThrow('Unknown document type');
  });

  it('should sanitize filenames with special characters', async () => {
    const data: DocumentData = {
      type: 'resume',
      name: "José María O'Brien-González!!@#$",
      contact: { email: 'jose@example.com' },
      experience: [],
      education: [],
    };

    const result = await generateDocument(data);
    // Should not contain special characters except - and _
    expect(result.filename).not.toMatch(/[!@#$%^&*()]/);
  });
});

// ============================================================================
// detectDocumentType
// ============================================================================

describe('detectDocumentType', () => {
  it('should detect resume type', () => {
    expect(detectDocumentType({ type: 'resume' })).toBe('resume');
  });

  it('should detect spreadsheet type', () => {
    expect(detectDocumentType({ type: 'spreadsheet' })).toBe('spreadsheet');
  });

  it('should detect document type', () => {
    expect(detectDocumentType({ type: 'document' })).toBe('document');
  });

  it('should detect invoice type', () => {
    expect(detectDocumentType({ type: 'invoice' })).toBe('invoice');
  });

  it('should detect general_pdf type', () => {
    expect(detectDocumentType({ type: 'general_pdf' })).toBe('general_pdf');
  });

  it('should return null for unknown type', () => {
    expect(detectDocumentType({ type: 'unknown' })).toBeNull();
  });

  it('should return null for missing type field', () => {
    expect(detectDocumentType({ foo: 'bar' })).toBeNull();
  });

  it('should return null for null input', () => {
    expect(detectDocumentType(null)).toBeNull();
  });

  it('should return null for non-object input', () => {
    expect(detectDocumentType('string')).toBeNull();
    expect(detectDocumentType(123)).toBeNull();
    expect(detectDocumentType(undefined)).toBeNull();
  });
});

// ============================================================================
// validateDocumentJSON
// ============================================================================

describe('validateDocumentJSON', () => {
  it('should reject non-object input', () => {
    expect(validateDocumentJSON(null).valid).toBe(false);
    expect(validateDocumentJSON('string').valid).toBe(false);
    expect(validateDocumentJSON(123).valid).toBe(false);
  });

  it('should reject missing type field', () => {
    const result = validateDocumentJSON({ name: 'test' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('type');
  });

  it('should reject non-string type field', () => {
    const result = validateDocumentJSON({ type: 123 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('string');
  });

  it('should reject unknown type', () => {
    const result = validateDocumentJSON({ type: 'unknown' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unknown document type');
  });

  // Resume validation
  describe('resume validation', () => {
    it('should validate valid resume', () => {
      const result = validateDocumentJSON({
        type: 'resume',
        name: 'John',
        contact: { email: 'john@test.com' },
      });
      expect(result.valid).toBe(true);
    });

    it('should reject resume without name', () => {
      const result = validateDocumentJSON({ type: 'resume', contact: {} });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('name');
    });

    it('should reject resume without contact', () => {
      const result = validateDocumentJSON({ type: 'resume', name: 'John' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('contact');
    });

    it('should reject resume with invalid experience entries', () => {
      const result = validateDocumentJSON({
        type: 'resume',
        name: 'John',
        contact: { email: 'j@t.com' },
        experience: [{ company: 'Co' }], // missing title
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('title');
    });

    it('should reject resume with non-array experience', () => {
      const result = validateDocumentJSON({
        type: 'resume',
        name: 'John',
        contact: { email: 'j@t.com' },
        experience: 'not-array',
      });
      expect(result.valid).toBe(false);
    });
  });

  // Spreadsheet validation
  describe('spreadsheet validation', () => {
    it('should validate valid spreadsheet', () => {
      const result = validateDocumentJSON({
        type: 'spreadsheet',
        title: 'Budget',
        sheets: [{ name: 'Sheet1', rows: [{ cells: [] }] }],
      });
      expect(result.valid).toBe(true);
    });

    it('should reject spreadsheet without title', () => {
      const result = validateDocumentJSON({
        type: 'spreadsheet',
        sheets: [{ name: 'S1', rows: [] }],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject spreadsheet without sheets', () => {
      const result = validateDocumentJSON({ type: 'spreadsheet', title: 'T' });
      expect(result.valid).toBe(false);
    });

    it('should reject spreadsheet with empty sheets', () => {
      const result = validateDocumentJSON({
        type: 'spreadsheet',
        title: 'T',
        sheets: [],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject sheet without name', () => {
      const result = validateDocumentJSON({
        type: 'spreadsheet',
        title: 'T',
        sheets: [{ rows: [] }],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject sheet rows without cells', () => {
      const result = validateDocumentJSON({
        type: 'spreadsheet',
        title: 'T',
        sheets: [{ name: 'S1', rows: [{ notCells: true }] }],
      });
      expect(result.valid).toBe(false);
    });
  });

  // Document validation
  describe('document validation', () => {
    it('should validate valid document', () => {
      const result = validateDocumentJSON({
        type: 'document',
        title: 'Letter',
        sections: [{ type: 'paragraph' }],
      });
      expect(result.valid).toBe(true);
    });

    it('should reject document without title', () => {
      const result = validateDocumentJSON({ type: 'document', sections: [] });
      expect(result.valid).toBe(false);
    });

    it('should reject document without sections', () => {
      const result = validateDocumentJSON({ type: 'document', title: 'T' });
      expect(result.valid).toBe(false);
    });

    it('should reject section with invalid type', () => {
      const result = validateDocumentJSON({
        type: 'document',
        title: 'T',
        sections: [{ type: 'invalid_section_type' }],
      });
      expect(result.valid).toBe(false);
    });
  });

  // Invoice validation
  describe('invoice validation', () => {
    it('should validate valid invoice', () => {
      const result = validateDocumentJSON({
        type: 'invoice',
        invoiceNumber: 'INV-001',
        from: { name: 'Seller' },
        to: { name: 'Buyer' },
        items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
      });
      expect(result.valid).toBe(true);
    });

    it('should reject invoice without invoiceNumber', () => {
      const result = validateDocumentJSON({
        type: 'invoice',
        from: { name: 'S' },
        to: { name: 'B' },
        items: [{ description: 'X', quantity: 1, unitPrice: 1 }],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject invoice without from', () => {
      const result = validateDocumentJSON({
        type: 'invoice',
        invoiceNumber: 'INV-001',
        to: { name: 'B' },
        items: [{ description: 'X', quantity: 1, unitPrice: 1 }],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject invoice without to', () => {
      const result = validateDocumentJSON({
        type: 'invoice',
        invoiceNumber: 'INV-001',
        from: { name: 'S' },
        items: [{ description: 'X', quantity: 1, unitPrice: 1 }],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject invoice without items', () => {
      const result = validateDocumentJSON({
        type: 'invoice',
        invoiceNumber: 'INV-001',
        from: { name: 'S' },
        to: { name: 'B' },
      });
      expect(result.valid).toBe(false);
    });

    it('should reject invoice with empty items', () => {
      const result = validateDocumentJSON({
        type: 'invoice',
        invoiceNumber: 'INV-001',
        from: { name: 'S' },
        to: { name: 'B' },
        items: [],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject item with negative quantity', () => {
      const result = validateDocumentJSON({
        type: 'invoice',
        invoiceNumber: 'INV-001',
        from: { name: 'S' },
        to: { name: 'B' },
        items: [{ description: 'X', quantity: -1, unitPrice: 1 }],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject item with negative unitPrice', () => {
      const result = validateDocumentJSON({
        type: 'invoice',
        invoiceNumber: 'INV-001',
        from: { name: 'S' },
        to: { name: 'B' },
        items: [{ description: 'X', quantity: 1, unitPrice: -5 }],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject item without description', () => {
      const result = validateDocumentJSON({
        type: 'invoice',
        invoiceNumber: 'INV-001',
        from: { name: 'S' },
        to: { name: 'B' },
        items: [{ quantity: 1, unitPrice: 1 }],
      });
      expect(result.valid).toBe(false);
    });
  });

  // General PDF validation
  describe('general_pdf validation', () => {
    it('should validate valid general PDF', () => {
      const result = validateDocumentJSON({
        type: 'general_pdf',
        title: 'Report',
        sections: [{ type: 'paragraph' }],
      });
      expect(result.valid).toBe(true);
    });

    it('should reject PDF without title', () => {
      const result = validateDocumentJSON({
        type: 'general_pdf',
        sections: [],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject PDF without sections', () => {
      const result = validateDocumentJSON({
        type: 'general_pdf',
        title: 'T',
      });
      expect(result.valid).toBe(false);
    });

    it('should reject PDF section with invalid type', () => {
      const result = validateDocumentJSON({
        type: 'general_pdf',
        title: 'T',
        sections: [{ type: 'unknown_type' }],
      });
      expect(result.valid).toBe(false);
    });

    it('should accept spacer section type for PDF', () => {
      const result = validateDocumentJSON({
        type: 'general_pdf',
        title: 'T',
        sections: [{ type: 'spacer' }],
      });
      expect(result.valid).toBe(true);
    });
  });
});
