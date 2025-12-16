/**
 * SPREADSHEET GENERATOR
 * Creates Excel files from JSON spreadsheet data
 *
 * Uses exceljs library to generate .xlsx files
 * Supports formatting, formulas, and multiple sheets
 */

import ExcelJS from 'exceljs';
import type { SpreadsheetDocument, SpreadsheetCell } from './types';

// Default styling
const DEFAULT_HEADER_COLOR = '1e3a5f'; // Navy blue
const DEFAULT_HEADER_TEXT_COLOR = 'ffffff'; // White
const ALTERNATE_ROW_COLOR = 'f5f5f5'; // Light gray

/**
 * Generate an Excel file from spreadsheet JSON
 */
export async function generateSpreadsheetXlsx(spreadsheet: SpreadsheetDocument): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JCIL.AI';
  workbook.created = new Date();

  const headerColor = spreadsheet.format?.headerColor?.replace('#', '') || DEFAULT_HEADER_COLOR;
  const alternatingRows = spreadsheet.format?.alternatingRowColors !== false;

  // Process each sheet
  for (const sheetData of spreadsheet.sheets) {
    const worksheet = workbook.addWorksheet(sheetData.name);

    // Set column widths if specified
    if (sheetData.columnWidths && sheetData.columnWidths.length > 0) {
      sheetData.columnWidths.forEach((width, index) => {
        const col = worksheet.getColumn(index + 1);
        col.width = width;
      });
    }

    // Process rows
    let rowIndex = 1;
    for (const rowData of sheetData.rows) {
      const row = worksheet.getRow(rowIndex);

      // Process cells in the row
      rowData.cells.forEach((cellData, cellIndex) => {
        const cell = row.getCell(cellIndex + 1);
        setCellValue(cell, cellData);
        applyCellFormatting(cell, cellData, rowData.isHeader, headerColor);
      });

      // Apply header styling
      if (rowData.isHeader) {
        row.font = { bold: true, color: { argb: DEFAULT_HEADER_TEXT_COLOR } };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: headerColor },
        };
      } else if (alternatingRows && rowIndex % 2 === 0) {
        // Alternating row colors
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: ALTERNATE_ROW_COLOR.replace('#', '') },
        };
      }

      // Set row height if specified
      if (rowData.height) {
        row.height = rowData.height;
      }

      row.commit();
      rowIndex++;
    }

    // Auto-fit columns if no widths specified
    if (!sheetData.columnWidths || sheetData.columnWidths.length === 0) {
      worksheet.columns.forEach((column) => {
        let maxLength = 10;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value?.toString() || '';
          maxLength = Math.max(maxLength, cellValue.length + 2);
        });
        column.width = Math.min(maxLength, 50);
      });
    }

    // Freeze panes
    if (sheetData.freezeRow || sheetData.freezeColumn) {
      worksheet.views = [
        {
          state: 'frozen',
          xSplit: sheetData.freezeColumn || 0,
          ySplit: sheetData.freezeRow || 0,
        },
      ];
    }

    // Add borders to all cells with data
    const lastRow = worksheet.lastRow?.number || 1;
    const lastCol = worksheet.columnCount;
    for (let r = 1; r <= lastRow; r++) {
      for (let c = 1; c <= lastCol; c++) {
        const cell = worksheet.getCell(r, c);
        if (cell.value !== null && cell.value !== undefined) {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        }
      }
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
 * Apply formatting to a cell
 */
function applyCellFormatting(
  cell: ExcelJS.Cell,
  cellData: SpreadsheetCell,
  isHeader: boolean = false,
  _headerColor: string
): void {
  // Font styling
  const font: Partial<ExcelJS.Font> = {};
  if (cellData.bold || isHeader) font.bold = true;
  if (cellData.italic) font.italic = true;
  if (cellData.textColor) font.color = { argb: cellData.textColor.replace('#', '') };
  if (Object.keys(font).length > 0) {
    cell.font = font;
  }

  // Number formatting
  if (cellData.currency) {
    cell.numFmt = '"$"#,##0.00';
  } else if (cellData.percent) {
    cell.numFmt = '0.00%';
  }

  // Background color
  if (cellData.backgroundColor) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: cellData.backgroundColor.replace('#', '') },
    };
  }

  // Alignment
  if (cellData.alignment) {
    cell.alignment = {
      horizontal: cellData.alignment,
      vertical: 'middle',
    };
  }
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
