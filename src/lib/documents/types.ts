/**
 * DOCUMENT GENERATION TYPES
 * JSON schemas for AI-generated documents
 *
 * The AI outputs structured JSON, backend converts to actual files
 */

// ========================================
// RESUME / CV TYPES
// ========================================

export interface ResumeContact {
  phone?: string;
  email?: string;
  linkedin?: string;
  website?: string;
  location?: string; // City, State only (no full address for privacy)
}

export interface ResumeExperience {
  title: string;
  company: string;
  location?: string; // City, State
  startDate: string;
  endDate?: string; // "Present" if current
  bullets: string[];
}

export interface ResumeEducation {
  degree: string;
  school: string;
  location?: string;
  graduationDate?: string;
  gpa?: string;
  honors?: string[];
}

export interface ResumeCertification {
  name: string;
  issuer?: string;
  date?: string;
}

export interface ResumeDocument {
  type: 'resume';
  name: string;
  contact: ResumeContact;
  summary?: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills?: string[];
  certifications?: ResumeCertification[];
  // Formatting preferences (user can adjust via chat)
  format?: {
    fontFamily?: 'Arial' | 'Calibri' | 'Times New Roman' | 'Georgia';
    fontSize?: number; // Base font size in pt
    primaryColor?: string; // Hex color for headers
    layout?: 'single-column' | 'two-column';
    sectionOrder?: string[]; // e.g., ['summary', 'experience', 'education', 'skills']
  };
}

// ========================================
// SPREADSHEET / EXCEL TYPES
// ========================================

export interface SpreadsheetCell {
  value?: string | number | null;
  bold?: boolean;
  italic?: boolean;
  currency?: boolean; // Format as currency
  percent?: boolean; // Format as percentage
  formula?: string; // Excel formula like "=SUM(A1:A10)"
  backgroundColor?: string; // Hex color
  textColor?: string; // Hex color
  alignment?: 'left' | 'center' | 'right';
}

export interface SpreadsheetRow {
  cells: SpreadsheetCell[];
  isHeader?: boolean;
  height?: number;
}

export interface SpreadsheetSheet {
  name: string;
  rows: SpreadsheetRow[];
  columnWidths?: number[]; // Width for each column
  freezeRow?: number; // Freeze rows above this (for headers)
  freezeColumn?: number; // Freeze columns to the left
}

export interface SpreadsheetDocument {
  type: 'spreadsheet';
  title: string;
  sheets: SpreadsheetSheet[];
  // Formatting preferences
  format?: {
    defaultFontFamily?: string;
    defaultFontSize?: number;
    alternatingRowColors?: boolean;
    headerColor?: string; // Hex color for header background
  };
}

// ========================================
// GENERAL DOCUMENT (WORD) TYPES
// ========================================

export interface DocumentParagraph {
  text: string;
  style?: 'normal' | 'heading1' | 'heading2' | 'heading3' | 'title' | 'subtitle';
  bold?: boolean;
  italic?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  bulletLevel?: number; // 0 = no bullet, 1+ = nested bullet level
}

export interface DocumentTable {
  headers?: string[];
  rows: string[][];
  headerStyle?: {
    bold?: boolean;
    backgroundColor?: string;
  };
}

export interface DocumentSection {
  type: 'paragraph' | 'table' | 'pageBreak' | 'horizontalRule';
  content?: DocumentParagraph | DocumentTable;
}

export interface WordDocument {
  type: 'document';
  title: string;
  sections: DocumentSection[];
  // Formatting preferences
  format?: {
    fontFamily?: 'Arial' | 'Calibri' | 'Times New Roman' | 'Georgia';
    fontSize?: number;
    margins?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    headerText?: string;
    footerText?: string;
  };
}

// ========================================
// INVOICE TYPES
// ========================================

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number; // Calculated if not provided
}

export interface InvoiceDocument {
  type: 'invoice';
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  // From (business)
  from: {
    name: string;
    address?: string[];
    phone?: string;
    email?: string;
  };
  // To (client)
  to: {
    name: string;
    address?: string[];
    phone?: string;
    email?: string;
  };
  items: InvoiceItem[];
  subtotal?: number;
  tax?: number;
  taxRate?: number; // Percentage
  total?: number;
  notes?: string;
  paymentTerms?: string;
  // Formatting
  format?: {
    primaryColor?: string;
    logoUrl?: string;
    currency?: string; // USD, EUR, etc.
  };
}

// ========================================
// UNION TYPE FOR ALL DOCUMENTS
// ========================================

export type DocumentData =
  | ResumeDocument
  | SpreadsheetDocument
  | WordDocument
  | InvoiceDocument;

// Helper to detect document type from AI response
export function isResumeDocument(doc: DocumentData): doc is ResumeDocument {
  return doc.type === 'resume';
}

export function isSpreadsheetDocument(doc: DocumentData): doc is SpreadsheetDocument {
  return doc.type === 'spreadsheet';
}

export function isWordDocument(doc: DocumentData): doc is WordDocument {
  return doc.type === 'document';
}

export function isInvoiceDocument(doc: DocumentData): doc is InvoiceDocument {
  return doc.type === 'invoice';
}
