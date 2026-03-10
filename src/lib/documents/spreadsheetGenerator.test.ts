/**
 * Tests for Spreadsheet (Excel) Generator
 *
 * Tests generateSpreadsheetXlsx and createBudgetTemplate with mocked exceljs
 */

vi.mock('exceljs', () => {
  class MockCell {
    value: unknown = null;
    font: Record<string, unknown> = {};
    numFmt = '';
    fill: Record<string, unknown> = {};
    alignment: Record<string, unknown> = {};
    border: Record<string, unknown> = {};
  }

  class MockRow {
    private cells: Map<number, MockCell> = new Map();
    font: Record<string, unknown> = {};
    fill: Record<string, unknown> = {};
    alignment: Record<string, unknown> = {};
    height = 22;

    getCell(index: number) {
      if (!this.cells.has(index)) {
        this.cells.set(index, new MockCell());
      }
      return this.cells.get(index)!;
    }
    commit() {}
  }

  class MockColumn {
    width = 12;
    eachCell(_opts: unknown, cb: (cell: MockCell) => void) {
      cb(new MockCell());
    }
  }

  class MockWorksheet {
    properties = { defaultRowHeight: 22 };
    views: unknown[] = [];
    private rows: Map<number, MockRow> = new Map();
    private cols: MockColumn[] = [];
    lastRow = { number: 1 };
    columnCount = 1;

    getRow(index: number) {
      if (!this.rows.has(index)) {
        this.rows.set(index, new MockRow());
      }
      return this.rows.get(index)!;
    }

    getColumn(index: number) {
      while (this.cols.length < index) {
        this.cols.push(new MockColumn());
      }
      return this.cols[index - 1];
    }

    getCell(_row: number, _col: number) {
      return new MockCell();
    }

    get columns() {
      return this.cols.length > 0 ? this.cols : [new MockColumn()];
    }
  }

  class MockWorkbook {
    creator = '';
    created: Date | null = null;
    private sheets: MockWorksheet[] = [];
    xlsx = {
      writeBuffer: vi.fn().mockResolvedValue(Buffer.from('PK-mock-xlsx')),
    };

    addWorksheet(_name: string) {
      const ws = new MockWorksheet();
      this.sheets.push(ws);
      return ws;
    }
  }

  return {
    default: {
      Workbook: MockWorkbook,
    },
  };
});

import { describe, it, expect, vi } from 'vitest';
import { generateSpreadsheetXlsx, createBudgetTemplate } from './spreadsheetGenerator';
import type { SpreadsheetDocument } from './types';

describe('generateSpreadsheetXlsx', () => {
  it('should generate a buffer from a basic spreadsheet', async () => {
    const spreadsheet: SpreadsheetDocument = {
      type: 'spreadsheet',
      title: 'Test Sheet',
      sheets: [
        {
          name: 'Sheet1',
          rows: [
            { cells: [{ value: 'Name' }, { value: 'Age' }], isHeader: true },
            { cells: [{ value: 'Alice' }, { value: 30 }] },
          ],
        },
      ],
    };

    const buffer = await generateSpreadsheetXlsx(spreadsheet);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle multiple sheets', async () => {
    const spreadsheet: SpreadsheetDocument = {
      type: 'spreadsheet',
      title: 'Multi-Sheet',
      sheets: [
        { name: 'Revenue', rows: [{ cells: [{ value: 100 }] }] },
        { name: 'Expenses', rows: [{ cells: [{ value: 50 }] }] },
      ],
    };

    const buffer = await generateSpreadsheetXlsx(spreadsheet);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle cells with formulas', async () => {
    const spreadsheet: SpreadsheetDocument = {
      type: 'spreadsheet',
      title: 'Formula Sheet',
      sheets: [
        {
          name: 'Calc',
          rows: [{ cells: [{ value: 10 }, { value: 20 }] }, { cells: [{ formula: '=A1+B1' }] }],
        },
      ],
    };

    const buffer = await generateSpreadsheetXlsx(spreadsheet);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle cells with currency formatting', async () => {
    const spreadsheet: SpreadsheetDocument = {
      type: 'spreadsheet',
      title: 'Currency Sheet',
      sheets: [
        {
          name: 'Budget',
          rows: [{ cells: [{ value: 'Total' }, { value: 1500.5, currency: true }] }],
        },
      ],
    };

    const buffer = await generateSpreadsheetXlsx(spreadsheet);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle cells with percent formatting', async () => {
    const spreadsheet: SpreadsheetDocument = {
      type: 'spreadsheet',
      title: 'Percent Sheet',
      sheets: [
        {
          name: 'Rates',
          rows: [{ cells: [{ value: 0.15, percent: true }] }],
        },
      ],
    };

    const buffer = await generateSpreadsheetXlsx(spreadsheet);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle cells with bold and italic', async () => {
    const spreadsheet: SpreadsheetDocument = {
      type: 'spreadsheet',
      title: 'Styled Sheet',
      sheets: [
        {
          name: 'Styled',
          rows: [
            {
              cells: [
                { value: 'Bold', bold: true },
                { value: 'Italic', italic: true },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await generateSpreadsheetXlsx(spreadsheet);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle cells with background color', async () => {
    const spreadsheet: SpreadsheetDocument = {
      type: 'spreadsheet',
      title: 'Color Sheet',
      sheets: [
        {
          name: 'Colors',
          rows: [{ cells: [{ value: 'Red', backgroundColor: '#ff0000' }] }],
        },
      ],
    };

    const buffer = await generateSpreadsheetXlsx(spreadsheet);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle column widths', async () => {
    const spreadsheet: SpreadsheetDocument = {
      type: 'spreadsheet',
      title: 'Widths Sheet',
      sheets: [
        {
          name: 'Wide',
          rows: [{ cells: [{ value: 'A' }, { value: 'B' }] }],
          columnWidths: [30, 40],
        },
      ],
    };

    const buffer = await generateSpreadsheetXlsx(spreadsheet);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle freeze options', async () => {
    const spreadsheet: SpreadsheetDocument = {
      type: 'spreadsheet',
      title: 'Frozen Sheet',
      sheets: [
        {
          name: 'Frozen',
          rows: [{ cells: [{ value: 'Header' }], isHeader: true }, { cells: [{ value: 'Data' }] }],
          freezeRow: 1,
          freezeColumn: 1,
        },
      ],
    };

    const buffer = await generateSpreadsheetXlsx(spreadsheet);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle custom header color', async () => {
    const spreadsheet: SpreadsheetDocument = {
      type: 'spreadsheet',
      title: 'Custom Header',
      sheets: [
        {
          name: 'Custom',
          rows: [{ cells: [{ value: 'Header' }], isHeader: true }],
        },
      ],
      format: {
        headerColor: '#ff0000',
      },
    };

    const buffer = await generateSpreadsheetXlsx(spreadsheet);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle alternating row colors disabled', async () => {
    const spreadsheet: SpreadsheetDocument = {
      type: 'spreadsheet',
      title: 'No Alternating',
      sheets: [
        {
          name: 'Plain',
          rows: [{ cells: [{ value: 'Row 1' }] }, { cells: [{ value: 'Row 2' }] }],
        },
      ],
      format: {
        alternatingRowColors: false,
      },
    };

    const buffer = await generateSpreadsheetXlsx(spreadsheet);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle null cell values', async () => {
    const spreadsheet: SpreadsheetDocument = {
      type: 'spreadsheet',
      title: 'Null Values',
      sheets: [
        {
          name: 'Nulls',
          rows: [{ cells: [{ value: null }, { value: undefined as unknown as null }] }],
        },
      ],
    };

    const buffer = await generateSpreadsheetXlsx(spreadsheet);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});

describe('createBudgetTemplate', () => {
  it('should create a budget spreadsheet with correct structure', () => {
    const budget = createBudgetTemplate('Monthly Budget', [
      { name: 'Rent', budgeted: 1500, actual: 1500 },
      { name: 'Food', budgeted: 600, actual: 450 },
    ]);

    expect(budget.type).toBe('spreadsheet');
    expect(budget.title).toBe('Monthly Budget');
    expect(budget.sheets).toHaveLength(1);
    expect(budget.sheets[0].name).toBe('Budget');
  });

  it('should include header row, data rows, and totals row', () => {
    const categories = [
      { name: 'A', budgeted: 100, actual: 90 },
      { name: 'B', budgeted: 200, actual: 210 },
    ];
    const budget = createBudgetTemplate('Test Budget', categories);

    // 1 header + 2 data + 1 totals = 4 rows
    expect(budget.sheets[0].rows).toHaveLength(4);

    // First row should be header
    expect(budget.sheets[0].rows[0].isHeader).toBe(true);
    expect(budget.sheets[0].rows[0].cells[0].value).toBe('Category');
  });

  it('should have variance formula for each data row', () => {
    const budget = createBudgetTemplate('Budget', [{ name: 'Item', budgeted: 100, actual: 80 }]);

    // Data row (index 1) - variance cell (index 3)
    const varianceCell = budget.sheets[0].rows[1].cells[3];
    expect(varianceCell.formula).toBe('=B2-C2');
  });

  it('should have SUM formula in totals row', () => {
    const budget = createBudgetTemplate('Budget', [
      { name: 'A', budgeted: 100, actual: 90 },
      { name: 'B', budgeted: 200, actual: 180 },
    ]);

    const totalsRow = budget.sheets[0].rows[3]; // header + 2 data = index 3
    expect(totalsRow.cells[0].value).toBe('TOTAL');
    expect(totalsRow.cells[1].formula).toContain('SUM');
  });

  it('should set freezeRow to 1', () => {
    const budget = createBudgetTemplate('Budget', [{ name: 'A', budgeted: 100, actual: 90 }]);

    expect(budget.sheets[0].freezeRow).toBe(1);
  });

  it('should set column widths', () => {
    const budget = createBudgetTemplate('Budget', [{ name: 'A', budgeted: 100, actual: 90 }]);

    expect(budget.sheets[0].columnWidths).toEqual([25, 15, 15, 15]);
  });

  it('should enable alternating row colors', () => {
    const budget = createBudgetTemplate('Budget', [{ name: 'A', budgeted: 100, actual: 90 }]);

    expect(budget.format?.alternatingRowColors).toBe(true);
  });

  it('should format currency cells correctly', () => {
    const budget = createBudgetTemplate('Budget', [{ name: 'A', budgeted: 100, actual: 90 }]);

    const dataRow = budget.sheets[0].rows[1];
    expect(dataRow.cells[1].currency).toBe(true);
    expect(dataRow.cells[2].currency).toBe(true);
  });
});
