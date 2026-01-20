/**
 * WRITE TOOL
 *
 * Writes files to:
 * - E2B workspace containers (primary)
 * - GitHub repositories via API (if configured)
 *
 * Features:
 * - Automatic parent directory creation
 * - Path sanitization for security
 * - Binary file support via base64
 * - Workspace isolation
 *
 * Security:
 * - Path traversal prevention via sanitizeFilePath
 * - Restricted to workspace directories only
 * - No access to system paths
 */

import { BaseTool, ToolInput, ToolOutput, ToolDefinition } from './BaseTool';
import { ContainerManager, getContainerManager, getContainerManager } from '@/lib/workspace/container';
import { sanitizeFilePath } from '@/lib/workspace/security';
import { logger } from '@/lib/logger';

const log = logger('WriteTool');

// ============================================================================
// TYPES
// ============================================================================

interface WriteInput extends ToolInput {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
  createDirs?: boolean;
}

interface WriteOutput extends ToolOutput {
  result?: {
    path: string;
    bytesWritten: number;
    created: boolean;
  };
}

// ============================================================================
// WRITE TOOL IMPLEMENTATION
// ============================================================================

export class WriteTool extends BaseTool {
  name = 'write';
  description =
    'Write content to a file in the workspace. Creates the file if it does not exist. Parent directories are created automatically.';

  private workspaceId?: string;
  private githubToken?: string;
  private owner?: string;
  private repo?: string;
  private branch?: string;

  /**
   * Initialize with workspace and optional GitHub context
   */
  initialize(config: {
    workspaceId?: string;
    githubToken?: string;
    owner?: string;
    repo?: string;
    branch?: string;
  }): void {
    this.workspaceId = config.workspaceId;
    this.githubToken = config.githubToken;
    this.owner = config.owner;
    this.repo = config.repo;
    this.branch = config.branch || 'main';
  }

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'File path relative to workspace root (e.g., "src/index.ts"). Parent directories are created automatically.',
            required: true,
          },
          content: {
            type: 'string',
            description: 'The content to write to the file.',
            required: true,
          },
          encoding: {
            type: 'string',
            description:
              'Encoding for the content. Use "base64" for binary files. Defaults to "utf-8".',
            enum: ['utf-8', 'base64'],
          },
        },
        required: ['path', 'content'],
      },
    };
  }

  async execute(input: WriteInput): Promise<WriteOutput> {
    const startTime = Date.now();

    // Validate required fields
    const validationError = this.validateInput(input, ['path', 'content']);
    if (validationError) {
      return { success: false, error: validationError };
    }

    try {
      // Sanitize the file path to prevent path traversal attacks
      const safePath = sanitizeFilePath(input.path, '/workspace');

      // Validate the path is within allowed directories
      if (!this.isPathAllowed(safePath)) {
        return {
          success: false,
          error: `Path not allowed: ${input.path}. Files must be within /workspace, /tmp, or /home directories.`,
        };
      }

      // Determine content to write
      let contentToWrite = input.content;
      if (input.encoding === 'base64') {
        // Validate base64 and convert
        try {
          Buffer.from(input.content, 'base64');
          // Content is already base64, E2B may need raw bytes
          contentToWrite = Buffer.from(input.content, 'base64').toString('utf-8');
        } catch {
          return {
            success: false,
            error: 'Invalid base64 encoding in content',
          };
        }
      }

      // Check if file exists (for created flag)
      let fileExisted = false;

      // Write to workspace container (primary method)
      if (this.workspaceId) {
        const result = await this.writeToWorkspace(safePath, contentToWrite);
        if (!result.success) {
          return result;
        }
        fileExisted = result.existed || false;
      }
      // Fall back to GitHub if no workspace but GitHub is configured
      else if (this.githubToken && this.owner && this.repo) {
        const result = await this.writeToGitHub(safePath, contentToWrite, input.encoding);
        if (!result.success) {
          return result;
        }
        fileExisted = result.existed || false;
      }
      // No backend available
      else {
        return {
          success: false,
          error: 'No write backend configured. Please connect a workspace or repository.',
        };
      }

      const bytesWritten = Buffer.byteLength(contentToWrite, 'utf-8');

      log.info('File written successfully', {
        path: safePath,
        bytesWritten,
        created: !fileExisted,
        workspaceId: this.workspaceId,
      });

      return {
        success: true,
        result: {
          path: safePath,
          bytesWritten,
          created: !fileExisted,
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      log.error('Write failed', {
        path: input.path,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write file',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Write file to E2B workspace container
   */
  private async writeToWorkspace(
    path: string,
    content: string
  ): Promise<{ success: boolean; existed?: boolean; error?: string }> {
    const container = getContainerManager();

    try {
      // Check if file exists (optional - for tracking)
      let existed = false;
      try {
        await container.readFile(this.workspaceId!, path);
        existed = true;
      } catch {
        // File doesn't exist, that's fine
        existed = false;
      }

      // Write the file (E2B auto-creates parent directories)
      await container.writeFile(this.workspaceId!, path, content);

      return { success: true, existed };
    } catch (error) {
      return {
        success: false,
        error: `Workspace write failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Write file to GitHub via API
   */
  private async writeToGitHub(
    path: string,
    content: string,
    _encoding?: string
  ): Promise<{ success: boolean; existed?: boolean; error?: string }> {
    try {
      // First, check if file exists (to get its SHA for update)
      let sha: string | undefined;
      let existed = false;

      const getUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;
      const getResponse = await fetch(getUrl, {
        headers: {
          Authorization: `Bearer ${this.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'JCIL-Code-Agent',
        },
      });

      if (getResponse.ok) {
        const data = await getResponse.json();
        sha = data.sha;
        existed = true;
      }

      // Create or update file
      const putUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
      const putResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'JCIL-Code-Agent',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: existed ? `Update ${path}` : `Create ${path}`,
          content: Buffer.from(content, 'utf-8').toString('base64'),
          branch: this.branch,
          ...(sha && { sha }),
        }),
      });

      if (!putResponse.ok) {
        const error = await putResponse.json();
        return {
          success: false,
          error: `GitHub API error: ${error.message || putResponse.status}`,
        };
      }

      return { success: true, existed };
    } catch (error) {
      return {
        success: false,
        error: `GitHub write failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if path is within allowed directories
   */
  private isPathAllowed(path: string): boolean {
    const allowedPrefixes = ['/workspace', '/tmp', '/home'];

    // Normalize path
    const normalizedPath = path.startsWith('/') ? path : `/workspace/${path}`;

    return allowedPrefixes.some((prefix) => normalizedPath.startsWith(prefix));
  }

  /**
   * Write multiple files at once (parallel)
   */
  async writeMultiple(
    files: Array<{ path: string; content: string }>
  ): Promise<Map<string, WriteOutput>> {
    const results = new Map<string, WriteOutput>();

    const promises = files.map(async (file) => {
      const result = await this.execute({
        path: file.path,
        content: file.content,
      });
      results.set(file.path, result);
    });

    await Promise.all(promises);
    return results;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const writeTool = new WriteTool();
