/**
 * GLOB TOOL
 *
 * Finds files matching glob patterns in the workspace.
 * Uses the E2B container's file system for fast pattern matching.
 *
 * Features:
 * - Standard glob patterns (*, **, ?, [abc])
 * - Ignore patterns
 * - Directory filtering
 * - Result limiting for performance
 *
 * Security:
 * - Path sanitization
 * - Restricted to workspace directories
 */

import { BaseTool, ToolInput, ToolOutput, ToolDefinition } from './BaseTool';
import { ContainerManager, getContainerManager } from '@/lib/workspace/container';
import { sanitizeFilePath, sanitizeGlobPattern } from '@/lib/workspace/security';
import { logger } from '@/lib/logger';

const log = logger('GlobTool');

// ============================================================================
// TYPES
// ============================================================================

interface GlobInput extends ToolInput {
  pattern: string;
  cwd?: string;
  ignore?: string[];
  maxResults?: number;
}

interface GlobOutput extends ToolOutput {
  result?: {
    files: string[];
    count: number;
    truncated: boolean;
    pattern: string;
    cwd: string;
  };
}

// ============================================================================
// GLOB TOOL IMPLEMENTATION
// ============================================================================

export class GlobTool extends BaseTool {
  name = 'glob';
  description =
    'Find files matching a glob pattern in the workspace. Supports patterns like "**/*.ts", "src/**/*.js", "*.json".';

  private workspaceId?: string;

  /**
   * Initialize with workspace context
   */
  initialize(config: { workspaceId?: string }): void {
    this.workspaceId = config.workspaceId;
  }

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob pattern to match files (e.g., "**/*.ts", "src/**/*.js", "*.json")',
            required: true,
          },
          cwd: {
            type: 'string',
            description:
              'Directory to search in, relative to workspace root. Defaults to workspace root.',
          },
          ignore: {
            type: 'array',
            description: 'Patterns to ignore (e.g., ["node_modules/**", "dist/**"])',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results to return. Defaults to 1000.',
          },
        },
        required: ['pattern'],
      },
    };
  }

  async execute(input: GlobInput): Promise<GlobOutput> {
    const startTime = Date.now();

    // Validate required fields
    const validationError = this.validateInput(input, ['pattern']);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Check workspace is configured
    if (!this.workspaceId) {
      return {
        success: false,
        error: 'No workspace configured. Glob requires an active workspace.',
      };
    }

    try {
      // Sanitize the pattern
      const safePattern = sanitizeGlobPattern(input.pattern);
      if (!safePattern) {
        return {
          success: false,
          error: 'Invalid glob pattern',
        };
      }

      // Sanitize the working directory
      const cwd = sanitizeFilePath(input.cwd || '/workspace', '/workspace');
      const maxResults = Math.min(input.maxResults || 1000, 5000);

      // Build find command for glob matching
      // Using find with -name or -path for glob patterns
      const findCommand = this.buildFindCommand(safePattern, cwd, input.ignore, maxResults);

      log.debug('Executing glob', { pattern: safePattern, cwd, command: findCommand });

      // Execute in container
      const container = getContainerManager();
      const result = await container.executeCommand(this.workspaceId, findCommand);

      // Parse results
      const files = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((path) => path.replace(/^\.\//, '')); // Remove leading ./

      const truncated = files.length >= maxResults;

      log.info('Glob completed', {
        pattern: safePattern,
        count: files.length,
        truncated,
      });

      return {
        success: true,
        result: {
          files,
          count: files.length,
          truncated,
          pattern: safePattern,
          cwd,
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      log.error('Glob failed', {
        pattern: input.pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute glob',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Build find command for glob pattern matching
   */
  private buildFindCommand(
    pattern: string,
    cwd: string,
    ignore?: string[],
    maxResults: number = 1000
  ): string {
    // Start with find in the directory
    let cmd = `cd ${this.escapeShellArg(cwd)} && find .`;

    // Add type filter for files only
    cmd += ' -type f';

    // Convert glob pattern to find syntax
    if (pattern.includes('**')) {
      // For ** patterns, use -path
      const findPattern = this.globToFindPath(pattern);
      cmd += ` -path ${this.escapeShellArg(findPattern)}`;
    } else if (pattern.includes('/')) {
      // For patterns with paths, use -path
      cmd += ` -path ${this.escapeShellArg('./' + pattern)}`;
    } else {
      // Simple name patterns
      cmd += ` -name ${this.escapeShellArg(pattern)}`;
    }

    // Add ignore patterns
    if (ignore && ignore.length > 0) {
      for (const ignorePattern of ignore) {
        const safeIgnore = sanitizeGlobPattern(ignorePattern);
        if (safeIgnore) {
          if (safeIgnore.includes('**') || safeIgnore.includes('/')) {
            cmd += ` ! -path ${this.escapeShellArg('./' + safeIgnore.replace('**', '*'))}`;
          } else {
            cmd += ` ! -name ${this.escapeShellArg(safeIgnore)}`;
          }
        }
      }
    }

    // Common ignores (always exclude)
    cmd += ' ! -path "*/node_modules/*"';
    cmd += ' ! -path "*/.git/*"';
    cmd += ' ! -path "*/dist/*"';
    cmd += ' ! -path "*/.next/*"';
    cmd += ' ! -path "*/__pycache__/*"';
    cmd += ' ! -path "*/.venv/*"';

    // Limit results
    cmd += ` | head -${maxResults}`;

    return cmd;
  }

  /**
   * Convert glob pattern to find -path pattern
   */
  private globToFindPath(pattern: string): string {
    // Replace ** with * for find command
    // find doesn't support ** but * matches any depth in -path
    let findPattern = pattern.replace(/\*\*/g, '*');

    // Ensure it starts with ./
    if (!findPattern.startsWith('./') && !findPattern.startsWith('*')) {
      findPattern = './' + findPattern;
    } else if (findPattern.startsWith('*') && !findPattern.startsWith('./')) {
      findPattern = './' + findPattern;
    }

    return findPattern;
  }

  /**
   * Escape string for shell argument
   */
  private escapeShellArg(arg: string): string {
    // Use single quotes and escape any single quotes in the string
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Find files matching multiple patterns
   */
  async findMultiple(patterns: string[]): Promise<Map<string, GlobOutput>> {
    const results = new Map<string, GlobOutput>();
    const promises = patterns.map(async (pattern) => {
      const result = await this.execute({ pattern });
      results.set(pattern, result);
    });
    await Promise.all(promises);
    return results;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const globTool = new GlobTool();
