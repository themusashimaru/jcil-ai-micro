/**
 * MULTI-AGENT ORCHESTRATOR
 *
 * The brain of the multi-agent system. Analyzes requests,
 * delegates to specialized agents, and synthesizes responses.
 */

import Anthropic from '@anthropic-ai/sdk';
import { AgentRole, AgentContext, AgentResponse } from './types';
import { getAgent, orchestratorAgent } from './agents';
import { logger } from '@/lib/logger';

const log = logger('Orchestrator');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ========================================
// ORCHESTRATION PLANNING
// ========================================

interface OrchestratorDecision {
  agents: AgentRole[];
  sequence: 'parallel' | 'sequential';
  reasoning: string;
  tasks: Array<{
    agent: AgentRole;
    instruction: string;
  }>;
}

/**
 * Analyze the user's request and determine which agents to use
 */
export async function planOrchestration(
  userMessage: string,
  context: AgentContext
): Promise<OrchestratorDecision> {
  // Quick pattern matching for common cases (optimization)
  const lowerMessage = userMessage.toLowerCase();

  // Code review is explicit
  if (lowerMessage.includes('review') && (lowerMessage.includes('code') || lowerMessage.includes('pr'))) {
    return {
      agents: ['reviewer'],
      sequence: 'sequential',
      reasoning: 'Explicit code review request',
      tasks: [{ agent: 'reviewer', instruction: userMessage }],
    };
  }

  // Test writing is explicit
  if (lowerMessage.includes('test') && (lowerMessage.includes('write') || lowerMessage.includes('create') || lowerMessage.includes('add'))) {
    return {
      agents: ['test'],
      sequence: 'sequential',
      reasoning: 'Explicit test writing request',
      tasks: [{ agent: 'test', instruction: userMessage }],
    };
  }

  // For complex requests, use the orchestrator to decide
  try {
    const response = await anthropic.messages.create({
      model: orchestratorAgent.model,
      max_tokens: orchestratorAgent.maxTokens,
      system: orchestratorAgent.systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze this request and determine which agents should handle it:

Request: "${userMessage}"

${context.repo ? `Repository: ${context.repo.fullName} (${context.repo.branch})` : ''}
${context.files?.length ? `Files provided: ${context.files.map(f => f.path).join(', ')}` : ''}

Return ONLY a JSON object with no markdown formatting.`,
        },
      ],
    });

    // Parse the response
    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      }
    }

    // Try to parse JSON from the response
    try {
      // Remove any markdown code block markers
      const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      const decision = JSON.parse(jsonStr) as OrchestratorDecision;

      // Validate the decision
      if (!decision.agents || decision.agents.length === 0) {
        throw new Error('No agents selected');
      }

      return decision;
    } catch {
      // Fallback: determine from keywords
      return determineAgentsFallback(userMessage);
    }
  } catch (error) {
    log.error('Planning error', error as Error);
    return determineAgentsFallback(userMessage);
  }
}

/**
 * Fallback agent selection based on keywords
 */
function determineAgentsFallback(message: string): OrchestratorDecision {
  const lower = message.toLowerCase();
  const agents: AgentRole[] = [];
  const tasks: Array<{ agent: AgentRole; instruction: string }> = [];

  // Frontend indicators
  const frontendKeywords = ['component', 'ui', 'button', 'form', 'page', 'layout', 'css', 'style', 'tailwind', 'react', 'jsx', 'tsx', 'modal', 'sidebar', 'navbar', 'card', 'responsive', 'animation'];
  const hasFrontend = frontendKeywords.some(k => lower.includes(k));

  // Backend indicators
  const backendKeywords = ['api', 'endpoint', 'database', 'server', 'route', 'authentication', 'auth', 'fetch', 'post', 'get', 'crud', 'sql', 'query', 'prisma', 'supabase'];
  const hasBackend = backendKeywords.some(k => lower.includes(k));

  // Test indicators
  const testKeywords = ['test', 'testing', 'spec', 'coverage', 'mock', 'jest', 'vitest', 'playwright', 'e2e', 'unit test'];
  const hasTest = testKeywords.some(k => lower.includes(k));

  // Review indicators
  const reviewKeywords = ['review', 'check', 'analyze', 'audit', 'improve', 'refactor', 'best practice', 'security', 'performance'];
  const hasReview = reviewKeywords.some(k => lower.includes(k));

  if (hasFrontend) {
    agents.push('frontend');
    tasks.push({ agent: 'frontend', instruction: message });
  }

  if (hasBackend) {
    agents.push('backend');
    tasks.push({ agent: 'backend', instruction: message });
  }

  if (hasTest) {
    agents.push('test');
    tasks.push({ agent: 'test', instruction: message });
  }

  if (hasReview) {
    agents.push('reviewer');
    tasks.push({ agent: 'reviewer', instruction: message });
  }

  // Default to frontend if nothing matches
  if (agents.length === 0) {
    agents.push('frontend');
    tasks.push({ agent: 'frontend', instruction: message });
  }

  return {
    agents,
    sequence: agents.length > 1 ? 'sequential' : 'sequential',
    reasoning: 'Determined from keyword analysis',
    tasks,
  };
}

// ========================================
// AGENT EXECUTION
// ========================================

/**
 * Execute a single agent with the given instruction
 */
export async function executeAgent(
  role: AgentRole,
  instruction: string,
  context: AgentContext,
  previousResponses?: AgentResponse[]
): Promise<AgentResponse> {
  const agent = getAgent(role);

  // Build context-aware prompt
  let contextPrompt = '';

  if (context.repo) {
    contextPrompt += `\n\nRepository: ${context.repo.fullName} (branch: ${context.repo.branch})`;
  }

  if (context.files && context.files.length > 0) {
    contextPrompt += '\n\nRelevant files:\n';
    for (const file of context.files.slice(0, 5)) { // Limit to 5 files
      contextPrompt += `\n--- ${file.path} ---\n${file.content.slice(0, 2000)}${file.content.length > 2000 ? '\n...(truncated)' : ''}\n`;
    }
  }

  if (previousResponses && previousResponses.length > 0) {
    contextPrompt += '\n\nPrevious agent outputs:\n';
    for (const resp of previousResponses) {
      contextPrompt += `\n[${resp.role.toUpperCase()} AGENT]:\n${resp.content.slice(0, 1500)}${resp.content.length > 1500 ? '\n...(truncated)' : ''}\n`;
    }
  }

  // Build messages with conversation history
  const messages: Anthropic.MessageParam[] = [];

  if (context.previousMessages && context.previousMessages.length > 0) {
    // Add recent conversation history (last 5 messages)
    const recentMessages = context.previousMessages.slice(-5);
    for (const msg of recentMessages) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  // Add the current instruction
  messages.push({
    role: 'user',
    content: `${instruction}${contextPrompt}`,
  });

  try {
    const response = await anthropic.messages.create({
      model: agent.model,
      max_tokens: agent.maxTokens,
      system: agent.systemPrompt,
      messages,
      temperature: agent.temperature,
    });

    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      }
    }

    // Extract any code files from the response
    const files = extractFilesFromResponse(content);

    return {
      role,
      content,
      files,
      confidence: 0.85, // Default confidence
    };
  } catch (error) {
    log.error('Agent execution error', error as Error, { role });
    return {
      role,
      content: `I encountered an error processing this request. Please try again.`,
      confidence: 0,
    };
  }
}

/**
 * Extract code files from agent response
 */
function extractFilesFromResponse(content: string): Array<{ path: string; content: string; language?: string }> {
  const files: Array<{ path: string; content: string; language?: string }> = [];

  // Pattern to match code blocks with optional filename
  // ```tsx:path/to/file.tsx or ```typescript // filename: file.ts
  const codeBlockRegex = /```(\w+)(?::([^\n]+))?\n([\s\S]*?)```/g;

  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1];
    let filename = match[2]?.trim();
    const code = match[3];

    // Try to extract filename from first line if not in header
    if (!filename && code) {
      const firstLine = code.split('\n')[0];
      const filenameMatch = firstLine.match(/\/\/\s*(?:filename|file):\s*(.+)/i);
      if (filenameMatch) {
        filename = filenameMatch[1].trim();
      }
    }

    if (filename && code) {
      files.push({
        path: filename,
        content: code.replace(/^\/\/\s*(?:filename|file):.+\n?/i, '').trim(),
        language,
      });
    }
  }

  return files;
}

// ========================================
// MULTI-AGENT EXECUTION
// ========================================

/**
 * Execute multiple agents based on the orchestration plan
 */
export async function executeMultiAgent(
  plan: OrchestratorDecision,
  context: AgentContext
): Promise<{
  responses: AgentResponse[];
  summary: string;
}> {
  const responses: AgentResponse[] = [];

  if (plan.sequence === 'parallel') {
    // Execute all agents in parallel
    const promises = plan.tasks.map(task =>
      executeAgent(task.agent, task.instruction, context)
    );
    const results = await Promise.all(promises);
    responses.push(...results);
  } else {
    // Execute agents sequentially, passing previous responses
    for (const task of plan.tasks) {
      const response = await executeAgent(
        task.agent,
        task.instruction,
        context,
        responses
      );
      responses.push(response);
    }
  }

  // Generate a summary if multiple agents were used
  let summary = '';
  if (responses.length > 1) {
    summary = `\n\n---\n\n**Multi-Agent Summary**\n`;
    summary += `*${responses.length} specialized agents collaborated on this task:*\n\n`;
    for (const resp of responses) {
      const agent = getAgent(resp.role);
      summary += `- **${agent.name}**: ${resp.confidence >= 0.8 ? '✅' : '⚠️'} Completed\n`;
    }
  }

  return { responses, summary };
}

/**
 * Main entry point: analyze request and execute appropriate agents
 */
export async function orchestrate(
  userMessage: string,
  context: AgentContext
): Promise<{
  content: string;
  agentsUsed: AgentRole[];
  files: Array<{ path: string; content: string; language?: string }>;
}> {
  // 1. Plan the orchestration
  const plan = await planOrchestration(userMessage, context);

  log.debug('Plan', { plan });

  // 2. Execute the agents
  const { responses, summary } = await executeMultiAgent(plan, context);

  // 3. Combine responses
  let combinedContent = '';
  const allFiles: Array<{ path: string; content: string; language?: string }> = [];

  for (let i = 0; i < responses.length; i++) {
    const resp = responses[i];
    const agent = getAgent(resp.role);

    if (responses.length > 1) {
      combinedContent += `## ${agent.name}\n\n`;
    }

    combinedContent += resp.content;

    if (i < responses.length - 1) {
      combinedContent += '\n\n---\n\n';
    }

    if (resp.files) {
      allFiles.push(...resp.files);
    }
  }

  // Add summary for multi-agent responses
  if (summary) {
    combinedContent += summary;
  }

  return {
    content: combinedContent,
    agentsUsed: plan.agents,
    files: allFiles,
  };
}

// ========================================
// STREAMING ORCHESTRATION
// ========================================

/**
 * Stream orchestrated response for real-time UI feedback
 */
export async function* orchestrateStream(
  userMessage: string,
  context: AgentContext
): AsyncGenerator<string, void, unknown> {
  // 1. Plan
  const plan = await planOrchestration(userMessage, context);

  // Show which agents are working
  if (plan.agents.length > 1) {
    yield `*🤖 Activating ${plan.agents.length} specialized agents: ${plan.agents.map(a => getAgent(a).name).join(', ')}*\n\n`;
  } else if (plan.agents.length === 1) {
    yield `*🤖 ${getAgent(plan.agents[0]).name} is working on this...*\n\n`;
  }

  // 2. Execute agents
  const responses: AgentResponse[] = [];

  for (let i = 0; i < plan.tasks.length; i++) {
    const task = plan.tasks[i];
    const agent = getAgent(task.agent);

    if (plan.tasks.length > 1) {
      yield `## ${agent.name}\n\n`;
    }

    // Execute the agent (non-streaming for now, but we yield the full response)
    const response = await executeAgent(
      task.agent,
      task.instruction,
      context,
      responses
    );

    responses.push(response);
    yield response.content;

    if (i < plan.tasks.length - 1) {
      yield '\n\n---\n\n';
    }
  }

  // 3. Add summary
  if (responses.length > 1) {
    yield `\n\n---\n\n**Multi-Agent Summary**\n`;
    yield `*${responses.length} agents completed their tasks:*\n\n`;
    for (const resp of responses) {
      const agent = getAgent(resp.role);
      yield `- **${agent.name}**: ✅ Done\n`;
    }
  }
}

// ========================================
// DETECTION HELPERS
// ========================================

/**
 * Check if a message should use multi-agent mode
 */
export function shouldUseMultiAgent(message: string): boolean {
  const lower = message.toLowerCase();

  // Explicit multi-agent triggers
  if (lower.includes('multi-agent') || lower.includes('multiagent')) {
    return true;
  }

  // Complex task indicators
  const complexIndicators = [
    // Frontend + Backend
    /build.*(full|complete|entire).*(feature|app|application)/i,
    /create.*(full|complete).*(stack|feature)/i,

    // Build + Test
    /build.*and.*test/i,
    /create.*with.*tests/i,

    // Multiple domains
    /frontend.*and.*backend/i,
    /api.*and.*ui/i,
    /component.*and.*api/i,

    // Review combined with build
    /build.*and.*review/i,
    /create.*then.*review/i,
  ];

  return complexIndicators.some(pattern => pattern.test(message));
}

/**
 * Get suggested agents for a message (for UI display)
 */
export function getSuggestedAgents(message: string): AgentRole[] {
  const plan = determineAgentsFallback(message);
  return plan.agents;
}
