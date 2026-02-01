/**
 * PROJECT BUILDER TOOL
 *
 * Creates complete project structures based on user requirements.
 * Generates all necessary files, configs, and code.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { agentChat } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';

const log = logger('ProjectBuilderTool');

export const projectBuilderTool: UnifiedTool = {
  name: 'build_project',
  description: `Create a complete project structure with all necessary files. Use this when:
- User wants to create a new application/project
- User asks to scaffold a project
- User wants boilerplate code for a specific stack
- User describes an app they want built

Generates:
- Package configuration (package.json, requirements.txt, etc.)
- Source code files
- Configuration files
- README documentation
- Basic tests`,
  parameters: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'What the project should do',
      },
      stack: {
        type: 'string',
        description: 'Technology stack (e.g., "nextjs", "react", "python-fastapi", "node-express")',
      },
      features: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of features to include',
      },
      name: {
        type: 'string',
        description: 'Project name',
      },
    },
    required: ['description'],
  },
};

const PROJECT_PROMPT = `You are a senior full-stack developer creating a production-ready project.

Based on the requirements, generate a complete project structure.

REQUIREMENTS:
- Description: {{description}}
- Stack: {{stack}}
- Features: {{features}}
- Name: {{name}}

Generate the project as JSON with this structure:
{
  "projectName": "string",
  "stack": "string",
  "files": [
    {
      "path": "relative/path/to/file.ts",
      "content": "full file content",
      "description": "what this file does"
    }
  ],
  "setupCommands": ["npm install", "etc"],
  "devCommands": {
    "start": "npm run dev",
    "build": "npm run build",
    "test": "npm test"
  },
  "summary": "Brief description of the generated project"
}

Rules:
- Generate COMPLETE, working code - not placeholders
- Include proper TypeScript types
- Include error handling
- Include basic tests
- Follow best practices for the chosen stack
- Make it production-ready`;

export async function executeProjectBuilder(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { description, stack = 'auto', features = [], name = 'my-project' } = args;

    if (!description) {
      return { toolCallId: id, content: 'Project description required', isError: true };
    }

    const prompt = PROJECT_PROMPT
      .replace('{{description}}', description)
      .replace('{{stack}}', stack)
      .replace('{{features}}', features.join(', ') || 'none specified')
      .replace('{{name}}', name);

    const response = await agentChat(
      [{ role: 'user', content: prompt }],
      {
        provider: 'claude',
        maxTokens: 8192, // Larger for project generation
        temperature: 0.2,
      }
    );

    // Extract JSON from response
    let project;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        project = JSON.parse(jsonMatch[0]);
      } else {
        project = { rawResponse: response.text };
      }
    } catch {
      project = { rawResponse: response.text };
    }

    return {
      toolCallId: id,
      content: JSON.stringify(project, null, 2),
    };
  } catch (error) {
    log.error('Project builder error', { error: (error as Error).message });
    return { toolCallId: id, content: `Build error: ${(error as Error).message}`, isError: true };
  }
}

export function isProjectBuilderAvailable(): boolean {
  return true;
}
