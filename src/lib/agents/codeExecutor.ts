/**
 * CODE EXECUTOR AGENT
 * ===================
 *
 * AI-powered code execution and testing.
 * This agent can:
 * - Execute code snippets to verify they work
 * - Build and test projects before pushing to GitHub
 * - Install dependencies and run commands
 * - Provide execution feedback to the main AI
 *
 * Integration with chat:
 * - AI detects code that needs testing
 * - Calls this executor to verify
 * - Gets results back to inform response
 */

import {
  executeSandbox,
  quickTest,
  buildAndTest,
  getSandboxConfig,
  isSandboxConfigured,
  SandboxResult,
} from '@/lib/connectors/vercel-sandbox';

export interface CodeExecutionRequest {
  /** Type of execution */
  type: 'snippet' | 'project' | 'test';
  /** Language for snippet execution */
  language?: 'javascript' | 'typescript' | 'python';
  /** Code snippet (for type: 'snippet') */
  code?: string;
  /** Files to create (for type: 'project') */
  files?: { path: string; content: string }[];
  /** Commands to run */
  commands?: string[];
  /** Whether to include npm install */
  installDependencies?: boolean;
}

export interface CodeExecutionResult {
  success: boolean;
  output: string;
  errors: string[];
  executionTime: number;
  suggestion?: string;
}

/**
 * Execute code and return AI-friendly results
 */
export async function executeCode(
  request: CodeExecutionRequest
): Promise<CodeExecutionResult> {
  // Check if sandbox is available
  if (!isSandboxConfigured()) {
    return {
      success: false,
      output: '',
      errors: ['Sandbox not configured. Code execution unavailable.'],
      executionTime: 0,
      suggestion: 'Code cannot be tested automatically. Please review manually.',
    };
  }

  const config = getSandboxConfig()!;

  try {
    let result: SandboxResult;

    switch (request.type) {
      case 'snippet':
        // Quick test of a code snippet
        if (!request.code) {
          return {
            success: false,
            output: '',
            errors: ['No code provided'],
            executionTime: 0,
          };
        }
        result = await quickTest(
          config,
          request.code,
          request.language || 'javascript'
        );
        break;

      case 'project':
        // Build and test a full project
        if (!request.files || request.files.length === 0) {
          return {
            success: false,
            output: '',
            errors: ['No files provided'],
            executionTime: 0,
          };
        }
        result = await buildAndTest(config, request.files, {
          buildCommand: request.commands?.find(c => c.includes('build')),
          testCommand: request.commands?.find(c => c.includes('test')),
        });
        break;

      case 'test':
        // Run specific test commands
        result = await executeSandbox(config, {
          files: request.files,
          commands: request.commands || ['npm test'],
          runtime: 'node22',
        });
        break;

      default:
        return {
          success: false,
          output: '',
          errors: ['Invalid execution type'],
          executionTime: 0,
        };
    }

    // Convert sandbox result to AI-friendly format
    return formatResultForAI(result);

  } catch (error) {
    return {
      success: false,
      output: '',
      errors: [error instanceof Error ? error.message : 'Execution failed'],
      executionTime: 0,
      suggestion: 'An error occurred during execution. Please try again.',
    };
  }
}

/**
 * Format sandbox result for AI consumption
 */
function formatResultForAI(result: SandboxResult): CodeExecutionResult {
  const output = result.outputs
    .map(o => {
      let text = `$ ${o.command}\n`;
      if (o.stdout) text += o.stdout + '\n';
      if (o.stderr && !o.success) text += `ERROR: ${o.stderr}\n`;
      return text;
    })
    .join('\n');

  const errors = result.outputs
    .filter(o => !o.success)
    .map(o => `Command "${o.command}" failed: ${o.stderr || 'Unknown error'}`);

  // Generate suggestion based on common errors
  let suggestion: string | undefined;

  if (!result.success) {
    const allErrors = errors.join(' ').toLowerCase();

    if (allErrors.includes('cannot find module') || allErrors.includes('module not found')) {
      suggestion = 'Missing dependency. Add the required package to package.json.';
    } else if (allErrors.includes('syntax error') || allErrors.includes('unexpected token')) {
      suggestion = 'Syntax error in the code. Check for typos or missing brackets.';
    } else if (allErrors.includes('type error') || allErrors.includes('is not a function')) {
      suggestion = 'Type error. Check that all variables and functions are properly defined.';
    } else if (allErrors.includes('enoent') || allErrors.includes('no such file')) {
      suggestion = 'File not found. Ensure all required files exist.';
    } else if (allErrors.includes('permission denied')) {
      suggestion = 'Permission error. The operation requires elevated privileges.';
    } else if (errors.length > 0) {
      suggestion = 'Review the error messages above and fix the issues.';
    }
  }

  return {
    success: result.success,
    output,
    errors,
    executionTime: result.executionTime,
    suggestion,
  };
}

/**
 * Check if code needs testing based on content
 */
export function shouldTestCode(code: string, language: string): boolean {
  // Skip testing for trivial code
  const lines = code.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));

  // Don't test very short snippets
  if (lines.length < 3) return false;

  // Don't test HTML/CSS only
  if (language === 'html' || language === 'css') return false;

  // Test if it has function definitions, classes, or complex logic
  const hasComplexity =
    /function\s+\w+|const\s+\w+\s*=\s*\(|class\s+\w+|async\s+|await\s+|import\s+|require\s*\(/.test(code);

  return hasComplexity;
}

/**
 * Extract code blocks from AI response
 */
export function extractCodeBlocks(
  text: string
): { language: string; code: string; filename?: string }[] {
  const blocks: { language: string; code: string; filename?: string }[] = [];
  const regex = /```(\w+)?(?:\s+([^\n]+))?\n([\s\S]*?)```/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      filename: match[2],
      code: match[3].trim(),
    });
  }

  return blocks;
}

/**
 * Create a package.json if none exists in files
 */
export function ensurePackageJson(
  files: { path: string; content: string }[]
): { path: string; content: string }[] {
  const hasPackageJson = files.some(f =>
    f.path === 'package.json' || f.path.endsWith('/package.json')
  );

  if (hasPackageJson) return files;

  // Extract dependencies from imports
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};

  for (const file of files) {
    const imports = file.content.match(/from\s+['"]([^'"]+)['"]/g) || [];
    const requires = file.content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];

    [...imports, ...requires].forEach(imp => {
      const match = imp.match(/['"]([^'"]+)['"]/);
      if (match) {
        const pkg = match[1];
        // Skip relative imports and node built-ins
        if (!pkg.startsWith('.') && !pkg.startsWith('node:')) {
          const pkgName = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0];
          dependencies[pkgName] = 'latest';
        }
      }
    });

    // Check for TypeScript
    if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
      devDependencies['typescript'] = 'latest';
      devDependencies['tsx'] = 'latest';
    }
  }

  const packageJson = {
    name: 'sandbox-project',
    version: '1.0.0',
    type: 'module',
    scripts: {
      start: 'node index.js',
      build: 'echo "No build step"',
      test: 'echo "No tests"',
    },
    dependencies,
    devDependencies,
  };

  return [
    ...files,
    { path: 'package.json', content: JSON.stringify(packageJson, null, 2) },
  ];
}
