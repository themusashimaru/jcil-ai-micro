/**
 * SANDBOX TEST RUNNER TOOL
 *
 * Runs code tests and CI/CD-like pipelines in an isolated E2B sandbox.
 * Supports testing user-submitted code, running test suites, linting,
 * type-checking, and build verification.
 *
 * Features:
 * - Run test suites (pytest, jest, mocha, go test, etc.)
 * - Lint code (eslint, pylint, flake8, etc.)
 * - Type check (tsc, mypy, etc.)
 * - Build projects (npm run build, cargo build, go build)
 * - Install dependencies and run arbitrary test pipelines
 * - Multi-language support (Python, JavaScript/TypeScript, Go, Rust, etc.)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import { canExecuteTool, recordToolCost } from './safety';

const log = logger('SandboxTestRunnerTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOOL_COST = 0.03; // $0.03 per test run
const EXECUTION_TIMEOUT_MS = 120000; // 2 minutes per pipeline step
const SANDBOX_TIMEOUT_MS = 600000; // 10 min sandbox lifetime
const SANDBOX_IDLE_CLEANUP_MS = 180000; // 3 min idle
const MAX_OUTPUT_LENGTH = 150000; // 150KB max output

// E2B lazy loading
let e2bAvailable: boolean | null = null;
let Sandbox: typeof import('@e2b/code-interpreter').Sandbox | null = null;
let testSandbox: InstanceType<typeof import('@e2b/code-interpreter').Sandbox> | null = null;
let sandboxLastUsed = 0;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const sandboxTestRunnerTool: UnifiedTool = {
  name: 'sandbox_test_runner',
  description: `Run tests, linting, type-checking, and builds in an isolated sandbox. Use this when:
- User provides code and wants to verify it works
- You need to run a test suite to validate changes
- You want to check code for errors before presenting it
- User asks to test, lint, or build their code
- You need to verify that code compiles/transpiles correctly

Supported workflows:
- test: Run test suites (pytest, jest, mocha, go test, cargo test)
- lint: Run linters (eslint, pylint, flake8, clippy)
- typecheck: Run type checkers (tsc --noEmit, mypy)
- build: Build projects (npm run build, cargo build, go build)
- pipeline: Run a custom sequence of commands (install deps → lint → test → build)

For 'pipeline' action, provide steps as a JSON array of commands.
Files must be written to the sandbox first (use sandbox_files tool or provide code inline).`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Test action to perform',
        enum: ['test', 'lint', 'typecheck', 'build', 'pipeline'],
      },
      language: {
        type: 'string',
        description: 'Programming language of the code',
        enum: ['python', 'javascript', 'typescript', 'go', 'rust'],
        default: 'python',
      },
      code: {
        type: 'string',
        description:
          'Code to test (will be written to a temp file). For pipelines with existing files, omit this.',
      },
      test_code: {
        type: 'string',
        description: 'Test code (will be written alongside the main code). Optional.',
      },
      command: {
        type: 'string',
        description: 'Custom command to run (overrides default for the action)',
      },
      steps: {
        type: 'array',
        description: 'Array of commands for pipeline action (executed sequentially)',
        items: { type: 'string' },
      },
    },
    required: ['action'],
  },
};

// ============================================================================
// E2B INITIALIZATION
// ============================================================================

async function initE2B(): Promise<boolean> {
  if (e2bAvailable !== null) return e2bAvailable;

  try {
    if (!process.env.E2B_API_KEY) {
      log.warn('E2B_API_KEY not configured - test runner disabled');
      e2bAvailable = false;
      return false;
    }

    const e2bModule = await import('@e2b/code-interpreter');
    Sandbox = e2bModule.Sandbox;
    e2bAvailable = true;
    log.info('Sandbox test runner available');
    return true;
  } catch (error) {
    log.error('Failed to initialize E2B for test runner', {
      error: (error as Error).message,
    });
    e2bAvailable = false;
    return false;
  }
}

async function getTestSandbox(): Promise<
  InstanceType<typeof import('@e2b/code-interpreter').Sandbox>
> {
  if (!Sandbox) throw new Error('E2B not initialized');

  const now = Date.now();

  if (testSandbox && now - sandboxLastUsed > SANDBOX_IDLE_CLEANUP_MS) {
    try {
      await testSandbox.kill();
    } catch {
      /* ignore */
    }
    testSandbox = null;
  }

  if (!testSandbox) {
    log.info('Creating new test runner sandbox');
    testSandbox = await Sandbox.create({ timeoutMs: SANDBOX_TIMEOUT_MS });

    // Pre-install common test frameworks
    testSandbox.commands
      .run('pip install pytest pytest-cov flake8 mypy black 2>/dev/null', {
        timeoutMs: 180000,
      })
      .catch(() => {});

    testSandbox.commands
      .run('npm install -g jest typescript eslint 2>/dev/null', {
        timeoutMs: 180000,
      })
      .catch(() => {});
  }

  sandboxLastUsed = now;
  return testSandbox;
}

// ============================================================================
// LANGUAGE-SPECIFIC DEFAULTS
// ============================================================================

interface LanguageDefaults {
  extension: string;
  testExtension: string;
  testCommand: string;
  lintCommand: string;
  typecheckCommand: string;
  buildCommand: string;
}

const LANGUAGE_DEFAULTS: Record<string, LanguageDefaults> = {
  python: {
    extension: '.py',
    testExtension: '_test.py',
    testCommand: 'python -m pytest -v',
    lintCommand: 'python -m flake8 --max-line-length=120',
    typecheckCommand: 'python -m mypy --ignore-missing-imports',
    buildCommand: 'python -m py_compile',
  },
  javascript: {
    extension: '.js',
    testExtension: '.test.js',
    testCommand: 'npx jest --no-cache',
    lintCommand: 'npx eslint',
    typecheckCommand: 'echo "No type checking for plain JavaScript"',
    buildCommand: 'node --check',
  },
  typescript: {
    extension: '.ts',
    testExtension: '.test.ts',
    testCommand: 'npx jest --no-cache',
    lintCommand: 'npx eslint',
    typecheckCommand: 'npx tsc --noEmit',
    buildCommand: 'npx tsc',
  },
  go: {
    extension: '.go',
    testExtension: '_test.go',
    testCommand: 'go test -v ./...',
    lintCommand: 'go vet ./...',
    typecheckCommand: 'go build ./...',
    buildCommand: 'go build -o /dev/null',
  },
  rust: {
    extension: '.rs',
    testExtension: '.rs',
    testCommand: 'cargo test',
    lintCommand: 'cargo clippy',
    typecheckCommand: 'cargo check',
    buildCommand: 'cargo build',
  },
};

// ============================================================================
// COMMAND RUNNER
// ============================================================================

async function runCommand(
  sandbox: InstanceType<typeof import('@e2b/code-interpreter').Sandbox>,
  command: string,
  label: string
): Promise<{ success: boolean; output: string; exitCode: number }> {
  const startTime = Date.now();
  log.info(`Running ${label}`, { command });

  const result = await sandbox.commands.run(command, {
    timeoutMs: EXECUTION_TIMEOUT_MS,
  });

  const elapsed = Date.now() - startTime;
  const output = (result.stdout + '\n' + result.stderr).trim();

  log.info(`${label} complete`, {
    exitCode: result.exitCode,
    elapsed: `${elapsed}ms`,
  });

  return {
    success: result.exitCode === 0,
    output: output.slice(0, MAX_OUTPUT_LENGTH),
    exitCode: result.exitCode,
  };
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeSandboxTestRunner(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'sandbox_test_runner') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const available = await initE2B();
  if (!available) {
    return {
      toolCallId: id,
      content: 'Test runner not available. E2B_API_KEY not configured.',
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? {} : rawArgs;
  const action = args.action as string;
  const language = ((args.language as string) || 'python').toLowerCase();
  const code = args.code as string | undefined;
  const testCode = args.test_code as string | undefined;
  const customCommand = args.command as string | undefined;
  const steps = args.steps as string[] | undefined;

  if (!action) {
    return { toolCallId: id, content: 'action is required.', isError: true };
  }

  const sessionId = toolCall.sessionId || `test_${Date.now()}`;
  const costCheck = canExecuteTool(sessionId, 'sandbox_test_runner', TOOL_COST);
  if (!costCheck.allowed) {
    return { toolCallId: id, content: `Cannot execute: ${costCheck.reason}`, isError: true };
  }

  try {
    const sandbox = await getTestSandbox();
    const defaults = LANGUAGE_DEFAULTS[language] || LANGUAGE_DEFAULTS.python;

    // Write code files if provided
    const workDir = `/tmp/test_${Date.now()}`;
    await sandbox.commands.run(`mkdir -p ${workDir}`, { timeoutMs: 5000 });

    if (code) {
      const mainFile = `${workDir}/main${defaults.extension}`;
      await sandbox.files.write(mainFile, code);
    }

    if (testCode) {
      const testFile = `${workDir}/test_main${defaults.testExtension}`;
      await sandbox.files.write(testFile, testCode);
    }

    let result: { success: boolean; output: string; exitCode: number };
    const outputs: string[] = [];

    switch (action) {
      case 'test': {
        const cmd = customCommand || `cd ${workDir} && ${defaults.testCommand} .`;
        result = await runCommand(sandbox, cmd, 'Test');
        break;
      }

      case 'lint': {
        const cmd = customCommand || `cd ${workDir} && ${defaults.lintCommand} .`;
        result = await runCommand(sandbox, cmd, 'Lint');
        break;
      }

      case 'typecheck': {
        const cmd = customCommand || `cd ${workDir} && ${defaults.typecheckCommand} .`;
        result = await runCommand(sandbox, cmd, 'Type check');
        break;
      }

      case 'build': {
        const target = code ? `${workDir}/main${defaults.extension}` : workDir;
        const cmd = customCommand || `cd ${workDir} && ${defaults.buildCommand} ${target}`;
        result = await runCommand(sandbox, cmd, 'Build');
        break;
      }

      case 'pipeline': {
        if (!steps || steps.length === 0) {
          return {
            toolCallId: id,
            content: 'steps array is required for pipeline action.',
            isError: true,
          };
        }

        let allPassed = true;
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const stepCmd = step.includes(workDir) ? step : `cd ${workDir} && ${step}`;
          const stepResult = await runCommand(sandbox, stepCmd, `Pipeline step ${i + 1}`);

          outputs.push(
            `--- Step ${i + 1}: ${step} ---\nExit code: ${stepResult.exitCode}\n${stepResult.output}\n`
          );

          if (!stepResult.success) {
            allPassed = false;
            outputs.push(`\n** Pipeline STOPPED at step ${i + 1} (failed) **`);
            break;
          }
        }

        result = {
          success: allPassed,
          output: outputs.join('\n'),
          exitCode: allPassed ? 0 : 1,
        };
        break;
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown action: ${action}. Use: test, lint, typecheck, build, pipeline.`,
          isError: true,
        };
    }

    recordToolCost(sessionId, 'sandbox_test_runner', TOOL_COST);

    const icon = result.success ? 'PASS' : 'FAIL';
    return {
      toolCallId: id,
      content: `[${icon}] ${action} (${language}) — exit code ${result.exitCode}\n\n${result.output}`,
      isError: !result.success,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Test runner failed', { action, language, error: errMsg });
    return {
      toolCallId: id,
      content: `Test runner failed: ${errMsg}`,
      isError: true,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

export async function isSandboxTestRunnerAvailable(): Promise<boolean> {
  return initE2B();
}

export async function cleanupTestSandbox(): Promise<void> {
  if (testSandbox) {
    try {
      await testSandbox.kill();
      testSandbox = null;
      log.info('Test sandbox cleaned up');
    } catch (error) {
      log.warn('Error cleaning up test sandbox', { error: (error as Error).message });
    }
  }
}
