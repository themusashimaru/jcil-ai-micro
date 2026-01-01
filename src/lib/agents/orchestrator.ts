/**
 * MULTI-AGENT ORCHESTRATOR
 * ========================
 *
 * Linear agent orchestration with streaming support for Vercel serverless.
 *
 * Flow: Researcher → Analyst → Writer
 *
 * Each agent:
 * - Has a specialized role and prompt
 * - Receives context from previous agents
 * - Streams progress to keep connection alive
 * - Passes accumulated context to next agent
 *
 * Streaming prevents Vercel timeouts by sending data every few seconds.
 */

import { createGeminiCompletion } from '@/lib/gemini/client';
import type { CoreMessage } from 'ai';

// ============================================================================
// Types
// ============================================================================

export type AgentRole = 'researcher' | 'analyst' | 'writer';

export interface AgentContext {
  originalRequest: string;
  researchFindings?: string;
  analysisInsights?: string;
  previousOutputs: Map<AgentRole, string>;
}

export interface AgentResult {
  role: AgentRole;
  output: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface OrchestrationConfig {
  model: string;
  userId?: string;
  userTier?: string;
  enableResearcher?: boolean;  // Can skip research if context provided
  enableAnalyst?: boolean;     // Can skip analysis for simple tasks
}

// ============================================================================
// Agent Definitions
// ============================================================================

const AGENT_PROMPTS: Record<AgentRole, (ctx: AgentContext) => string> = {
  researcher: (ctx) => `You are a RESEARCH SPECIALIST. Your job is to gather comprehensive, factual information.

**USER'S REQUEST:** ${ctx.originalRequest}

**YOUR TASK:**
1. Search for current, accurate information on this topic
2. Gather SPECIFIC facts, statistics, names, dates, and data points
3. Find multiple perspectives and sources
4. Identify key players, trends, and developments
5. Note any controversies or important context

**OUTPUT FORMAT:**
Provide your research findings in a structured format:
- Use clear headers for different aspects
- Include specific data points (numbers, dates, names)
- Note the reliability/recency of information
- Flag any gaps in available information

**IMPORTANT:** Be thorough and factual. Your findings will be passed to an analyst.

**BEGIN RESEARCH:**`,

  analyst: (ctx) => `You are an ANALYSIS SPECIALIST. Your job is to synthesize research into actionable insights.

**USER'S ORIGINAL REQUEST:** ${ctx.originalRequest}

**RESEARCH FINDINGS FROM PREVIOUS AGENT:**
${ctx.researchFindings || 'No research provided - analyze based on your knowledge.'}

**YOUR TASK:**
1. Synthesize the research findings into coherent insights
2. Identify patterns, trends, and key takeaways
3. Draw logical conclusions supported by the data
4. Highlight the most important points for the user's goal
5. Note any limitations or caveats

**OUTPUT FORMAT:**
Provide your analysis in a structured format:
- Key Insights (3-5 major takeaways)
- Supporting Evidence (specific data backing each insight)
- Implications (what this means for the user)
- Recommendations (actionable next steps if applicable)

**IMPORTANT:** Be analytical and insightful. Your analysis will be used to create the final deliverable.

**BEGIN ANALYSIS:**`,

  writer: (ctx) => `You are a WRITING SPECIALIST. Your job is to create polished, professional deliverables.

**USER'S ORIGINAL REQUEST:** ${ctx.originalRequest}

**RESEARCH FINDINGS:**
${ctx.researchFindings || 'No research provided.'}

**ANALYSIS & INSIGHTS:**
${ctx.analysisInsights || 'No analysis provided.'}

**YOUR TASK:**
Create a polished, professional response that:
1. Directly addresses the user's original request
2. Incorporates the research findings naturally
3. Presents the analysis insights clearly
4. Uses appropriate formatting (headers, bullets, etc.)
5. Feels complete and professionally written

**OUTPUT FORMAT:**
- Write in a clear, engaging style
- Use the research and analysis - don't ignore them
- Include specific facts and data from the research
- Structure appropriately for the content type
- Make it feel like a finished product, not a draft

**IMPORTANT:** This is the FINAL output the user will see. Make it excellent.

**CREATE THE FINAL DELIVERABLE:**`,
};

// ============================================================================
// Individual Agent Execution
// ============================================================================

async function executeAgent(
  role: AgentRole,
  context: AgentContext,
  config: OrchestrationConfig
): Promise<AgentResult> {
  const startTime = Date.now();

  try {
    const prompt = AGENT_PROMPTS[role](context);
    const messages: CoreMessage[] = [{ role: 'user', content: prompt }];

    // Researcher needs web search, others don't
    const enableSearch = role === 'researcher';

    const result = await createGeminiCompletion({
      messages,
      model: config.model,
      maxTokens: role === 'writer' ? 4096 : 2048,
      temperature: role === 'writer' ? 0.7 : 0.5,
      enableSearch,
      userId: config.userId,
      planKey: config.userTier,
    });

    return {
      role,
      output: result.text,
      durationMs: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    return {
      role,
      output: '',
      durationMs: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : 'Agent execution failed',
    };
  }
}

// ============================================================================
// Streaming Orchestrator
// ============================================================================

/**
 * Execute multi-agent orchestration with streaming output.
 * Streams progress updates to prevent Vercel timeouts.
 */
export async function orchestrateAgents(
  originalRequest: string,
  config: OrchestrationConfig
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      const context: AgentContext = {
        originalRequest,
        previousOutputs: new Map(),
      };

      try {
        // ========================================
        // Header
        // ========================================
        const header = formatOrchestrationHeader(originalRequest);
        controller.enqueue(encoder.encode(header));

        // ========================================
        // AGENT 1: Researcher
        // ========================================
        if (config.enableResearcher !== false) {
          controller.enqueue(encoder.encode(formatAgentStart('researcher')));

          const researchResult = await executeAgent('researcher', context, config);

          if (researchResult.success) {
            context.researchFindings = researchResult.output;
            context.previousOutputs.set('researcher', researchResult.output);
            controller.enqueue(encoder.encode(formatAgentComplete('researcher', researchResult)));
          } else {
            controller.enqueue(encoder.encode(formatAgentError('researcher', researchResult)));
            // Continue anyway - analyst can work with limited info
          }
        }

        // ========================================
        // AGENT 2: Analyst
        // ========================================
        if (config.enableAnalyst !== false) {
          controller.enqueue(encoder.encode(formatAgentStart('analyst')));

          const analysisResult = await executeAgent('analyst', context, config);

          if (analysisResult.success) {
            context.analysisInsights = analysisResult.output;
            context.previousOutputs.set('analyst', analysisResult.output);
            controller.enqueue(encoder.encode(formatAgentComplete('analyst', analysisResult)));
          } else {
            controller.enqueue(encoder.encode(formatAgentError('analyst', analysisResult)));
            // Continue anyway - writer can work with research only
          }
        }

        // ========================================
        // AGENT 3: Writer (Always runs)
        // ========================================
        controller.enqueue(encoder.encode(formatAgentStart('writer')));

        const writerResult = await executeAgent('writer', context, config);

        if (writerResult.success) {
          context.previousOutputs.set('writer', writerResult.output);
          controller.enqueue(encoder.encode(formatAgentComplete('writer', writerResult)));

          // Stream the final output
          controller.enqueue(encoder.encode('\n---\n\n'));
          controller.enqueue(encoder.encode(writerResult.output));
        } else {
          controller.enqueue(encoder.encode(formatAgentError('writer', writerResult)));

          // Fallback: return whatever we have
          if (context.analysisInsights) {
            controller.enqueue(encoder.encode('\n---\n\n**Analysis Results:**\n\n'));
            controller.enqueue(encoder.encode(context.analysisInsights));
          } else if (context.researchFindings) {
            controller.enqueue(encoder.encode('\n---\n\n**Research Findings:**\n\n'));
            controller.enqueue(encoder.encode(context.researchFindings));
          }
        }

        // ========================================
        // Footer
        // ========================================
        const totalDuration = Date.now() - startTime;
        const agentCount = [
          config.enableResearcher !== false,
          config.enableAnalyst !== false,
          true, // writer always runs
        ].filter(Boolean).length;

        controller.enqueue(encoder.encode(formatOrchestrationFooter(agentCount, totalDuration)));

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[AgentOrchestrator] Fatal error:', errorMessage);
        controller.enqueue(encoder.encode(formatFatalError(errorMessage)));
        controller.close();
      }
    },
  });
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatOrchestrationHeader(request: string): string {
  const preview = request.length > 100 ? request.slice(0, 100) + '...' : request;
  return `## 🤖 Multi-Agent Task

> ${preview}

**Agents:** Researcher → Analyst → Writer

---

`;
}

function formatAgentStart(role: AgentRole): string {
  const emojis: Record<AgentRole, string> = {
    researcher: '🔍',
    analyst: '📊',
    writer: '✍️',
  };
  const names: Record<AgentRole, string> = {
    researcher: 'Researcher',
    analyst: 'Analyst',
    writer: 'Writer',
  };
  return `${emojis[role]} **${names[role]} Agent** working...\n\n`;
}

function formatAgentComplete(role: AgentRole, result: AgentResult): string {
  const duration = formatDuration(result.durationMs);
  const preview = result.output.slice(0, 150).replace(/\n/g, ' ');
  return `✅ **${capitalize(role)}** complete (${duration})\n> ${preview}...\n\n`;
}

function formatAgentError(role: AgentRole, result: AgentResult): string {
  const duration = formatDuration(result.durationMs);
  return `⚠️ **${capitalize(role)}** encountered issue (${duration})\n> ${result.error}\n> *Continuing with available information...*\n\n`;
}

function formatOrchestrationFooter(agentCount: number, durationMs: number): string {
  const duration = formatDuration(durationMs);
  return `\n\n---\n*✓ Completed with ${agentCount} agents in ${duration}*`;
}

function formatFatalError(message: string): string {
  return `\n\n---\n\n❌ **Orchestration Error**\n\n${message}\n\nPlease try again or simplify your request.`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// Feature Flag
// ============================================================================

/**
 * Check if multi-agent orchestration is enabled
 */
export function isOrchestrationEnabled(): boolean {
  return process.env.ENABLE_AGENT_ORCHESTRATION === 'true';
}

/**
 * Determine if a request should use multi-agent orchestration
 * (vs simpler single-agent or parallel research)
 */
export function shouldUseOrchestration(request: string): boolean {
  if (!isOrchestrationEnabled()) return false;

  const lowerRequest = request.toLowerCase();

  // Triggers for multi-agent orchestration
  const orchestrationTriggers = [
    // Research + deliverable patterns
    /research.*and.*(create|write|make|generate|produce)/i,
    /find.*and.*(summarize|analyze|report)/i,
    /investigate.*and.*(write|create|prepare)/i,

    // Analysis + output patterns
    /analyze.*and.*(create|write|present)/i,
    /compare.*and.*(write|create|report)/i,

    // Complex deliverable requests
    /comprehensive.*(report|analysis|review)/i,
    /detailed.*(report|analysis|breakdown)/i,
    /in-depth.*(research|analysis|study)/i,

    // Explicit multi-step
    /step.?by.?step/i,
    /thorough(ly)?/i,
  ];

  return orchestrationTriggers.some(pattern => pattern.test(lowerRequest));
}
