/**
 * RESEARCH AGENT INTEGRATION
 *
 * Connects the Research Agent to the chat route.
 * Provides streaming output compatible with Next.js Response.
 */

import { researchAgent, ResearchInput } from './ResearchAgent';
import { synthesizer } from './brain/Synthesizer';
import { AgentContext, AgentStreamEvent } from '../core/types';

/**
 * Check if a request should use the Research Agent
 * Looks for research-specific patterns
 */
export function shouldUseResearchAgent(request: string): boolean {
  const lowerRequest = request.toLowerCase();

  // Strong research indicators
  const researchPatterns = [
    // Explicit research requests
    /\b(research|investigate|deep dive|analyze)\b.*\b(competitors?|competition|market|industry)/i,
    /\b(find out|discover|learn) (everything|all) about\b/i,
    /\bcompetitor analysis\b/i,
    /\bmarket research\b/i,
    /\bindustry (research|analysis|trends)\b/i,
    /\bcompetitive (analysis|landscape|intelligence)\b/i,

    // Business intelligence
    /\b(who are|what are) (my |the )?(competitors?|competition)\b/i,
    /\b(analyze|research) (the |my )?(business|company|industry)\b/i,
    /\bmarket (size|opportunity|potential)\b/i,
    /\b(pricing|price) (research|analysis|comparison)\b/i,

    // Deep research
    /\bcomprehensive (research|analysis|report)\b/i,
    /\bin-depth (research|analysis|look)\b/i,
    /\bthorough(ly)? (research|investigate|analyze)\b/i,
  ];

  // Check for pattern matches
  const hasResearchPattern = researchPatterns.some(pattern => pattern.test(lowerRequest));

  // Also check for keyword combinations
  const researchKeywords = ['research', 'investigate', 'analyze', 'deep dive', 'competitor', 'market', 'industry'];
  const actionKeywords = ['find', 'discover', 'learn', 'understand', 'explore'];

  const hasResearchKeyword = researchKeywords.some(k => lowerRequest.includes(k));
  const hasActionKeyword = actionKeywords.some(k => lowerRequest.includes(k));
  const hasContextKeyword = ['competitor', 'market', 'industry', 'business', 'company'].some(k => lowerRequest.includes(k));

  return hasResearchPattern || (hasActionKeyword && hasContextKeyword) || (hasResearchKeyword && lowerRequest.length > 30);
}

/**
 * Execute the Research Agent and return a streaming response
 */
export async function executeResearchAgent(
  query: string,
  options: {
    userId?: string;
    conversationId?: string;
    depth?: 'quick' | 'standard' | 'deep';
    previousMessages?: Array<{ role: string; content: string }>;
  } = {}
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Build context
        const context: AgentContext = {
          userId: options.userId || 'anonymous',
          conversationId: options.conversationId,
          previousMessages: options.previousMessages,
          preferences: {
            depth: options.depth || 'standard',
          },
        };

        // Build input
        const input: ResearchInput = {
          query,
          depth: options.depth,
        };

        // Stream header
        controller.enqueue(encoder.encode(`## 🔬 Research Agent\n\n`));
        controller.enqueue(encoder.encode(`> ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}\n\n`));
        controller.enqueue(encoder.encode(`---\n\n`));

        // Execute with streaming progress
        const result = await researchAgent.execute(
          input,
          context,
          (event: AgentStreamEvent) => {
            const progressLine = formatProgressEvent(event);
            controller.enqueue(encoder.encode(progressLine));
          }
        );

        if (result.success && result.data) {
          // Stream the final report
          controller.enqueue(encoder.encode('\n---\n\n'));
          const markdown = synthesizer.formatAsMarkdown(result.data);
          controller.enqueue(encoder.encode(markdown));
        } else {
          controller.enqueue(encoder.encode(`\n\n❌ **Research Failed**\n\n${result.error || 'Unknown error'}\n`));
        }

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ResearchAgent Integration] Error:', errorMessage);
        controller.enqueue(encoder.encode(`\n\n❌ **Research Error**\n\n${errorMessage}\n`));
        controller.close();
      }
    },
  });
}

/**
 * Format a progress event for streaming output
 */
function formatProgressEvent(event: AgentStreamEvent): string {
  const typeIcons: Record<string, string> = {
    thinking: '🧠',
    searching: '🔍',
    evaluating: '📊',
    pivoting: '🔄',
    synthesizing: '✨',
    complete: '✅',
    error: '❌',
  };

  const icon = typeIcons[event.type] || '•';
  const progress = event.progress !== undefined ? ` (${event.progress}%)` : '';

  return `${icon} ${event.message}${progress}\n`;
}

/**
 * Feature flag for Research Agent
 */
export function isResearchAgentEnabled(): boolean {
  // Default to true - this is our competitive advantage
  return process.env.DISABLE_RESEARCH_AGENT !== 'true';
}
