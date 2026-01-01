/**
 * Tool Registry - Phase 3: Formalized Tool System
 *
 * Defines available tools and their capabilities for the task executor.
 * Each tool has:
 * - Clear input/output definitions
 * - Execution handler
 * - Capability description for the planner
 *
 * This enables:
 * - Proper tool selection for each step
 * - Consistent output handling
 * - Easy addition of new tools
 * - Foundation for complex workflows
 */

import { createGeminiCompletion } from '@/lib/gemini/client';
import type { CoreMessage } from 'ai';
import type { TaskType } from './index';

// ============================================================================
// Types
// ============================================================================

export interface ToolInput {
  query: string;           // The main request/query
  context?: string;        // Context from previous steps
  originalRequest: string; // User's original request
  parameters?: Record<string, unknown>; // Tool-specific parameters
}

export interface ToolOutput {
  success: boolean;
  content: string;         // Main output content
  artifacts?: Artifact[];  // Generated files, data, etc.
  metadata?: Record<string, unknown>; // Additional info
  error?: string;
}

export interface Artifact {
  type: 'file' | 'data' | 'code' | 'url';
  name: string;
  content: string;
  mimeType?: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  capabilities: string[];  // What this tool can do
  taskTypes: TaskType[];   // Which task types this tool handles
  execute: (input: ToolInput, config: ToolConfig) => Promise<ToolOutput>;
}

export interface ToolConfig {
  model: string;
  userId?: string;
  userTier?: string;
  maxTokens?: number;
  temperature?: number;
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Search Tool - Web research and fact-finding
 */
const searchTool: Tool = {
  id: 'search',
  name: 'Web Search',
  description: 'Search the web for current information, news, facts, and research',
  capabilities: [
    'Find current news and events',
    'Research topics and gather information',
    'Look up facts, statistics, and data',
    'Find product information and reviews',
    'Discover trends and market information',
  ],
  taskTypes: ['research'],

  async execute(input: ToolInput, config: ToolConfig): Promise<ToolOutput> {
    const prompt = `You are a research assistant. Search for information and provide comprehensive findings.

**Research Query:** ${input.query}

**Original User Request:** ${input.originalRequest}

${input.context ? `**Context from previous steps:**\n${input.context}\n` : ''}

**Instructions:**
1. Search for relevant, up-to-date information
2. Provide specific facts, data points, and sources
3. Be thorough but concise
4. Focus on what's most relevant to the user's request

**Provide your research findings:**`;

    try {
      const messages: CoreMessage[] = [{ role: 'user', content: prompt }];
      const result = await createGeminiCompletion({
        messages,
        model: config.model,
        maxTokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.5,
        enableSearch: true, // Enable Google Search
        userId: config.userId,
        planKey: config.userTier,
      });

      return {
        success: true,
        content: result.text,
        metadata: {
          tool: 'search',
          groundingUsed: !!result.groundingMetadata,
        },
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  },
};

/**
 * Analysis Tool - Data analysis and insights
 */
const analysisTool: Tool = {
  id: 'analyze',
  name: 'Data Analysis',
  description: 'Analyze information, identify patterns, and generate insights',
  capabilities: [
    'Analyze data and identify patterns',
    'Compare and contrast information',
    'Calculate statistics and metrics',
    'Generate insights and recommendations',
    'Evaluate options and trade-offs',
  ],
  taskTypes: ['analysis'],

  async execute(input: ToolInput, config: ToolConfig): Promise<ToolOutput> {
    const prompt = `You are a data analyst. Analyze the provided information and generate insights.

**Analysis Task:** ${input.query}

**Original User Request:** ${input.originalRequest}

${input.context ? `**Data/Information to Analyze:**\n${input.context}\n` : ''}

**Instructions:**
1. Carefully analyze all provided information
2. Identify key patterns, trends, or insights
3. Use calculations where appropriate
4. Draw specific, actionable conclusions
5. Support findings with evidence

**Provide your analysis:**`;

    try {
      const messages: CoreMessage[] = [{ role: 'user', content: prompt }];
      const result = await createGeminiCompletion({
        messages,
        model: config.model,
        maxTokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.4,
        enableSearch: true, // Enable code execution for calculations
        userId: config.userId,
        planKey: config.userTier,
      });

      return {
        success: true,
        content: result.text,
        metadata: { tool: 'analyze' },
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Analysis failed',
      };
    }
  },
};

/**
 * Code Tool - Code execution and calculations
 */
const codeTool: Tool = {
  id: 'code',
  name: 'Code Execution',
  description: 'Execute Python code for calculations, data processing, and automation',
  capabilities: [
    'Perform complex calculations',
    'Process and transform data',
    'Generate charts and visualizations',
    'Automate repetitive tasks',
    'Validate and verify results',
  ],
  taskTypes: ['calculation'],

  async execute(input: ToolInput, config: ToolConfig): Promise<ToolOutput> {
    const prompt = `You are a Python programmer. Write and execute code to complete the task.

**Task:** ${input.query}

**Original User Request:** ${input.originalRequest}

${input.context ? `**Available Data/Context:**\n${input.context}\n` : ''}

**Instructions:**
1. Write clear, efficient Python code
2. Execute the code to get results
3. Show your methodology
4. Verify the results are correct
5. Present findings clearly

**Write and execute your code:**`;

    try {
      const messages: CoreMessage[] = [{ role: 'user', content: prompt }];
      const result = await createGeminiCompletion({
        messages,
        model: config.model,
        maxTokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.3,
        enableSearch: true, // Enables code execution
        userId: config.userId,
        planKey: config.userTier,
      });

      return {
        success: true,
        content: result.text,
        metadata: { tool: 'code' },
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Code execution failed',
      };
    }
  },
};

/**
 * Generation Tool - Content and document creation
 */
const generationTool: Tool = {
  id: 'generate',
  name: 'Content Generation',
  description: 'Generate documents, reports, content, and creative writing',
  capabilities: [
    'Write reports and summaries',
    'Create professional documents',
    'Generate creative content',
    'Draft emails and communications',
    'Prepare presentations and briefs',
  ],
  taskTypes: ['generation', 'creative'],

  async execute(input: ToolInput, config: ToolConfig): Promise<ToolOutput> {
    const prompt = `You are a professional writer. Generate high-quality content based on the request.

**Content Request:** ${input.query}

**Original User Request:** ${input.originalRequest}

${input.context ? `**Information to Include:**\n${input.context}\n` : ''}

**Instructions:**
1. Create professional, well-structured content
2. Incorporate all relevant information from context
3. Use appropriate formatting (headers, bullets, etc.)
4. Ensure the content is complete and polished
5. Match the tone to the request type

**Generate the content:**`;

    try {
      const messages: CoreMessage[] = [{ role: 'user', content: prompt }];
      const result = await createGeminiCompletion({
        messages,
        model: config.model,
        maxTokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
        enableSearch: false,
        userId: config.userId,
        planKey: config.userTier,
      });

      return {
        success: true,
        content: result.text,
        metadata: { tool: 'generate' },
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Generation failed',
      };
    }
  },
};

/**
 * Conversation Tool - Simple Q&A and follow-ups
 */
const conversationTool: Tool = {
  id: 'chat',
  name: 'Conversation',
  description: 'Handle simple questions, clarifications, and follow-ups',
  capabilities: [
    'Answer questions',
    'Provide explanations',
    'Clarify information',
    'Have natural conversations',
  ],
  taskTypes: ['conversation'],

  async execute(input: ToolInput, config: ToolConfig): Promise<ToolOutput> {
    const prompt = `${input.query}

${input.context ? `Context: ${input.context}` : ''}`;

    try {
      const messages: CoreMessage[] = [{ role: 'user', content: prompt }];
      const result = await createGeminiCompletion({
        messages,
        model: config.model,
        maxTokens: config.maxTokens || 1024,
        temperature: config.temperature || 0.7,
        enableSearch: false,
        userId: config.userId,
        planKey: config.userTier,
      });

      return {
        success: true,
        content: result.text,
        metadata: { tool: 'chat' },
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Conversation failed',
      };
    }
  },
};

// ============================================================================
// Tool Registry
// ============================================================================

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    // Register default tools
    this.register(searchTool);
    this.register(analysisTool);
    this.register(codeTool);
    this.register(generationTool);
    this.register(conversationTool);
  }

  /**
   * Register a new tool
   */
  register(tool: Tool): void {
    this.tools.set(tool.id, tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.id}`);
  }

  /**
   * Get a tool by ID
   */
  get(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Find the best tool for a task type
   */
  getToolForTaskType(taskType: TaskType): Tool | undefined {
    for (const tool of this.tools.values()) {
      if (tool.taskTypes.includes(taskType)) {
        return tool;
      }
    }
    // Default to conversation tool
    return this.tools.get('chat');
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool descriptions for the planner
   * (So the planner knows what tools are available)
   */
  getToolDescriptions(): string {
    const descriptions = this.getAllTools().map(tool => {
      const capabilities = tool.capabilities.map(c => `  - ${c}`).join('\n');
      return `**${tool.name}** (${tool.id})\n${tool.description}\nCapabilities:\n${capabilities}`;
    });
    return descriptions.join('\n\n');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let registryInstance: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
  }
  return registryInstance;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute a tool by ID
 */
export async function executeTool(
  toolId: string,
  input: ToolInput,
  config: ToolConfig
): Promise<ToolOutput> {
  const registry = getToolRegistry();
  const tool = registry.get(toolId);

  if (!tool) {
    return {
      success: false,
      content: '',
      error: `Tool not found: ${toolId}`,
    };
  }

  console.log(`[ToolRegistry] Executing tool: ${tool.name}`);
  return tool.execute(input, config);
}

/**
 * Execute based on task type
 */
export async function executeForTaskType(
  taskType: TaskType,
  input: ToolInput,
  config: ToolConfig
): Promise<ToolOutput> {
  const registry = getToolRegistry();
  const tool = registry.getToolForTaskType(taskType);

  if (!tool) {
    return {
      success: false,
      content: '',
      error: `No tool found for task type: ${taskType}`,
    };
  }

  console.log(`[ToolRegistry] Using tool '${tool.name}' for task type '${taskType}'`);
  return tool.execute(input, config);
}

// Types are already exported at definition
