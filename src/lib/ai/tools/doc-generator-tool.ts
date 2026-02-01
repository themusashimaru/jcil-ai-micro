/**
 * DOC GENERATOR TOOL
 *
 * Generates documentation for code.
 * Creates README, API docs, JSDoc/TSDoc, and inline comments.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { agentChat } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';

const log = logger('DocGeneratorTool');

export const docGeneratorTool: UnifiedTool = {
  name: 'generate_docs',
  description: `Generate documentation for code. Use this when user wants to:
- Create README files for projects
- Generate API documentation
- Add JSDoc/TSDoc comments to functions
- Create user guides or tutorials
- Document architectural decisions

Produces professional, comprehensive documentation.`,
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to document',
      },
      docType: {
        type: 'string',
        enum: ['readme', 'api', 'jsdoc', 'inline', 'tutorial', 'all'],
        description: 'Type of documentation to generate',
      },
      projectName: {
        type: 'string',
        description: 'Name of the project',
      },
      description: {
        type: 'string',
        description: 'Brief description of what the code does',
      },
      language: {
        type: 'string',
        description: 'Programming language',
      },
    },
    required: ['code'],
  },
};

const DOC_GENERATION_PROMPT = `You are a technical writer creating excellent documentation.

CODE ({{language}}):
\`\`\`{{language}}
{{code}}
\`\`\`

PROJECT: {{projectName}}
DESCRIPTION: {{description}}
DOC TYPE: {{docType}}

Generate professional documentation that:
1. Is clear, concise, and well-organized
2. Includes practical examples
3. Documents all public APIs
4. Explains complex logic
5. Follows best practices for {{docType}} documentation

OUTPUT FORMAT (JSON):
{
  "documentation": {
    "readme": {
      "content": "# Project Name\\n\\n## Description\\n...",
      "sections": ["Installation", "Usage", "API", "Examples"]
    },
    "api": [
      {
        "name": "functionName",
        "signature": "function signature",
        "description": "What it does",
        "params": [{"name": "param", "type": "string", "description": "..."}],
        "returns": {"type": "string", "description": "..."},
        "examples": ["example code"]
      }
    ],
    "jsdocComments": "// Full code with JSDoc/TSDoc comments added",
    "inlineComments": "// Full code with inline explanatory comments"
  },
  "summary": {
    "publicFunctions": 5,
    "publicClasses": 2,
    "exportedTypes": 3
  }
}

Generate the documentation now.`;

export async function executeDocGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      code,
      docType = 'all',
      projectName = 'Project',
      description = 'A software project',
      language = 'typescript'
    } = args;

    if (!code || code.trim().length === 0) {
      return { toolCallId: id, content: 'Code is required for documentation', isError: true };
    }

    // Truncate very long code
    const truncatedCode = code.length > 30000 ? code.substring(0, 30000) + '\n... (truncated)' : code;

    const prompt = DOC_GENERATION_PROMPT
      .replace(/\{\{language\}\}/g, language)
      .replace('{{code}}', truncatedCode)
      .replace('{{projectName}}', projectName)
      .replace('{{description}}', description)
      .replace('{{docType}}', docType);

    const response = await agentChat(
      [{ role: 'user', content: prompt }],
      {
        provider: 'claude',
        maxTokens: 8192,
        temperature: 0.3,
      }
    );

    // Extract JSON from response
    let result;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = { documentation: { readme: { content: response.text } } };
      }
    } catch {
      result = { documentation: { readme: { content: response.text } } };
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    log.error('Doc generation error', { error: (error as Error).message });
    return {
      toolCallId: id,
      content: `Documentation error: ${(error as Error).message}`,
      isError: true,
    };
  }
}

export function isDocGeneratorAvailable(): boolean {
  return true;
}
