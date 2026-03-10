import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — ALL mock data is defined inline inside the factory
// ---------------------------------------------------------------------------

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  };
});

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports (AFTER vi.mock)
// ---------------------------------------------------------------------------

import type {
  StackType,
  DatabaseType,
  AuthType,
  StylingType,
  AppDescription,
  GeneratedApp,
  AppStack,
  GeneratedFile,
  DatabaseSchema,
  TableSchema,
  Column,
  Relationship,
  Index,
  APIEndpoint,
  ComponentSpec,
  PropSpec,
  EnvVariable,
} from './index';

// Access the internal mock handle
async function getMockCreate() {
  const mod = await import('@anthropic-ai/sdk');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mod as any).__mockCreate as ReturnType<typeof vi.fn>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTextResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

function makeNonTextResponse() {
  return { content: [{ type: 'image', source: {} }] };
}

function makeArchitectureResponse(overrides?: Partial<AppStack>) {
  const stack = {
    framework: 'nextjs',
    database: 'supabase',
    auth: 'supabase-auth',
    styling: 'tailwind',
    additionalLibraries: ['zod'],
    reasoning: 'Good defaults',
    ...overrides,
  };
  return makeTextResponse(JSON.stringify(stack));
}

function makeSchemaResponse() {
  return makeTextResponse(
    JSON.stringify({
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, unique: true },
            { name: 'email', type: 'text', nullable: false, unique: true },
            { name: 'name', type: 'text', nullable: true, unique: false },
          ],
          primaryKey: 'id',
          timestamps: true,
        },
        {
          name: 'posts',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, unique: true },
            { name: 'title', type: 'text', nullable: false, unique: false },
            { name: 'user_id', type: 'uuid', nullable: false, unique: false },
          ],
          primaryKey: 'id',
          timestamps: true,
        },
      ],
      relationships: [
        {
          from: { table: 'posts', column: 'user_id' },
          to: { table: 'users', column: 'id' },
          type: 'one-to-many',
        },
      ],
      indexes: [{ table: 'users', columns: ['email'], unique: true }],
    })
  );
}

function makeEndpointsResponse() {
  return makeTextResponse(
    JSON.stringify([
      { method: 'GET', path: '/api/users', description: 'List users', auth: true, response: {} },
      {
        method: 'POST',
        path: '/api/users',
        description: 'Create user',
        auth: true,
        requestBody: {},
        response: {},
      },
      { method: 'GET', path: '/api/users/[id]', description: 'Get user', auth: true, response: {} },
    ])
  );
}

function makeComponentsResponse() {
  return makeTextResponse(
    JSON.stringify([
      { name: 'HomePage', type: 'page', props: [], description: 'Landing page' },
      {
        name: 'UserCard',
        type: 'card',
        props: [{ name: 'user', type: 'User', required: true }],
        description: 'User card',
      },
      { name: 'LoginForm', type: 'form', props: [], description: 'Login form' },
    ])
  );
}

const basicInput: AppDescription = {
  description: 'A simple todo list app',
  name: 'todo-app',
  features: ['user auth', 'task management', 'categories'],
  targetAudience: 'developers',
  monetization: 'freemium',
};

// ---------------------------------------------------------------------------
// Type export tests
// ---------------------------------------------------------------------------

describe('app-generator type exports', () => {
  it('StackType accepts all valid values', () => {
    const types: StackType[] = ['nextjs', 'react-vite', 'vue', 'svelte', 'express', 'fastapi'];
    expect(types).toHaveLength(6);
  });

  it('DatabaseType accepts all valid values', () => {
    const types: DatabaseType[] = [
      'supabase',
      'prisma-postgres',
      'prisma-mysql',
      'mongodb',
      'firebase',
    ];
    expect(types).toHaveLength(5);
  });

  it('AuthType accepts all valid values', () => {
    const types: AuthType[] = ['supabase-auth', 'nextauth', 'clerk', 'auth0', 'custom-jwt'];
    expect(types).toHaveLength(5);
  });

  it('StylingType accepts all valid values', () => {
    const types: StylingType[] = ['tailwind', 'css-modules', 'styled-components', 'chakra', 'mui'];
    expect(types).toHaveLength(5);
  });

  it('AppDescription shape is valid', () => {
    const desc: AppDescription = {
      description: 'An app',
      name: 'my-app',
      features: ['feature1'],
      targetAudience: 'users',
      monetization: 'free',
      techPreferences: {
        stack: 'nextjs',
        database: 'supabase',
        auth: 'supabase-auth',
        styling: 'tailwind',
      },
    };
    expect(desc.techPreferences?.stack).toBe('nextjs');
  });

  it('GeneratedApp shape is valid', () => {
    const app: GeneratedApp = {
      name: 'app',
      description: 'An app',
      stack: {
        framework: 'nextjs',
        database: 'supabase',
        auth: 'supabase-auth',
        styling: 'tailwind',
        additionalLibraries: [],
      },
      files: [],
      apiEndpoints: [],
      components: [],
      envVars: [],
      setupInstructions: [],
      estimatedDevelopmentTime: '1 hour',
    };
    expect(app.stack.framework).toBe('nextjs');
  });

  it('AppStack shape is valid', () => {
    const stack: AppStack = {
      framework: 'react-vite',
      database: 'mongodb',
      auth: 'auth0',
      styling: 'mui',
      additionalLibraries: ['axios'],
    };
    expect(stack.additionalLibraries).toContain('axios');
  });

  it('GeneratedFile shape is valid', () => {
    const file: GeneratedFile = {
      path: 'src/app.ts',
      content: 'export default function App() {}',
      description: 'Main app',
      type: 'component',
    };
    expect(file.type).toBe('component');
  });

  it('DatabaseSchema shape is valid', () => {
    const schema: DatabaseSchema = {
      tables: [],
      relationships: [],
      indexes: [],
    };
    expect(schema.tables).toHaveLength(0);
  });

  it('TableSchema shape is valid', () => {
    const t: TableSchema = {
      name: 'users',
      columns: [{ name: 'id', type: 'uuid', nullable: false, unique: true }],
      primaryKey: 'id',
      timestamps: true,
    };
    expect(t.timestamps).toBe(true);
  });

  it('Column shape is valid', () => {
    const c: Column = {
      name: 'user_id',
      type: 'uuid',
      nullable: false,
      unique: false,
      default: 'gen_random_uuid()',
      references: { table: 'users', column: 'id' },
    };
    expect(c.references?.table).toBe('users');
  });

  it('Relationship shape is valid', () => {
    const r: Relationship = {
      from: { table: 'posts', column: 'user_id' },
      to: { table: 'users', column: 'id' },
      type: 'one-to-many',
    };
    expect(r.type).toBe('one-to-many');
  });

  it('Index shape is valid', () => {
    const i: Index = { table: 'users', columns: ['email'], unique: true };
    expect(i.unique).toBe(true);
  });

  it('APIEndpoint shape is valid', () => {
    const ep: APIEndpoint = {
      method: 'POST',
      path: '/api/items',
      description: 'Create item',
      auth: true,
      requestBody: { name: 'string' },
      response: { id: 'string' },
    };
    expect(ep.method).toBe('POST');
  });

  it('ComponentSpec shape is valid', () => {
    const c: ComponentSpec = {
      name: 'Button',
      type: 'component',
      props: [{ name: 'label', type: 'string', required: true }],
      children: ['Icon'],
      description: 'A button',
    };
    expect(c.children).toContain('Icon');
  });

  it('PropSpec shape is valid', () => {
    const p: PropSpec = { name: 'size', type: 'number', required: false, default: '16' };
    expect(p.default).toBe('16');
  });

  it('EnvVariable shape is valid', () => {
    const e: EnvVariable = {
      name: 'API_KEY',
      description: 'API key',
      required: true,
      example: 'sk-...',
      secret: true,
    };
    expect(e.secret).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AppGenerator class
// ---------------------------------------------------------------------------

describe('AppGenerator', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  // -----------------------------------------------------------------------
  // Full generateApp flow
  // -----------------------------------------------------------------------
  describe('generateApp (full flow)', () => {
    it('generates a complete app with all sections', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        // planArchitecture
        .mockResolvedValueOnce(makeArchitectureResponse())
        // generateDatabaseSchema
        .mockResolvedValueOnce(makeSchemaResponse())
        // generateAPIEndpoints
        .mockResolvedValueOnce(makeEndpointsResponse())
        // generateComponents
        .mockResolvedValueOnce(makeComponentsResponse())
        // generateComponentFiles (for each non-page component: UserCard, LoginForm)
        .mockResolvedValue(makeTextResponse('export function Component() { return <div/>; }'));

      const result = await gen.generateApp(basicInput);

      expect(result.name).toBe('todo-app');
      expect(result.description).toBe(basicInput.description);
      expect(result.stack.framework).toBe('nextjs');
      expect(result.stack.database).toBe('supabase');
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.apiEndpoints.length).toBeGreaterThan(0);
      expect(result.envVars.length).toBeGreaterThan(0);
      expect(result.setupInstructions.length).toBeGreaterThan(0);
      expect(result.estimatedDevelopmentTime).toBeDefined();
    });

    it('generates app name from description when name not provided', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp({
        description: 'A simple todo list app',
      });

      // generateAppName takes first 3 words, lowercased, joined with hyphens
      expect(result.name).toBe('a-simple-todo');
    });
  });

  // -----------------------------------------------------------------------
  // planArchitecture
  // -----------------------------------------------------------------------
  describe('planArchitecture (via generateApp)', () => {
    it('returns default stack when API returns no JSON', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeTextResponse('No JSON here'))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      // Defaults
      expect(result.stack.framework).toBe('nextjs');
      expect(result.stack.database).toBe('supabase');
    });

    it('returns default stack on API error', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockRejectedValueOnce(new Error('API fail'))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      expect(result.stack.framework).toBe('nextjs');
    });

    it('returns default stack on non-text response', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeNonTextResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      expect(result.stack.framework).toBe('nextjs');
    });

    it('fills in missing fields from API response with defaults', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      // Partial response missing several fields
      mockCreate
        .mockResolvedValueOnce(makeTextResponse(JSON.stringify({ framework: 'vue' })))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      expect(result.stack.framework).toBe('vue');
      expect(result.stack.database).toBe('supabase'); // fallback
      expect(result.stack.auth).toBe('supabase-auth'); // fallback
    });
  });

  // -----------------------------------------------------------------------
  // generateDatabaseSchema
  // -----------------------------------------------------------------------
  describe('generateDatabaseSchema (via generateApp)', () => {
    it('returns default schema on API error', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockRejectedValueOnce(new Error('schema fail'))
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      // Default schema has a users table
      expect(result.schema?.tables).toHaveLength(1);
      expect(result.schema?.tables[0].name).toBe('users');
    });

    it('returns default schema when no JSON in response', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeTextResponse('No JSON here'))
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      expect(result.schema?.tables[0].name).toBe('users');
    });
  });

  // -----------------------------------------------------------------------
  // generateAPIEndpoints
  // -----------------------------------------------------------------------
  describe('generateAPIEndpoints (via generateApp)', () => {
    it('returns empty array on API error', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockRejectedValueOnce(new Error('endpoints fail'))
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      expect(result.apiEndpoints).toEqual([]);
    });

    it('returns empty array when no JSON array in response', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeTextResponse('No JSON array'))
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      expect(result.apiEndpoints).toEqual([]);
    });

    it('returns empty array on non-text response', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeNonTextResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      expect(result.apiEndpoints).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // generateComponents
  // -----------------------------------------------------------------------
  describe('generateComponents (via generateApp)', () => {
    it('returns empty array on API error', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockRejectedValueOnce(new Error('comp fail'))
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      // The page components still get generated (HomePage default)
      expect(result.components).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // generatePackageJson
  // -----------------------------------------------------------------------
  describe('generatePackageJson (internal)', () => {
    it('includes nextjs deps for nextjs framework', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ framework: 'nextjs' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const pkgFile = result.files.find((f) => f.path === 'package.json');
      expect(pkgFile).toBeDefined();

      const pkg = JSON.parse(pkgFile!.content);
      expect(pkg.dependencies['next']).toBeDefined();
      expect(pkg.scripts.dev).toBe('next dev');
    });

    it('includes supabase deps for supabase database', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'supabase' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const pkgFile = result.files.find((f) => f.path === 'package.json');
      const pkg = JSON.parse(pkgFile!.content);
      expect(pkg.dependencies['@supabase/supabase-js']).toBeDefined();
    });

    it('includes prisma deps for prisma-postgres database', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'prisma-postgres' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const pkgFile = result.files.find((f) => f.path === 'package.json');
      const pkg = JSON.parse(pkgFile!.content);
      expect(pkg.dependencies['@prisma/client']).toBeDefined();
      expect(pkg.devDependencies['prisma']).toBeDefined();
    });

    it('includes nextauth deps for nextauth auth', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ auth: 'nextauth' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const pkgFile = result.files.find((f) => f.path === 'package.json');
      const pkg = JSON.parse(pkgFile!.content);
      expect(pkg.dependencies['next-auth']).toBeDefined();
    });

    it('includes tailwind dev deps for tailwind styling', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ styling: 'tailwind' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const pkgFile = result.files.find((f) => f.path === 'package.json');
      const pkg = JSON.parse(pkgFile!.content);
      expect(pkg.devDependencies['tailwindcss']).toBeDefined();
      expect(pkg.devDependencies['autoprefixer']).toBeDefined();
      expect(pkg.devDependencies['postcss']).toBeDefined();
    });

    it('includes additional libraries in deps', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(
          makeArchitectureResponse({ additionalLibraries: ['zod', 'zustand'] })
        )
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const pkgFile = result.files.find((f) => f.path === 'package.json');
      const pkg = JSON.parse(pkgFile!.content);
      expect(pkg.dependencies['zod']).toBe('latest');
      expect(pkg.dependencies['zustand']).toBe('latest');
    });
  });

  // -----------------------------------------------------------------------
  // generateConfigFiles
  // -----------------------------------------------------------------------
  describe('generateConfigFiles (internal)', () => {
    it('generates tsconfig.json', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const tsconfig = result.files.find((f) => f.path === 'tsconfig.json');
      expect(tsconfig).toBeDefined();
      expect(tsconfig!.type).toBe('config');
    });

    it('generates tailwind config when styling is tailwind', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ styling: 'tailwind' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const twConfig = result.files.find((f) => f.path === 'tailwind.config.ts');
      expect(twConfig).toBeDefined();
      expect(twConfig!.content).toContain('tailwindcss');
    });

    it('generates next.config.js for nextjs framework', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ framework: 'nextjs' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const nextConfig = result.files.find((f) => f.path === 'next.config.js');
      expect(nextConfig).toBeDefined();
      expect(nextConfig!.content).toContain('nextConfig');
    });

    it('does not generate next.config for non-nextjs', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ framework: 'react-vite' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const nextConfig = result.files.find((f) => f.path === 'next.config.js');
      expect(nextConfig).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // generateSchemaFiles
  // -----------------------------------------------------------------------
  describe('generateSchemaFiles (internal)', () => {
    it('generates SQL migration for supabase', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'supabase' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const migration = result.files.find((f) => f.path.includes('supabase/migrations'));
      expect(migration).toBeDefined();
      expect(migration!.content).toContain('CREATE TABLE');
      expect(migration!.content).toContain('users');
      expect(migration!.content).toContain('PRIMARY KEY');
    });

    it('SQL migration includes timestamps, foreign keys, and indexes', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'supabase' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const migration = result.files.find((f) => f.path.includes('supabase/migrations'));
      expect(migration!.content).toContain('created_at');
      expect(migration!.content).toContain('updated_at');
      expect(migration!.content).toContain('FOREIGN KEY');
      expect(migration!.content).toContain('INDEX');
    });

    it('generates Prisma schema for prisma-postgres', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'prisma-postgres' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const prismaFile = result.files.find((f) => f.path.includes('prisma/schema.prisma'));
      expect(prismaFile).toBeDefined();
      expect(prismaFile!.content).toContain('generator client');
      expect(prismaFile!.content).toContain('postgresql');
      expect(prismaFile!.content).toContain('model');
    });

    it('generates Prisma schema for prisma-mysql with mysql provider', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'prisma-mysql' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const prismaFile = result.files.find((f) => f.path.includes('prisma/schema.prisma'));
      expect(prismaFile).toBeDefined();
      expect(prismaFile!.content).toContain('mysql');
    });
  });

  // -----------------------------------------------------------------------
  // generateAPIFiles
  // -----------------------------------------------------------------------
  describe('generateAPIFiles (internal)', () => {
    it('generates route files for nextjs framework', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ framework: 'nextjs' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const apiRoutes = result.files.filter((f) => f.type === 'api');
      expect(apiRoutes.length).toBeGreaterThan(0);
    });

    it('creates separate files for main and dynamic routes', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ framework: 'nextjs' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const mainRoute = result.files.find((f) => f.path === 'src/app/api/users/route.ts');
      const dynamicRoute = result.files.find((f) => f.path === 'src/app/api/users/[id]/route.ts');

      expect(mainRoute).toBeDefined();
      expect(dynamicRoute).toBeDefined();
    });

    it('skips API files for non-nextjs framework', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ framework: 'express' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const apiRoutes = result.files.filter((f) => f.type === 'api');
      expect(apiRoutes).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // generateRouteFile content
  // -----------------------------------------------------------------------
  describe('generateRouteFile content', () => {
    it('includes supabase client import for supabase database', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(
          makeArchitectureResponse({ database: 'supabase', framework: 'nextjs' })
        )
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const apiRoute = result.files.find((f) => f.type === 'api');
      expect(apiRoute?.content).toContain('createClient');
    });

    it('includes body parsing for POST/PUT/PATCH methods', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ framework: 'nextjs' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const apiRoute = result.files.find((f) => f.path === 'src/app/api/users/route.ts');
      expect(apiRoute?.content).toContain('request.json()');
    });
  });

  // -----------------------------------------------------------------------
  // generateComponentFiles
  // -----------------------------------------------------------------------
  describe('generateComponentFiles (internal)', () => {
    it('generates component files for non-page components', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function UserCard() { return <div/>; }'));

      const result = await gen.generateApp(basicInput);

      const compFiles = result.files.filter((f) => f.type === 'component');
      expect(compFiles.length).toBeGreaterThan(0);
    });

    it('falls back to basic component on API error', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      let callCount = 0;
      mockCreate.mockImplementation(() => {
        callCount++;
        // Calls 1-4: architecture, schema, endpoints, components
        if (callCount === 1) return Promise.resolve(makeArchitectureResponse());
        if (callCount === 2) return Promise.resolve(makeSchemaResponse());
        if (callCount === 3) return Promise.resolve(makeEndpointsResponse());
        if (callCount === 4) return Promise.resolve(makeComponentsResponse());
        // Component generation calls fail
        return Promise.reject(new Error('comp gen fail'));
      });

      const result = await gen.generateApp(basicInput);

      // Should still have component files (fallback basic components)
      const compFiles = result.files.filter((f) => f.type === 'component');
      expect(compFiles.length).toBeGreaterThan(0);
      // Fallback basic components have 'use client'
      for (const cf of compFiles) {
        expect(cf.content).toContain("'use client'");
      }
    });
  });

  // -----------------------------------------------------------------------
  // generateBasicComponent
  // -----------------------------------------------------------------------
  describe('generateBasicComponent (internal)', () => {
    it('generates component with props interface when props exist', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      let callCount = 0;
      mockCreate.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(makeArchitectureResponse());
        if (callCount === 2) return Promise.resolve(makeSchemaResponse());
        if (callCount === 3) return Promise.resolve(makeEndpointsResponse());
        if (callCount === 4) {
          return Promise.resolve(
            makeTextResponse(
              JSON.stringify([
                {
                  name: 'UserCard',
                  type: 'card',
                  props: [{ name: 'user', type: 'User', required: true }],
                  description: 'Shows user info',
                },
              ])
            )
          );
        }
        return Promise.reject(new Error('force fallback'));
      });

      const result = await gen.generateApp(basicInput);

      const userCard = result.files.find((f) => f.path.includes('UserCard'));
      expect(userCard).toBeDefined();
      expect(userCard!.content).toContain('UserCardProps');
      expect(userCard!.content).toContain('user');
    });
  });

  // -----------------------------------------------------------------------
  // generatePageFiles
  // -----------------------------------------------------------------------
  describe('generatePageFiles (internal)', () => {
    it('always generates a home page', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      // Return components with no page type
      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(
          makeTextResponse(
            JSON.stringify([{ name: 'Card', type: 'card', props: [], description: 'A card' }])
          )
        )
        .mockResolvedValue(makeTextResponse('export default function Page() {}'));

      const result = await gen.generateApp(basicInput);

      const homePage = result.files.find(
        (f) => f.type === 'page' && f.path.includes('page.tsx') && !f.path.includes('auth')
      );
      expect(homePage).toBeDefined();
    });

    it('skips page generation for non-nextjs framework', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ framework: 'express' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const pageFiles = result.files.filter((f) => f.type === 'page' && f.path.includes('app/'));
      // Non-nextjs should not generate Next.js page files
      expect(
        pageFiles.filter(
          (f) =>
            !f.path.includes('layout') && !f.path.includes('globals') && !f.path.includes('auth')
        )
      ).toHaveLength(0);
    });

    it('falls back to basic page on API error', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      let callCount = 0;
      mockCreate.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(makeArchitectureResponse());
        if (callCount === 2) return Promise.resolve(makeSchemaResponse());
        if (callCount === 3) return Promise.resolve(makeEndpointsResponse());
        if (callCount === 4) return Promise.resolve(makeComponentsResponse());
        // All subsequent calls (component + page generation) fail
        return Promise.reject(new Error('page fail'));
      });

      const result = await gen.generateApp(basicInput);

      // Pages should still exist via fallback
      const pageFiles = result.files.filter((f) => f.type === 'page');
      expect(pageFiles.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // generateUtilityFiles
  // -----------------------------------------------------------------------
  describe('generateUtilityFiles (internal)', () => {
    it('generates supabase client/server utils for supabase', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'supabase' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const clientUtil = result.files.find((f) => f.path === 'src/lib/supabase/client.ts');
      const serverUtil = result.files.find((f) => f.path === 'src/lib/supabase/server.ts');

      expect(clientUtil).toBeDefined();
      expect(serverUtil).toBeDefined();
      expect(clientUtil!.content).toContain('createBrowserClient');
      expect(serverUtil!.content).toContain('createServerClient');
    });

    it('always generates utils.ts', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const utils = result.files.find((f) => f.path === 'src/lib/utils.ts');
      expect(utils).toBeDefined();
      expect(utils!.content).toContain('cn');
      expect(utils!.content).toContain('formatDate');
    });
  });

  // -----------------------------------------------------------------------
  // generateLayoutFiles
  // -----------------------------------------------------------------------
  describe('generateLayoutFiles (internal)', () => {
    it('generates layout.tsx and globals.css for nextjs', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ framework: 'nextjs' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const layout = result.files.find((f) => f.path === 'src/app/layout.tsx');
      const globals = result.files.find((f) => f.path === 'src/app/globals.css');

      expect(layout).toBeDefined();
      expect(layout!.content).toContain('RootLayout');
      expect(globals).toBeDefined();
      expect(globals!.content).toContain('@tailwind');
    });

    it('skips layout files for non-nextjs framework', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ framework: 'express' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const layout = result.files.find((f) => f.path === 'src/app/layout.tsx');
      expect(layout).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // generateAuthFiles
  // -----------------------------------------------------------------------
  describe('generateAuthFiles (internal)', () => {
    it('generates login page for supabase-auth', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ auth: 'supabase-auth' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const loginPage = result.files.find((f) => f.path === 'src/app/auth/login/page.tsx');
      expect(loginPage).toBeDefined();
      expect(loginPage!.content).toContain('signInWithPassword');
      expect(loginPage!.content).toContain('LoginPage');
    });

    it('does not generate login page for non-supabase auth', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ auth: 'nextauth' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const loginPage = result.files.find((f) => f.path === 'src/app/auth/login/page.tsx');
      expect(loginPage).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // generateEnvVars
  // -----------------------------------------------------------------------
  describe('generateEnvVars (internal)', () => {
    it('generates supabase env vars for supabase database', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'supabase' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const varNames = result.envVars.map((v) => v.name);
      expect(varNames).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(varNames).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(varNames).toContain('SUPABASE_SERVICE_ROLE_KEY');

      const serviceKey = result.envVars.find((v) => v.name === 'SUPABASE_SERVICE_ROLE_KEY');
      expect(serviceKey!.secret).toBe(true);
    });

    it('generates DATABASE_URL for prisma databases', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'prisma-postgres' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const dbUrl = result.envVars.find((v) => v.name === 'DATABASE_URL');
      expect(dbUrl).toBeDefined();
      expect(dbUrl!.secret).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // generateSetupInstructions
  // -----------------------------------------------------------------------
  describe('generateSetupInstructions (internal)', () => {
    it('includes supabase setup steps for supabase', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'supabase' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      expect(result.setupInstructions.join(' ')).toContain('npm install');
      expect(result.setupInstructions.join(' ')).toContain('Supabase');
      expect(result.setupInstructions.join(' ')).toContain('migration');
    });

    it('includes prisma setup steps for prisma', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'prisma-postgres' }))
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      expect(result.setupInstructions.join(' ')).toContain('prisma migrate');
      expect(result.setupInstructions.join(' ')).toContain('prisma generate');
    });

    it('always ends with dev server start instruction', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const lastInstruction = result.setupInstructions[result.setupInstructions.length - 1];
      expect(lastInstruction).toContain('npm run dev');
    });
  });

  // -----------------------------------------------------------------------
  // Helper methods
  // -----------------------------------------------------------------------
  describe('helper methods', () => {
    it('generateAppName creates slug from description', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp({
        description: 'My Cool Application',
      });

      expect(result.name).toBe('my-cool-application');
    });

    it('estimateDevelopmentTime returns correct ranges', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      // With default mocks, we get a small number of files
      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse())
        .mockResolvedValueOnce(makeSchemaResponse())
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      // The time string should be one of the predefined ranges
      expect(['1-2 hours', '4-8 hours', '1-2 days', '3-5 days']).toContain(
        result.estimatedDevelopmentTime
      );
    });

    it('mapToPostgresType maps known types', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      // Create a schema with various types to verify mapping
      const schemaWithTypes = makeTextResponse(
        JSON.stringify({
          tables: [
            {
              name: 'test',
              columns: [
                { name: 'id', type: 'uuid', nullable: false, unique: true },
                { name: 'count', type: 'integer', nullable: false, unique: false },
                { name: 'active', type: 'boolean', nullable: false, unique: false },
                { name: 'data', type: 'json', nullable: true, unique: false },
                { name: 'score', type: 'float', nullable: true, unique: false },
                { name: 'unknown_type', type: 'foobar', nullable: true, unique: false },
              ],
              primaryKey: 'id',
              timestamps: true,
            },
          ],
          relationships: [],
          indexes: [],
        })
      );

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'supabase' }))
        .mockResolvedValueOnce(schemaWithTypes)
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const migration = result.files.find((f) => f.path.includes('migrations'));
      expect(migration!.content).toContain('UUID');
      expect(migration!.content).toContain('INTEGER');
      expect(migration!.content).toContain('BOOLEAN');
      expect(migration!.content).toContain('JSONB');
      expect(migration!.content).toContain('REAL');
      // Unknown type falls back to TEXT
      expect(migration!.content).toContain('TEXT');
    });

    it('mapToPrismaType maps known types', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      const schemaWithTypes = makeTextResponse(
        JSON.stringify({
          tables: [
            {
              name: 'test',
              columns: [
                { name: 'id', type: 'uuid', nullable: false, unique: true },
                { name: 'count', type: 'int', nullable: false, unique: false },
                { name: 'active', type: 'boolean', nullable: false, unique: false },
                { name: 'price', type: 'decimal', nullable: true, unique: false },
                { name: 'unknown', type: 'xyz', nullable: true, unique: false },
              ],
              primaryKey: 'id',
              timestamps: true,
            },
          ],
          relationships: [],
          indexes: [],
        })
      );

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'prisma-postgres' }))
        .mockResolvedValueOnce(schemaWithTypes)
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const prismaFile = result.files.find((f) => f.path.includes('schema.prisma'));
      expect(prismaFile!.content).toContain('String');
      expect(prismaFile!.content).toContain('Int');
      expect(prismaFile!.content).toContain('Boolean');
      expect(prismaFile!.content).toContain('Decimal');
    });

    it('toPascalCase converts snake_case to PascalCase', async () => {
      const { AppGenerator } = await import('./index');
      const gen = new AppGenerator();

      mockCreate
        .mockResolvedValueOnce(makeArchitectureResponse({ database: 'prisma-postgres' }))
        .mockResolvedValueOnce(
          makeTextResponse(
            JSON.stringify({
              tables: [
                {
                  name: 'user_profiles',
                  columns: [{ name: 'id', type: 'uuid', nullable: false, unique: true }],
                  primaryKey: 'id',
                  timestamps: false,
                },
              ],
              relationships: [],
              indexes: [],
            })
          )
        )
        .mockResolvedValueOnce(makeEndpointsResponse())
        .mockResolvedValueOnce(makeComponentsResponse())
        .mockResolvedValue(makeTextResponse('export function X() {}'));

      const result = await gen.generateApp(basicInput);

      const prismaFile = result.files.find((f) => f.path.includes('schema.prisma'));
      expect(prismaFile!.content).toContain('model UserProfiles');
    });
  });
});

// ---------------------------------------------------------------------------
// Exported singleton and helper functions
// ---------------------------------------------------------------------------

describe('appGenerator singleton', () => {
  it('exports a singleton instance', async () => {
    const { appGenerator, AppGenerator } = await import('./index');
    expect(appGenerator).toBeInstanceOf(AppGenerator);
  });
});

describe('generateApp helper', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  it('delegates to appGenerator.generateApp with merged options', async () => {
    const { generateApp } = await import('./index');

    mockCreate
      .mockResolvedValueOnce(makeArchitectureResponse())
      .mockResolvedValueOnce(makeSchemaResponse())
      .mockResolvedValueOnce(makeEndpointsResponse())
      .mockResolvedValueOnce(makeComponentsResponse())
      .mockResolvedValue(makeTextResponse('export function X() {}'));

    const result = await generateApp('A simple blog', { name: 'my-blog' });

    expect(result.name).toBe('my-blog');
    expect(result.description).toBe('A simple blog');
  });

  it('works with just a description', async () => {
    const { generateApp } = await import('./index');

    mockCreate
      .mockResolvedValueOnce(makeArchitectureResponse())
      .mockResolvedValueOnce(makeSchemaResponse())
      .mockResolvedValueOnce(makeEndpointsResponse())
      .mockResolvedValueOnce(makeComponentsResponse())
      .mockResolvedValue(makeTextResponse('export function X() {}'));

    const result = await generateApp('E-commerce platform');

    expect(result.description).toBe('E-commerce platform');
    expect(result.name).toBeDefined();
  });
});

describe('generateAppFiles helper', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  it('returns simplified file list with path and content only', async () => {
    const { generateAppFiles } = await import('./index');

    mockCreate
      .mockResolvedValueOnce(makeArchitectureResponse())
      .mockResolvedValueOnce(makeSchemaResponse())
      .mockResolvedValueOnce(makeEndpointsResponse())
      .mockResolvedValueOnce(makeComponentsResponse())
      .mockResolvedValue(makeTextResponse('export function X() {}'));

    const files = await generateAppFiles('A todo app');

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file).toHaveProperty('path');
      expect(file).toHaveProperty('content');
      // Should NOT have description or type (simplified format)
      expect(Object.keys(file)).toEqual(['path', 'content']);
    }
  });
});
