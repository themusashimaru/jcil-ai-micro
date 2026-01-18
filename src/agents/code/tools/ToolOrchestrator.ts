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
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseTool, ToolDefinition, ToolCall, ToolOutput } from './BaseTool';
import { readTool, ReadTool } from './ReadTool';
import { searchTool, SearchTool } from './SearchTool';
import { bashTool, BashTool } from './BashTool';
import { writeTool, WriteTool } from './WriteTool';
import { AgentStreamCallback } from '../../core/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

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
  private model = 'claude-opus-4-5-20251101';
  private tools: Map<string, BaseTool> = new Map();
  private maxIterations = 10;
  private maxTokens = 16000;

  constructor() {
    // Register all available tools
    this.registerTool(readTool);
    this.registerTool(writeTool);
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

    // Initialize message history
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'user', content: task },
    ];

    // Stream initial thinking
    this.streamThinking(onStream, 'Analyzing task and planning approach...');

    try {
      let iteration = 0;

      while (iteration < this.maxIterations) {
        iteration++;

        // Call Claude with tool use
        const response = await anthropic.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          system: systemPrompt,
          tools: this.getAnthropicToolDefinitions(),
          messages: messages as Anthropic.MessageParam[],
        });

        totalTokens += response.usage.input_tokens + response.usage.output_tokens;

        // Process response content
        let assistantText = '';
        const toolCalls: ToolCall[] = [];

        for (const block of response.content) {
          if (block.type === 'text') {
            assistantText += block.text;

            // Stream thinking
            if (block.text.trim()) {
              thinkingSteps.push({
                type: 'thinking',
                content: block.text,
                timestamp: Date.now(),
              });
              this.streamThinking(onStream, block.text);
            }
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              name: block.name,
              input: block.input as Record<string, unknown>,
            });
          }
        }

        // If no tool calls and stop reason is end_turn, we're done
        if (toolCalls.length === 0 && response.stop_reason === 'end_turn') {
          thinkingSteps.push({
            type: 'conclusion',
            content: assistantText,
            timestamp: Date.now(),
          });

          return {
            success: true,
            conclusion: assistantText,
            thinkingSteps,
            toolsUsed: [...new Set(toolsUsed)],
            totalTokens,
            executionTime: Date.now() - startTime,
          };
        }

        // Execute tool calls
        const toolResults: { id: string; content: string }[] = [];

        for (const toolCall of toolCalls) {
          const tool = this.tools.get(toolCall.name);

          if (!tool) {
            toolResults.push({
              id: toolCall.id,
              content: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
            });
            continue;
          }

          // Stream tool use
          this.streamToolUse(onStream, toolCall.name, toolCall.input);
          toolsUsed.push(toolCall.name);

          thinkingSteps.push({
            type: 'tool_use',
            content: `Using ${toolCall.name}`,
            toolName: toolCall.name,
            toolInput: toolCall.input,
            timestamp: Date.now(),
          });

          // Execute tool
          const result = await tool.execute(toolCall.input);

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
            id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        // Add assistant message with tool use
        messages.push({
          role: 'assistant',
          content: JSON.stringify(response.content),
        });

        // Add tool results as user message
        messages.push({
          role: 'user',
          content: toolResults.map((r) => `Tool ${r.id} result: ${r.content}`).join('\n'),
        });
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
   * Convert tools to Anthropic format
   */
  private getAnthropicToolDefinitions(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map((tool) => {
      const def = tool.getDefinition();
      return {
        name: def.name,
        description: def.description,
        input_schema: {
          type: 'object' as const,
          properties: def.parameters.properties,
          required: def.parameters.required,
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
