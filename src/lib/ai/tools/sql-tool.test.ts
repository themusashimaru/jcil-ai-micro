// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { executeSQL, isSQLAvailable, sqlTool } from './sql-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'query_data_sql', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeSQL(makeCall(args));
  return JSON.parse(res.content);
}

// Helper: import a standard dataset for querying
async function importTestData() {
  return getResult({
    operation: 'import_json',
    table_name: 'employees',
    json_data: [
      { id: 1, name: 'Alice', salary: 80000 },
      { id: 2, name: 'Bob', salary: 75000 },
      { id: 3, name: 'Charlie', salary: 90000 },
    ],
  });
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('sqlTool metadata', () => {
  it('should have correct name', () => {
    expect(sqlTool.name).toBe('query_data_sql');
  });

  it('should require operation', () => {
    expect(sqlTool.parameters.required).toContain('operation');
  });
});

describe('isSQLAvailable', () => {
  it('should return true', () => {
    expect(isSQLAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// import_json operation
// -------------------------------------------------------------------
describe('executeSQL - import_json', () => {
  it('should import JSON data as table', async () => {
    const result = await getResult({
      operation: 'import_json',
      table_name: 'test_import',
      json_data: [
        { name: 'Alice', score: 90 },
        { name: 'Bob', score: 85 },
      ],
    });
    expect(result.operation).toBe('import_json');
    expect(result.table_name).toBe('test_import');
    expect(result.rows_imported).toBe(2);
    expect(result.columns).toContain('name');
    expect(result.columns).toContain('score');
  });

  it('should error without table_name', async () => {
    const res = await executeSQL(makeCall({ operation: 'import_json', json_data: [{ a: 1 }] }));
    expect(res.isError).toBe(true);
  });

  it('should error without json_data', async () => {
    const res = await executeSQL(makeCall({ operation: 'import_json', table_name: 'fail' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// import_csv operation
// -------------------------------------------------------------------
describe('executeSQL - import_csv', () => {
  it('should import CSV data as table', async () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const result = await getResult({
      operation: 'import_csv',
      table_name: 'csv_table',
      csv_data: csv,
    });
    expect(result.operation).toBe('import_csv');
    expect(result.rows_imported).toBe(2);
    expect(result.columns).toContain('name');
    expect(result.columns).toContain('age');
  });

  it('should handle quoted CSV values', async () => {
    const csv = 'name,city\n"Smith, John","New York"\nJane,Boston';
    const result = await getResult({
      operation: 'import_csv',
      table_name: 'csv_quoted',
      csv_data: csv,
    });
    expect(result.rows_imported).toBe(2);
  });

  it('should error without csv_data', async () => {
    const res = await executeSQL(makeCall({ operation: 'import_csv', table_name: 'fail' }));
    expect(res.isError).toBe(true);
  });

  it('should error with header-only CSV', async () => {
    const res = await executeSQL(
      makeCall({ operation: 'import_csv', table_name: 'fail', csv_data: 'a,b' })
    );
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// query operation
// -------------------------------------------------------------------
describe('executeSQL - query', () => {
  it('should query imported data', async () => {
    await importTestData();
    const result = await getResult({
      operation: 'query',
      query: 'SELECT * FROM employees ORDER BY id',
    });
    expect(result.operation).toBe('query');
    expect(result.row_count).toBe(3);
    expect(result.columns).toContain('name');
    expect(result.rows[0].name).toBe('Alice');
  });

  it('should support aggregation', async () => {
    await importTestData();
    const result = await getResult({
      operation: 'query',
      query: 'SELECT COUNT(*) as cnt, AVG(salary) as avg_sal FROM employees',
    });
    expect(result.rows[0].cnt).toBe(3);
    expect(result.rows[0].avg_sal).toBeCloseTo(81666.67, 0);
  });

  it('should support WHERE filtering', async () => {
    await importTestData();
    const result = await getResult({
      operation: 'query',
      query: 'SELECT name FROM employees WHERE salary > 79000 ORDER BY name',
    });
    expect(result.row_count).toBe(2);
    const names = result.rows.map((r: { name: string }) => r.name);
    expect(names).toContain('Alice');
    expect(names).toContain('Charlie');
  });

  it('should error without query', async () => {
    const res = await executeSQL(makeCall({ operation: 'query' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// create_table operation
// -------------------------------------------------------------------
describe('executeSQL - create_table', () => {
  it('should create table with schema', async () => {
    const result = await getResult({
      operation: 'create_table',
      table_name: 'products',
      schema: 'id INTEGER PRIMARY KEY, name TEXT, price REAL',
    });
    expect(result.operation).toBe('create_table');
    expect(result.table_name).toBe('products');
    expect(result.success).toBe(true);
  });

  it('should error without table_name', async () => {
    const res = await executeSQL(makeCall({ operation: 'create_table', schema: 'id INTEGER' }));
    expect(res.isError).toBe(true);
  });

  it('should error without schema', async () => {
    const res = await executeSQL(makeCall({ operation: 'create_table', table_name: 'fail' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// list_tables operation
// -------------------------------------------------------------------
describe('executeSQL - list_tables', () => {
  it('should list tables', async () => {
    await importTestData();
    const result = await getResult({ operation: 'list_tables' });
    expect(result.operation).toBe('list_tables');
    expect(result.count).toBeGreaterThanOrEqual(1);
    expect(result.tables).toContain('employees');
  });
});

// -------------------------------------------------------------------
// describe_table operation
// -------------------------------------------------------------------
describe('executeSQL - describe_table', () => {
  it('should describe table columns', async () => {
    await importTestData();
    const result = await getResult({
      operation: 'describe_table',
      table_name: 'employees',
    });
    expect(result.operation).toBe('describe_table');
    expect(result.table_name).toBe('employees');
    expect(result.columns.length).toBeGreaterThan(0);
    const names = result.columns.map((c: { name: string }) => c.name);
    expect(names).toContain('name');
  });

  it('should error without table_name', async () => {
    const res = await executeSQL(makeCall({ operation: 'describe_table' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeSQL - errors', () => {
  it('should error for unknown operation', async () => {
    const res = await executeSQL(makeCall({ operation: 'xyz' }));
    expect(res.isError).toBe(true);
  });

  it('should error without operation', async () => {
    const res = await executeSQL(makeCall({}));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeSQL({
      id: 'my-id',
      name: 'query_data_sql',
      arguments: { operation: 'list_tables' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
