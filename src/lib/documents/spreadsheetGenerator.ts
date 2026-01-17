/**
 * SPREADSHEET GENERATOR
 * Creates Excel files from JSON spreadsheet data
 *
 * Uses exceljs library to generate .xlsx files
 * Supports formatting, formulas, and multiple sheets
 */

import ExcelJS from 'exceljs';
import type { SpreadsheetDocument, SpreadsheetCell } from './types';

// Default styling - Professional spreadsheet standards
const DEFAULT_HEADER_COLOR = '1e3a5f'; // Navy blue
const DEFAULT_HEADER_TEXT_COLOR = 'ffffff'; // White
const ALTERNATE_ROW_COLOR = 'f8f9fa'; // Subtle light gray (more professional)
const DEFAULT_ROW_HEIGHT = 22; // Comfortable row height
const DEFAULT_HEADER_HEIGHT = 28; // Slightly taller header for visual hierarchy
const DEFAULT_MIN_COLUMN_WIDTH = 12; // Minimum readable column width
const DEFAULT_MAX_COLUMN_WIDTH = 60; // Maximum column width to prevent sprawl
const DEFAULT_FONT_SIZE = 11; // Standard Excel font size

/**
 * Generate an Excel file from spreadsheet JSON with professional styling
 */
export async function generateSpreadsheetXlsx(spreadsheet: SpreadsheetDocument): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JCIL.AI';
  workbook.created = new Date();

  const headerColor = spreadsheet.format?.headerColor?.replace('#', '') || DEFAULT_HEADER_COLOR;
  const alternatingRows = spreadsheet.format?.alternatingRowColors !== false;
  const fontSize = spreadsheet.format?.defaultFontSize || DEFAULT_FONT_SIZE;

  // Process each sheet
  for (const sheetData of spreadsheet.sheets) {
    const worksheet = workbook.addWorksheet(sheetData.name);

    // Set default column style for better readability
    worksheet.properties.defaultRowHeight = DEFAULT_ROW_HEIGHT;

    // Set column widths if specified
    if (sheetData.columnWidths && sheetData.columnWidths.length > 0) {
      sheetData.columnWidths.forEach((width, index) => {
        const col = worksheet.getColumn(index + 1);
        col.width = Math.max(width, DEFAULT_MIN_COLUMN_WIDTH);
      });
    }

    // Track header rows for proper alternating color calculation
    let headerRowCount = 0;

    // Process rows
    let rowIndex = 1;
    for (const rowData of sheetData.rows) {
      const row = worksheet.getRow(rowIndex);

      // Process cells in the row
      rowData.cells.forEach((cellData, cellIndex) => {
        const cell = row.getCell(cellIndex + 1);
        setCellValue(cell, cellData);
        applyCellFormatting(cell, cellData, rowData.isHeader, headerColor, fontSize);
      });

      // Apply header styling
      if (rowData.isHeader) {
        headerRowCount++;
        row.height = DEFAULT_HEADER_HEIGHT;
        row.font = {
          bold: true,
          color: { argb: DEFAULT_HEADER_TEXT_COLOR },
          size: fontSize,
        };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: headerColor },
        };
        // Center-align header text vertically
        row.alignment = { vertical: 'middle' };
      } else {
        // Set comfortable row height for data rows
        row.height = rowData.height || DEFAULT_ROW_HEIGHT;

        // Alternating row colors (account for header rows)
        const dataRowIndex = rowIndex - headerRowCount;
        if (alternatingRows && dataRowIndex % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: ALTERNATE_ROW_COLOR.replace('#', '') },
          };
        }

        // Default vertical alignment for data rows
        row.alignment = { vertical: 'middle' };
      }

      row.commit();
      rowIndex++;
    }

    // Auto-fit columns if no widths specified - improved algorithm
    if (!sheetData.columnWidths || sheetData.columnWidths.length === 0) {
      worksheet.columns.forEach((column) => {
        let maxLength = DEFAULT_MIN_COLUMN_WIDTH;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value?.toString() || '';
          // Account for font size and add padding
          const estimatedWidth = cellValue.length * 1.1 + 4;
          maxLength = Math.max(maxLength, estimatedWidth);
        });
        column.width = Math.min(
          Math.max(maxLength, DEFAULT_MIN_COLUMN_WIDTH),
          DEFAULT_MAX_COLUMN_WIDTH
        );
      });
    }

    // Freeze panes (default: freeze first row if it's a header)
    const hasHeader = sheetData.rows.some((r) => r.isHeader);
    if (sheetData.freezeRow || sheetData.freezeColumn || hasHeader) {
      worksheet.views = [
        {
          state: 'frozen',
          xSplit: sheetData.freezeColumn || 0,
          ySplit: sheetData.freezeRow || (hasHeader ? headerRowCount : 0),
        },
      ];
    }

    // Add professional borders to all cells with data
    const lastRow = worksheet.lastRow?.number || 1;
    const lastCol = worksheet.columnCount;
    for (let r = 1; r <= lastRow; r++) {
      for (let c = 1; c <= lastCol; c++) {
        const cell = worksheet.getCell(r, c);
        // Apply borders to all cells in data range (not just those with values)
        cell.border = {
          top: { style: 'thin', color: { argb: 'd0d0d0' } },
          left: { style: 'thin', color: { argb: 'd0d0d0' } },
          bottom: { style: 'thin', color: { argb: 'd0d0d0' } },
          right: { style: 'thin', color: { argb: 'd0d0d0' } },
        };
      }
    }

    // Add a slightly heavier border around the entire data range
    for (let r = 1; r <= lastRow; r++) {
      // Left edge
      worksheet.getCell(r, 1).border = {
        ...worksheet.getCell(r, 1).border,
        left: { style: 'thin', color: { argb: 'a0a0a0' } },
      };
      // Right edge
      worksheet.getCell(r, lastCol).border = {
        ...worksheet.getCell(r, lastCol).border,
        right: { style: 'thin', color: { argb: 'a0a0a0' } },
      };
    }
    for (let c = 1; c <= lastCol; c++) {
      // Top edge
      worksheet.getCell(1, c).border = {
        ...worksheet.getCell(1, c).border,
        top: { style: 'thin', color: { argb: 'a0a0a0' } },
      };
      // Bottom edge
      worksheet.getCell(lastRow, c).border = {
        ...worksheet.getCell(lastRow, c).border,
        bottom: { style: 'thin', color: { argb: 'a0a0a0' } },
      };
    }
  }

  // Generate buffer
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Set cell value, handling formulas
 */
function setCellValue(cell: ExcelJS.Cell, cellData: SpreadsheetCell): void {
  if (cellData.formula) {
    cell.value = { formula: cellData.formula };
  } else if (cellData.value !== null && cellData.value !== undefined) {
    cell.value = cellData.value;
  }
}

/**
 * Apply formatting to a cell with professional styling
 */
function applyCellFormatting(
  cell: ExcelJS.Cell,
  cellData: SpreadsheetCell,
  isHeader: boolean = false,
  _headerColor: string,
  fontSize: number = DEFAULT_FONT_SIZE
): void {
  // Font styling
  const font: Partial<ExcelJS.Font> = {
    size: fontSize,
  };
  if (cellData.bold || isHeader) font.bold = true;
  if (cellData.italic) font.italic = true;
  if (cellData.textColor) font.color = { argb: cellData.textColor.replace('#', '') };

  cell.font = font;

  // Number formatting with thousands separator for better readability
  if (cellData.currency) {
    cell.numFmt = '"$"#,##0.00';
  } else if (cellData.percent) {
    cell.numFmt = '0.00%';
  } else if (typeof cellData.value === 'number' && !Number.isInteger(cellData.value)) {
    // Format decimals nicely
    cell.numFmt = '#,##0.00';
  } else if (typeof cellData.value === 'number' && Math.abs(cellData.value) >= 1000) {
    // Add thousands separator for large numbers
    cell.numFmt = '#,##0';
  }

  // Background color
  if (cellData.backgroundColor) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: cellData.backgroundColor.replace('#', '') },
    };
  }

  // Alignment - default numbers to right, text to left
  const defaultAlignment =
    typeof cellData.value === 'number' || cellData.currency || cellData.percent ? 'right' : 'left';

  cell.alignment = {
    horizontal: cellData.alignment || defaultAlignment,
    vertical: 'middle',
    wrapText: false, // Prevent wrapping for cleaner look
  };
}

/**
 * Generate a simple budget spreadsheet
 * Helper for common budget use case
 */
export function createBudgetTemplate(
  title: string,
  categories: { name: string; budgeted: number; actual: number }[]
): SpreadsheetDocument {
  const rows = [
    // Header row
    {
      isHeader: true,
      cells: [
        { value: 'Category' },
        { value: 'Budgeted', alignment: 'right' as const },
        { value: 'Actual', alignment: 'right' as const },
        { value: 'Variance', alignment: 'right' as const },
      ],
    },
    // Data rows
    ...categories.map((cat, index) => ({
      cells: [
        { value: cat.name },
        { value: cat.budgeted, currency: true, alignment: 'right' as const },
        { value: cat.actual, currency: true, alignment: 'right' as const },
        {
          formula: `=B${index + 2}-C${index + 2}`,
          currency: true,
          alignment: 'right' as const,
        },
      ],
    })),
    // Totals row
    {
      cells: [
        { value: 'TOTAL', bold: true },
        {
          formula: `=SUM(B2:B${categories.length + 1})`,
          currency: true,
          bold: true,
          alignment: 'right' as const,
        },
        {
          formula: `=SUM(C2:C${categories.length + 1})`,
          currency: true,
          bold: true,
          alignment: 'right' as const,
        },
        {
          formula: `=SUM(D2:D${categories.length + 1})`,
          currency: true,
          bold: true,
          alignment: 'right' as const,
        },
      ],
    },
  ];

  return {
    type: 'spreadsheet',
    title,
    sheets: [
      {
        name: 'Budget',
        rows,
        freezeRow: 1,
        columnWidths: [25, 15, 15, 15],
      },
    ],
    format: {
      alternatingRowColors: true,
    },
  };
}
