import { describe, it, expect } from 'vitest';
import {
  generateTableSQL,
  generatePoliciesSQL,
  generateSchemaSQL,
  generateTypeScript,
  designSchemaFromDescription,
  getTableTemplates,
  getTableTemplate,
  type Column,
  type Table,
  type Schema,
} from './schemaDesigner';

describe('lib/database/schemaDesigner', () => {
  const usersTable: Table = {
    name: 'users',
    columns: [
      {
        name: 'id',
        type: 'uuid',
        nullable: false,
        defaultValue: 'gen_random_uuid()',
        isPrimaryKey: true,
        isUnique: true,
      },
      { name: 'email', type: 'text', nullable: false, isPrimaryKey: false, isUnique: true },
      { name: 'name', type: 'text', nullable: true, isPrimaryKey: false, isUnique: false },
      {
        name: 'created_at',
        type: 'timestamp',
        nullable: false,
        defaultValue: 'now()',
        isPrimaryKey: false,
        isUnique: false,
      },
    ],
  };

  // ── generateTableSQL ──────────────────────────────────────────

  describe('generateTableSQL', () => {
    it('generates CREATE TABLE statement', () => {
      const sql = generateTableSQL(usersTable);
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS "users"');
    });

    it('includes column definitions', () => {
      const sql = generateTableSQL(usersTable);
      expect(sql).toContain('"id"');
      expect(sql).toContain('"email"');
      expect(sql).toContain('UUID');
      expect(sql).toContain('TEXT');
    });

    it('adds NOT NULL constraint', () => {
      const sql = generateTableSQL(usersTable);
      expect(sql).toContain('NOT NULL');
    });

    it('adds DEFAULT values', () => {
      const sql = generateTableSQL(usersTable);
      expect(sql).toContain('DEFAULT gen_random_uuid()');
      expect(sql).toContain('DEFAULT now()');
    });

    it('adds UNIQUE constraint', () => {
      const sql = generateTableSQL(usersTable);
      expect(sql).toContain('UNIQUE');
    });

    it('adds PRIMARY KEY', () => {
      const sql = generateTableSQL(usersTable);
      expect(sql).toContain('PRIMARY KEY');
    });

    it('generates FOREIGN KEY for referenced columns', () => {
      const table: Table = {
        name: 'posts',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isUnique: true },
          {
            name: 'user_id',
            type: 'uuid',
            nullable: false,
            isPrimaryKey: false,
            isUnique: false,
            references: { table: 'users', column: 'id' },
          },
        ],
      };
      const sql = generateTableSQL(table);
      expect(sql).toContain('FOREIGN KEY');
      expect(sql).toContain('REFERENCES "users"');
      expect(sql).toContain('ON DELETE CASCADE');
    });
  });

  // ── generatePoliciesSQL ───────────────────────────────────────

  describe('generatePoliciesSQL', () => {
    it('returns empty string when no policies', () => {
      const sql = generatePoliciesSQL(usersTable);
      expect(sql).toBe('');
    });

    it('generates RLS policies', () => {
      const table: Table = {
        ...usersTable,
        policies: [{ name: 'Users can view', operation: 'SELECT', using: 'auth.uid() = id' }],
      };
      const sql = generatePoliciesSQL(table);
      expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
      expect(sql).toContain('CREATE POLICY');
      expect(sql).toContain('FOR SELECT');
      expect(sql).toContain('USING (auth.uid() = id)');
    });

    it('includes WITH CHECK when provided', () => {
      const table: Table = {
        ...usersTable,
        policies: [{ name: 'Users can insert', operation: 'INSERT', withCheck: 'auth.uid() = id' }],
      };
      const sql = generatePoliciesSQL(table);
      expect(sql).toContain('WITH CHECK');
    });
  });

  // ── generateSchemaSQL ─────────────────────────────────────────

  describe('generateSchemaSQL', () => {
    it('generates SQL for entire schema', () => {
      const schema: Schema = {
        name: 'test_schema',
        tables: [usersTable],
      };
      const sql = generateSchemaSQL(schema);
      expect(sql).toContain('CREATE TABLE');
    });

    it('handles enums', () => {
      const schema: Schema = {
        name: 'test',
        tables: [],
        enums: [{ name: 'status', values: ['active', 'inactive'] }],
      };
      const sql = generateSchemaSQL(schema);
      expect(sql).toContain('status');
    });
  });

  // ── generateTypeScript ────────────────────────────────────────

  describe('generateTypeScript', () => {
    it('generates TypeScript interfaces', () => {
      const schema: Schema = {
        name: 'test',
        tables: [usersTable],
      };
      const ts = generateTypeScript(schema);
      expect(ts).toContain('interface');
    });

    it('maps SQL types to TypeScript types', () => {
      const schema: Schema = {
        name: 'test',
        tables: [usersTable],
      };
      const ts = generateTypeScript(schema);
      expect(ts).toContain('string');
    });
  });

  // ── designSchemaFromDescription ───────────────────────────────

  describe('designSchemaFromDescription', () => {
    it('generates a schema from a description', () => {
      const schema = designSchemaFromDescription('A blog with users and posts');
      expect(schema.tables.length).toBeGreaterThan(0);
    });

    it('generates schema with name', () => {
      const schema = designSchemaFromDescription('E-commerce store');
      expect(schema.name).toBeDefined();
    });
  });

  // ── getTableTemplates ─────────────────────────────────────────

  describe('getTableTemplates', () => {
    it('returns list of template names', () => {
      const templates = getTableTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });

    it('includes users template', () => {
      const templates = getTableTemplates();
      expect(templates).toContain('users');
    });
  });

  // ── getTableTemplate ──────────────────────────────────────────

  describe('getTableTemplate', () => {
    it('returns users template', () => {
      const template = getTableTemplate('users');
      expect(template).toBeDefined();
      expect(template?.name).toBe('users');
    });

    it('returns undefined for unknown template', () => {
      const template = getTableTemplate('nonexistent');
      expect(template).toBeUndefined();
    });
  });

  // ── Types ─────────────────────────────────────────────────────

  describe('type exports', () => {
    it('Column has required shape', () => {
      const col: Column = {
        name: 'id',
        type: 'uuid',
        nullable: false,
        isPrimaryKey: true,
        isUnique: true,
      };
      expect(col.name).toBe('id');
    });

    it('Schema has required shape', () => {
      const schema: Schema = { name: 'test', tables: [] };
      expect(schema.tables).toEqual([]);
    });
  });
});
