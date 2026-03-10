/**
 * SANDBOX FILE MANAGER TOOL
 *
 * Upload, download, list, and manage files inside E2B sandboxes.
 * Enables data processing workflows: upload CSV → process → download results.
 *
 * Features:
 * - Upload files (text, CSV, JSON, images) into sandbox
 * - Download files from sandbox
 * - List files in sandbox directories
 * - Create directories
 * - Delete files/directories
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import { canExecuteTool, recordToolCost } from './safety';

const log = logger('SandboxFilesTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOOL_COST = 0.005; // $0.005 per file operation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max upload
const MAX_OUTPUT_LENGTH = 200000; // 200KB max output
const SANDBOX_TIMEOUT_MS = 300000; // 5 min sandbox lifetime
const SANDBOX_IDLE_CLEANUP_MS = 120000; // 2 min idle

// E2B lazy loading
let e2bAvailable: boolean | null = null;
let Sandbox: typeof import('@e2b/code-interpreter').Sandbox | null = null;
let sharedSandbox: InstanceType<typeof import('@e2b/code-interpreter').Sandbox> | null = null;
let sandboxLastUsed = 0;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const sandboxFilesTool: UnifiedTool = {
  name: 'sandbox_files',
  description: `Manage files in an E2B sandbox. Use this when:
- User uploads a file and you need to process it (CSV, JSON, text, image)
- You need to create files that the user can download
- You need to prepare data files before running code on them
- You want to save code execution results as downloadable files

Available operations:
- write: Write content to a file in the sandbox
- read: Read a file from the sandbox
- list: List files in a directory
- delete: Delete a file
- mkdir: Create a directory

The sandbox shares state with run_code — files written here can be accessed by code execution.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'File operation to perform',
        enum: ['write', 'read', 'list', 'delete', 'mkdir'],
      },
      path: {
        type: 'string',
        description: 'File or directory path in the sandbox (e.g., /home/user/data.csv)',
      },
      content: {
        type: 'string',
        description: 'File content to write (for write operation). For binary files, use base64.',
      },
      encoding: {
        type: 'string',
        description: 'Content encoding: text (default) or base64',
        enum: ['text', 'base64'],
        default: 'text',
      },
    },
    required: ['operation', 'path'],
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
    if (!process.env.E2B_API_KEY) {
      log.warn('E2B_API_KEY not configured - sandbox files disabled');
      e2bAvailable = false;
      return false;
    }

    const e2bModule = await import('@e2b/code-interpreter');
    Sandbox = e2bModule.Sandbox;
    e2bAvailable = true;
    log.info('Sandbox file manager available');
    return true;
  } catch (error) {
    log.error('Failed to initialize E2B for sandbox files', {
      error: (error as Error).message,
    });
    e2bAvailable = false;
    return false;
  }
}

async function getSandbox(): Promise<InstanceType<typeof import('@e2b/code-interpreter').Sandbox>> {
  if (!Sandbox) throw new Error('E2B not initialized');

  const now = Date.now();

  if (sharedSandbox && now - sandboxLastUsed > SANDBOX_IDLE_CLEANUP_MS) {
    try {
      await sharedSandbox.kill();
    } catch {
      /* ignore */
    }
    sharedSandbox = null;
  }

  if (!sharedSandbox) {
    log.info('Creating new sandbox for file operations');
    sharedSandbox = await Sandbox.create({ timeoutMs: SANDBOX_TIMEOUT_MS });
  }

  sandboxLastUsed = now;
  return sharedSandbox;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeSandboxFiles(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'sandbox_files') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const available = await initE2B();
  if (!available) {
    return {
      toolCallId: id,
      content: 'Sandbox file manager not available. E2B_API_KEY not configured.',
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? {} : rawArgs;
  const operation = args.operation as string;
  const filePath = args.path as string;

  if (!operation || !filePath) {
    return { toolCallId: id, content: 'operation and path are required.', isError: true };
  }

  const sessionId = toolCall.sessionId || `files_${Date.now()}`;
  const costCheck = canExecuteTool(sessionId, 'sandbox_files', TOOL_COST);
  if (!costCheck.allowed) {
    return { toolCallId: id, content: `Cannot execute: ${costCheck.reason}`, isError: true };
  }

  try {
    const sandbox = await getSandbox();
    let result = '';

    switch (operation) {
      case 'write': {
        const content = args.content as string;
        if (!content) {
          return { toolCallId: id, content: 'content is required for write.', isError: true };
        }

        const encoding = (args.encoding as string) || 'text';
        let writeContent = content;

        if (encoding === 'base64') {
          // Decode base64 for binary files
          const decoded = Buffer.from(content, 'base64');
          if (decoded.length > MAX_FILE_SIZE) {
            return {
              toolCallId: id,
              content: `File too large: ${decoded.length} bytes (max ${MAX_FILE_SIZE})`,
              isError: true,
            };
          }
          writeContent = decoded.toString('binary');
        } else if (content.length > MAX_FILE_SIZE) {
          return {
            toolCallId: id,
            content: `Content too large: ${content.length} chars (max ${MAX_FILE_SIZE})`,
            isError: true,
          };
        }

        await sandbox.files.write(filePath, writeContent);
        result = `File written: ${filePath} (${writeContent.length} bytes)`;
        break;
      }

      case 'read': {
        const fileContent = await sandbox.files.read(filePath);
        const truncated = fileContent.slice(0, MAX_OUTPUT_LENGTH);
        result = `File: ${filePath}\nSize: ${fileContent.length} chars\n\n${truncated}${fileContent.length > MAX_OUTPUT_LENGTH ? '\n\n... (truncated)' : ''}`;
        break;
      }

      case 'list': {
        const files = await sandbox.files.list(filePath);
        if (files.length === 0) {
          result = `Directory ${filePath} is empty.`;
        } else {
          const fileList = files
            .map(
              (f: { name: string; type?: string }) =>
                `  ${f.type === 'directory' ? '[DIR] ' : ''}${f.name}`
            )
            .join('\n');
          result = `Contents of ${filePath} (${files.length} items):\n${fileList}`;
        }
        break;
      }

      case 'delete': {
        await sandbox.files.remove(filePath);
        result = `Deleted: ${filePath}`;
        break;
      }

      case 'mkdir': {
        await sandbox.commands.run(`mkdir -p "${filePath}"`, { timeoutMs: 10000 });
        result = `Directory created: ${filePath}`;
        break;
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use: write, read, list, delete, mkdir.`,
          isError: true,
        };
    }

    recordToolCost(sessionId, 'sandbox_files', TOOL_COST);
    log.info('Sandbox file operation complete', { operation, path: filePath });

    return { toolCallId: id, content: result, isError: false };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Sandbox file operation failed', { operation, path: filePath, error: errMsg });
    return {
      toolCallId: id,
      content: `File operation '${operation}' failed: ${errMsg}`,
      isError: true,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

export async function isSandboxFilesAvailable(): Promise<boolean> {
  return initE2B();
}

export async function cleanupSandboxFiles(): Promise<void> {
  if (sharedSandbox) {
    try {
      await sharedSandbox.kill();
      sharedSandbox = null;
      log.info('Sandbox files cleaned up');
    } catch (error) {
      log.warn('Error cleaning up sandbox files', { error: (error as Error).message });
    }
  }
}
