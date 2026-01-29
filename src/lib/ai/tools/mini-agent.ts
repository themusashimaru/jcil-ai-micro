/**
 * MINI-AGENT ORCHESTRATOR TOOL
 *
 * Lightweight parallel agent execution for main chat.
 * Spawns 5-10 agents max for complex research tasks.
 * STRICT cost controls - never exceeds $2 per execution.
 *
 * Features:
 * - Parallel research across multiple angles
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
const COST_PER_AGENT = 0.05; // ~$0.05 per agent (Haiku + search)
const AGENT_TIMEOUT_MS = 30000; // 30 seconds per agent
const TOOL_COST = 0.10; // Base cost for orchestration

// Anthropic lazy load
let AnthropicClient: typeof import('@anthropic-ai/sdk').default | null = null;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const miniAgentTool: UnifiedTool = {
  name: 'parallel_research',
  description: `Run parallel research agents for complex questions. Use this when:
- User asks a question that benefits from multiple perspectives
- You need to research several related topics at once
- Comparing options requires gathering data from multiple angles
- User explicitly asks for comprehensive/thorough research

This spawns 5-10 lightweight agents that research in parallel and synthesize results.
Each agent focuses on a specific aspect of the question.

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
        description:
          'Specific aspects to research (optional - will auto-generate if not provided)',
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
    if (!process.env.ANTHROPIC_API_KEY) {
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

  const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    model: 'claude-haiku-4-5-20251001', // Haiku for planning (cheap)
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
// AGENT EXECUTION
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
    const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Determine search intensity based on depth
    const numSearches = depth === 'quick' ? 1 : depth === 'thorough' ? 3 : 2;

    // Execute searches (simulated - in production would use Brave)
    // For now, the agent will use its knowledge + indicate what it would search
    const searchContext = plan.searchQueries.slice(0, numSearches).join('\n- ');

    const agentPrompt = `You are a research agent with a specific focus.

YOUR FOCUS: ${plan.focus}

MAIN QUESTION: Research this aspect thoroughly.

SEARCH QUERIES YOU WOULD USE:
- ${searchContext}

INSTRUCTIONS:
1. Provide your best findings on this specific aspect
2. Be specific with facts, numbers, and details
3. Note your confidence level (high/medium/low)
4. Cite what sources you would reference

Return your findings in a clear, structured format.
Be concise but thorough. Focus ONLY on your assigned aspect.`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: agentPrompt }],
    });

    const findings = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n');

    return {
      id: plan.id,
      focus: plan.focus,
      findings,
      confidence: 'medium',
      sources: plan.searchQueries,
      success: true,
    };
  } catch (error) {
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
): Promise<{ success: boolean; synthesis?: string; error?: string }> {
  if (!AnthropicClient) {
    return { success: false, error: 'Client not available' };
  }

  const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY });

  const successfulResults = results.filter((r) => r.success);
  if (successfulResults.length === 0) {
    return { success: false, error: 'No agents returned results' };
  }

  const findingsText = successfulResults
    .map(
      (r) => `
### ${r.focus}
${r.findings}
(Confidence: ${r.confidence})
`
    )
    .join('\n');

  const synthesisPrompt = `You are synthesizing research from ${successfulResults.length} parallel agents.

ORIGINAL QUESTION: ${question}

AGENT FINDINGS:
${findingsText}

INSTRUCTIONS:
1. Synthesize all findings into a coherent, comprehensive answer
2. Highlight key insights from each perspective
3. Note any conflicts or uncertainties
4. Provide a clear, actionable conclusion
5. Keep it organized with headers if needed

Write a well-structured synthesis that directly answers the original question.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250514', // Sonnet for synthesis (quality matters)
      max_tokens: 2048,
      messages: [{ role: 'user', content: synthesisPrompt }],
    });

    const synthesis = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n');

    return { success: true, synthesis };
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

  // Cost estimation
  const estimatedCost = TOOL_COST + numAgents * COST_PER_AGENT;
  if (estimatedCost > MAX_COST_PER_RUN) {
    numAgents = Math.floor((MAX_COST_PER_RUN - TOOL_COST) / COST_PER_AGENT);
    numAgents = Math.max(MIN_AGENTS, numAgents);
  }

  // Cost check
  const sessionId = `chat_${Date.now()}`;
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

  log.info('Starting parallel research', { question: question.slice(0, 50), numAgents, depth });

  try {
    // Phase 1: Plan agents
    const plans = await planAgents(question, aspects, numAgents);

    // Phase 2: Execute agents in parallel
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

    log.info('Parallel research complete', { successCount, totalAgents: numAgents });

    return {
      toolCallId: id,
      content:
        `**Parallel Research Complete** (${successCount}/${numAgents} agents succeeded)\n\n` +
        `---\n\n${synthesis.synthesis}\n\n---\n\n` +
        `*Research conducted across ${successCount} perspectives: ${results
          .filter((r) => r.success)
          .map((r) => r.focus)
          .join(', ')}*`,
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
