/**
 * MIGRATION GENERATOR TOOL
 * Generate database migrations for various ORMs
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type MigrationConfig = {
  name: string;
  operations: Array<{
    type: 'createTable' | 'dropTable' | 'addColumn' | 'dropColumn' | 'addIndex' | 'dropIndex' | 'renameColumn' | 'modifyColumn';
    table: string;
    column?: string;
    columnType?: string;
    newName?: string;
    options?: Record<string, unknown>;
    columns?: Array<{ name: string; type: string; options?: Record<string, unknown> }>;
  }>;
};

function generatePrismaMigration(config: MigrationConfig): Record<string, unknown> {
  const { name, operations } = config;

  let sql = '';

  for (const op of operations) {
    switch (op.type) {
      case 'createTable':
        sql += `-- CreateTable\nCREATE TABLE "${op.table}" (\n`;
        sql += `    "id" TEXT NOT NULL,\n`;
        if (op.columns) {
          op.columns.forEach(col => {
            const sqlType = mapTypeToSQL(col.type);
            const nullable = col.options?.nullable ? '' : ' NOT NULL';
            const defaultVal = col.options?.default ? ` DEFAULT ${col.options.default}` : '';
            sql += `    "${col.name}" ${sqlType}${nullable}${defaultVal},\n`;
          });
        }
        sql += `    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
        sql += `    "updatedAt" TIMESTAMP(3) NOT NULL,\n`;
        sql += `\n    CONSTRAINT "${op.table}_pkey" PRIMARY KEY ("id")\n);\n\n`;
        break;

      case 'dropTable':
        sql += `-- DropTable\nDROP TABLE "${op.table}";\n\n`;
        break;

      case 'addColumn':
        const addType = mapTypeToSQL(op.columnType || 'string');
        sql += `-- AddColumn\nALTER TABLE "${op.table}" ADD COLUMN "${op.column}" ${addType};\n\n`;
        break;

      case 'dropColumn':
        sql += `-- DropColumn\nALTER TABLE "${op.table}" DROP COLUMN "${op.column}";\n\n`;
        break;

      case 'addIndex':
        const indexName = `${op.table}_${op.column}_idx`;
        sql += `-- CreateIndex\nCREATE INDEX "${indexName}" ON "${op.table}"("${op.column}");\n\n`;
        break;

      case 'renameColumn':
        sql += `-- RenameColumn\nALTER TABLE "${op.table}" RENAME COLUMN "${op.column}" TO "${op.newName}";\n\n`;
        break;
    }
  }

  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

  return {
    migrationName: `${timestamp}_${name}`,
    sql,
    prismaSchemaChanges: generatePrismaSchemaChanges(operations),
    commands: [
      `npx prisma migrate dev --name ${name}`,
      'npx prisma generate'
    ]
  };
}

function generatePrismaSchemaChanges(operations: MigrationConfig['operations']): string {
  let schema = '';

  for (const op of operations) {
    if (op.type === 'createTable') {
      schema += `model ${op.table} {\n`;
      schema += `  id        String   @id @default(cuid())\n`;
      if (op.columns) {
        op.columns.forEach(col => {
          const prismaType = mapTypeToPrisma(col.type);
          const optional = col.options?.nullable ? '?' : '';
          const defaultVal = col.options?.default ? ` @default(${col.options.default})` : '';
          schema += `  ${col.name.padEnd(10)} ${prismaType}${optional}${defaultVal}\n`;
        });
      }
      schema += `  createdAt DateTime @default(now())\n`;
      schema += `  updatedAt DateTime @updatedAt\n`;
      schema += `}\n\n`;
    }
  }

  return schema;
}

function generateKnexMigration(config: MigrationConfig): Record<string, unknown> {
  const { name, operations } = config;

  let upCode = `exports.up = function(knex) {\n  return knex.schema\n`;
  let downCode = `exports.down = function(knex) {\n  return knex.schema\n`;

  for (const op of operations) {
    switch (op.type) {
      case 'createTable':
        upCode += `    .createTable('${op.table}', (table) => {\n`;
        upCode += `      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));\n`;
        if (op.columns) {
          op.columns.forEach(col => {
            const knexType = mapTypeToKnex(col.type);
            const chain = col.options?.nullable ? '' : '.notNullable()';
            const defaultVal = col.options?.default ? `.defaultTo(${col.options.default})` : '';
            upCode += `      table.${knexType}('${col.name}')${chain}${defaultVal};\n`;
          });
        }
        upCode += `      table.timestamps(true, true);\n`;
        upCode += `    })\n`;
        downCode += `    .dropTableIfExists('${op.table}')\n`;
        break;

      case 'dropTable':
        upCode += `    .dropTableIfExists('${op.table}')\n`;
        downCode += `    // Recreate ${op.table} if needed\n`;
        break;

      case 'addColumn':
        upCode += `    .table('${op.table}', (table) => {\n`;
        upCode += `      table.${mapTypeToKnex(op.columnType || 'string')}('${op.column}');\n`;
        upCode += `    })\n`;
        downCode += `    .table('${op.table}', (table) => {\n`;
        downCode += `      table.dropColumn('${op.column}');\n`;
        downCode += `    })\n`;
        break;

      case 'addIndex':
        upCode += `    .table('${op.table}', (table) => {\n`;
        upCode += `      table.index('${op.column}');\n`;
        upCode += `    })\n`;
        downCode += `    .table('${op.table}', (table) => {\n`;
        downCode += `      table.dropIndex('${op.column}');\n`;
        downCode += `    })\n`;
        break;
    }
  }

  upCode += `;\n};\n`;
  downCode += `;\n};\n`;

  const timestamp = Date.now();

  return {
    filename: `${timestamp}_${name}.js`,
    code: upCode + '\n' + downCode,
    commands: [
      `npx knex migrate:make ${name}`,
      'npx knex migrate:latest'
    ]
  };
}

function generateTypeORMMigration(config: MigrationConfig): Record<string, unknown> {
  const { name, operations } = config;
  const className = name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const timestamp = Date.now();

  let upCode = '';
  let downCode = '';

  for (const op of operations) {
    switch (op.type) {
      case 'createTable':
        upCode += `        await queryRunner.createTable(\n`;
        upCode += `            new Table({\n`;
        upCode += `                name: '${op.table}',\n`;
        upCode += `                columns: [\n`;
        upCode += `                    { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },\n`;
        if (op.columns) {
          op.columns.forEach(col => {
            const sqlType = mapTypeToSQL(col.type).toLowerCase();
            upCode += `                    { name: '${col.name}', type: '${sqlType}', isNullable: ${col.options?.nullable || false} },\n`;
          });
        }
        upCode += `                    { name: 'createdAt', type: 'timestamp', default: 'now()' },\n`;
        upCode += `                    { name: 'updatedAt', type: 'timestamp', default: 'now()' },\n`;
        upCode += `                ],\n`;
        upCode += `            }),\n`;
        upCode += `            true,\n`;
        upCode += `        );\n`;
        downCode += `        await queryRunner.dropTable('${op.table}');\n`;
        break;

      case 'addColumn':
        upCode += `        await queryRunner.addColumn('${op.table}', new TableColumn({\n`;
        upCode += `            name: '${op.column}',\n`;
        upCode += `            type: '${mapTypeToSQL(op.columnType || 'string').toLowerCase()}',\n`;
        upCode += `        }));\n`;
        downCode += `        await queryRunner.dropColumn('${op.table}', '${op.column}');\n`;
        break;

      case 'addIndex':
        upCode += `        await queryRunner.createIndex('${op.table}', new TableIndex({\n`;
        upCode += `            name: 'IDX_${op.table}_${op.column}',\n`;
        upCode += `            columnNames: ['${op.column}'],\n`;
        upCode += `        }));\n`;
        downCode += `        await queryRunner.dropIndex('${op.table}', 'IDX_${op.table}_${op.column}');\n`;
        break;
    }
  }

  const code = `import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class ${className}${timestamp} implements MigrationInterface {
    name = '${className}${timestamp}';

    public async up(queryRunner: QueryRunner): Promise<void> {
${upCode}
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
${downCode}
    }
}`;

  return {
    filename: `${timestamp}-${className}.ts`,
    code,
    commands: [
      `npx typeorm migration:create ./migrations/${className}`,
      'npx typeorm migration:run'
    ]
  };
}

function generateSequelizeMigration(config: MigrationConfig): Record<string, unknown> {
  const { name, operations } = config;

  let upCode = `module.exports = {\n  async up(queryInterface, Sequelize) {\n`;
  let downCode = `  async down(queryInterface, Sequelize) {\n`;

  for (const op of operations) {
    switch (op.type) {
      case 'createTable':
        upCode += `    await queryInterface.createTable('${op.table}', {\n`;
        upCode += `      id: {\n`;
        upCode += `        type: Sequelize.UUID,\n`;
        upCode += `        defaultValue: Sequelize.UUIDV4,\n`;
        upCode += `        primaryKey: true,\n`;
        upCode += `      },\n`;
        if (op.columns) {
          op.columns.forEach(col => {
            const seqType = mapTypeToSequelize(col.type);
            upCode += `      ${col.name}: {\n`;
            upCode += `        type: Sequelize.${seqType},\n`;
            upCode += `        allowNull: ${col.options?.nullable || false},\n`;
            if (col.options?.default) {
              upCode += `        defaultValue: ${col.options.default},\n`;
            }
            upCode += `      },\n`;
          });
        }
        upCode += `      createdAt: {\n`;
        upCode += `        type: Sequelize.DATE,\n`;
        upCode += `        allowNull: false,\n`;
        upCode += `      },\n`;
        upCode += `      updatedAt: {\n`;
        upCode += `        type: Sequelize.DATE,\n`;
        upCode += `        allowNull: false,\n`;
        upCode += `      },\n`;
        upCode += `    });\n`;
        downCode += `    await queryInterface.dropTable('${op.table}');\n`;
        break;

      case 'addColumn':
        upCode += `    await queryInterface.addColumn('${op.table}', '${op.column}', {\n`;
        upCode += `      type: Sequelize.${mapTypeToSequelize(op.columnType || 'string')},\n`;
        upCode += `    });\n`;
        downCode += `    await queryInterface.removeColumn('${op.table}', '${op.column}');\n`;
        break;

      case 'addIndex':
        upCode += `    await queryInterface.addIndex('${op.table}', ['${op.column}']);\n`;
        downCode += `    await queryInterface.removeIndex('${op.table}', ['${op.column}']);\n`;
        break;
    }
  }

  upCode += `  },\n`;
  downCode += `  },\n};\n`;

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

  return {
    filename: `${timestamp}-${name}.js`,
    code: upCode + downCode,
    commands: [
      `npx sequelize-cli migration:generate --name ${name}`,
      'npx sequelize-cli db:migrate'
    ]
  };
}

function mapTypeToSQL(type: string): string {
  const mapping: Record<string, string> = {
    string: 'VARCHAR(255)',
    text: 'TEXT',
    integer: 'INTEGER',
    int: 'INTEGER',
    bigint: 'BIGINT',
    float: 'REAL',
    double: 'DOUBLE PRECISION',
    decimal: 'DECIMAL(10,2)',
    boolean: 'BOOLEAN',
    bool: 'BOOLEAN',
    date: 'DATE',
    datetime: 'TIMESTAMP',
    timestamp: 'TIMESTAMP',
    json: 'JSONB',
    uuid: 'UUID'
  };
  return mapping[type.toLowerCase()] || 'VARCHAR(255)';
}

function mapTypeToPrisma(type: string): string {
  const mapping: Record<string, string> = {
    string: 'String',
    text: 'String',
    integer: 'Int',
    int: 'Int',
    bigint: 'BigInt',
    float: 'Float',
    double: 'Float',
    decimal: 'Decimal',
    boolean: 'Boolean',
    bool: 'Boolean',
    date: 'DateTime',
    datetime: 'DateTime',
    timestamp: 'DateTime',
    json: 'Json',
    uuid: 'String'
  };
  return mapping[type.toLowerCase()] || 'String';
}

function mapTypeToKnex(type: string): string {
  const mapping: Record<string, string> = {
    string: 'string',
    text: 'text',
    integer: 'integer',
    int: 'integer',
    bigint: 'bigInteger',
    float: 'float',
    double: 'double',
    decimal: 'decimal',
    boolean: 'boolean',
    bool: 'boolean',
    date: 'date',
    datetime: 'datetime',
    timestamp: 'timestamp',
    json: 'jsonb',
    uuid: 'uuid'
  };
  return mapping[type.toLowerCase()] || 'string';
}

function mapTypeToSequelize(type: string): string {
  const mapping: Record<string, string> = {
    string: 'STRING',
    text: 'TEXT',
    integer: 'INTEGER',
    int: 'INTEGER',
    bigint: 'BIGINT',
    float: 'FLOAT',
    double: 'DOUBLE',
    decimal: 'DECIMAL',
    boolean: 'BOOLEAN',
    bool: 'BOOLEAN',
    date: 'DATEONLY',
    datetime: 'DATE',
    timestamp: 'DATE',
    json: 'JSONB',
    uuid: 'UUID'
  };
  return mapping[type.toLowerCase()] || 'STRING';
}

function generateRollbackPlan(migrations: string[]): Record<string, unknown> {
  return {
    rollbackPlan: migrations.reverse().map((m, i) => ({
      step: i + 1,
      migration: m,
      command: `npx prisma migrate resolve --rolled-back ${m}`
    })),
    safetyChecks: [
      'Backup database before rollback',
      'Test rollback in staging first',
      'Notify team of planned rollback',
      'Have data recovery plan ready'
    ],
    commands: {
      prisma: 'npx prisma migrate reset',
      knex: 'npx knex migrate:rollback',
      typeorm: 'npx typeorm migration:revert',
      sequelize: 'npx sequelize-cli db:migrate:undo'
    }
  };
}

export const migrationGeneratorTool: UnifiedTool = {
  name: 'migration_generator',
  description: 'Migration Generator: prisma, knex, typeorm, sequelize, rollback_plan',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['prisma', 'knex', 'typeorm', 'sequelize', 'rollback_plan'] },
      config: { type: 'object' },
      migrations: { type: 'array' }
    },
    required: ['operation']
  },
};

export async function executeMigrationGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const defaultConfig: MigrationConfig = {
      name: 'create_users',
      operations: [
        {
          type: 'createTable',
          table: 'users',
          columns: [
            { name: 'email', type: 'string', options: { nullable: false } },
            { name: 'name', type: 'string', options: { nullable: true } },
            { name: 'role', type: 'string', options: { default: "'user'" } },
            { name: 'isActive', type: 'boolean', options: { default: 'true' } }
          ]
        },
        { type: 'addIndex', table: 'users', column: 'email' }
      ]
    };

    switch (args.operation) {
      case 'prisma':
        result = generatePrismaMigration(args.config || defaultConfig);
        break;
      case 'knex':
        result = generateKnexMigration(args.config || defaultConfig);
        break;
      case 'typeorm':
        result = generateTypeORMMigration(args.config || defaultConfig);
        break;
      case 'sequelize':
        result = generateSequelizeMigration(args.config || defaultConfig);
        break;
      case 'rollback_plan':
        result = generateRollbackPlan(args.migrations || ['20240101_create_users', '20240102_add_posts']);
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isMigrationGeneratorAvailable(): boolean { return true; }
