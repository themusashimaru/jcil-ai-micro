/**
 * READ TOOL
 *
 * Reads files from (in priority order):
 * 1. E2B workspace containers (if workspaceId configured)
 * 2. GitHub repositories (via GitHub API)
 *
 * Features:
 * - Line number support (read specific ranges)
 * - Multiple file reading
 * - Binary file detection
 * - Encoding detection
 * - Workspace-first strategy for live file access
 */

import { BaseTool, ToolInput, ToolOutput, ToolDefinition } from './BaseTool';
import { ContainerManager } from '@/lib/workspace/container';
import { sanitizeFilePath } from '@/lib/workspace/security';
import { logger } from '@/lib/logger';

const log = logger('ReadTool');

interface ReadInput extends ToolInput {
  path: string;
  startLine?: number;
  endLine?: number;
  encoding?: 'utf-8' | 'base64';
}

interface ReadOutput extends ToolOutput {
  result?: {
    content: string;
    path: string;
    lines: number;
    language: string;
    size: number;
    truncated: boolean;
    source: 'workspace' | 'github';
  };
}

export class ReadTool extends BaseTool {
  name = 'read';
  description =
    'Read file contents from the workspace or repository. Reads from active workspace first, falls back to GitHub. Can read specific line ranges.';

  private workspaceId?: string;
  private githubToken?: string;
  private owner?: string;
  private repo?: string;
  private branch?: string;

  /**
   * Initialize with workspace and GitHub context
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
            description: 'File path relative to workspace/repository root (e.g., "src/index.ts")',
            required: true,
          },
          startLine: {
            type: 'number',
            description: 'Start line number (1-indexed). Omit to read from beginning.',
          },
          endLine: {
            type: 'number',
            description: 'End line number (1-indexed). Omit to read to end.',
          },
        },
        required: ['path'],
      },
    };
  }

  async execute(input: ReadInput): Promise<ReadOutput> {
    const startTime = Date.now();

    const validationError = this.validateInput(input, ['path']);
    if (validationError) {
      return { success: false, error: validationError };
    }

    try {
      let content: string;
      let size: number;
      let source: 'workspace' | 'github';

      // Strategy 1: Try workspace container first (if configured)
      if (this.workspaceId) {
        const workspaceResult = await this.readFromWorkspace(input.path);
        if (workspaceResult.success) {
          content = workspaceResult.content!;
          size = workspaceResult.size!;
          source = 'workspace';
          log.debug('Read from workspace', { path: input.path, size });
        } else if (this.githubToken && this.owner && this.repo) {
          // Fall back to GitHub if file not in workspace
          log.debug('File not in workspace, trying GitHub', { path: input.path });
          const githubResult = await this.readFromGitHub(input.path);
          content = githubResult.content;
          size = githubResult.size;
          source = 'github';
        } else {
          // No fallback available
          return {
            success: false,
            error: workspaceResult.error || `File not found: ${input.path}`,
          };
        }
      }
      // Strategy 2: GitHub only (no workspace)
      else if (this.githubToken && this.owner && this.repo) {
        const result = await this.readFromGitHub(input.path);
        content = result.content;
        size = result.size;
        source = 'github';
      }
      // No backend configured
      else {
        return {
          success: false,
          error: 'No read backend configured. Please connect a workspace or repository.',
        };
      }

      // Apply line range if specified
      let lines = content.split('\n');
      const totalLines = lines.length;

      if (input.startLine || input.endLine) {
        const start = (input.startLine || 1) - 1;
        const end = input.endLine || lines.length;
        lines = lines.slice(start, end);
      }

      // Truncate if too large (> 500 lines or 50KB)
      let truncated = false;
      if (lines.length > 500) {
        lines = lines.slice(0, 500);
        truncated = true;
      }

      const finalContent = lines.join('\n');
      if (finalContent.length > 50000) {
        return {
          success: false,
          error: `File too large (${(size / 1024).toFixed(1)}KB). Use startLine/endLine to read specific sections.`,
        };
      }

      return {
        success: true,
        result: {
          content: finalContent,
          path: input.path,
          lines: totalLines,
          language: this.detectLanguage(input.path),
          size,
          truncated,
          source,
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Read file from E2B workspace container
   */
  private async readFromWorkspace(
    path: string
  ): Promise<{ success: boolean; content?: string; size?: number; error?: string }> {
    const container = new ContainerManager();

    try {
      // Sanitize path for security
      const safePath = sanitizeFilePath(path, '/workspace');

      // Read from container
      const content = await container.readFile(this.workspaceId!, safePath);

      return {
        success: true,
        content,
        size: Buffer.byteLength(content, 'utf-8'),
      };
    } catch (error) {
      // File doesn't exist or other error
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read from workspace',
      };
    }
  }

  /**
   * Read file from GitHub API
   */
  private async readFromGitHub(path: string): Promise<{ content: string; size: number }> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'JCIL-Code-Agent',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`File not found: ${path}`);
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.type !== 'file') {
      throw new Error(`Path is a ${data.type}, not a file`);
    }

    // GitHub returns base64 encoded content
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, size: data.size };
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      rb: 'ruby',
      php: 'php',
      cs: 'csharp',
      cpp: 'cpp',
      c: 'c',
      h: 'c',
      hpp: 'cpp',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      sql: 'sql',
      sh: 'bash',
      bash: 'bash',
      zsh: 'bash',
      yml: 'yaml',
      yaml: 'yaml',
      json: 'json',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      less: 'less',
      md: 'markdown',
      mdx: 'markdown',
      txt: 'text',
      env: 'dotenv',
      dockerfile: 'dockerfile',
      makefile: 'makefile',
      toml: 'toml',
      ini: 'ini',
      cfg: 'ini',
      prisma: 'prisma',
      graphql: 'graphql',
      gql: 'graphql',
    };
    return langMap[ext] || 'text';
  }

  /**
   * Read multiple files at once (parallel)
   */
  async readMultiple(paths: string[]): Promise<Map<string, ReadOutput>> {
    const results = new Map<string, ReadOutput>();
    const promises = paths.map(async (path) => {
      const result = await this.execute({ path });
      results.set(path, result);
    });
    await Promise.all(promises);
    return results;
  }
}

export const readTool = new ReadTool();
