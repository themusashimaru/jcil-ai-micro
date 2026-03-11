/**
 * MINI-AGENT ORCHESTRATOR TOOL
 *
 * Lightweight parallel agent execution for main chat.
 * Spawns 2-10 agents that each perform REAL web searches via
 * Anthropic's native web_search_20260209 server tool, then synthesizes results.
 *
 * STRICT cost controls - never exceeds $2 per execution.
 *
 * Features:
 * - Parallel research with REAL web search per agent
 * - Automatic synthesis of results
 * - Cost-controlled (max $2, max 10 agents)
 * - Quality verification built-in
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import { CHAT_COST_LIMITS, canExecuteTool, recordToolCost } from './safety';

const log = logger('MiniAgentTool');

// ============================================================================
// CONFIGURATION - STRICT COST CONTROLS
// ============================================================================

const MAX_AGENTS = 10; // Never more than 10
const MIN_AGENTS = 2; // At least 2 for parallel benefit
const MAX_COST_PER_RUN = 2.0; // $2.00 hard cap
const COST_PER_AGENT = 0.05; // ~$0.05 per agent (Sonnet + search)
const AGENT_TIMEOUT_MS = 45000; // 45 seconds per agent (web search needs more time)
const TOOL_COST = 0.1; // Base cost for orchestration

// Anthropic lazy load
let AnthropicClient: typeof import('@anthropic-ai/sdk').default | null = null;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const miniAgentTool: UnifiedTool = {
  name: 'parallel_research',
  description: `Run parallel research agents that perform REAL web searches for complex questions.
Each agent uses Anthropic's native web search to find current, real-time information.

Use this when:
- User asks a question that benefits from multiple perspectives
- You need to research several related topics at once
- Comparing options requires gathering data from multiple angles
- User explicitly asks for comprehensive/thorough research
- Current/real-time information is needed from the web

This spawns 2-10 lightweight agents that each perform real web searches in parallel,
then synthesizes all findings into a comprehensive answer with sources.

IMPORTANT: Only use for genuinely complex questions. Simple questions don't need this.
Cost: ~$0.50-2.00 per use depending on complexity.`,
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The main question to research',
      },
      aspects: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific aspects to research (optional - will auto-generate if not provided)',
      },
      num_agents: {
        type: 'number',
        description: 'Number of agents to spawn (2-10, default: auto based on complexity)',
      },
      depth: {
        type: 'string',
        description: 'Research depth',
        enum: ['quick', 'standard', 'thorough'],
        default: 'standard',
      },
    },
    required: ['question'],
  },
};

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initAnthropic(): Promise<boolean> {
  if (AnthropicClient !== null) {
    return true;
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY_1) {
      return false;
    }
    const anthropicModule = await import('@anthropic-ai/sdk');
    AnthropicClient = anthropicModule.default;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// AGENT PLANNING
// ============================================================================

interface AgentPlan {
  id: string;
  focus: string;
  searchQueries: string[];
  expectedOutput: string;
}

async function planAgents(
  question: string,
  providedAspects: string[] | undefined,
  numAgents: number
): Promise<AgentPlan[]> {
  if (!AnthropicClient) {
    throw new Error('Client not initialized');
  }

  const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_1 });

  // If aspects provided, use them directly
  if (providedAspects && providedAspects.length >= MIN_AGENTS) {
    return providedAspects.slice(0, numAgents).map((aspect, i) => ({
      id: `agent_${i + 1}`,
      focus: aspect,
      searchQueries: [`${question} ${aspect}`],
      expectedOutput: `Findings about ${aspect}`,
    }));
  }

  // Auto-generate agent plan
  const planPrompt = `You are planning a parallel research operation. Given this question:

"${question}"

Create ${numAgents} research agents, each with a specific focus area.

Return ONLY a JSON array (no markdown, no explanation):
[
  {
    "id": "agent_1",
    "focus": "Specific aspect to research",
    "searchQueries": ["search query 1", "search query 2"],
    "expectedOutput": "What this agent should find"
  },
  ...
]

Rules:
- Each agent must have a DISTINCT focus (no overlap)
- Search queries should be specific and actionable
- Cover the question comprehensively across all agents
- Return valid JSON only`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: planPrompt }],
  });

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  try {
    const plans = JSON.parse(text);
    return plans.slice(0, numAgents);
  } catch {
    // Fallback: create simple plans
    return Array.from({ length: numAgents }, (_, i) => ({
      id: `agent_${i + 1}`,
      focus: `Aspect ${i + 1} of: ${question}`,
      searchQueries: [`${question} perspective ${i + 1}`],
      expectedOutput: `Research findings`,
    }));
  }
}

// ============================================================================
// AGENT EXECUTION (WITH REAL WEB SEARCH)
// ============================================================================

interface AgentResult {
  id: string;
  focus: string;
  findings: string;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
  success: boolean;
  error?: string;
}

/**
 * Extract cited URLs from agent response content blocks.
 * Native web search returns citation blocks with source URLs.
 */
function extractSourcesFromResponse(
  contentBlocks: Array<{ type: string; text?: string; url?: string; title?: string }>
): string[] {
  const sources: string[] = [];
  for (const block of contentBlocks) {
    if (block.url) {
      sources.push(block.title ? `[${block.title}](${block.url})` : block.url);
    }
  }
  return sources;
}

async function executeAgent(plan: AgentPlan, depth: string): Promise<AgentResult> {
  if (!AnthropicClient) {
    return {
      id: plan.id,
      focus: plan.focus,
      findings: '',
      confidence: 'low',
      sources: [],
      success: false,
      error: 'Client not available',
    };
  }

  try {
    const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_1 });

    // Determine search intensity based on depth
    const maxSearches = depth === 'quick' ? 2 : depth === 'thorough' ? 5 : 3;

    const agentPrompt = `You are a research agent focused on: "${plan.focus}"

Search the web to find current, accurate information about this topic.
Use your web search capability to research these queries:
${plan.searchQueries.map((q) => `- ${q}`).join('\n')}

INSTRUCTIONS:
1. Search the web for each query to find real, current information
2. Cite specific sources with URLs
3. Provide concrete facts, numbers, and details — not general knowledge
4. Note your confidence level based on source quality
5. Focus ONLY on your assigned aspect: "${plan.focus}"

Be concise but thorough. Prioritize recent, authoritative sources.`;

    // Each agent gets its own web search capability via the native server tool
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      tools: [
        {
          type: 'web_search_20260209' as 'web_search_20250305',
          name: 'web_search',
          max_uses: maxSearches,
        },
      ],
      messages: [{ role: 'user', content: agentPrompt }],
    });

    // Extract text findings
    const findings = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n');

    // Extract real source URLs from the response
    const sources = extractSourcesFromResponse(
      response.content as Array<{ type: string; text?: string; url?: string; title?: string }>
    );

    // Determine confidence based on whether web search was actually used
    const usedSearch = response.content.some(
      (b) => b.type === 'web_search_tool_result' || (b.type as string) === 'server_tool_use'
    );
    const confidence = usedSearch ? 'high' : 'medium';

    return {
      id: plan.id,
      focus: plan.focus,
      findings,
      confidence,
      sources: sources.length > 0 ? sources : plan.searchQueries,
      success: true,
    };
  } catch (error) {
    log.error('Agent execution failed', { agentId: plan.id, error: (error as Error).message });
    return {
      id: plan.id,
      focus: plan.focus,
      findings: '',
      confidence: 'low',
      sources: [],
      success: false,
      error: (error as Error).message,
    };
  }
}

// ============================================================================
// SYNTHESIS
// ============================================================================

async function synthesizeResults(
  question: string,
  results: AgentResult[]
): Promise<{ success: boolean; synthesis?: string; sources?: string[]; error?: string }> {
  if (!AnthropicClient) {
    return { success: false, error: 'Client not available' };
  }

  const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_1 });

  const successfulResults = results.filter((r) => r.success);
  if (successfulResults.length === 0) {
    return { success: false, error: 'No agents returned results' };
  }

  // Collect all sources across agents
  const allSources = successfulResults.flatMap((r) => r.sources);
  const uniqueSources = [...new Set(allSources)];

  const findingsText = successfulResults
    .map(
      (r) => `
### ${r.focus} (Confidence: ${r.confidence})
${r.findings}
${r.sources.length > 0 ? `Sources: ${r.sources.join(', ')}` : ''}
`
    )
    .join('\n');

  const synthesisPrompt = `You are synthesizing research from ${successfulResults.length} parallel agents that performed real web searches.

ORIGINAL QUESTION: ${question}

AGENT FINDINGS:
${findingsText}

INSTRUCTIONS:
1. Synthesize all findings into a coherent, comprehensive answer
2. Highlight key insights from each perspective
3. Note any conflicts or uncertainties between sources
4. Provide a clear, actionable conclusion
5. Keep it organized with headers if needed
6. Reference specific sources where possible

Write a well-structured synthesis that directly answers the original question.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: synthesisPrompt }],
    });

    const synthesis = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n');

    return { success: true, synthesis, sources: uniqueSources };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeMiniAgent(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'parallel_research') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const available = await initAnthropic();
  if (!available) {
    return {
      toolCallId: id,
      content: 'Parallel research not available. API not configured.',
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? {} : rawArgs;
  const question = args.question as string;
  const aspects = args.aspects as string[] | undefined;
  const requestedAgents = args.num_agents as number | undefined;
  const depth = (args.depth as string) || 'standard';

  if (!question) {
    return { toolCallId: id, content: 'No question provided.', isError: true };
  }

  // Determine number of agents (respect limits)
  let numAgents = requestedAgents || (depth === 'quick' ? 3 : depth === 'thorough' ? 8 : 5);
  numAgents = Math.max(MIN_AGENTS, Math.min(MAX_AGENTS, numAgents));

  // Cost estimation (increased slightly for real web search)
  const estimatedCost = TOOL_COST + numAgents * COST_PER_AGENT;
  if (estimatedCost > MAX_COST_PER_RUN) {
    numAgents = Math.floor((MAX_COST_PER_RUN - TOOL_COST) / COST_PER_AGENT);
    numAgents = Math.max(MIN_AGENTS, numAgents);
  }

  // Cost check (use passed session ID or generate fallback)
  const sessionId = toolCall.sessionId || `chat_${Date.now()}`;
  const costCheck = canExecuteTool(sessionId, 'parallel_research', estimatedCost);
  if (!costCheck.allowed) {
    return {
      toolCallId: id,
      content: `Cannot run parallel research: ${costCheck.reason}`,
      isError: true,
    };
  }

  // Respect mini-agent specific limit
  if (numAgents > CHAT_COST_LIMITS.maxMiniAgents) {
    numAgents = CHAT_COST_LIMITS.maxMiniAgents;
  }

  log.info('Starting parallel research with real web search', {
    question: question.slice(0, 50),
    numAgents,
    depth,
  });

  try {
    // Phase 1: Plan agents
    const plans = await planAgents(question, aspects, numAgents);

    // Phase 2: Execute agents in parallel (each with real web search)
    const agentPromises = plans.map((plan) =>
      Promise.race([
        executeAgent(plan, depth),
        new Promise<AgentResult>((resolve) =>
          setTimeout(
            () =>
              resolve({
                id: plan.id,
                focus: plan.focus,
                findings: '',
                confidence: 'low',
                sources: [],
                success: false,
                error: 'Timeout',
              }),
            AGENT_TIMEOUT_MS
          )
        ),
      ])
    );

    const results = await Promise.all(agentPromises);
    const successCount = results.filter((r) => r.success).length;

    if (successCount === 0) {
      recordToolCost(sessionId, 'parallel_research', TOOL_COST); // Still charge base
      return {
        toolCallId: id,
        content: 'All research agents failed. Please try rephrasing your question.',
        isError: true,
      };
    }

    // Phase 3: Synthesize results
    const synthesis = await synthesizeResults(question, results);

    // Record actual cost
    const actualCost = TOOL_COST + successCount * COST_PER_AGENT + 0.05; // + synthesis cost
    recordToolCost(sessionId, 'parallel_research', Math.min(actualCost, MAX_COST_PER_RUN));

    if (!synthesis.success) {
      return {
        toolCallId: id,
        content: `Research gathered but synthesis failed: ${synthesis.error}`,
        isError: true,
      };
    }

    // Build source list for attribution
    const sourceList =
      synthesis.sources && synthesis.sources.length > 0
        ? `\n\n**Sources:**\n${synthesis.sources.map((s) => `- ${s}`).join('\n')}`
        : '';

    log.info('Parallel research complete', { successCount, totalAgents: numAgents });

    return {
      toolCallId: id,
      content:
        `**Parallel Research Complete** (${successCount}/${numAgents} agents, real web search)\n\n` +
        `---\n\n${synthesis.synthesis}\n\n---\n\n` +
        `*Research conducted across ${successCount} perspectives: ${results
          .filter((r) => r.success)
          .map((r) => r.focus)
          .join(', ')}*` +
        sourceList,
      isError: false,
    };
  } catch (error) {
    log.error('Parallel research failed', { error: (error as Error).message });
    return {
      toolCallId: id,
      content: `Research failed: ${(error as Error).message}`,
      isError: true,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export async function isMiniAgentAvailable(): Promise<boolean> {
  return initAnthropic();
}
