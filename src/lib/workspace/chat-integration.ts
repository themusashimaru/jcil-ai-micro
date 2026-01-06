/**
 * E2B WORKSPACE CHAT INTEGRATION
 *
 * This connects the E2B CodingAgent to the Code Lab chat.
 * Provides Claude Code-like agentic capabilities:
 * - Shell execution
 * - File read/write/edit
 * - Git operations
 * - Build/test execution
 * - Real-time streaming updates
 */

import Anthropic from '@anthropic-ai/sdk';
import { ContainerManager } from './container';
import { createClient } from '@supabase/supabase-js';

// ============================================
// TYPES
// ============================================

export interface WorkspaceAgentConfig {
  workspaceId: string;
  userId: string;
  sessionId: string;
  model?: string;
  maxIterations?: number;
}

export interface ToolUpdate {
  type: 'tool_start' | 'tool_end' | 'thinking' | 'text' | 'error' | 'complete';
  tool?: string;
  input?: Record<string, unknown>;
  output?: string;
  text?: string;
  error?: string;
}

export type ToolUpdateCallback = (update: ToolUpdate) => void;

// ============================================
// TOOL DEFINITIONS
// ============================================

const WORKSPACE_TOOLS: Anthropic.Tool[] = [
  // ============================================
  // CORE CLAUDE CODE PARITY TOOLS
  // ============================================
  {
    name: 'execute_shell',
    description: 'Execute a shell command in the workspace sandbox. Use for running scripts, installing packages, building, testing, or any CLI operation. Commands run in an isolated Linux environment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute (e.g., "npm install", "python script.py", "ls -la")',
        },
        cwd: {
          type: 'string',
          description: 'Working directory (default: /workspace)',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file. Always read files before editing to understand the current state.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file (relative to /workspace or absolute)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it does not exist, overwrites if it does. Creates parent directories automatically.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file',
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
    description: 'Make targeted edits to a file by finding and replacing specific text. More precise than write_file for modifications. The old_text must match exactly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file',
        },
        old_text: {
          type: 'string',
          description: 'The exact text to find and replace (must match exactly, including whitespace)',
        },
        new_text: {
          type: 'string',
          description: 'The new text to replace it with',
        },
      },
      required: ['path', 'old_text', 'new_text'],
    },
  },
  {
    name: 'list_files',
    description: 'List files and directories in a path. Use to explore the project structure.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list (default: /workspace)',
        },
        recursive: {
          type: 'boolean',
          description: 'Include subdirectories recursively (default: false, max depth: 3)',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_files',
    description: 'Search for files by name pattern using glob syntax.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "*.ts", "src/**/*.tsx", "package.json")',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'search_code',
    description: 'Search for text or patterns in file contents (like grep). Use to find implementations, usages, or specific code patterns.',
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
          description: 'File pattern to limit search (e.g., "*.ts", "*.py")',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'git_status',
    description: 'Get the current git status including branch, staged files, and changes.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_diff',
    description: 'Get the diff of changes (staged or unstaged).',
    input_schema: {
      type: 'object' as const,
      properties: {
        staged: {
          type: 'boolean',
          description: 'Show staged changes only (default: false)',
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
    name: 'git_commit',
    description: 'Stage changes and create a commit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: 'Commit message (be descriptive)',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific files to stage (default: all changed files)',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'run_build',
    description: 'Run the project build command. Auto-detects the build system (npm, cargo, go, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'run_tests',
    description: 'Run the project test suite. Auto-detects the test framework.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Test file pattern or specific test name to run',
        },
      },
      required: [],
    },
  },
  {
    name: 'install_packages',
    description: 'Install project dependencies or specific packages. Auto-detects package manager.',
    input_schema: {
      type: 'object' as const,
      properties: {
        packages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific packages to install (omit to install all from package.json/requirements.txt)',
        },
      },
      required: [],
    },
  },

  // ============================================
  // ADVANCED TOOLS (CLAUDE CODE PARITY+)
  // ============================================
  {
    name: 'web_fetch',
    description: 'Fetch content from a URL. Use to retrieve documentation, API responses, or any web content. Returns markdown-formatted content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch',
        },
        prompt: {
          type: 'string',
          description: 'Optional prompt to extract specific information from the page',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'spawn_task',
    description: 'Spawn a sub-agent to handle a complex subtask. Use for parallel work or when a task requires focused attention. The sub-agent has the same capabilities as you.',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: {
          type: 'string',
          description: 'Short description of the task (3-5 words)',
        },
        prompt: {
          type: 'string',
          description: 'Detailed instructions for the sub-agent',
        },
      },
      required: ['description', 'prompt'],
    },
  },
  {
    name: 'todo_write',
    description: 'Create or update a task list to track progress on multi-step tasks. Helps organize complex work and show progress to the user.',
    input_schema: {
      type: 'object' as const,
      properties: {
        todos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Task description' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'Task status' },
            },
            required: ['content', 'status'],
          },
          description: 'List of tasks to track',
        },
      },
      required: ['todos'],
    },
  },
  {
    name: 'notebook_edit',
    description: 'Edit a Jupyter notebook (.ipynb file). Can replace, insert, or delete cells.',
    input_schema: {
      type: 'object' as const,
      properties: {
        notebook_path: {
          type: 'string',
          description: 'Path to the notebook file',
        },
        cell_index: {
          type: 'number',
          description: 'Index of the cell to edit (0-based)',
        },
        edit_mode: {
          type: 'string',
          enum: ['replace', 'insert', 'delete'],
          description: 'Type of edit (default: replace)',
        },
        cell_type: {
          type: 'string',
          enum: ['code', 'markdown'],
          description: 'Cell type (for insert/replace)',
        },
        new_source: {
          type: 'string',
          description: 'New cell content',
        },
      },
      required: ['notebook_path'],
    },
  },
  {
    name: 'multi_edit',
    description: 'Apply multiple edits to a file atomically. More efficient than multiple edit_file calls.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file',
        },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              old_text: { type: 'string', description: 'Text to find' },
              new_text: { type: 'string', description: 'Text to replace with' },
            },
            required: ['old_text', 'new_text'],
          },
          description: 'List of edits to apply',
        },
      },
      required: ['path', 'edits'],
    },
  },
  {
    name: 'ask_user',
    description: 'Ask the user a clarifying question when you need more information to proceed. Use sparingly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the user',
        },
      },
      required: ['question'],
    },
  },
];

// ============================================
// WORKSPACE AGENT
// ============================================

export class WorkspaceAgent {
  private anthropic: Anthropic;
  private config: WorkspaceAgentConfig;
  private container: ContainerManager;
  private supabase;

  private filesModified: Set<string> = new Set();
  private commandsExecuted: string[] = [];
  private toolsUsed: Set<string> = new Set();

  constructor(config: WorkspaceAgentConfig) {
    this.anthropic = new Anthropic();
    this.config = {
      model: 'claude-sonnet-4-20250514',
      maxIterations: 25,
      ...config,
    };

    this.container = new ContainerManager();

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Run the agent with streaming updates
   */
  async *runStreaming(
    prompt: string,
    history: Array<{ role: string; content: string }> = []
  ): AsyncGenerator<ToolUpdate> {
    // Build messages
    const messages: Anthropic.MessageParam[] = [
      ...history.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: prompt },
    ];

    let iterations = 0;

    while (iterations < (this.config.maxIterations || 25)) {
      iterations++;

      // Call Claude with tools
      const response = await this.anthropic.messages.create({
        model: this.config.model || 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: this.getSystemPrompt(),
        tools: WORKSPACE_TOOLS,
        messages,
      });

      // Process response content
      let hasToolUse = false;
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          yield { type: 'text', text: block.text };
        } else if (block.type === 'tool_use') {
          hasToolUse = true;

          // Emit tool start
          yield {
            type: 'tool_start',
            tool: block.name,
            input: block.input as Record<string, unknown>,
          };

          // Execute the tool
          const result = await this.executeTool(
            block.name,
            block.input as Record<string, unknown>
          );
          this.toolsUsed.add(block.name);

          // Emit tool end
          yield {
            type: 'tool_end',
            tool: block.name,
            output: result,
          };

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // If no tool use, we're done
      if (!hasToolUse || response.stop_reason === 'end_turn') {
        yield { type: 'complete' };
        break;
      }

      // Add assistant message and tool results for next iteration
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    // Log tool executions
    await this.logToolExecutions();
  }

  /**
   * Execute a single tool
   */
  private async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    try {
      switch (name) {
        case 'execute_shell': {
          const command = input.command as string;
          const cwd = (input.cwd as string) || '/workspace';

          const result = await this.container.executeCommand(
            this.config.workspaceId,
            command,
            { cwd, timeout: 60000 }
          );

          this.commandsExecuted.push(command);

          let output = '';
          if (result.stdout) output += result.stdout;
          if (result.stderr) output += (output ? '\n' : '') + result.stderr;
          output += `\n[Exit code: ${result.exitCode}]`;

          return output || '[No output]';
        }

        case 'read_file': {
          const path = this.normalizePath(input.path as string);
          try {
            const content = await this.container.readFile(this.config.workspaceId, path);
            return content;
          } catch (error) {
            return `Error reading file: ${error instanceof Error ? error.message : 'File not found'}`;
          }
        }

        case 'write_file': {
          const path = this.normalizePath(input.path as string);
          const content = input.content as string;

          await this.container.writeFile(this.config.workspaceId, path, content);
          this.filesModified.add(path);

          return `Successfully wrote ${content.split('\n').length} lines to ${path}`;
        }

        case 'edit_file': {
          const path = this.normalizePath(input.path as string);
          const oldText = input.old_text as string;
          const newText = input.new_text as string;

          const content = await this.container.readFile(this.config.workspaceId, path);

          if (!content.includes(oldText)) {
            return `Error: Could not find the specified text in ${path}. Make sure the old_text matches exactly (including whitespace and line endings).`;
          }

          const newContent = content.replace(oldText, newText);
          await this.container.writeFile(this.config.workspaceId, path, newContent);
          this.filesModified.add(path);

          return `Successfully edited ${path}`;
        }

        case 'list_files': {
          const path = this.normalizePath((input.path as string) || '/workspace');
          const recursive = input.recursive as boolean || false;

          if (recursive) {
            const files = await this.container.getFileTree(this.config.workspaceId, path, 3);
            return files.map(f => `${f.isDirectory ? '📁' : '📄'} ${f.path}`).join('\n');
          } else {
            const files = await this.container.listDirectory(this.config.workspaceId, path);
            return files.map(f => `${f.isDirectory ? '📁' : '📄'} ${f.path}`).join('\n');
          }
        }

        case 'search_files': {
          const pattern = input.pattern as string;
          const result = await this.container.executeCommand(
            this.config.workspaceId,
            `find /workspace -name "${pattern}" -type f 2>/dev/null | head -50`
          );
          return result.stdout || 'No files found matching pattern';
        }

        case 'search_code': {
          const pattern = input.pattern as string;
          const path = this.normalizePath((input.path as string) || '/workspace');
          const filePattern = input.file_pattern as string | undefined;

          let cmd = `grep -rn "${pattern}" ${path}`;
          if (filePattern) {
            cmd += ` --include="${filePattern}"`;
          }
          cmd += ' | head -100';

          const result = await this.container.executeCommand(this.config.workspaceId, cmd);
          return result.stdout || 'No matches found';
        }

        case 'git_status': {
          const result = await this.container.executeCommand(
            this.config.workspaceId,
            'git status'
          );
          return result.stdout || result.stderr || 'Not a git repository';
        }

        case 'git_diff': {
          let cmd = 'git diff';
          if (input.staged) cmd += ' --staged';
          if (input.file) cmd += ` -- "${input.file}"`;

          const result = await this.container.executeCommand(this.config.workspaceId, cmd);
          return result.stdout || 'No changes';
        }

        case 'git_commit': {
          const message = input.message as string;
          const files = input.files as string[] | undefined;

          // Stage files
          if (files && files.length > 0) {
            await this.container.executeCommand(
              this.config.workspaceId,
              `git add ${files.map(f => `"${f}"`).join(' ')}`
            );
          } else {
            await this.container.executeCommand(this.config.workspaceId, 'git add .');
          }

          // Commit
          const result = await this.container.executeCommand(
            this.config.workspaceId,
            `git commit -m "${message.replace(/"/g, '\\"')}"`
          );

          return result.stdout || result.stderr;
        }

        case 'run_build': {
          const result = await this.container.runBuild(this.config.workspaceId);
          let output = result.stdout || '';
          if (result.stderr) output += '\n' + result.stderr;
          output += `\n[Exit code: ${result.exitCode}]`;
          return output;
        }

        case 'run_tests': {
          const result = await this.container.runTests(this.config.workspaceId);
          let output = result.stdout || '';
          if (result.stderr) output += '\n' + result.stderr;
          output += `\n[Exit code: ${result.exitCode}]`;
          return output;
        }

        case 'install_packages': {
          const packages = input.packages as string[] | undefined;

          if (packages && packages.length > 0) {
            // Install specific packages
            const result = await this.container.executeCommand(
              this.config.workspaceId,
              `npm install ${packages.join(' ')}`,
              { timeout: 120000 }
            );
            return result.stdout || result.stderr;
          } else {
            // Install all
            const result = await this.container.installDependencies(this.config.workspaceId);
            return result.stdout || result.stderr;
          }
        }

        // ============================================
        // ADVANCED TOOLS IMPLEMENTATIONS
        // ============================================

        case 'web_fetch': {
          const url = input.url as string;
          const prompt = input.prompt as string | undefined;

          try {
            // Fetch the URL
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Code-Lab/1.0 (Anthropic Claude Integration)',
              },
            });

            if (!response.ok) {
              return `Error fetching URL: ${response.status} ${response.statusText}`;
            }

            const contentType = response.headers.get('content-type') || '';
            let content: string;

            if (contentType.includes('application/json')) {
              const json = await response.json();
              content = JSON.stringify(json, null, 2);
            } else {
              content = await response.text();
              // Strip HTML tags for cleaner output
              if (contentType.includes('text/html')) {
                content = content
                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .substring(0, 10000); // Limit size
              }
            }

            if (prompt) {
              return `Content from ${url} (with prompt: "${prompt}"):\n\n${content}`;
            }
            return `Content from ${url}:\n\n${content}`;
          } catch (error) {
            return `Error fetching URL: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }

        case 'spawn_task': {
          const description = input.description as string;
          const prompt = input.prompt as string;

          // Create a sub-agent with the same config
          const subAgent = new WorkspaceAgent({
            ...this.config,
            sessionId: `${this.config.sessionId}-subtask-${Date.now()}`,
          });

          // Collect all output from sub-agent
          let subAgentOutput = '';
          for await (const update of subAgent.runStreaming(prompt)) {
            if (update.type === 'text') {
              subAgentOutput += update.text || '';
            } else if (update.type === 'tool_end') {
              subAgentOutput += `\n[Tool: ${update.tool}]\n${update.output}\n`;
            }
          }

          return `Sub-task "${description}" completed:\n\n${subAgentOutput}`;
        }

        case 'todo_write': {
          const todos = input.todos as Array<{ content: string; status: string }>;

          // Store in session context (would be sent back to frontend)
          const todoList = todos.map((t) => {
            const icon = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '→' : '○';
            return `${icon} ${t.content}`;
          }).join('\n');

          return `Task list updated:\n${todoList}`;
        }

        case 'notebook_edit': {
          const notebookPath = this.normalizePath(input.notebook_path as string);
          const cellIndex = input.cell_index as number | undefined;
          const editMode = (input.edit_mode as string) || 'replace';
          const cellType = (input.cell_type as string) || 'code';
          const newSource = input.new_source as string | undefined;

          try {
            // Read the notebook
            const content = await this.container.readFile(this.config.workspaceId, notebookPath);
            const notebook = JSON.parse(content);

            if (!notebook.cells) {
              return `Error: Invalid notebook format - no cells found`;
            }

            if (editMode === 'delete' && cellIndex !== undefined) {
              notebook.cells.splice(cellIndex, 1);
            } else if (editMode === 'insert' && newSource !== undefined) {
              const newCell = {
                cell_type: cellType,
                source: newSource.split('\n'),
                metadata: {},
                ...(cellType === 'code' ? { outputs: [], execution_count: null } : {}),
              };
              const insertAt = cellIndex !== undefined ? cellIndex : notebook.cells.length;
              notebook.cells.splice(insertAt, 0, newCell);
            } else if (editMode === 'replace' && cellIndex !== undefined && newSource !== undefined) {
              notebook.cells[cellIndex].source = newSource.split('\n');
              if (cellType) {
                notebook.cells[cellIndex].cell_type = cellType;
              }
            }

            // Write back
            await this.container.writeFile(this.config.workspaceId, notebookPath, JSON.stringify(notebook, null, 2));
            this.filesModified.add(notebookPath);

            return `Successfully ${editMode}d cell in ${notebookPath}`;
          } catch (error) {
            return `Error editing notebook: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }

        case 'multi_edit': {
          const path = this.normalizePath(input.path as string);
          const edits = input.edits as Array<{ old_text: string; new_text: string }>;

          let content = await this.container.readFile(this.config.workspaceId, path);
          let appliedCount = 0;
          const errors: string[] = [];

          for (const edit of edits) {
            if (content.includes(edit.old_text)) {
              content = content.replace(edit.old_text, edit.new_text);
              appliedCount++;
            } else {
              errors.push(`Could not find: "${edit.old_text.substring(0, 50)}..."`);
            }
          }

          if (appliedCount > 0) {
            await this.container.writeFile(this.config.workspaceId, path, content);
            this.filesModified.add(path);
          }

          let result = `Applied ${appliedCount}/${edits.length} edits to ${path}`;
          if (errors.length > 0) {
            result += `\nErrors:\n${errors.join('\n')}`;
          }
          return result;
        }

        case 'ask_user': {
          const question = input.question as string;
          // This would typically trigger a UI prompt
          // For now, we return a marker that the frontend can handle
          return `[AWAITING_USER_INPUT]\n${question}`;
        }

        default:
          return `Unknown tool: ${name}`;
      }
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Normalize file path
   */
  private normalizePath(path: string): string {
    if (path.startsWith('/')) return path;
    return `/workspace/${path}`;
  }

  /**
   * Get system prompt
   */
  private getSystemPrompt(): string {
    return `You are Claude, an expert software engineer working in an isolated sandbox environment. You have full access to a Linux shell, file system, and git.

CAPABILITIES:
- Execute any shell command (npm, pip, cargo, python, node, etc.)
- Read, write, and edit files
- Search files and code
- Run builds and tests
- Make git commits
- Install packages

GUIDELINES:
1. ALWAYS read files before editing to understand the current state
2. Use edit_file for targeted changes (find/replace), write_file for new files or complete rewrites
3. Run builds after making changes to verify they work
4. Run tests after changes to ensure nothing breaks
5. Search the codebase to understand patterns before making changes
6. Make clear, descriptive git commits

ERROR HANDLING:
- If a command fails, analyze the error and fix it
- If edit_file fails (text not found), read the file first to see actual content
- If unsure, explore the codebase first with list_files and search_code

CURRENT WORKSPACE: /workspace
This is the root of the project. All file paths are relative to this.

Be thorough and proactive. When given a task:
1. Understand the current state (read files, explore)
2. Plan your approach
3. Implement changes
4. Verify they work (build, test)
5. Report what you did

Always explain what you're doing and why.`;
  }

  /**
   * Log tool executions to database
   */
  private async logToolExecutions(): Promise<void> {
    if (this.toolsUsed.size === 0) return;

    try {
      const executions = Array.from(this.toolsUsed).map(tool => ({
        workspace_id: this.config.workspaceId,
        session_id: this.config.sessionId,
        user_id: this.config.userId,
        tool_name: tool,
        success: true,
        created_at: new Date().toISOString(),
      }));

      await this.supabase.from('tool_executions').insert(executions);
    } catch (error) {
      console.error('[WorkspaceAgent] Failed to log tool executions:', error);
    }
  }

  /**
   * Get execution summary
   */
  getSummary() {
    return {
      filesModified: Array.from(this.filesModified),
      commandsExecuted: this.commandsExecuted,
      toolsUsed: Array.from(this.toolsUsed),
    };
  }
}

// ============================================
// DETECTION - When to use Workspace Agent
// ============================================

/**
 * Detect if request should use workspace agent (agentic mode)
 * vs regular chat or code generation
 */
export function shouldUseWorkspaceAgent(message: string): boolean {
  const lower = message.toLowerCase();

  // Strong indicators for agentic mode
  const agenticPatterns = [
    // File operations
    /\b(edit|modify|change|update|fix|refactor)\b.*\b(file|code|function|class|component)/i,
    /\b(read|show|open|display)\b.*\b(file|content)/i,
    /\b(create|add|write)\b.*\b(file|folder|directory)/i,
    /\b(delete|remove)\b.*\b(file|folder|line|code)/i,

    // Shell/command operations
    /\b(run|execute|install|build|test|start|stop)\b/i,
    /\bnpm\b|\byarn\b|\bpnpm\b|\bpip\b|\bcargo\b/i,
    /\b(terminal|shell|command|bash)\b/i,

    // Git operations
    /\b(commit|push|pull|branch|merge|checkout|git)\b/i,

    // Debugging/fixing
    /\b(debug|fix|solve|resolve)\b.*\b(bug|error|issue|problem)/i,
    /\bwhy.*(not working|failing|error|broken)/i,

    // Exploration
    /\b(find|search|grep|look for)\b.*\b(in|across|through)\b.*\b(code|files?|project|codebase)/i,
    /\b(where|which)\b.*\b(file|function|class|import|defined)/i,

    // Analysis
    /\b(analyze|check|inspect|review)\b.*\b(code|file|project)/i,
  ];

  // Check for agentic patterns
  if (agenticPatterns.some(p => p.test(message))) {
    return true;
  }

  // Keyword density check
  const agenticKeywords = [
    'file', 'folder', 'directory', 'path',
    'edit', 'modify', 'change', 'update',
    'run', 'execute', 'command', 'terminal',
    'install', 'build', 'test', 'deploy',
    'git', 'commit', 'branch', 'push',
    'fix', 'debug', 'error', 'bug',
    'find', 'search', 'grep', 'locate',
  ];

  const matchCount = agenticKeywords.filter(k => lower.includes(k)).length;
  return matchCount >= 2;
}

// ============================================
// STREAMING EXECUTION FOR CHAT ROUTE
// ============================================

/**
 * Execute workspace agent and return a streaming response
 */
export async function executeWorkspaceAgent(
  prompt: string,
  options: {
    workspaceId: string;
    userId: string;
    sessionId: string;
    history?: Array<{ role: string; content: string }>;
  }
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const agent = new WorkspaceAgent({
          workspaceId: options.workspaceId,
          userId: options.userId,
          sessionId: options.sessionId,
        });

        // Stream header
        controller.enqueue(encoder.encode('```\n'));
        controller.enqueue(encoder.encode('┌─────────────────────────────────────────────────────────────────┐\n'));
        controller.enqueue(encoder.encode('│                    WORKSPACE AGENT                              │\n'));
        controller.enqueue(encoder.encode('│                 Autonomous Code Execution                       │\n'));
        controller.enqueue(encoder.encode('└─────────────────────────────────────────────────────────────────┘\n'));
        controller.enqueue(encoder.encode('```\n\n'));

        // Stream agent execution
        for await (const update of agent.runStreaming(prompt, options.history || [])) {
          switch (update.type) {
            case 'tool_start': {
              const toolLine = `\n\`▶ ${formatToolName(update.tool!)}\` `;
              if (update.input) {
                const inputSummary = formatToolInput(update.tool!, update.input);
                controller.enqueue(encoder.encode(toolLine + inputSummary + '\n'));
              } else {
                controller.enqueue(encoder.encode(toolLine + '\n'));
              }
              break;
            }

            case 'tool_end': {
              // Show truncated output
              const output = update.output || '';
              const truncated = output.length > 500
                ? output.substring(0, 500) + '\n... (truncated)'
                : output;

              const outputBlock = '```\n' + truncated + '\n```\n';
              controller.enqueue(encoder.encode(outputBlock));
              break;
            }

            case 'text': {
              controller.enqueue(encoder.encode(update.text || ''));
              break;
            }

            case 'error': {
              const errorMsg = `\n\`✕ Error:\` ${update.error}\n`;
              controller.enqueue(encoder.encode(errorMsg));
              break;
            }

            case 'complete': {
              // Add summary
              const summary = agent.getSummary();
              if (summary.filesModified.length > 0 || summary.commandsExecuted.length > 0) {
                let summaryText = '\n---\n\n**Summary:**\n';
                if (summary.filesModified.length > 0) {
                  summaryText += `- Files modified: ${summary.filesModified.join(', ')}\n`;
                }
                if (summary.commandsExecuted.length > 0) {
                  summaryText += `- Commands run: ${summary.commandsExecuted.length}\n`;
                }
                controller.enqueue(encoder.encode(summaryText));
              }
              break;
            }
          }
        }

        controller.close();
      } catch (error) {
        const errorMsg = `\n\`✕ Agent Error:\` ${error instanceof Error ? error.message : 'Unknown error'}\n`;
        controller.enqueue(encoder.encode(errorMsg));
        controller.close();
      }
    },
  });
}

/**
 * Format tool name for display
 */
function formatToolName(tool: string): string {
  const names: Record<string, string> = {
    execute_shell: 'Running command',
    read_file: 'Reading file',
    write_file: 'Writing file',
    edit_file: 'Editing file',
    list_files: 'Listing files',
    search_files: 'Searching files',
    search_code: 'Searching code',
    git_status: 'Git status',
    git_diff: 'Git diff',
    git_commit: 'Git commit',
    run_build: 'Running build',
    run_tests: 'Running tests',
    install_packages: 'Installing packages',
    web_fetch: 'Fetching URL',
    spawn_task: 'Spawning sub-task',
    todo_write: 'Updating task list',
    notebook_edit: 'Editing notebook',
    multi_edit: 'Multi-edit file',
    ask_user: 'Asking user',
  };
  return names[tool] || tool;
}

/**
 * Format tool input for display
 */
function formatToolInput(tool: string, input: Record<string, unknown>): string {
  switch (tool) {
    case 'execute_shell':
      return `\`${input.command}\``;
    case 'read_file':
    case 'write_file':
    case 'edit_file':
    case 'notebook_edit':
    case 'multi_edit':
      return `\`${input.path || input.notebook_path}\``;
    case 'list_files':
      return input.path ? `\`${input.path}\`` : '`/workspace`';
    case 'search_files':
      return `pattern: \`${input.pattern}\``;
    case 'search_code':
      return `"${input.pattern}"`;
    case 'git_commit':
      return `"${input.message}"`;
    case 'web_fetch':
      return `\`${input.url}\``;
    case 'spawn_task':
      return `"${input.description}"`;
    case 'ask_user':
      return `"${(input.question as string)?.substring(0, 50)}..."`;
    default:
      return '';
  }
}
