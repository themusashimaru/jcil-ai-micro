/**
 * WORKSPACE TOOL (Enhancement #2: Persistent Workspace Sessions)
 *
 * Provides full workspace capabilities for the AI:
 * - Execute bash commands
 * - Read/write files
 * - List directory contents
 * - Git operations
 *
 * Uses E2B sandbox for secure execution.
 *
 * ENHANCEMENT #2: Now supports persistent workspace sessions per conversation.
 * - Each conversation gets its own workspace that persists across turns
 * - Uses ContainerManager singleton for proper resource management
 * - Supports workspace handoff context (file tree, git state, etc.)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { getContainerManager, type ExecutionResult } from '@/lib/workspace/container';
import { logger } from '@/lib/logger';

const log = logger('WorkspaceTool');

// Track E2B availability
let e2bAvailable: boolean | null = null;

// Session-to-workspace mapping for Chat (Enhancement #2)
// Maps conversationId -> workspaceId
const conversationWorkspaces = new Map<string, string>();

// Default workspace ID for backward compatibility (shared sandbox mode)
const DEFAULT_WORKSPACE_ID = 'chat-shared-workspace';

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
    e2bAvailable = true;
    return true;
  } catch (error) {
    log.error('Failed to initialize E2B', { error: (error as Error).message });
    e2bAvailable = false;
    return false;
  }
}

/**
 * Get or create a workspace ID for a conversation (Enhancement #2)
 */
export function getWorkspaceForConversation(conversationId?: string): string {
  if (!conversationId) {
    return DEFAULT_WORKSPACE_ID;
  }

  if (!conversationWorkspaces.has(conversationId)) {
    // Create a new workspace ID for this conversation
    const workspaceId = `chat-${conversationId}`;
    conversationWorkspaces.set(conversationId, workspaceId);
    log.info('Created workspace for conversation', { conversationId, workspaceId });
  }

  return conversationWorkspaces.get(conversationId)!;
}

/**
 * Get workspace context for a conversation (Enhancement #2)
 * Returns info about the current workspace state for AI context
 */
export async function getWorkspaceContext(conversationId?: string): Promise<{
  hasWorkspace: boolean;
  workspaceId?: string;
  fileCount?: number;
  gitStatus?: string;
}> {
  if (!await initE2B()) {
    return { hasWorkspace: false };
  }

  const workspaceId = getWorkspaceForConversation(conversationId);
  const container = getContainerManager();

  try {
    const status = await container.getStatus(workspaceId);
    if (!status.isRunning) {
      return { hasWorkspace: false, workspaceId };
    }

    // Get file count
    const files = await container.getFileTree(workspaceId, '/workspace', 2);
    const fileCount = files.filter(f => !f.isDirectory).length;

    // Get git status if it's a git repo
    let gitStatus: string | undefined;
    try {
      const gitResult = await container.executeCommand(workspaceId, 'git status --short 2>/dev/null');
      if (gitResult.exitCode === 0) {
        gitStatus = gitResult.stdout || '(clean)';
      }
    } catch {
      // Not a git repo
    }

    return {
      hasWorkspace: true,
      workspaceId,
      fileCount,
      gitStatus,
    };
  } catch {
    return { hasWorkspace: false, workspaceId };
  }
}

/**
 * Clean up a conversation's workspace (Enhancement #2)
 */
export async function cleanupConversationWorkspace(conversationId: string): Promise<void> {
  const workspaceId = conversationWorkspaces.get(conversationId);
  if (!workspaceId) return;

  try {
    const container = getContainerManager();
    await container.terminateContainer(workspaceId);
    conversationWorkspaces.delete(conversationId);
    log.info('Cleaned up conversation workspace', { conversationId, workspaceId });
  } catch (error) {
    log.warn('Failed to cleanup workspace', { conversationId, error: (error as Error).message });
  }
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
- get_context: Get workspace context (files, git state)

Use this when user wants to:
- Build/run code projects
- Manage files
- Use git version control
- Install dependencies
- Run tests

PERSISTENT WORKSPACE: Each conversation has its own workspace that persists across messages.
Files created in one message are available in subsequent messages.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['bash', 'read_file', 'write_file', 'list_files', 'git_clone', 'git_status', 'git_commit', 'git_push', 'get_context'],
        description: 'The operation to perform',
      },
      command: { type: 'string', description: 'For bash: the command to run' },
      path: { type: 'string', description: 'File or directory path' },
      content: { type: 'string', description: 'For write_file: content to write' },
      url: { type: 'string', description: 'For git_clone: repository URL' },
      message: { type: 'string', description: 'For git_commit: commit message' },
      conversationId: { type: 'string', description: 'Conversation ID for persistent workspace (auto-provided by system)' },
    },
    required: ['operation'],
  },
};

export async function executeWorkspace(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, command, path, content, url, message, conversationId } = args;

    const available = await initE2B();
    if (!available) {
      return { toolCallId: id, content: 'Workspace not available (E2B not configured)', isError: true };
    }

    // Get workspace for this conversation (Enhancement #2: Persistent Workspaces)
    const workspaceId = getWorkspaceForConversation(conversationId);
    const container = getContainerManager();
    let result: string;
    let execResult: ExecutionResult;

    switch (operation) {
      case 'bash': {
        if (!command) {
          return { toolCallId: id, content: 'Command required for bash operation', isError: true };
        }
        const safety = isCommandSafe(command);
        if (!safety.safe) {
          return { toolCallId: id, content: `Command blocked: ${safety.reason}`, isError: true };
        }
        execResult = await container.executeCommand(workspaceId, command, { timeout: 60000 });
        result = execResult.stdout + (execResult.stderr ? `\nSTDERR: ${execResult.stderr}` : '');
        if (execResult.error) {
          result += `\nERROR: ${execResult.error}`;
        }
        break;
      }

      case 'read_file': {
        if (!path) {
          return { toolCallId: id, content: 'Path required for read_file', isError: true };
        }
        try {
          const fileContent = await container.readFile(workspaceId, path.startsWith('/') ? path : `/workspace/${path}`);
          result = fileContent || '(empty file)';
        } catch (error) {
          result = `Error reading file: ${(error as Error).message}`;
        }
        break;
      }

      case 'write_file': {
        if (!path || content === undefined) {
          return { toolCallId: id, content: 'Path and content required for write_file', isError: true };
        }
        try {
          const fullPath = path.startsWith('/') ? path : `/workspace/${path}`;
          await container.writeFile(workspaceId, fullPath, content);
          result = `File written: ${fullPath}`;
        } catch (error) {
          result = `Error writing file: ${(error as Error).message}`;
        }
        break;
      }

      case 'list_files': {
        const targetPath = path ? (path.startsWith('/') ? path : `/workspace/${path}`) : '/workspace';
        try {
          const files = await container.listDirectory(workspaceId, targetPath);
          result = files.map(f => `${f.isDirectory ? 'd' : '-'} ${f.path}`).join('\n') || '(empty directory)';
        } catch {
          // Fall back to ls command
          execResult = await container.executeCommand(workspaceId, `ls -la "${targetPath}"`, { timeout: 10000 });
          result = execResult.stdout || execResult.stderr || '(empty directory)';
        }
        break;
      }

      case 'git_clone': {
        if (!url) {
          return { toolCallId: id, content: 'URL required for git_clone', isError: true };
        }
        execResult = await container.cloneRepository(workspaceId, url, 'main', '/workspace');
        result = execResult.stdout + execResult.stderr;
        break;
      }

      case 'git_status': {
        execResult = await container.executeCommand(workspaceId, 'git status', { timeout: 10000, cwd: '/workspace' });
        result = execResult.stdout || execResult.stderr;
        break;
      }

      case 'git_commit': {
        if (!message) {
          return { toolCallId: id, content: 'Message required for git_commit', isError: true };
        }
        await container.executeCommand(workspaceId, 'git add -A', { timeout: 10000, cwd: '/workspace' });
        // Escape message for shell
        const escapedMessage = message.replace(/"/g, '\\"');
        execResult = await container.executeCommand(workspaceId, `git commit -m "${escapedMessage}"`, { timeout: 10000, cwd: '/workspace' });
        result = execResult.stdout + execResult.stderr;
        break;
      }

      case 'git_push': {
        execResult = await container.executeCommand(workspaceId, 'git push', { timeout: 60000, cwd: '/workspace' });
        result = execResult.stdout + execResult.stderr;
        break;
      }

      case 'get_context': {
        // New operation: Get workspace context (Enhancement #2)
        const context = await getWorkspaceContext(conversationId);
        result = JSON.stringify(context, null, 2);
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

/**
 * Execute workspace with conversation context (Enhancement #2)
 * This is a convenience function for the chat API to use
 */
export async function executeWorkspaceWithConversation(
  toolCall: UnifiedToolCall,
  conversationId: string
): Promise<UnifiedToolResult> {
  // Inject conversationId into the tool call arguments
  const args = typeof toolCall.arguments === 'string'
    ? JSON.parse(toolCall.arguments)
    : toolCall.arguments;

  const enhancedToolCall: UnifiedToolCall = {
    ...toolCall,
    arguments: { ...args, conversationId },
  };

  return executeWorkspace(enhancedToolCall);
}
