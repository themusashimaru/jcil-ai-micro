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
  DocType,
  DocGenerationOptions,
  GeneratedDoc,
  DocSection,
  DocMetadata,
  APIEndpoint,
  APIParam,
  APIResponse,
  FunctionDoc,
  ParamDoc,
  ReturnDoc,
} from './index';

// We need the mock handle to configure per-test responses
async function getMockCreate() {
  const mod = await import('@anthropic-ai/sdk');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mod as any).__mockCreate as ReturnType<typeof vi.fn>;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTextResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

function makeNonTextResponse() {
  return { content: [{ type: 'image', source: {} }] };
}

const sampleFiles = [
  { path: 'src/app.ts', content: 'export function hello() { return "hi"; }' },
  { path: 'src/utils.ts', content: 'export const add = (a: number, b: number) => a + b;' },
  {
    path: 'package.json',
    content: JSON.stringify({ name: 'test-proj', version: '1.0.0', description: 'A test' }),
  },
];

const apiRouteFiles = [
  {
    path: 'app/api/users/route.ts',
    content: `
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit");
  return Response.json([]);
}
export async function POST(request: Request) {
  const body = await request.json();
  return Response.json({ id: params.userId });
}`,
  },
  {
    path: 'src/routes.items.ts',
    content: `
router.get('/items', handler);
router.post('/items', handler);
router.delete('/items/:id', handler);
`,
  },
];

const defaultOptions: DocGenerationOptions = {
  type: 'readme',
  format: 'markdown',
  style: 'standard',
  includeExamples: true,
  audience: 'developer',
};

// ---------------------------------------------------------------------------
// Type export tests
// ---------------------------------------------------------------------------

describe('doc-generator type exports', () => {
  it('DocType accepts all valid values', () => {
    const types: DocType[] = [
      'readme',
      'api',
      'jsdoc',
      'architecture',
      'changelog',
      'guide',
      'openapi',
    ];
    expect(types).toHaveLength(7);
  });

  it('DocGenerationOptions shape is valid', () => {
    const opts: DocGenerationOptions = {
      type: 'readme',
      format: 'markdown',
      style: 'minimal',
      includeExamples: false,
      includeTests: true,
      audience: 'user',
    };
    expect(opts.type).toBe('readme');
    expect(opts.includeTests).toBe(true);
  });

  it('GeneratedDoc shape is valid', () => {
    const doc: GeneratedDoc = {
      type: 'api',
      title: 'Test',
      content: '# API',
      format: 'markdown',
      sections: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        sourceFiles: 1,
        totalFunctions: 2,
        totalClasses: 0,
        coverage: 100,
      },
    };
    expect(doc.type).toBe('api');
  });

  it('DocSection shape is valid', () => {
    const section: DocSection = {
      title: 'Overview',
      content: 'Some content',
      order: 0,
      subsections: [{ title: 'Sub', content: 'Detail', order: 0 }],
    };
    expect(section.subsections).toHaveLength(1);
  });

  it('DocMetadata shape is valid', () => {
    const meta: DocMetadata = {
      generatedAt: '2026-01-01T00:00:00Z',
      sourceFiles: 5,
      totalFunctions: 10,
      totalClasses: 3,
      coverage: 85,
    };
    expect(meta.coverage).toBe(85);
  });

  it('APIEndpoint shape is valid', () => {
    const ep: APIEndpoint = {
      method: 'POST',
      path: '/api/test',
      description: 'Create test',
      params: [],
      responses: [{ status: 200, description: 'OK' }],
      requestBody: { type: 'json', schema: {}, example: { foo: 1 } },
      authentication: 'Bearer',
      rateLimit: '100/min',
    };
    expect(ep.method).toBe('POST');
  });

  it('APIParam shape is valid', () => {
    const param: APIParam = {
      name: 'id',
      in: 'path',
      type: 'string',
      required: true,
      description: 'Resource ID',
      example: '123',
    };
    expect(param.in).toBe('path');
  });

  it('APIResponse shape is valid', () => {
    const res: APIResponse = {
      status: 404,
      description: 'Not found',
      schema: { type: 'object' },
      example: { error: 'not found' },
    };
    expect(res.status).toBe(404);
  });

  it('FunctionDoc shape is valid', () => {
    const doc: FunctionDoc = {
      name: 'myFunc',
      description: 'Does stuff',
      params: [{ name: 'a', type: 'string', description: 'input', optional: false }],
      returns: { type: 'void', description: 'nothing' },
      throws: ['Error'],
      examples: ['myFunc("hi")'],
      deprecated: 'Use newFunc',
      since: '1.0.0',
    };
    expect(doc.throws).toContain('Error');
  });

  it('ParamDoc shape is valid', () => {
    const p: ParamDoc = {
      name: 'x',
      type: 'number',
      description: 'A number',
      optional: true,
      defaultValue: '0',
    };
    expect(p.optional).toBe(true);
  });

  it('ReturnDoc shape is valid', () => {
    const r: ReturnDoc = { type: 'string', description: 'Result' };
    expect(r.type).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// AIDocGenerator class
// ---------------------------------------------------------------------------

describe('AIDocGenerator', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  // -----------------------------------------------------------------------
  // generateDocs — dispatches to correct generator by type
  // -----------------------------------------------------------------------
  describe('generateDocs', () => {
    it('dispatches to readme generator', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeTextResponse('# My README\n\n## Features\nCool stuff'));

      const result = await gen.generateDocs(sampleFiles, 'TestProject', {
        ...defaultOptions,
        type: 'readme',
      });

      expect(result.type).toBe('readme');
      expect(result.title).toContain('TestProject');
      expect(result.format).toBe('markdown');
      expect(result.metadata.sourceFiles).toBe(sampleFiles.length);
    });

    it('dispatches to api generator', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      // API docs don't call anthropic — they parse files directly
      const result = await gen.generateDocs(apiRouteFiles, 'TestProject', {
        ...defaultOptions,
        type: 'api',
      });

      expect(result.type).toBe('api');
      expect(result.content).toContain('API Documentation');
    });

    it('dispatches to jsdoc generator', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(
        makeTextResponse('/** @description Added docs */\nexport function hello() {}')
      );

      const tsFiles = [{ path: 'src/main.ts', content: 'export function hello() {}' }];
      const result = await gen.generateDocs(tsFiles, 'TestProject', {
        ...defaultOptions,
        type: 'jsdoc',
      });

      expect(result.type).toBe('jsdoc');
    });

    it('dispatches to architecture generator', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(
        makeTextResponse('# Architecture\n\n## Overview\nMicroservices')
      );

      const result = await gen.generateDocs(sampleFiles, 'TestProject', {
        ...defaultOptions,
        type: 'architecture',
      });

      expect(result.type).toBe('architecture');
      expect(result.title).toContain('Architecture');
    });

    it('dispatches to changelog generator', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(
        makeTextResponse('## [1.0.0] - 2026-01-01\n### Added\n- Initial release')
      );

      const result = await gen.generateDocs(sampleFiles, 'TestProject', {
        ...defaultOptions,
        type: 'changelog',
      });

      expect(result.type).toBe('changelog');
    });

    it('dispatches to guide generator', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeTextResponse('# User Guide\n\n## Getting Started\nStep 1'));

      const result = await gen.generateDocs(sampleFiles, 'TestProject', {
        ...defaultOptions,
        type: 'guide',
      });

      expect(result.type).toBe('guide');
      expect(result.title).toContain('User Guide');
    });

    it('dispatches to openapi generator', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(
        makeTextResponse('```yaml\nopenapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0\n```')
      );

      const result = await gen.generateDocs(apiRouteFiles, 'TestProject', {
        ...defaultOptions,
        type: 'openapi',
      });

      expect(result.type).toBe('openapi');
      expect(result.format).toBe('json');
    });
  });

  // -----------------------------------------------------------------------
  // generateReadme
  // -----------------------------------------------------------------------
  describe('generateReadme (via generateDocs)', () => {
    it('parses package.json for project info', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeTextResponse('# TestProject\n\nA project'));

      await gen.generateDocs(sampleFiles, 'TestProject', { ...defaultOptions, type: 'readme' });

      // Verify anthropic was called — the prompt should contain package.json info
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('test-proj');
    });

    it('handles missing package.json gracefully', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const filesWithoutPkg = [{ path: 'main.ts', content: 'console.log("hi")' }];
      mockCreate.mockResolvedValue(makeTextResponse('# Project\n\nSome readme'));

      const result = await gen.generateDocs(filesWithoutPkg, 'TestProject', {
        ...defaultOptions,
        type: 'readme',
      });

      expect(result.content).toContain('Project');
    });

    it('handles malformed package.json gracefully', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const filesWithBadPkg = [{ path: 'package.json', content: '{ invalid json' }];
      mockCreate.mockResolvedValue(makeTextResponse('# Readme'));

      const result = await gen.generateDocs(filesWithBadPkg, 'TestProject', {
        ...defaultOptions,
        type: 'readme',
      });

      expect(result.type).toBe('readme');
    });

    it('throws if anthropic returns non-text content', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeNonTextResponse());

      await expect(
        gen.generateDocs(sampleFiles, 'TestProject', { ...defaultOptions, type: 'readme' })
      ).rejects.toThrow('Unexpected response');
    });

    it('propagates anthropic errors', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockRejectedValue(new Error('API rate limit'));

      await expect(
        gen.generateDocs(sampleFiles, 'TestProject', { ...defaultOptions, type: 'readme' })
      ).rejects.toThrow('API rate limit');
    });

    it('extracts sections from generated markdown', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const md = '# Title\n\nIntro\n\n## Features\n\nFeature list\n\n## Install\n\nnpm install';
      mockCreate.mockResolvedValue(makeTextResponse(md));

      const result = await gen.generateDocs(sampleFiles, 'TestProject', {
        ...defaultOptions,
        type: 'readme',
      });

      expect(result.sections.length).toBeGreaterThanOrEqual(2);
      expect(result.sections[0].title).toBe('Title');
    });
  });

  // -----------------------------------------------------------------------
  // generateAPIDocs
  // -----------------------------------------------------------------------
  describe('generateAPIDocs (via generateDocs)', () => {
    it('generates API docs from Next.js route files', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const result = await gen.generateDocs(apiRouteFiles, 'TestProject', {
        ...defaultOptions,
        type: 'api',
      });

      expect(result.type).toBe('api');
      expect(result.content).toContain('Endpoints');
      expect(result.metadata.sourceFiles).toBeGreaterThan(0);
    });

    it('extracts Next.js route endpoints with correct methods', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const result = await gen.generateDocs(apiRouteFiles, 'TestProject', {
        ...defaultOptions,
        type: 'api',
      });

      expect(result.content).toContain('GET');
      expect(result.content).toContain('POST');
    });

    it('extracts Express-style routes', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const result = await gen.generateDocs(apiRouteFiles, 'TestProject', {
        ...defaultOptions,
        type: 'api',
      });

      expect(result.content).toContain('/items');
    });

    it('extracts URL params from code', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const result = await gen.generateDocs(apiRouteFiles, 'TestProject', {
        ...defaultOptions,
        type: 'api',
      });

      // params.userId is in the test file
      expect(result.content).toContain('userId');
    });

    it('extracts query params from code', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const result = await gen.generateDocs(apiRouteFiles, 'TestProject', {
        ...defaultOptions,
        type: 'api',
      });

      // searchParams.get("limit") is in the test file
      expect(result.content).toContain('limit');
    });

    it('includes response examples when includeExamples is set', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const result = await gen.generateDocs(apiRouteFiles, 'TestProject', {
        ...defaultOptions,
        type: 'api',
        includeExamples: true,
      });

      // API docs should contain response status codes
      expect(result.content).toContain('200');
    });

    it('groups endpoints by path prefix', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const result = await gen.generateDocs(apiRouteFiles, 'TestProject', {
        ...defaultOptions,
        type: 'api',
      });

      // Capitalized group heading for "api" prefix -> "Api" and "items" -> "Items"
      expect(result.content).toContain('Api');
    });

    it('handles empty API files gracefully', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const noApiFiles = [{ path: 'src/utils.ts', content: 'export const x = 1;' }];
      const result = await gen.generateDocs(noApiFiles, 'TestProject', {
        ...defaultOptions,
        type: 'api',
      });

      expect(result.type).toBe('api');
      expect(result.content).toContain('API Documentation');
    });
  });

  // -----------------------------------------------------------------------
  // generateJSDocs
  // -----------------------------------------------------------------------
  describe('generateJSDocs (via generateDocs)', () => {
    it('processes only JS/TS files', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeTextResponse('/** documented */\nexport function x() {}'));

      const mixedFiles = [
        { path: 'main.ts', content: 'export function x() {}' },
        { path: 'styles.css', content: '.foo { color: red; }' },
        { path: 'data.json', content: '{}' },
      ];

      const result = await gen.generateDocs(mixedFiles, 'Proj', {
        ...defaultOptions,
        type: 'jsdoc',
      });

      // Only 1 call for the .ts file
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.type).toBe('jsdoc');
    });

    it('calculates coverage based on documented vs total files', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeTextResponse('/** docs */ function x() {}'));

      const files = [
        { path: 'a.ts', content: 'export function a() {}' },
        { path: 'b.tsx', content: 'export function b() {}' },
      ];

      const result = await gen.generateDocs(files, 'Proj', { ...defaultOptions, type: 'jsdoc' });

      expect(result.metadata.coverage).toBe(100); // 2 documented / 2 total
    });

    it('skips files that fail and continues', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(makeTextResponse('/** ok */'));

      const files = [
        { path: 'a.ts', content: 'x' },
        { path: 'b.js', content: 'y' },
      ];

      const result = await gen.generateDocs(files, 'Proj', { ...defaultOptions, type: 'jsdoc' });

      expect(result.metadata.coverage).toBe(50); // 1 documented / 2 total
    });

    it('handles non-text responses gracefully', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeNonTextResponse());

      const files = [{ path: 'a.ts', content: 'x' }];
      const result = await gen.generateDocs(files, 'Proj', { ...defaultOptions, type: 'jsdoc' });

      expect(result.metadata.coverage).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // generateArchitectureDocs
  // -----------------------------------------------------------------------
  describe('generateArchitectureDocs (via generateDocs)', () => {
    it('returns architecture doc on success', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeTextResponse('# Architecture\n\n## Overview\nMicro'));

      const result = await gen.generateDocs(sampleFiles, 'Proj', {
        ...defaultOptions,
        type: 'architecture',
      });

      expect(result.type).toBe('architecture');
    });

    it('throws on non-text response', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeNonTextResponse());

      await expect(
        gen.generateDocs(sampleFiles, 'Proj', { ...defaultOptions, type: 'architecture' })
      ).rejects.toThrow('Unexpected response');
    });
  });

  // -----------------------------------------------------------------------
  // generateChangelog
  // -----------------------------------------------------------------------
  describe('generateChangelog (via generateDocs)', () => {
    it('generates changelog without existing one', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeTextResponse('## [1.0.0]\n### Added\n- Feature'));

      const result = await gen.generateDocs(sampleFiles, 'Proj', {
        ...defaultOptions,
        type: 'changelog',
      });

      expect(result.type).toBe('changelog');
      expect(result.title).toBe('Changelog');
    });

    it('uses existing changelog file when present', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const filesWithChangelog = [
        ...sampleFiles,
        { path: 'CHANGELOG.md', content: '## [0.9.0]\n### Fixed\n- Bug' },
      ];

      mockCreate.mockResolvedValue(makeTextResponse('## [1.0.0]\n### Changed\n- Updated'));

      await gen.generateDocs(filesWithChangelog, 'Proj', { ...defaultOptions, type: 'changelog' });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('0.9.0');
    });
  });

  // -----------------------------------------------------------------------
  // generateUserGuide
  // -----------------------------------------------------------------------
  describe('generateUserGuide (via generateDocs)', () => {
    it('generates user guide', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeTextResponse('# Guide\n\n## Getting Started\nDo things'));

      const result = await gen.generateDocs(sampleFiles, 'Proj', {
        ...defaultOptions,
        type: 'guide',
        audience: 'user',
      });

      expect(result.type).toBe('guide');
      expect(result.title).toContain('User Guide');
    });
  });

  // -----------------------------------------------------------------------
  // generateOpenAPISpec
  // -----------------------------------------------------------------------
  describe('generateOpenAPISpec (via generateDocs)', () => {
    it('extracts YAML from fenced code block', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const yamlBlock = '```yaml\nopenapi: 3.0.0\npaths: {}\n```';
      mockCreate.mockResolvedValue(makeTextResponse(yamlBlock));

      const result = await gen.generateDocs(apiRouteFiles, 'Proj', {
        ...defaultOptions,
        type: 'openapi',
      });

      expect(result.content).toContain('openapi: 3.0.0');
      expect(result.content).not.toContain('```');
    });

    it('extracts YAML from bare openapi: prefix', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const bareYaml = 'Here is the spec:\n\nopenapi: 3.0.0\ninfo:\n  title: Test';
      mockCreate.mockResolvedValue(makeTextResponse(bareYaml));

      const result = await gen.generateDocs(apiRouteFiles, 'Proj', {
        ...defaultOptions,
        type: 'openapi',
      });

      expect(result.content).toContain('openapi');
    });

    it('falls back to full text if no YAML pattern found', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const noYaml = 'Sorry, I could not generate the spec.';
      mockCreate.mockResolvedValue(makeTextResponse(noYaml));

      const result = await gen.generateDocs(apiRouteFiles, 'Proj', {
        ...defaultOptions,
        type: 'openapi',
      });

      expect(result.content).toBe(noYaml);
    });

    it('filters only API-related files', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeTextResponse('openapi: 3.0.0'));

      const mixed = [
        { path: 'app/api/users/route.ts', content: 'export async function GET() {}' },
        { path: 'src/components/Button.tsx', content: '<button/>' },
      ];

      const result = await gen.generateDocs(mixed, 'Proj', { ...defaultOptions, type: 'openapi' });

      expect(result.metadata.sourceFiles).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // extractSections (tested through generateDocs results)
  // -----------------------------------------------------------------------
  describe('extractSections (internal)', () => {
    it('parses h1, h2, h3 headers', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const md = '# Top\n\nContent\n\n## Second\n\nMore\n\n### Third\n\nDeep';
      mockCreate.mockResolvedValue(makeTextResponse(md));

      const result = await gen.generateDocs(sampleFiles, 'Proj', {
        ...defaultOptions,
        type: 'readme',
      });

      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].title).toBe('Top');
      expect(result.sections[1].title).toBe('Second');
      expect(result.sections[2].title).toBe('Third');
    });

    it('assigns incrementing order', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      const md = '# A\n\n## B\n\n## C\n\n';
      mockCreate.mockResolvedValue(makeTextResponse(md));

      const result = await gen.generateDocs(sampleFiles, 'Proj', {
        ...defaultOptions,
        type: 'readme',
      });

      expect(result.sections[0].order).toBe(0);
      expect(result.sections[1].order).toBe(1);
      expect(result.sections[2].order).toBe(2);
    });

    it('returns empty array for content with no headers', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeTextResponse('Just plain text no headers'));

      const result = await gen.generateDocs(sampleFiles, 'Proj', {
        ...defaultOptions,
        type: 'readme',
      });

      expect(result.sections).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // detectLanguages (tested through summarizeCode → readme generation)
  // -----------------------------------------------------------------------
  describe('detectLanguages (internal)', () => {
    it('detects TypeScript and JSON from file extensions', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeTextResponse('# README'));

      await gen.generateDocs(sampleFiles, 'Proj', { ...defaultOptions, type: 'readme' });

      const callArgs = mockCreate.mock.calls[0][0];
      // The code summary passed to anthropic should mention languages
      expect(callArgs.messages[0].content).toContain('TypeScript');
    });
  });

  // -----------------------------------------------------------------------
  // analyzeProjectStructure (tested through architecture docs)
  // -----------------------------------------------------------------------
  describe('analyzeProjectStructure (internal)', () => {
    it('builds directory tree from file paths', async () => {
      const { AIDocGenerator } = await import('./index');
      const gen = new AIDocGenerator();

      mockCreate.mockResolvedValue(makeTextResponse('# Architecture'));

      const deepFiles = [
        { path: 'src/lib/utils/helpers.ts', content: '' },
        { path: 'src/app/page.tsx', content: '' },
      ];

      await gen.generateDocs(deepFiles, 'Proj', { ...defaultOptions, type: 'architecture' });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('src');
      expect(callArgs.messages[0].content).toContain('src/lib');
    });
  });
});

// ---------------------------------------------------------------------------
// Exported singleton and helper functions
// ---------------------------------------------------------------------------

describe('docGenerator singleton', () => {
  it('exports a singleton instance', async () => {
    const { docGenerator, AIDocGenerator } = await import('./index');
    expect(docGenerator).toBeInstanceOf(AIDocGenerator);
  });
});

describe('generateDocs helper', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  it('uses default options (readme, markdown, standard)', async () => {
    const { generateDocs } = await import('./index');

    mockCreate.mockResolvedValue(makeTextResponse('# README'));

    const result = await generateDocs(sampleFiles, 'TestProject');

    expect(result.type).toBe('readme');
    expect(result.format).toBe('markdown');
  });

  it('accepts custom doc type', async () => {
    const { generateDocs } = await import('./index');

    // API docs don't call anthropic
    const result = await generateDocs(apiRouteFiles, 'TestProject', 'api');

    expect(result.type).toBe('api');
  });
});

describe('generateReadme helper', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  it('returns content string directly', async () => {
    const { generateReadme } = await import('./index');

    mockCreate.mockResolvedValue(makeTextResponse('# My Project\n\nAwesome stuff'));

    const content = await generateReadme(sampleFiles, 'TestProject');

    expect(typeof content).toBe('string');
    expect(content).toContain('My Project');
  });
});

describe('generateAPIReference helper', () => {
  it('returns content string for API docs', async () => {
    const { generateAPIReference } = await import('./index');

    const content = await generateAPIReference(apiRouteFiles, 'TestProject');

    expect(typeof content).toBe('string');
    expect(content).toContain('API Documentation');
  });
});
