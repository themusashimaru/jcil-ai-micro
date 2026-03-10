/**
 * DATABASE SCHEMA DESIGNER
 *
 * PURPOSE:
 * - Design and generate database schemas
 * - Supabase integration for deployment
 * - Visual schema representation
 * - Generate migrations and types
 */

export interface Column {
  name: string;
  type: 'text' | 'varchar' | 'int' | 'bigint' | 'boolean' | 'timestamp' | 'uuid' | 'json' | 'numeric';
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isUnique: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface Table {
  name: string;
  columns: Column[];
  indexes?: string[];
  policies?: {
    name: string;
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
    using?: string;
    withCheck?: string;
  }[];
}

export interface Schema {
  name: string;
  tables: Table[];
  enums?: { name: string; values: string[] }[];
}

// Common table templates
const TABLE_TEMPLATES: Record<string, Table> = {
  users: {
    name: 'users',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, defaultValue: 'gen_random_uuid()', isPrimaryKey: true, isUnique: true },
      { name: 'email', type: 'text', nullable: false, isPrimaryKey: false, isUnique: true },
      { name: 'name', type: 'text', nullable: true, isPrimaryKey: false, isUnique: false },
      { name: 'avatar_url', type: 'text', nullable: true, isPrimaryKey: false, isUnique: false },
      { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'now()', isPrimaryKey: false, isUnique: false },
      { name: 'updated_at', type: 'timestamp', nullable: false, defaultValue: 'now()', isPrimaryKey: false, isUnique: false },
    ],
    policies: [
      { name: 'Users can view own profile', operation: 'SELECT', using: 'auth.uid() = id' },
      { name: 'Users can update own profile', operation: 'UPDATE', using: 'auth.uid() = id' },
    ],
  },
  posts: {
    name: 'posts',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, defaultValue: 'gen_random_uuid()', isPrimaryKey: true, isUnique: true },
      { name: 'user_id', type: 'uuid', nullable: false, isPrimaryKey: false, isUnique: false, references: { table: 'users', column: 'id' } },
      { name: 'title', type: 'text', nullable: false, isPrimaryKey: false, isUnique: false },
      { name: 'content', type: 'text', nullable: true, isPrimaryKey: false, isUnique: false },
      { name: 'published', type: 'boolean', nullable: false, defaultValue: 'false', isPrimaryKey: false, isUnique: false },
      { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'now()', isPrimaryKey: false, isUnique: false },
      { name: 'updated_at', type: 'timestamp', nullable: false, defaultValue: 'now()', isPrimaryKey: false, isUnique: false },
    ],
    policies: [
      { name: 'Anyone can view published posts', operation: 'SELECT', using: 'published = true' },
      { name: 'Users can manage own posts', operation: 'ALL', using: 'auth.uid() = user_id' },
    ],
  },
  comments: {
    name: 'comments',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, defaultValue: 'gen_random_uuid()', isPrimaryKey: true, isUnique: true },
      { name: 'post_id', type: 'uuid', nullable: false, isPrimaryKey: false, isUnique: false, references: { table: 'posts', column: 'id' } },
      { name: 'user_id', type: 'uuid', nullable: false, isPrimaryKey: false, isUnique: false, references: { table: 'users', column: 'id' } },
      { name: 'content', type: 'text', nullable: false, isPrimaryKey: false, isUnique: false },
      { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'now()', isPrimaryKey: false, isUnique: false },
    ],
    policies: [
      { name: 'Anyone can view comments', operation: 'SELECT' },
      { name: 'Auth users can comment', operation: 'INSERT', withCheck: 'auth.uid() = user_id' },
      { name: 'Users can manage own comments', operation: 'ALL', using: 'auth.uid() = user_id' },
    ],
  },
  products: {
    name: 'products',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, defaultValue: 'gen_random_uuid()', isPrimaryKey: true, isUnique: true },
      { name: 'name', type: 'text', nullable: false, isPrimaryKey: false, isUnique: false },
      { name: 'description', type: 'text', nullable: true, isPrimaryKey: false, isUnique: false },
      { name: 'price', type: 'numeric', nullable: false, isPrimaryKey: false, isUnique: false },
      { name: 'image_url', type: 'text', nullable: true, isPrimaryKey: false, isUnique: false },
      { name: 'stock', type: 'int', nullable: false, defaultValue: '0', isPrimaryKey: false, isUnique: false },
      { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'now()', isPrimaryKey: false, isUnique: false },
    ],
    policies: [
      { name: 'Anyone can view products', operation: 'SELECT' },
    ],
  },
  orders: {
    name: 'orders',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, defaultValue: 'gen_random_uuid()', isPrimaryKey: true, isUnique: true },
      { name: 'user_id', type: 'uuid', nullable: false, isPrimaryKey: false, isUnique: false, references: { table: 'users', column: 'id' } },
      { name: 'status', type: 'text', nullable: false, defaultValue: "'pending'", isPrimaryKey: false, isUnique: false },
      { name: 'total', type: 'numeric', nullable: false, isPrimaryKey: false, isUnique: false },
      { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'now()', isPrimaryKey: false, isUnique: false },
    ],
    policies: [
      { name: 'Users can view own orders', operation: 'SELECT', using: 'auth.uid() = user_id' },
      { name: 'Users can create own orders', operation: 'INSERT', withCheck: 'auth.uid() = user_id' },
    ],
  },
};

// Generate SQL for a table
export function generateTableSQL(table: Table): string {
  const columns = table.columns.map((col) => {
    let def = `  "${col.name}" ${col.type.toUpperCase()}`;
    if (!col.nullable) def += ' NOT NULL';
    if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
    if (col.isUnique && !col.isPrimaryKey) def += ' UNIQUE';
    return def;
  });

  // Add primary key
  const pkColumns = table.columns.filter((c) => c.isPrimaryKey).map((c) => `"${c.name}"`);
  if (pkColumns.length > 0) {
    columns.push(`  PRIMARY KEY (${pkColumns.join(', ')})`);
  }

  // Add foreign keys
  for (const col of table.columns) {
    if (col.references) {
      columns.push(`  FOREIGN KEY ("${col.name}") REFERENCES "${col.references.table}" ("${col.references.column}") ON DELETE CASCADE`);
    }
  }

  return `CREATE TABLE IF NOT EXISTS "${table.name}" (\n${columns.join(',\n')}\n);`;
}

// Generate RLS policies
export function generatePoliciesSQL(table: Table): string {
  if (!table.policies || table.policies.length === 0) return '';

  let sql = `ALTER TABLE "${table.name}" ENABLE ROW LEVEL SECURITY;\n\n`;

  for (const policy of table.policies) {
    const policyName = policy.name.toLowerCase().replace(/\s+/g, '_');
    sql += `CREATE POLICY "${policyName}" ON "${table.name}"\n`;
    sql += `  FOR ${policy.operation}\n`;
    if (policy.using) sql += `  USING (${policy.using})\n`;
    if (policy.withCheck) sql += `  WITH CHECK (${policy.withCheck})\n`;
    sql += ';\n\n';
  }

  return sql;
}

// Generate full schema SQL
export function generateSchemaSQL(schema: Schema): string {
  let sql = `-- Schema: ${schema.name}\n`;
  sql += `-- Generated by JCIL.AI Database Designer\n\n`;

  // Generate enums
  if (schema.enums && schema.enums.length > 0) {
    sql += '-- Enums\n';
    for (const enumDef of schema.enums) {
      sql += `CREATE TYPE "${enumDef.name}" AS ENUM (${enumDef.values.map((v) => `'${v}'`).join(', ')});\n`;
    }
    sql += '\n';
  }

  // Generate tables
  sql += '-- Tables\n';
  for (const table of schema.tables) {
    sql += generateTableSQL(table) + '\n\n';
  }

  // Generate policies
  sql += '-- Row Level Security Policies\n';
  for (const table of schema.tables) {
    sql += generatePoliciesSQL(table);
  }

  return sql;
}

// Generate TypeScript types from schema
export function generateTypeScript(schema: Schema): string {
  let ts = `// Types generated by JCIL.AI Database Designer\n\n`;

  // Generate enum types
  if (schema.enums && schema.enums.length > 0) {
    for (const enumDef of schema.enums) {
      ts += `export type ${enumDef.name} = ${enumDef.values.map((v) => `'${v}'`).join(' | ')};\n\n`;
    }
  }

  // Map SQL types to TypeScript
  const typeMap: Record<string, string> = {
    text: 'string',
    varchar: 'string',
    int: 'number',
    bigint: 'number',
    boolean: 'boolean',
    timestamp: 'string',
    uuid: 'string',
    json: 'Record<string, unknown>',
    numeric: 'number',
  };

  // Generate table types
  for (const table of schema.tables) {
    const typeName = table.name.charAt(0).toUpperCase() + table.name.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase());

    ts += `export interface ${typeName} {\n`;
    for (const col of table.columns) {
      const tsType = typeMap[col.type] || 'unknown';
      const nullable = col.nullable ? ' | null' : '';
      ts += `  ${col.name}: ${tsType}${nullable};\n`;
    }
    ts += '}\n\n';

    // Generate insert type (without auto-generated fields)
    ts += `export interface ${typeName}Insert {\n`;
    for (const col of table.columns) {
      const isAutoGenerated = col.defaultValue && (col.defaultValue.includes('gen_random_uuid') || col.defaultValue.includes('now()'));
      if (isAutoGenerated) continue;

      const tsType = typeMap[col.type] || 'unknown';
      const optional = col.nullable || col.defaultValue ? '?' : '';
      ts += `  ${col.name}${optional}: ${tsType};\n`;
    }
    ts += '}\n\n';
  }

  return ts;
}

// Design a schema from description
export function designSchemaFromDescription(description: string): Schema {
  const tables: Table[] = [];
  const descLower = description.toLowerCase();

  // Detect needed tables
  if (descLower.includes('user') || descLower.includes('auth')) {
    tables.push(TABLE_TEMPLATES.users);
  }

  if (descLower.includes('post') || descLower.includes('blog') || descLower.includes('article')) {
    tables.push(TABLE_TEMPLATES.posts);
    if (descLower.includes('comment')) {
      tables.push(TABLE_TEMPLATES.comments);
    }
  }

  if (descLower.includes('product') || descLower.includes('shop') || descLower.includes('store') || descLower.includes('ecommerce')) {
    tables.push(TABLE_TEMPLATES.products);
    if (descLower.includes('order') || descLower.includes('purchase')) {
      tables.push(TABLE_TEMPLATES.orders);
    }
  }

  // Always include users if we have any user-related tables
  const hasUserFK = tables.some((t) => t.columns.some((c) => c.references?.table === 'users'));
  if (hasUserFK && !tables.find((t) => t.name === 'users')) {
    tables.unshift(TABLE_TEMPLATES.users);
  }

  return {
    name: 'app_schema',
    tables,
  };
}

// Get available templates
export function getTableTemplates(): string[] {
  return Object.keys(TABLE_TEMPLATES);
}

// Get a specific template
export function getTableTemplate(name: string): Table | undefined {
  return TABLE_TEMPLATES[name];
}
