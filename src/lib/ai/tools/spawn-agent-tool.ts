/**
 * SPAWN AGENT TOOL
 *
 * Allows Opus to spawn independent sub-agent Opus calls for parallel task delegation.
 * Each sub-agent gets its own system prompt, conversation context, and tool access.
 * Token usage from sub-agents is tracked to the same user for billing.
 *
 * Use cases:
 * - "Research competitors X, Y, and Z" → spawn 3 parallel research agents
 * - "Create a report with charts" → one agent researches while another builds visuals
 * - Complex multi-part tasks that benefit from parallel execution
 *
 * Created: 2026-03-19
 */

import Anthropic from '@anthropic-ai/sdk';
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { executeChatTool } from './index';
import { executeComposioTool, isComposioTool } from '@/lib/composio';
import { trackTokenUsage } from '@/lib/usage/track';
import { logger } from '@/lib/logger';

const log = logger('SpawnAgent');

// Safety limits
const MAX_CONCURRENT_AGENTS = 5;
const MAX_AGENT_TOOL_LOOPS = 5;
const AGENT_TIMEOUT_MS = 120_000; // 2 minutes per agent
const MAX_AGENT_OUTPUT_LENGTH = 50_000; // 50K chars max output

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const spawnAgentTool: UnifiedTool = {
  name: 'spawn_agents',
  description: `Spawn one or more independent AI sub-agents to handle tasks in parallel. Each agent runs as a separate Opus call with its own context and tool access, then returns its results.

Use this when:
- Multiple independent research tasks can run simultaneously
- A complex request has separable sub-tasks (e.g., research + document creation)
- You need to gather information from multiple sources in parallel
- The user's request would benefit from divide-and-conquer

Each agent has access to ALL tools (web_search, run_code, create_chart, create_document, etc.) and can chain tools within its own execution.

Cost note: Each agent is a full Opus API call. Use judiciously — only spawn agents when parallelism provides clear value over sequential execution. For simple sequential chains, use tools directly instead.

Returns: An array of agent results, one per agent, with the agent's output text.`,
  parameters: {
    type: 'object',
    properties: {
      agents: {
        type: 'array',
        description: `Array of agent tasks to run in parallel (max ${MAX_CONCURRENT_AGENTS})`,
        items: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description:
                'Clear, specific task description for this agent. Be detailed — the agent has no prior conversation context.',
            },
            context: {
              type: 'string',
              description:
                'Optional context from the conversation to pass to the agent (relevant facts, user preferences, prior results).',
            },
            tools_hint: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Optional hint of which tools this agent should use (e.g., ["web_search", "create_chart"]). Agent can still use any tool.',
            },
          },
          required: ['task'],
        },
      },
    },
    required: ['agents'],
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface AgentTask {
  task: string;
  context?: string;
  tools_hint?: string[];
}

interface AgentResult {
  task: string;
  status: 'success' | 'error' | 'timeout';
  output: string;
  toolsUsed: string[];
  tokenUsage: {
    input: number;
    output: number;
  };
  durationMs: number;
}

// Runtime context passed from the chat route
interface SpawnContext {
  userId: string;
  conversationId?: string;
  apiKey?: string; // BYOK key if user has one
  model?: string;
}

// Module-level context set by the chat route before tool execution
let _spawnContext: SpawnContext | null = null;

/**
 * Set the runtime context for spawn_agents.
 * Must be called by the chat route before executing tools each request.
 */
export function setSpawnContext(ctx: SpawnContext): void {
  _spawnContext = ctx;
}

/**
 * Clear spawn context after request completes.
 */
export function clearSpawnContext(): void {
  _spawnContext = null;
}

// ============================================================================
// AGENT EXECUTION
// ============================================================================

/**
 * Run a single sub-agent: make an Opus call with tool loop.
 */
async function runSubAgent(
  client: Anthropic,
  agentTask: AgentTask,
  model: string,
  chatTools: Anthropic.Tool[],
  context: SpawnContext
): Promise<AgentResult> {
  const startTime = Date.now();
  const toolsUsed: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  const systemPrompt = `You are a focused sub-agent working on a specific task. Complete the task thoroughly and return your findings.

${agentTask.context ? `Context from the conversation:\n${agentTask.context}\n` : ''}
${agentTask.tools_hint?.length ? `Suggested tools: ${agentTask.tools_hint.join(', ')} (you may use others as needed)\n` : ''}
Your task: ${agentTask.task}

Instructions:
- Be thorough but concise in your output
- Use tools as needed to complete the task
- Return structured, actionable results
- Do not ask questions — make reasonable assumptions and proceed`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: agentTask.task },
  ];

  try {
    const currentMessages = [...messages];
    let toolLoopCount = 0;
    let fullOutput = '';

    // Initial call
    let response = await client.messages.create({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: currentMessages,
      tools: chatTools.length > 0 ? chatTools : undefined,
    });

    // Track tokens
    if (response.usage) {
      inputTokens += response.usage.input_tokens || 0;
      outputTokens += response.usage.output_tokens || 0;
    }

    // Tool loop
    while (response.stop_reason === 'tool_use' && toolLoopCount < MAX_AGENT_TOOL_LOOPS) {
      toolLoopCount++;

      // Extract text and tool calls
      const textBlocks = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text);
      fullOutput += textBlocks.join('');

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      // Add assistant message
      currentMessages.push({ role: 'assistant', content: response.content });

      // Execute tools in parallel
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          toolsUsed.push(toolUse.name);
          try {
            let resultContent: string;

            if (isComposioTool(toolUse.name)) {
              const composioResult = await executeComposioTool(
                context.userId,
                toolUse.name,
                toolUse.input as Record<string, unknown>
              );
              resultContent =
                typeof composioResult === 'string'
                  ? composioResult
                  : JSON.stringify(composioResult);
            } else {
              const result = await executeChatTool({
                id: toolUse.id,
                name: toolUse.name,
                arguments: toolUse.input as Record<string, unknown>,
              });
              resultContent =
                typeof result.content === 'string'
                  ? result.content
                  : JSON.stringify(result.content);
            }

            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: resultContent.slice(0, MAX_AGENT_OUTPUT_LENGTH),
            };
          } catch (err) {
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
              is_error: true as const,
            };
          }
        })
      );

      // Feed results back
      currentMessages.push({ role: 'user', content: toolResults });

      // Next Opus call
      response = await client.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: currentMessages,
        tools: chatTools.length > 0 ? chatTools : undefined,
      });

      if (response.usage) {
        inputTokens += response.usage.input_tokens || 0;
        outputTokens += response.usage.output_tokens || 0;
      }
    }

    // Extract final text
    const finalText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    fullOutput += finalText;

    // Track usage
    trackTokenUsage({
      userId: context.userId,
      modelName: model,
      inputTokens,
      outputTokens,
      source: 'sub-agent',
      conversationId: context.conversationId,
    }).catch((err) => log.warn('Sub-agent usage tracking failed', { error: (err as Error).message }));

    return {
      task: agentTask.task,
      status: 'success',
      output: fullOutput.slice(0, MAX_AGENT_OUTPUT_LENGTH),
      toolsUsed: [...new Set(toolsUsed)],
      tokenUsage: { input: inputTokens, output: outputTokens },
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    log.error('Sub-agent execution error', err instanceof Error ? err : undefined);
    return {
      task: agentTask.task,
      status: 'error',
      output: `Agent failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      toolsUsed: [...new Set(toolsUsed)],
      tokenUsage: { input: inputTokens, output: outputTokens },
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeSpawnAgent(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = typeof toolCall.arguments === 'string'
    ? JSON.parse(toolCall.arguments)
    : toolCall.arguments;

  const agents: AgentTask[] = args.agents;

  if (!agents || agents.length === 0) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: No agents specified.',
      isError: true,
    };
  }

  if (agents.length > MAX_CONCURRENT_AGENTS) {
    return {
      toolCallId: toolCall.id,
      content: `Error: Maximum ${MAX_CONCURRENT_AGENTS} concurrent agents allowed.`,
      isError: true,
    };
  }

  if (!_spawnContext) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: Spawn context not initialized. This tool must be called from a chat session.',
      isError: true,
    };
  }

  const context = _spawnContext;
  const model = context.model || 'claude-opus-4-6';

  // Get Anthropic client — use BYOK key if available, otherwise default env key
  const client = new Anthropic(
    context.apiKey ? { apiKey: context.apiKey } : undefined
  );

  // Load available tools for sub-agents
  const { getAvailableChatTools } = await import('./index');
  const availableTools = await getAvailableChatTools();
  const chatTools: Anthropic.Tool[] = availableTools
    .filter((t) => t.name !== 'spawn_agents') // Prevent recursive spawning
    .map((t) => ({
      name: t.name,
      description: t.description || '',
      input_schema: (t.parameters || { type: 'object', properties: {} }) as Anthropic.Tool.InputSchema,
    }));

  log.info('Spawning sub-agents', {
    count: agents.length,
    userId: context.userId.substring(0, 8),
    tasks: agents.map((a) => a.task.substring(0, 60)),
  });

  // Run all agents in parallel with timeout
  const results = await Promise.all(
    agents.map((agent) =>
      Promise.race([
        runSubAgent(client, agent, model, chatTools, context),
        new Promise<AgentResult>((resolve) =>
          setTimeout(
            () =>
              resolve({
                task: agent.task,
                status: 'timeout',
                output: 'Agent timed out after 2 minutes.',
                toolsUsed: [],
                tokenUsage: { input: 0, output: 0 },
                durationMs: AGENT_TIMEOUT_MS,
              }),
            AGENT_TIMEOUT_MS
          )
        ),
      ])
    )
  );

  // Format results
  const totalTokens = results.reduce(
    (acc, r) => ({
      input: acc.input + r.tokenUsage.input,
      output: acc.output + r.tokenUsage.output,
    }),
    { input: 0, output: 0 }
  );

  const formattedResults = results
    .map((r, i) => {
      const statusLabel =
        r.status === 'success' ? 'COMPLETED' : r.status === 'timeout' ? 'TIMED OUT' : 'FAILED';
      const toolList = r.toolsUsed.length > 0 ? `\nTools used: ${r.toolsUsed.join(', ')}` : '';
      return `--- Agent ${i + 1}: ${statusLabel} (${(r.durationMs / 1000).toFixed(1)}s) ---
Task: ${r.task}${toolList}

${r.output}`;
    })
    .join('\n\n');

  const summary = `Spawned ${agents.length} agent(s). ${results.filter((r) => r.status === 'success').length} succeeded, ${results.filter((r) => r.status === 'error').length} failed, ${results.filter((r) => r.status === 'timeout').length} timed out.
Total tokens: ${totalTokens.input} input + ${totalTokens.output} output

${formattedResults}`;

  return {
    toolCallId: toolCall.id,
    content: summary,
    isError: false,
  };
}

// ============================================================================
// AVAILABILITY
// ============================================================================

export function isSpawnAgentAvailable(): boolean {
  return true; // Always available — uses same Anthropic client as chat
}
