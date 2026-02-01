/**
 * TEST GENERATOR TOOL
 *
 * Generates comprehensive test suites for code.
 * Supports unit tests, integration tests, and e2e tests.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { agentChat } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';

const log = logger('TestGeneratorTool');

export const testGeneratorTool: UnifiedTool = {
  name: 'generate_tests',
  description: `Generate comprehensive tests for code. Use this when user wants to:
- Create unit tests for functions/classes
- Generate integration tests
- Build e2e tests
- Add test coverage to existing code
- Create mock data and fixtures

Supports all major testing frameworks: Jest, Vitest, Mocha, PyTest, Go testing, JUnit, etc.`,
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to generate tests for',
      },
      testType: {
        type: 'string',
        enum: ['unit', 'integration', 'e2e', 'all'],
        description: 'Type of tests to generate',
      },
      framework: {
        type: 'string',
        description: 'Testing framework (jest, vitest, mocha, pytest, go, junit, etc.)',
      },
      coverage: {
        type: 'string',
        enum: ['basic', 'thorough', 'exhaustive'],
        description: 'Coverage level: basic (happy path), thorough (edge cases), exhaustive (all scenarios)',
      },
      language: {
        type: 'string',
        description: 'Programming language of the code',
      },
    },
    required: ['code'],
  },
};

const TEST_GENERATION_PROMPT = `You are a senior QA engineer generating comprehensive tests.

CODE TO TEST:
\`\`\`{{language}}
{{code}}
\`\`\`

TEST TYPE: {{testType}}
FRAMEWORK: {{framework}}
COVERAGE: {{coverage}}

Generate tests that:
1. Cover all public functions/methods
2. Test happy paths and success cases
3. Test error cases and edge cases
4. Use appropriate mocking for dependencies
5. Have clear, descriptive test names
6. Include setup and teardown as needed
7. Are well-organized and maintainable

OUTPUT FORMAT (JSON):
{
  "testFile": {
    "path": "src/__tests__/module.test.ts",
    "content": "// Full test file content"
  },
  "mocks": [
    {
      "path": "src/__mocks__/dependency.ts",
      "content": "// Mock file content"
    }
  ],
  "fixtures": {
    "description": "Test fixtures/data",
    "data": {}
  },
  "setupInstructions": "Any setup needed to run tests",
  "coverageEstimate": {
    "statements": 95,
    "branches": 90,
    "functions": 100,
    "lines": 95
  }
}

Generate the tests now.`;

export async function executeTestGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { code, testType = 'unit', framework = 'vitest', coverage = 'thorough', language = 'typescript' } = args;

    if (!code || code.trim().length === 0) {
      return { toolCallId: id, content: 'Code is required for test generation', isError: true };
    }

    // Truncate very long code
    const truncatedCode = code.length > 30000 ? code.substring(0, 30000) + '\n... (truncated)' : code;

    const prompt = TEST_GENERATION_PROMPT
      .replace('{{code}}', truncatedCode)
      .replace('{{language}}', language)
      .replace('{{testType}}', testType)
      .replace('{{framework}}', framework)
      .replace('{{coverage}}', coverage);

    const response = await agentChat(
      [{ role: 'user', content: prompt }],
      {
        provider: 'claude',
        maxTokens: 8192,
        temperature: 0.2,
      }
    );

    // Extract JSON from response
    let result;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = { rawOutput: response.text };
      }
    } catch {
      result = { rawOutput: response.text };
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    log.error('Test generation error', { error: (error as Error).message });
    return {
      toolCallId: id,
      content: `Error generating tests: ${(error as Error).message}`,
      isError: true,
    };
  }
}

export function isTestGeneratorAvailable(): boolean {
  return true;
}
