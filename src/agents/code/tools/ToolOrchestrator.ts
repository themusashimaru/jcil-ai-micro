/**
 * TOOL ORCHESTRATOR
 *
 * The brain that decides which tools to use and when.
 * Manages the agentic loop of:
 * 1. Think about what to do
 * 2. Decide which tool(s) to use
 * 3. Execute tools
 * 4. Process results
 * 5. Repeat until task complete
 *
 * This is what makes the agent truly autonomous.
 *
 * MULTI-PROVIDER SUPPORT:
 * - Works with any configured AI provider (Claude, OpenAI, xAI, DeepSeek)
 * - User picks provider → same tool-calling capabilities
 */

import {
  agentChatWithTools,
  buildToolResultMessage,
  buildToolCallMessage,
  ProviderId,
  UnifiedMessage,
  UnifiedTool,
} from '@/lib/ai/providers';
import { BaseTool, ToolDefinition, ToolOutput } from './BaseTool';
import { readTool, ReadTool } from './ReadTool';
import { searchTool, SearchTool } from './SearchTool';
import { bashTool, BashTool } from './BashTool';
import { writeTool, WriteTool } from './WriteTool';
import { globTool, GlobTool } from './GlobTool';
import { AgentStreamCallback } from '../../core/types';

export interface OrchestratorConfig {
  githubToken?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  sandboxUrl?: string;
  oidcToken?: string;
  workspaceId?: string;
}

export interface ThinkingStep {
  type: 'thinking' | 'tool_use' | 'tool_result' | 'conclusion';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: ToolOutput;
  timestamp: number;
}

export interface OrchestratorResult {
  success: boolean;
  conclusion: string;
  thinkingSteps: ThinkingStep[];
  toolsUsed: string[];
  totalTokens: number;
  executionTime: number;
}

export class ToolOrchestrator {
  private provider: ProviderId = 'claude';
  private tools: Map<string, BaseTool> = new Map();
  private maxIterations = 10;
  private maxTokens = 16000;

  /**
   * Set the AI provider to use for tool orchestration
   */
  setProvider(provider: ProviderId): void {
    this.provider = provider;
  }

  constructor() {
    // Register all available tools
    this.registerTool(readTool);
    this.registerTool(writeTool);
    this.registerTool(globTool);
    this.registerTool(searchTool);
    this.registerTool(bashTool);
  }

  /**
   * Register a tool for use by the agent
   */
  registerTool(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Initialize all tools with configuration
   */
  initialize(config: OrchestratorConfig): void {
    // Initialize ReadTool
    (readTool as ReadTool).initialize({
      workspaceId: config.workspaceId,
      githubToken: config.githubToken,
      owner: config.owner,
      repo: config.repo,
      branch: config.branch,
    });

    // Initialize SearchTool
    (searchTool as SearchTool).initialize({
      githubToken: config.githubToken,
      owner: config.owner,
      repo: config.repo,
    });

    // Initialize BashTool
    (bashTool as BashTool).initialize({
      sandboxUrl: config.sandboxUrl,
      oidcToken: config.oidcToken,
    });

    // Initialize WriteTool
    (writeTool as WriteTool).initialize({
      workspaceId: config.workspaceId,
      githubToken: config.githubToken,
      owner: config.owner,
      repo: config.repo,
      branch: config.branch,
    });

    // Initialize GlobTool
    (globTool as GlobTool).initialize({
      workspaceId: config.workspaceId,
    });
  }

  /**
   * Get tool definitions for the LLM
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.getDefinition());
  }

  /**
   * Execute the agentic tool loop
   */
  async execute(
    task: string,
    context: string,
    onStream: AgentStreamCallback
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const thinkingSteps: ThinkingStep[] = [];
    const toolsUsed: string[] = [];
    let totalTokens = 0;

    // Build system prompt with tool awareness
    const systemPrompt = this.buildSystemPrompt(context);

    // Initialize message history with unified format
    const messages: UnifiedMessage[] = [{ role: 'user', content: task }];

    // Convert tool definitions to unified format
    const unifiedTools = this.getUnifiedToolDefinitions();

    // Stream initial thinking
    this.streamThinking(onStream, 'Analyzing task and planning approach...');

    try {
      let iteration = 0;

      while (iteration < this.maxIterations) {
        iteration++;

        // Call AI provider with tools (works with Claude, OpenAI, xAI, DeepSeek)
        const response = await agentChatWithTools(messages, unifiedTools, {
          provider: this.provider,
          systemPrompt,
          maxTokens: this.maxTokens,
        });

        // Track token usage
        if (response.usage) {
          totalTokens += response.usage.inputTokens + response.usage.outputTokens;
        }

        // Stream thinking text
        if (response.text.trim()) {
          thinkingSteps.push({
            type: 'thinking',
            content: response.text,
            timestamp: Date.now(),
          });
          this.streamThinking(onStream, response.text);
        }

        // If done (no tool calls), return conclusion
        if (response.done) {
          thinkingSteps.push({
            type: 'conclusion',
            content: response.text,
            timestamp: Date.now(),
          });

          return {
            success: true,
            conclusion: response.text,
            thinkingSteps,
            toolsUsed: [...new Set(toolsUsed)],
            totalTokens,
            executionTime: Date.now() - startTime,
          };
        }

        // Execute tool calls
        const toolResults: { toolCallId: string; content: string; isError?: boolean }[] = [];

        for (const toolCall of response.toolCalls) {
          const tool = this.tools.get(toolCall.name);

          if (!tool) {
            toolResults.push({
              toolCallId: toolCall.id,
              content: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
              isError: true,
            });
            continue;
          }

          // Stream tool use
          this.streamToolUse(onStream, toolCall.name, toolCall.arguments);
          toolsUsed.push(toolCall.name);

          thinkingSteps.push({
            type: 'tool_use',
            content: `Using ${toolCall.name}`,
            toolName: toolCall.name,
            toolInput: toolCall.arguments,
            timestamp: Date.now(),
          });

          // Execute tool
          const result = await tool.execute(toolCall.arguments);

          // Stream tool result
          this.streamToolResult(onStream, toolCall.name, result);

          thinkingSteps.push({
            type: 'tool_result',
            content: result.success ? 'Tool succeeded' : `Tool failed: ${result.error}`,
            toolName: toolCall.name,
            toolOutput: result,
            timestamp: Date.now(),
          });

          toolResults.push({
            toolCallId: toolCall.id,
            content: JSON.stringify(result),
            isError: !result.success,
          });
        }

        // Add assistant message with tool calls to history
        messages.push(buildToolCallMessage(response.toolCalls));

        // Add tool results to history
        messages.push(buildToolResultMessage(toolResults));
      }

      // Max iterations reached
      return {
        success: false,
        conclusion: 'Max iterations reached without completing task',
        thinkingSteps,
        toolsUsed: [...new Set(toolsUsed)],
        totalTokens,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        conclusion: error instanceof Error ? error.message : 'Unknown error',
        thinkingSteps,
        toolsUsed: [...new Set(toolsUsed)],
        totalTokens,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build system prompt with tool awareness
   */
  private buildSystemPrompt(context: string): string {
    return `You are an expert software engineer with access to tools for reading, searching, and executing code.

CONTEXT:
${context}

YOUR CAPABILITIES:
1. **read** - Read files from the codebase (use for understanding existing code)
2. **search** - Search for patterns, filenames, or symbols in the codebase
3. **bash** - Execute shell commands (npm, node, git, etc.)

APPROACH:
1. First, understand the task completely
2. Search/read relevant files to understand the codebase
3. Think step-by-step about your approach
4. Use tools to gather information or execute commands
5. Synthesize findings into a clear conclusion

IMPORTANT:
- Always explain your thinking before using a tool
- Read files before modifying them
- Search to find relevant code before making assumptions
- Run tests after making changes
- Be thorough but efficient

When you have enough information to complete the task, provide a clear conclusion.`;
  }

  /**
   * Convert tools to unified format (works with all providers)
   */
  private getUnifiedToolDefinitions(): UnifiedTool[] {
    return Array.from(this.tools.values()).map((tool) => {
      const def = tool.getDefinition();
      return {
        name: def.name,
        description: def.description,
        parameters: {
          type: 'object' as const,
          properties: def.parameters.properties,
          required: def.parameters.required || [],
        },
      };
    });
  }

  /**
   * Stream thinking to callback
   */
  private streamThinking(onStream: AgentStreamCallback, content: string): void {
    onStream({
      type: 'thinking',
      message: content,
      timestamp: Date.now(),
    });
  }

  /**
   * Stream tool use to callback
   */
  private streamToolUse(
    onStream: AgentStreamCallback,
    toolName: string,
    input: Record<string, unknown>
  ): void {
    const inputPreview = JSON.stringify(input).substring(0, 100);
    onStream({
      type: 'searching',
      message: `Using ${toolName}: ${inputPreview}`,
      timestamp: Date.now(),
      details: { tool: toolName, input },
    });
  }

  /**
   * Stream tool result to callback
   */
  private streamToolResult(
    onStream: AgentStreamCallback,
    toolName: string,
    result: ToolOutput
  ): void {
    const status = result.success ? '✓' : '✗';
    const preview = result.success ? JSON.stringify(result.result).substring(0, 100) : result.error;
    onStream({
      type: result.success ? 'evaluating' : 'error',
      message: `${toolName} ${status}: ${preview}`,
      timestamp: Date.now(),
      details: { tool: toolName, success: result.success },
    });
  }

  /**
   * Quick search for files matching pattern
   */
  async quickSearch(query: string, type: 'content' | 'filename' = 'content'): Promise<string[]> {
    const result = await searchTool.execute({ query, type, maxResults: 10 });
    if (!result.success || !result.result) return [];
    return result.result.matches.map((m) => m.path);
  }

  /**
   * Quick read of a file
   */
  async quickRead(path: string): Promise<string | null> {
    const result = await readTool.execute({ path });
    if (!result.success || !result.result) return null;
    return result.result.content;
  }
}

export const toolOrchestrator = new ToolOrchestrator();
