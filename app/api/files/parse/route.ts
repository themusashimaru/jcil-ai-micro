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
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

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
          const formattedRow = cells.map(cell => {
            if (cell === null || cell === undefined) return '';
            if (cell instanceof Date) return cell.toISOString();
            return String(cell);
          }).join('\t|\t');

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
      return parsed.slice(0, MAX_PARSED_LENGTH) + '\n\n[Data truncated - file too large to display in full]';
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
 * @returns Extracted text from the PDF
 */
async function parsePDF(base64Data: string): Promise<string> {
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
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')  // Max 2 newlines
      .trim();

    // Add metadata
    const result = [
      `Pages: ${numPages}`,
      '',
      cleanedText
    ].join('\n');

    // Limit size to prevent token overflow
    if (result.length > MAX_PARSED_LENGTH) {
      return result.slice(0, MAX_PARSED_LENGTH) + '\n\n[Content truncated - document too large]';
    }

    return result;
  } catch (error) {
    log.error('PDF parsing error', error as Error);

    // If unpdf fails, return a graceful error message
    return '[PDF text extraction encountered an error. Please try uploading the file again or copy-paste the text content directly.]';
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
    const { fileName, fileType, content } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'No file content provided' },
        { status: 400 }
      );
    }

    let parsedText = '';

    // Route to appropriate parser
    if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        fileType === 'application/vnd.ms-excel') {
      // Excel file (now async with ExcelJS)
      parsedText = await parseExcel(content);
    } else if (fileType === 'application/pdf') {
      // PDF file
      parsedText = await parsePDF(content);
    } else if (fileType === 'text/csv') {
      // CSV is already text, just clean it up
      parsedText = content;
    } else if (fileType === 'text/plain') {
      // Plain text, return as-is
      parsedText = content;
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileType}` },
        { status: 400 }
      );
    }

    log.info(`Parsed ${fileName} (${fileType}): ${parsedText.length} chars`);

    return NextResponse.json({
      success: true,
      fileName,
      fileType,
      parsedText,
      charCount: parsedText.length,
    });

  } catch (error) {
    log.error('File parsing failed', error as Error);
    return NextResponse.json(
      { error: 'Failed to parse file' },
      { status: 500 }
    );
  }
}
