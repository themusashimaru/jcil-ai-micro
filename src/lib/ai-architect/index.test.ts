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
  DiagramType,
  DiagramFormat,
  DiagramRequest,
  GeneratedDiagram,
  ArchitectureAnalysis,
  ComponentInfo,
  DataFlow,
  ERDiagram,
  ERTable,
  ERColumn,
  ERRelationship,
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

const sampleFiles = [
  { path: 'src/app.ts', content: 'export class App { start() {} }' },
  { path: 'src/db.ts', content: 'export interface User { id: string; }' },
  { path: 'package.json', content: JSON.stringify({ name: 'test', dependencies: { next: '14' } }) },
];

const schemaFiles = [
  {
    path: 'prisma/schema.prisma',
    content: `model User { id String @id\nemail String @unique }`,
  },
  {
    path: 'supabase/migrations/001.sql',
    content: 'CREATE TABLE users (id uuid PRIMARY KEY, email text);',
  },
];

const apiFiles = [
  { path: 'app/api/users/route.ts', content: 'export async function GET() {}' },
  { path: 'src/controller/items.ts', content: 'router.get("/items")' },
];

const componentFiles = [
  { path: 'src/components/Button.tsx', content: 'export function Button() { return <button/>; }' },
  { path: 'src/components/Card.vue', content: '<template><div/></template>' },
];

const infraFiles = [
  { path: 'Dockerfile', content: 'FROM node:18' },
  { path: 'docker-compose.yml', content: 'services:\n  app:\n    build: .' },
  { path: 'vercel.json', content: '{}' },
];

const classFiles = [
  {
    path: 'src/models.ts',
    content: 'export class Animal { name: string; }\nexport interface Pet { }',
  },
  { path: 'src/types.ts', content: 'export type Status = "active" | "inactive";' },
];

// ---------------------------------------------------------------------------
// Type export tests
// ---------------------------------------------------------------------------

describe('ai-architect type exports', () => {
  it('DiagramType accepts all valid values', () => {
    const types: DiagramType[] = [
      'system',
      'database',
      'api-flow',
      'component',
      'sequence',
      'infrastructure',
      'class',
      'flowchart',
    ];
    expect(types).toHaveLength(8);
  });

  it('DiagramFormat accepts all valid values', () => {
    const formats: DiagramFormat[] = ['mermaid', 'plantuml', 'ascii', 'd2'];
    expect(formats).toHaveLength(4);
  });

  it('DiagramRequest shape is valid', () => {
    const req: DiagramRequest = {
      type: 'system',
      format: 'mermaid',
      title: 'Test',
      description: 'Desc',
      includeDetails: true,
    };
    expect(req.type).toBe('system');
  });

  it('GeneratedDiagram shape is valid', () => {
    const d: GeneratedDiagram = {
      type: 'database',
      format: 'plantuml',
      title: 'DB',
      code: 'erDiagram',
      description: 'Schema',
      svgUrl: 'http://example.com/svg',
      pngUrl: 'http://example.com/png',
    };
    expect(d.svgUrl).toBeDefined();
  });

  it('ArchitectureAnalysis shape is valid', () => {
    const a: ArchitectureAnalysis = {
      overview: 'A system',
      components: [],
      dataFlows: [],
      externalDependencies: ['npm:react'],
      patterns: ['MVC'],
      recommendations: ['Add tests'],
    };
    expect(a.patterns).toContain('MVC');
  });

  it('ComponentInfo shape is valid', () => {
    const c: ComponentInfo = {
      name: 'Auth',
      type: 'backend',
      description: 'Handles auth',
      dependencies: ['DB'],
      exposedAPIs: ['/api/login'],
    };
    expect(c.type).toBe('backend');
  });

  it('DataFlow shape is valid', () => {
    const f: DataFlow = {
      from: 'Frontend',
      to: 'API',
      description: 'User request',
      protocol: 'HTTP',
      dataType: 'JSON',
    };
    expect(f.protocol).toBe('HTTP');
  });

  it('ERDiagram shape is valid', () => {
    const d: ERDiagram = { tables: [], relationships: [] };
    expect(d.tables).toHaveLength(0);
  });

  it('ERTable shape is valid', () => {
    const t: ERTable = { name: 'users', columns: [] };
    expect(t.name).toBe('users');
  });

  it('ERColumn shape is valid', () => {
    const c: ERColumn = {
      name: 'id',
      type: 'uuid',
      primaryKey: true,
      foreignKey: { table: 'other', column: 'id' },
      nullable: false,
    };
    expect(c.primaryKey).toBe(true);
  });

  it('ERRelationship shape is valid', () => {
    const r: ERRelationship = {
      from: 'users',
      to: 'posts',
      type: 'one-to-many',
      label: 'authored',
    };
    expect(r.type).toBe('one-to-many');
  });
});

// ---------------------------------------------------------------------------
// AIArchitect class
// ---------------------------------------------------------------------------

describe('AIArchitect', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  // -----------------------------------------------------------------------
  // analyzeArchitecture
  // -----------------------------------------------------------------------
  describe('analyzeArchitecture', () => {
    it('returns parsed JSON analysis on success', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      const analysisJson = JSON.stringify({
        overview: 'A Next.js app',
        components: [{ name: 'Frontend', type: 'frontend', description: 'UI', dependencies: [] }],
        dataFlows: [{ from: 'Frontend', to: 'API', description: 'HTTP' }],
        externalDependencies: ['react'],
        patterns: ['MVC'],
        recommendations: ['Add tests'],
      });

      mockCreate.mockResolvedValue(makeTextResponse(`Here is the analysis:\n${analysisJson}`));

      const result = await arch.analyzeArchitecture(sampleFiles);

      expect(result.overview).toBe('A Next.js app');
      expect(result.components).toHaveLength(1);
      expect(result.patterns).toContain('MVC');
    });

    it('returns default analysis when no JSON in response', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('No JSON here, just plain text.'));

      const result = await arch.analyzeArchitecture(sampleFiles);

      expect(result.overview).toBe('Architecture analysis failed');
      expect(result.components).toHaveLength(0);
    });

    it('returns default analysis on non-text response', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeNonTextResponse());

      const result = await arch.analyzeArchitecture(sampleFiles);

      expect(result.overview).toBe('Architecture analysis failed');
    });

    it('returns default analysis on API error', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockRejectedValue(new Error('API down'));

      const result = await arch.analyzeArchitecture(sampleFiles);

      expect(result.overview).toBe('Architecture analysis failed');
      expect(result.recommendations).toContain('Manual architecture review recommended');
    });

    it('returns default analysis on invalid JSON in response', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('{ "overview": invalid }'));

      const result = await arch.analyzeArchitecture(sampleFiles);

      expect(result.overview).toBe('Architecture analysis failed');
    });
  });

  // -----------------------------------------------------------------------
  // generateDiagram — dispatches by type
  // -----------------------------------------------------------------------
  describe('generateDiagram', () => {
    it('defaults format to mermaid when not specified', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      // analyzeArchitecture (called inside generateSystemDiagram) + generateSystemDiagram
      const analysisJson = JSON.stringify({
        overview: 'Test',
        components: [],
        dataFlows: [],
        externalDependencies: [],
        patterns: [],
        recommendations: [],
      });
      mockCreate
        .mockResolvedValueOnce(makeTextResponse(analysisJson))
        .mockResolvedValueOnce(makeTextResponse('```mermaid\ngraph TD\n    A-->B\n```'));

      const result = await arch.generateDiagram(sampleFiles, { type: 'system' });

      expect(result.format).toBe('mermaid');
    });

    it('dispatches system type', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      const analysisJson = JSON.stringify({
        overview: 'Sys',
        components: [],
        dataFlows: [],
        externalDependencies: [],
        patterns: [],
        recommendations: [],
      });
      mockCreate
        .mockResolvedValueOnce(makeTextResponse(analysisJson))
        .mockResolvedValueOnce(makeTextResponse('```mermaid\ngraph TD\n    A-->B\n```'));

      const result = await arch.generateDiagram(sampleFiles, {
        type: 'system',
        title: 'My System',
      });

      expect(result.type).toBe('system');
      expect(result.title).toBe('My System');
      expect(result.code).toContain('A-->B');
    });

    it('dispatches database type', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(
        makeTextResponse('```mermaid\nerDiagram\n    USER ||--o{ POST\n```')
      );

      const result = await arch.generateDiagram(schemaFiles, { type: 'database' });

      expect(result.type).toBe('database');
      expect(result.code).toContain('erDiagram');
    });

    it('dispatches api-flow type', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(
        makeTextResponse('```mermaid\nflowchart LR\n    Client-->Server\n```')
      );

      const result = await arch.generateDiagram(apiFiles, { type: 'api-flow' });

      expect(result.type).toBe('api-flow');
    });

    it('dispatches component type', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('```mermaid\ngraph TD\n    App-->Button\n```'));

      const result = await arch.generateDiagram(componentFiles, { type: 'component' });

      expect(result.type).toBe('component');
    });

    it('dispatches sequence type', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(
        makeTextResponse('```mermaid\nsequenceDiagram\n    User->>API: Request\n```')
      );

      const result = await arch.generateDiagram(sampleFiles, {
        type: 'sequence',
        description: 'Login flow',
      });

      expect(result.type).toBe('sequence');
      expect(result.description).toBe('Login flow');
    });

    it('dispatches infrastructure type', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('```mermaid\ngraph TD\n    LB-->App\n```'));

      const result = await arch.generateDiagram(infraFiles, { type: 'infrastructure' });

      expect(result.type).toBe('infrastructure');
    });

    it('dispatches class type', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(
        makeTextResponse('```mermaid\nclassDiagram\n    class Animal\n```')
      );

      const result = await arch.generateDiagram(classFiles, { type: 'class' });

      expect(result.type).toBe('class');
    });

    it('dispatches flowchart type', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('```mermaid\nflowchart TD\n    A-->B\n```'));

      const result = await arch.generateDiagram(sampleFiles, {
        type: 'flowchart',
        description: 'Deploy flow',
      });

      expect(result.type).toBe('flowchart');
      expect(result.description).toBe('Deploy flow');
    });
  });

  // -----------------------------------------------------------------------
  // generateSystemDiagram — error paths
  // -----------------------------------------------------------------------
  describe('generateSystemDiagram error handling', () => {
    it('returns default diagram when API call fails', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      // analyzeArchitecture succeeds, then system diagram call fails
      const analysisJson = JSON.stringify({
        overview: 'Sys',
        components: [],
        dataFlows: [],
        externalDependencies: [],
        patterns: [],
        recommendations: [],
      });
      mockCreate
        .mockResolvedValueOnce(makeTextResponse(analysisJson))
        .mockRejectedValueOnce(new Error('Diagram fail'));

      const result = await arch.generateDiagram(sampleFiles, { type: 'system' });

      expect(result.code).toContain('Error generating diagram');
      expect(result.description).toBe('Diagram generation failed');
    });

    it('returns default diagram on non-text response', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      const analysisJson = JSON.stringify({
        overview: 'OK',
        components: [],
        dataFlows: [],
        externalDependencies: [],
        patterns: [],
        recommendations: [],
      });
      mockCreate
        .mockResolvedValueOnce(makeTextResponse(analysisJson))
        .mockResolvedValueOnce(makeNonTextResponse());

      const result = await arch.generateDiagram(sampleFiles, { type: 'system' });

      expect(result.description).toBe('Diagram generation failed');
    });
  });

  // -----------------------------------------------------------------------
  // generateERDiagram — filters schema files
  // -----------------------------------------------------------------------
  describe('generateERDiagram', () => {
    it('filters schema/migration/prisma/model/sql files', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('erDiagram\n    USERS'));

      const mixedFiles = [...schemaFiles, { path: 'src/app.ts', content: 'export const x = 1;' }];

      await arch.generateDiagram(mixedFiles, { type: 'database' });

      // The prompt should contain the schema files
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('schema.prisma');
    });

    it('returns default diagram on error', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockRejectedValue(new Error('DB diagram fail'));

      const result = await arch.generateDiagram(schemaFiles, { type: 'database' });

      expect(result.type).toBe('database');
      expect(result.description).toBe('Diagram generation failed');
    });
  });

  // -----------------------------------------------------------------------
  // generateAPIFlowDiagram — filters API files
  // -----------------------------------------------------------------------
  describe('generateAPIFlowDiagram', () => {
    it('filters api/route/controller files', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('flowchart LR\n    A-->B'));

      await arch.generateDiagram(apiFiles, { type: 'api-flow' });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('route.ts');
    });

    it('returns default diagram on error', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockRejectedValue(new Error('fail'));

      const result = await arch.generateDiagram(apiFiles, { type: 'api-flow' });

      expect(result.description).toBe('Diagram generation failed');
    });
  });

  // -----------------------------------------------------------------------
  // generateComponentDiagram — filters component files
  // -----------------------------------------------------------------------
  describe('generateComponentDiagram', () => {
    it('filters component/.tsx/.vue files', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('graph TD\n    App-->Button'));

      await arch.generateDiagram(componentFiles, { type: 'component' });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Button.tsx');
    });

    it('returns default diagram on error', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockRejectedValue(new Error('fail'));

      const result = await arch.generateDiagram(componentFiles, { type: 'component' });

      expect(result.description).toBe('Diagram generation failed');
    });
  });

  // -----------------------------------------------------------------------
  // generateSequenceDiagram
  // -----------------------------------------------------------------------
  describe('generateSequenceDiagram', () => {
    it('uses request description in prompt', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('sequenceDiagram\n    U->>A: Login'));

      await arch.generateDiagram(sampleFiles, {
        type: 'sequence',
        description: 'Authentication flow',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Authentication flow');
    });

    it('defaults description to "main user flow"', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('sequenceDiagram\n    U->>A: Action'));

      const result = await arch.generateDiagram(sampleFiles, { type: 'sequence' });

      expect(result.description).toBe('User interaction sequence diagram');
    });

    it('returns default diagram on error', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockRejectedValue(new Error('fail'));

      const result = await arch.generateDiagram(sampleFiles, { type: 'sequence' });

      expect(result.description).toBe('Diagram generation failed');
    });
  });

  // -----------------------------------------------------------------------
  // generateInfraDiagram — filters infra files
  // -----------------------------------------------------------------------
  describe('generateInfraDiagram', () => {
    it('filters docker/k8s/terraform/vercel/yaml files', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('graph TD\n    LB-->App'));

      await arch.generateDiagram(infraFiles, { type: 'infrastructure' });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('docker-compose.yml');
    });

    it('falls back to generic prompt when no infra files found', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('graph TD\n    Vercel-->App'));

      const noInfraFiles = [{ path: 'src/app.ts', content: '' }];
      await arch.generateDiagram(noInfraFiles, { type: 'infrastructure' });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('No infrastructure files found');
    });

    it('returns default diagram on error', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockRejectedValue(new Error('fail'));

      const result = await arch.generateDiagram(infraFiles, { type: 'infrastructure' });

      expect(result.description).toBe('Diagram generation failed');
    });
  });

  // -----------------------------------------------------------------------
  // generateClassDiagram — filters class/interface/type files
  // -----------------------------------------------------------------------
  describe('generateClassDiagram', () => {
    it('filters files containing class/interface/type keywords', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('classDiagram\n    class Animal'));

      const mixedFiles = [...classFiles, { path: 'data.json', content: '{}' }];

      await arch.generateDiagram(mixedFiles, { type: 'class' });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('models.ts');
    });

    it('returns default diagram on error', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockRejectedValue(new Error('fail'));

      const result = await arch.generateDiagram(classFiles, { type: 'class' });

      expect(result.description).toBe('Diagram generation failed');
    });
  });

  // -----------------------------------------------------------------------
  // generateFlowchart
  // -----------------------------------------------------------------------
  describe('generateFlowchart', () => {
    it('uses request description in prompt', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('flowchart TD\n    A-->B'));

      await arch.generateDiagram(sampleFiles, {
        type: 'flowchart',
        description: 'Deployment pipeline',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Deployment pipeline');
    });

    it('defaults description to "main application flow"', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('flowchart TD\n    A-->B'));

      const result = await arch.generateDiagram(sampleFiles, { type: 'flowchart' });

      expect(result.description).toBe('Application flow diagram');
    });

    it('returns default diagram on error', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockRejectedValue(new Error('fail'));

      const result = await arch.generateDiagram(sampleFiles, { type: 'flowchart' });

      expect(result.description).toBe('Diagram generation failed');
    });
  });

  // -----------------------------------------------------------------------
  // Code extraction from fenced blocks
  // -----------------------------------------------------------------------
  describe('code extraction from fenced blocks', () => {
    it('extracts code from mermaid fenced block', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(
        makeTextResponse('Here is the diagram:\n\n```mermaid\ngraph TD\n    A-->B\n```\n\nDone!')
      );

      const result = await arch.generateDiagram(componentFiles, { type: 'component' });

      expect(result.code).toBe('graph TD\n    A-->B');
    });

    it('extracts code from plantuml fenced block', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(
        makeTextResponse('```plantuml\n@startuml\nclass Foo\n@enduml\n```')
      );

      const result = await arch.generateDiagram(classFiles, { type: 'class', format: 'plantuml' });

      expect(result.code).toContain('@startuml');
    });

    it('falls back to full text when no fenced block', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('graph TD\n    A-->B'));

      const result = await arch.generateDiagram(componentFiles, { type: 'component' });

      expect(result.code).toBe('graph TD\n    A-->B');
    });
  });

  // -----------------------------------------------------------------------
  // generateAllDiagrams
  // -----------------------------------------------------------------------
  describe('generateAllDiagrams', () => {
    it('generates system, database, component, and api-flow diagrams', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      // Each diagram type may call anthropic 1-2 times
      mockCreate.mockResolvedValue(makeTextResponse('graph TD\n    A-->B'));

      const results = await arch.generateAllDiagrams(sampleFiles, 'MyProject');

      expect(results.length).toBeGreaterThanOrEqual(1);
      // All results should have mermaid format
      for (const d of results) {
        expect(d.format).toBe('mermaid');
      }
    });

    it('skips failed diagrams and continues', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      // First two calls fail (analyzeArchitecture for system diagram),
      // then succeed for remaining
      let callCount = 0;
      mockCreate.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('fail'));
        }
        return Promise.resolve(makeTextResponse('graph TD\n    X-->Y'));
      });

      const results = await arch.generateAllDiagrams(sampleFiles, 'MyProject');

      // Should still return some diagrams even if some fail
      expect(Array.isArray(results)).toBe(true);
    });

    it('includes project name in diagram titles', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockResolvedValue(makeTextResponse('graph TD\n    A-->B'));

      const results = await arch.generateAllDiagrams(sampleFiles, 'CoolApp');

      for (const d of results) {
        expect(d.title).toContain('CoolApp');
      }
    });
  });

  // -----------------------------------------------------------------------
  // getDefaultDiagram / getDefaultAnalysis
  // -----------------------------------------------------------------------
  describe('default fallbacks', () => {
    it('getDefaultDiagram returns correct type and format', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockRejectedValue(new Error('always fail'));

      const result = await arch.generateDiagram(sampleFiles, {
        type: 'flowchart',
        format: 'plantuml',
      });

      expect(result.type).toBe('flowchart');
      expect(result.format).toBe('plantuml');
      expect(result.code).toContain('Error generating diagram');
    });

    it('getDefaultAnalysis contains sensible defaults', async () => {
      const { AIArchitect } = await import('./index');
      const arch = new AIArchitect();

      mockCreate.mockRejectedValue(new Error('nope'));

      const result = await arch.analyzeArchitecture([]);

      expect(result.overview).toBe('Architecture analysis failed');
      expect(result.components).toEqual([]);
      expect(result.dataFlows).toEqual([]);
      expect(result.externalDependencies).toEqual([]);
      expect(result.patterns).toEqual([]);
      expect(result.recommendations).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Exported singleton and helper functions
// ---------------------------------------------------------------------------

describe('aiArchitect singleton', () => {
  it('exports a singleton instance', async () => {
    const { aiArchitect, AIArchitect } = await import('./index');
    expect(aiArchitect).toBeInstanceOf(AIArchitect);
  });
});

describe('generateDiagram helper', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  it('delegates to aiArchitect.generateDiagram', async () => {
    const { generateDiagram } = await import('./index');

    mockCreate.mockResolvedValue(makeTextResponse('graph TD\n    A-->B'));

    const result = await generateDiagram(componentFiles, 'component', 'My Components');

    expect(result.type).toBe('component');
    expect(result.title).toBe('My Components');
  });

  it('works without optional title', async () => {
    const { generateDiagram } = await import('./index');

    mockCreate.mockResolvedValue(makeTextResponse('erDiagram'));

    const result = await generateDiagram(schemaFiles, 'database');

    expect(result.type).toBe('database');
  });
});

describe('analyzeArchitecture helper', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  it('delegates to aiArchitect.analyzeArchitecture', async () => {
    const { analyzeArchitecture } = await import('./index');

    const analysisJson = JSON.stringify({
      overview: 'A system',
      components: [],
      dataFlows: [],
      externalDependencies: [],
      patterns: [],
      recommendations: [],
    });
    mockCreate.mockResolvedValue(makeTextResponse(analysisJson));

    const result = await analyzeArchitecture(sampleFiles);

    expect(result.overview).toBe('A system');
  });
});
