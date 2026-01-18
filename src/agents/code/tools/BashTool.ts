/**
 * BASH TOOL
 *
 * Executes shell commands in the Vercel Sandbox.
 * Provides safe, sandboxed command execution.
 *
 * Safety features:
 * - Command allowlist
 * - Timeout enforcement
 * - Output truncation
 * - No destructive commands
 */

import { BaseTool, ToolInput, ToolOutput, ToolDefinition } from './BaseTool';

interface BashInput extends ToolInput {
  command: string;
  workingDirectory?: string;
  timeout?: number;
  env?: Record<string, string>;
}

interface BashOutput extends ToolOutput {
  result?: {
    stdout: string;
    stderr: string;
    exitCode: number;
    duration: number;
    truncated: boolean;
  };
}

// Commands that are safe to execute
const ALLOWED_COMMANDS = [
  'npm', 'npx', 'yarn', 'pnpm', 'bun',
  'node', 'deno', 'tsx', 'ts-node',
  'python', 'python3', 'pip', 'pip3',
  'tsc', 'eslint', 'prettier', 'jest', 'vitest', 'mocha',
  'ls', 'cat', 'head', 'tail', 'wc', 'grep', 'find',
  'pwd', 'echo', 'env', 'which', 'whereis',
  'git',  // Read-only git operations
  'curl', 'wget',  // For API testing
  'mkdir', 'touch', 'cp', 'mv',  // File operations
];

// Commands that are explicitly blocked
const BLOCKED_COMMANDS = [
  'rm -rf', 'rm -r', 'rmdir',
  'sudo', 'su',
  'chmod', 'chown', 'chgrp',
  'kill', 'killall', 'pkill',
  'shutdown', 'reboot', 'halt',
  'dd', 'mkfs', 'fdisk', 'mount', 'umount',
  'systemctl', 'service',
  'iptables', 'ufw',
  'passwd', 'useradd', 'userdel',
  'crontab',
  '>', '>>', '|',  // Blocked in raw form (but allowed in safe contexts)
];

export class BashTool extends BaseTool {
  name = 'bash';
  description = 'Execute shell commands in a sandboxed environment. Use for running tests, builds, and inspecting files.';

  private sandboxUrl?: string;
  private oidcToken?: string;

  /**
   * Initialize with sandbox configuration
   */
  initialize(config: {
    sandboxUrl?: string;
    oidcToken?: string;
  }): void {
    this.sandboxUrl = config.sandboxUrl || process.env.VERCEL_SANDBOX_URL;
    this.oidcToken = config.oidcToken;
  }

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute (e.g., "npm test", "ls -la")',
            required: true,
          },
          workingDirectory: {
            type: 'string',
            description: 'Working directory for the command (default: project root)',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 30000, max: 120000)',
          },
        },
        required: ['command'],
      },
    };
  }

  async execute(input: BashInput): Promise<BashOutput> {
    const startTime = Date.now();

    const validationError = this.validateInput(input, ['command']);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Validate command safety
    const safetyCheck = this.validateCommandSafety(input.command);
    if (!safetyCheck.safe) {
      return {
        success: false,
        error: safetyCheck.reason,
        metadata: { executionTime: 0 },
      };
    }

    const timeout = Math.min(input.timeout || 30000, 120000);

    try {
      if (!this.sandboxUrl) {
        // No sandbox configured - return honest error (no fake simulations)
        return this.handleNoSandbox(input.command, startTime);
      }

      // Execute in Vercel Sandbox
      const result = await this.executeInSandbox(
        input.command,
        input.workingDirectory,
        timeout
      );

      return {
        success: result.exitCode === 0,
        result: {
          stdout: this.truncateOutput(result.stdout),
          stderr: this.truncateOutput(result.stderr),
          exitCode: result.exitCode,
          duration: Date.now() - startTime,
          truncated: result.stdout.length > 10000 || result.stderr.length > 10000,
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Validate command safety
   */
  private validateCommandSafety(command: string): { safe: boolean; reason?: string } {
    const cmdLower = command.toLowerCase().trim();

    // Check for blocked patterns
    for (const blocked of BLOCKED_COMMANDS) {
      if (cmdLower.includes(blocked.toLowerCase())) {
        return {
          safe: false,
          reason: `Blocked command pattern: "${blocked}". This command is not allowed for security reasons.`,
        };
      }
    }

    // Extract base command
    const baseCmd = cmdLower.split(' ')[0].split('/').pop() || '';

    // Check if base command is allowed
    const isAllowed = ALLOWED_COMMANDS.some(allowed =>
      baseCmd === allowed || baseCmd.startsWith(allowed + '.')
    );

    if (!isAllowed) {
      return {
        safe: false,
        reason: `Command "${baseCmd}" is not in the allowed list. Allowed: ${ALLOWED_COMMANDS.slice(0, 10).join(', ')}...`,
      };
    }

    // Additional git safety checks
    if (baseCmd === 'git') {
      const dangerousGitCmds = ['push', 'force', 'reset --hard', 'clean -fd'];
      for (const dangerous of dangerousGitCmds) {
        if (cmdLower.includes(dangerous)) {
          return {
            safe: false,
            reason: `Dangerous git operation: "${dangerous}". Use with caution.`,
          };
        }
      }
    }

    return { safe: true };
  }

  /**
   * Execute command in Vercel Sandbox
   */
  private async executeInSandbox(
    command: string,
    workingDirectory?: string,
    timeout: number = 30000
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.sandboxUrl}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.oidcToken && { Authorization: `Bearer ${this.oidcToken}` }),
        },
        body: JSON.stringify({
          command,
          cwd: workingDirectory || '/project',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Sandbox error: ${response.status}`);
      }

      const data = await response.json();
      return {
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        exitCode: data.exitCode ?? 0,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Command timed out after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Handle missing sandbox configuration - return honest error
   * NO MORE FAKE SIMULATED RESPONSES
   */
  private handleNoSandbox(command: string, startTime: number): BashOutput {
    // Return an honest error - no fake responses
    return {
      success: false,
      error: 'Sandbox not configured. Shell execution requires a sandbox environment.',
      result: {
        stdout: '',
        stderr: `ERROR: Shell execution is not available.

To enable shell command execution, configure one of the following:

1. VERCEL_SANDBOX_URL - Vercel sandbox for command execution
2. E2B_API_KEY - E2B sandbox for isolated code execution

Command attempted: ${command}

For development, you can:
- Set up a local development sandbox
- Use E2B (https://e2b.dev) for cloud sandboxes
- Configure Vercel's sandbox environment

See docs/CODE_LAB.md for setup instructions.`,
        exitCode: 1,
        duration: Date.now() - startTime,
        truncated: false,
      },
      metadata: {
        executionTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Truncate long output
   */
  private truncateOutput(output: string, maxLength: number = 10000): string {
    if (output.length <= maxLength) return output;
    return output.substring(0, maxLength) + '\n... [truncated]';
  }

  /**
   * Run multiple commands sequentially
   */
  async runSequence(commands: string[]): Promise<BashOutput[]> {
    const results: BashOutput[] = [];
    for (const cmd of commands) {
      const result = await this.execute({ command: cmd });
      results.push(result);
      if (!result.success) break;  // Stop on first failure
    }
    return results;
  }

  /**
   * Check if a command is allowed (for UI validation)
   */
  isAllowed(command: string): boolean {
    return this.validateCommandSafety(command).safe;
  }
}

export const bashTool = new BashTool();
