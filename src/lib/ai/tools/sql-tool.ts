/**
 * SQL QUERY TOOL
 *
 * Run SQL queries on data using SQL.js (SQLite in WebAssembly).
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Create in-memory databases
 * - Import JSON/CSV data as tables
 * - Execute SQL queries
 * - Export query results
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded SQL.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initSqlJs: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SQL: any = null;

async function initSQL(): Promise<boolean> {
  if (SQL) return true;
  try {
    const mod = await import('sql.js');
    initSqlJs = mod.default;
    SQL = await initSqlJs();
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const sqlTool: UnifiedTool = {
  name: 'query_data_sql',
  description: `Run SQL queries on data using an in-memory SQLite database.

Capabilities:
- Execute any valid SQLite SQL query
- Create tables from JSON arrays
- Create tables from CSV data
- Join, filter, aggregate, and transform data
- Export results as JSON

Use cases:
- Analyze CSV/JSON data with SQL
- Join multiple datasets
- Complex filtering and aggregations
- Data transformations

The database is ephemeral (in-memory) - data is not persisted.
Provide data as JSON array or CSV string to create tables.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'query',
          'create_table',
          'import_json',
          'import_csv',
          'list_tables',
          'describe_table',
        ],
        description: 'SQL operation to perform',
      },
      query: {
        type: 'string',
        description: 'SQL query to execute (for query operation)',
      },
      table_name: {
        type: 'string',
        description: 'Table name for import/create operations',
      },
      json_data: {
        type: 'array',
        description: 'JSON array of objects to import as table rows',
      },
      csv_data: {
        type: 'string',
        description: 'CSV string data to import (first row = headers)',
      },
      schema: {
        type: 'string',
        description: 'Optional SQL schema for create_table (e.g., "id INTEGER, name TEXT")',
      },
    },
    required: ['operation'],
  },
};

// In-memory database instance (persists during session)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isSQLAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeSQL(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    query?: string;
    table_name?: string;
    json_data?: Record<string, unknown>[];
    csv_data?: string;
    schema?: string;
  };

  if (!args.operation) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation is required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initSQL();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize SQL.js' }),
        isError: true,
      };
    }

    // Create database if not exists
    if (!db) {
      db = new SQL.Database();
    }

    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'query': {
        if (!args.query) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Query is required' }),
            isError: true,
          };
        }

        const stmt = db.prepare(args.query);
        const rows: Record<string, unknown>[] = [];
        const columns = stmt.getColumnNames();

        while (stmt.step()) {
          const row = stmt.get();
          const obj: Record<string, unknown> = {};
          columns.forEach((col: string, idx: number) => {
            obj[col] = row[idx];
          });
          rows.push(obj);
        }
        stmt.free();

        result = {
          operation: 'query',
          query: args.query,
          columns,
          row_count: rows.length,
          rows: rows.slice(0, 1000), // Limit to 1000 rows
          truncated: rows.length > 1000,
        };
        break;
      }

      case 'create_table': {
        if (!args.table_name || !args.schema) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Table name and schema required' }),
            isError: true,
          };
        }

        const createSQL = `CREATE TABLE IF NOT EXISTS ${args.table_name} (${args.schema})`;
        db.run(createSQL);

        result = {
          operation: 'create_table',
          table_name: args.table_name,
          schema: args.schema,
          success: true,
        };
        break;
      }

      case 'import_json': {
        if (!args.table_name || !args.json_data || args.json_data.length === 0) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Table name and JSON data required' }),
            isError: true,
          };
        }

        // Infer schema from first row
        const firstRow = args.json_data[0];
        const columns = Object.keys(firstRow);
        const schema = columns
          .map((col) => {
            const val = firstRow[col];
            const type = typeof val === 'number' ? 'REAL' : 'TEXT';
            return `"${col}" ${type}`;
          })
          .join(', ');

        // Create table
        db.run(`DROP TABLE IF EXISTS ${args.table_name}`);
        db.run(`CREATE TABLE ${args.table_name} (${schema})`);

        // Insert data
        const placeholders = columns.map(() => '?').join(', ');
        const insertSQL = `INSERT INTO ${args.table_name} VALUES (${placeholders})`;
        const stmt = db.prepare(insertSQL);

        for (const row of args.json_data) {
          const values = columns.map((col) => row[col]);
          stmt.run(values);
        }
        stmt.free();

        result = {
          operation: 'import_json',
          table_name: args.table_name,
          columns,
          rows_imported: args.json_data.length,
        };
        break;
      }

      case 'import_csv': {
        if (!args.table_name || !args.csv_data) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Table name and CSV data required' }),
            isError: true,
          };
        }

        const lines = args.csv_data.trim().split('\n');
        if (lines.length < 2) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'CSV must have header and at least one data row' }),
            isError: true,
          };
        }

        const headers = parseCSVLine(lines[0]);
        const schema = headers.map((h) => `"${h}" TEXT`).join(', ');

        // Create table
        db.run(`DROP TABLE IF EXISTS ${args.table_name}`);
        db.run(`CREATE TABLE ${args.table_name} (${schema})`);

        // Insert data
        const placeholders = headers.map(() => '?').join(', ');
        const insertSQL = `INSERT INTO ${args.table_name} VALUES (${placeholders})`;
        const stmt = db.prepare(insertSQL);

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          stmt.run(values);
        }
        stmt.free();

        result = {
          operation: 'import_csv',
          table_name: args.table_name,
          columns: headers,
          rows_imported: lines.length - 1,
        };
        break;
      }

      case 'list_tables': {
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        const tableNames =
          tables.length > 0 ? tables[0].values.map((row: unknown[]) => row[0]) : [];

        result = {
          operation: 'list_tables',
          tables: tableNames,
          count: tableNames.length,
        };
        break;
      }

      case 'describe_table': {
        if (!args.table_name) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Table name required' }),
            isError: true,
          };
        }

        const info = db.exec(`PRAGMA table_info(${args.table_name})`);
        const columns =
          info.length > 0
            ? info[0].values.map((row: unknown[]) => ({
                name: row[1],
                type: row[2],
                nullable: row[3] === 0,
                default: row[4],
                pk: row[5] === 1,
              }))
            : [];

        result = {
          operation: 'describe_table',
          table_name: args.table_name,
          columns,
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
        error: 'SQL operation failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}

// Simple CSV line parser (handles quoted values)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}
