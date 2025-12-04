/**
 * FILE PARSING API
 *
 * Parses Excel and PDF files server-side and returns extracted text.
 * This enables the AI to analyze data from these file formats.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface ParseRequest {
  fileName: string;
  fileType: string;
  content: string; // Base64 data URL or raw text
}

/**
 * Parse Excel file and return as formatted text
 */
function parseExcel(base64Data: string): string {
  try {
    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:.*?;base64,/, '');

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Content, 'base64');

    // Parse workbook
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const result: string[] = [];

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON for easier processing
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      if (jsonData.length === 0) continue;

      result.push(`=== Sheet: ${sheetName} ===\n`);

      // Format as readable table
      jsonData.forEach((row, rowIndex) => {
        if (Array.isArray(row) && row.length > 0) {
          const formattedRow = row.map(cell => {
            if (cell === null || cell === undefined) return '';
            return String(cell);
          }).join('\t|\t');

          result.push(formattedRow);

          // Add separator after header row
          if (rowIndex === 0) {
            result.push('-'.repeat(Math.min(formattedRow.length, 80)));
          }
        }
      });

      result.push(''); // Empty line between sheets
    }

    const parsed = result.join('\n');

    // Limit size to prevent token overflow (roughly 50k chars = ~12k tokens)
    if (parsed.length > 50000) {
      return parsed.slice(0, 50000) + '\n\n[Data truncated - file too large to display in full]';
    }

    return parsed;
  } catch (error) {
    console.error('[File Parse] Excel parsing error:', error);
    throw new Error('Failed to parse Excel file');
  }
}

/**
 * Parse PDF file and return extracted text
 */
async function parsePDF(base64Data: string): Promise<string> {
  try {
    // Dynamic import pdf-parse with type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParseModule = await import('pdf-parse') as any;
    const pdfParse = pdfParseModule.default || pdfParseModule;

    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:.*?;base64,/, '');

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Content, 'base64');

    // Parse PDF
    const data = await pdfParse(buffer);

    let text = data.text || '';

    // Clean up the text
    text = text
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')  // Max 2 newlines
      .trim();

    // Add metadata
    const result = [
      `Pages: ${data.numpages}`,
      '',
      text
    ].join('\n');

    // Limit size
    if (result.length > 50000) {
      return result.slice(0, 50000) + '\n\n[Content truncated - document too large]';
    }

    return result;
  } catch (error) {
    console.error('[File Parse] PDF parsing error:', error);
    // Return a helpful message instead of failing completely
    return '[PDF text extraction failed. The AI will attempt to understand from context.]';
  }
}

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
      // Excel file
      parsedText = parseExcel(content);
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

    console.log(`[File Parse] Successfully parsed ${fileName} (${fileType}): ${parsedText.length} chars`);

    return NextResponse.json({
      success: true,
      fileName,
      fileType,
      parsedText,
      charCount: parsedText.length,
    });

  } catch (error) {
    console.error('[File Parse] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
