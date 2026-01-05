/**
 * BASE TOOL INTERFACE
 *
 * Foundation for all tools the Code Agent can use.
 * Inspired by Claude Code's tool system.
 *
 * Tools allow the agent to:
 * - Read files from repositories
 * - Write/edit code
 * - Execute commands
 * - Search codebases
 * - Interact with Git
 */

export interface ToolInput {
  [key: string]: unknown;
}

export interface ToolOutput {
  success: boolean;
  result?: unknown;
  error?: string;
  metadata?: {
    executionTime: number;
    tokensUsed?: number;
    cached?: boolean;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      required?: boolean;
    }>;
    required: string[];
  };
}

/**
 * Base class for all tools
 */
export abstract class BaseTool {
  abstract name: string;
  abstract description: string;

  /**
   * Get the tool definition for LLM function calling
   */
  abstract getDefinition(): ToolDefinition;

  /**
   * Execute the tool with given input
   */
  abstract execute(input: ToolInput): Promise<ToolOutput>;

  /**
   * Validate input before execution
   */
  protected validateInput(input: ToolInput, required: string[]): string | null {
    for (const field of required) {
      if (input[field] === undefined || input[field] === null) {
        return `Missing required field: ${field}`;
      }
    }
    return null;
  }

  /**
   * Format output for streaming
   */
  protected formatForStream(action: string, detail: string): string {
    return `\`◈\` **\`TOOL:${this.name.toUpperCase()}\`** ${action}: ${detail}\n`;
  }
}

/**
 * Tool result that can be streamed
 */
export interface StreamableToolResult extends ToolOutput {
  streamOutput?: string;  // Formatted output for streaming to user
}

/**
 * Tool call request from the LLM
 */
export interface ToolCall {
  id: string;
  name: string;
  input: ToolInput;
}

/**
 * Tool call result to send back to LLM
 */
export interface ToolCallResult {
  id: string;
  output: ToolOutput;
}
