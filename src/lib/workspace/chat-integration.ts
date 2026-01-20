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
import { getContainerManager } from './container';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const log = logger('WorkspaceAgent');
import {
  sanitizeShellArg,
  sanitizeCommitMessage,
  sanitizeFilePath,
  sanitizeGlobPattern,
  sanitizeSearchPattern,
} from './security';
// NEW: Using plan-mode.ts (step tracking, progress, complexity) instead of planning.ts
import { getPlanTools, executePlanTool, isPlanTool, getPlanManager } from './plan-mode';
import { getMCPConfigTools, getMCPManager } from './mcp';
import { getHooksTools, getHooksManager, HookConfig } from './hooks';
// NEW: Using memory-files.ts (CLAUDE.md hierarchical) instead of memory.ts
import {
  getClaudeMemoryTools,
  executeMemoryTool,
  isClaudeMemoryTool,
  getCachedMemoryContext,
} from './memory-files';
import { getBackgroundTaskTools, getBackgroundTaskManager } from './background-tasks';
import { getDebugTools, executeDebugTool, isDebugTool } from './debug-tools';
import { getLSPTools, executeLSPTool, isLSPTool } from './lsp-tools';
import { getSubagentTools, executeSubagentTool, isSubagentTool } from '@/lib/agents/subagent';
import { getPermissionTools, executePermissionTool, isPermissionTool } from './permissions';
import {
  getModelConfigTools,
  executeModelConfigTool,
  isModelConfigTool,
  getModelConfigManager,
} from './model-config';
import {
  getTokenTrackingTools,
  executeTokenTrackingTool,
  isTokenTrackingTool,
  getTokenTracker,
} from './token-tracker';
import {
  getExtendedThinkingTools,
  executeExtendedThinkingTool,
  isExtendedThinkingTool,
} from './extended-thinking';
import {
  getContextCompactionTools,
  isContextCompactionTool,
  getContextCompactionManager,
} from './context-compaction';
import { getCheckpointTools, isCheckpointTool, executeCheckpointTool } from './checkpoint';
import {
  getCustomCommandTools,
  isCustomCommandTool,
  executeCustomCommandTool,
} from './custom-commands';
import { getMCPScopeTools, isMCPScopeTool, executeMCPScopeTool } from './mcp-scopes';

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
    description:
      'Execute a shell command in the workspace sandbox. Use for running scripts, installing packages, building, testing, or any CLI operation. Commands run in an isolated Linux environment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description:
            'The shell command to execute (e.g., "npm install", "python script.py", "ls -la")',
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
    description:
      'Read the contents of a file. Always read files before editing to understand the current state.',
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
    description:
      'Write content to a file. Creates the file if it does not exist, overwrites if it does. Creates parent directories automatically.',
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
    description:
      'Make targeted edits to a file by finding and replacing specific text. More precise than write_file for modifications. The old_text must match exactly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file',
        },
        old_text: {
          type: 'string',
          description:
            'The exact text to find and replace (must match exactly, including whitespace)',
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
    description:
      'Search for text or patterns in file contents (like grep). Use to find implementations, usages, or specific code patterns.',
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
    description:
      'Run the project build command. Auto-detects the build system (npm, cargo, go, etc.).',
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
          description:
            'Specific packages to install (omit to install all from package.json/requirements.txt)',
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
    description:
      'Fetch content from a URL. Use to retrieve documentation, API responses, or any web content. Returns markdown-formatted content.',
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
  // NOTE: spawn_task replaced by 'task' tool from subagent module
  // See getSubagentTools() for the new Task tool with:
  // - Specialized agent types (Explore, Plan, Bash, etc.)
  // - Model selection (haiku, sonnet, opus)
  // - Background execution
  // - Resumable agents
  {
    name: 'todo_write',
    description:
      'Create or update a structured task list for your current coding session. This helps track progress, organize complex tasks, and demonstrate thoroughness to the user. Use for multi-step tasks requiring 3+ steps.',
    input_schema: {
      type: 'object' as const,
      properties: {
        todos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description:
                  'The imperative form describing what needs to be done (e.g., "Run tests", "Build the project")',
              },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed'],
                description:
                  'Task status: pending (not started), in_progress (currently working on), completed (finished)',
              },
              activeForm: {
                type: 'string',
                description:
                  'The present continuous form shown during execution (e.g., "Running tests", "Building the project")',
              },
            },
            required: ['content', 'status', 'activeForm'],
          },
          description: 'The updated todo list with all tasks',
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
    description:
      'Apply multiple edits to a file atomically. More efficient than multiple edit_file calls.',
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
    description:
      'Ask the user a clarifying question when you need more information to proceed. Use sparingly.',
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

  // ============================================
  // PLAN MODE TOOLS (CLAUDE CODE PARITY)
  // Step tracking, progress, complexity, approval gates
  // ============================================
  ...getPlanTools(),

  // ============================================
  // MCP (MODEL CONTEXT PROTOCOL) TOOLS
  // ============================================
  ...getMCPConfigTools(),

  // ============================================
  // HOOKS SYSTEM TOOLS
  // ============================================
  ...getHooksTools(),

  // ============================================
  // CLAUDE.md MEMORY TOOLS (CLAUDE CODE PARITY)
  // Hierarchical discovery, @include directives
  // ============================================
  ...getClaudeMemoryTools(),

  // ============================================
  // BACKGROUND TASK TOOLS
  // ============================================
  ...getBackgroundTaskTools(),

  // ============================================
  // DEBUG TOOLS (CLAUDE CODE PARITY+)
  // ============================================
  ...getDebugTools(),

  // ============================================
  // LSP TOOLS (CLAUDE CODE PARITY)
  // ============================================
  ...getLSPTools(),

  // ============================================
  // SUBAGENT TOOLS (CLAUDE CODE PARITY)
  // ============================================
  ...getSubagentTools(),

  // ============================================
  // PERMISSION TOOLS (CLAUDE CODE PARITY)
  // ============================================
  ...getPermissionTools(),

  // ============================================
  // MODEL CONFIG TOOLS (CLAUDE CODE PARITY)
  // ============================================
  ...getModelConfigTools(),

  // ============================================
  // TOKEN TRACKING TOOLS (CLAUDE CODE PARITY)
  // ============================================
  ...getTokenTrackingTools(),

  // ============================================
  // EXTENDED THINKING TOOLS (CLAUDE CODE PARITY)
  // ============================================
  ...getExtendedThinkingTools(),

  // ============================================
  // CONTEXT COMPACTION TOOLS (CLAUDE CODE PARITY)
  // ============================================
  ...getContextCompactionTools(),

  // ============================================
  // CHECKPOINT/REWIND TOOLS (CLAUDE CODE PARITY)
  // ============================================
  ...getCheckpointTools(),

  // ============================================
  // CUSTOM SLASH COMMANDS TOOLS (CLAUDE CODE PARITY)
  // ============================================
  ...getCustomCommandTools(),

  // ============================================
  // MCP SCOPE PERMISSION TOOLS (CLAUDE CODE PARITY)
  // ============================================
  ...getMCPScopeTools(),
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

    this.container = getContainerManager();

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
    // Load CLAUDE.md memory context for this session
    if (!this.memoryContext) {
      this.memoryContext = await this.loadMemoryContext();
    }

    // Build messages
    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: prompt },
    ];

    let iterations = 0;

    while (iterations < (this.config.maxIterations || 25)) {
      iterations++;

      // Get current model from session preferences
      const modelManager = getModelConfigManager();
      const currentModel = modelManager.getCurrentModel(this.config.sessionId);
      const prefs = modelManager.getSessionPreferences(this.config.sessionId);

      // Call Claude with tools
      const response = await this.anthropic.messages.create({
        model: currentModel.id,
        max_tokens: prefs.maxTokens,
        system: this.getSystemPrompt(),
        tools: WORKSPACE_TOOLS,
        messages,
      });

      // Track token usage
      const tokenTracker = getTokenTracker(this.config.sessionId, currentModel.id);
      if (response.usage) {
        tokenTracker.recordUsage({
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheReadTokens: (response.usage as { cache_read_input_tokens?: number })
            .cache_read_input_tokens,
          cacheWriteTokens: (response.usage as { cache_creation_input_tokens?: number })
            .cache_creation_input_tokens,
        });
      }

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
          const result = await this.executeTool(block.name, block.input as Record<string, unknown>);
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
    // Plan Mode Approval Gate (Claude Code parity)
    // Block dangerous operations when plan needs approval
    const dangerousTools = new Set([
      'execute_shell',
      'write_file',
      'edit_file',
      'surgical_edit',
      'batch_edit',
      'git_commit',
      'git_push',
      'run_build',
      'run_tests',
      'install_packages',
    ]);

    if (dangerousTools.has(name)) {
      const planManager = getPlanManager();
      const currentPlan = planManager?.getCurrentPlan();

      if (currentPlan && planManager.needsApproval()) {
        const planStatus = currentPlan.status;
        const currentStep = planManager.getCurrentStep();

        // Block execution if plan is in draft and needs user approval
        if (planStatus === 'draft') {
          return (
            `[APPROVAL REQUIRED] A plan is awaiting approval before executing ${name}.\n\n` +
            `Current plan: "${currentPlan.title}"\n` +
            `Status: ${planStatus}\n` +
            `Steps: ${currentPlan.steps.length}\n\n` +
            `Please approve the plan in the Workspace panel (Plan tab) or press the "Approve & Start" button before proceeding with this operation.`
          );
        }

        // If plan is in progress but current step needs high-complexity approval
        if (planStatus === 'in_progress' && currentStep?.complexity === 'high') {
          const settings = planManager.getSettings();
          if (settings.requireApprovalForHigh && !settings.autoAccept) {
            return (
              `[STEP APPROVAL REQUIRED] The current step "${currentStep.title}" is high complexity and requires explicit approval.\n\n` +
              `Step: ${currentStep.description}\n` +
              `Complexity: ${currentStep.complexity}\n\n` +
              `Enable auto-accept mode or manually advance this step to proceed.`
            );
          }
        }
      }
    }

    try {
      switch (name) {
        case 'execute_shell': {
          const command = input.command as string;
          const cwd = (input.cwd as string) || '/workspace';

          const result = await this.container.executeCommand(this.config.workspaceId, command, {
            cwd,
            timeout: 60000,
          });

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
          const recursive = (input.recursive as boolean) || false;

          if (recursive) {
            const files = await this.container.getFileTree(this.config.workspaceId, path, 3);
            return files.map((f) => `${f.isDirectory ? '📁' : '📄'} ${f.path}`).join('\n');
          } else {
            const files = await this.container.listDirectory(this.config.workspaceId, path);
            return files.map((f) => `${f.isDirectory ? '📁' : '📄'} ${f.path}`).join('\n');
          }
        }

        case 'search_files': {
          const pattern = sanitizeGlobPattern(input.pattern as string);
          // Respect .gitignore - use git ls-files if available, exclude common directories otherwise
          const isGitRepo = await this.container.executeCommand(
            this.config.workspaceId,
            'cd /workspace && git rev-parse --git-dir 2>/dev/null'
          );

          let result;
          if (isGitRepo.exitCode === 0) {
            // Use git ls-files and filter by pattern (respects .gitignore)
            result = await this.container.executeCommand(
              this.config.workspaceId,
              `cd /workspace && git ls-files --full-name | grep -E ${sanitizeShellArg(pattern.replace('*', '.*'))} | head -50`
            );
          } else {
            // Fall back to find with exclusions
            result = await this.container.executeCommand(
              this.config.workspaceId,
              `find /workspace -path "*/node_modules" -prune -o -path "*/.git" -prune -o -name ${sanitizeShellArg(pattern)} -type f -print 2>/dev/null | head -50`
            );
          }
          return result.stdout || 'No files found matching pattern';
        }

        case 'search_code': {
          const pattern = sanitizeSearchPattern(input.pattern as string);
          const path = sanitizeFilePath((input.path as string) || '/workspace');
          const filePattern = input.file_pattern
            ? sanitizeGlobPattern(input.file_pattern as string)
            : undefined;

          let cmd = `grep -rn ${sanitizeShellArg(pattern)} ${sanitizeShellArg(path)}`;
          if (filePattern) {
            cmd += ` --include=${sanitizeShellArg(filePattern)}`;
          }
          cmd += ' | head -100';

          const result = await this.container.executeCommand(this.config.workspaceId, cmd);
          return result.stdout || 'No matches found';
        }

        case 'git_status': {
          const result = await this.container.executeCommand(this.config.workspaceId, 'git status');
          return result.stdout || result.stderr || 'Not a git repository';
        }

        case 'git_diff': {
          let cmd = 'git diff';
          if (input.staged) cmd += ' --staged';
          if (input.file) {
            const safeFile = sanitizeFilePath(input.file as string);
            cmd += ` -- ${sanitizeShellArg(safeFile)}`;
          }

          const result = await this.container.executeCommand(this.config.workspaceId, cmd);
          return result.stdout || 'No changes';
        }

        case 'git_commit': {
          const message = sanitizeCommitMessage(input.message as string);
          const files = input.files as string[] | undefined;

          // Stage files
          if (files && files.length > 0) {
            const safeFiles = files.map((f) => sanitizeShellArg(sanitizeFilePath(f))).join(' ');
            await this.container.executeCommand(this.config.workspaceId, `git add ${safeFiles}`);
          } else {
            await this.container.executeCommand(this.config.workspaceId, 'git add .');
          }

          // Commit with sanitized message to prevent command injection
          const safeMessage = sanitizeCommitMessage(message);
          const result = await this.container.executeCommand(
            this.config.workspaceId,
            `git commit -m '${safeMessage}'`
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

        // NOTE: spawn_task replaced by 'task' from subagent module
        // handled in the default case via isSubagentTool()

        case 'todo_write': {
          const todos = input.todos as Array<{
            content: string;
            status: string;
            activeForm?: string;
          }>;

          // Format task list matching Claude Code's display
          const todoList = todos
            .map((t, index) => {
              const statusLabel =
                t.status === 'completed'
                  ? 'completed'
                  : t.status === 'in_progress'
                    ? 'in_progress'
                    : 'pending';
              const displayText =
                t.status === 'in_progress' && t.activeForm ? t.activeForm : t.content;
              return `${index + 1}. [${statusLabel}] ${displayText}`;
            })
            .join('\n');

          // Count by status
          const completed = todos.filter((t) => t.status === 'completed').length;
          const inProgress = todos.filter((t) => t.status === 'in_progress').length;
          const pending = todos.filter((t) => t.status === 'pending').length;

          return `Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress.\n\n${todoList}\n\nProgress: ${completed}/${todos.length} completed, ${inProgress} in progress, ${pending} pending`;
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
            } else if (
              editMode === 'replace' &&
              cellIndex !== undefined &&
              newSource !== undefined
            ) {
              notebook.cells[cellIndex].source = newSource.split('\n');
              if (cellType) {
                notebook.cells[cellIndex].cell_type = cellType;
              }
            }

            // Write back
            await this.container.writeFile(
              this.config.workspaceId,
              notebookPath,
              JSON.stringify(notebook, null, 2)
            );
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

        // ============================================
        // PLAN MODE TOOLS (CLAUDE CODE PARITY)
        // Step tracking, progress, complexity, approval gates
        // ============================================

        case 'plan_create':
        case 'plan_status':
        case 'plan_approve':
        case 'plan_complete_step':
        case 'plan_skip_step':
        case 'plan_cancel': {
          const planManager = getPlanManager();
          return executePlanTool(name, input, planManager);
        }

        // ============================================
        // MCP (MODEL CONTEXT PROTOCOL) TOOLS
        // ============================================

        case 'mcp_list_servers': {
          const mcpManager = getMCPManager();
          const servers = mcpManager.getAllServerStatuses();

          if (servers.length === 0) {
            return 'No MCP servers configured.';
          }

          const lines = ['**Configured MCP Servers:**\n'];
          for (const server of servers) {
            const statusIcon =
              server.status === 'running'
                ? '🟢'
                : server.status === 'error'
                  ? '🔴'
                  : server.status === 'starting'
                    ? '🟡'
                    : '⚪';
            lines.push(`${statusIcon} **${server.name}** (${server.id})`);
            lines.push(`   Status: ${server.status}`);
            if (server.tools.length > 0) {
              lines.push(
                `   Tools: ${server.tools.map((t: { name: string }) => t.name).join(', ')}`
              );
            }
            if (server.error) {
              lines.push(`   Error: ${server.error}`);
            }
            lines.push('');
          }

          return lines.join('\n');
        }

        case 'mcp_start_server': {
          const serverId = input.serverId as string;
          const mcpManager = getMCPManager();

          try {
            await mcpManager.startServer(serverId, this.config.workspaceId);
            const status = mcpManager.getServerStatus(serverId);
            const toolCount = status?.tools.length || 0;
            return `MCP server "${serverId}" started successfully. ${toolCount} tools available.`;
          } catch (error) {
            return `Failed to start MCP server "${serverId}": ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }

        case 'mcp_stop_server': {
          const serverId = input.serverId as string;
          const mcpManager = getMCPManager();

          try {
            await mcpManager.stopServer(serverId);
            return `MCP server "${serverId}" stopped.`;
          } catch (error) {
            return `Failed to stop MCP server "${serverId}": ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }

        case 'mcp_list_tools': {
          const mcpManager = getMCPManager();
          const tools = mcpManager.getAllTools();

          if (tools.length === 0) {
            return 'No MCP tools available. Start an MCP server first using mcp_start_server.';
          }

          const lines = ['**Available MCP Tools:**\n'];
          const byServer = new Map<string, Array<{ name: string; description: string }>>();

          for (const tool of tools) {
            const serverTools = byServer.get(tool.serverId) || [];
            serverTools.push({ name: tool.name, description: tool.description });
            byServer.set(tool.serverId, serverTools);
          }

          for (const [serverId, serverTools] of byServer) {
            lines.push(`**${serverId}:**`);
            for (const tool of serverTools) {
              lines.push(`  - \`mcp__${serverId}__${tool.name}\`: ${tool.description}`);
            }
            lines.push('');
          }

          return lines.join('\n');
        }

        // ============================================
        // HOOKS SYSTEM TOOLS
        // ============================================

        case 'hooks_list': {
          const hooksManager = getHooksManager();
          const hooks = hooksManager.getHooks();

          if (hooks.length === 0) {
            return 'No hooks configured.';
          }

          const lines = ['**Configured Hooks:**\n'];
          for (const hook of hooks) {
            const statusIcon = hook.enabled ? '✓' : '○';
            lines.push(`${statusIcon} **${hook.name}** (${hook.id})`);
            lines.push(`   Event: ${hook.event}`);
            if (hook.toolPattern) {
              lines.push(`   Tool Pattern: ${hook.toolPattern}`);
            }
            lines.push(`   Command: ${hook.command} ${hook.args?.join(' ') || ''}`);
            lines.push(`   Action: ${hook.action || 'allow'}`);
            if (hook.description) {
              lines.push(`   ${hook.description}`);
            }
            lines.push('');
          }

          return lines.join('\n');
        }

        case 'hooks_enable': {
          const hookId = input.hook_id as string;
          const hooksManager = getHooksManager();

          if (await hooksManager.enableHook(hookId)) {
            return `Hook "${hookId}" enabled.`;
          }

          return `Hook "${hookId}" not found. Available: pre-commit-lint, pre-commit-test, post-write-format, session-start-deps`;
        }

        case 'hooks_disable': {
          const hookId = input.hook_id as string;
          const hooksManager = getHooksManager();

          if (await hooksManager.disableHook(hookId)) {
            return `Hook "${hookId}" disabled.`;
          }

          return `Hook "${hookId}" not found.`;
        }

        case 'hooks_create': {
          const hooksManager = getHooksManager();

          const newHook: HookConfig = {
            id: input.id as string,
            name: input.name as string,
            event: input.event as HookConfig['event'],
            command: input.command as string,
            toolPattern: input.tool_pattern as string | undefined,
            action: (input.action as 'allow' | 'block') || 'allow',
            blockMessage: input.block_message as string | undefined,
            enabled: true,
          };

          await hooksManager.addHook(newHook);

          return `Hook "${newHook.id}" created and enabled.

**${newHook.name}**
- Event: ${newHook.event}
- Command: ${newHook.command}
- Action: ${newHook.action}`;
        }

        // ============================================
        // CLAUDE.md MEMORY TOOLS (CLAUDE CODE PARITY)
        // Hierarchical discovery, @include directives
        // ============================================

        case 'memory_load':
        case 'memory_create':
        case 'memory_update':
        case 'memory_add_instruction': {
          const readFileFn = async (path: string) => {
            return await this.container.readFile(this.config.workspaceId, path);
          };
          const writeFileFn = async (path: string, content: string) => {
            await this.container.writeFile(this.config.workspaceId, path, content);
            this.filesModified.add(path);
          };
          const fileExistsFn = async (path: string) => {
            try {
              await this.container.readFile(this.config.workspaceId, path);
              return true;
            } catch {
              return false;
            }
          };
          const listDirFn = async (path: string) => {
            const files = await this.container.listDirectory(this.config.workspaceId, path);
            return files.map((f) => f.path);
          };

          return executeMemoryTool(
            name,
            input,
            readFileFn,
            writeFileFn,
            fileExistsFn,
            listDirFn,
            '/workspace'
          );
        }

        // ============================================
        // BACKGROUND TASK TOOLS
        // ============================================

        case 'bg_run': {
          const command = input.command as string;
          const taskManager = getBackgroundTaskManager();

          // Start the background task
          const task = await taskManager.startTask(command, async (cmd) => {
            // Run the command in the background using nohup
            const bgCmd = `nohup ${cmd} > /tmp/bg-${Date.now()}.log 2>&1 & echo $!`;
            const result = await this.container.executeCommand(this.config.workspaceId, bgCmd, {
              timeout: 5000,
            });
            return {
              taskId: result.stdout.trim(),
              initialOutput: `Started background process with PID: ${result.stdout.trim()}`,
            };
          });

          this.commandsExecuted.push(`[bg] ${command}`);

          return `**Background task started**
- Task ID: ${task.id}
- Command: \`${task.command}\`
- Status: ${task.status}
- Started: ${task.startedAt}

Use \`bg_output\` to check output or \`bg_kill\` to stop.`;
        }

        case 'bg_output': {
          const taskId = input.task_id as string;
          const taskManager = getBackgroundTaskManager();
          const task = taskManager.getTask(taskId);

          if (!task) {
            return `Task ${taskId} not found.`;
          }

          // Try to get latest output
          const output = await taskManager.getTaskOutput(taskId, async (_tid) => {
            // Check if process is still running and get output
            const checkCmd = task.pid
              ? `ps -p ${task.pid} -o pid= 2>/dev/null && cat /tmp/bg-*.log 2>/dev/null | tail -100`
              : `cat /tmp/bg-*.log 2>/dev/null | tail -100`;

            const result = await this.container.executeCommand(this.config.workspaceId, checkCmd, {
              timeout: 5000,
            });

            const isComplete = task.pid ? result.stdout.trim() === '' : false;

            return {
              output: result.stdout || '[No new output]',
              isComplete,
              exitCode: isComplete ? 0 : undefined,
            };
          });

          if (!output) {
            return `Task ${taskId} not found.`;
          }

          return `**Task ${taskId}** (${task.status})

**Command:** \`${task.command}\`

**Output:**
\`\`\`
${output.newOutput.substring(0, 2000)}${output.newOutput.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`

${output.isComplete ? `✓ Task completed (exit code: ${output.exitCode})` : '⏳ Task still running'}`;
        }

        case 'bg_kill': {
          const taskId = input.task_id as string;
          const taskManager = getBackgroundTaskManager();
          const task = taskManager.getTask(taskId);

          if (!task) {
            return `Task ${taskId} not found.`;
          }

          const result = await taskManager.killTask(taskId, async () => {
            if (task.pid) {
              const killResult = await this.container.executeCommand(
                this.config.workspaceId,
                `kill -9 ${task.pid} 2>/dev/null || true`,
                { timeout: 5000 }
              );
              return killResult.exitCode === 0;
            }
            return true;
          });

          return result.success
            ? `✓ Task ${taskId} killed successfully.`
            : `✗ Failed to kill task: ${result.message}`;
        }

        case 'bg_list': {
          const filter = (input.filter as 'running' | 'completed' | 'all') || 'all';
          const taskManager = getBackgroundTaskManager();
          const tasks = taskManager.listTasks(filter);
          const summary = taskManager.getSummary();

          if (tasks.length === 0) {
            return `No ${filter === 'all' ? '' : filter + ' '}background tasks.`;
          }

          const lines = [
            `**Background Tasks** (${summary.running} running, ${summary.completed + summary.failed + summary.killed} completed)`,
            '',
          ];

          for (const task of tasks) {
            const statusIcon =
              task.status === 'running'
                ? '⏳'
                : task.status === 'completed'
                  ? '✓'
                  : task.status === 'killed'
                    ? '⊘'
                    : '✗';
            lines.push(
              `${statusIcon} **${task.id}** - \`${task.command.substring(0, 50)}${task.command.length > 50 ? '...' : ''}\``
            );
            lines.push(`   Status: ${task.status} | Started: ${task.startedAt}`);
          }

          return lines.join('\n');
        }

        default:
          // Check if it's a plan tool call
          if (isPlanTool(name)) {
            const planManager = getPlanManager();
            return executePlanTool(name, input, planManager);
          }

          // Check if it's a memory tool call
          if (isClaudeMemoryTool(name)) {
            const readFileFn = async (path: string) => {
              return await this.container.readFile(this.config.workspaceId, path);
            };
            const writeFileFn = async (path: string, content: string) => {
              await this.container.writeFile(this.config.workspaceId, path, content);
              this.filesModified.add(path);
            };
            const fileExistsFn = async (path: string) => {
              try {
                await this.container.readFile(this.config.workspaceId, path);
                return true;
              } catch {
                return false;
              }
            };
            const listDirFn = async (path: string) => {
              const files = await this.container.listDirectory(this.config.workspaceId, path);
              return files.map((f) => f.path);
            };

            return executeMemoryTool(
              name,
              input,
              readFileFn,
              writeFileFn,
              fileExistsFn,
              listDirFn,
              '/workspace'
            );
          }

          // Check if it's a debug tool call
          if (isDebugTool(name)) {
            return executeDebugTool(name, input, this.config.workspaceId, this.config.userId);
          }

          // Check if it's an LSP tool call
          if (isLSPTool(name)) {
            return executeLSPTool(name, input, this.config.workspaceId, '/workspace');
          }

          // Check if it's a subagent tool call
          if (isSubagentTool(name)) {
            return executeSubagentTool(name, input, {
              workspaceId: this.config.workspaceId,
              userId: this.config.userId,
              sessionId: this.config.sessionId,
            });
          }

          // Check if it's a permission tool call
          if (isPermissionTool(name)) {
            return executePermissionTool(name, input);
          }

          // Check if it's a model config tool call
          if (isModelConfigTool(name)) {
            return executeModelConfigTool(name, input, this.config.sessionId);
          }

          // Check if it's a token tracking tool call
          if (isTokenTrackingTool(name)) {
            return executeTokenTrackingTool(name, input, this.config.sessionId);
          }

          // Check if it's an extended thinking tool call
          if (isExtendedThinkingTool(name)) {
            return executeExtendedThinkingTool(name, input, this.config.sessionId);
          }

          // Check if it's a context compaction tool call
          if (isContextCompactionTool(name)) {
            const manager = getContextCompactionManager();
            if (name === 'context_settings') {
              if (Object.keys(input).length > 0) {
                manager.setSettings(
                  this.config.sessionId,
                  input as Partial<{
                    autoCompact: boolean;
                    threshold: number;
                    preserveRecentCount: number;
                  }>
                );
                return 'Context compaction settings updated.';
              }
              const settings = manager.getSettings(this.config.sessionId);
              return `**Context Compaction Settings**\n\nAuto-compact: ${settings.autoCompact ? 'Enabled' : 'Disabled'}\nThreshold: ${settings.threshold}%\nPreserve Recent: ${settings.preserveRecentCount} messages`;
            }
            return 'Context compaction triggered. Use /compact to compact the conversation.';
          }

          // Check if it's a checkpoint tool call
          if (isCheckpointTool(name)) {
            return executeCheckpointTool(name, input, {
              sessionId: this.config.sessionId,
              workspaceId: this.config.workspaceId,
              userId: this.config.userId,
              getFiles: async () => {
                const tree = await this.container.getFileTree(
                  this.config.workspaceId,
                  '/workspace',
                  5
                );
                const files: Array<{ path: string; content: string }> = [];
                for (const node of tree) {
                  if (!node.isDirectory) {
                    try {
                      const content = await this.container.readFile(
                        this.config.workspaceId,
                        node.path
                      );
                      files.push({ path: node.path, content });
                    } catch {
                      // Skip unreadable files
                    }
                  }
                }
                return files;
              },
              writeFile: async (path: string, content: string) => {
                await this.container.writeFile(this.config.workspaceId, path, content);
                this.filesModified.add(path);
              },
              messageCount: 0, // Will be updated by chat route
              workspaceContext: {
                cwd: '/workspace',
                activeFiles: Array.from(this.filesModified),
              },
            });
          }

          // Check if it's a custom command tool call
          if (isCustomCommandTool(name)) {
            return executeCustomCommandTool(name, input, {
              userId: this.config.userId,
              workspaceId: this.config.workspaceId,
              readFile: async (path: string) =>
                this.container.readFile(this.config.workspaceId, path),
            });
          }

          // Check if it's an MCP scope tool call
          if (isMCPScopeTool(name)) {
            return executeMCPScopeTool(name, input, {
              userId: this.config.userId,
              sessionId: this.config.sessionId,
              workspaceId: this.config.workspaceId,
            });
          }

          // Check if it's an MCP tool call
          if (name.startsWith('mcp__')) {
            const mcpManager = getMCPManager();
            const result = await mcpManager.executeTool(name, input);
            if (result.success) {
              return String(result.result);
            }
            return `MCP tool error: ${result.error}`;
          }

          return `Unknown tool: ${name}`;
      }
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Normalize and sanitize file path
   * Prevents path traversal attacks (e.g., /../etc/passwd)
   */
  private normalizePath(path: string): string {
    // Sanitize the path first to remove dangerous characters and traversals
    const sanitized = sanitizeFilePath(path);

    // If already absolute and within workspace, return as-is
    if (sanitized.startsWith('/workspace/') || sanitized === '/workspace') {
      return sanitized;
    }

    // If absolute path outside workspace, confine to workspace
    if (sanitized.startsWith('/')) {
      // Remove leading slash and prepend workspace
      const relativePath = sanitized.slice(1);
      return `/workspace/${relativePath}`;
    }

    // Relative path - prepend workspace
    return `/workspace/${sanitized}`;
  }

  /** Cached memory context */
  private memoryContext: string = '';

  /**
   * Load CLAUDE.md memory context for the workspace
   */
  private async loadMemoryContext(): Promise<string> {
    try {
      const readFileFn = async (path: string) => {
        return await this.container.readFile(this.config.workspaceId, path);
      };
      const fileExistsFn = async (path: string) => {
        try {
          await this.container.readFile(this.config.workspaceId, path);
          return true;
        } catch {
          return false;
        }
      };
      const listDirFn = async (path: string) => {
        const files = await this.container.listDirectory(this.config.workspaceId, path);
        return files.map((f) => f.path);
      };

      const context = await getCachedMemoryContext(
        '/workspace',
        readFileFn,
        fileExistsFn,
        listDirFn
      );

      return context.combinedContent;
    } catch (error) {
      log.warn('Failed to load memory context', { error });
      return '';
    }
  }

  /**
   * Get system prompt with CLAUDE.md context injected
   */
  private getSystemPrompt(): string {
    const basePrompt = `You are Claude, an expert software engineer working in an isolated sandbox environment. You have full access to a Linux shell, file system, and git.

CAPABILITIES:
- Execute any shell command (npm, pip, cargo, python, node, etc.)
- Read, write, and edit files
- Search files and code
- Run builds and tests
- Make git commits
- Install packages
- Create and execute structured plans with approval gates
- Load project context from CLAUDE.md files

GUIDELINES:
1. ALWAYS read files before editing to understand the current state
2. Use edit_file for targeted changes (find/replace), write_file for new files or complete rewrites
3. Run builds after making changes to verify they work
4. Run tests after changes to ensure nothing breaks
5. Search the codebase to understand patterns before making changes
6. Make clear, descriptive git commits
7. For complex tasks, use plan_create to structure your approach

PLAN MODE:
- Use plan_create to break complex tasks into steps
- Each step tracks progress (pending, in_progress, completed, skipped, failed)
- Use plan_approve to start execution
- Use plan_complete_step after finishing each step
- Use plan_skip_step to skip unnecessary steps
- Use plan_cancel to abort

ERROR HANDLING:
- If a command fails, analyze the error and fix it
- If edit_file fails (text not found), read the file first to see actual content
- If unsure, explore the codebase first with list_files and search_code

CURRENT WORKSPACE: /workspace
This is the root of the project. All file paths are relative to this.

Be thorough and proactive. When given a task:
1. Understand the current state (read files, explore)
2. Plan your approach (use plan_create for complex tasks)
3. Implement changes
4. Verify they work (build, test)
5. Report what you did

Always explain what you're doing and why.`;

    // Inject memory context if available
    if (this.memoryContext) {
      return `${basePrompt}\n\n${this.memoryContext}`;
    }

    return basePrompt;
  }

  /**
   * Log tool executions to database
   */
  private async logToolExecutions(): Promise<void> {
    if (this.toolsUsed.size === 0) return;

    try {
      const executions = Array.from(this.toolsUsed).map((tool) => ({
        workspace_id: this.config.workspaceId,
        session_id: this.config.sessionId,
        user_id: this.config.userId,
        tool_name: tool,
        success: true,
        created_at: new Date().toISOString(),
      }));

      await this.supabase.from('tool_executions').insert(executions);
    } catch (error) {
      log.error('Failed to log tool executions', error as Error);
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
  if (agenticPatterns.some((p) => p.test(message))) {
    return true;
  }

  // Keyword density check
  const agenticKeywords = [
    'file',
    'folder',
    'directory',
    'path',
    'edit',
    'modify',
    'change',
    'update',
    'run',
    'execute',
    'command',
    'terminal',
    'install',
    'build',
    'test',
    'deploy',
    'git',
    'commit',
    'branch',
    'push',
    'fix',
    'debug',
    'error',
    'bug',
    'find',
    'search',
    'grep',
    'locate',
  ];

  const matchCount = agenticKeywords.filter((k) => lower.includes(k)).length;
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
        controller.enqueue(
          encoder.encode('┌─────────────────────────────────────────────────────────────────┐\n')
        );
        controller.enqueue(
          encoder.encode('│                    WORKSPACE AGENT                              │\n')
        );
        controller.enqueue(
          encoder.encode('│                 Autonomous Code Execution                       │\n')
        );
        controller.enqueue(
          encoder.encode('└─────────────────────────────────────────────────────────────────┘\n')
        );
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
              const truncated =
                output.length > 500 ? output.substring(0, 500) + '\n... (truncated)' : output;

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
    // Plan Mode (new step-based system)
    plan_create: 'Creating plan',
    plan_status: 'Getting plan status',
    plan_approve: 'Approving plan',
    plan_complete_step: 'Completing step',
    plan_skip_step: 'Skipping step',
    plan_cancel: 'Cancelling plan',
    // MCP
    mcp_list_servers: 'Listing MCP servers',
    mcp_start_server: 'Starting MCP server',
    mcp_stop_server: 'Stopping MCP server',
    mcp_list_tools: 'Listing MCP tools',
    // Hooks
    hooks_list: 'Listing hooks',
    hooks_enable: 'Enabling hook',
    hooks_disable: 'Disabling hook',
    hooks_create: 'Creating hook',
    // CLAUDE.md Memory (hierarchical)
    memory_load: 'Loading CLAUDE.md memory',
    memory_create: 'Creating CLAUDE.md',
    memory_update: 'Updating CLAUDE.md',
    memory_add_instruction: 'Adding instruction',
    // Background Tasks
    bg_run: 'Starting background task',
    bg_output: 'Getting task output',
    bg_kill: 'Killing task',
    bg_list: 'Listing tasks',
    // Permission Tools
    permission_check: 'Checking permission',
    permission_request: 'Requesting permission',
    permission_set_auto: 'Setting auto-approve',
    // Model Config Tools
    model_list: 'Listing models',
    model_select: 'Selecting model',
    model_current: 'Getting current model',
    // Token Tracking Tools
    tokens_usage: 'Getting token usage',
    tokens_context: 'Getting context info',
    // Extended Thinking Tools
    thinking_enable: 'Enabling extended thinking',
    thinking_disable: 'Disabling extended thinking',
    thinking_status: 'Getting thinking status',
    // Context Compaction Tools
    context_compact: 'Compacting context',
    context_settings: 'Context settings',
  };

  // Handle MCP tool names
  if (tool.startsWith('mcp__')) {
    const parts = tool.split('__');
    if (parts.length >= 3) {
      return `MCP: ${parts[2]}`;
    }
  }

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
