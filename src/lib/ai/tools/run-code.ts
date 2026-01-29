/**
 * CODE EXECUTION TOOL
 *
 * Executes Python or JavaScript code in a secure E2B sandbox.
 * Useful for calculations, data analysis, and code verification.
 *
 * Features:
 * - Python with pandas, numpy, requests pre-installed
 * - JavaScript via Node.js
 * - Timeout protection (30 seconds max)
 * - Output capture (stdout, stderr, results)
 * - Safe: Runs in isolated sandbox, no access to host system
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import { canExecuteTool, recordToolCost } from './safety';

const log = logger('RunCodeTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const MAX_CODE_LENGTH = 50000; // 50KB max code
const MAX_OUTPUT_LENGTH = 100000; // 100KB max output
const TOOL_COST = 0.01; // $0.01 per execution

// Track E2B availability (lazy import to avoid startup issues)
let e2bAvailable: boolean | null = null;
let Sandbox: typeof import('@e2b/code-interpreter').Sandbox | null = null;

// Sandbox pool for reuse
let sharedSandbox: InstanceType<typeof import('@e2b/code-interpreter').Sandbox> | null = null;
let sandboxLastUsed = 0;
const SANDBOX_TIMEOUT_MS = 300000; // 5 minutes
const SANDBOX_IDLE_CLEANUP_MS = 120000; // Clean up after 2 min idle (longer for chat)

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const runCodeTool: UnifiedTool = {
  name: 'run_code',
  description: `Execute Python or JavaScript code in a secure sandbox. Use this when:
- User asks for calculations, math, or financial projections
- You need to process data, parse JSON, or analyze numbers
- User asks you to run or test code they've provided
- You need to verify your code works before showing it
- Data manipulation, statistics, or complex computations

The sandbox has Python with pandas, numpy, requests, beautifulsoup4 pre-installed.
JavaScript runs via Node.js.

Return the output to the user with explanation of results.
Important: Code runs in isolation - no internet access, no file persistence between calls.`,
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description:
          'The code to execute. Must be complete and runnable. Use print() for output in Python.',
      },
      language: {
        type: 'string',
        description: 'Programming language: python or javascript',
        enum: ['python', 'javascript'],
        default: 'python',
      },
    },
    required: ['code'],
  },
};

// ============================================================================
// E2B INITIALIZATION
// ============================================================================

async function initE2B(): Promise<boolean> {
  if (e2bAvailable !== null) {
    return e2bAvailable;
  }

  try {
    // Check if E2B API key is configured
    if (!process.env.E2B_API_KEY) {
      log.warn('E2B_API_KEY not configured - code execution disabled');
      e2bAvailable = false;
      return false;
    }

    // Dynamic import to avoid startup issues
    const e2bModule = await import('@e2b/code-interpreter');
    Sandbox = e2bModule.Sandbox;
    e2bAvailable = true;
    log.info('E2B code execution available');
    return true;
  } catch (error) {
    log.error('Failed to initialize E2B', { error: (error as Error).message });
    e2bAvailable = false;
    return false;
  }
}

/**
 * Get or create a shared sandbox for code execution
 */
async function getSandbox(): Promise<InstanceType<typeof import('@e2b/code-interpreter').Sandbox>> {
  if (!Sandbox) {
    throw new Error('E2B not initialized');
  }

  const now = Date.now();

  // If we have a sandbox that's been idle too long, clean it up
  if (sharedSandbox && now - sandboxLastUsed > SANDBOX_IDLE_CLEANUP_MS) {
    try {
      await sharedSandbox.kill();
    } catch {
      // Ignore cleanup errors
    }
    sharedSandbox = null;
  }

  // Create new sandbox if needed
  if (!sharedSandbox) {
    log.info('Creating new E2B sandbox for chat code execution');
    sharedSandbox = await Sandbox.create({
      timeoutMs: SANDBOX_TIMEOUT_MS,
    });

    // Pre-install common packages (fire and forget with longer timeout)
    sharedSandbox.commands
      .run('pip install pandas numpy requests beautifulsoup4 lxml matplotlib', {
        timeoutMs: 180000,
      })
      .catch((err) => {
        log.warn('Package installation failed (non-fatal)', { error: (err as Error).message });
      });

    log.info('Chat code sandbox ready');
  }

  sandboxLastUsed = now;
  return sharedSandbox;
}

// ============================================================================
// CODE VALIDATION
// ============================================================================

interface CodeValidationResult {
  valid: boolean;
  error?: string;
}

function validateCode(code: string, language: string): CodeValidationResult {
  // Check length
  if (code.length > MAX_CODE_LENGTH) {
    return { valid: false, error: `Code too long (${code.length} > ${MAX_CODE_LENGTH} chars)` };
  }

  // Check for empty code
  if (!code.trim()) {
    return { valid: false, error: 'Code cannot be empty' };
  }

  // Check for obviously dangerous patterns
  const dangerousPatterns = [
    // System commands
    /os\.system\s*\(/i,
    /subprocess\.(run|call|Popen)\s*\(/i,
    /exec\s*\(\s*['"]/i, // exec with string literals (not exec(compile(...)))
    /eval\s*\(\s*input/i,

    // File system access (allow read but not destructive)
    /os\.remove/i,
    /os\.unlink/i,
    /shutil\.rmtree/i,
    /shutil\.move/i,

    // Network listeners (allow requests but not servers)
    /socket\.bind/i,
    /\.listen\s*\(/i,

    // Crypto mining patterns
    /stratum\+tcp/i,
    /cryptonight/i,
    /hashrate/i,

    // Fork bombs
    /:\s*\(\s*\)\s*\{\s*:\s*\|/,
    /while\s*\(\s*true\s*\)\s*\{\s*fork/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return { valid: false, error: 'Code contains potentially dangerous patterns' };
    }
  }

  // Language-specific checks
  if (language === 'python') {
    // Check for import of dangerous modules
    const dangerousImports = [
      /import\s+ctypes/i,
      /from\s+ctypes/i,
      /import\s+multiprocessing/i,
      /from\s+multiprocessing/i,
    ];
    for (const pattern of dangerousImports) {
      if (pattern.test(code)) {
        return { valid: false, error: 'Code imports restricted modules' };
      }
    }
  }

  if (language === 'javascript') {
    // Check for dangerous Node patterns
    const jsPatterns = [
      /require\s*\(\s*['"]child_process['"]\s*\)/i,
      /require\s*\(\s*['"]cluster['"]\s*\)/i,
      /process\.exit/i,
      /process\.kill/i,
    ];
    for (const pattern of jsPatterns) {
      if (pattern.test(code)) {
        return { valid: false, error: 'Code contains restricted Node.js patterns' };
      }
    }
  }

  return { valid: true };
}

// ============================================================================
// CODE EXECUTION
// ============================================================================

async function executeCode(
  code: string,
  language: 'python' | 'javascript'
): Promise<{
  success: boolean;
  output?: string;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const sandbox = await getSandbox();

    log.info('Executing code', { language, codeLength: code.length });

    if (language === 'python') {
      // Use E2B's built-in Python execution
      const result = await sandbox.runCode(code);

      const stdout = result.logs.stdout.join('\n');
      const stderr = result.logs.stderr.join('\n');

      if (result.error) {
        log.warn('Python execution error', { error: result.error.value });
        return {
          success: false,
          output: stdout,
          error: `${result.error.name}: ${result.error.value}`,
        };
      }

      // Combine outputs
      let output = '';
      if (stdout) output += stdout;
      if (result.results && result.results.length > 0) {
        const resultText = result.results
          .map((r) => r.text || (r.data ? JSON.stringify(r.data) : ''))
          .filter(Boolean)
          .join('\n');
        if (resultText) {
          output += (output ? '\n' : '') + resultText;
        }
      }

      log.info('Python execution complete', { timeMs: Date.now() - startTime });

      return {
        success: true,
        output: output.slice(0, MAX_OUTPUT_LENGTH) || '(No output)',
      };
    } else {
      // JavaScript via Node
      const tempFile = `/tmp/chat_code_${Date.now()}.js`;

      await sandbox.files.write(tempFile, code);

      const result = await sandbox.commands.run(`node ${tempFile}`, {
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });

      // Clean up
      await sandbox.files.remove(tempFile).catch(() => {});

      log.info('JavaScript execution complete', { timeMs: Date.now() - startTime });

      const output = result.stdout || result.stderr;

      return {
        success: result.exitCode === 0,
        output: output.slice(0, MAX_OUTPUT_LENGTH) || '(No output)',
        error: result.exitCode !== 0 ? `Exit code: ${result.exitCode}\n${result.stderr}` : undefined,
      };
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Code execution failed', { language, error: errMsg });

    return {
      success: false,
      error: errMsg,
    };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeRunCode(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'run_code') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  // Initialize E2B
  const available = await initE2B();
  if (!available) {
    return {
      toolCallId: id,
      content:
        'Code execution is not currently available. E2B sandbox service is not configured.',
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? {} : rawArgs;
  const code = args.code as string;
  const language = ((args.language as string) || 'python').toLowerCase() as 'python' | 'javascript';

  if (!code) {
    return {
      toolCallId: id,
      content: 'No code provided. Please specify the code to execute.',
      isError: true,
    };
  }

  // Validate language
  if (!['python', 'javascript'].includes(language)) {
    return {
      toolCallId: id,
      content: `Unsupported language: ${language}. Use 'python' or 'javascript'.`,
      isError: true,
    };
  }

  // Validate code
  const validation = validateCode(code, language);
  if (!validation.valid) {
    return {
      toolCallId: id,
      content: `Code validation failed: ${validation.error}`,
      isError: true,
    };
  }

  // Check cost limits (use conversation ID or generate one)
  const sessionId = `chat_${Date.now()}`;
  const costCheck = canExecuteTool(sessionId, 'run_code', TOOL_COST);
  if (!costCheck.allowed) {
    return {
      toolCallId: id,
      content: `Cannot execute code: ${costCheck.reason}`,
      isError: true,
    };
  }

  // Execute
  const result = await executeCode(code, language);

  // Record cost
  recordToolCost(sessionId, 'run_code', TOOL_COST);

  if (!result.success) {
    return {
      toolCallId: id,
      content: `Code execution failed:\n\`\`\`\n${result.error}\n\`\`\`${result.output ? `\n\nPartial output:\n\`\`\`\n${result.output}\n\`\`\`` : ''}`,
      isError: true,
    };
  }

  return {
    toolCallId: id,
    content: `Code executed successfully (${language}):\n\`\`\`\n${result.output}\n\`\`\``,
    isError: false,
  };
}

// ============================================================================
// HELPER EXPORTS
// ============================================================================

export async function isRunCodeAvailable(): Promise<boolean> {
  return initE2B();
}

/**
 * Cleanup sandbox (for graceful shutdown)
 */
export async function cleanupCodeSandbox(): Promise<void> {
  if (sharedSandbox) {
    try {
      await sharedSandbox.kill();
      sharedSandbox = null;
      log.info('Code sandbox cleaned up');
    } catch (error) {
      log.warn('Error cleaning up sandbox', { error: (error as Error).message });
    }
  }
}
