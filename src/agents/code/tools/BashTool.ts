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
  'npm',
  'npx',
  'yarn',
  'pnpm',
  'bun',
  'node',
  'deno',
  'tsx',
  'ts-node',
  'python',
  'python3',
  'pip',
  'pip3',
  'tsc',
  'eslint',
  'prettier',
  'jest',
  'vitest',
  'mocha',
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'grep',
  'find',
  'pwd',
  'echo',
  'env',
  'which',
  'whereis',
  'git', // Read-only git operations
  'curl',
  'wget', // For API testing
  'mkdir',
  'touch',
  'cp',
  'mv', // File operations
];

// Commands that are explicitly blocked
const BLOCKED_COMMANDS = [
  'rm -rf',
  'rm -r',
  'rmdir',
  'sudo',
  'su',
  'chmod',
  'chown',
  'chgrp',
  'kill',
  'killall',
  'pkill',
  'shutdown',
  'reboot',
  'halt',
  'dd',
  'mkfs',
  'fdisk',
  'mount',
  'umount',
  'systemctl',
  'service',
  'iptables',
  'ufw',
  'passwd',
  'useradd',
  'userdel',
  'crontab',
  '>',
  '>>',
  '|', // Blocked in raw form (but allowed in safe contexts)
];

export class BashTool extends BaseTool {
  name = 'bash';
  description =
    'Execute shell commands in a sandboxed environment. Use for running tests, builds, and inspecting files.';

  private sandboxUrl?: string;
  private oidcToken?: string;

  /**
   * Initialize with sandbox configuration
   */
  initialize(config: { sandboxUrl?: string; oidcToken?: string }): void {
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
      const result = await this.executeInSandbox(input.command, input.workingDirectory, timeout);

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
   * Validate command safety - comprehensive shell injection prevention
   */
  private validateCommandSafety(command: string): { safe: boolean; reason?: string } {
    const trimmed = command.trim();

    // 1. Block command substitution ($() and backticks) - these can execute arbitrary code
    if (/\$\(|\$\{|`/.test(trimmed)) {
      return {
        safe: false,
        reason: 'Command substitution ($(), ${}, backticks) is not allowed for security reasons.',
      };
    }

    // 2. Block command chaining outside of quoted strings
    // This prevents: cmd1 && cmd2, cmd1 || cmd2, cmd1; cmd2
    const chainingCheck = this.detectUnquotedChaining(trimmed);
    if (chainingCheck.found) {
      return {
        safe: false,
        reason: `Command chaining with "${chainingCheck.operator}" is not allowed. Execute commands one at a time.`,
      };
    }

    // 3. Block dangerous redirections outside quoted strings (prevent file overwrite attacks)
    const redirectionCheck = this.detectDangerousRedirection(trimmed);
    if (redirectionCheck.found) {
      return {
        safe: false,
        reason: `Dangerous redirection "${redirectionCheck.pattern}" is not allowed.`,
      };
    }

    // 4. Block process substitution
    if (/<\(|>\(/.test(trimmed)) {
      return {
        safe: false,
        reason: 'Process substitution (<() or >()) is not allowed.',
      };
    }

    // 5. Check for blocked commands/patterns
    const cmdLower = trimmed.toLowerCase();
    for (const blocked of BLOCKED_COMMANDS) {
      // Skip operators that are handled separately above
      if (['>', '>>', '|'].includes(blocked)) continue;

      // Check if blocked command appears (with word boundary awareness)
      const blockedPattern = new RegExp(`\\b${this.escapeRegex(blocked)}\\b`, 'i');
      if (blockedPattern.test(cmdLower)) {
        return {
          safe: false,
          reason: `Blocked command: "${blocked}". This command is not allowed for security reasons.`,
        };
      }
    }

    // 6. Extract and validate the base command
    const baseCmd = this.extractBaseCommand(trimmed);
    if (!baseCmd) {
      return {
        safe: false,
        reason: 'Could not determine base command.',
      };
    }

    const isAllowed = ALLOWED_COMMANDS.some(
      (allowed) => baseCmd === allowed || baseCmd.startsWith(allowed + '.')
    );

    if (!isAllowed) {
      return {
        safe: false,
        reason: `Command "${baseCmd}" is not in the allowed list. Allowed: ${ALLOWED_COMMANDS.slice(0, 10).join(', ')}...`,
      };
    }

    // 7. Additional git safety checks
    if (baseCmd === 'git') {
      const dangerousGitOps = [
        { pattern: /\bpush\b.*--force/, reason: 'force push' },
        { pattern: /\bpush\b.*-f\b/, reason: 'force push' },
        { pattern: /\breset\b.*--hard/, reason: 'hard reset' },
        { pattern: /\bclean\b.*-[fd]/, reason: 'clean with force/directory' },
      ];
      for (const op of dangerousGitOps) {
        if (op.pattern.test(cmdLower)) {
          return {
            safe: false,
            reason: `Dangerous git operation: ${op.reason}. This could cause data loss.`,
          };
        }
      }
    }

    // 8. Block curl/wget to sensitive endpoints
    if (baseCmd === 'curl' || baseCmd === 'wget') {
      const sensitivePatterns = [
        /169\.254\.169\.254/, // AWS metadata
        /metadata\.google/, // GCP metadata
        /localhost/,
        /127\.0\.0\.1/,
        /0\.0\.0\.0/,
        /\[::1\]/,
      ];
      for (const pattern of sensitivePatterns) {
        if (pattern.test(trimmed)) {
          return {
            safe: false,
            reason: 'Accessing internal/metadata endpoints is not allowed.',
          };
        }
      }
    }

    return { safe: true };
  }

  /**
   * Detect command chaining operators outside of quoted strings
   * Returns the first found operator or null
   */
  private detectUnquotedChaining(command: string): { found: boolean; operator?: string } {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      const nextChar = command[i + 1];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      // Only check for operators outside of quotes
      if (!inSingleQuote && !inDoubleQuote) {
        // Check for &&
        if (char === '&' && nextChar === '&') {
          return { found: true, operator: '&&' };
        }
        // Check for ||
        if (char === '|' && nextChar === '|') {
          return { found: true, operator: '||' };
        }
        // Check for single | (pipe) - also a form of chaining
        if (char === '|' && nextChar !== '|') {
          return { found: true, operator: '|' };
        }
        // Check for ; (semicolon)
        if (char === ';') {
          return { found: true, operator: ';' };
        }
        // Check for & (background execution - can be used for timing attacks)
        if (char === '&' && nextChar !== '&') {
          return { found: true, operator: '&' };
        }
      }
    }

    return { found: false };
  }

  /**
   * Detect dangerous redirections outside of quoted strings
   */
  private detectDangerousRedirection(command: string): { found: boolean; pattern?: string } {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      const nextChar = command[i + 1];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      // Only check for redirections outside of quotes
      if (!inSingleQuote && !inDoubleQuote) {
        // Check for output redirections
        if (char === '>') {
          if (nextChar === '>') {
            return { found: true, pattern: '>>' };
          }
          return { found: true, pattern: '>' };
        }
        // Check for input redirection (can be used to read files)
        if (char === '<' && nextChar !== '(') {
          return { found: true, pattern: '<' };
        }
      }
    }

    return { found: false };
  }

  /**
   * Extract the base command from a command string
   * Handles paths, env vars prefix, and more
   */
  private extractBaseCommand(command: string): string {
    // Skip env var assignments at the start (e.g., "FOO=bar npm test")
    let cmd = command.trim();
    while (/^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/.test(cmd)) {
      cmd = cmd.replace(/^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/, '');
    }

    // Get the first word (the command)
    const firstWord = cmd.split(/\s+/)[0] || '';

    // If it's a path, extract just the command name
    const cmdName = firstWord.split('/').pop() || '';

    return cmdName.toLowerCase();
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      if (!result.success) break; // Stop on first failure
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
