import { describe, it, expect } from 'vitest';
import {
  executeMigrationGenerator,
  isMigrationGeneratorAvailable,
  migrationGeneratorTool,
} from './migration-generator-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'migration_generator', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeMigrationGenerator(makeCall(args));
  return JSON.parse(res.content);
}

const sampleConfig = {
  name: 'create_products',
  operations: [
    {
      type: 'createTable',
      table: 'products',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'price', type: 'decimal', options: { nullable: false } },
        { name: 'description', type: 'text', options: { nullable: true } },
        { name: 'active', type: 'boolean', options: { default: 'true' } },
      ],
    },
    { type: 'addIndex', table: 'products', column: 'title' },
  ],
};

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('migrationGeneratorTool metadata', () => {
  it('should have correct name', () => {
    expect(migrationGeneratorTool.name).toBe('migration_generator');
  });

  it('should require operation', () => {
    expect(migrationGeneratorTool.parameters.required).toContain('operation');
  });
});

describe('isMigrationGeneratorAvailable', () => {
  it('should return true', () => {
    expect(isMigrationGeneratorAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Prisma migration
// -------------------------------------------------------------------
describe('executeMigrationGenerator - prisma', () => {
  it('should generate Prisma migration with defaults', async () => {
    const result = await getResult({ operation: 'prisma' });
    expect(result.migrationName).toContain('create_users');
    expect(result.sql).toContain('CREATE TABLE');
    expect(result.sql).toContain('"users"');
    expect(result.prismaSchemaChanges).toContain('model users');
    expect(result.commands).toContain('npx prisma migrate dev --name create_users');
  });

  it('should generate Prisma migration with custom config', async () => {
    const result = await getResult({ operation: 'prisma', config: sampleConfig });
    expect(result.sql).toContain('"products"');
    expect(result.sql).toContain('DECIMAL');
    expect(result.sql).toContain('CreateIndex');
    expect(result.prismaSchemaChanges).toContain('model products');
  });

  it('should handle dropTable operation', async () => {
    const config = {
      name: 'drop_old',
      operations: [{ type: 'dropTable', table: 'old_table' }],
    };
    const result = await getResult({ operation: 'prisma', config });
    expect(result.sql).toContain('DROP TABLE');
    expect(result.sql).toContain('"old_table"');
  });

  it('should handle addColumn operation', async () => {
    const config = {
      name: 'add_email',
      operations: [{ type: 'addColumn', table: 'users', column: 'email', columnType: 'string' }],
    };
    const result = await getResult({ operation: 'prisma', config });
    expect(result.sql).toContain('ADD COLUMN');
    expect(result.sql).toContain('"email"');
  });

  it('should handle renameColumn operation', async () => {
    const config = {
      name: 'rename_col',
      operations: [
        { type: 'renameColumn', table: 'users', column: 'old_name', newName: 'new_name' },
      ],
    };
    const result = await getResult({ operation: 'prisma', config });
    expect(result.sql).toContain('RENAME COLUMN');
  });
});

// -------------------------------------------------------------------
// Knex migration
// -------------------------------------------------------------------
describe('executeMigrationGenerator - knex', () => {
  it('should generate Knex migration with defaults', async () => {
    const result = await getResult({ operation: 'knex' });
    expect(result.code).toContain('exports.up');
    expect(result.code).toContain('exports.down');
    expect(result.code).toContain('createTable');
    expect(result.commands).toContain('npx knex migrate:latest');
  });

  it('should generate Knex migration with custom config', async () => {
    const result = await getResult({ operation: 'knex', config: sampleConfig });
    expect(result.code).toContain("'products'");
    expect(result.code).toContain('decimal');
    expect(result.code).toContain('index');
    expect(result.code).toContain('dropTableIfExists');
  });
});

// -------------------------------------------------------------------
// TypeORM migration
// -------------------------------------------------------------------
describe('executeMigrationGenerator - typeorm', () => {
  it('should generate TypeORM migration with defaults', async () => {
    const result = await getResult({ operation: 'typeorm' });
    expect(result.code).toContain('implements MigrationInterface');
    expect(result.code).toContain('async up');
    expect(result.code).toContain('async down');
    expect(result.code).toContain('createTable');
    expect(result.commands).toContain('npx typeorm migration:run');
  });

  it('should generate TypeORM migration with custom config', async () => {
    const result = await getResult({ operation: 'typeorm', config: sampleConfig });
    expect(result.code).toContain("'products'");
    expect(result.code).toContain('CreateProducts');
  });
});

// -------------------------------------------------------------------
// Sequelize migration
// -------------------------------------------------------------------
describe('executeMigrationGenerator - sequelize', () => {
  it('should generate Sequelize migration with defaults', async () => {
    const result = await getResult({ operation: 'sequelize' });
    expect(result.code).toContain('module.exports');
    expect(result.code).toContain('async up');
    expect(result.code).toContain('async down');
    expect(result.code).toContain('createTable');
    expect(result.code).toContain('Sequelize.UUID');
    expect(result.commands).toContain('npx sequelize-cli db:migrate');
  });

  it('should generate Sequelize migration with custom config', async () => {
    const result = await getResult({ operation: 'sequelize', config: sampleConfig });
    expect(result.code).toContain("'products'");
    expect(result.code).toContain('Sequelize.DECIMAL');
  });
});

// -------------------------------------------------------------------
// Rollback plan
// -------------------------------------------------------------------
describe('executeMigrationGenerator - rollback_plan', () => {
  it('should generate rollback plan with defaults', async () => {
    const result = await getResult({ operation: 'rollback_plan' });
    expect(result.rollbackPlan).toBeDefined();
    expect(result.rollbackPlan.length).toBeGreaterThan(0);
    expect(result.safetyChecks).toBeDefined();
    expect(result.commands).toBeDefined();
    expect(result.commands.prisma).toContain('reset');
  });

  it('should generate rollback plan with custom migrations', async () => {
    const result = await getResult({
      operation: 'rollback_plan',
      migrations: ['migration_1', 'migration_2', 'migration_3'],
    });
    expect(result.rollbackPlan).toHaveLength(3);
    expect(result.rollbackPlan[0].migration).toBe('migration_3');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeMigrationGenerator - errors', () => {
  it('should error for unknown operation', async () => {
    const res = await executeMigrationGenerator(makeCall({ operation: 'xyz' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeMigrationGenerator({
      id: 'my-id',
      name: 'migration_generator',
      arguments: { operation: 'prisma' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
