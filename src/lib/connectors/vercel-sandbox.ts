/**
 * VERCEL SANDBOX CONNECTOR
 * ========================
 *
 * Execute code in isolated Vercel Sandbox VMs.
 * This enables AI to test code before pushing to GitHub.
 *
 * Features:
 * - Run Node.js/Python code in isolation
 * - Install packages (npm, pip)
 * - Execute builds and tests
 * - File operations
 */

import { Sandbox } from '@vercel/sandbox';
import ms from 'ms';

// Types for sandbox operations
export interface SandboxConfig {
  teamId?: string;  // Optional for personal accounts
  projectId: string;
  token: string;
}

export interface SandboxExecutionOptions {
  /** Code files to create in the sandbox */
  files?: { path: string; content: string }[];
  /** Commands to run (in order) */
  commands: string[];
  /** Runtime: 'node22' or 'python3.13' */
  runtime?: 'node22' | 'python3.13';
  /** Timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
  /** vCPUs (1-8, default: 2) */
  vcpus?: number;
}

export interface SandboxResult {
  success: boolean;
  outputs: CommandOutput[];
  error?: string;
  executionTime: number;
}

export interface CommandOutput {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

/**
 * Execute code in a Vercel Sandbox VM
 */
export async function executeSandbox(
  config: SandboxConfig,
  options: SandboxExecutionOptions
): Promise<SandboxResult> {
  const startTime = Date.now();
  const outputs: CommandOutput[] = [];

  let sandbox: Sandbox | null = null;

  try {
    // Create sandbox with authentication
    sandbox = await Sandbox.create({
      ...(config.teamId && { teamId: config.teamId }),
      projectId: config.projectId,
      token: config.token,
      runtime: options.runtime || 'node22',
      timeout: options.timeout || ms('5m'),
      resources: { vcpus: options.vcpus || 2 },
    });

    // Write files to sandbox if provided
    if (options.files && options.files.length > 0) {
      const filesToWrite = options.files.map(file => ({
        path: file.path,
        content: Buffer.from(file.content, 'utf-8'),
      }));
      await sandbox.writeFiles(filesToWrite);
    }

    // Execute commands
    for (const command of options.commands) {
      const output = await runCommandWithOutput(sandbox, command);
      outputs.push(output);

      // Stop on failure unless it's a test command (we want to see test results)
      if (!output.success && !command.includes('test')) {
        break;
      }
    }

    const allSucceeded = outputs.every(o => o.success);

    return {
      success: allSucceeded,
      outputs,
      executionTime: Date.now() - startTime,
    };

  } catch (error) {
    return {
      success: false,
      outputs,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Date.now() - startTime,
    };
  } finally {
    // Always stop the sandbox
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch {
        // Ignore stop errors
      }
    }
  }
}

/**
 * Run a command and capture output
 */
async function runCommandWithOutput(
  sandbox: Sandbox,
  command: string
): Promise<CommandOutput> {
  try {
    // Parse command into cmd and args
    const parts = parseCommand(command);
    const cmd = parts[0];
    const args = parts.slice(1);

    // Run command with proper overload (cmd, args, opts)
    const isSudo = command.startsWith('sudo ');
    const actualCmd = isSudo ? args[0] || cmd : cmd;
    const actualArgs = isSudo ? args.slice(1) : args;

    const result = await sandbox.runCommand(actualCmd, actualArgs);

    // Get stdout and stderr from the result
    const stdout = await result.stdout();
    const stderr = await result.stderr();

    return {
      command,
      exitCode: result.exitCode,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      success: result.exitCode === 0,
    };
  } catch (error) {
    return {
      command,
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Command failed',
      success: false,
    };
  }
}

/**
 * Parse a command string into cmd and args
 * Handles quoted strings properly
 */
function parseCommand(command: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const char of command) {
    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuote) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Quick test execution - for simple code snippets
 */
export async function quickTest(
  config: SandboxConfig,
  code: string,
  language: 'javascript' | 'typescript' | 'python' = 'javascript'
): Promise<SandboxResult> {
  const runtime = language === 'python' ? 'python3.13' : 'node22';
  const filename = language === 'python' ? 'test.py' :
                   language === 'typescript' ? 'test.ts' : 'test.js';

  const commands = language === 'python'
    ? [`python ${filename}`]
    : language === 'typescript'
    ? ['npx tsx test.ts']
    : [`node ${filename}`];

  return executeSandbox(config, {
    files: [{ path: filename, content: code }],
    commands,
    runtime,
    timeout: ms('2m'),
    vcpus: 1,
  });
}

/**
 * Build and test a project
 */
export async function buildAndTest(
  config: SandboxConfig,
  files: { path: string; content: string }[],
  options: {
    packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
    buildCommand?: string;
    testCommand?: string;
  } = {}
): Promise<SandboxResult> {
  const pm = options.packageManager || 'npm';
  const installCmd = pm === 'npm' ? 'npm install' :
                     pm === 'yarn' ? 'yarn' :
                     pm === 'pnpm' ? 'pnpm install' : 'bun install';

  const commands: string[] = [installCmd];

  if (options.buildCommand) {
    commands.push(options.buildCommand);
  }

  if (options.testCommand) {
    commands.push(options.testCommand);
  }

  return executeSandbox(config, {
    files,
    commands,
    runtime: 'node22',
    timeout: ms('10m'),
    vcpus: 4,
  });
}

/**
 * Check if Vercel Sandbox is configured
 * VERCEL_TEAM_ID is optional (not needed for personal accounts)
 */
export function isSandboxConfigured(): boolean {
  return !!(
    process.env.VERCEL_PROJECT_ID &&
    process.env.VERCEL_TOKEN
  );
}

/**
 * Get sandbox config from environment
 */
export function getSandboxConfig(): SandboxConfig | null {
  if (!isSandboxConfigured()) {
    return null;
  }

  return {
    teamId: process.env.VERCEL_TEAM_ID,  // Optional
    projectId: process.env.VERCEL_PROJECT_ID!,
    token: process.env.VERCEL_TOKEN!,
  };
}
