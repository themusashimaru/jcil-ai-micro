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
import {
  cloneRepo,
  getRepoInfo,
  createBranch,
  createPullRequest,
  compareBranches,
  pushFiles,
  getBranches,
  createRepository,
} from '@/lib/connectors';

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

export interface SelectedRepoContext {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
}

export interface ToolConfig {
  model: string;
  userId?: string;
  userTier?: string;
  maxTokens?: number;
  temperature?: number;
  githubToken?: string; // For code review tasks
  selectedRepo?: SelectedRepoContext; // User-selected repo from dropdown
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

    // Use selectedRepo if available, otherwise extract from query
    let owner: string;
    let repo: string;

    if (config.selectedRepo) {
      // User has selected a repo from the dropdown
      owner = config.selectedRepo.owner;
      repo = config.selectedRepo.repo;
      console.log(`[CodeReview] Using selected repo: ${config.selectedRepo.fullName}`);
    } else {
      // Try to extract GitHub URL from query
      const query = input.query;
      const urlMatch = query.match(/github\.com\/([^/\s]+)\/([^/\s]+)/i) ||
                       query.match(/\b([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\b/);

      if (!urlMatch) {
        return {
          success: false,
          content: '',
          error: 'No repository selected. Please select a repository from the dropdown or provide a GitHub URL like github.com/owner/repo.',
        };
      }

      owner = urlMatch[1];
      repo = urlMatch[2];
    }

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
      const userQuery = input.query;
      let reviewFocus = 'comprehensive';
      if (/bug|issue|problem|error|fix/i.test(userQuery)) reviewFocus = 'bugs';
      else if (/security|vulnerability|exploit/i.test(userQuery)) reviewFocus = 'security';
      else if (/improve|refactor|clean|better/i.test(userQuery)) reviewFocus = 'improvements';
      else if (/explain|understand|how.*work/i.test(userQuery)) reviewFocus = 'explain';
      else if (/architect|structure|design|pattern/i.test(userQuery)) reviewFocus = 'architecture';

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

/**
 * Git Workflow Tool - GitHub operations (branches, PRs, push, etc.)
 *
 * Handles git operations like creating branches, pull requests,
 * pushing code, and comparing branches.
 */
const gitWorkflowTool: Tool = {
  id: 'git-workflow',
  name: 'Git Workflow',
  description: 'Create branches, pull requests, push code, and manage git operations',
  capabilities: [
    'Create new branches',
    'Create pull requests',
    'Push code to repositories',
    'Compare branches (show diffs)',
    'List branches',
  ],
  taskTypes: ['git-workflow'],

  async execute(input: ToolInput, config: ToolConfig): Promise<ToolOutput> {
    const startTime = Date.now();

    // Check for GitHub token
    if (!config.githubToken) {
      return {
        success: false,
        content: '',
        error: 'GitHub not connected. Please connect your GitHub account in Settings > Connectors to perform git operations.',
      };
    }

    // Check for selected repo
    if (!config.selectedRepo) {
      return {
        success: false,
        content: '',
        error: 'No repository selected. Please select a repository from the dropdown to perform git operations.',
      };
    }

    const { owner, repo, defaultBranch } = config.selectedRepo;
    const query = input.query.toLowerCase();

    try {
      // Detect operation type from query
      if (/create\s+(a\s+)?pr|pull\s+request|open\s+(a\s+)?pr/i.test(query)) {
        return await handleCreatePR(input, config, owner, repo, defaultBranch, startTime);
      }

      if (/create\s+(a\s+)?branch|new\s+branch/i.test(query)) {
        return await handleCreateBranch(input, config, owner, repo, defaultBranch, startTime);
      }

      if (/compare|diff|difference|changes\s+between/i.test(query)) {
        return await handleCompareBranches(input, config, owner, repo, defaultBranch, startTime);
      }

      if (/list\s+branch|show\s+branch|branches/i.test(query)) {
        return await handleListBranches(config, owner, repo, startTime);
      }

      if (/push|commit|upload/i.test(query)) {
        return await handlePushCode(input, config, owner, repo, startTime);
      }

      // Default: show available operations
      return {
        success: true,
        content: `## Git Workflow for ${owner}/${repo}

I can help you with the following git operations:

1. **Create a Pull Request** - "Create a PR from feature-branch to main"
2. **Create a Branch** - "Create a new branch called feature-x"
3. **Compare Branches** - "Show the diff between main and develop"
4. **List Branches** - "Show me all branches"
5. **Push Code** - "Push these changes to my-branch"

What would you like to do?`,
        metadata: {
          repo: `${owner}/${repo}`,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error('[GitWorkflow] Error:', error);
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Git operation failed',
      };
    }
  },
};

// Git Workflow Helper Functions

async function handleCreatePR(
  input: ToolInput,
  config: ToolConfig,
  owner: string,
  repo: string,
  _defaultBranch: string,
  startTime: number
): Promise<ToolOutput> {
  // Extract branch names from query
  const query = input.query;

  // Try to extract "from X to Y" pattern
  const fromToMatch = query.match(/from\s+(\S+)\s+to\s+(\S+)/i);
  // Or "X into Y" pattern
  const intoMatch = query.match(/(\S+)\s+into\s+(\S+)/i);

  let head: string;
  let base: string;

  if (fromToMatch) {
    head = fromToMatch[1];
    base = fromToMatch[2];
  } else if (intoMatch) {
    head = intoMatch[1];
    base = intoMatch[2];
  } else {
    // Ask for clarification
    return {
      success: true,
      content: `To create a pull request, I need to know which branches to use.

Please specify like:
- "Create a PR from **feature-branch** to **main**"
- "Create a PR from **develop** into **main**"

**Available branches:**`,
      metadata: { needsBranches: true },
    };
  }

  // Extract title from query or generate one
  const titleMatch = query.match(/titled?\s*[:"']([^"']+)[:"']|title\s*:\s*(.+)/i);
  const title = titleMatch
    ? (titleMatch[1] || titleMatch[2]).trim()
    : `Merge ${head} into ${base}`;

  // Create the PR
  const result = await createPullRequest(config.githubToken!, {
    owner,
    repo,
    title,
    body: `## Summary\n\nPull request created via JCIL.ai assistant.\n\n**Source:** \`${head}\`\n**Target:** \`${base}\``,
    head,
    base,
  });

  if (!result.success) {
    return {
      success: false,
      content: '',
      error: result.error || 'Failed to create pull request',
    };
  }

  return {
    success: true,
    content: `## Pull Request Created! 🎉

**Title:** ${title}
**PR #${result.prNumber}**

🔗 [View Pull Request](${result.prUrl})

The PR merges \`${head}\` → \`${base}\`

**Next steps:**
- Review the changes in the PR
- Add reviewers if needed
- Merge when ready`,
    artifacts: [{
      type: 'url',
      name: 'Pull Request',
      content: result.prUrl!,
    }],
    metadata: {
      prNumber: result.prNumber,
      prUrl: result.prUrl,
      head,
      base,
      durationMs: Date.now() - startTime,
    },
  };
}

async function handleCreateBranch(
  input: ToolInput,
  config: ToolConfig,
  owner: string,
  repo: string,
  defaultBranch: string,
  startTime: number
): Promise<ToolOutput> {
  // Extract branch name from query
  const nameMatch = input.query.match(/(?:branch|called|named)\s+['""]?([a-zA-Z0-9_/-]+)['""]?/i);

  if (!nameMatch) {
    return {
      success: true,
      content: `To create a branch, please specify the name:

- "Create a branch called **feature-login**"
- "Create a new branch named **bugfix-123**"`,
      metadata: { needsBranchName: true },
    };
  }

  const branchName = nameMatch[1];

  // Check if "from X" is specified
  const fromMatch = input.query.match(/from\s+(\S+)/i);
  const fromBranch = fromMatch ? fromMatch[1] : defaultBranch;

  const result = await createBranch(config.githubToken!, owner, repo, branchName, fromBranch);

  if (!result.success) {
    return {
      success: false,
      content: '',
      error: result.error || 'Failed to create branch',
    };
  }

  return {
    success: true,
    content: `## Branch Created! 🌿

**New branch:** \`${branchName}\`
**Based on:** \`${fromBranch}\`

You can now:
- Push code to this branch
- Create a PR when ready`,
    metadata: {
      branchName,
      fromBranch,
      sha: result.sha,
      durationMs: Date.now() - startTime,
    },
  };
}

async function handleCompareBranches(
  input: ToolInput,
  config: ToolConfig,
  owner: string,
  repo: string,
  defaultBranch: string,
  startTime: number
): Promise<ToolOutput> {
  // Extract branch names
  const compareMatch = input.query.match(/(?:between|compare)\s+(\S+)\s+(?:and|to|with)\s+(\S+)/i);

  let base: string;
  let head: string;

  if (compareMatch) {
    base = compareMatch[1];
    head = compareMatch[2];
  } else {
    // Try single branch (compare to default)
    const singleMatch = input.query.match(/(?:diff|changes|compare)\s+(\S+)/i);
    if (singleMatch) {
      base = defaultBranch;
      head = singleMatch[1];
    } else {
      return {
        success: true,
        content: `To compare branches, please specify:

- "Compare **main** and **develop**"
- "Show diff between **main** and **feature-branch**"
- "What changed in **my-branch**" (compares to ${defaultBranch})`,
        metadata: { needsBranches: true },
      };
    }
  }

  const result = await compareBranches(config.githubToken!, owner, repo, base, head);

  if (!result) {
    return {
      success: false,
      content: '',
      error: 'Failed to compare branches. Make sure both branches exist.',
    };
  }

  // Format the comparison
  let content = `## Branch Comparison: \`${base}\` ↔ \`${head}\`

**Status:** ${result.status}
**Commits ahead:** ${result.ahead} | **Behind:** ${result.behind}
**Files changed:** ${result.files.length}

`;

  if (result.files.length > 0) {
    content += `### Changed Files\n\n`;
    for (const file of result.files.slice(0, 20)) {
      const icon = file.status === 'added' ? '➕' : file.status === 'removed' ? '➖' : '📝';
      content += `${icon} \`${file.filename}\` (+${file.additions}/-${file.deletions})\n`;
    }
    if (result.files.length > 20) {
      content += `\n*...and ${result.files.length - 20} more files*\n`;
    }
  }

  if (result.commits.length > 0) {
    content += `\n### Recent Commits\n\n`;
    for (const commit of result.commits.slice(0, 5)) {
      const shortSha = commit.sha.substring(0, 7);
      const shortMsg = commit.message.split('\n')[0].substring(0, 60);
      content += `- \`${shortSha}\` ${shortMsg}\n`;
    }
  }

  return {
    success: true,
    content,
    metadata: {
      base,
      head,
      status: result.status,
      ahead: result.ahead,
      behind: result.behind,
      filesChanged: result.files.length,
      commits: result.commits.length,
      durationMs: Date.now() - startTime,
    },
  };
}

async function handleListBranches(
  config: ToolConfig,
  owner: string,
  repo: string,
  startTime: number
): Promise<ToolOutput> {
  const branches = await getBranches(config.githubToken!, owner, repo);

  if (branches.length === 0) {
    return {
      success: true,
      content: `No branches found in ${owner}/${repo}.`,
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  let content = `## Branches in ${owner}/${repo}\n\n`;

  for (const branch of branches) {
    const protectedIcon = branch.protected ? '🔒' : '';
    content += `- \`${branch.name}\` ${protectedIcon}\n`;
  }

  content += `\n**Total:** ${branches.length} branches`;

  return {
    success: true,
    content,
    metadata: {
      branchCount: branches.length,
      durationMs: Date.now() - startTime,
    },
  };
}

async function handlePushCode(
  _input: ToolInput,
  _config: ToolConfig,
  _owner: string,
  _repo: string,
  startTime: number
): Promise<ToolOutput> {
  // This is more complex - would need code from context
  // For now, provide guidance (will be enhanced in Project Scaffolding phase)
  return {
    success: true,
    content: `## Push Code to GitHub

To push code, I need:
1. The **file content** you want to push
2. The **file path** (e.g., \`src/app.js\`)
3. The **branch** to push to
4. A **commit message**

You can:
- Share the code you want to push
- Or use the code execution results from a previous step

Example: "Push the code from above to \`feature-branch\` as \`src/utils.ts\`"`,
    metadata: {
      needsCode: true,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Project Scaffolding Tool - Generate multi-file projects
 *
 * Creates complete project structures with multiple files,
 * proper directory layout, and pushes to GitHub.
 */
const projectScaffoldTool: Tool = {
  id: 'project-scaffold',
  name: 'Project Scaffolding',
  description: 'Generate complete multi-file projects and push to GitHub',
  capabilities: [
    'Create full project structures',
    'Generate multiple files (HTML, CSS, JS, etc.)',
    'Set up proper directory layouts',
    'Push complete projects to GitHub',
    'Create landing pages, apps, and tools',
  ],
  taskTypes: ['project-scaffold'],

  async execute(input: ToolInput, config: ToolConfig): Promise<ToolOutput> {
    const startTime = Date.now();

    // Check for GitHub token
    if (!config.githubToken) {
      return {
        success: false,
        content: '',
        error: 'GitHub not connected. Please connect your GitHub account in Settings > Connectors to create projects.',
      };
    }

    try {
      // Step 1: Plan the project structure
      console.log('[ProjectScaffold] Planning project structure...');
      const projectPlan = await planProjectStructure(input.query, input.originalRequest, config);

      if (!projectPlan.success) {
        return {
          success: false,
          content: '',
          error: projectPlan.error || 'Failed to plan project structure',
        };
      }

      // Step 2: Generate file contents
      console.log(`[ProjectScaffold] Generating ${projectPlan.files.length} files...`);
      const generatedFiles = await generateProjectFiles(projectPlan, config);

      if (generatedFiles.length === 0) {
        return {
          success: false,
          content: '',
          error: 'Failed to generate project files',
        };
      }

      // Step 3: Create repo or use selected repo
      let repoInfo: { owner: string; repo: string; url: string };

      if (config.selectedRepo) {
        // Use existing repo
        repoInfo = {
          owner: config.selectedRepo.owner,
          repo: config.selectedRepo.repo,
          url: `https://github.com/${config.selectedRepo.fullName}`,
        };
        console.log(`[ProjectScaffold] Using existing repo: ${repoInfo.url}`);
      } else {
        // Create new repo
        const repoName = generateRepoName(projectPlan.name);
        console.log(`[ProjectScaffold] Creating new repo: ${repoName}`);

        const newRepo = await createRepository(config.githubToken, {
          name: repoName,
          description: projectPlan.description,
          private: false,
          autoInit: true,
        });

        if (!newRepo) {
          return {
            success: false,
            content: '',
            error: 'Failed to create GitHub repository',
          };
        }

        repoInfo = {
          owner: newRepo.owner,
          repo: newRepo.name,
          url: newRepo.htmlUrl,
        };

        // Wait a moment for repo to initialize
        await sleep(2000);
      }

      // Step 4: Push all files
      console.log(`[ProjectScaffold] Pushing ${generatedFiles.length} files to ${repoInfo.url}...`);

      const pushResult = await pushFiles(config.githubToken, {
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        branch: 'main',
        message: `🚀 Initial project scaffold: ${projectPlan.name}\n\nGenerated by JCIL.ai`,
        files: generatedFiles,
      });

      if (!pushResult.success) {
        return {
          success: false,
          content: '',
          error: pushResult.error || 'Failed to push files to GitHub',
        };
      }

      const durationMs = Date.now() - startTime;

      // Build success response
      const fileList = generatedFiles.map(f => `- \`${f.path}\``).join('\n');

      return {
        success: true,
        content: `## 🚀 Project Created Successfully!

**${projectPlan.name}**

${projectPlan.description}

### Repository
🔗 [${repoInfo.owner}/${repoInfo.repo}](${repoInfo.url})

### Files Created (${generatedFiles.length})
${fileList}

### Next Steps
- Clone the repo: \`git clone ${repoInfo.url}.git\`
- Install dependencies (if applicable)
- Start building!

*Generated in ${formatDuration(durationMs)}*`,
        artifacts: [
          {
            type: 'url',
            name: 'GitHub Repository',
            content: repoInfo.url,
          },
          ...generatedFiles.map(f => ({
            type: 'file' as const,
            name: f.path,
            content: f.content,
          })),
        ],
        metadata: {
          repoUrl: repoInfo.url,
          filesCreated: generatedFiles.length,
          projectName: projectPlan.name,
          durationMs,
        },
      };
    } catch (error) {
      console.error('[ProjectScaffold] Error:', error);
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Project scaffolding failed',
      };
    }
  },
};

// Project Scaffolding Helper Types and Functions

interface ProjectPlan {
  success: boolean;
  name: string;
  description: string;
  files: { path: string; description: string }[];
  error?: string;
}

interface GeneratedFile {
  path: string;
  content: string;
}

async function planProjectStructure(
  query: string,
  originalRequest: string,
  config: ToolConfig
): Promise<ProjectPlan> {
  const planPrompt = `You are a project architect. Plan the file structure for this project request.

**Request:** ${query}
**Full Context:** ${originalRequest}

Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "name": "project-name",
  "description": "Brief description of the project",
  "files": [
    { "path": "index.html", "description": "Main HTML page" },
    { "path": "styles.css", "description": "Stylesheet" },
    { "path": "script.js", "description": "JavaScript logic" }
  ]
}

RULES:
- Keep it simple and focused (3-10 files typically)
- Use appropriate file extensions
- Include a README.md
- For static sites: HTML, CSS, JS
- For React/Next.js: include package.json, component files
- Paths should be relative (no leading /)
- Focus on core functionality first`;

  try {
    const messages: CoreMessage[] = [{ role: 'user', content: planPrompt }];
    const result = await createGeminiCompletion({
      messages,
      model: config.model,
      userId: config.userId,
      maxTokens: 1024,
      temperature: 0.3,
    });

    // Parse the JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, name: '', description: '', files: [], error: 'Failed to parse project plan' };
    }

    const plan = JSON.parse(jsonMatch[0]);
    return {
      success: true,
      name: plan.name || 'my-project',
      description: plan.description || '',
      files: plan.files || [],
    };
  } catch (error) {
    console.error('[ProjectScaffold] Plan failed:', error);
    return { success: false, name: '', description: '', files: [], error: 'Failed to plan project' };
  }
}

async function generateProjectFiles(
  plan: ProjectPlan,
  config: ToolConfig
): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];

  // Generate files in parallel (batch of 3)
  const batchSize = 3;
  for (let i = 0; i < plan.files.length; i += batchSize) {
    const batch = plan.files.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(file => generateFileContent(file, plan, config))
    );
    files.push(...batchResults.filter((f): f is GeneratedFile => f !== null));
  }

  return files;
}

async function generateFileContent(
  file: { path: string; description: string },
  plan: ProjectPlan,
  config: ToolConfig
): Promise<GeneratedFile | null> {
  const ext = file.path.split('.').pop()?.toLowerCase() || '';

  const generatePrompt = `Generate the content for this file in a ${plan.name} project.

**File:** ${file.path}
**Purpose:** ${file.description}
**Project:** ${plan.name} - ${plan.description}

**Other files in project:**
${plan.files.map(f => `- ${f.path}: ${f.description}`).join('\n')}

RESPOND WITH ONLY THE FILE CONTENT. No markdown code blocks, no explanations.
Just the raw file content that should be saved.

${ext === 'json' ? 'Ensure valid JSON.' : ''}
${ext === 'html' ? 'Include proper DOCTYPE and structure.' : ''}
${ext === 'css' ? 'Use modern CSS with good defaults.' : ''}
${ext === 'js' || ext === 'ts' ? 'Use modern JavaScript/TypeScript.' : ''}
${file.path === 'README.md' ? 'Include project title, description, setup instructions, and usage.' : ''}`;

  try {
    const messages: CoreMessage[] = [{ role: 'user', content: generatePrompt }];
    const result = await createGeminiCompletion({
      messages,
      model: config.model,
      userId: config.userId,
      maxTokens: 4096,
      temperature: 0.5,
    });

    // Clean up the content (remove any markdown code blocks if present)
    let content = result.text;
    const codeBlockMatch = content.match(/```[\w]*\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      content = codeBlockMatch[1];
    }

    return {
      path: file.path,
      content: content.trim(),
    };
  } catch (error) {
    console.error(`[ProjectScaffold] Failed to generate ${file.path}:`, error);
    return null;
  }
}

function generateRepoName(projectName: string): string {
  // Convert to kebab-case and sanitize
  return projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) || 'new-project';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Small sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    this.register(gitWorkflowTool); // Git operations (branches, PRs, push)
    this.register(projectScaffoldTool); // Multi-file project generation
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
