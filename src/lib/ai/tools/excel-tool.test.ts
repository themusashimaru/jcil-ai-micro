import { describe, it, expect } from 'vitest';
import { executeExcel, isExcelAvailable, excelTool } from './excel-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'excel_advanced', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeExcel(makeCall(args));
  return JSON.parse(res.content);
}

// Helper: create an xlsx workbook and return its base64
async function createWorkbook(
  data: unknown[][],
  headers?: string[],
  sheetName?: string
): Promise<string> {
  const result = await getResult({
    operation: 'create',
    data,
    headers,
    sheet_name: sheetName,
    output_format: 'xlsx',
  });
  return result.xlsx_base64;
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('excelTool metadata', () => {
  it('should have correct name', () => {
    expect(excelTool.name).toBe('excel_advanced');
  });

  it('should require operation', () => {
    expect(excelTool.parameters.required).toContain('operation');
  });
});

describe('isExcelAvailable', () => {
  it('should return true', () => {
    expect(isExcelAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// create operation
// -------------------------------------------------------------------
describe('executeExcel - create', () => {
  it('should create workbook with data', async () => {
    const result = await getResult({
      operation: 'create',
      data: [
        [1, 'Alice', 90],
        [2, 'Bob', 85],
      ],
    });
    expect(result.operation).toBe('create');
    expect(result.sheet_name).toBe('Sheet1');
    expect(result.rows).toBe(2);
    expect(result.xlsx_base64).toBeDefined();
  });

  it('should create workbook with headers', async () => {
    const result = await getResult({
      operation: 'create',
      data: [[1, 'Alice']],
      headers: ['ID', 'Name'],
      sheet_name: 'Students',
    });
    expect(result.sheet_name).toBe('Students');
  });

  it('should output as CSV', async () => {
    const result = await getResult({
      operation: 'create',
      data: [
        ['A', 1],
        ['B', 2],
      ],
      headers: ['Letter', 'Number'],
      output_format: 'csv',
    });
    expect(result.format).toBe('csv');
    expect(result.content).toContain('Letter');
    expect(result.content).toContain('A');
  });

  it('should output as JSON', async () => {
    const result = await getResult({
      operation: 'create',
      data: [['Alice', 90]],
      headers: ['Name', 'Score'],
      output_format: 'json',
    });
    expect(result.format).toBe('json');
    expect(result.data).toBeDefined();
    expect(result.data[0].Name).toBe('Alice');
  });

  it('should output as HTML', async () => {
    const result = await getResult({
      operation: 'create',
      data: [['X', 'Y']],
      output_format: 'html',
    });
    expect(result.format).toBe('html');
    expect(result.html).toContain('<');
  });

  it('should error without data', async () => {
    const res = await executeExcel(makeCall({ operation: 'create' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// read operation
// -------------------------------------------------------------------
describe('executeExcel - read', () => {
  it('should read back created workbook', async () => {
    const wb = await createWorkbook(
      [
        [1, 'Alice'],
        [2, 'Bob'],
      ],
      ['ID', 'Name']
    );
    const result = await getResult({
      operation: 'read',
      workbook_data: wb,
    });
    expect(result.operation).toBe('read');
    expect(result.rows).toBeGreaterThanOrEqual(2);
    expect(result.all_sheets).toContain('Sheet1');
  });

  it('should error without workbook_data', async () => {
    const res = await executeExcel(makeCall({ operation: 'read' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// get_sheets operation
// -------------------------------------------------------------------
describe('executeExcel - get_sheets', () => {
  it('should list sheets', async () => {
    const wb = await createWorkbook([[1]], undefined, 'Data');
    const result = await getResult({
      operation: 'get_sheets',
      workbook_data: wb,
    });
    expect(result.operation).toBe('get_sheets');
    expect(result.count).toBe(1);
    expect(result.sheets[0].name).toBe('Data');
  });
});

// -------------------------------------------------------------------
// add_sheet operation
// -------------------------------------------------------------------
describe('executeExcel - add_sheet', () => {
  it('should add sheet to existing workbook', async () => {
    const wb = await createWorkbook([[1]], undefined, 'Sheet1');
    const result = await getResult({
      operation: 'add_sheet',
      workbook_data: wb,
      sheet_name: 'Sheet2',
      data: [['A', 'B']],
    });
    expect(result.operation).toBe('add_sheet');
    expect(result.new_sheet).toBe('Sheet2');
    expect(result.all_sheets).toContain('Sheet1');
    expect(result.all_sheets).toContain('Sheet2');
  });

  it('should error without required fields', async () => {
    const res = await executeExcel(makeCall({ operation: 'add_sheet' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// extract_range operation
// -------------------------------------------------------------------
describe('executeExcel - extract_range', () => {
  it('should extract specific range', async () => {
    const wb = await createWorkbook(
      [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      ['A', 'B', 'C']
    );
    const result = await getResult({
      operation: 'extract_range',
      workbook_data: wb,
      range: 'A1:B2',
    });
    expect(result.operation).toBe('extract_range');
    expect(result.range).toBe('A1:B2');
    expect(result.data).toBeDefined();
  });

  it('should error without required fields', async () => {
    const res = await executeExcel(makeCall({ operation: 'extract_range' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// apply_formula operation
// -------------------------------------------------------------------
describe('executeExcel - apply_formula', () => {
  it('should apply formulas', async () => {
    const wb = await createWorkbook(
      [
        [10, 20],
        [30, 40],
      ],
      ['A', 'B']
    );
    const result = await getResult({
      operation: 'apply_formula',
      workbook_data: wb,
      formulas: [{ cell: 'C1', formula: 'SUM(A2:B2)' }],
    });
    expect(result.operation).toBe('apply_formula');
    expect(result.formulas_applied).toBe(1);
    expect(result.xlsx_base64).toBeDefined();
  });

  it('should error without required fields', async () => {
    const res = await executeExcel(makeCall({ operation: 'apply_formula' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeExcel - errors', () => {
  it('should error for unknown operation', async () => {
    const res = await executeExcel(makeCall({ operation: 'xyz' }));
    expect(res.isError).toBe(true);
  });

  it('should error without operation', async () => {
    const res = await executeExcel(makeCall({}));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeExcel({
      id: 'my-id',
      name: 'excel_advanced',
      arguments: { operation: 'create', data: [[1]] },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
