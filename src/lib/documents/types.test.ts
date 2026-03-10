/**
 * Tests for document generation types
 *
 * Validates type guard functions and interface structures
 */

import { describe, it, expect } from 'vitest';

import {
  isResumeDocument,
  isSpreadsheetDocument,
  isWordDocument,
  isInvoiceDocument,
  isGeneralPdfDocument,
} from './types';
import type {
  ResumeDocument,
  SpreadsheetDocument,
  WordDocument,
  InvoiceDocument,
  GeneralPdfDocument,
  DocumentData,
  ResumeContact,
  ResumeExperience,
  ResumeEducation,
  ResumeCertification,
  SpreadsheetCell,
  SpreadsheetRow,
  SpreadsheetSheet,
  DocumentParagraph,
  DocumentTable,
  DocumentSection,
  InvoiceItem,
  PdfParagraph,
  PdfTable,
  PdfSection,
} from './types';

// ============================================================================
// FIXTURES
// ============================================================================

const resumeDoc: ResumeDocument = {
  type: 'resume',
  name: 'John Doe',
  contact: { email: 'john@example.com' },
  experience: [],
  education: [],
};

const spreadsheetDoc: SpreadsheetDocument = {
  type: 'spreadsheet',
  title: 'Budget',
  sheets: [{ name: 'Sheet1', rows: [] }],
};

const wordDoc: WordDocument = {
  type: 'document',
  title: 'Letter',
  sections: [],
};

const invoiceDoc: InvoiceDocument = {
  type: 'invoice',
  invoiceNumber: 'INV-001',
  date: '2026-01-01',
  from: { name: 'Business Inc.' },
  to: { name: 'Client Corp.' },
  items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
};

const pdfDoc: GeneralPdfDocument = {
  type: 'general_pdf',
  title: 'Report',
  sections: [],
};

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe('isResumeDocument', () => {
  it('should return true for resume documents', () => {
    expect(isResumeDocument(resumeDoc)).toBe(true);
  });

  it('should return false for non-resume documents', () => {
    expect(isResumeDocument(spreadsheetDoc)).toBe(false);
    expect(isResumeDocument(wordDoc)).toBe(false);
    expect(isResumeDocument(invoiceDoc)).toBe(false);
    expect(isResumeDocument(pdfDoc)).toBe(false);
  });
});

describe('isSpreadsheetDocument', () => {
  it('should return true for spreadsheet documents', () => {
    expect(isSpreadsheetDocument(spreadsheetDoc)).toBe(true);
  });

  it('should return false for non-spreadsheet documents', () => {
    expect(isSpreadsheetDocument(resumeDoc)).toBe(false);
    expect(isSpreadsheetDocument(wordDoc)).toBe(false);
    expect(isSpreadsheetDocument(invoiceDoc)).toBe(false);
    expect(isSpreadsheetDocument(pdfDoc)).toBe(false);
  });
});

describe('isWordDocument', () => {
  it('should return true for word documents', () => {
    expect(isWordDocument(wordDoc)).toBe(true);
  });

  it('should return false for non-word documents', () => {
    expect(isWordDocument(resumeDoc)).toBe(false);
    expect(isWordDocument(spreadsheetDoc)).toBe(false);
    expect(isWordDocument(invoiceDoc)).toBe(false);
    expect(isWordDocument(pdfDoc)).toBe(false);
  });
});

describe('isInvoiceDocument', () => {
  it('should return true for invoice documents', () => {
    expect(isInvoiceDocument(invoiceDoc)).toBe(true);
  });

  it('should return false for non-invoice documents', () => {
    expect(isInvoiceDocument(resumeDoc)).toBe(false);
    expect(isInvoiceDocument(spreadsheetDoc)).toBe(false);
    expect(isInvoiceDocument(wordDoc)).toBe(false);
    expect(isInvoiceDocument(pdfDoc)).toBe(false);
  });
});

describe('isGeneralPdfDocument', () => {
  it('should return true for general PDF documents', () => {
    expect(isGeneralPdfDocument(pdfDoc)).toBe(true);
  });

  it('should return false for non-PDF documents', () => {
    expect(isGeneralPdfDocument(resumeDoc)).toBe(false);
    expect(isGeneralPdfDocument(spreadsheetDoc)).toBe(false);
    expect(isGeneralPdfDocument(wordDoc)).toBe(false);
    expect(isGeneralPdfDocument(invoiceDoc)).toBe(false);
  });
});

// ============================================================================
// TYPE ASSERTION / STRUCTURAL TESTS
// ============================================================================

describe('ResumeContact type structure', () => {
  it('should accept minimal contact info', () => {
    const contact: ResumeContact = {};
    expect(contact).toBeDefined();
  });

  it('should accept full contact info', () => {
    const contact: ResumeContact = {
      phone: '555-1234',
      email: 'test@example.com',
      linkedin: 'linkedin.com/in/test',
      website: 'https://test.com',
      location: 'New York, NY',
    };
    expect(contact.phone).toBe('555-1234');
    expect(contact.email).toBe('test@example.com');
    expect(contact.linkedin).toBe('linkedin.com/in/test');
    expect(contact.website).toBe('https://test.com');
    expect(contact.location).toBe('New York, NY');
  });
});

describe('ResumeExperience type structure', () => {
  it('should require title, company, startDate, and bullets', () => {
    const exp: ResumeExperience = {
      title: 'Engineer',
      company: 'Tech Corp',
      startDate: 'Jan 2020',
      bullets: ['Built features'],
    };
    expect(exp.title).toBe('Engineer');
    expect(exp.company).toBe('Tech Corp');
    expect(exp.startDate).toBe('Jan 2020');
    expect(exp.bullets).toHaveLength(1);
  });

  it('should accept optional fields', () => {
    const exp: ResumeExperience = {
      title: 'Manager',
      company: 'Corp',
      startDate: 'Jan 2020',
      endDate: 'Present',
      location: 'NYC',
      bullets: [],
    };
    expect(exp.endDate).toBe('Present');
    expect(exp.location).toBe('NYC');
  });
});

describe('ResumeEducation type structure', () => {
  it('should require degree and school', () => {
    const edu: ResumeEducation = {
      degree: 'BS Computer Science',
      school: 'MIT',
    };
    expect(edu.degree).toBe('BS Computer Science');
    expect(edu.school).toBe('MIT');
  });

  it('should accept optional fields', () => {
    const edu: ResumeEducation = {
      degree: 'BS CS',
      school: 'MIT',
      location: 'Cambridge, MA',
      graduationDate: 'May 2020',
      gpa: '3.9',
      honors: ['Magna Cum Laude'],
    };
    expect(edu.honors).toHaveLength(1);
    expect(edu.gpa).toBe('3.9');
  });
});

describe('ResumeCertification type structure', () => {
  it('should require name', () => {
    const cert: ResumeCertification = { name: 'AWS Solutions Architect' };
    expect(cert.name).toBe('AWS Solutions Architect');
  });

  it('should accept optional issuer and date', () => {
    const cert: ResumeCertification = {
      name: 'AWS SA',
      issuer: 'Amazon',
      date: '2023',
    };
    expect(cert.issuer).toBe('Amazon');
    expect(cert.date).toBe('2023');
  });
});

describe('SpreadsheetCell type structure', () => {
  it('should accept a value-based cell', () => {
    const cell: SpreadsheetCell = { value: 42, bold: true };
    expect(cell.value).toBe(42);
    expect(cell.bold).toBe(true);
  });

  it('should accept a formula-based cell', () => {
    const cell: SpreadsheetCell = { formula: '=SUM(A1:A10)', currency: true };
    expect(cell.formula).toBe('=SUM(A1:A10)');
    expect(cell.currency).toBe(true);
  });

  it('should accept string values', () => {
    const cell: SpreadsheetCell = { value: 'Hello' };
    expect(cell.value).toBe('Hello');
  });

  it('should accept all formatting options', () => {
    const cell: SpreadsheetCell = {
      value: 100,
      bold: true,
      italic: true,
      currency: true,
      percent: false,
      backgroundColor: '#ff0000',
      textColor: '#ffffff',
      alignment: 'center',
    };
    expect(cell.alignment).toBe('center');
  });
});

describe('SpreadsheetRow type structure', () => {
  it('should require cells array', () => {
    const row: SpreadsheetRow = { cells: [{ value: 'A' }] };
    expect(row.cells).toHaveLength(1);
  });

  it('should accept isHeader flag', () => {
    const row: SpreadsheetRow = { cells: [], isHeader: true };
    expect(row.isHeader).toBe(true);
  });

  it('should accept custom height', () => {
    const row: SpreadsheetRow = { cells: [], height: 30 };
    expect(row.height).toBe(30);
  });
});

describe('SpreadsheetSheet type structure', () => {
  it('should require name and rows', () => {
    const sheet: SpreadsheetSheet = { name: 'Sheet1', rows: [] };
    expect(sheet.name).toBe('Sheet1');
    expect(sheet.rows).toHaveLength(0);
  });

  it('should accept freeze options', () => {
    const sheet: SpreadsheetSheet = {
      name: 'Data',
      rows: [],
      freezeRow: 1,
      freezeColumn: 2,
      columnWidths: [20, 30],
    };
    expect(sheet.freezeRow).toBe(1);
    expect(sheet.freezeColumn).toBe(2);
    expect(sheet.columnWidths).toHaveLength(2);
  });
});

describe('DocumentParagraph type structure', () => {
  it('should require text', () => {
    const para: DocumentParagraph = { text: 'Hello world' };
    expect(para.text).toBe('Hello world');
  });

  it('should accept all style options', () => {
    const para: DocumentParagraph = {
      text: 'Heading',
      style: 'heading1',
      bold: true,
      italic: true,
      alignment: 'center',
      bulletLevel: 1,
    };
    expect(para.style).toBe('heading1');
  });
});

describe('DocumentTable type structure', () => {
  it('should require rows', () => {
    const table: DocumentTable = { rows: [['A', 'B']] };
    expect(table.rows).toHaveLength(1);
  });

  it('should accept headers and headerStyle', () => {
    const table: DocumentTable = {
      headers: ['Col1', 'Col2'],
      rows: [['A', 'B']],
      headerStyle: { bold: true, backgroundColor: '#1e3a5f' },
    };
    expect(table.headers).toHaveLength(2);
    expect(table.headerStyle?.bold).toBe(true);
  });
});

describe('DocumentSection type structure', () => {
  it('should accept paragraph type', () => {
    const section: DocumentSection = {
      type: 'paragraph',
      content: { text: 'Hello' },
    };
    expect(section.type).toBe('paragraph');
  });

  it('should accept table type', () => {
    const section: DocumentSection = {
      type: 'table',
      content: { rows: [['A']] },
    };
    expect(section.type).toBe('table');
  });

  it('should accept pageBreak type without content', () => {
    const section: DocumentSection = { type: 'pageBreak' };
    expect(section.content).toBeUndefined();
  });

  it('should accept horizontalRule type', () => {
    const section: DocumentSection = { type: 'horizontalRule' };
    expect(section.type).toBe('horizontalRule');
  });
});

describe('InvoiceItem type structure', () => {
  it('should require description, quantity, and unitPrice', () => {
    const item: InvoiceItem = {
      description: 'Consulting',
      quantity: 10,
      unitPrice: 150,
    };
    expect(item.description).toBe('Consulting');
    expect(item.quantity).toBe(10);
    expect(item.unitPrice).toBe(150);
  });

  it('should accept optional total override', () => {
    const item: InvoiceItem = {
      description: 'Service',
      quantity: 1,
      unitPrice: 100,
      total: 90, // Discounted
    };
    expect(item.total).toBe(90);
  });
});

describe('PdfParagraph type structure', () => {
  it('should require text', () => {
    const para: PdfParagraph = { text: 'PDF content' };
    expect(para.text).toBe('PDF content');
  });

  it('should accept color field', () => {
    const para: PdfParagraph = { text: 'Colored', color: '#ff0000' };
    expect(para.color).toBe('#ff0000');
  });
});

describe('PdfTable type structure', () => {
  it('should require rows', () => {
    const table: PdfTable = { rows: [['A']] };
    expect(table.rows).toHaveLength(1);
  });

  it('should accept header style with textColor', () => {
    const table: PdfTable = {
      headers: ['H1'],
      rows: [['A']],
      headerStyle: { textColor: '#ffffff', backgroundColor: '#000000' },
    };
    expect(table.headerStyle?.textColor).toBe('#ffffff');
  });
});

describe('PdfSection type structure', () => {
  it('should accept spacer type', () => {
    const section: PdfSection = { type: 'spacer' };
    expect(section.type).toBe('spacer');
  });

  it('should accept all valid section types', () => {
    const types: PdfSection['type'][] = [
      'paragraph',
      'table',
      'pageBreak',
      'horizontalRule',
      'spacer',
    ];
    types.forEach((t) => {
      const section: PdfSection = { type: t };
      expect(section.type).toBe(t);
    });
  });
});

describe('DocumentData union type', () => {
  it('should narrow correctly with type guards', () => {
    const docs: DocumentData[] = [resumeDoc, spreadsheetDoc, wordDoc, invoiceDoc, pdfDoc];
    expect(docs.filter(isResumeDocument)).toHaveLength(1);
    expect(docs.filter(isSpreadsheetDocument)).toHaveLength(1);
    expect(docs.filter(isWordDocument)).toHaveLength(1);
    expect(docs.filter(isInvoiceDocument)).toHaveLength(1);
    expect(docs.filter(isGeneralPdfDocument)).toHaveLength(1);
  });

  it('should allow accessing common type field', () => {
    const docs: DocumentData[] = [resumeDoc, spreadsheetDoc, wordDoc, invoiceDoc, pdfDoc];
    const types = docs.map((d) => d.type);
    expect(types).toEqual(['resume', 'spreadsheet', 'document', 'invoice', 'general_pdf']);
  });
});

describe('ResumeDocument format options', () => {
  it('should accept format preferences', () => {
    const doc: ResumeDocument = {
      ...resumeDoc,
      format: {
        fontFamily: 'Arial',
        fontSize: 12,
        primaryColor: '#000000',
        layout: 'single-column',
        sectionOrder: ['summary', 'experience', 'education', 'skills'],
      },
    };
    expect(doc.format?.fontFamily).toBe('Arial');
    expect(doc.format?.layout).toBe('single-column');
    expect(doc.format?.sectionOrder).toHaveLength(4);
  });
});

describe('InvoiceDocument format options', () => {
  it('should accept format with currency', () => {
    const doc: InvoiceDocument = {
      ...invoiceDoc,
      format: {
        primaryColor: '#ff0000',
        currency: 'EUR',
      },
    };
    expect(doc.format?.currency).toBe('EUR');
  });

  it('should accept payment terms and notes', () => {
    const doc: InvoiceDocument = {
      ...invoiceDoc,
      notes: 'Thank you for your business',
      paymentTerms: 'Net 30',
      taxRate: 8.25,
    };
    expect(doc.notes).toBe('Thank you for your business');
    expect(doc.paymentTerms).toBe('Net 30');
    expect(doc.taxRate).toBe(8.25);
  });
});

describe('GeneralPdfDocument format options', () => {
  it('should accept format with margins and fonts', () => {
    const doc: GeneralPdfDocument = {
      ...pdfDoc,
      format: {
        fontFamily: 'Times-Roman',
        fontSize: 12,
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        headerText: 'Header',
        footerText: 'Footer',
        primaryColor: '#1e3a5f',
      },
    };
    expect(doc.format?.fontFamily).toBe('Times-Roman');
    expect(doc.format?.margins?.top).toBe(72);
  });
});
