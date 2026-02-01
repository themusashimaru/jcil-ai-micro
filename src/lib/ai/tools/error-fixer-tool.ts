/**
 * ERROR FIXER TOOL
 *
 * Analyzes and fixes code errors.
 * Handles syntax errors, type errors, runtime errors, and build failures.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { agentChat } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';

const log = logger('ErrorFixerTool');

export const errorFixerTool: UnifiedTool = {
  name: 'fix_error',
  description: `Analyze and fix code errors. Use this when:
- User has a syntax error or type error
- Build is failing with errors
- Runtime errors are occurring
- Tests are failing
- User wants to debug an issue

Provides root cause analysis and corrected code.`,
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code with the error',
      },
      error: {
        type: 'string',
        description: 'The error message or stack trace',
      },
      language: {
        type: 'string',
        description: 'Programming language',
      },
      context: {
        type: 'string',
        description: 'Additional context about the error or what the code should do',
      },
    },
    required: ['error'],
  },
};

const ERROR_FIX_PROMPT = `You are a senior software engineer debugging code.

{{codeSection}}

ERROR:
\`\`\`
{{error}}
\`\`\`

{{contextSection}}

Analyze the error and provide:
1. Root cause analysis - why is this happening?
2. The fix - exact code change needed
3. Prevention - how to avoid this in the future

OUTPUT FORMAT (JSON):
{
  "rootCause": {
    "summary": "Brief explanation",
    "details": "Detailed technical explanation",
    "category": "syntax|type|runtime|logic|configuration|dependency"
  },
  "fix": {
    "description": "What needs to change",
    "originalCode": "The problematic code snippet",
    "fixedCode": "The corrected code snippet",
    "explanation": "Why this fixes the issue"
  },
  "prevention": [
    "Best practice to avoid this in the future"
  ],
  "relatedIssues": [
    "Other potential issues found while analyzing"
  ],
  "confidence": "high|medium|low"
}

Provide the analysis now.`;

export async function executeErrorFixer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { code, error, language = 'auto-detect', context } = args;

    if (!error || error.trim().length === 0) {
      return { toolCallId: id, content: 'Error message is required', isError: true };
    }

    // Build code section
    let codeSection = '';
    if (code && code.trim().length > 0) {
      const truncatedCode = code.length > 20000 ? code.substring(0, 20000) + '\n... (truncated)' : code;
      codeSection = `CODE (${language}):\n\`\`\`${language}\n${truncatedCode}\n\`\`\``;
    }

    // Build context section
    const contextSection = context ? `CONTEXT: ${context}` : '';

    const prompt = ERROR_FIX_PROMPT
      .replace('{{codeSection}}', codeSection)
      .replace('{{error}}', error)
      .replace('{{contextSection}}', contextSection);

    const response = await agentChat(
      [{ role: 'user', content: prompt }],
      {
        provider: 'claude',
        maxTokens: 4096,
        temperature: 0.1, // Low temperature for precise fixes
      }
    );

    // Extract JSON from response
    let result;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = { rawAnalysis: response.text };
      }
    } catch {
      result = { rawAnalysis: response.text };
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    log.error('Error fixer error', { error: (error as Error).message });
    return {
      toolCallId: id,
      content: `Analysis error: ${(error as Error).message}`,
      isError: true,
    };
  }
}

export function isErrorFixerAvailable(): boolean {
  return true;
}
