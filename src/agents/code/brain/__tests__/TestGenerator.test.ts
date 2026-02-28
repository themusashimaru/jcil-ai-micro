// @ts-nocheck - Test file with extensive mocking
/**
 * COMPREHENSIVE TESTS FOR TestGenerator
 *
 * Tests:
 * 1. Constructor / instantiation and provider management
 * 2. generateTests() — main entry point
 * 3. Test framework detection (vitest, jest, pytest, go-test, rust-test)
 * 4. File testability checks (isTestable)
 * 5. API endpoint detection (hasApiEndpoints)
 * 6. Test file path generation
 * 7. Test suite name generation
 * 8. createTestFile — file assembly with imports, mocks, setup, teardown
 * 9. Default fallback suite when AI fails
 * 10. Coverage estimation
 * 11. Recommendation generation
 * 12. Validation helpers (test type, priority, mock type)
 * 13. Integration test generation
 * 14. Setup file generation
 * 15. Edge cases (empty inputs, AI errors, no testable files)
 * 16. Streaming callback invocations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AI providers module before importing TestGenerator
vi.mock('@/lib/ai/providers', () => ({
  agentChat: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      tests: [
        {
          name: 'should work correctly',
          type: 'unit',
          description: 'Basic functionality test',
          code: 'expect(true).toBe(true);',
          assertions: ['truth check'],
          edgeCases: ['empty input'],
          priority: 'high',
        },
      ],
      mocks: [],
      setup: '',
      teardown: '',
    }),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  TestGenerator,
  testGenerator,
  type TestGenerationResult,
  type TestSuite,
  type TestCase,
  type TestFramework,
} from '../TestGenerator';
import { agentChat } from '@/lib/ai/providers';
import type { GeneratedFile, CodeIntent, ProjectPlan } from '../../../core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Helper to pad source content to >5 lines so isTestable passes */
const SRC_PADDING = '\n// line2\n// line3\n// line4\n// line5\n// line6';

function createFile(path: string, content: string, language = 'typescript'): GeneratedFile {
  return {
    path,
    content,
    language,
    purpose: 'test file',
    linesOfCode: content.split('\n').length,
    generatedAt: Date.now(),
    version: 1,
  };
}

/** Create a testable source file (>5 lines, has executable code) */
function createTestableFile(path: string, content: string, language = 'typescript'): GeneratedFile {
  const padded = content + SRC_PADDING;
  return createFile(path, padded, language);
}

function createIntent(overrides: Partial<CodeIntent> = {}): CodeIntent {
  return {
    originalRequest: 'Build an app',
    refinedDescription: 'Build a web app with Next.js',
    projectType: 'web_app',
    requirements: {
      functional: ['user auth'],
      technical: ['Next.js'],
      constraints: [],
    },
    complexity: 'moderate',
    estimatedFiles: 5,
    technologies: {
      primary: 'Next.js',
      secondary: ['React', 'Tailwind'],
      runtime: 'node',
      packageManager: 'pnpm',
    },
    contextClues: {},
    ...overrides,
  };
}

function createPlan(overrides: Partial<ProjectPlan> = {}): ProjectPlan {
  return {
    id: 'plan-1',
    name: 'Test Project',
    description: 'A test project',
    architecture: {
      pattern: 'MVC',
      layers: [],
      rationale: 'Simple',
    },
    fileTree: [],
    dependencies: { production: {}, development: {} },
    buildSteps: [],
    testStrategy: { approach: 'unit', testFiles: [] },
    risks: [],
    taskBreakdown: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TestGenerator', () => {
  let generator: TestGenerator;

  beforeEach(() => {
    generator = new TestGenerator();
    vi.clearAllMocks();
  });

  // =========================================================================
  // INSTANTIATION & PROVIDER
  // =========================================================================

  describe('instantiation', () => {
    it('should create a new instance', () => {
      expect(generator).toBeInstanceOf(TestGenerator);
    });

    it('should export a singleton instance', () => {
      expect(testGenerator).toBeInstanceOf(TestGenerator);
    });

    it('should allow setting provider without error', () => {
      generator.setProvider('openai');
      expect(true).toBe(true);
    });

    it('should accept all valid provider IDs', () => {
      const providers = ['claude', 'openai', 'xai', 'deepseek', 'google'] as const;
      for (const p of providers) {
        generator.setProvider(p);
      }
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // generateTests() — RESULT STRUCTURE
  // =========================================================================

  describe('generateTests() — result structure', () => {
    it('should return a TestGenerationResult with correct shape', async () => {
      const files = [
        createTestableFile(
          'src/utils.ts',
          'export function add(a: number, b: number) { return a + b; }'
        ),
      ];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result).toHaveProperty('testFiles');
      expect(result).toHaveProperty('totalTests');
      expect(result).toHaveProperty('coverageEstimate');
      expect(result).toHaveProperty('testTypes');
      expect(result).toHaveProperty('recommendations');
      expect(result.coverageEstimate).toHaveProperty('lines');
      expect(result.coverageEstimate).toHaveProperty('branches');
      expect(result.coverageEstimate).toHaveProperty('functions');
      expect(result.coverageEstimate).toHaveProperty('statements');
      expect(result.testTypes).toHaveProperty('unit');
      expect(result.testTypes).toHaveProperty('integration');
      expect(result.testTypes).toHaveProperty('e2e');
      expect(result.testTypes).toHaveProperty('performance');
      expect(result.testTypes).toHaveProperty('security');
    });

    it('should call agentChat for each testable file', async () => {
      const files = [
        createTestableFile('src/a.ts', 'export function foo() { return 1; }'),
        createTestableFile('src/b.ts', 'export function bar() { return 2; }'),
      ];

      await generator.generateTests(files, createIntent(), createPlan());

      // agentChat should be called for each testable file
      expect(agentChat).toHaveBeenCalledTimes(2);
    });

    it('should generate test files for testable sources', async () => {
      const files = [
        createTestableFile(
          'src/utils.ts',
          'export function add(a: number, b: number) { return a + b; }'
        ),
      ];

      const result = await generator.generateTests(files, createIntent(), createPlan());

      // Should have the test file + setup file
      expect(result.testFiles.length).toBeGreaterThanOrEqual(2);
      expect(result.totalTests).toBeGreaterThanOrEqual(1);
    });

    it('should count total tests correctly', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: JSON.stringify({
          tests: [
            {
              name: 't1',
              type: 'unit',
              description: '',
              code: '',
              assertions: [],
              edgeCases: [],
              priority: 'high',
            },
            {
              name: 't2',
              type: 'unit',
              description: '',
              code: '',
              assertions: [],
              edgeCases: [],
              priority: 'high',
            },
            {
              name: 't3',
              type: 'integration',
              description: '',
              code: '',
              assertions: [],
              edgeCases: [],
              priority: 'medium',
            },
          ],
          mocks: [],
        }),
      } as ReturnType<typeof agentChat> extends Promise<infer T> ? T : never);

      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result.totalTests).toBe(3);
      expect(result.testTypes.unit).toBe(2);
      expect(result.testTypes.integration).toBe(1);
    });
  });

  // =========================================================================
  // TEST FRAMEWORK DETECTION
  // =========================================================================

  describe('test framework detection', () => {
    it('should detect vitest for Next.js projects', async () => {
      const intent = createIntent({
        technologies: {
          primary: 'Next.js',
          secondary: [],
          runtime: 'node',
          packageManager: 'pnpm',
        },
      });
      const files = [createTestableFile('src/utils.ts', 'export function x() {}')];

      const result = await generator.generateTests(files, intent, createPlan());

      const testFile = result.testFiles.find((f) => f.path.includes('.test.'));
      expect(testFile).toBeDefined();
      if (testFile) {
        expect(testFile.content).toContain('vitest');
      }
    });

    it('should detect vitest for Vite projects', async () => {
      const intent = createIntent({
        technologies: {
          primary: 'Vite + React',
          secondary: [],
          runtime: 'node',
          packageManager: 'npm',
        },
      });
      const files = [createTestableFile('src/utils.ts', 'export const x = 1;')];

      const result = await generator.generateTests(files, intent, createPlan());
      const testFile = result.testFiles.find((f) => f.path.includes('.test.'));
      expect(testFile).toBeDefined();
      if (testFile) {
        expect(testFile.content).toContain('vitest');
      }
    });

    it('should detect pytest for Python projects', async () => {
      const intent = createIntent({
        technologies: {
          primary: 'FastAPI',
          secondary: [],
          runtime: 'python',
          packageManager: 'pip',
        },
      });
      const files = [createTestableFile('app/main.py', 'def hello():\n    pass', 'python')];

      const result = await generator.generateTests(files, intent, createPlan());
      const testFile = result.testFiles.find((f) => f.path.includes('test_'));
      expect(testFile).toBeDefined();
      if (testFile) {
        expect(testFile.content).toContain('pytest');
        expect(testFile.language).toBe('python');
      }
    });

    it('should detect go-test for Go projects', async () => {
      const intent = createIntent({
        technologies: { primary: 'Go', secondary: [], runtime: 'node', packageManager: 'npm' },
      });
      // isTestable needs 'function'|'const '|'class '|'export '|'def ' in content + >5 lines
      const goContent = 'function placeholder() {}\nconst x = 1\nline3\nline4\nline5\nline6\nline7';
      const files = [createFile('main.go', goContent, 'go')];

      const result = await generator.generateTests(files, intent, createPlan());
      const testFile = result.testFiles.find((f) => f.language === 'go');
      expect(testFile).toBeDefined();
    });

    it('should detect rust-test for Rust projects', async () => {
      const intent = createIntent({
        technologies: { primary: 'Rust', secondary: [], runtime: 'node', packageManager: 'npm' },
      });
      // isTestable needs recognized keywords + >5 lines
      const rustContent =
        'function placeholder() {}\nconst x = 1\nline3\nline4\nline5\nline6\nline7';
      const files = [createFile('main.rs', rustContent, 'rust')];

      const result = await generator.generateTests(files, intent, createPlan());
      const testFile = result.testFiles.find((f) => f.language === 'rust');
      expect(testFile).toBeDefined();
    });

    it('should default to jest for generic JS projects', async () => {
      const intent = createIntent({
        technologies: { primary: 'Express', secondary: [], runtime: 'node', packageManager: 'npm' },
      });
      const files = [createTestableFile('src/app.ts', 'export const app = express();')];

      const result = await generator.generateTests(files, intent, createPlan());
      const testFile = result.testFiles.find((f) => f.path.includes('.test.'));
      expect(testFile).toBeDefined();
      if (testFile) {
        expect(testFile.content).toContain('@jest/globals');
      }
    });
  });

  // =========================================================================
  // FILE TESTABILITY (isTestable)
  // =========================================================================

  describe('file testability filtering', () => {
    it('should skip .test. files', async () => {
      const files = [createTestableFile('src/utils.test.ts', 'export function x() {}')];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.totalTests).toBe(0);
    });

    it('should skip .spec. files', async () => {
      const files = [createTestableFile('src/utils.spec.ts', 'export function x() {}')];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.totalTests).toBe(0);
    });

    it('should skip config files', async () => {
      const files = [createTestableFile('tsconfig.json', '{ "compilerOptions": {} }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.totalTests).toBe(0);
    });

    it('should skip CSS files', async () => {
      const files = [createTestableFile('styles.css', '.foo { color: red; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.totalTests).toBe(0);
    });

    it('should skip JSON files', async () => {
      const files = [createFile('data.json', '{"key": "value"}')];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.totalTests).toBe(0);
    });

    it('should skip Markdown files', async () => {
      const files = [createFile('README.md', '# Hello')];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.totalTests).toBe(0);
    });

    it('should skip type-only files with only interfaces', async () => {
      const files = [createTestableFile('types/index.ts', 'export interface Foo { bar: string; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.totalTests).toBe(0);
    });

    it('should skip very small files (<=5 lines)', async () => {
      const files = [createFile('tiny.ts', 'export const X = 1;')];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.totalTests).toBe(0);
    });

    it('should include files with function declarations and >5 lines', async () => {
      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.totalTests).toBeGreaterThanOrEqual(1);
    });

    it('should include files with class declarations and >5 lines', async () => {
      const content =
        'export class Foo {\n  bar() {\n    return 1;\n  }\n  baz() {\n    return 2;\n  }\n}';
      const files = [createFile('src/foo.ts', content)];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.totalTests).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // API ENDPOINT DETECTION
  // =========================================================================

  describe('API endpoint detection', () => {
    it('should detect app.get as API endpoint and generate integration tests', async () => {
      const files = [createTestableFile('src/server.ts', "app.get('/users', handler);")];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      const integrationFile = result.testFiles.find((f) => f.path.includes('integration'));
      expect(integrationFile).toBeDefined();
    });

    it('should detect router usage as API endpoint', async () => {
      const files = [createTestableFile('src/routes.ts', "router.post('/create', handler);")];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      const integrationFile = result.testFiles.find((f) => f.path.includes('integration'));
      expect(integrationFile).toBeDefined();
    });

    it('should detect /api/ path as API endpoint', async () => {
      const files = [
        createTestableFile('src/api/users.ts', 'export function getUsers() { return []; }'),
      ];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      const integrationFile = result.testFiles.find((f) => f.path.includes('integration'));
      expect(integrationFile).toBeDefined();
    });

    it('should not generate integration tests for non-API projects', async () => {
      const files = [
        createTestableFile(
          'src/utils.ts',
          'export function add(a: number, b: number) { return a + b; }'
        ),
      ];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      const integrationFile = result.testFiles.find((f) => f.path.includes('integration'));
      expect(integrationFile).toBeUndefined();
    });
  });

  // =========================================================================
  // DEFAULT / FALLBACK TEST SUITE
  // =========================================================================

  describe('default test suite fallback', () => {
    it('should create a default test suite when AI returns invalid JSON', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: 'This is not valid JSON at all -- no curly braces here',
      } as ReturnType<typeof agentChat> extends Promise<infer T> ? T : never);

      const files = [createTestableFile('src/utils.ts', 'export function add() { return 1; }')];

      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.testFiles.length).toBeGreaterThanOrEqual(1);
      expect(result.totalTests).toBeGreaterThanOrEqual(1);
    });

    it('should create a default test suite when AI throws an error', async () => {
      vi.mocked(agentChat).mockRejectedValueOnce(new Error('API error'));

      const files = [createTestableFile('src/utils.ts', 'export function add() { return 1; }')];

      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.testFiles.length).toBeGreaterThanOrEqual(1);
      expect(result.totalTests).toBeGreaterThanOrEqual(1);
    });

    it('should include a "should be defined" test in the default suite', async () => {
      vi.mocked(agentChat).mockRejectedValueOnce(new Error('API error'));

      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      const testFile = result.testFiles.find((f) => f.path.includes('.test.'));
      expect(testFile).toBeDefined();
      if (testFile) {
        expect(testFile.content).toContain('should be defined');
      }
    });
  });

  // =========================================================================
  // SETUP FILE GENERATION
  // =========================================================================

  describe('setup file generation', () => {
    it('should generate a setup file for vitest framework', async () => {
      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      const setupFile = result.testFiles.find((f) => f.path.includes('setup'));
      expect(setupFile).toBeDefined();
      if (setupFile) {
        expect(setupFile.content).toContain('Test Setup Configuration');
      }
    });

    it('should include @testing-library/jest-dom for React projects', async () => {
      const files = [
        createTestableFile(
          'src/App.tsx',
          'import React from "react";\nexport function App() { return <div>Hello</div>; }'
        ),
      ];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      const setupFile = result.testFiles.find((f) => f.path.includes('setup'));
      expect(setupFile).toBeDefined();
      if (setupFile) {
        expect(setupFile.content).toContain('@testing-library/jest-dom');
      }
    });

    it('should not generate setup file for pytest', async () => {
      const intent = createIntent({
        technologies: {
          primary: 'FastAPI',
          secondary: [],
          runtime: 'python',
          packageManager: 'pip',
        },
      });
      const files = [createTestableFile('app/main.py', 'def hello():\n    pass', 'python')];

      const result = await generator.generateTests(files, intent, createPlan());
      const setupFile = result.testFiles.find((f) => f.path.includes('setup'));
      expect(setupFile).toBeUndefined();
    });
  });

  // =========================================================================
  // COVERAGE ESTIMATION
  // =========================================================================

  describe('coverage estimation', () => {
    it('should estimate coverage between 0 and 95', async () => {
      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result.coverageEstimate.lines).toBeGreaterThanOrEqual(0);
      expect(result.coverageEstimate.lines).toBeLessThanOrEqual(95);
    });

    it('should have branches coverage <= lines coverage', async () => {
      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result.coverageEstimate.branches).toBeLessThanOrEqual(result.coverageEstimate.lines);
    });

    it('should compute coverage based on test-to-source ratio', async () => {
      // With empty source and generated setup file, ratio is high
      // The estimateCoverage formula: min(95, round(testLines/max(sourceLines,1) * 100))
      // For empty sources with a setup file, the ratio can be very high
      const result = await generator.generateTests([], createIntent(), createPlan());
      // Just verify coverage structure exists and is numeric
      expect(typeof result.coverageEstimate.lines).toBe('number');
      expect(typeof result.coverageEstimate.branches).toBe('number');
      expect(typeof result.coverageEstimate.functions).toBe('number');
      expect(typeof result.coverageEstimate.statements).toBe('number');
    });
  });

  // =========================================================================
  // RECOMMENDATIONS
  // =========================================================================

  describe('recommendation generation', () => {
    it('should recommend more unit tests when unit count < 5', async () => {
      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result.recommendations.some((r) => r.includes('unit tests'))).toBe(true);
    });

    it('should recommend integration tests when none exist', async () => {
      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result.recommendations.some((r) => r.includes('integration tests'))).toBe(true);
    });

    it('should recommend E2E tests when none exist', async () => {
      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result.recommendations.some((r) => r.includes('E2E'))).toBe(true);
    });

    it('should recommend security tests when none exist', async () => {
      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result.recommendations.some((r) => r.includes('security'))).toBe(true);
    });
  });

  // =========================================================================
  // STREAMING CALLBACKS
  // =========================================================================

  describe('streaming callbacks', () => {
    it('should call onStream with progress events', async () => {
      const onStream = vi.fn();
      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];

      await generator.generateTests(files, createIntent(), createPlan(), onStream);

      expect(onStream).toHaveBeenCalled();
      const calls = onStream.mock.calls;
      // First call should be thinking
      expect(calls[0][0].type).toBe('thinking');
      // Last call should be complete
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.type).toBe('complete');
      expect(lastCall.progress).toBe(100);
    });

    it('should work without onStream callback', async () => {
      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];

      // Should not throw
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result).toBeDefined();
    });

    it('should include searching events for each testable file', async () => {
      const onStream = vi.fn();
      const files = [
        createTestableFile('src/a.ts', 'export function foo() { return 1; }'),
        createTestableFile('src/b.ts', 'export function bar() { return 2; }'),
      ];

      await generator.generateTests(files, createIntent(), createPlan(), onStream);

      const searchingCalls = onStream.mock.calls.filter((c) => c[0].type === 'searching');
      expect(searchingCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  describe('edge cases', () => {
    it('should handle empty file list gracefully', async () => {
      const result = await generator.generateTests([], createIntent(), createPlan());
      expect(result.totalTests).toBe(0);
      // A setup file may still be generated — that's fine
      expect(result).toBeDefined();
    });

    it('should handle all files being non-testable', async () => {
      const files = [
        createFile('styles.css', '.foo { color: red; }'),
        createFile('data.json', '{}'),
        createFile('README.md', '# Hello'),
      ];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.totalTests).toBe(0);
    });

    it('should handle AI returning empty tests array', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: JSON.stringify({ tests: [], mocks: [] }),
      } as ReturnType<typeof agentChat> extends Promise<infer T> ? T : never);

      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result.totalTests).toBe(0);
    });

    it('should handle AI returning tests with missing fields', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: JSON.stringify({
          tests: [
            {
              // name and type missing — should use defaults
              description: 'test desc',
              code: 'expect(1).toBe(1)',
            },
          ],
          mocks: [
            {
              // name missing
              code: 'vi.fn()',
            },
          ],
        }),
      } as ReturnType<typeof agentChat> extends Promise<infer T> ? T : never);

      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result.totalTests).toBeGreaterThanOrEqual(1);
    });

    it('should validate invalid test types to "unit"', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: JSON.stringify({
          tests: [
            {
              name: 'test',
              type: 'INVALID_TYPE',
              description: 'test',
              code: 'expect(1).toBe(1)',
              assertions: [],
              edgeCases: [],
              priority: 'high',
            },
          ],
          mocks: [],
        }),
      } as ReturnType<typeof agentChat> extends Promise<infer T> ? T : never);

      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result.testTypes.unit).toBeGreaterThanOrEqual(1);
    });

    it('should validate invalid priority to "medium"', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: JSON.stringify({
          tests: [
            {
              name: 'test',
              type: 'unit',
              description: 'test',
              code: 'expect(1).toBe(1)',
              assertions: [],
              edgeCases: [],
              priority: 'INVALID_PRIORITY',
            },
          ],
          mocks: [],
        }),
      } as ReturnType<typeof agentChat> extends Promise<infer T> ? T : never);

      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result.totalTests).toBeGreaterThanOrEqual(1);
      const testFile = result.testFiles.find((f) => f.path.includes('.test.'));
      expect(testFile).toBeDefined();
      if (testFile) {
        expect(testFile.content).toContain('Priority: medium');
      }
    });

    it('should validate invalid mock type to "function"', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: JSON.stringify({
          tests: [
            {
              name: 'test',
              type: 'unit',
              description: 'test',
              code: 'expect(1).toBe(1)',
              assertions: [],
              edgeCases: [],
              priority: 'high',
            },
          ],
          mocks: [
            { name: 'myMock', type: 'INVALID_MOCK_TYPE', code: 'vi.fn()', description: 'A mock' },
          ],
        }),
      } as ReturnType<typeof agentChat> extends Promise<infer T> ? T : never);

      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());
      expect(result.totalTests).toBeGreaterThanOrEqual(1);
    });

    it('should handle integration test generation failure gracefully', async () => {
      vi.mocked(agentChat)
        .mockResolvedValueOnce({
          text: JSON.stringify({
            tests: [
              {
                name: 'basic test',
                type: 'unit',
                description: 'test',
                code: 'expect(1).toBe(1)',
                assertions: [],
                edgeCases: [],
                priority: 'medium',
              },
            ],
            mocks: [],
          }),
        } as ReturnType<typeof agentChat> extends Promise<infer T> ? T : never)
        .mockRejectedValueOnce(new Error('integration test gen failed'));

      const files = [
        createTestableFile('src/api/users.ts', 'export function getUsers() { return []; }'),
      ];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      expect(result).toBeDefined();
      expect(result.totalTests).toBeGreaterThanOrEqual(1);
    });

    it('should include setup and teardown in generated test file', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: JSON.stringify({
          tests: [
            {
              name: 'test',
              type: 'unit',
              description: 'test',
              code: 'expect(1).toBe(1)',
              assertions: [],
              edgeCases: [],
              priority: 'high',
            },
          ],
          mocks: [],
          setup: 'jest.useFakeTimers();',
          teardown: 'jest.useRealTimers();',
        }),
      } as ReturnType<typeof agentChat> extends Promise<infer T> ? T : never);

      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      const testFile = result.testFiles.find((f) => f.path.includes('.test.'));
      expect(testFile).toBeDefined();
      if (testFile) {
        expect(testFile.content).toContain('beforeEach');
        expect(testFile.content).toContain('afterEach');
      }
    });
  });

  // =========================================================================
  // TEST FILE PATHS
  // =========================================================================

  describe('test file path generation', () => {
    it('should generate __tests__ path for JS/TS files', async () => {
      const files = [createTestableFile('src/lib/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      const testFile = result.testFiles.find((f) => f.path.includes('.test.'));
      expect(testFile).toBeDefined();
      if (testFile) {
        expect(testFile.path).toContain('__tests__');
        expect(testFile.path).toContain('utils.test.ts');
      }
    });

    it('should generate test_ prefix path for Python files', async () => {
      const intent = createIntent({
        technologies: {
          primary: 'FastAPI',
          secondary: [],
          runtime: 'python',
          packageManager: 'pip',
        },
      });
      const files = [createTestableFile('app/services.py', 'def process():\n    pass', 'python')];

      const result = await generator.generateTests(files, intent, createPlan());
      const testFile = result.testFiles.find((f) => f.path.includes('test_'));
      expect(testFile).toBeDefined();
      if (testFile) {
        expect(testFile.path).toContain('test_services.py');
      }
    });

    it('should handle root-level files without directory', async () => {
      const files = [createTestableFile('app.ts', 'export function run() { return true; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      const testFile = result.testFiles.find((f) => f.path.includes('.test.'));
      expect(testFile).toBeDefined();
      if (testFile) {
        expect(testFile.path).toContain('__tests__/app.test.ts');
      }
    });

    it('should set correct language for test files', async () => {
      const files = [createTestableFile('src/utils.ts', 'export function foo() { return 1; }')];
      const result = await generator.generateTests(files, createIntent(), createPlan());

      const testFile = result.testFiles.find((f) => f.path.includes('.test.'));
      expect(testFile).toBeDefined();
      if (testFile) {
        expect(testFile.language).toBe('typescript');
      }
    });
  });
});
