/**
 * FILE PARSING API
 *
 * Parses Excel and PDF files server-side and returns extracted text.
 * This enables the AI to analyze data from these file formats.
 *
 * @module api/files/parse
 */

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger } from '@/lib/logger';

const log = logger('FileParseAPI');

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Maximum characters to return from parsed files */
const MAX_PARSED_LENGTH = 50000;

interface ParseRequest {
  fileName: string;
  fileType: string;
  content: string; // Base64 data URL or raw text
  extractStyle?: boolean; // If true, also extract style information
}

/**
 * Style information extracted from a spreadsheet
 */
interface SpreadsheetStyle {
  sheetCount: number;
  sheets: Array<{
    name: string;
    columnCount: number;
    rowCount: number;
    headers: string[];
    columnWidths: number[];
    hasHeaderRow: boolean;
    dataTypes: string[]; // 'text', 'number', 'currency', 'date', 'percent'
  }>;
  formatting: {
    hasBoldHeaders: boolean;
    hasAlternatingRows: boolean;
    primaryColor?: string;
    hasCurrencyColumns: boolean;
    hasPercentColumns: boolean;
    hasTotalsRow: boolean;
    hasFormulas: boolean;
  };
}

/**
 * Style information extracted from a PDF/document
 */
interface DocumentStyle {
  pageCount: number;
  sections: string[];
  hasTitle: boolean;
  hasSections: boolean;
  hasTable: boolean;
  hasBulletPoints: boolean;
  estimatedLayout: 'letter' | 'invoice' | 'resume' | 'report' | 'memo' | 'general';
}

/**
 * Extract style information from an Excel workbook
 * Analyzes structure, formatting, and data patterns
 */
async function extractExcelStyle(base64Data: string): Promise<SpreadsheetStyle> {
  const base64Content = base64Data.replace(/^data:.*?;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const style: SpreadsheetStyle = {
    sheetCount: workbook.worksheets.length,
    sheets: [],
    formatting: {
      hasBoldHeaders: false,
      hasAlternatingRows: false,
      hasCurrencyColumns: false,
      hasPercentColumns: false,
      hasTotalsRow: false,
      hasFormulas: false,
    },
  };

  workbook.eachSheet((worksheet) => {
    if (!worksheet.name) return;

    const headers: string[] = [];
    const columnWidths: number[] = [];
    const dataTypes: string[] = [];
    let rowCount = 0;
    let hasHeaderRow = false;
    let lastRowHasTotal = false;

    // Get column widths
    worksheet.columns.forEach((col, idx) => {
      columnWidths[idx] = col.width || 12;
    });

    // Analyze rows
    worksheet.eachRow((row, rowNumber) => {
      rowCount++;
      const values = row.values as (
        | string
        | number
        | boolean
        | Date
        | null
        | undefined
        | { formula?: string; result?: unknown }
      )[];
      const cells = values.slice(1);

      // First row - check for headers
      if (rowNumber === 1) {
        cells.forEach((cell, idx) => {
          if (cell !== null && cell !== undefined) {
            headers[idx] = String(cell);
          }
        });

        // Check if first row is bold (header row)
        const firstCell = row.getCell(1);
        if (firstCell.font?.bold) {
          hasHeaderRow = true;
          style.formatting.hasBoldHeaders = true;
        }
      }

      // Detect data types and patterns
      cells.forEach((cell, idx) => {
        if (cell !== null && cell !== undefined) {
          // Check for formulas
          if (typeof cell === 'object' && 'formula' in cell) {
            style.formatting.hasFormulas = true;
          }

          // Detect currency ($ symbol or currency format)
          const cellValue = String(cell);
          if (cellValue.includes('$') || cellValue.match(/^\$?[\d,]+\.\d{2}$/)) {
            style.formatting.hasCurrencyColumns = true;
            if (!dataTypes[idx]) dataTypes[idx] = 'currency';
          }

          // Detect percentages
          if (cellValue.includes('%') || cellValue.match(/^\d+(\.\d+)?%$/)) {
            style.formatting.hasPercentColumns = true;
            if (!dataTypes[idx]) dataTypes[idx] = 'percent';
          }

          // Detect dates
          if (cell instanceof Date) {
            if (!dataTypes[idx]) dataTypes[idx] = 'date';
          }

          // Detect numbers
          if (typeof cell === 'number' && !dataTypes[idx]) {
            dataTypes[idx] = 'number';
          }

          // Default to text
          if (!dataTypes[idx]) dataTypes[idx] = 'text';
        }
      });

      // Check for totals row (last row with "Total" or sum formulas)
      const rowText = cells
        .map((c) => String(c || ''))
        .join(' ')
        .toLowerCase();
      if (rowText.includes('total') || rowText.includes('sum')) {
        lastRowHasTotal = true;
      }
    });

    if (lastRowHasTotal) {
      style.formatting.hasTotalsRow = true;
    }

    style.sheets.push({
      name: worksheet.name,
      columnCount: headers.length || columnWidths.length,
      rowCount,
      headers,
      columnWidths: columnWidths.slice(0, headers.length || 10),
      hasHeaderRow,
      dataTypes,
    });
  });

  return style;
}

/**
 * Extract style/layout information from PDF text
 * Analyzes structure to determine document type and layout
 */
function extractPDFStyle(text: string, pageCount: number): DocumentStyle {
  const lines = text.split('\n').filter((l) => l.trim());
  const sections: string[] = [];

  // Detect sections (lines that look like headers)
  lines.forEach((line) => {
    const trimmed = line.trim();
    // Potential section headers: short lines, possibly all caps, no punctuation at end
    if (
      trimmed.length > 2 &&
      trimmed.length < 50 &&
      !trimmed.endsWith('.') &&
      !trimmed.endsWith(',') &&
      (trimmed === trimmed.toUpperCase() || /^[A-Z][a-z]/.test(trimmed))
    ) {
      sections.push(trimmed);
    }
  });

  // Detect document type based on content patterns
  const textLower = text.toLowerCase();
  let estimatedLayout: DocumentStyle['estimatedLayout'] = 'general';

  if (
    textLower.includes('invoice') ||
    textLower.includes('bill to') ||
    textLower.includes('amount due') ||
    textLower.includes('payment terms')
  ) {
    estimatedLayout = 'invoice';
  } else if (
    textLower.includes('experience') &&
    textLower.includes('education') &&
    (textLower.includes('skills') || textLower.includes('objective'))
  ) {
    estimatedLayout = 'resume';
  } else if (
    textLower.includes('dear ') ||
    textLower.includes('sincerely') ||
    textLower.includes('regards')
  ) {
    estimatedLayout = 'letter';
  } else if (
    textLower.includes('memo') ||
    (textLower.includes('to:') && textLower.includes('from:') && textLower.includes('re:'))
  ) {
    estimatedLayout = 'memo';
  } else if (sections.length > 3 && textLower.includes('conclusion')) {
    estimatedLayout = 'report';
  }

  return {
    pageCount,
    sections: sections.slice(0, 10), // First 10 section headers
    hasTitle: lines.length > 0 && lines[0].length < 100,
    hasSections: sections.length > 2,
    hasTable: text.includes('\t') || /\|\s*\|/.test(text),
    hasBulletPoints: text.includes('•') || text.includes('-  ') || /^\s*\d+\.\s/m.test(text),
    estimatedLayout,
  };
}

/**
 * Parse Excel file and return as formatted text
 * Uses ExcelJS (secure alternative to xlsx)
 *
 * @param base64Data - Base64 encoded Excel file content
 * @returns Formatted text representation of the spreadsheet
 * @throws Error if parsing fails
 */
async function parseExcel(base64Data: string): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:.*?;base64,/, '');

    // Convert base64 to ArrayBuffer (ExcelJS compatible)
    const buffer = Buffer.from(base64Content, 'base64');
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );

    // Parse workbook with ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const result: string[] = [];

    // Process each worksheet
    workbook.eachSheet((worksheet) => {
      if (!worksheet.name) return;

      result.push(`=== Sheet: ${worksheet.name} ===\n`);

      let rowIndex = 0;
      worksheet.eachRow((row) => {
        const values = row.values as (string | number | boolean | Date | null | undefined)[];
        // ExcelJS row.values is 1-indexed, first element is undefined
        const cells = values.slice(1);

        if (cells.length > 0) {
          const formattedRow = cells
            .map((cell) => {
              if (cell === null || cell === undefined) return '';
              if (cell instanceof Date) return cell.toISOString();
              return String(cell);
            })
            .join('\t|\t');

          result.push(formattedRow);

          // Add separator after header row
          if (rowIndex === 0) {
            result.push('-'.repeat(Math.min(formattedRow.length, 80)));
          }
          rowIndex++;
        }
      });

      result.push(''); // Empty line between sheets
    });

    const parsed = result.join('\n');

    // Limit size to prevent token overflow
    if (parsed.length > MAX_PARSED_LENGTH) {
      return (
        parsed.slice(0, MAX_PARSED_LENGTH) +
        '\n\n[Data truncated - file too large to display in full]'
      );
    }

    return parsed;
  } catch (error) {
    log.error('Excel parsing error', error as Error);
    throw new Error('Failed to parse Excel file');
  }
}

/**
 * Parse PDF file and return extracted text
 *
 * Uses 'unpdf' library which is specifically designed for serverless
 * environments and doesn't require canvas/DOM APIs like DOMMatrix.
 *
 * @param base64Data - Base64 encoded PDF file content
 * @returns Object with text and page count
 */
async function parsePDF(base64Data: string): Promise<{ text: string; pageCount: number }> {
  try {
    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:.*?;base64,/, '');

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Content, 'base64');

    // Use unpdf - designed for serverless, no canvas dependencies
    const { extractText, getDocumentProxy } = await import('unpdf');

    // Get document info for page count
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const numPages = pdf.numPages;

    // Extract text from all pages
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });

    // Clean up the text
    const cleanedText = (text || '')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
      .trim();

    // Add metadata
    const result = [`Pages: ${numPages}`, '', cleanedText].join('\n');

    // Limit size to prevent token overflow
    let finalText = result;
    if (result.length > MAX_PARSED_LENGTH) {
      finalText =
        result.slice(0, MAX_PARSED_LENGTH) + '\n\n[Content truncated - document too large]';
    }

    return { text: finalText, pageCount: numPages };
  } catch (error) {
    log.error('PDF parsing error', error as Error);

    // If unpdf fails, return a graceful error message
    return {
      text: '[PDF text extraction encountered an error. Please try uploading the file again or copy-paste the text content directly.]',
      pageCount: 0,
    };
  }
}

/**
 * POST /api/files/parse
 *
 * Parses uploaded files (Excel, PDF, CSV, TXT) and returns extracted text.
 *
 * @param request - Contains fileName, fileType, and base64 content
 * @returns Parsed text content and metadata
 * @throws 400 if no content or unsupported file type
 * @throws 500 if parsing fails
 */
export async function POST(request: NextRequest) {
  try {
    const body: ParseRequest = await request.json();
    const { fileName, fileType, content, extractStyle } = body;

    if (!content) {
      return NextResponse.json({ error: 'No file content provided' }, { status: 400 });
    }

    let parsedText = '';
    let styleInfo: SpreadsheetStyle | DocumentStyle | null = null;

    // Route to appropriate parser
    if (
      fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileType === 'application/vnd.ms-excel'
    ) {
      // Excel file (now async with ExcelJS)
      parsedText = await parseExcel(content);

      // Extract style information if requested
      if (extractStyle) {
        try {
          styleInfo = await extractExcelStyle(content);
          log.info(`Extracted style from ${fileName}`, {
            sheets: (styleInfo as SpreadsheetStyle).sheetCount,
            hasFormulas: (styleInfo as SpreadsheetStyle).formatting.hasFormulas,
          });
        } catch (styleError) {
          log.warn('Style extraction failed, continuing without style', styleError as Error);
        }
      }
    } else if (fileType === 'application/pdf') {
      // PDF file
      const pdfResult = await parsePDF(content);
      parsedText = pdfResult.text;

      // Extract style information if requested
      if (extractStyle) {
        styleInfo = extractPDFStyle(pdfResult.text, pdfResult.pageCount);
        log.info(`Extracted style from ${fileName}`, {
          layout: (styleInfo as DocumentStyle).estimatedLayout,
          sections: (styleInfo as DocumentStyle).sections.length,
        });
      }
    } else if (fileType === 'text/csv') {
      // CSV is already text, just clean it up
      parsedText = content;
    } else if (fileType === 'text/plain') {
      // Plain text, return as-is
      parsedText = content;
    } else {
      return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 400 });
    }

    log.info(`Parsed ${fileName} (${fileType}): ${parsedText.length} chars`);

    return NextResponse.json({
      success: true,
      fileName,
      fileType,
      parsedText,
      charCount: parsedText.length,
      ...(styleInfo && { styleInfo }),
    });
  } catch (error) {
    log.error('File parsing failed', error as Error);
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 });
  }
}
