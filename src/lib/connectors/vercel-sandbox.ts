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
import { logger } from '@/lib/logger';

const log = logger('Sandbox');

// Types for sandbox operations
export interface SandboxConfig {
  // For OIDC auth (preferred on Vercel)
  oidcToken?: string;
  // For access token auth (fallback)
  teamId?: string;
  projectId?: string;
  token?: string;
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
  /** vCPUs (2-8, default: 2) - minimum is 2 */
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
    // Check which auth method to use
    const hasOIDC = !!config.oidcToken;

    log.debug('Creating sandbox', {
      authMethod: hasOIDC ? 'OIDC' : 'Access Token',
      hasOidcToken: !!config.oidcToken,
      hasAccessToken: !!config.token,
      runtime: options.runtime || 'node22',
      timeout: options.timeout || ms('5m'),
      vcpus: options.vcpus || 2,
    });

    // Create sandbox - prefer OIDC, fall back to access token
    if (hasOIDC) {
      // OIDC auth - SDK handles authentication via VERCEL_OIDC_TOKEN env var
      // We need to set it temporarily for the SDK to pick up
      const originalOidcToken = process.env.VERCEL_OIDC_TOKEN;
      process.env.VERCEL_OIDC_TOKEN = config.oidcToken;

      try {
        sandbox = await Sandbox.create({
          runtime: options.runtime || 'node22',
          timeout: options.timeout || ms('5m'),
          resources: { vcpus: options.vcpus || 2 },
        });
      } finally {
        // Restore original value
        if (originalOidcToken) {
          process.env.VERCEL_OIDC_TOKEN = originalOidcToken;
        } else {
          delete process.env.VERCEL_OIDC_TOKEN;
        }
      }
    } else {
      // Access token auth - requires teamId, projectId, token
      sandbox = await Sandbox.create({
        teamId: config.teamId!,
        projectId: config.projectId!,
        token: config.token!,
        runtime: options.runtime || 'node22',
        timeout: options.timeout || ms('5m'),
        resources: { vcpus: options.vcpus || 2 },
      });
    }

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
    // Log detailed error info for debugging
    log.error('Sandbox error', error as Error, {
      errorBody: (error as Record<string, unknown>)?.body,
      errorStatus: (error as Record<string, unknown>)?.status,
    });

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
    vcpus: 2, // Minimum is 2 vCPUs
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
 * Supports two authentication methods:
 * 1. OIDC (from request header on Vercel) - preferred
 * 2. Access tokens - needs VERCEL_TEAM_ID, VERCEL_PROJECT_ID, VERCEL_TOKEN
 *
 * @param oidcToken - OIDC token from request header (x-vercel-oidc-token)
 */
export function isSandboxConfigured(oidcToken?: string | null): boolean {
  // OIDC from request header (Vercel serverless functions)
  if (oidcToken) {
    return true;
  }

  // OIDC from env (local dev with vercel env pull)
  if (process.env.VERCEL_OIDC_TOKEN) {
    return true;
  }

  // Fall back to access token auth
  return !!(
    process.env.VERCEL_TEAM_ID &&
    process.env.VERCEL_PROJECT_ID &&
    process.env.VERCEL_TOKEN
  );
}

/**
 * Get sandbox config from environment or OIDC token
 *
 * @param oidcToken - OIDC token from request header (x-vercel-oidc-token)
 */
export function getSandboxConfig(oidcToken?: string | null): SandboxConfig | null {
  if (!isSandboxConfigured(oidcToken)) {
    return null;
  }

  // Prefer OIDC auth (from header or env)
  const effectiveOidcToken = oidcToken || process.env.VERCEL_OIDC_TOKEN;
  if (effectiveOidcToken) {
    return { oidcToken: effectiveOidcToken };
  }

  // Fall back to access token auth
  return {
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID,
    token: process.env.VERCEL_TOKEN,
  };
}

/**
 * Get missing configuration details for error messages
 */
export function getMissingSandboxConfig(oidcToken?: string | null): string[] {
  // If OIDC is available (from header or env), nothing is missing
  if (oidcToken || process.env.VERCEL_OIDC_TOKEN) {
    return [];
  }

  // For access token auth, check all three vars
  const missing: string[] = [];
  if (!process.env.VERCEL_TEAM_ID) missing.push('VERCEL_TEAM_ID');
  if (!process.env.VERCEL_PROJECT_ID) missing.push('VERCEL_PROJECT_ID');
  if (!process.env.VERCEL_TOKEN) missing.push('VERCEL_TOKEN');
  return missing;
}
