/**
 * AI TEST GENERATOR
 *
 * Automatically generate comprehensive tests for any code.
 *
 * Features:
 * - Unit test generation
 * - Integration test generation
 * - E2E test generation
 * - Edge case detection
 * - Mock generation
 * - Test coverage analysis
 * - Multiple framework support (Jest, Vitest, Pytest, etc.)
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('TestGenerator');

// ============================================
// TYPES
// ============================================

export type TestType = 'unit' | 'integration' | 'e2e' | 'snapshot' | 'performance';
export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'pytest' | 'go-test' | 'rspec';

export interface TestGenerationOptions {
  testType: TestType;
  framework: TestFramework;
  coverage?: 'basic' | 'comprehensive' | 'exhaustive';
  includeMocks?: boolean;
  includeEdgeCases?: boolean;
  includeErrorCases?: boolean;
  includePerformanceTests?: boolean;
  style?: 'tdd' | 'bdd';
}

export interface GeneratedTest {
  name: string;
  code: string;
  type: TestType;
  targetFunction?: string;
  targetFile?: string;
  description: string;
  coverage: string[];
  mocks?: string[];
  setupCode?: string;
  teardownCode?: string;
}

export interface TestSuite {
  name: string;
  framework: TestFramework;
  tests: GeneratedTest[];
  setupFile?: string;
  totalTests: number;
  estimatedCoverage: number;
  imports: string[];
  mocks: MockDefinition[];
}

export interface MockDefinition {
  name: string;
  type: 'function' | 'module' | 'class' | 'api';
  code: string;
  description: string;
}

export interface CodeAnalysis {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  exports: string[];
  imports: string[];
  dependencies: string[];
  complexity: 'low' | 'medium' | 'high';
}

export interface FunctionInfo {
  name: string;
  params: { name: string; type?: string }[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  complexity: number;
  lineStart: number;
  lineEnd: number;
}

export interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  properties: { name: string; type?: string }[];
  isExported: boolean;
}

// ============================================
// TEST GENERATOR CLASS
// ============================================

export class AITestGenerator {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Generate a complete test suite for a code file
   */
  async generateTestSuite(
    code: string,
    filePath: string,
    options: TestGenerationOptions
  ): Promise<TestSuite> {
    log.info('Generating tests', { testType: options.testType, filePath });

    // Analyze the code first
    const analysis = await this.analyzeCode(code, filePath);

    // Generate tests based on analysis
    const tests = await this.generateTests(code, analysis, options);

    // Generate mocks if needed
    const mocks = options.includeMocks
      ? await this.generateMocks(code, analysis, options.framework)
      : [];

    // Calculate estimated coverage
    const estimatedCoverage = this.estimateCoverage(analysis, tests);

    // Generate imports
    const imports = this.generateImports(filePath, options.framework, mocks);

    return {
      name: this.getTestFileName(filePath, options.framework),
      framework: options.framework,
      tests,
      totalTests: tests.length,
      estimatedCoverage,
      imports,
      mocks,
    };
  }

  /**
   * Analyze code to understand its structure
   */
  private async analyzeCode(code: string, filePath: string): Promise<CodeAnalysis> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a code analysis expert. Analyze the given code and extract its structure.

Return JSON:
{
  "functions": [
    {
      "name": "functionName",
      "params": [{"name": "param1", "type": "string"}],
      "returnType": "void",
      "isAsync": false,
      "isExported": true,
      "complexity": 1-10,
      "lineStart": 1,
      "lineEnd": 10
    }
  ],
  "classes": [
    {
      "name": "ClassName",
      "methods": [...],
      "properties": [{"name": "prop", "type": "string"}],
      "isExported": true
    }
  ],
  "exports": ["function1", "Class1"],
  "imports": ["dependency1", "dependency2"],
  "dependencies": ["external-lib"],
  "complexity": "low" | "medium" | "high"
}`,
        messages: [
          {
            role: 'user',
            content: `Analyze this code from ${filePath}:\n\n${code}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      log.error('Analysis error', error as Error);
      // Return minimal analysis
      return {
        functions: [],
        classes: [],
        exports: [],
        imports: [],
        dependencies: [],
        complexity: 'medium',
      };
    }
  }

  /**
   * Generate tests for the analyzed code
   */
  private async generateTests(
    code: string,
    analysis: CodeAnalysis,
    options: TestGenerationOptions
  ): Promise<GeneratedTest[]> {
    const frameworkGuide = this.getFrameworkGuide(options.framework);
    const coverageLevel = options.coverage || 'comprehensive';

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16384,
        system: `You are a senior test engineer. Generate ${options.testType} tests using ${options.framework}.

${frameworkGuide}

COVERAGE LEVEL: ${coverageLevel}
${coverageLevel === 'exhaustive' ? '- Test EVERY code path\n- Include ALL edge cases\n- Test error conditions\n- Test boundary values' : ''}
${coverageLevel === 'comprehensive' ? '- Test main functionality\n- Include common edge cases\n- Test error handling' : ''}
${coverageLevel === 'basic' ? '- Test happy path only\n- Basic error handling' : ''}

${options.includeEdgeCases ? 'INCLUDE edge cases: null, undefined, empty arrays, empty strings, negative numbers, zero, MAX_INT, etc.' : ''}
${options.includeErrorCases ? 'INCLUDE error cases: invalid input, network failures, timeout scenarios, etc.' : ''}
${options.style === 'bdd' ? 'Use BDD style: describe/it with readable descriptions' : 'Use standard test style'}

Return a JSON array of tests:
[
  {
    "name": "descriptive test name",
    "code": "complete test code",
    "type": "${options.testType}",
    "targetFunction": "functionBeingTested",
    "description": "what this test verifies",
    "coverage": ["code paths covered"],
    "setupCode": "any setup needed (optional)",
    "teardownCode": "any cleanup needed (optional)"
  }
]

Generate production-quality tests that would pass code review.`,
        messages: [
          {
            role: 'user',
            content: `Generate ${options.testType} tests for this code:

\`\`\`
${code}
\`\`\`

Code Analysis:
${JSON.stringify(analysis, null, 2)}

Generate comprehensive tests covering all exported functions and classes.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      // Extract JSON array from response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        log.warn('No JSON array in response');
        return [];
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      log.error('Test generation error', error as Error);
      return [];
    }
  }

  /**
   * Generate mock definitions for dependencies
   */
  private async generateMocks(
    code: string,
    analysis: CodeAnalysis,
    framework: TestFramework
  ): Promise<MockDefinition[]> {
    if (analysis.dependencies.length === 0 && analysis.imports.length === 0) {
      return [];
    }

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a test mocking expert. Generate mocks for the dependencies.

Framework: ${framework}
${framework === 'jest' || framework === 'vitest' ? 'Use jest.mock() / vi.mock() syntax' : ''}
${framework === 'pytest' ? 'Use pytest-mock / unittest.mock' : ''}

Return JSON array:
[
  {
    "name": "mockName",
    "type": "function" | "module" | "class" | "api",
    "code": "complete mock code",
    "description": "what this mocks"
  }
]`,
        messages: [
          {
            role: 'user',
            content: `Generate mocks for this code's dependencies:

Dependencies: ${analysis.dependencies.join(', ')}
Imports: ${analysis.imports.join(', ')}

Code:
${code}`,
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
      log.error('Mock generation error', error as Error);
      return [];
    }
  }

  /**
   * Get framework-specific guide
   */
  private getFrameworkGuide(framework: TestFramework): string {
    const guides: Record<TestFramework, string> = {
      jest: `
JEST GUIDE:
- Use describe() for test suites
- Use it() or test() for individual tests
- Use expect() for assertions
- Use beforeEach/afterEach for setup/teardown
- Use jest.mock() for mocking
- Use jest.spyOn() for spying
- Common matchers: toBe, toEqual, toThrow, toHaveBeenCalled, toMatchSnapshot`,

      vitest: `
VITEST GUIDE:
- Same API as Jest
- Use describe() for test suites
- Use it() or test() for individual tests
- Use expect() for assertions
- Use vi.mock() for mocking
- Use vi.spyOn() for spying
- Import from 'vitest': { describe, it, expect, vi, beforeEach, afterEach }`,

      mocha: `
MOCHA GUIDE:
- Use describe() for test suites
- Use it() for individual tests
- Use chai for assertions (expect/should/assert)
- Use sinon for mocking/spying
- Use before/after for setup/teardown`,

      pytest: `
PYTEST GUIDE:
- Use def test_* for test functions
- Use class Test* for test classes
- Use pytest fixtures for setup
- Use pytest.raises for exception testing
- Use @pytest.mark.parametrize for parameterized tests
- Use mocker fixture (pytest-mock) for mocking`,

      'go-test': `
GO TEST GUIDE:
- Use func Test* for test functions
- Use t.Run() for subtests
- Use t.Error/t.Fatal for failures
- Use testing.T for test context
- Use testify for assertions (optional)`,

      rspec: `
RSPEC GUIDE:
- Use describe for test suites
- Use it for individual tests
- Use expect().to for assertions
- Use let for lazy evaluation
- Use before/after for setup/teardown
- Use allow/expect for mocking`,
    };

    return guides[framework] || '';
  }

  /**
   * Get test file name based on framework conventions
   */
  private getTestFileName(filePath: string, framework: TestFramework): string {
    const baseName = filePath.replace(/\.[^.]+$/, '');
    const ext = filePath.match(/\.[^.]+$/)?.[0] || '.ts';

    switch (framework) {
      case 'jest':
      case 'vitest':
        return `${baseName}.test${ext}`;
      case 'mocha':
        return `${baseName}.spec${ext}`;
      case 'pytest':
        return `test_${baseName.split('/').pop()}.py`;
      case 'go-test':
        return `${baseName}_test.go`;
      case 'rspec':
        return `${baseName}_spec.rb`;
      default:
        return `${baseName}.test${ext}`;
    }
  }

  /**
   * Generate import statements for test file
   */
  private generateImports(
    filePath: string,
    framework: TestFramework,
    _mocks: MockDefinition[]
  ): string[] {
    const imports: string[] = [];
    const relativePath = `./${filePath.split('/').pop()?.replace(/\.[^.]+$/, '')}`;

    switch (framework) {
      case 'jest':
        imports.push(`import { } from '${relativePath}';`);
        break;
      case 'vitest':
        imports.push(`import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';`);
        imports.push(`import { } from '${relativePath}';`);
        break;
      case 'mocha':
        imports.push(`import { expect } from 'chai';`);
        imports.push(`import sinon from 'sinon';`);
        imports.push(`import { } from '${relativePath}';`);
        break;
      case 'pytest':
        imports.push(`import pytest`);
        imports.push(`from ${relativePath.replace('./', '').replace('/', '.')} import *`);
        break;
      default:
        imports.push(`import { } from '${relativePath}';`);
    }

    return imports;
  }

  /**
   * Estimate test coverage percentage
   */
  private estimateCoverage(analysis: CodeAnalysis, tests: GeneratedTest[]): number {
    const totalTargets = analysis.functions.length +
      analysis.classes.reduce((sum, c) => sum + c.methods.length, 0);

    if (totalTargets === 0) return 100;

    const testedTargets = new Set(
      tests.map(t => t.targetFunction).filter(Boolean)
    ).size;

    return Math.min(100, Math.round((testedTargets / totalTargets) * 100));
  }

  /**
   * Generate edge case tests specifically
   */
  async generateEdgeCaseTests(
    code: string,
    _filePath: string,
    framework: TestFramework
  ): Promise<GeneratedTest[]> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: `You are a QA expert specializing in edge cases. Generate tests for edge cases and boundary conditions.

Consider:
- Null/undefined inputs
- Empty strings, arrays, objects
- Zero and negative numbers
- Very large numbers (MAX_SAFE_INTEGER)
- Unicode and special characters
- Concurrent access
- Timeout scenarios
- Resource exhaustion
- Invalid types
- Boundary values (off-by-one)

Framework: ${framework}

Return JSON array of edge case tests.`,
        messages: [
          {
            role: 'user',
            content: `Generate edge case tests for:\n\n${code}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') return [];

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      log.error('Edge case generation error', error as Error);
      return [];
    }
  }

  /**
   * Generate performance/load tests
   */
  async generatePerformanceTests(
    code: string,
    _filePath: string,
    framework: TestFramework
  ): Promise<GeneratedTest[]> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a performance testing expert. Generate performance and load tests.

Consider:
- Execution time benchmarks
- Memory usage
- Large data set handling
- Concurrent request handling
- Resource cleanup
- Caching effectiveness

Framework: ${framework}

Return JSON array of performance tests.`,
        messages: [
          {
            role: 'user',
            content: `Generate performance tests for:\n\n${code}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') return [];

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      log.error('Performance test generation error', error as Error);
      return [];
    }
  }

  /**
   * Format test suite as a complete test file
   */
  formatTestFile(suite: TestSuite): string {
    let output = '';

    // Imports
    output += suite.imports.join('\n') + '\n\n';

    // Mocks
    if (suite.mocks.length > 0) {
      output += '// Mocks\n';
      for (const mock of suite.mocks) {
        output += `// ${mock.description}\n`;
        output += mock.code + '\n\n';
      }
    }

    // Test suite
    output += `describe('${suite.name}', () => {\n`;

    for (const test of suite.tests) {
      if (test.setupCode) {
        output += `  beforeEach(() => {\n    ${test.setupCode}\n  });\n\n`;
      }

      output += `  it('${test.name}', ${test.code.includes('await') ? 'async ' : ''}() => {\n`;
      output += `    ${test.code.split('\n').join('\n    ')}\n`;
      output += `  });\n\n`;

      if (test.teardownCode) {
        output += `  afterEach(() => {\n    ${test.teardownCode}\n  });\n\n`;
      }
    }

    output += '});\n';

    return output;
  }
}

// ============================================
// EXPORTS
// ============================================

export const testGenerator = new AITestGenerator();

/**
 * Quick function to generate tests
 */
export async function generateTests(
  code: string,
  filePath: string,
  options: Partial<TestGenerationOptions> = {}
): Promise<TestSuite> {
  const fullOptions: TestGenerationOptions = {
    testType: options.testType || 'unit',
    framework: options.framework || 'vitest',
    coverage: options.coverage || 'comprehensive',
    includeMocks: options.includeMocks ?? true,
    includeEdgeCases: options.includeEdgeCases ?? true,
    includeErrorCases: options.includeErrorCases ?? true,
    style: options.style || 'bdd',
  };

  return testGenerator.generateTestSuite(code, filePath, fullOptions);
}

/**
 * Quick function to generate test file content
 */
export async function generateTestFile(
  code: string,
  filePath: string,
  options: Partial<TestGenerationOptions> = {}
): Promise<string> {
  const suite = await generateTests(code, filePath, options);
  return testGenerator.formatTestFile(suite);
}
