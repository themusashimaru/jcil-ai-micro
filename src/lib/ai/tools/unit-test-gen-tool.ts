/**
 * UNIT TEST GENERATOR TOOL
 * Generate unit tests for various testing frameworks
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function generateJestTests(config: {
  functionName: string;
  inputs: Array<{ args: unknown[]; expected: unknown; description?: string }>;
  async?: boolean;
  mocks?: string[];
}): string {
  const { functionName, inputs, async: isAsync = false, mocks = [] } = config;

  let test = `import { ${functionName} } from './${functionName}';\n`;

  if (mocks.length > 0) {
    test += `\n// Mocks\n`;
    mocks.forEach(mock => {
      test += `jest.mock('${mock}');\n`;
    });
  }

  test += `\ndescribe('${functionName}', () => {\n`;

  if (mocks.length > 0) {
    test += `  beforeEach(() => {\n    jest.clearAllMocks();\n  });\n\n`;
  }

  inputs.forEach((input, i) => {
    const desc = input.description || `test case ${i + 1}`;
    const argsStr = JSON.stringify(input.args).slice(1, -1);
    const expectedStr = JSON.stringify(input.expected);

    if (isAsync) {
      test += `  it('${desc}', async () => {\n`;
      test += `    const result = await ${functionName}(${argsStr});\n`;
      test += `    expect(result).toEqual(${expectedStr});\n`;
      test += `  });\n\n`;
    } else {
      test += `  it('${desc}', () => {\n`;
      test += `    const result = ${functionName}(${argsStr});\n`;
      test += `    expect(result).toEqual(${expectedStr});\n`;
      test += `  });\n\n`;
    }
  });

  // Add edge case tests
  test += `  // Edge cases\n`;
  test += `  it('should handle null input', () => {\n`;
  test += `    expect(() => ${functionName}(null as any)).toThrow();\n`;
  test += `  });\n\n`;

  test += `  it('should handle undefined input', () => {\n`;
  test += `    expect(() => ${functionName}(undefined as any)).toThrow();\n`;
  test += `  });\n`;

  test += `});\n`;

  return test;
}

function generateVitestTests(config: {
  functionName: string;
  inputs: Array<{ args: unknown[]; expected: unknown; description?: string }>;
  async?: boolean;
}): string {
  const { functionName, inputs, async: isAsync = false } = config;

  let test = `import { describe, it, expect, vi, beforeEach } from 'vitest';\n`;
  test += `import { ${functionName} } from './${functionName}';\n\n`;

  test += `describe('${functionName}', () => {\n`;
  test += `  beforeEach(() => {\n    vi.clearAllMocks();\n  });\n\n`;

  inputs.forEach((input, i) => {
    const desc = input.description || `test case ${i + 1}`;
    const argsStr = JSON.stringify(input.args).slice(1, -1);
    const expectedStr = JSON.stringify(input.expected);

    if (isAsync) {
      test += `  it('${desc}', async () => {\n`;
      test += `    const result = await ${functionName}(${argsStr});\n`;
      test += `    expect(result).toEqual(${expectedStr});\n`;
      test += `  });\n\n`;
    } else {
      test += `  it('${desc}', () => {\n`;
      test += `    const result = ${functionName}(${argsStr});\n`;
      test += `    expect(result).toEqual(${expectedStr});\n`;
      test += `  });\n\n`;
    }
  });

  test += `});\n`;

  return test;
}

function generatePytestTests(config: {
  functionName: string;
  inputs: Array<{ args: unknown[]; expected: unknown; description?: string }>;
  async?: boolean;
  fixtures?: string[];
}): string {
  const { functionName, inputs, async: isAsync = false, fixtures = [] } = config;

  let test = `import pytest\n`;
  test += `from ${functionName} import ${functionName}\n\n`;

  if (fixtures.length > 0) {
    fixtures.forEach(fixture => {
      test += `@pytest.fixture\ndef ${fixture}():\n    # Setup fixture\n    return {}\n\n`;
    });
  }

  // Parametrized tests
  const paramData = inputs.map(input => {
    const argsStr = input.args.map(a => JSON.stringify(a)).join(', ');
    return `    (${argsStr}, ${JSON.stringify(input.expected)})`;
  }).join(',\n');

  test += `@pytest.mark.parametrize("args,expected", [\n${paramData}\n])\n`;

  if (isAsync) {
    test += `@pytest.mark.asyncio\nasync def test_${functionName}(args, expected):\n`;
    test += `    result = await ${functionName}(*args) if isinstance(args, tuple) else await ${functionName}(args)\n`;
  } else {
    test += `def test_${functionName}(args, expected):\n`;
    test += `    result = ${functionName}(*args) if isinstance(args, tuple) else ${functionName}(args)\n`;
  }
  test += `    assert result == expected\n\n`;

  // Edge cases
  test += `def test_${functionName}_with_none():\n`;
  test += `    with pytest.raises(TypeError):\n`;
  test += `        ${functionName}(None)\n\n`;

  test += `def test_${functionName}_with_invalid_type():\n`;
  test += `    with pytest.raises(TypeError):\n`;
  test += `        ${functionName}("invalid")\n`;

  return test;
}

function generateGoTests(config: {
  packageName: string;
  functionName: string;
  inputs: Array<{ args: unknown[]; expected: unknown; description?: string }>;
}): string {
  const { packageName, functionName, inputs } = config;

  let test = `package ${packageName}\n\n`;
  test += `import (\n\t"testing"\n)\n\n`;

  // Table-driven tests
  test += `func Test${functionName}(t *testing.T) {\n`;
  test += `\ttests := []struct {\n`;
  test += `\t\tname     string\n`;
  test += `\t\targs     interface{}\n`;
  test += `\t\texpected interface{}\n`;
  test += `\t}{\n`;

  inputs.forEach((input, i) => {
    const desc = input.description || `test case ${i + 1}`;
    test += `\t\t{"${desc}", ${JSON.stringify(input.args[0])}, ${JSON.stringify(input.expected)}},\n`;
  });

  test += `\t}\n\n`;

  test += `\tfor _, tt := range tests {\n`;
  test += `\t\tt.Run(tt.name, func(t *testing.T) {\n`;
  test += `\t\t\tresult := ${functionName}(tt.args)\n`;
  test += `\t\t\tif result != tt.expected {\n`;
  test += `\t\t\t\tt.Errorf("${functionName}() = %v, want %v", result, tt.expected)\n`;
  test += `\t\t\t}\n`;
  test += `\t\t})\n`;
  test += `\t}\n`;
  test += `}\n\n`;

  // Benchmark
  test += `func Benchmark${functionName}(b *testing.B) {\n`;
  test += `\tfor i := 0; i < b.N; i++ {\n`;
  test += `\t\t${functionName}(${JSON.stringify(inputs[0]?.args[0] || '')})\n`;
  test += `\t}\n`;
  test += `}\n`;

  return test;
}

function generateMochaTests(config: {
  functionName: string;
  inputs: Array<{ args: unknown[]; expected: unknown; description?: string }>;
  async?: boolean;
}): string {
  const { functionName, inputs, async: isAsync = false } = config;

  let test = `const { expect } = require('chai');\n`;
  test += `const sinon = require('sinon');\n`;
  test += `const { ${functionName} } = require('./${functionName}');\n\n`;

  test += `describe('${functionName}', function() {\n`;
  test += `  beforeEach(function() {\n    sinon.restore();\n  });\n\n`;

  inputs.forEach((input, i) => {
    const desc = input.description || `test case ${i + 1}`;
    const argsStr = JSON.stringify(input.args).slice(1, -1);
    const expectedStr = JSON.stringify(input.expected);

    if (isAsync) {
      test += `  it('${desc}', async function() {\n`;
      test += `    const result = await ${functionName}(${argsStr});\n`;
      test += `    expect(result).to.deep.equal(${expectedStr});\n`;
      test += `  });\n\n`;
    } else {
      test += `  it('${desc}', function() {\n`;
      test += `    const result = ${functionName}(${argsStr});\n`;
      test += `    expect(result).to.deep.equal(${expectedStr});\n`;
      test += `  });\n\n`;
    }
  });

  test += `});\n`;

  return test;
}

function generateTestCases(code: string): Record<string, unknown> {
  // Analyze code to suggest test cases
  const hasNumbers = /\d+/.test(code);
  const hasStrings = /['"`]/.test(code);
  const hasArrays = /\[/.test(code);
  const hasConditions = /if|else|switch/.test(code);
  const hasLoops = /for|while|map|filter|reduce/.test(code);
  const hasAsync = /async|await|Promise/.test(code);
  const hasErrorHandling = /try|catch|throw/.test(code);

  const suggestions: Array<{ category: string; cases: string[] }> = [];

  if (hasNumbers) {
    suggestions.push({
      category: 'Numeric inputs',
      cases: [
        'Test with zero',
        'Test with negative numbers',
        'Test with very large numbers (MAX_SAFE_INTEGER)',
        'Test with floating point numbers',
        'Test with NaN and Infinity'
      ]
    });
  }

  if (hasStrings) {
    suggestions.push({
      category: 'String inputs',
      cases: [
        'Test with empty string',
        'Test with very long string',
        'Test with special characters',
        'Test with unicode characters',
        'Test with whitespace-only string'
      ]
    });
  }

  if (hasArrays) {
    suggestions.push({
      category: 'Array inputs',
      cases: [
        'Test with empty array',
        'Test with single element',
        'Test with many elements',
        'Test with nested arrays',
        'Test with array containing null/undefined'
      ]
    });
  }

  if (hasConditions) {
    suggestions.push({
      category: 'Branch coverage',
      cases: [
        'Test each conditional branch (true/false)',
        'Test boundary conditions',
        'Test default/else cases',
        'Test combined conditions'
      ]
    });
  }

  if (hasLoops) {
    suggestions.push({
      category: 'Loop coverage',
      cases: [
        'Test with zero iterations',
        'Test with single iteration',
        'Test with many iterations',
        'Test early exit conditions'
      ]
    });
  }

  if (hasAsync) {
    suggestions.push({
      category: 'Async behavior',
      cases: [
        'Test successful resolution',
        'Test rejection/error cases',
        'Test timeout scenarios',
        'Test concurrent calls',
        'Test cancellation if supported'
      ]
    });
  }

  if (hasErrorHandling) {
    suggestions.push({
      category: 'Error handling',
      cases: [
        'Test that expected errors are thrown',
        'Test error message content',
        'Test error recovery',
        'Test that errors propagate correctly'
      ]
    });
  }

  // Always include
  suggestions.push({
    category: 'General edge cases',
    cases: [
      'Test with null input',
      'Test with undefined input',
      'Test with wrong type input',
      'Test idempotency (same input = same output)',
      'Test with missing optional parameters'
    ]
  });

  return {
    suggestions,
    totalCases: suggestions.reduce((sum, s) => sum + s.cases.length, 0),
    priority: suggestions.map(s => s.category),
    recommendation: 'Start with happy path tests, then cover edge cases and error scenarios'
  };
}

function generateMockData(schema: Record<string, unknown>): Record<string, unknown> {
  const generators: Record<string, () => unknown> = {
    string: () => 'test-string-' + Math.random().toString(36).slice(2),
    number: () => Math.floor(Math.random() * 1000),
    boolean: () => Math.random() > 0.5,
    email: () => `user${Math.floor(Math.random() * 1000)}@test.com`,
    uuid: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }),
    date: () => new Date().toISOString(),
    url: () => `https://example.com/${Math.random().toString(36).slice(2)}`,
    phone: () => `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
    address: () => ({ street: '123 Test St', city: 'Test City', zip: '12345' })
  };

  function generateValue(type: string, field?: Record<string, unknown>): unknown {
    if (field?.enum) return (field.enum as unknown[])[0];
    if (type === 'array') return [generateValue(field?.items as string || 'string')];
    if (type === 'object') return {};
    return generators[type]?.() || generators.string();
  }

  const properties = (schema.properties || schema) as Record<string, Record<string, unknown>>;
  const mockData: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(properties)) {
    mockData[key] = generateValue(field.type as string || 'string', field);
  }

  return {
    single: mockData,
    array: Array(5).fill(null).map(() => {
      const item: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(properties)) {
        item[key] = generateValue(field.type as string || 'string', field);
      }
      return item;
    }),
    factories: `// Factory functions
const create${Object.keys(properties).length > 0 ? 'Entity' : 'Mock'} = (overrides = {}) => ({
${Object.entries(properties).map(([k, v]) =>
  `  ${k}: ${JSON.stringify(generateValue(v.type as string || 'string', v))}`
).join(',\n')},
  ...overrides
});`
  };
}

export const unitTestGenTool: UnifiedTool = {
  name: 'unit_test_gen',
  description: 'Unit Test Generator: jest, vitest, pytest, go, mocha, suggest_cases, mock_data',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['jest', 'vitest', 'pytest', 'go', 'mocha', 'suggest_cases', 'mock_data'] },
      config: { type: 'object' },
      code: { type: 'string' },
      schema: { type: 'object' }
    },
    required: ['operation']
  },
};

export async function executeUnitTestGen(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown> | string;

    const defaultConfig = {
      functionName: 'calculateTotal',
      inputs: [
        { args: [[10, 20, 30]], expected: 60, description: 'should sum array of numbers' },
        { args: [[]], expected: 0, description: 'should return 0 for empty array' },
        { args: [[5]], expected: 5, description: 'should handle single element' }
      ],
      async: false
    };

    switch (args.operation) {
      case 'jest':
        result = { test: generateJestTests(args.config || defaultConfig) };
        break;
      case 'vitest':
        result = { test: generateVitestTests(args.config || defaultConfig) };
        break;
      case 'pytest':
        result = { test: generatePytestTests(args.config || defaultConfig) };
        break;
      case 'go':
        result = { test: generateGoTests(args.config ? { packageName: 'main', ...args.config } : {
          packageName: 'main',
          ...defaultConfig
        })};
        break;
      case 'mocha':
        result = { test: generateMochaTests(args.config || defaultConfig) };
        break;
      case 'suggest_cases':
        result = generateTestCases(args.code || 'function calculate(n) { if (n < 0) throw new Error("Negative"); return n * 2; }');
        break;
      case 'mock_data':
        result = generateMockData(args.schema || {
          properties: {
            id: { type: 'uuid' },
            name: { type: 'string' },
            email: { type: 'email' },
            age: { type: 'number' },
            active: { type: 'boolean' }
          }
        });
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isUnitTestGenAvailable(): boolean { return true; }
