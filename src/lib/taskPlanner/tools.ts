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
import { cloneRepo, getRepoInfo } from '@/lib/connectors';

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
  githubToken?: string; // For code review tasks
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
    const prompt = `You are a research assistant conducting thorough research for a report.

**Research Query:** ${input.query}

**Original User Request:** ${input.originalRequest}

${input.context ? `**Context from previous steps:**\n${input.context}\n` : ''}

**IMPORTANT - Your research will be used to generate a document. Provide:**
1. SPECIFIC facts, statistics, and data points (not generalizations)
2. Names of companies, people, products, or organizations
3. Dates, timelines, and milestones
4. Numerical data (market size, growth rates, prices, etc.)
5. Key trends and developments with examples
6. Comparisons and rankings where applicable

**Format your findings clearly with headers and bullet points.**
**Do NOT summarize or give brief overviews - provide DETAILED information.**

**Research findings:**`;

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
    // Build a context-aware prompt that EMPHASIZES using the provided research
    const hasContext = input.context && input.context.trim().length > 100;

    const prompt = hasContext
      ? `You are a professional writer creating a document based on RESEARCH THAT HAS ALREADY BEEN COMPLETED.

**Your Task:** ${input.query}

**Original User Request:** ${input.originalRequest}

---
**RESEARCH FINDINGS (USE THIS CONTENT):**
${input.context}
---

**CRITICAL INSTRUCTIONS:**
1. Your document MUST be based on the research findings above
2. DO NOT generate generic placeholder content or templates
3. Include SPECIFIC facts, names, numbers, and details from the research
4. If the research mentions specific companies, people, or data - include them
5. Structure the content professionally with clear sections
6. The final document should feel like a well-researched report, not a template

**Generate the document using the research above:**`
      : `You are a professional writer. Generate high-quality content based on the request.

**Content Request:** ${input.query}

**Original User Request:** ${input.originalRequest}

**Instructions:**
1. Create professional, well-structured content
2. Use appropriate formatting (headers, bullets, etc.)
3. Ensure the content is complete and polished
4. Match the tone to the request type

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
        metadata: { tool: 'generate', hadResearchContext: hasContext },
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

/**
 * Deep Research Tool - Parallel sub-agent research
 *
 * This is the "force multiplier" - breaks a research query into
 * multiple parallel searches, runs them concurrently, then synthesizes.
 */
const deepResearchTool: Tool = {
  id: 'deep-research',
  name: 'Deep Research',
  description: 'Comprehensive parallel research that breaks queries into sub-topics',
  capabilities: [
    'Deep dive research on complex topics',
    'Parallel multi-angle investigation',
    'Comprehensive market/competitor analysis',
    'Thorough trend and industry research',
  ],
  taskTypes: ['deep-research'], // Selected for comprehensive research tasks

  async execute(input: ToolInput, config: ToolConfig): Promise<ToolOutput> {
    const startTime = Date.now();

    // Step 1: Decompose the research query into 3-5 parallel sub-queries
    const decompositionPrompt = `You are a research strategist. Break down this research request into 3-5 focused sub-queries that can be researched in parallel.

**Main Research Request:** ${input.query}
**User's Original Goal:** ${input.originalRequest}

**Output Format (JSON array of strings):**
Return ONLY a JSON array of 3-5 specific research questions, like:
["What are the current market leaders in X?", "What are the latest technological developments in X?", "What are the growth projections for X?"]

**Important:**
- Each sub-query should cover a DIFFERENT aspect
- Be specific - include the actual topic name
- Focus on what would be needed for a comprehensive report

**Return JSON array only:**`;

    let subQueries: string[] = [];
    try {
      const messages: CoreMessage[] = [{ role: 'user', content: decompositionPrompt }];
      const decompResult = await createGeminiCompletion({
        messages,
        model: config.model,
        maxTokens: 500,
        temperature: 0.3,
        enableSearch: false,
        userId: config.userId,
        planKey: config.userTier,
      });

      // Parse the JSON array from response
      const jsonMatch = decompResult.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        subQueries = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[DeepResearch] Decomposition failed:', error);
      // Fallback to single query
      subQueries = [input.query];
    }

    // Ensure we have at least 1 query, max 5
    if (subQueries.length === 0) subQueries = [input.query];
    if (subQueries.length > 5) subQueries = subQueries.slice(0, 5);

    console.log(`[DeepResearch] Running ${subQueries.length} parallel searches:`, subQueries);

    // Step 2: Run all sub-queries in PARALLEL
    const researchPromises = subQueries.map(async (subQuery, index) => {
      const searchPrompt = `You are a research assistant conducting focused research.

**Research Question:** ${subQuery}

**Context:** This is part of a larger research project: "${input.originalRequest}"

**Provide detailed findings including:**
- Specific facts, data, and statistics
- Names of key players, companies, or people
- Recent developments and dates
- Numerical data where available

**Be thorough and specific. Your findings will be combined with other research:**`;

      try {
        const messages: CoreMessage[] = [{ role: 'user', content: searchPrompt }];
        const result = await createGeminiCompletion({
          messages,
          model: config.model,
          maxTokens: 1500,
          temperature: 0.5,
          enableSearch: true, // Use Google Search
          userId: config.userId,
          planKey: config.userTier,
        });

        return {
          query: subQuery,
          index,
          success: true,
          content: result.text,
        };
      } catch (error) {
        return {
          query: subQuery,
          index,
          success: false,
          content: '',
          error: error instanceof Error ? error.message : 'Search failed',
        };
      }
    });

    // Wait for ALL parallel searches to complete
    const results = await Promise.all(researchPromises);
    const successfulResults = results.filter(r => r.success);

    console.log(`[DeepResearch] ${successfulResults.length}/${results.length} searches succeeded in ${Date.now() - startTime}ms`);

    if (successfulResults.length === 0) {
      return {
        success: false,
        content: '',
        error: 'All parallel searches failed',
      };
    }

    // Step 3: Synthesize all results into comprehensive findings
    const combinedFindings = successfulResults
      .map(r => `## Research: ${r.query}\n\n${r.content}`)
      .join('\n\n---\n\n');

    const synthesisPrompt = `You are a research analyst. Synthesize these research findings into a comprehensive, well-organized summary.

**Original Research Request:** ${input.originalRequest}

**Research Findings from ${successfulResults.length} Parallel Searches:**

${combinedFindings}

**Your Task:**
1. Combine and organize all findings into a coherent structure
2. Remove redundant information
3. Highlight the most important insights
4. Keep ALL specific facts, numbers, names, and dates
5. Format with clear headers and bullet points

**Synthesized Research Report:**`;

    try {
      const messages: CoreMessage[] = [{ role: 'user', content: synthesisPrompt }];
      const synthesisResult = await createGeminiCompletion({
        messages,
        model: config.model,
        maxTokens: 3000,
        temperature: 0.4,
        enableSearch: false,
        userId: config.userId,
        planKey: config.userTier,
      });

      const totalTime = Date.now() - startTime;
      console.log(`[DeepResearch] Completed in ${totalTime}ms with ${successfulResults.length} sources`);

      return {
        success: true,
        content: synthesisResult.text,
        metadata: {
          tool: 'deep-research',
          parallelSearches: subQueries.length,
          successfulSearches: successfulResults.length,
          totalTimeMs: totalTime,
          subQueries,
        },
      };
    } catch (synthesisError) {
      // If synthesis fails, return combined raw results
      console.error('[DeepResearch] Synthesis failed, returning raw results:', synthesisError);
      return {
        success: true,
        content: combinedFindings,
        metadata: {
          tool: 'deep-research',
          synthesized: false,
          parallelSearches: subQueries.length,
        },
      };
    }
  },
};

/**
 * Code Review Tool - GitHub repository analysis
 *
 * Fetches repository contents and provides code review,
 * bug detection, improvement suggestions, and architectural analysis.
 */
const codeReviewTool: Tool = {
  id: 'code-review',
  name: 'GitHub Code Review',
  description: 'Analyze GitHub repositories, review code, find bugs, and suggest improvements',
  capabilities: [
    'Review code for bugs and issues',
    'Analyze code architecture and patterns',
    'Suggest improvements and refactoring',
    'Identify security vulnerabilities',
    'Explain how code works',
    'Review pull request changes',
  ],
  taskTypes: ['code-review'],

  async execute(input: ToolInput, config: ToolConfig): Promise<ToolOutput> {
    const startTime = Date.now();

    // Check for GitHub token
    if (!config.githubToken) {
      return {
        success: false,
        content: '',
        error: 'GitHub not connected. Please connect your GitHub account in Settings > Connectors to review repositories.',
      };
    }

    // Extract GitHub URL from query or parameters
    const query = input.query;
    const urlMatch = query.match(/github\.com\/([^/\s]+)\/([^/\s]+)/i) ||
                     query.match(/\b([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\b/);

    if (!urlMatch) {
      return {
        success: false,
        content: '',
        error: 'Could not find a GitHub repository URL or owner/repo in the request. Please provide a GitHub URL like github.com/owner/repo.',
      };
    }

    const owner = urlMatch[1];
    const repo = urlMatch[2];

    console.log(`[CodeReview] Fetching repository: ${owner}/${repo}`);

    try {
      // Step 1: Get repo info
      const repoInfo = await getRepoInfo(config.githubToken, owner, repo);
      if (!repoInfo) {
        return {
          success: false,
          content: '',
          error: `Repository not found: ${owner}/${repo}. Make sure the repository exists and you have access to it.`,
        };
      }

      // Step 2: Clone/fetch repository contents
      const cloneResult = await cloneRepo(config.githubToken, {
        owner,
        repo,
        maxFiles: 50,
        maxFileSize: 50 * 1024, // 50KB per file
      });

      if (!cloneResult.success) {
        return {
          success: false,
          content: '',
          error: cloneResult.error || 'Failed to fetch repository contents',
        };
      }

      console.log(`[CodeReview] Fetched ${cloneResult.fetchedFiles}/${cloneResult.totalFiles} files`);

      // Step 3: Format files for context
      const fileContext = cloneResult.files
        .map(f => {
          const lang = f.language || '';
          return `### ${f.path}\n\`\`\`${lang}\n${f.content}\n\`\`\``;
        })
        .join('\n\n');

      // Determine review type from query
      let reviewFocus = 'comprehensive';
      if (/bug|issue|problem|error|fix/i.test(query)) reviewFocus = 'bugs';
      else if (/security|vulnerability|exploit/i.test(query)) reviewFocus = 'security';
      else if (/improve|refactor|clean|better/i.test(query)) reviewFocus = 'improvements';
      else if (/explain|understand|how.*work/i.test(query)) reviewFocus = 'explain';
      else if (/architect|structure|design|pattern/i.test(query)) reviewFocus = 'architecture';

      const reviewPrompts: Record<string, string> = {
        comprehensive: `Provide a comprehensive code review including:
1. **Overview** - What does this project do?
2. **Code Quality** - Is the code clean, readable, and well-organized?
3. **Potential Issues** - Any bugs, edge cases, or problems?
4. **Security** - Any security concerns?
5. **Suggestions** - How could this code be improved?`,

        bugs: `Focus on finding bugs and issues:
1. **Logic Errors** - Any incorrect logic or edge cases not handled?
2. **Runtime Errors** - Potential crashes, null references, type errors?
3. **Data Issues** - Race conditions, memory leaks, data corruption?
4. **Error Handling** - Missing try/catch, unhandled promises?
5. Provide specific line numbers and fixes for each issue.`,

        security: `Focus on security vulnerabilities:
1. **Injection Risks** - SQL, command, XSS injection vulnerabilities?
2. **Authentication** - Auth bypass, weak auth, exposed secrets?
3. **Data Exposure** - Sensitive data leaks, insecure storage?
4. **Dependencies** - Known vulnerable packages?
5. Provide OWASP classification and remediation steps.`,

        improvements: `Focus on improvements and refactoring:
1. **Code Smells** - Duplicated code, long functions, god classes?
2. **Performance** - Any inefficient algorithms or patterns?
3. **Maintainability** - How could this be easier to maintain?
4. **Best Practices** - What modern patterns could be applied?
5. Provide specific refactoring suggestions with examples.`,

        explain: `Explain how this codebase works:
1. **Project Structure** - How are files and folders organized?
2. **Architecture** - What patterns/frameworks are used?
3. **Key Components** - What are the main modules and their purposes?
4. **Data Flow** - How does data move through the system?
5. **Entry Points** - Where does execution start?`,

        architecture: `Analyze the architecture:
1. **Design Patterns** - What patterns are used (MVC, microservices, etc.)?
2. **Separation of Concerns** - Is logic properly separated?
3. **Dependencies** - How are components coupled?
4. **Scalability** - Will this architecture scale?
5. **Recommendations** - Architectural improvements to consider.`,
      };

      const reviewPrompt = `You are an expert code reviewer analyzing a GitHub repository.

**Repository:** ${owner}/${repo}
${repoInfo.description ? `**Description:** ${repoInfo.description}` : ''}
**Files Analyzed:** ${cloneResult.fetchedFiles} of ${cloneResult.totalFiles}
${cloneResult.truncated ? '*Note: Repository has more files than shown*' : ''}

**User's Request:** ${input.originalRequest}

---
**CODE FILES:**

${fileContext}

---
**REVIEW INSTRUCTIONS:**

${reviewPrompts[reviewFocus]}

**Important:**
- Be specific - reference file names and line numbers
- Provide actionable feedback with code examples where helpful
- Focus on the most important issues first
- Keep the review constructive and professional

**Your Code Review:**`;

      // Step 4: Run the review with Gemini
      const messages: CoreMessage[] = [{ role: 'user', content: reviewPrompt }];
      const result = await createGeminiCompletion({
        messages,
        model: config.model,
        maxTokens: 4096,
        temperature: 0.4,
        enableSearch: false,
        userId: config.userId,
        planKey: config.userTier,
      });

      const totalTime = Date.now() - startTime;
      console.log(`[CodeReview] Review completed in ${totalTime}ms`);

      return {
        success: true,
        content: result.text,
        metadata: {
          tool: 'code-review',
          repository: `${owner}/${repo}`,
          filesAnalyzed: cloneResult.fetchedFiles,
          totalFiles: cloneResult.totalFiles,
          reviewFocus,
          durationMs: totalTime,
        },
      };
    } catch (error) {
      console.error('[CodeReview] Error:', error);
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Code review failed',
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
    this.register(deepResearchTool); // Register BEFORE regular search so complex research uses this
    this.register(analysisTool);
    this.register(codeTool);
    this.register(generationTool);
    this.register(conversationTool);
    this.register(codeReviewTool); // GitHub code review
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
