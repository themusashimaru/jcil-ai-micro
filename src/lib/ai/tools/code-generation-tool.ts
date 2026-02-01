/**
 * CODE GENERATION TOOL
 *
 * Generates production-quality code using AI.
 * Supports all major languages and frameworks.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { agentChat } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';

const log = logger('CodeGenerationTool');

export const codeGenerationTool: UnifiedTool = {
  name: 'generate_code',
  description: `Generate production-quality code. Use this when user wants to:
- Create new code, functions, classes, or modules
- Build features or implement functionality
- Generate boilerplate or scaffolding
- Convert pseudocode to real code
- Port code from one language to another

Supports all major languages: TypeScript, JavaScript, Python, Rust, Go, Java, C#, C++, Ruby, Swift, Kotlin, etc.
Supports all major frameworks: React, Next.js, Vue, Angular, Express, Django, FastAPI, Spring, etc.`,
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'What code to generate (e.g., "React component for user profile", "Python API endpoint for authentication")',
      },
      language: {
        type: 'string',
        description: 'Programming language (typescript, python, javascript, rust, go, java, csharp, cpp, etc.)',
      },
      framework: {
        type: 'string',
        description: 'Framework if applicable (react, nextjs, vue, angular, express, django, fastapi, spring, etc.)',
      },
      requirements: {
        type: 'string',
        description: 'Additional requirements or constraints',
      },
      style: {
        type: 'string',
        enum: ['minimal', 'standard', 'comprehensive'],
        description: 'Code style: minimal (bare minimum), standard (best practices), comprehensive (full features with tests)',
      },
    },
    required: ['task'],
  },
};

const CODE_GENERATION_PROMPT = `You are a senior software engineer generating production-quality code.

TASK: {{task}}
LANGUAGE: {{language}}
{{framework}}
{{requirements}}
STYLE: {{style}}

Generate complete, working code that:
1. Follows best practices and conventions for the language/framework
2. Includes proper TypeScript types (if TypeScript)
3. Has comprehensive error handling
4. Is well-documented with comments for complex logic
5. Is production-ready (no TODOs or placeholders)
6. Includes security best practices (input validation, sanitization, etc.)

OUTPUT FORMAT (JSON):
{
  "files": [
    {
      "path": "src/components/MyComponent.tsx",
      "content": "// Full file content here",
      "description": "Brief description of what this file does"
    }
  ],
  "mainFile": "src/components/MyComponent.tsx",
  "dependencies": ["package-name@version"],
  "devDependencies": ["dev-package@version"],
  "usage": "How to use this code",
  "notes": "Any important notes about the implementation"
}

Generate the code now.`;

export async function executeCodeGeneration(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { task, language = 'typescript', framework, requirements, style = 'standard' } = args;

    if (!task || task.trim().length === 0) {
      return { toolCallId: id, content: 'Task description is required', isError: true };
    }

    const prompt = CODE_GENERATION_PROMPT
      .replace('{{task}}', task)
      .replace('{{language}}', language)
      .replace('{{framework}}', framework ? `FRAMEWORK: ${framework}` : '')
      .replace('{{requirements}}', requirements ? `REQUIREMENTS: ${requirements}` : '')
      .replace('{{style}}', style);

    const response = await agentChat(
      [{ role: 'user', content: prompt }],
      {
        provider: 'claude',
        maxTokens: 8192, // Large for code generation
        temperature: 0.2, // Lower temperature for consistent code
      }
    );

    // Extract JSON from response
    let result;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON found, wrap the response
        result = {
          files: [{
            path: `generated.${getExtension(language)}`,
            content: response.text,
            description: task,
          }],
          mainFile: `generated.${getExtension(language)}`,
          notes: 'Code extracted from response',
        };
      }
    } catch {
      // Parse error - wrap raw response
      result = {
        files: [{
          path: `generated.${getExtension(language)}`,
          content: response.text,
          description: task,
        }],
        mainFile: `generated.${getExtension(language)}`,
        notes: 'Raw code output',
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    log.error('Code generation error', { error: (error as Error).message });
    return {
      toolCallId: id,
      content: `Error generating code: ${(error as Error).message}`,
      isError: true,
    };
  }
}

function getExtension(language: string): string {
  const extensionMap: Record<string, string> = {
    typescript: 'ts',
    javascript: 'js',
    python: 'py',
    rust: 'rs',
    go: 'go',
    java: 'java',
    csharp: 'cs',
    cpp: 'cpp',
    c: 'c',
    ruby: 'rb',
    swift: 'swift',
    kotlin: 'kt',
    php: 'php',
    scala: 'scala',
    haskell: 'hs',
    elixir: 'ex',
    clojure: 'clj',
    lua: 'lua',
    r: 'r',
    julia: 'jl',
    dart: 'dart',
    shell: 'sh',
    bash: 'sh',
    sql: 'sql',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    xml: 'xml',
    markdown: 'md',
  };
  return extensionMap[language.toLowerCase()] || 'txt';
}

export function isCodeGenerationAvailable(): boolean {
  return true;
}
