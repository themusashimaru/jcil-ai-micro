/**
 * WORKSPACE TOOL
 *
 * Provides full workspace capabilities for the AI:
 * - Execute bash commands
 * - Read/write files
 * - List directory contents
 * - Git operations
 *
 * Uses E2B sandbox for secure execution.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('WorkspaceTool');

// Track E2B availability
let e2bAvailable: boolean | null = null;
let Sandbox: typeof import('@e2b/code-interpreter').Sandbox | null = null;
let sharedSandbox: InstanceType<typeof import('@e2b/code-interpreter').Sandbox> | null = null;
let sandboxLastUsed = 0;
const SANDBOX_TIMEOUT_MS = 600000; // 10 minutes for workspace operations
const SANDBOX_IDLE_CLEANUP_MS = 300000; // 5 min idle

// Dangerous command patterns
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+(-[a-zA-Z]*\s+)*(-r|-f|--recursive|--force)/i,
  /\brm\s+(-[a-zA-Z]*\s+)*(\/|~)($|\s|;|&|\|)/i,
  /\b(shutdown|reboot|halt|poweroff)\b/i,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;?\s*:/i,
  /\bsudo\b/i,
  /\bsu\s+(-|root)/i,
];

async function initE2B(): Promise<boolean> {
  if (e2bAvailable !== null) return e2bAvailable;
  try {
    if (!process.env.E2B_API_KEY) {
      log.warn('E2B_API_KEY not configured');
      e2bAvailable = false;
      return false;
    }
    const e2bModule = await import('@e2b/code-interpreter');
    Sandbox = e2bModule.Sandbox;
    e2bAvailable = true;
    return true;
  } catch (error) {
    log.error('Failed to initialize E2B', { error: (error as Error).message });
    e2bAvailable = false;
    return false;
  }
}

async function getSandbox(): Promise<InstanceType<typeof import('@e2b/code-interpreter').Sandbox>> {
  if (!Sandbox) throw new Error('E2B not initialized');
  const now = Date.now();
  if (sharedSandbox && now - sandboxLastUsed > SANDBOX_IDLE_CLEANUP_MS) {
    try { await sharedSandbox.kill(); } catch { /* ignore */ }
    sharedSandbox = null;
  }
  if (!sharedSandbox) {
    log.info('Creating workspace sandbox');
    sharedSandbox = await Sandbox.create({ timeoutMs: SANDBOX_TIMEOUT_MS });
    // Install git and common tools
    sharedSandbox.commands.run('apt-get update && apt-get install -y git', { timeoutMs: 60000 }).catch(() => {});
  }
  sandboxLastUsed = now;
  return sharedSandbox;
}

function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { safe: false, reason: 'Command matches dangerous pattern' };
    }
  }
  return { safe: true };
}

export const workspaceTool: UnifiedTool = {
  name: 'workspace',
  description: `Execute workspace operations for coding tasks. Operations:
- bash: Run shell commands (npm, pip, git, ls, cat, etc.)
- read_file: Read contents of a file
- write_file: Create or overwrite a file
- list_files: List directory contents
- git_clone: Clone a repository
- git_status: Check git status
- git_commit: Commit changes
- git_push: Push to remote

Use this when user wants to:
- Build/run code projects
- Manage files
- Use git version control
- Install dependencies
- Run tests`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['bash', 'read_file', 'write_file', 'list_files', 'git_clone', 'git_status', 'git_commit', 'git_push'],
        description: 'The operation to perform',
      },
      command: { type: 'string', description: 'For bash: the command to run' },
      path: { type: 'string', description: 'File or directory path' },
      content: { type: 'string', description: 'For write_file: content to write' },
      url: { type: 'string', description: 'For git_clone: repository URL' },
      message: { type: 'string', description: 'For git_commit: commit message' },
    },
    required: ['operation'],
  },
};

export async function executeWorkspace(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, command, path, content, url, message } = args;

    const available = await initE2B();
    if (!available) {
      return { toolCallId: id, content: 'Workspace not available (E2B not configured)', isError: true };
    }

    const sandbox = await getSandbox();
    let result: string;

    switch (operation) {
      case 'bash': {
        if (!command) {
          return { toolCallId: id, content: 'Command required for bash operation', isError: true };
        }
        const safety = isCommandSafe(command);
        if (!safety.safe) {
          return { toolCallId: id, content: `Command blocked: ${safety.reason}`, isError: true };
        }
        const cmdResult = await sandbox.commands.run(command, { timeoutMs: 60000 });
        result = cmdResult.stdout + (cmdResult.stderr ? `\nSTDERR: ${cmdResult.stderr}` : '');
        break;
      }

      case 'read_file': {
        if (!path) {
          return { toolCallId: id, content: 'Path required for read_file', isError: true };
        }
        const readResult = await sandbox.commands.run(`cat "${path}"`, { timeoutMs: 10000 });
        result = readResult.stdout || readResult.stderr || '(empty file)';
        break;
      }

      case 'write_file': {
        if (!path || content === undefined) {
          return { toolCallId: id, content: 'Path and content required for write_file', isError: true };
        }
        // Use heredoc to write content - escape content properly
        const safeContent = content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        await sandbox.commands.run(`mkdir -p "$(dirname "${path}")" && cat > "${path}" << 'EOFCONTENT'\n${safeContent}\nEOFCONTENT`, { timeoutMs: 10000 });
        result = `File written: ${path}`;
        break;
      }

      case 'list_files': {
        const targetPath = path || '.';
        const lsResult = await sandbox.commands.run(`ls -la "${targetPath}"`, { timeoutMs: 10000 });
        result = lsResult.stdout || lsResult.stderr;
        break;
      }

      case 'git_clone': {
        if (!url) {
          return { toolCallId: id, content: 'URL required for git_clone', isError: true };
        }
        const cloneResult = await sandbox.commands.run(`git clone "${url}"`, { timeoutMs: 120000 });
        result = cloneResult.stdout + cloneResult.stderr;
        break;
      }

      case 'git_status': {
        const statusResult = await sandbox.commands.run('git status', { timeoutMs: 10000 });
        result = statusResult.stdout || statusResult.stderr;
        break;
      }

      case 'git_commit': {
        if (!message) {
          return { toolCallId: id, content: 'Message required for git_commit', isError: true };
        }
        await sandbox.commands.run('git add -A', { timeoutMs: 10000 });
        const commitResult = await sandbox.commands.run(`git commit -m "${message}"`, { timeoutMs: 10000 });
        result = commitResult.stdout + commitResult.stderr;
        break;
      }

      case 'git_push': {
        const pushResult = await sandbox.commands.run('git push', { timeoutMs: 60000 });
        result = pushResult.stdout + pushResult.stderr;
        break;
      }

      default:
        return { toolCallId: id, content: `Unknown operation: ${operation}`, isError: true };
    }

    return { toolCallId: id, content: result || '(no output)' };
  } catch (error) {
    log.error('Workspace error', { error: (error as Error).message });
    return { toolCallId: id, content: `Error: ${(error as Error).message}`, isError: true };
  }
}

export async function isWorkspaceAvailable(): Promise<boolean> {
  return initE2B();
}
