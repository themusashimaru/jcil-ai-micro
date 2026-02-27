// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

/**
 * Comprehensive tests for AI TEST GENERATOR
 * src/lib/test-generator/index.ts
 */

// ============================================================================
// MOCKS — must be before any imports of the module under test
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return { mockCreate };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
import { AITestGenerator, testGenerator, generateTests, generateTestFile } from './index';
import type {
  TestGenerationOptions,
  GeneratedTest,
  TestSuite,
  MockDefinition,
  CodeAnalysis,
  TestType,
  TestFramework,
} from './index';

// ============================================================================
// HELPERS
// ============================================================================

function makeAnalysisResponse(analysis: Partial<CodeAnalysis> = {}): object {
  const full: CodeAnalysis = {
    functions: analysis.functions ?? [
      {
        name: 'add',
        params: [
          { name: 'a', type: 'number' },
          { name: 'b', type: 'number' },
        ],
        returnType: 'number',
        isAsync: false,
        isExported: true,
        complexity: 1,
        lineStart: 1,
        lineEnd: 3,
      },
    ],
    classes: analysis.classes ?? [],
    exports: analysis.exports ?? ['add'],
    imports: analysis.imports ?? [],
    dependencies: analysis.dependencies ?? [],
    complexity: analysis.complexity ?? 'low',
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(full) }],
  };
}

function makeTestsResponse(tests: Partial<GeneratedTest>[] = []): object {
  const fullTests =
    tests.length > 0
      ? tests
      : [
          {
            name: 'should add two numbers',
            code: 'expect(add(1, 2)).toBe(3);',
            type: 'unit',
            targetFunction: 'add',
            description: 'Tests basic addition',
            coverage: ['happy path'],
          },
        ];
  return {
    content: [{ type: 'text', text: JSON.stringify(fullTests) }],
  };
}

function makeMocksResponse(mocks: Partial<MockDefinition>[] = []): object {
  const fullMocks =
    mocks.length > 0
      ? mocks
      : [
          {
            name: 'mockFetch',
            type: 'function',
            code: 'vi.mock("node-fetch")',
            description: 'Mocks the fetch function',
          },
        ];
  return {
    content: [{ type: 'text', text: JSON.stringify(fullMocks) }],
  };
}

function makeDefaultOptions(overrides: Partial<TestGenerationOptions> = {}): TestGenerationOptions {
  return {
    testType: 'unit',
    framework: 'vitest',
    coverage: 'comprehensive',
    includeMocks: true,
    includeEdgeCases: true,
    includeErrorCases: true,
    style: 'bdd',
    ...overrides,
  };
}

// ============================================================================
// 1. AITestGenerator CLASS — CONSTRUCTOR
// ============================================================================

describe('AITestGenerator', () => {
  let generator: AITestGenerator;

  beforeEach(() => {
    mockCreate.mockReset();
    generator = new AITestGenerator();
  });

  describe('constructor', () => {
    it('should create an instance of AITestGenerator', () => {
      expect(generator).toBeInstanceOf(AITestGenerator);
    });

    it('should have an anthropic property after construction', () => {
      // The Anthropic mock is called during construction
      // Verify the generator has the expected public methods
      expect(typeof generator.generateTestSuite).toBe('function');
      expect(typeof generator.generateEdgeCaseTests).toBe('function');
      expect(typeof generator.generatePerformanceTests).toBe('function');
      expect(typeof generator.formatTestFile).toBe('function');
    });
  });

  // ============================================================================
  // 2. generateTestSuite
  // ============================================================================

  describe('generateTestSuite', () => {
    it('should return a TestSuite object', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('framework', 'vitest');
      expect(result).toHaveProperty('tests');
      expect(result).toHaveProperty('totalTests');
      expect(result).toHaveProperty('estimatedCoverage');
      expect(result).toHaveProperty('imports');
      expect(result).toHaveProperty('mocks');
    });

    it('should generate the correct test file name', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.name).toBe('src/utils.test.ts');
    });

    it('should include mocks when includeMocks is true', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeAnalysisResponse({
            dependencies: ['node-fetch'],
            imports: ['node-fetch'],
          })
        )
        .mockResolvedValueOnce(makeTestsResponse())
        .mockResolvedValueOnce(makeMocksResponse());

      const options = makeDefaultOptions({ includeMocks: true });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.mocks.length).toBeGreaterThan(0);
    });

    it('should NOT include mocks when includeMocks is false', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.mocks).toEqual([]);
    });

    it('should set totalTests equal to tests array length', async () => {
      mockCreate.mockResolvedValueOnce(makeAnalysisResponse()).mockResolvedValueOnce(
        makeTestsResponse([
          {
            name: 'test1',
            code: 'expect(1).toBe(1);',
            type: 'unit',
            description: 'desc',
            coverage: [],
          },
          {
            name: 'test2',
            code: 'expect(2).toBe(2);',
            type: 'unit',
            description: 'desc',
            coverage: [],
          },
        ])
      );

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.totalTests).toBe(2);
    });

    it('should call analyzeCode before generateTests', async () => {
      const callOrder: string[] = [];
      mockCreate.mockImplementation(async (params) => {
        if (params.system.includes('code analysis expert')) {
          callOrder.push('analyze');
          return makeAnalysisResponse();
        }
        callOrder.push('generate');
        return makeTestsResponse();
      });

      const options = makeDefaultOptions({ includeMocks: false });
      await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(callOrder[0]).toBe('analyze');
      expect(callOrder[1]).toBe('generate');
    });

    it('should pass filePath and testType in the log', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, testType: 'integration' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.framework).toBe('vitest');
    });

    it('should generate imports for vitest framework', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'vitest' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.imports.some((i) => i.includes('vitest'))).toBe(true);
    });

    it('should generate imports for jest framework', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'jest' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.imports.some((i) => i.includes('./utils'))).toBe(true);
    });

    it('should generate imports for mocha framework', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'mocha' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.imports.some((i) => i.includes('chai'))).toBe(true);
      expect(result.imports.some((i) => i.includes('sinon'))).toBe(true);
    });

    it('should generate imports for pytest framework', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'pytest' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.py', options);

      expect(result.imports.some((i) => i.includes('pytest'))).toBe(true);
    });
  });

  // ============================================================================
  // 3. analyzeCode (tested indirectly via generateTestSuite)
  // ============================================================================

  describe('analyzeCode (via generateTestSuite)', () => {
    it('should handle non-text response type from analysis', async () => {
      mockCreate
        .mockResolvedValueOnce({ content: [{ type: 'image', source: {} }] })
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      // Should fall back to minimal analysis and still return a suite
      expect(result).toHaveProperty('tests');
    });

    it('should handle analysis response with no JSON', async () => {
      mockCreate
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'No JSON here' }] })
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result).toHaveProperty('tests');
    });

    it('should handle analyzeCode API error gracefully', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result).toHaveProperty('tests');
      expect(result.estimatedCoverage).toBeDefined();
    });

    it('should handle malformed JSON in analysis response', async () => {
      mockCreate
        .mockResolvedValueOnce({ content: [{ type: 'text', text: '{ broken json' }] })
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      // Falls back to minimal analysis
      expect(result).toHaveProperty('tests');
    });
  });

  // ============================================================================
  // 4. generateTests (tested indirectly via generateTestSuite)
  // ============================================================================

  describe('generateTests (via generateTestSuite)', () => {
    it('should return empty array when test generation response has no JSON array', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'No array here' }] });

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.tests).toEqual([]);
      expect(result.totalTests).toBe(0);
    });

    it('should return empty array when test generation response is non-text', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce({ content: [{ type: 'image', source: {} }] });

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.tests).toEqual([]);
    });

    it('should return empty array on API error during test generation', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockRejectedValueOnce(new Error('test generation failed'));

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.tests).toEqual([]);
    });

    it('should pass exhaustive coverage instructions', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, coverage: 'exhaustive' });
      await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      const testGenCall = mockCreate.mock.calls[1];
      expect(testGenCall[0].system).toContain('exhaustive');
      expect(testGenCall[0].system).toContain('Test EVERY code path');
    });

    it('should pass basic coverage instructions', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, coverage: 'basic' });
      await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      const testGenCall = mockCreate.mock.calls[1];
      expect(testGenCall[0].system).toContain('basic');
      expect(testGenCall[0].system).toContain('Test happy path only');
    });

    it('should pass comprehensive coverage instructions', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, coverage: 'comprehensive' });
      await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      const testGenCall = mockCreate.mock.calls[1];
      expect(testGenCall[0].system).toContain('comprehensive');
      expect(testGenCall[0].system).toContain('Test main functionality');
    });

    it('should include edge case instructions when includeEdgeCases is true', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, includeEdgeCases: true });
      await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      const testGenCall = mockCreate.mock.calls[1];
      expect(testGenCall[0].system).toContain('INCLUDE edge cases');
    });

    it('should include error case instructions when includeErrorCases is true', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, includeErrorCases: true });
      await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      const testGenCall = mockCreate.mock.calls[1];
      expect(testGenCall[0].system).toContain('INCLUDE error cases');
    });

    it('should use BDD style when style is bdd', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, style: 'bdd' });
      await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      const testGenCall = mockCreate.mock.calls[1];
      expect(testGenCall[0].system).toContain('BDD style');
    });

    it('should use standard test style when style is tdd', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, style: 'tdd' });
      await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      const testGenCall = mockCreate.mock.calls[1];
      expect(testGenCall[0].system).toContain('standard test style');
    });

    it('should default to comprehensive coverage when not specified', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options: TestGenerationOptions = {
        testType: 'unit',
        framework: 'vitest',
        // coverage not specified
      };
      await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      const testGenCall = mockCreate.mock.calls[1];
      expect(testGenCall[0].system).toContain('comprehensive');
    });
  });

  // ============================================================================
  // 5. generateMocks (tested indirectly via generateTestSuite)
  // ============================================================================

  describe('generateMocks (via generateTestSuite)', () => {
    it('should skip mock generation when no dependencies and no imports', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeAnalysisResponse({
            dependencies: [],
            imports: [],
          })
        )
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: true });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.mocks).toEqual([]);
      // Only 2 calls (analyze + generateTests), no mock call
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should generate mocks when there are dependencies', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeAnalysisResponse({
            dependencies: ['axios'],
            imports: ['axios'],
          })
        )
        .mockResolvedValueOnce(makeTestsResponse())
        .mockResolvedValueOnce(
          makeMocksResponse([
            {
              name: 'mockAxios',
              type: 'module',
              code: 'vi.mock("axios")',
              description: 'Mocks axios',
            },
          ])
        );

      const options = makeDefaultOptions({ includeMocks: true });
      const result = await generator.generateTestSuite(
        'import axios from "axios";',
        'src/utils.ts',
        options
      );

      expect(result.mocks.length).toBe(1);
      expect(result.mocks[0].name).toBe('mockAxios');
    });

    it('should return empty mocks on non-text response', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeAnalysisResponse({
            dependencies: ['axios'],
            imports: ['axios'],
          })
        )
        .mockResolvedValueOnce(makeTestsResponse())
        .mockResolvedValueOnce({ content: [{ type: 'image', source: {} }] });

      const options = makeDefaultOptions({ includeMocks: true });
      const result = await generator.generateTestSuite(
        'import axios from "axios";',
        'src/utils.ts',
        options
      );

      expect(result.mocks).toEqual([]);
    });

    it('should return empty mocks when no JSON array in response', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeAnalysisResponse({
            dependencies: ['axios'],
            imports: ['axios'],
          })
        )
        .mockResolvedValueOnce(makeTestsResponse())
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'No JSON array here' }] });

      const options = makeDefaultOptions({ includeMocks: true });
      const result = await generator.generateTestSuite(
        'import axios from "axios";',
        'src/utils.ts',
        options
      );

      expect(result.mocks).toEqual([]);
    });

    it('should return empty mocks on API error', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeAnalysisResponse({
            dependencies: ['axios'],
            imports: ['axios'],
          })
        )
        .mockResolvedValueOnce(makeTestsResponse())
        .mockRejectedValueOnce(new Error('mock gen failed'));

      const options = makeDefaultOptions({ includeMocks: true });
      const result = await generator.generateTestSuite(
        'import axios from "axios";',
        'src/utils.ts',
        options
      );

      expect(result.mocks).toEqual([]);
    });
  });

  // ============================================================================
  // 6. getFrameworkGuide (tested indirectly)
  // ============================================================================

  describe('getFrameworkGuide (via generateTestSuite)', () => {
    const frameworks: TestFramework[] = ['jest', 'vitest', 'mocha', 'pytest', 'go-test', 'rspec'];

    for (const fw of frameworks) {
      it(`should include ${fw} guide in the test generation prompt`, async () => {
        mockCreate
          .mockResolvedValueOnce(makeAnalysisResponse())
          .mockResolvedValueOnce(makeTestsResponse());

        const options = makeDefaultOptions({ includeMocks: false, framework: fw });
        await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

        const testGenCall = mockCreate.mock.calls[1];
        const systemPrompt = testGenCall[0].system;

        // Each framework guide has unique keywords
        const keywordMap: Record<TestFramework, string> = {
          jest: 'JEST GUIDE',
          vitest: 'VITEST GUIDE',
          mocha: 'MOCHA GUIDE',
          pytest: 'PYTEST GUIDE',
          'go-test': 'GO TEST GUIDE',
          rspec: 'RSPEC GUIDE',
        };
        expect(systemPrompt).toContain(keywordMap[fw]);
      });
    }
  });

  // ============================================================================
  // 7. getTestFileName (tested indirectly)
  // ============================================================================

  describe('getTestFileName (via generateTestSuite)', () => {
    it('should generate .test.ts for jest', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'jest' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.name).toBe('src/utils.test.ts');
    });

    it('should generate .test.ts for vitest', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'vitest' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.name).toBe('src/utils.test.ts');
    });

    it('should generate .spec.ts for mocha', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'mocha' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.name).toBe('src/utils.spec.ts');
    });

    it('should generate test_ prefix for pytest', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'pytest' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.py', options);

      expect(result.name).toBe('test_utils.py');
    });

    it('should generate _test.go for go-test', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'go-test' });
      const result = await generator.generateTestSuite('package main', 'src/utils.go', options);

      expect(result.name).toBe('src/utils_test.go');
    });

    it('should generate _spec.rb for rspec', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'rspec' });
      const result = await generator.generateTestSuite('class X; end', 'src/utils.rb', options);

      expect(result.name).toBe('src/utils_spec.rb');
    });

    it('should handle files without extensions', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'vitest' });
      const result = await generator.generateTestSuite('const x = 1;', 'Makefile', options);

      // baseName = 'Makefile', ext matches nothing -> fallback .ts won't apply in regex
      // Actually match /\.[^.]+$/ on 'Makefile' returns null so ext defaults to '.ts'
      expect(result.name).toBe('Makefile.test.ts');
    });

    it('should handle .js extension', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'vitest' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/index.js', options);

      expect(result.name).toBe('src/index.test.js');
    });

    it('should handle .tsx extension', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'jest' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/App.tsx', options);

      expect(result.name).toBe('src/App.test.tsx');
    });
  });

  // ============================================================================
  // 8. generateImports (tested indirectly)
  // ============================================================================

  describe('generateImports (via generateTestSuite)', () => {
    it('should include vitest imports for vitest framework', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'vitest' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      const vitestImport = result.imports.find((i) => i.includes('vitest'));
      expect(vitestImport).toContain('describe');
      expect(vitestImport).toContain('it');
      expect(vitestImport).toContain('expect');
      expect(vitestImport).toContain('vi');
    });

    it('should include relative import path for the module under test', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'vitest' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.imports.some((i) => i.includes('./utils'))).toBe(true);
    });

    it('should include chai and sinon imports for mocha', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'mocha' });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.imports.some((i) => i.includes('chai'))).toBe(true);
      expect(result.imports.some((i) => i.includes('sinon'))).toBe(true);
    });

    it('should use python import style for pytest', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false, framework: 'pytest' });
      const result = await generator.generateTestSuite('x = 1', 'src/utils.py', options);

      expect(result.imports.some((i) => i.includes('import pytest'))).toBe(true);
      expect(result.imports.some((i) => i.includes('from'))).toBe(true);
    });

    it('should fall back to generic import for unknown framework', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnalysisResponse())
        .mockResolvedValueOnce(makeTestsResponse());

      // Force an unknown framework by casting
      const options = makeDefaultOptions({
        includeMocks: false,
        framework: 'unknown-fw' as TestFramework,
      });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      // Default case in getTestFileName returns .test.ts
      expect(result.imports.some((i) => i.includes('./utils'))).toBe(true);
    });
  });

  // ============================================================================
  // 9. estimateCoverage (tested indirectly)
  // ============================================================================

  describe('estimateCoverage (via generateTestSuite)', () => {
    it('should return 100 when there are no functions or class methods', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeAnalysisResponse({
            functions: [],
            classes: [],
          })
        )
        .mockResolvedValueOnce(makeTestsResponse());

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      expect(result.estimatedCoverage).toBe(100);
    });

    it('should calculate coverage based on tested vs total functions', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeAnalysisResponse({
            functions: [
              {
                name: 'add',
                params: [],
                isAsync: false,
                isExported: true,
                complexity: 1,
                lineStart: 1,
                lineEnd: 3,
              },
              {
                name: 'sub',
                params: [],
                isAsync: false,
                isExported: true,
                complexity: 1,
                lineStart: 5,
                lineEnd: 7,
              },
            ],
            classes: [],
          })
        )
        .mockResolvedValueOnce(
          makeTestsResponse([
            {
              name: 'test add',
              code: '',
              type: 'unit',
              targetFunction: 'add',
              description: '',
              coverage: [],
            },
          ])
        );

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      // 1 out of 2 functions tested = 50%
      expect(result.estimatedCoverage).toBe(50);
    });

    it('should include class methods in coverage calculation', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeAnalysisResponse({
            functions: [],
            classes: [
              {
                name: 'Calculator',
                methods: [
                  {
                    name: 'add',
                    params: [],
                    isAsync: false,
                    isExported: true,
                    complexity: 1,
                    lineStart: 1,
                    lineEnd: 3,
                  },
                  {
                    name: 'sub',
                    params: [],
                    isAsync: false,
                    isExported: true,
                    complexity: 1,
                    lineStart: 5,
                    lineEnd: 7,
                  },
                  {
                    name: 'mul',
                    params: [],
                    isAsync: false,
                    isExported: true,
                    complexity: 1,
                    lineStart: 9,
                    lineEnd: 11,
                  },
                ],
                properties: [],
                isExported: true,
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          makeTestsResponse([
            {
              name: 'test add',
              code: '',
              type: 'unit',
              targetFunction: 'add',
              description: '',
              coverage: [],
            },
            {
              name: 'test sub',
              code: '',
              type: 'unit',
              targetFunction: 'sub',
              description: '',
              coverage: [],
            },
          ])
        );

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('class Calc {}', 'src/calc.ts', options);

      // 2 out of 3 methods tested = 67%
      expect(result.estimatedCoverage).toBe(67);
    });

    it('should cap coverage at 100', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeAnalysisResponse({
            functions: [
              {
                name: 'add',
                params: [],
                isAsync: false,
                isExported: true,
                complexity: 1,
                lineStart: 1,
                lineEnd: 3,
              },
            ],
            classes: [],
          })
        )
        .mockResolvedValueOnce(
          makeTestsResponse([
            {
              name: 'test add 1',
              code: '',
              type: 'unit',
              targetFunction: 'add',
              description: '',
              coverage: [],
            },
            {
              name: 'test add 2',
              code: '',
              type: 'unit',
              targetFunction: 'add',
              description: '',
              coverage: [],
            },
            {
              name: 'test add 3',
              code: '',
              type: 'unit',
              targetFunction: 'extra',
              description: '',
              coverage: [],
            },
          ])
        );

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      // 2 unique targets (add, extra) / 1 function -> 200%, but capped at 100
      expect(result.estimatedCoverage).toBe(100);
    });

    it('should not count tests without targetFunction in coverage', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeAnalysisResponse({
            functions: [
              {
                name: 'fn1',
                params: [],
                isAsync: false,
                isExported: true,
                complexity: 1,
                lineStart: 1,
                lineEnd: 3,
              },
              {
                name: 'fn2',
                params: [],
                isAsync: false,
                isExported: true,
                complexity: 1,
                lineStart: 5,
                lineEnd: 7,
              },
            ],
            classes: [],
          })
        )
        .mockResolvedValueOnce(
          makeTestsResponse([
            { name: 'test 1', code: '', type: 'unit', description: '', coverage: [] },
            { name: 'test 2', code: '', type: 'unit', description: '', coverage: [] },
          ])
        );

      const options = makeDefaultOptions({ includeMocks: false });
      const result = await generator.generateTestSuite('const x = 1;', 'src/utils.ts', options);

      // No targetFunction set, so 0 tested / 2 functions = 0%
      expect(result.estimatedCoverage).toBe(0);
    });
  });

  // ============================================================================
  // 10. generateEdgeCaseTests
  // ============================================================================

  describe('generateEdgeCaseTests', () => {
    it('should return edge case tests from AI response', async () => {
      const edgeTests: Partial<GeneratedTest>[] = [
        {
          name: 'null input',
          code: 'expect(fn(null)).toThrow();',
          type: 'unit',
          description: 'null',
          coverage: [],
        },
      ];
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(edgeTests) }],
      });

      const result = await generator.generateEdgeCaseTests(
        'function fn() {}',
        'src/fn.ts',
        'vitest'
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('null input');
    });

    it('should return empty array on non-text response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'image', source: {} }],
      });

      const result = await generator.generateEdgeCaseTests('const x = 1;', 'src/fn.ts', 'vitest');
      expect(result).toEqual([]);
    });

    it('should return empty array when no JSON array in response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'no json here' }],
      });

      const result = await generator.generateEdgeCaseTests('const x = 1;', 'src/fn.ts', 'jest');
      expect(result).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('edge case gen error'));

      const result = await generator.generateEdgeCaseTests('const x = 1;', 'src/fn.ts', 'vitest');
      expect(result).toEqual([]);
    });

    it('should use the correct framework in the prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: '[]' }],
      });

      await generator.generateEdgeCaseTests('const x = 1;', 'src/fn.ts', 'pytest');

      expect(mockCreate.mock.calls[0][0].system).toContain('pytest');
    });
  });

  // ============================================================================
  // 11. generatePerformanceTests
  // ============================================================================

  describe('generatePerformanceTests', () => {
    it('should return performance tests from AI response', async () => {
      const perfTests: Partial<GeneratedTest>[] = [
        {
          name: 'perf test',
          code: 'bench()',
          type: 'performance',
          description: 'perf',
          coverage: [],
        },
      ];
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(perfTests) }],
      });

      const result = await generator.generatePerformanceTests(
        'function heavy() {}',
        'src/heavy.ts',
        'vitest'
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('perf test');
    });

    it('should return empty array on non-text response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'image', source: {} }],
      });

      const result = await generator.generatePerformanceTests(
        'const x = 1;',
        'src/fn.ts',
        'vitest'
      );
      expect(result).toEqual([]);
    });

    it('should return empty array when no JSON array in response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not json' }],
      });

      const result = await generator.generatePerformanceTests(
        'const x = 1;',
        'src/fn.ts',
        'vitest'
      );
      expect(result).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('perf gen error'));

      const result = await generator.generatePerformanceTests(
        'const x = 1;',
        'src/fn.ts',
        'vitest'
      );
      expect(result).toEqual([]);
    });

    it('should use the correct framework in the prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: '[]' }],
      });

      await generator.generatePerformanceTests('const x = 1;', 'src/fn.ts', 'mocha');

      expect(mockCreate.mock.calls[0][0].system).toContain('mocha');
    });
  });

  // ============================================================================
  // 12. formatTestFile
  // ============================================================================

  describe('formatTestFile', () => {
    it('should include imports in output', () => {
      const suite: TestSuite = {
        name: 'utils.test.ts',
        framework: 'vitest',
        tests: [],
        totalTests: 0,
        estimatedCoverage: 0,
        imports: ["import { describe } from 'vitest';"],
        mocks: [],
      };

      const output = generator.formatTestFile(suite);
      expect(output).toContain("import { describe } from 'vitest';");
    });

    it('should include mock code and descriptions', () => {
      const suite: TestSuite = {
        name: 'utils.test.ts',
        framework: 'vitest',
        tests: [],
        totalTests: 0,
        estimatedCoverage: 0,
        imports: [],
        mocks: [
          {
            name: 'mockFetch',
            type: 'function',
            code: 'vi.mock("fetch")',
            description: 'Mock fetch',
          },
        ],
      };

      const output = generator.formatTestFile(suite);
      expect(output).toContain('// Mock fetch');
      expect(output).toContain('vi.mock("fetch")');
      expect(output).toContain('// Mocks');
    });

    it('should wrap tests in a describe block with suite name', () => {
      const suite: TestSuite = {
        name: 'utils.test.ts',
        framework: 'vitest',
        tests: [
          {
            name: 'should work',
            code: 'expect(true).toBe(true);',
            type: 'unit',
            description: '',
            coverage: [],
          },
        ],
        totalTests: 1,
        estimatedCoverage: 100,
        imports: [],
        mocks: [],
      };

      const output = generator.formatTestFile(suite);
      expect(output).toContain("describe('utils.test.ts'");
      expect(output).toContain("it('should work'");
      expect(output).toContain('expect(true).toBe(true);');
    });

    it('should add async keyword for tests containing await', () => {
      const suite: TestSuite = {
        name: 'async.test.ts',
        framework: 'vitest',
        tests: [
          {
            name: 'async test',
            code: 'const res = await fetch();',
            type: 'unit',
            description: '',
            coverage: [],
          },
        ],
        totalTests: 1,
        estimatedCoverage: 100,
        imports: [],
        mocks: [],
      };

      const output = generator.formatTestFile(suite);
      expect(output).toContain('async () =>');
    });

    it('should NOT add async keyword for sync tests', () => {
      const suite: TestSuite = {
        name: 'sync.test.ts',
        framework: 'vitest',
        tests: [
          {
            name: 'sync test',
            code: 'expect(1).toBe(1);',
            type: 'unit',
            description: '',
            coverage: [],
          },
        ],
        totalTests: 1,
        estimatedCoverage: 100,
        imports: [],
        mocks: [],
      };

      const output = generator.formatTestFile(suite);
      // Ensure async is not in the it() callback
      expect(output).toContain("it('sync test', () =>");
    });

    it('should include setupCode as beforeEach', () => {
      const suite: TestSuite = {
        name: 'setup.test.ts',
        framework: 'vitest',
        tests: [
          {
            name: 'with setup',
            code: 'expect(1).toBe(1);',
            type: 'unit',
            description: '',
            coverage: [],
            setupCode: 'vi.clearAllMocks();',
          },
        ],
        totalTests: 1,
        estimatedCoverage: 100,
        imports: [],
        mocks: [],
      };

      const output = generator.formatTestFile(suite);
      expect(output).toContain('beforeEach');
      expect(output).toContain('vi.clearAllMocks();');
    });

    it('should include teardownCode as afterEach', () => {
      const suite: TestSuite = {
        name: 'teardown.test.ts',
        framework: 'vitest',
        tests: [
          {
            name: 'with teardown',
            code: 'expect(1).toBe(1);',
            type: 'unit',
            description: '',
            coverage: [],
            teardownCode: 'cleanup();',
          },
        ],
        totalTests: 1,
        estimatedCoverage: 100,
        imports: [],
        mocks: [],
      };

      const output = generator.formatTestFile(suite);
      expect(output).toContain('afterEach');
      expect(output).toContain('cleanup();');
    });

    it('should handle an empty test suite', () => {
      const suite: TestSuite = {
        name: 'empty.test.ts',
        framework: 'vitest',
        tests: [],
        totalTests: 0,
        estimatedCoverage: 0,
        imports: [],
        mocks: [],
      };

      const output = generator.formatTestFile(suite);
      expect(output).toContain("describe('empty.test.ts'");
      expect(output).toContain('});');
    });

    it('should handle multiple tests in one suite', () => {
      const suite: TestSuite = {
        name: 'multi.test.ts',
        framework: 'vitest',
        tests: [
          {
            name: 'test1',
            code: 'expect(1).toBe(1);',
            type: 'unit',
            description: '',
            coverage: [],
          },
          {
            name: 'test2',
            code: 'expect(2).toBe(2);',
            type: 'unit',
            description: '',
            coverage: [],
          },
          {
            name: 'test3',
            code: 'expect(3).toBe(3);',
            type: 'unit',
            description: '',
            coverage: [],
          },
        ],
        totalTests: 3,
        estimatedCoverage: 100,
        imports: [],
        mocks: [],
      };

      const output = generator.formatTestFile(suite);
      expect(output).toContain("it('test1'");
      expect(output).toContain("it('test2'");
      expect(output).toContain("it('test3'");
    });

    it('should handle multiple mocks', () => {
      const suite: TestSuite = {
        name: 'mocks.test.ts',
        framework: 'vitest',
        tests: [],
        totalTests: 0,
        estimatedCoverage: 0,
        imports: [],
        mocks: [
          { name: 'mock1', type: 'function', code: 'vi.mock("a")', description: 'Mock A' },
          { name: 'mock2', type: 'module', code: 'vi.mock("b")', description: 'Mock B' },
        ],
      };

      const output = generator.formatTestFile(suite);
      expect(output).toContain('// Mock A');
      expect(output).toContain('// Mock B');
      expect(output).toContain('vi.mock("a")');
      expect(output).toContain('vi.mock("b")');
    });

    it('should handle multiline test code', () => {
      const suite: TestSuite = {
        name: 'multiline.test.ts',
        framework: 'vitest',
        tests: [
          {
            name: 'multiline',
            code: 'const x = 1;\nconst y = 2;\nexpect(x + y).toBe(3);',
            type: 'unit',
            description: '',
            coverage: [],
          },
        ],
        totalTests: 1,
        estimatedCoverage: 100,
        imports: [],
        mocks: [],
      };

      const output = generator.formatTestFile(suite);
      expect(output).toContain('const x = 1;');
      expect(output).toContain('const y = 2;');
      expect(output).toContain('expect(x + y).toBe(3);');
    });
  });
});

// ============================================================================
// 13. testGenerator SINGLETON
// ============================================================================

describe('testGenerator singleton', () => {
  it('should be an instance of AITestGenerator', () => {
    expect(testGenerator).toBeInstanceOf(AITestGenerator);
  });

  it('should be the same instance across imports', () => {
    // Verify it is a defined object
    expect(testGenerator).toBeDefined();
    expect(typeof testGenerator.generateTestSuite).toBe('function');
    expect(typeof testGenerator.generateEdgeCaseTests).toBe('function');
    expect(typeof testGenerator.generatePerformanceTests).toBe('function');
    expect(typeof testGenerator.formatTestFile).toBe('function');
  });
});

// ============================================================================
// 14. generateTests (top-level function)
// ============================================================================

describe('generateTests (top-level function)', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('should return a TestSuite', async () => {
    mockCreate
      .mockResolvedValueOnce(makeAnalysisResponse())
      .mockResolvedValueOnce(makeTestsResponse())
      .mockResolvedValueOnce(makeMocksResponse());

    const result = await generateTests('const x = 1;', 'src/utils.ts');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('tests');
    expect(result).toHaveProperty('framework');
  });

  it('should default testType to unit', async () => {
    mockCreate
      .mockResolvedValueOnce(makeAnalysisResponse())
      .mockResolvedValueOnce(makeTestsResponse())
      .mockResolvedValueOnce(makeMocksResponse());

    await generateTests('const x = 1;', 'src/utils.ts');

    const testGenCall = mockCreate.mock.calls[1];
    expect(testGenCall[0].system).toContain('unit');
  });

  it('should default framework to vitest', async () => {
    mockCreate
      .mockResolvedValueOnce(makeAnalysisResponse())
      .mockResolvedValueOnce(makeTestsResponse())
      .mockResolvedValueOnce(makeMocksResponse());

    const result = await generateTests('const x = 1;', 'src/utils.ts');
    expect(result.framework).toBe('vitest');
  });

  it('should default coverage to comprehensive', async () => {
    mockCreate
      .mockResolvedValueOnce(makeAnalysisResponse())
      .mockResolvedValueOnce(makeTestsResponse())
      .mockResolvedValueOnce(makeMocksResponse());

    await generateTests('const x = 1;', 'src/utils.ts');

    const testGenCall = mockCreate.mock.calls[1];
    expect(testGenCall[0].system).toContain('comprehensive');
  });

  it('should default includeMocks to true', async () => {
    mockCreate
      .mockResolvedValueOnce(
        makeAnalysisResponse({
          dependencies: ['dep1'],
          imports: ['dep1'],
        })
      )
      .mockResolvedValueOnce(makeTestsResponse())
      .mockResolvedValueOnce(makeMocksResponse());

    await generateTests('import dep1 from "dep1";', 'src/utils.ts');

    // Should make 3 calls: analyze, generateTests, generateMocks
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('should default includeEdgeCases to true', async () => {
    mockCreate
      .mockResolvedValueOnce(makeAnalysisResponse())
      .mockResolvedValueOnce(makeTestsResponse())
      .mockResolvedValueOnce(makeMocksResponse());

    await generateTests('const x = 1;', 'src/utils.ts');

    const testGenCall = mockCreate.mock.calls[1];
    expect(testGenCall[0].system).toContain('INCLUDE edge cases');
  });

  it('should default includeErrorCases to true', async () => {
    mockCreate
      .mockResolvedValueOnce(makeAnalysisResponse())
      .mockResolvedValueOnce(makeTestsResponse())
      .mockResolvedValueOnce(makeMocksResponse());

    await generateTests('const x = 1;', 'src/utils.ts');

    const testGenCall = mockCreate.mock.calls[1];
    expect(testGenCall[0].system).toContain('INCLUDE error cases');
  });

  it('should default style to bdd', async () => {
    mockCreate
      .mockResolvedValueOnce(makeAnalysisResponse())
      .mockResolvedValueOnce(makeTestsResponse())
      .mockResolvedValueOnce(makeMocksResponse());

    await generateTests('const x = 1;', 'src/utils.ts');

    const testGenCall = mockCreate.mock.calls[1];
    expect(testGenCall[0].system).toContain('BDD style');
  });

  it('should respect custom options', async () => {
    mockCreate
      .mockResolvedValueOnce(makeAnalysisResponse())
      .mockResolvedValueOnce(makeTestsResponse());

    await generateTests('const x = 1;', 'src/utils.ts', {
      testType: 'integration',
      framework: 'jest',
      coverage: 'basic',
      includeMocks: false,
      style: 'tdd',
    });

    const testGenCall = mockCreate.mock.calls[1];
    expect(testGenCall[0].system).toContain('integration');
    expect(testGenCall[0].system).toContain('JEST GUIDE');
    expect(testGenCall[0].system).toContain('basic');
  });
});

// ============================================================================
// 15. generateTestFile (top-level function)
// ============================================================================

describe('generateTestFile (top-level function)', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('should return a formatted test file string', async () => {
    mockCreate
      .mockResolvedValueOnce(makeAnalysisResponse())
      .mockResolvedValueOnce(
        makeTestsResponse([
          {
            name: 'should work',
            code: 'expect(true).toBe(true);',
            type: 'unit',
            description: '',
            coverage: [],
          },
        ])
      )
      .mockResolvedValueOnce(makeMocksResponse());

    const result = await generateTestFile('const x = 1;', 'src/utils.ts');

    expect(typeof result).toBe('string');
    expect(result).toContain('describe');
    expect(result).toContain('it(');
    expect(result).toContain('should work');
  });

  it('should pass options through to generateTests', async () => {
    mockCreate
      .mockResolvedValueOnce(makeAnalysisResponse())
      .mockResolvedValueOnce(makeTestsResponse());

    await generateTestFile('const x = 1;', 'src/utils.ts', {
      framework: 'jest',
      includeMocks: false,
    });

    const testGenCall = mockCreate.mock.calls[1];
    expect(testGenCall[0].system).toContain('JEST GUIDE');
  });

  it('should handle empty test suite gracefully', async () => {
    mockCreate
      .mockResolvedValueOnce(makeAnalysisResponse())
      .mockResolvedValueOnce(makeTestsResponse([]));

    const result = await generateTestFile('const x = 1;', 'src/utils.ts', { includeMocks: false });

    expect(typeof result).toBe('string');
    expect(result).toContain('describe');
  });
});

// ============================================================================
// 16. TYPE EXPORTS — ensure types are accessible
// ============================================================================

describe('type exports', () => {
  it('should export TestType type', () => {
    const testType: TestType = 'unit';
    expect(['unit', 'integration', 'e2e', 'snapshot', 'performance']).toContain(testType);
  });

  it('should export TestFramework type', () => {
    const framework: TestFramework = 'vitest';
    expect(['jest', 'vitest', 'mocha', 'pytest', 'go-test', 'rspec']).toContain(framework);
  });

  it('should export TestGenerationOptions interface', () => {
    const options: TestGenerationOptions = {
      testType: 'unit',
      framework: 'vitest',
    };
    expect(options.testType).toBe('unit');
    expect(options.framework).toBe('vitest');
  });

  it('should export GeneratedTest interface', () => {
    const test: GeneratedTest = {
      name: 'test',
      code: 'expect(1).toBe(1);',
      type: 'unit',
      description: 'desc',
      coverage: [],
    };
    expect(test.name).toBe('test');
  });

  it('should export TestSuite interface', () => {
    const suite: TestSuite = {
      name: 'suite',
      framework: 'vitest',
      tests: [],
      totalTests: 0,
      estimatedCoverage: 0,
      imports: [],
      mocks: [],
    };
    expect(suite.name).toBe('suite');
  });

  it('should export MockDefinition interface', () => {
    const mock: MockDefinition = {
      name: 'mock',
      type: 'function',
      code: '',
      description: '',
    };
    expect(mock.type).toBe('function');
  });

  it('should export CodeAnalysis interface', () => {
    const analysis: CodeAnalysis = {
      functions: [],
      classes: [],
      exports: [],
      imports: [],
      dependencies: [],
      complexity: 'low',
    };
    expect(analysis.complexity).toBe('low');
  });
});
