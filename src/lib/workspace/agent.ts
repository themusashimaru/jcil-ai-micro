/**
 * AI AGENT INTEGRATION
 *
 * This connects Claude/GPT to the workspace infrastructure,
 * enabling true agentic coding capabilities.
 *
 * The AI can:
 * - Execute shell commands
 * - Read/write files
 * - Run git operations
 * - Execute builds/tests
 * - Search the codebase
 * - Make atomic multi-file edits
 */

import Anthropic from '@anthropic-ai/sdk';
import { ContainerManager, WorkspaceExecutor } from './container';
import { CodebaseIndexer, BatchOperationManager } from './index';

// ============================================
// TYPES
// ============================================

export interface AgentConfig {
  workspaceId: string;
  sessionId?: string;
  model?: string;
  maxIterations?: number;
  autoApprove?: boolean; // Auto-approve tool calls (for autonomous mode)
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  isError?: boolean;
}

export interface AgentResponse {
  message: string;
  toolsUsed: string[];
  filesModified: string[];
  commandsExecuted: string[];
  iterations: number;
}

// ============================================
// TOOL DEFINITIONS FOR CLAUDE
// ============================================

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'execute_shell',
    description: 'Execute a shell command in the workspace. Use for running scripts, installing packages, or any CLI operation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        cwd: {
          type: 'string',
          description: 'Working directory (default: /workspace)',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file. Use to understand existing code before making changes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file (relative to /workspace)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it does not exist, overwrites if it does.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file (relative to /workspace)',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Make surgical line-based edits to a file. Specify exact line numbers to replace. More precise than write_file for modifications.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file',
        },
        start_line: {
          type: 'number',
          description: 'Starting line number (1-indexed) to begin replacement',
        },
        end_line: {
          type: 'number',
          description: 'Ending line number (1-indexed, inclusive) to replace through',
        },
        new_content: {
          type: 'string',
          description: 'The new content to replace the specified lines with',
        },
        // Legacy support for text-based edits
        old_text: {
          type: 'string',
          description: '(Legacy) The exact text to find and replace. Use start_line/end_line for precise edits.',
        },
        new_text: {
          type: 'string',
          description: '(Legacy) The new text to replace it with. Use new_content with line numbers instead.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'surgical_edit',
    description: 'Apply multiple surgical line-based edits to a file in a single operation. Supports dry-run preview.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file',
        },
        edits: {
          type: 'array',
          description: 'Array of edits to apply',
          items: {
            type: 'object',
            properties: {
              start_line: {
                type: 'number',
                description: 'Starting line number (1-indexed)',
              },
              end_line: {
                type: 'number',
                description: 'Ending line number (1-indexed, inclusive)',
              },
              new_content: {
                type: 'string',
                description: 'New content to replace the lines with',
              },
            },
            required: ['start_line', 'end_line', 'new_content'],
          },
        },
        dry_run: {
          type: 'boolean',
          description: 'If true, preview changes without applying them',
        },
      },
      required: ['path', 'edits'],
    },
  },
  {
    name: 'list_files',
    description: 'List files and directories in a path.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list (default: /workspace)',
        },
        recursive: {
          type: 'boolean',
          description: 'Include subdirectories (default: false)',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_files',
    description: 'Search for files by name pattern (glob).',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "*.ts", "src/**/*.tsx")',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'search_code',
    description: 'Search for text/patterns in file contents (like grep).',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Text or regex pattern to search for',
        },
        path: {
          type: 'string',
          description: 'Directory to search in (default: /workspace)',
        },
        file_pattern: {
          type: 'string',
          description: 'File pattern to limit search (e.g., "*.ts")',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'git_status',
    description: 'Get the current git status (branch, staged files, changes).',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_commit',
    description: 'Stage all changes and create a commit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: 'Commit message',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific files to stage (default: all)',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'git_diff',
    description: 'Get the diff of changes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        staged: {
          type: 'boolean',
          description: 'Show staged changes only',
        },
        file: {
          type: 'string',
          description: 'Specific file to diff',
        },
      },
      required: [],
    },
  },
  {
    name: 'run_build',
    description: 'Run the project build command (npm run build, cargo build, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'run_tests',
    description: 'Run the project test suite.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Test file pattern or specific test name',
        },
      },
      required: [],
    },
  },
  {
    name: 'install_packages',
    description: 'Install project dependencies (npm install, pip install, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {
        packages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific packages to install (optional)',
        },
      },
      required: [],
    },
  },
  {
    name: 'batch_edit',
    description: 'Make atomic edits to multiple files at once. All changes succeed or all fail.',
    input_schema: {
      type: 'object' as const,
      properties: {
        operations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              action: { type: 'string', enum: ['write', 'delete'] },
              content: { type: 'string' },
            },
            required: ['path', 'action'],
          },
          description: 'Array of file operations',
        },
      },
      required: ['operations'],
    },
  },
  {
    name: 'get_codebase_context',
    description: 'Get relevant code context for a query. Use when you need to understand how something works.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'What you want to find in the codebase',
        },
      },
      required: ['query'],
    },
  },
];

// ============================================
// CODING AGENT
// ============================================

export class CodingAgent {
  private anthropic: Anthropic;
  private config: AgentConfig;
  private executor: WorkspaceExecutor;
  private container: ContainerManager;
  private indexer: CodebaseIndexer;
  private batchOps: BatchOperationManager;

  private filesModified: Set<string> = new Set();
  private commandsExecuted: string[] = [];
  private toolsUsed: Set<string> = new Set();

  constructor(config: AgentConfig) {
    this.anthropic = new Anthropic();
    this.config = {
      model: 'claude-sonnet-4-20250514',
      maxIterations: 20,
      autoApprove: false,
      ...config,
    };

    this.executor = new WorkspaceExecutor(config.workspaceId);
    this.container = new ContainerManager();
    this.indexer = new CodebaseIndexer(config.workspaceId);
    this.batchOps = new BatchOperationManager(config.workspaceId);
  }

  /**
   * Run the agent with a user prompt
   */
  async run(prompt: string): Promise<AgentResponse> {
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    let iterations = 0;
    let finalMessage = '';

    while (iterations < (this.config.maxIterations || 20)) {
      iterations++;

      // Call Claude with tools
      const response = await this.anthropic.messages.create({
        model: this.config.model || 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: this.getSystemPrompt(),
        tools: AGENT_TOOLS,
        messages,
      });

      // Check if we're done
      if (response.stop_reason === 'end_turn') {
        // Extract final text response
        for (const block of response.content) {
          if (block.type === 'text') {
            finalMessage = block.text;
          }
        }
        break;
      }

      // Process tool calls
      if (response.stop_reason === 'tool_use') {
        const assistantContent: Anthropic.ContentBlock[] = response.content;
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const result = await this.executeTool(block.name, block.input as Record<string, unknown>);
            this.toolsUsed.add(block.name);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          } else if (block.type === 'text') {
            finalMessage = block.text;
          }
        }

        // Add assistant message and tool results
        messages.push({
          role: 'assistant',
          content: assistantContent,
        });

        messages.push({
          role: 'user',
          content: toolResults,
        });
      }
    }

    return {
      message: finalMessage,
      toolsUsed: Array.from(this.toolsUsed),
      filesModified: Array.from(this.filesModified),
      commandsExecuted: this.commandsExecuted,
      iterations,
    };
  }

  /**
   * Execute a tool call
   */
  private async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    try {
      switch (name) {
        case 'execute_shell': {
          const result = await this.executor.run(
            input.command as string,
            {
              cwd: (input.cwd as string) || '/workspace',
              timeout: (input.timeout as number) || 30000,
            }
          );
          this.commandsExecuted.push(input.command as string);
          return `Exit code: ${result.exitCode}\n\nOutput:\n${result.stdout}\n${result.stderr ? `\nStderr:\n${result.stderr}` : ''}`;
        }

        case 'read_file': {
          const path = this.normalizePath(input.path as string);
          const content = await this.executor.read(path);
          return content;
        }

        case 'write_file': {
          const path = this.normalizePath(input.path as string);
          await this.executor.write(path, input.content as string);
          this.filesModified.add(path);
          return `File written: ${path}`;
        }

        case 'edit_file': {
          const path = this.normalizePath(input.path as string);
          const content = await this.executor.read(path);

          // Check if using line-based editing (new way) or text-based (legacy)
          if (input.start_line !== undefined && input.end_line !== undefined) {
            // Surgical line-based editing
            const lines = content.split('\n');
            const startLine = input.start_line as number;
            const endLine = input.end_line as number;
            const newContent = input.new_content as string;

            // Validate line numbers
            if (startLine < 1 || endLine < startLine || startLine > lines.length + 1) {
              return `Error: Invalid line numbers. File has ${lines.length} lines. Got start_line=${startLine}, end_line=${endLine}`;
            }

            // Apply surgical edit
            const startIdx = startLine - 1;
            const deleteCount = Math.min(endLine, lines.length) - startLine + 1;
            const newLines = newContent === '' ? [] : newContent.split('\n');

            lines.splice(startIdx, deleteCount, ...newLines);
            const finalContent = lines.join('\n');

            await this.executor.write(path, finalContent);
            this.filesModified.add(path);

            const linesRemoved = deleteCount;
            const linesAdded = newLines.length;
            return `Surgical edit applied to ${path}: replaced lines ${startLine}-${endLine} (${linesRemoved} lines removed, ${linesAdded} lines added)`;
          } else {
            // Legacy text-based editing
            const newContent = content.replace(input.old_text as string, input.new_text as string);

            if (content === newContent) {
              return `Warning: No changes made. The old_text was not found in ${path}. Consider using line-based editing with start_line/end_line for precise edits.`;
            }

            await this.executor.write(path, newContent);
            this.filesModified.add(path);
            return `File edited: ${path}`;
          }
        }

        case 'surgical_edit': {
          const path = this.normalizePath(input.path as string);
          const content = await this.executor.read(path);
          const edits = input.edits as Array<{ start_line: number; end_line: number; new_content: string }>;
          const dryRun = (input.dry_run as boolean) || false;

          const lines = content.split('\n');

          // Validate all edits first
          const sortedEdits = [...edits].sort((a, b) => a.start_line - b.start_line);
          for (let i = 0; i < sortedEdits.length; i++) {
            const edit = sortedEdits[i];
            if (edit.start_line < 1 || edit.end_line < edit.start_line) {
              return `Error: Invalid edit at index ${i}: start_line=${edit.start_line}, end_line=${edit.end_line}`;
            }
            // Check for overlaps
            if (i > 0 && sortedEdits[i - 1].end_line >= edit.start_line) {
              return `Error: Overlapping edits detected between lines ${sortedEdits[i - 1].start_line}-${sortedEdits[i - 1].end_line} and ${edit.start_line}-${edit.end_line}`;
            }
          }

          if (dryRun) {
            // Preview mode - show what would change
            let preview = `DRY RUN - ${edits.length} edits would be applied to ${path}:\n`;
            for (const edit of sortedEdits) {
              const startIdx = edit.start_line - 1;
              const endIdx = Math.min(edit.end_line - 1, lines.length - 1);
              const oldLines = lines.slice(startIdx, endIdx + 1).join('\n');
              preview += `\n--- Lines ${edit.start_line}-${edit.end_line} ---\n`;
              preview += `BEFORE:\n${oldLines}\n`;
              preview += `AFTER:\n${edit.new_content}\n`;
            }
            return preview;
          }

          // Apply edits from bottom to top to preserve line numbers
          const reversedEdits = [...sortedEdits].reverse();
          let totalAdded = 0;
          let totalRemoved = 0;

          for (const edit of reversedEdits) {
            const startIdx = edit.start_line - 1;
            const deleteCount = Math.min(edit.end_line, lines.length) - edit.start_line + 1;
            const newLines = edit.new_content === '' ? [] : edit.new_content.split('\n');

            lines.splice(startIdx, deleteCount, ...newLines);
            totalRemoved += deleteCount;
            totalAdded += newLines.length;
          }

          const finalContent = lines.join('\n');
          await this.executor.write(path, finalContent);
          this.filesModified.add(path);

          return `Surgical edit complete: ${edits.length} edits applied to ${path} (${totalRemoved} lines removed, ${totalAdded} lines added)`;
        }

        case 'list_files': {
          const path = this.normalizePath((input.path as string) || '/workspace');
          const files = await this.container.listDirectory(this.config.workspaceId, path);
          return files.map(f => `${f.isDirectory ? '📁' : '📄'} ${f.path}`).join('\n');
        }

        case 'search_files': {
          const result = await this.executor.run(`find /workspace -name "${input.pattern}" -type f | head -50`);
          return result.stdout || 'No files found';
        }

        case 'search_code': {
          const filePattern = input.file_pattern ? `--include="${input.file_pattern}"` : '';
          const path = this.normalizePath((input.path as string) || '/workspace');
          const result = await this.executor.run(
            `grep -rn "${input.pattern}" ${path} ${filePattern} | head -100`
          );
          return result.stdout || 'No matches found';
        }

        case 'git_status': {
          const status = await this.executor.gitStatus();
          return status;
        }

        case 'git_commit': {
          const files = input.files as string[] | undefined;
          if (files && files.length > 0) {
            await this.executor.run(`git add ${files.join(' ')}`);
          } else {
            await this.executor.run('git add .');
          }
          const result = await this.executor.run(`git commit -m "${(input.message as string).replace(/"/g, '\\"')}"`);
          return result.stdout;
        }

        case 'git_diff': {
          let cmd = 'git diff';
          if (input.staged) cmd += ' --staged';
          if (input.file) cmd += ` -- "${input.file}"`;
          const result = await this.executor.run(cmd);
          return result.stdout || 'No changes';
        }

        case 'run_build': {
          const result = await this.container.runBuild(this.config.workspaceId);
          return `Exit code: ${result.exitCode}\n\n${result.stdout}\n${result.stderr ? `\nErrors:\n${result.stderr}` : ''}`;
        }

        case 'run_tests': {
          let cmd = 'npm test';
          if (input.pattern) {
            cmd += ` -- --grep "${input.pattern}"`;
          }
          const result = await this.executor.run(cmd, { timeout: 300000 });
          return `Exit code: ${result.exitCode}\n\n${result.stdout}\n${result.stderr ? `\nErrors:\n${result.stderr}` : ''}`;
        }

        case 'install_packages': {
          const packages = input.packages as string[] | undefined;
          let cmd = 'npm install';
          if (packages && packages.length > 0) {
            cmd += ` ${packages.join(' ')}`;
          }
          const result = await this.executor.run(cmd, { timeout: 120000 });
          return result.stdout;
        }

        case 'batch_edit': {
          const operations = input.operations as Array<{
            path: string;
            action: 'write' | 'delete';
            content?: string;
          }>;

          const batch = await this.batchOps.createBatch(
            operations.map(op => ({
              type: op.action === 'write' ? 'create' : 'delete',
              path: this.normalizePath(op.path),
              content: op.content,
            }))
          );

          const result = await this.batchOps.execute(batch.id);

          if (result.success) {
            operations.forEach(op => this.filesModified.add(op.path));
            return `Batch operation completed: ${operations.length} files modified`;
          } else {
            return `Batch operation failed: ${result.error}. All changes rolled back.`;
          }
        }

        case 'get_codebase_context': {
          const context = await this.indexer.getContextForQuery(input.query as string, 5);
          return context || 'No relevant context found. Try indexing the codebase first.';
        }

        default:
          return `Unknown tool: ${name}`;
      }
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Normalize file paths
   */
  private normalizePath(path: string): string {
    if (path.startsWith('/')) return path;
    return `/workspace/${path}`;
  }

  /**
   * Get system prompt for the agent
   */
  private getSystemPrompt(): string {
    return `You are an expert software engineer working in a development workspace. You have access to a full Linux environment with shell, file system, and git.

CAPABILITIES:
- Execute any shell command (npm, pip, cargo, etc.)
- Read and write files
- Search the codebase
- Run builds and tests
- Make git commits
- Make atomic multi-file edits

GUIDELINES:
1. Always read files before editing to understand the current state
2. Make targeted edits rather than rewriting entire files when possible
3. Run the build after making changes to verify they work
4. Run relevant tests after making changes
5. Use git to commit your changes with clear messages
6. Search the codebase to understand patterns before making changes

ERROR HANDLING:
- If a command fails, analyze the error and try to fix it
- If you're unsure about something, read more files for context
- If a file edit doesn't work, the old_text might not match exactly - read the file first

CURRENT WORKSPACE: /workspace
This is the root of the project. All paths are relative to this unless specified.

Be proactive but careful. Think step by step. When making changes:
1. First understand the current code
2. Plan your changes
3. Implement them
4. Verify they work
5. Commit if everything is good`;
  }
}

// ============================================
// STREAMING AGENT (For real-time updates)
// ============================================

export class StreamingCodingAgent extends CodingAgent {
  private onUpdate?: (update: AgentUpdate) => void;

  constructor(config: AgentConfig, onUpdate?: (update: AgentUpdate) => void) {
    super(config);
    this.onUpdate = onUpdate;
  }

  /**
   * Run with streaming updates
   */
  async runWithStreaming(prompt: string): Promise<AgentResponse> {
    this.emit({ type: 'start', message: 'Agent started' });

    // Override executeTool to emit updates
    const originalExecuteTool = (this as unknown as { executeTool: (name: string, input: Record<string, unknown>) => Promise<string> }).executeTool.bind(this);

    (this as unknown as { executeTool: (name: string, input: Record<string, unknown>) => Promise<string> }).executeTool = async (name: string, input: Record<string, unknown>) => {
      this.emit({ type: 'tool_start', tool: name, input });
      const result = await originalExecuteTool(name, input);
      this.emit({ type: 'tool_end', tool: name, output: result });
      return result;
    };

    try {
      const response = await this.run(prompt);
      this.emit({ type: 'complete', response });
      return response;
    } catch (error) {
      this.emit({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  private emit(update: AgentUpdate): void {
    this.onUpdate?.(update);
  }
}

export interface AgentUpdate {
  type: 'start' | 'tool_start' | 'tool_end' | 'thinking' | 'complete' | 'error';
  message?: string;
  tool?: string;
  input?: Record<string, unknown>;
  output?: string;
  response?: AgentResponse;
  error?: string;
}

// ============================================
// AUTONOMOUS AGENT (Runs without stopping)
// ============================================

export class AutonomousAgent extends CodingAgent {
  /**
   * Run autonomously until task is complete
   */
  async runAutonomous(task: string): Promise<AgentResponse> {
    const enhancedPrompt = `
TASK: ${task}

You are running in autonomous mode. Complete this task fully without asking for clarification.

Steps:
1. Analyze what needs to be done
2. Explore the codebase if needed
3. Make all necessary changes
4. Run builds and tests to verify
5. Fix any errors that arise
6. Commit your changes with a clear message

Do not stop until the task is complete or you've exhausted all options.
If you encounter an error, try to fix it yourself.
Only stop if you truly cannot proceed.

Begin now.`;

    return this.run(enhancedPrompt);
  }
}

// All exports are inline with their declarations
