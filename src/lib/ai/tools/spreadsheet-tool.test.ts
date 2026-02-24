// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { executeSpreadsheet, isSpreadsheetAvailable, spreadsheetTool } from './spreadsheet-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'create_spreadsheet', arguments: args };
}

function basicSheets(overrides?: Record<string, unknown>[]) {
  return (
    overrides || [
      {
        name: 'Sheet1',
        columns: [
          { header: 'ID', key: 'id' },
          { header: 'Name', key: 'name' },
        ],
        data: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      },
    ]
  );
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('spreadsheetTool metadata', () => {
  it('should have correct name', () => {
    expect(spreadsheetTool.name).toBe('create_spreadsheet');
  });

  it('should require filename and sheets', () => {
    expect(spreadsheetTool.parameters.required).toContain('filename');
    expect(spreadsheetTool.parameters.required).toContain('sheets');
  });
});

describe('isSpreadsheetAvailable', () => {
  it('should return true', () => {
    expect(isSpreadsheetAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Basic creation
// -------------------------------------------------------------------
describe('executeSpreadsheet - basic', () => {
  it('should create a spreadsheet with data', async () => {
    const res = await executeSpreadsheet(makeCall({ filename: 'test', sheets: basicSheets() }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('test.xlsx');
    expect(res.content).toContain('Sheet1');
    expect(res.content).toContain('data:application/vnd.openxmlformats');
  });

  it('should sanitize filename', async () => {
    const res = await executeSpreadsheet(
      makeCall({ filename: 'my file!@#', sheets: basicSheets() })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('my_file___');
  });

  it('should handle title', async () => {
    const res = await executeSpreadsheet(
      makeCall({ filename: 'titled', sheets: basicSheets(), title: 'Report Title' })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('titled.xlsx');
  });

  it('should default filename to spreadsheet', async () => {
    const res = await executeSpreadsheet(makeCall({ sheets: basicSheets() }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('spreadsheet.xlsx');
  });
});

// -------------------------------------------------------------------
// Multiple sheets
// -------------------------------------------------------------------
describe('executeSpreadsheet - multiple sheets', () => {
  it('should create workbook with multiple sheets', async () => {
    const sheets = [
      {
        name: 'Revenue',
        columns: [
          { header: 'Month', key: 'month' },
          { header: 'Amount', key: 'amount' },
        ],
        data: [{ month: 'Jan', amount: 1000 }],
      },
      {
        name: 'Expenses',
        columns: [
          { header: 'Category', key: 'cat' },
          { header: 'Cost', key: 'cost' },
        ],
        data: [{ cat: 'Rent', cost: 500 }],
      },
    ];
    const res = await executeSpreadsheet(makeCall({ filename: 'multi', sheets }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Revenue');
    expect(res.content).toContain('Expenses');
  });
});

// -------------------------------------------------------------------
// Formulas
// -------------------------------------------------------------------
describe('executeSpreadsheet - formulas', () => {
  it('should apply formulas', async () => {
    const sheets = [
      {
        name: 'Calc',
        columns: [
          { header: 'A', key: 'a' },
          { header: 'B', key: 'b' },
          { header: 'Sum', key: 'sum' },
        ],
        data: [
          { a: 10, b: 20 },
          { a: 30, b: 40 },
        ],
        formulas: [{ cell: 'C4', formula: 'SUM(A2:A3)' }],
      },
    ];
    const res = await executeSpreadsheet(makeCall({ filename: 'formulas', sheets }));
    expect(res.isError).toBe(false);
  });
});

// -------------------------------------------------------------------
// Formatting
// -------------------------------------------------------------------
describe('executeSpreadsheet - formatting', () => {
  it('should apply formatting', async () => {
    const sheets = [
      {
        name: 'Formatted',
        columns: [{ header: 'Val', key: 'val' }],
        data: [{ val: 100 }],
        formatting: [
          { cell: 'A1', bold: true, fill: '#FF0000', fontColor: '#FFFFFF', border: true },
          { cell: 'A2', numFmt: '$#,##0.00' },
        ],
      },
    ];
    const res = await executeSpreadsheet(makeCall({ filename: 'fmt', sheets }));
    expect(res.isError).toBe(false);
  });
});

// -------------------------------------------------------------------
// Column width
// -------------------------------------------------------------------
describe('executeSpreadsheet - column width', () => {
  it('should accept custom column widths', async () => {
    const sheets = [
      {
        name: 'Widths',
        columns: [
          { header: 'Narrow', key: 'n', width: 5 },
          { header: 'Wide', key: 'w', width: 50 },
        ],
        data: [{ n: 'A', w: 'B' }],
      },
    ];
    const res = await executeSpreadsheet(makeCall({ filename: 'widths', sheets }));
    expect(res.isError).toBe(false);
  });
});

// -------------------------------------------------------------------
// String arguments
// -------------------------------------------------------------------
describe('executeSpreadsheet - string arguments', () => {
  it('should parse string arguments', async () => {
    const res = await executeSpreadsheet({
      id: 'test',
      name: 'create_spreadsheet',
      arguments: JSON.stringify({ filename: 'str', sheets: basicSheets() }),
    });
    expect(res.isError).toBe(false);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeSpreadsheet - errors', () => {
  it('should error without sheets', async () => {
    const res = await executeSpreadsheet(makeCall({ filename: 'fail' }));
    expect(res.isError).toBe(true);
  });

  it('should error with empty sheets array', async () => {
    const res = await executeSpreadsheet(makeCall({ filename: 'fail', sheets: [] }));
    expect(res.isError).toBe(true);
  });

  it('should error for wrong tool name', async () => {
    const res = await executeSpreadsheet({
      id: 'test',
      name: 'wrong_tool',
      arguments: { filename: 'test', sheets: basicSheets() },
    });
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeSpreadsheet({
      id: 'my-id',
      name: 'create_spreadsheet',
      arguments: { filename: 'test', sheets: basicSheets() },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
