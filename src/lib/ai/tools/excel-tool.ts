/**
 * ADVANCED EXCEL TOOL
 *
 * Full Excel manipulation using SheetJS (xlsx).
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Read/write Excel files (.xlsx, .xls)
 * - Multiple worksheets
 * - Formulas support
 * - Cell formatting
 * - Data extraction
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded xlsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let XLSX: any = null;

async function initXLSX(): Promise<boolean> {
  if (XLSX) return true;
  try {
    XLSX = await import('xlsx');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const excelTool: UnifiedTool = {
  name: 'excel_advanced',
  description: `Advanced Excel file manipulation.

Operations:
- create: Create new Excel workbook with data
- read: Read data from Excel file
- add_sheet: Add worksheet to existing workbook
- get_sheets: List all worksheets
- extract_range: Extract specific cell range
- apply_formula: Add formulas to cells

Features:
- Multiple worksheet support
- Formula support (SUM, AVERAGE, COUNT, etc.)
- Cell formatting
- Various output formats (xlsx, csv, json)

Works with: .xlsx, .xls, .csv, .ods files`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'read', 'add_sheet', 'get_sheets', 'extract_range', 'apply_formula'],
        description: 'Excel operation to perform',
      },
      workbook_data: {
        type: 'string',
        description: 'Base64 encoded Excel file (for read operations)',
      },
      sheet_name: {
        type: 'string',
        description: 'Worksheet name (default: Sheet1)',
      },
      data: {
        type: 'array',
        description: 'Array of arrays representing rows and cells for create/add_sheet',
      },
      headers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Column headers for the data',
      },
      range: {
        type: 'string',
        description: 'Cell range (e.g., "A1:C10") for extract_range',
      },
      formulas: {
        type: 'array',
        description: 'Array of {cell, formula} objects for apply_formula',
      },
      output_format: {
        type: 'string',
        enum: ['xlsx', 'csv', 'json', 'html'],
        description: 'Output format (default: xlsx)',
      },
      include_formulas: {
        type: 'boolean',
        description: 'Include formula strings in output (default: false)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isExcelAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeExcel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    workbook_data?: string;
    sheet_name?: string;
    data?: unknown[][];
    headers?: string[];
    range?: string;
    formulas?: { cell: string; formula: string }[];
    output_format?: string;
    include_formulas?: boolean;
  };

  if (!args.operation) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation is required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initXLSX();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize xlsx' }),
        isError: true,
      };
    }

    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'create': {
        if (!args.data || args.data.length === 0) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Data required for create operation' }),
            isError: true,
          };
        }

        const wb = XLSX.utils.book_new();
        const sheetName = args.sheet_name || 'Sheet1';

        // Prepare data with optional headers
        const sheetData = args.headers ? [args.headers, ...args.data] : args.data;

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        // Output in requested format
        const format = args.output_format || 'xlsx';
        let output: string;
        let mimeType: string;

        if (format === 'csv') {
          output = XLSX.utils.sheet_to_csv(ws);
          mimeType = 'text/csv';
          result = {
            operation: 'create',
            sheet_name: sheetName,
            format: 'csv',
            rows: args.data.length,
            content: output,
          };
        } else if (format === 'json') {
          const json = XLSX.utils.sheet_to_json(ws);
          result = {
            operation: 'create',
            sheet_name: sheetName,
            format: 'json',
            rows: args.data.length,
            data: json,
          };
        } else if (format === 'html') {
          output = XLSX.utils.sheet_to_html(ws);
          result = {
            operation: 'create',
            sheet_name: sheetName,
            format: 'html',
            rows: args.data.length,
            html: output,
          };
        } else {
          const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
          const base64 = Buffer.from(buffer).toString('base64');
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          result = {
            operation: 'create',
            sheet_name: sheetName,
            format: 'xlsx',
            rows: args.data.length,
            mime_type: mimeType,
            xlsx_base64: base64,
            size_bytes: buffer.length,
          };
        }
        break;
      }

      case 'read': {
        if (!args.workbook_data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Workbook data required' }),
            isError: true,
          };
        }

        const buffer = Buffer.from(args.workbook_data, 'base64');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = args.sheet_name || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        if (!ws) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: `Sheet "${sheetName}" not found` }),
            isError: true,
          };
        }

        const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

        result = {
          operation: 'read',
          sheet_name: sheetName,
          all_sheets: wb.SheetNames,
          rows: json.length,
          data: json.slice(0, 500), // Limit output
          truncated: json.length > 500,
        };
        break;
      }

      case 'add_sheet': {
        if (!args.workbook_data || !args.sheet_name || !args.data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Workbook data, sheet name, and data required' }),
            isError: true,
          };
        }

        const buffer = Buffer.from(args.workbook_data, 'base64');
        const wb = XLSX.read(buffer, { type: 'buffer' });

        const sheetData = args.headers ? [args.headers, ...args.data] : args.data;

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, args.sheet_name);

        const newBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const base64 = Buffer.from(newBuffer).toString('base64');

        result = {
          operation: 'add_sheet',
          new_sheet: args.sheet_name,
          all_sheets: wb.SheetNames,
          xlsx_base64: base64,
          size_bytes: newBuffer.length,
        };
        break;
      }

      case 'get_sheets': {
        if (!args.workbook_data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Workbook data required' }),
            isError: true,
          };
        }

        const buffer = Buffer.from(args.workbook_data, 'base64');
        const wb = XLSX.read(buffer, { type: 'buffer' });

        const sheets = wb.SheetNames.map((name: string) => {
          const ws = wb.Sheets[name];
          const range = ws['!ref'] || 'A1';
          return {
            name,
            range,
          };
        });

        result = {
          operation: 'get_sheets',
          sheets,
          count: sheets.length,
        };
        break;
      }

      case 'extract_range': {
        if (!args.workbook_data || !args.range) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Workbook data and range required' }),
            isError: true,
          };
        }

        const buffer = Buffer.from(args.workbook_data, 'base64');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = args.sheet_name || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        const json = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          range: args.range,
        });

        result = {
          operation: 'extract_range',
          sheet_name: sheetName,
          range: args.range,
          data: json,
        };
        break;
      }

      case 'apply_formula': {
        if (!args.workbook_data || !args.formulas) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Workbook data and formulas required' }),
            isError: true,
          };
        }

        const buffer = Buffer.from(args.workbook_data, 'base64');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = args.sheet_name || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        for (const { cell, formula } of args.formulas) {
          ws[cell] = { f: formula };
        }

        const newBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const base64 = Buffer.from(newBuffer).toString('base64');

        result = {
          operation: 'apply_formula',
          sheet_name: sheetName,
          formulas_applied: args.formulas.length,
          xlsx_base64: base64,
          size_bytes: newBuffer.length,
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
        error: 'Excel operation failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}
