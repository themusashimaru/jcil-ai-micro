/**
 * NATURAL LANGUAGE TO FULL-STACK APP GENERATOR
 *
 * Describe an app in plain English, get a complete working application.
 *
 * Features:
 * - Generate complete Next.js/React applications
 * - Database schema design
 * - API endpoint generation
 * - Authentication setup
 * - UI component generation
 * - State management
 * - Deployment configuration
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('AppGenerator');

// ============================================
// TYPES
// ============================================

export type StackType = 'nextjs' | 'react-vite' | 'vue' | 'svelte' | 'express' | 'fastapi';
export type DatabaseType = 'supabase' | 'prisma-postgres' | 'prisma-mysql' | 'mongodb' | 'firebase';
export type AuthType = 'supabase-auth' | 'nextauth' | 'clerk' | 'auth0' | 'custom-jwt';
export type StylingType = 'tailwind' | 'css-modules' | 'styled-components' | 'chakra' | 'mui';

export interface AppDescription {
  description: string;
  name?: string;
  features?: string[];
  targetAudience?: string;
  monetization?: string;
  techPreferences?: {
    stack?: StackType;
    database?: DatabaseType;
    auth?: AuthType;
    styling?: StylingType;
  };
}

export interface GeneratedApp {
  name: string;
  description: string;
  stack: AppStack;
  files: GeneratedFile[];
  schema?: DatabaseSchema;
  apiEndpoints: APIEndpoint[];
  components: ComponentSpec[];
  envVars: EnvVariable[];
  setupInstructions: string[];
  estimatedDevelopmentTime: string;
}

export interface AppStack {
  framework: StackType;
  database: DatabaseType;
  auth: AuthType;
  styling: StylingType;
  additionalLibraries: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  description: string;
  type: 'component' | 'api' | 'config' | 'schema' | 'style' | 'util' | 'page';
}

export interface DatabaseSchema {
  tables: TableSchema[];
  relationships: Relationship[];
  indexes: Index[];
}

export interface TableSchema {
  name: string;
  columns: Column[];
  primaryKey: string;
  timestamps: boolean;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  unique: boolean;
  default?: string;
  references?: { table: string; column: string };
}

export interface Relationship {
  from: { table: string; column: string };
  to: { table: string; column: string };
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface Index {
  table: string;
  columns: string[];
  unique: boolean;
}

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth: boolean;
  requestBody?: object;
  response: object;
}

export interface ComponentSpec {
  name: string;
  type: 'page' | 'layout' | 'component' | 'form' | 'list' | 'card' | 'modal';
  props: PropSpec[];
  children?: string[];
  description: string;
}

export interface PropSpec {
  name: string;
  type: string;
  required: boolean;
  default?: string;
}

export interface EnvVariable {
  name: string;
  description: string;
  required: boolean;
  example: string;
  secret: boolean;
}

// ============================================
// APP GENERATOR CLASS
// ============================================

export class AppGenerator {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Generate a complete application from natural language description
   */
  async generateApp(input: AppDescription): Promise<GeneratedApp> {
    log.info('Starting app generation', { descriptionPreview: input.description.substring(0, 50) });

    // Step 1: Analyze requirements and plan architecture
    const architecture = await this.planArchitecture(input);

    // Step 2: Generate database schema
    const schema = await this.generateDatabaseSchema(input, architecture);

    // Step 3: Generate API endpoints
    const apiEndpoints = await this.generateAPIEndpoints(input, schema);

    // Step 4: Generate components
    const components = await this.generateComponents(input, architecture);

    // Step 5: Generate all files
    const files = await this.generateAllFiles(
      input,
      architecture,
      schema,
      apiEndpoints,
      components
    );

    // Step 6: Generate environment variables
    const envVars = this.generateEnvVars(architecture);

    // Step 7: Generate setup instructions
    const setupInstructions = this.generateSetupInstructions(architecture);

    return {
      name: input.name || this.generateAppName(input.description),
      description: input.description,
      stack: architecture,
      files,
      schema,
      apiEndpoints,
      components,
      envVars,
      setupInstructions,
      estimatedDevelopmentTime: this.estimateDevelopmentTime(files.length),
    };
  }

  /**
   * Plan the application architecture
   */
  private async planArchitecture(input: AppDescription): Promise<AppStack> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: `You are a senior software architect. Analyze the app requirements and recommend the best tech stack.

Consider:
- Scalability requirements
- Development speed
- Team expertise (assume solo developer)
- Cost (prefer free tiers)
- Time to market

Return JSON:
{
  "framework": "nextjs" | "react-vite" | "vue" | "svelte" | "express" | "fastapi",
  "database": "supabase" | "prisma-postgres" | "prisma-mysql" | "mongodb" | "firebase",
  "auth": "supabase-auth" | "nextauth" | "clerk" | "auth0" | "custom-jwt",
  "styling": "tailwind" | "css-modules" | "styled-components" | "chakra" | "mui",
  "additionalLibraries": ["lib1", "lib2"],
  "reasoning": "brief explanation"
}`,
        messages: [
          {
            role: 'user',
            content: `Plan architecture for: "${input.description}"

Features: ${input.features?.join(', ') || 'Not specified'}
Target audience: ${input.targetAudience || 'General'}
Monetization: ${input.monetization || 'None'}

Tech preferences: ${JSON.stringify(input.techPreferences || {})}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Return defaults
        return this.getDefaultStack();
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        framework: parsed.framework || 'nextjs',
        database: parsed.database || 'supabase',
        auth: parsed.auth || 'supabase-auth',
        styling: parsed.styling || 'tailwind',
        additionalLibraries: parsed.additionalLibraries || [],
      };
    } catch (error) {
      log.error('Architecture planning error', error as Error);
      return this.getDefaultStack();
    }
  }

  /**
   * Generate database schema
   */
  private async generateDatabaseSchema(
    input: AppDescription,
    _stack: AppStack
  ): Promise<DatabaseSchema> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: `You are a database architect. Design a complete database schema.

Rules:
1. Use snake_case for table and column names
2. Include created_at and updated_at timestamps
3. Use UUID for primary keys
4. Define proper foreign key relationships
5. Include indexes for commonly queried columns
6. Consider data normalization

Return JSON:
{
  "tables": [
    {
      "name": "users",
      "columns": [
        {"name": "id", "type": "uuid", "nullable": false, "unique": true},
        {"name": "email", "type": "text", "nullable": false, "unique": true}
      ],
      "primaryKey": "id",
      "timestamps": true
    }
  ],
  "relationships": [
    {
      "from": {"table": "posts", "column": "user_id"},
      "to": {"table": "users", "column": "id"},
      "type": "one-to-many"
    }
  ],
  "indexes": [
    {"table": "users", "columns": ["email"], "unique": true}
  ]
}`,
        messages: [
          {
            role: 'user',
            content: `Design database schema for: "${input.description}"

Features: ${input.features?.join(', ') || 'Standard features'}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getDefaultSchema();
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      log.error('Schema generation error', error as Error);
      return this.getDefaultSchema();
    }
  }

  /**
   * Generate API endpoints
   */
  private async generateAPIEndpoints(
    input: AppDescription,
    schema: DatabaseSchema
  ): Promise<APIEndpoint[]> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: `You are an API designer. Design RESTful API endpoints.

Rules:
1. Follow REST conventions
2. Use plural nouns for resources
3. Include proper HTTP methods
4. Specify authentication requirements
5. Define request/response shapes

Return JSON array:
[
  {
    "method": "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    "path": "/api/resource",
    "description": "What this endpoint does",
    "auth": true/false,
    "requestBody": {...} (if applicable),
    "response": {...}
  }
]`,
        messages: [
          {
            role: 'user',
            content: `Design API endpoints for: "${input.description}"

Database schema:
${JSON.stringify(
  schema.tables.map((t) => t.name),
  null,
  2
)}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return [];
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      log.error('API generation error', error as Error);
      return [];
    }
  }

  /**
   * Generate component specifications
   */
  private async generateComponents(
    input: AppDescription,
    _stack: AppStack
  ): Promise<ComponentSpec[]> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: `You are a UI/UX designer. Design the component hierarchy for a web application.

Include:
1. Page components (routes)
2. Layout components
3. Reusable UI components
4. Form components
5. List/Table components

Return JSON array:
[
  {
    "name": "ComponentName",
    "type": "page" | "layout" | "component" | "form" | "list" | "card" | "modal",
    "props": [{"name": "propName", "type": "string", "required": true}],
    "children": ["ChildComponent"],
    "description": "What this component does"
  }
]`,
        messages: [
          {
            role: 'user',
            content: `Design components for: "${input.description}"

Features: ${input.features?.join(', ') || 'Standard features'}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return [];
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      log.error('Component generation error', error as Error);
      return [];
    }
  }

  /**
   * Generate all application files
   */
  private async generateAllFiles(
    input: AppDescription,
    stack: AppStack,
    schema: DatabaseSchema,
    endpoints: APIEndpoint[],
    components: ComponentSpec[]
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // 1. Package.json
    files.push(await this.generatePackageJson(input, stack));

    // 2. Configuration files
    files.push(...this.generateConfigFiles(stack));

    // 3. Database schema files
    files.push(...(await this.generateSchemaFiles(schema, stack)));

    // 4. API route files
    files.push(...(await this.generateAPIFiles(endpoints, stack)));

    // 5. Component files
    files.push(...(await this.generateComponentFiles(components, stack)));

    // 6. Page files
    files.push(...(await this.generatePageFiles(input, components, stack)));

    // 7. Utility files
    files.push(...this.generateUtilityFiles(stack));

    // 8. Layout files
    files.push(...(await this.generateLayoutFiles(stack)));

    // 9. Auth files
    files.push(...(await this.generateAuthFiles(stack)));

    return files;
  }

  /**
   * Generate package.json
   */
  private async generatePackageJson(
    input: AppDescription,
    stack: AppStack
  ): Promise<GeneratedFile> {
    const deps: Record<string, string> = {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    };

    const devDeps: Record<string, string> = {
      typescript: '^5.0.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
    };

    // Framework-specific deps
    if (stack.framework === 'nextjs') {
      deps['next'] = '^14.0.0';
    }

    // Database deps
    if (stack.database === 'supabase') {
      deps['@supabase/supabase-js'] = '^2.0.0';
    } else if (stack.database.startsWith('prisma')) {
      deps['@prisma/client'] = '^5.0.0';
      devDeps['prisma'] = '^5.0.0';
    }

    // Auth deps
    if (stack.auth === 'nextauth') {
      deps['next-auth'] = '^4.24.0';
    }

    // Styling deps
    if (stack.styling === 'tailwind') {
      devDeps['tailwindcss'] = '^3.3.0';
      devDeps['autoprefixer'] = '^10.4.0';
      devDeps['postcss'] = '^8.4.0';
    }

    // Additional libraries
    for (const lib of stack.additionalLibraries) {
      deps[lib] = 'latest';
    }

    const packageJson = {
      name: input.name || this.generateAppName(input.description),
      version: '0.1.0',
      private: true,
      scripts: {
        dev: stack.framework === 'nextjs' ? 'next dev' : 'vite',
        build: stack.framework === 'nextjs' ? 'next build' : 'vite build',
        start: stack.framework === 'nextjs' ? 'next start' : 'vite preview',
        lint: 'eslint . --ext .ts,.tsx',
      },
      dependencies: deps,
      devDependencies: devDeps,
    };

    return {
      path: 'package.json',
      content: JSON.stringify(packageJson, null, 2),
      description: 'Project configuration and dependencies',
      type: 'config',
    };
  }

  /**
   * Generate configuration files
   */
  private generateConfigFiles(stack: AppStack): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    // tsconfig.json
    files.push({
      path: 'tsconfig.json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./src/*'] },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules'],
        },
        null,
        2
      ),
      description: 'TypeScript configuration',
      type: 'config',
    });

    // Tailwind config
    if (stack.styling === 'tailwind') {
      files.push({
        path: 'tailwind.config.ts',
        content: `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
      },
    },
  },
  plugins: [],
};

export default config;`,
        description: 'Tailwind CSS configuration',
        type: 'config',
      });
    }

    // Next.js config
    if (stack.framework === 'nextjs') {
      files.push({
        path: 'next.config.js',
        content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;`,
        description: 'Next.js configuration',
        type: 'config',
      });
    }

    return files;
  }

  /**
   * Generate database schema files
   */
  private async generateSchemaFiles(
    schema: DatabaseSchema,
    stack: AppStack
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    if (stack.database === 'supabase') {
      // Generate Supabase SQL migration
      let sql = '-- Supabase Migration\n\n';

      for (const table of schema.tables) {
        sql += `CREATE TABLE IF NOT EXISTS ${table.name} (\n`;

        const columnDefs = table.columns.map((col) => {
          let def = `  ${col.name} ${this.mapToPostgresType(col.type)}`;
          if (!col.nullable) def += ' NOT NULL';
          if (col.unique) def += ' UNIQUE';
          if (col.default) def += ` DEFAULT ${col.default}`;
          return def;
        });

        if (table.timestamps) {
          columnDefs.push('  created_at TIMESTAMPTZ DEFAULT NOW()');
          columnDefs.push('  updated_at TIMESTAMPTZ DEFAULT NOW()');
        }

        columnDefs.push(`  PRIMARY KEY (${table.primaryKey})`);

        sql += columnDefs.join(',\n');
        sql += '\n);\n\n';
      }

      // Add foreign keys
      for (const rel of schema.relationships) {
        sql += `ALTER TABLE ${rel.from.table} ADD CONSTRAINT fk_${rel.from.table}_${rel.from.column}\n`;
        sql += `  FOREIGN KEY (${rel.from.column}) REFERENCES ${rel.to.table}(${rel.to.column});\n\n`;
      }

      // Add indexes
      for (const idx of schema.indexes) {
        sql += `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX idx_${idx.table}_${idx.columns.join('_')}\n`;
        sql += `  ON ${idx.table}(${idx.columns.join(', ')});\n\n`;
      }

      files.push({
        path: 'supabase/migrations/001_initial.sql',
        content: sql,
        description: 'Initial database migration',
        type: 'schema',
      });
    } else if (stack.database.startsWith('prisma')) {
      // Generate Prisma schema
      let prisma = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${stack.database === 'prisma-postgres' ? 'postgresql' : 'mysql'}"
  url      = env("DATABASE_URL")
}

`;

      for (const table of schema.tables) {
        const modelName = this.toPascalCase(table.name);
        prisma += `model ${modelName} {\n`;

        for (const col of table.columns) {
          let line = `  ${col.name} ${this.mapToPrismaType(col.type)}`;
          if (col.name === table.primaryKey) line += ' @id @default(uuid())';
          if (!col.nullable)
            line = line; // Required by default in Prisma
          else line += '?';
          if (col.unique && col.name !== table.primaryKey) line += ' @unique';
          if (col.default) line += ` @default(${col.default})`;
          prisma += line + '\n';
        }

        if (table.timestamps) {
          prisma += '  createdAt DateTime @default(now()) @map("created_at")\n';
          prisma += '  updatedAt DateTime @updatedAt @map("updated_at")\n';
        }

        prisma += `\n  @@map("${table.name}")\n`;
        prisma += '}\n\n';
      }

      files.push({
        path: 'prisma/schema.prisma',
        content: prisma,
        description: 'Prisma database schema',
        type: 'schema',
      });
    }

    return files;
  }

  /**
   * Generate API route files
   */
  private async generateAPIFiles(
    endpoints: APIEndpoint[],
    stack: AppStack
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    if (stack.framework !== 'nextjs') return files;

    // Group endpoints by resource
    const byResource = new Map<string, APIEndpoint[]>();
    for (const ep of endpoints) {
      const resource = ep.path.split('/')[2] || 'root';
      if (!byResource.has(resource)) byResource.set(resource, []);
      byResource.get(resource)!.push(ep);
    }

    for (const [resource, eps] of byResource) {
      // Generate main route
      const mainEps = eps.filter((e) => !e.path.includes('['));
      if (mainEps.length > 0) {
        files.push({
          path: `src/app/api/${resource}/route.ts`,
          content: this.generateRouteFile(mainEps, stack),
          description: `API routes for ${resource}`,
          type: 'api',
        });
      }

      // Generate dynamic route
      const dynamicEps = eps.filter((e) => e.path.includes('['));
      if (dynamicEps.length > 0) {
        files.push({
          path: `src/app/api/${resource}/[id]/route.ts`,
          content: this.generateRouteFile(dynamicEps, stack),
          description: `Dynamic API routes for ${resource}`,
          type: 'api',
        });
      }
    }

    return files;
  }

  /**
   * Generate a Next.js route file
   */
  private generateRouteFile(endpoints: APIEndpoint[], stack: AppStack): string {
    let code = `import { NextRequest, NextResponse } from 'next/server';
`;

    if (stack.database === 'supabase') {
      code += `import { createClient } from '@/lib/supabase/server';\n`;
    }

    code += '\n';

    for (const ep of endpoints) {
      code += `export async function ${ep.method}(request: NextRequest) {
  try {
${stack.database === 'supabase' ? '    const supabase = createClient();\n' : ''}
${ep.auth ? `    // TODO: Verify authentication\n` : ''}
${ep.method === 'POST' || ep.method === 'PUT' || ep.method === 'PATCH' ? `    const body = await request.json();\n` : ''}
    // TODO: Implement ${ep.description}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] ${ep.method} ${ep.path} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

`;
    }

    return code;
  }

  /**
   * Generate component files
   */
  private async generateComponentFiles(
    components: ComponentSpec[],
    stack: AppStack
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    for (const comp of components) {
      if (comp.type === 'page') continue; // Handle pages separately

      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: `You are a React/TypeScript expert. Generate a complete, production-ready component.

Requirements:
- Use TypeScript with proper types
- Use ${stack.styling === 'tailwind' ? 'Tailwind CSS' : stack.styling} for styling
- Include proper props interface
- Add accessibility attributes
- Include loading and error states where appropriate

Return ONLY the code, no explanations.`,
          messages: [
            {
              role: 'user',
              content: `Generate component: ${comp.name}

Type: ${comp.type}
Description: ${comp.description}
Props: ${JSON.stringify(comp.props)}`,
            },
          ],
        });

        const content = response.content[0];
        if (content.type === 'text') {
          const code = content.text.replace(/```\w*\n?/g, '').trim();

          files.push({
            path: `src/components/${comp.name}.tsx`,
            content: code,
            description: comp.description,
            type: 'component',
          });
        }
      } catch {
        // Generate basic component
        files.push({
          path: `src/components/${comp.name}.tsx`,
          content: this.generateBasicComponent(comp, stack),
          description: comp.description,
          type: 'component',
        });
      }
    }

    return files;
  }

  /**
   * Generate basic component fallback
   */
  private generateBasicComponent(comp: ComponentSpec, stack: AppStack): string {
    const propsInterface =
      comp.props.length > 0
        ? `interface ${comp.name}Props {\n${comp.props.map((p) => `  ${p.name}${p.required ? '' : '?'}: ${p.type};`).join('\n')}\n}\n\n`
        : '';

    const propsArg =
      comp.props.length > 0
        ? `{ ${comp.props.map((p) => p.name).join(', ')} }: ${comp.name}Props`
        : '';

    return `'use client';

import React from 'react';

${propsInterface}export function ${comp.name}(${propsArg}) {
  return (
    <div className="${stack.styling === 'tailwind' ? 'p-4' : ''}">
      <h2>${comp.name}</h2>
      {/* TODO: Implement ${comp.description} */}
    </div>
  );
}
`;
  }

  /**
   * Generate page files
   */
  private async generatePageFiles(
    input: AppDescription,
    components: ComponentSpec[],
    stack: AppStack
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    if (stack.framework !== 'nextjs') return files;

    const pages = components.filter((c) => c.type === 'page');

    // Always generate home page
    if (!pages.find((p) => p.name.toLowerCase().includes('home'))) {
      pages.unshift({
        name: 'HomePage',
        type: 'page',
        props: [],
        description: 'Landing page',
      });
    }

    for (const page of pages) {
      const pagePath = page.name.toLowerCase().replace('page', '').replace('home', '');

      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: `You are a React/Next.js expert. Generate a complete page component.

App: ${input.description}

Requirements:
- Use TypeScript
- Use ${stack.styling === 'tailwind' ? 'Tailwind CSS' : stack.styling}
- Include metadata export for SEO
- Make it visually appealing
- Include proper semantic HTML

Return ONLY the code.`,
          messages: [
            {
              role: 'user',
              content: `Generate page: ${page.name}
Description: ${page.description}`,
            },
          ],
        });

        const content = response.content[0];
        if (content.type === 'text') {
          const code = content.text.replace(/```\w*\n?/g, '').trim();

          files.push({
            path: `src/app/${pagePath || ''}page.tsx`,
            content: code,
            description: page.description,
            type: 'page',
          });
        }
      } catch {
        files.push({
          path: `src/app/${pagePath || ''}page.tsx`,
          content: this.generateBasicPage(page, stack),
          description: page.description,
          type: 'page',
        });
      }
    }

    return files;
  }

  /**
   * Generate basic page fallback
   */
  private generateBasicPage(page: ComponentSpec, stack: AppStack): string {
    return `import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '${page.name.replace('Page', '')}',
  description: '${page.description}',
};

export default function ${page.name}() {
  return (
    <main className="${stack.styling === 'tailwind' ? 'min-h-screen p-8' : ''}">
      <h1 className="${stack.styling === 'tailwind' ? 'text-4xl font-bold mb-8' : ''}">
        ${page.name.replace('Page', '')}
      </h1>
      {/* TODO: Implement ${page.description} */}
    </main>
  );
}
`;
  }

  /**
   * Generate utility files
   */
  private generateUtilityFiles(stack: AppStack): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    // Supabase client
    if (stack.database === 'supabase') {
      files.push({
        path: 'src/lib/supabase/client.ts',
        content: `import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}`,
        description: 'Supabase browser client',
        type: 'util',
      });

      files.push({
        path: 'src/lib/supabase/server.ts',
        content: `import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}`,
        description: 'Supabase server client',
        type: 'util',
      });
    }

    // Utils
    files.push({
      path: 'src/lib/utils.ts',
      content: `import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(new Date(date));
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}`,
      description: 'Utility functions',
      type: 'util',
    });

    return files;
  }

  /**
   * Generate layout files
   */
  private async generateLayoutFiles(stack: AppStack): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    if (stack.framework !== 'nextjs') return files;

    files.push({
      path: 'src/app/layout.tsx',
      content: `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'App',
  description: 'Generated with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}`,
      description: 'Root layout',
      type: 'page',
    });

    files.push({
      path: 'src/app/globals.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-rgb: 0, 0, 0;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: rgb(var(--background-rgb));
}`,
      description: 'Global styles',
      type: 'style',
    });

    return files;
  }

  /**
   * Generate auth files
   */
  private async generateAuthFiles(stack: AppStack): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    if (stack.auth === 'supabase-auth') {
      files.push({
        path: 'src/app/auth/login/page.tsx',
        content: `'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push('/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleLogin} className="w-full max-w-md p-8 space-y-4">
        <h1 className="text-2xl font-bold text-center">Login</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 border rounded"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 border rounded"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full p-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Login'}
        </button>
      </form>
    </div>
  );
}`,
        description: 'Login page',
        type: 'page',
      });
    }

    return files;
  }

  /**
   * Generate environment variables
   */
  private generateEnvVars(stack: AppStack): EnvVariable[] {
    const vars: EnvVariable[] = [];

    if (stack.database === 'supabase') {
      vars.push({
        name: 'NEXT_PUBLIC_SUPABASE_URL',
        description: 'Supabase project URL',
        required: true,
        example: 'https://xxxxx.supabase.co',
        secret: false,
      });
      vars.push({
        name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        description: 'Supabase anonymous key',
        required: true,
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        secret: false,
      });
      vars.push({
        name: 'SUPABASE_SERVICE_ROLE_KEY',
        description: 'Supabase service role key (server-side only)',
        required: true,
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        secret: true,
      });
    }

    if (stack.database.startsWith('prisma')) {
      vars.push({
        name: 'DATABASE_URL',
        description: 'Database connection string',
        required: true,
        example: 'postgresql://user:pass@localhost:5432/db',
        secret: true,
      });
    }

    return vars;
  }

  /**
   * Generate setup instructions
   */
  private generateSetupInstructions(stack: AppStack): string[] {
    const instructions: string[] = [];

    instructions.push('1. Install dependencies: npm install');

    if (stack.database === 'supabase') {
      instructions.push('2. Create a Supabase project at https://supabase.com');
      instructions.push('3. Run the migration in supabase/migrations/');
      instructions.push('4. Copy your Supabase URL and keys to .env.local');
    }

    if (stack.database.startsWith('prisma')) {
      instructions.push('2. Set up your database and update DATABASE_URL in .env');
      instructions.push('3. Run: npx prisma migrate dev');
      instructions.push('4. Run: npx prisma generate');
    }

    instructions.push(`${instructions.length + 1}. Start the dev server: npm run dev`);

    return instructions;
  }

  /**
   * Helper functions
   */
  private getDefaultStack(): AppStack {
    return {
      framework: 'nextjs',
      database: 'supabase',
      auth: 'supabase-auth',
      styling: 'tailwind',
      additionalLibraries: [],
    };
  }

  private getDefaultSchema(): DatabaseSchema {
    return {
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
      ],
      relationships: [],
      indexes: [],
    };
  }

  private generateAppName(description: string): string {
    const words = description.toLowerCase().split(' ').slice(0, 3);
    return words.join('-').replace(/[^a-z0-9-]/g, '');
  }

  private toPascalCase(str: string): string {
    return str
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
  }

  private mapToPostgresType(type: string): string {
    const map: Record<string, string> = {
      uuid: 'UUID',
      text: 'TEXT',
      string: 'TEXT',
      int: 'INTEGER',
      integer: 'INTEGER',
      boolean: 'BOOLEAN',
      timestamp: 'TIMESTAMPTZ',
      json: 'JSONB',
      float: 'REAL',
      decimal: 'DECIMAL',
    };
    return map[type.toLowerCase()] || 'TEXT';
  }

  private mapToPrismaType(type: string): string {
    const map: Record<string, string> = {
      uuid: 'String',
      text: 'String',
      string: 'String',
      int: 'Int',
      integer: 'Int',
      boolean: 'Boolean',
      timestamp: 'DateTime',
      json: 'Json',
      float: 'Float',
      decimal: 'Decimal',
    };
    return map[type.toLowerCase()] || 'String';
  }

  private estimateDevelopmentTime(fileCount: number): string {
    if (fileCount < 10) return '1-2 hours';
    if (fileCount < 25) return '4-8 hours';
    if (fileCount < 50) return '1-2 days';
    return '3-5 days';
  }
}

// ============================================
// EXPORTS
// ============================================

export const appGenerator = new AppGenerator();

/**
 * Generate a full app from description
 */
export async function generateApp(
  description: string,
  options?: Partial<AppDescription>
): Promise<GeneratedApp> {
  return appGenerator.generateApp({
    description,
    ...options,
  });
}

/**
 * Quick function to generate files as a zip-ready structure
 */
export async function generateAppFiles(
  description: string
): Promise<Array<{ path: string; content: string }>> {
  const app = await appGenerator.generateApp({ description });
  return app.files.map((f) => ({ path: f.path, content: f.content }));
}
