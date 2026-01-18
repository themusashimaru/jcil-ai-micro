/**
 * SUBAGENT SYSTEM
 *
 * Implements Claude Code-like parallel agent execution:
 * - Specialized subagent types (Explore, Plan, Bash, general-purpose)
 * - Run in background support
 * - Resumable agents with IDs
 * - Model selection (sonnet, opus, haiku)
 * - Parallel execution
 */

import Anthropic from '@anthropic-ai/sdk';
import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import { ContainerManager } from '@/lib/workspace/container';

const log = logger('Subagent');

// ============================================================================
// TYPES
// ============================================================================

export type SubagentType = 'general-purpose' | 'Explore' | 'Plan' | 'Bash' | 'claude-code-guide';

export type SubagentModel = 'sonnet' | 'opus' | 'haiku';

export type SubagentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'background';

export interface SubagentConfig {
  type: SubagentType;
  prompt: string;
  description: string;
  model?: SubagentModel;
  runInBackground?: boolean;
  workspaceId?: string;
  userId?: string;
  sessionId?: string;
  parentAgentId?: string;
}

export interface SubagentResult {
  agentId: string;
  status: SubagentStatus;
  result?: string;
  error?: string;
  outputFile?: string; // For background agents
  startedAt: Date;
  completedAt?: Date;
  model: string;
  type: SubagentType;
}

export interface SubagentContext {
  workspaceId: string;
  userId: string;
  sessionId: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

// ============================================================================
// MODEL MAPPING
// ============================================================================

const MODEL_MAP: Record<SubagentModel, string> = {
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-5-20251101',
  haiku: 'claude-3-5-haiku-20241022',
};

// ============================================================================
// SUBAGENT TYPE CONFIGURATIONS
// ============================================================================

const SUBAGENT_CONFIGS: Record<
  SubagentType,
  {
    systemPrompt: string;
    defaultModel: SubagentModel;
    tools: string[];
  }
> = {
  'general-purpose': {
    systemPrompt: `You are a general-purpose coding agent. You have access to all tools and can help with any coding task. Be thorough and complete the task fully.`,
    defaultModel: 'sonnet',
    tools: ['all'],
  },
  Explore: {
    systemPrompt: `You are an exploration agent specialized for quickly finding files and understanding codebases. Focus on:
- Finding files by patterns
- Searching code for keywords
- Answering questions about codebase structure
- Be fast and efficient - return results quickly without over-analyzing.`,
    defaultModel: 'haiku',
    tools: ['search_files', 'search_code', 'list_files', 'read_file', 'execute_shell'],
  },
  Plan: {
    systemPrompt: `You are a planning agent specialized for designing implementation strategies. Focus on:
- Breaking down complex tasks into steps
- Identifying critical files and dependencies
- Considering architectural trade-offs
- Creating step-by-step implementation plans
Do NOT write code - only plan and analyze.`,
    defaultModel: 'sonnet',
    tools: ['search_files', 'search_code', 'list_files', 'read_file'],
  },
  Bash: {
    systemPrompt: `You are a Bash command execution specialist. Focus on:
- Running shell commands
- Git operations
- Build and test execution
- Package management
Keep your responses concise and focused on command output.`,
    defaultModel: 'haiku',
    tools: ['execute_shell', 'git_status', 'git_diff', 'git_commit', 'run_build', 'run_tests'],
  },
  'claude-code-guide': {
    systemPrompt: `You are a Claude Code documentation expert. Help users understand:
- Claude Code CLI features and commands
- Hooks, slash commands, MCP servers
- Settings and IDE integrations
- Claude Agent SDK for building custom agents
- Anthropic API usage
Use web search and documentation to provide accurate, up-to-date information.`,
    defaultModel: 'haiku',
    tools: ['web_search', 'web_fetch', 'read_file'],
  },
};

// ============================================================================
// SUBAGENT MANAGER
// ============================================================================

class SubagentManager extends EventEmitter {
  private anthropic: Anthropic;
  private container: ContainerManager;
  private agents: Map<string, SubagentState> = new Map();
  private agentIdCounter = 0;

  constructor() {
    super();
    this.anthropic = new Anthropic();
    this.container = new ContainerManager();
  }

  /**
   * Generate a unique agent ID
   */
  private generateAgentId(): string {
    this.agentIdCounter++;
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 5);
    return `${timestamp}${random}`;
  }

  /**
   * Get model string from model type
   */
  private getModelString(model?: SubagentModel, type?: SubagentType): string {
    if (model) {
      return MODEL_MAP[model];
    }
    const config = type ? SUBAGENT_CONFIGS[type] : SUBAGENT_CONFIGS['general-purpose'];
    return MODEL_MAP[config.defaultModel];
  }

  /**
   * Spawn a new subagent
   */
  async spawn(config: SubagentConfig, context: SubagentContext): Promise<SubagentResult> {
    const agentId = this.generateAgentId();
    const model = this.getModelString(config.model, config.type);
    const typeConfig = SUBAGENT_CONFIGS[config.type] || SUBAGENT_CONFIGS['general-purpose'];

    log.info('Spawning subagent', {
      agentId,
      type: config.type,
      model,
      description: config.description,
    });

    const state: SubagentState = {
      id: agentId,
      config,
      context,
      status: config.runInBackground ? 'background' : 'running',
      model,
      startedAt: new Date(),
      output: [],
      transcript: [],
    };

    this.agents.set(agentId, state);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(typeConfig, config, context);

    // If running in background, start async and return immediately
    if (config.runInBackground) {
      this.runInBackground(agentId, systemPrompt, config.prompt, model).catch((error) => {
        state.status = 'failed';
        state.error = error instanceof Error ? error.message : 'Unknown error';
        state.completedAt = new Date();
      });

      return {
        agentId,
        status: 'background',
        model,
        type: config.type,
        startedAt: state.startedAt,
        outputFile: `/tmp/agent-${agentId}.output`,
      };
    }

    // Run synchronously
    try {
      const result = await this.runAgent(agentId, systemPrompt, config.prompt, model);
      state.status = 'completed';
      state.result = result;
      state.completedAt = new Date();

      return {
        agentId,
        status: 'completed',
        result,
        model,
        type: config.type,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
      };
    } catch (error) {
      state.status = 'failed';
      state.error = error instanceof Error ? error.message : 'Unknown error';
      state.completedAt = new Date();

      return {
        agentId,
        status: 'failed',
        error: state.error,
        model,
        type: config.type,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
      };
    }
  }

  /**
   * Resume a paused or background agent
   */
  async resume(agentId: string, additionalPrompt?: string): Promise<SubagentResult> {
    const state = this.agents.get(agentId);
    if (!state) {
      return {
        agentId,
        status: 'failed',
        error: `Agent not found: ${agentId}`,
        model: 'unknown',
        type: 'general-purpose',
        startedAt: new Date(),
        completedAt: new Date(),
      };
    }

    log.info('Resuming subagent', { agentId });

    // Build messages from transcript
    const messages = [...state.transcript];
    if (additionalPrompt) {
      messages.push({ role: 'user', content: additionalPrompt });
    }

    const typeConfig = SUBAGENT_CONFIGS[state.config.type] || SUBAGENT_CONFIGS['general-purpose'];
    const systemPrompt = this.buildSystemPrompt(typeConfig, state.config, state.context);

    state.status = 'running';

    try {
      const result = await this.runAgentWithMessages(agentId, systemPrompt, messages, state.model);
      state.status = 'completed';
      state.result = result;
      state.completedAt = new Date();

      return {
        agentId,
        status: 'completed',
        result,
        model: state.model,
        type: state.config.type,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
      };
    } catch (error) {
      state.status = 'failed';
      state.error = error instanceof Error ? error.message : 'Unknown error';
      state.completedAt = new Date();

      return {
        agentId,
        status: 'failed',
        error: state.error,
        model: state.model,
        type: state.config.type,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
      };
    }
  }

  /**
   * Get agent status
   */
  getStatus(agentId: string): SubagentResult | null {
    const state = this.agents.get(agentId);
    if (!state) return null;

    return {
      agentId,
      status: state.status,
      result: state.result,
      error: state.error,
      model: state.model,
      type: state.config.type,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
    };
  }

  /**
   * Get all active agents
   */
  getActiveAgents(): SubagentResult[] {
    const results: SubagentResult[] = [];
    for (const state of this.agents.values()) {
      if (state.status === 'running' || state.status === 'background') {
        results.push({
          agentId: state.id,
          status: state.status,
          model: state.model,
          type: state.config.type,
          startedAt: state.startedAt,
        });
      }
    }
    return results;
  }

  /**
   * Build system prompt for subagent
   */
  private buildSystemPrompt(
    typeConfig: (typeof SUBAGENT_CONFIGS)['general-purpose'],
    config: SubagentConfig,
    context: SubagentContext
  ): string {
    return `${typeConfig.systemPrompt}

You are a subagent spawned to complete a specific task.
Task Description: ${config.description}

Context:
- Workspace ID: ${context.workspaceId}
- Session ID: ${context.sessionId}

Instructions:
- Focus on completing the task efficiently
- Return results clearly and concisely
- If you encounter errors, report them clearly
`;
  }

  /**
   * Run agent synchronously
   */
  private async runAgent(
    agentId: string,
    systemPrompt: string,
    userPrompt: string,
    model: string
  ): Promise<string> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: userPrompt },
    ];

    return this.runAgentWithMessages(agentId, systemPrompt, messages, model);
  }

  /**
   * Run agent with existing messages
   */
  private async runAgentWithMessages(
    agentId: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    model: string
  ): Promise<string> {
    const state = this.agents.get(agentId)!;
    let result = '';
    let iterations = 0;
    const maxIterations = 15;

    while (iterations < maxIterations) {
      iterations++;

      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages as Anthropic.MessageParam[],
        tools: this.getToolsForType(state.config.type),
      });

      // Process response
      let hasToolUse = false;
      for (const block of response.content) {
        if (block.type === 'text') {
          result += block.text;
          state.output.push(block.text);
        } else if (block.type === 'tool_use') {
          hasToolUse = true;
          // Execute tool (simplified - would need full tool implementation)
          const toolResult = await this.executeTool(
            block.name,
            block.input as Record<string, unknown>,
            state
          );

          // Add to transcript
          state.transcript.push(
            { role: 'assistant', content: JSON.stringify(response.content) },
            {
              role: 'user',
              content: JSON.stringify([
                { type: 'tool_result', tool_use_id: block.id, content: toolResult },
              ]),
            }
          );
        }
      }

      if (!hasToolUse || response.stop_reason === 'end_turn') {
        break;
      }

      // Update messages for next iteration
      messages.push({ role: 'assistant', content: JSON.stringify(response.content) });
    }

    state.transcript.push({ role: 'assistant', content: result });
    return result;
  }

  /**
   * Run agent in background
   */
  private async runInBackground(
    agentId: string,
    systemPrompt: string,
    userPrompt: string,
    model: string
  ): Promise<void> {
    const state = this.agents.get(agentId)!;

    try {
      const result = await this.runAgent(agentId, systemPrompt, userPrompt, model);
      state.status = 'completed';
      state.result = result;
      state.completedAt = new Date();

      this.emit('agent:completed', { agentId, result });
    } catch (error) {
      state.status = 'failed';
      state.error = error instanceof Error ? error.message : 'Unknown error';
      state.completedAt = new Date();

      this.emit('agent:failed', { agentId, error: state.error });
    }
  }

  /**
   * Get tools for agent type
   */
  private getToolsForType(type: SubagentType): Anthropic.Tool[] {
    // Simplified tool definitions for subagents
    const allTools: Anthropic.Tool[] = [
      {
        name: 'execute_shell',
        description: 'Execute a shell command',
        input_schema: {
          type: 'object' as const,
          properties: {
            command: { type: 'string', description: 'Command to execute' },
          },
          required: ['command'],
        },
      },
      {
        name: 'read_file',
        description: 'Read a file',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: 'File path' },
          },
          required: ['path'],
        },
      },
      {
        name: 'search_files',
        description: 'Search for files by pattern',
        input_schema: {
          type: 'object' as const,
          properties: {
            pattern: { type: 'string', description: 'Glob pattern' },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'search_code',
        description: 'Search code for a pattern',
        input_schema: {
          type: 'object' as const,
          properties: {
            pattern: { type: 'string', description: 'Search pattern' },
            path: { type: 'string', description: 'Directory to search' },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'list_files',
        description: 'List files in a directory',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: 'Directory path' },
          },
          required: ['path'],
        },
      },
    ];

    const typeConfig = SUBAGENT_CONFIGS[type] || SUBAGENT_CONFIGS['general-purpose'];
    if (typeConfig.tools.includes('all')) {
      return allTools;
    }

    return allTools.filter((t) => typeConfig.tools.includes(t.name));
  }

  /**
   * Execute a tool (simplified)
   */
  private async executeTool(
    name: string,
    input: Record<string, unknown>,
    state: SubagentState
  ): Promise<string> {
    const workspaceId = state.context.workspaceId;

    try {
      switch (name) {
        case 'execute_shell':
          const result = await this.container.executeCommand(workspaceId, input.command as string);
          return result.stdout || result.stderr || '[No output]';

        case 'read_file':
          return await this.container.readFile(workspaceId, input.path as string);

        case 'search_files':
          const searchResult = await this.container.executeCommand(
            workspaceId,
            `find /workspace -name "${input.pattern}" -type f 2>/dev/null | head -50`
          );
          return searchResult.stdout || 'No files found';

        case 'search_code':
          const grepResult = await this.container.executeCommand(
            workspaceId,
            `grep -rn "${input.pattern}" ${input.path || '/workspace'} 2>/dev/null | head -100`
          );
          return grepResult.stdout || 'No matches found';

        case 'list_files':
          const listResult = await this.container.executeCommand(
            workspaceId,
            `ls -la ${input.path || '/workspace'}`
          );
          return listResult.stdout || 'Empty directory';

        default:
          return `Unknown tool: ${name}`;
      }
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

// ============================================================================
// INTERNAL STATE
// ============================================================================

interface SubagentState {
  id: string;
  config: SubagentConfig;
  context: SubagentContext;
  status: SubagentStatus;
  model: string;
  startedAt: Date;
  completedAt?: Date;
  result?: string;
  error?: string;
  output: string[];
  transcript: Array<{ role: string; content: string }>;
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

let subagentManagerInstance: SubagentManager | null = null;

export function getSubagentManager(): SubagentManager {
  if (!subagentManagerInstance) {
    subagentManagerInstance = new SubagentManager();
  }
  return subagentManagerInstance;
}

/**
 * Get subagent tools for Anthropic API
 */
export function getSubagentTools(): Anthropic.Tool[] {
  return [
    {
      name: 'task',
      description: `Launch a specialized agent to handle complex, multi-step tasks autonomously.

Available agent types:
- general-purpose: General coding tasks (all tools)
- Explore: Fast codebase exploration (file/code search)
- Plan: Implementation planning (read-only analysis)
- Bash: Command execution specialist
- claude-code-guide: Documentation and help

Use run_in_background=true for long-running tasks.
Use resume parameter to continue a previous agent.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          description: {
            type: 'string',
            description: 'Short (3-5 word) description of the task',
          },
          prompt: {
            type: 'string',
            description: 'Detailed instructions for the agent',
          },
          subagent_type: {
            type: 'string',
            enum: ['general-purpose', 'Explore', 'Plan', 'Bash', 'claude-code-guide'],
            description: 'Type of specialized agent to use',
          },
          model: {
            type: 'string',
            enum: ['sonnet', 'opus', 'haiku'],
            description: 'Model to use (default: inherit from parent)',
          },
          run_in_background: {
            type: 'boolean',
            description: 'Run in background (returns immediately with output_file)',
          },
          resume: {
            type: 'string',
            description: 'Agent ID to resume from a previous execution',
          },
        },
        required: ['description', 'prompt', 'subagent_type'],
      },
    },
    {
      name: 'task_output',
      description: 'Get output from a running or completed background agent',
      input_schema: {
        type: 'object' as const,
        properties: {
          agent_id: {
            type: 'string',
            description: 'Agent ID to get output from',
          },
          block: {
            type: 'boolean',
            description: 'Wait for completion (default: true)',
          },
          timeout: {
            type: 'number',
            description: 'Max wait time in ms (default: 30000)',
          },
        },
        required: ['agent_id'],
      },
    },
  ];
}

/**
 * Execute a subagent tool
 */
export async function executeSubagentTool(
  toolName: string,
  input: Record<string, unknown>,
  context: SubagentContext
): Promise<string> {
  const manager = getSubagentManager();

  switch (toolName) {
    case 'task': {
      // Check if resuming an existing agent
      if (input.resume) {
        const result = await manager.resume(input.resume as string, input.prompt as string);
        return formatSubagentResult(result);
      }

      // Spawn new agent
      const config: SubagentConfig = {
        type: (input.subagent_type as SubagentType) || 'general-purpose',
        prompt: input.prompt as string,
        description: input.description as string,
        model: input.model as SubagentModel | undefined,
        runInBackground: input.run_in_background as boolean | undefined,
        workspaceId: context.workspaceId,
        userId: context.userId,
        sessionId: context.sessionId,
      };

      const result = await manager.spawn(config, context);
      return formatSubagentResult(result);
    }

    case 'task_output': {
      const agentId = input.agent_id as string;
      const result = manager.getStatus(agentId);

      if (!result) {
        return `Agent not found: ${agentId}`;
      }

      if (result.status === 'running' || result.status === 'background') {
        if (input.block !== false) {
          // Wait for completion (simplified - would need proper async handling)
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const updatedResult = manager.getStatus(agentId);
          if (updatedResult) {
            return formatSubagentResult(updatedResult);
          }
        }
        return `Agent ${agentId} is still running (status: ${result.status})`;
      }

      return formatSubagentResult(result);
    }

    default:
      return `Unknown subagent tool: ${toolName}`;
  }
}

/**
 * Format subagent result for display
 */
function formatSubagentResult(result: SubagentResult): string {
  const lines: string[] = [];

  if (result.status === 'background') {
    lines.push(`Agent ${result.agentId} started in background`);
    lines.push(`Type: ${result.type}`);
    lines.push(`Model: ${result.model}`);
    if (result.outputFile) {
      lines.push(`Output file: ${result.outputFile}`);
    }
    lines.push('\nUse task_output to check progress.');
  } else if (result.status === 'completed') {
    lines.push(`Agent ${result.agentId} completed`);
    lines.push(`Type: ${result.type}`);
    lines.push(`Model: ${result.model}`);
    if (result.completedAt && result.startedAt) {
      const duration = result.completedAt.getTime() - result.startedAt.getTime();
      lines.push(`Duration: ${(duration / 1000).toFixed(1)}s`);
    }
    lines.push('\n--- Result ---');
    lines.push(result.result || '(No output)');
  } else if (result.status === 'failed') {
    lines.push(`Agent ${result.agentId} failed`);
    lines.push(`Error: ${result.error || 'Unknown error'}`);
  } else {
    lines.push(`Agent ${result.agentId} status: ${result.status}`);
  }

  return lines.join('\n');
}

/**
 * Check if a tool is a subagent tool
 */
export function isSubagentTool(toolName: string): boolean {
  return toolName === 'task' || toolName === 'task_output';
}
