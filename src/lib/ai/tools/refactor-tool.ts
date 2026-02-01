/**
 * REFACTOR TOOL
 *
 * Refactors code to improve quality, performance, and maintainability.
 * Preserves functionality while improving structure.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { agentChat } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';

const log = logger('RefactorTool');

export const refactorTool: UnifiedTool = {
  name: 'refactor_code',
  description: `Refactor code to improve quality. Use this when user wants to:
- Improve code structure and organization
- Reduce complexity and improve readability
- Optimize performance
- Apply design patterns
- Make code more testable
- Remove code duplication
- Modernize legacy code

Preserves functionality while improving code quality.`,
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to refactor',
      },
      goals: {
        type: 'array',
        items: { type: 'string' },
        description: 'Refactoring goals (e.g., "improve readability", "reduce complexity", "add types")',
      },
      constraints: {
        type: 'string',
        description: 'Any constraints (e.g., "maintain API compatibility", "keep same file structure")',
      },
      language: {
        type: 'string',
        description: 'Programming language',
      },
    },
    required: ['code'],
  },
};

const REFACTOR_PROMPT = `You are a senior software engineer refactoring code.

ORIGINAL CODE ({{language}}):
\`\`\`{{language}}
{{code}}
\`\`\`

REFACTORING GOALS: {{goals}}
{{constraints}}

Refactor the code to:
1. Improve structure and organization
2. Reduce complexity (lower cyclomatic complexity)
3. Improve naming and readability
4. Apply appropriate design patterns
5. Eliminate code duplication
6. Add proper error handling
7. Improve type safety (if applicable)

IMPORTANT: Preserve all functionality. The refactored code should work exactly the same as the original.

OUTPUT FORMAT (JSON):
{
  "refactoredCode": "// Complete refactored code",
  "changes": [
    {
      "type": "extract-function|rename|simplify|pattern|dedup|typing|error-handling",
      "description": "What was changed",
      "before": "Original code snippet",
      "after": "Refactored code snippet",
      "reason": "Why this improves the code"
    }
  ],
  "metrics": {
    "complexityBefore": "estimated",
    "complexityAfter": "estimated",
    "linesOfCodeBefore": 100,
    "linesOfCodeAfter": 80,
    "improvementSummary": "20% reduction in LOC, improved testability"
  },
  "testingNotes": "How to verify the refactoring didn't break functionality"
}

Provide the refactored code now.`;

export async function executeRefactor(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { code, goals = ['improve readability', 'reduce complexity'], constraints, language = 'typescript' } = args;

    if (!code || code.trim().length === 0) {
      return { toolCallId: id, content: 'Code is required for refactoring', isError: true };
    }

    // Truncate very long code
    const truncatedCode = code.length > 30000 ? code.substring(0, 30000) + '\n... (truncated)' : code;

    const prompt = REFACTOR_PROMPT
      .replace(/\{\{language\}\}/g, language)
      .replace('{{code}}', truncatedCode)
      .replace('{{goals}}', Array.isArray(goals) ? goals.join(', ') : goals)
      .replace('{{constraints}}', constraints ? `CONSTRAINTS: ${constraints}` : '');

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
        result = { refactoredCode: response.text };
      }
    } catch {
      result = { refactoredCode: response.text };
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    log.error('Refactor error', { error: (error as Error).message });
    return {
      toolCallId: id,
      content: `Refactor error: ${(error as Error).message}`,
      isError: true,
    };
  }
}

export function isRefactorAvailable(): boolean {
  return true;
}
