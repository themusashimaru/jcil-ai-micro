/**
 * RESEARCH AGENT INTEGRATION
 *
 * Connects the Research Agent to the chat route.
 * Provides streaming output compatible with Next.js Response.
 */

import { researchAgent, ResearchInput } from './ResearchAgent';
import { synthesizer } from './brain/Synthesizer';
import { AgentContext, AgentStreamEvent } from '../core/types';
import { logger } from '@/lib/logger';

const log = logger('ResearchAgentIntegration');

/**
 * Check if a request should use the Research Agent
 * Looks for research-specific patterns
 */
export function shouldUseResearchAgent(request: string): boolean {
  const lowerRequest = request.toLowerCase();

  // EXCLUSIONS - Do NOT use Research Agent for these
  const exclusionPatterns = [
    // Document/file analysis (user uploaded something)
    /\b(this|the) (document|file|pdf|image|photo|picture)\b/i,
    /\bwhat is this\b/i,
    /\banalyze this\b/i,
    /\bread this\b/i,
    /\bsummarize this\b/i,
    /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|webp)\b/i,
    /\[document:/i,
    // Simple questions
    /^(hi|hello|hey|what'?s? up|how are you)/i,
    /^(thanks?|thank you)/i,
  ];

  // If any exclusion pattern matches, don't use research agent
  if (exclusionPatterns.some(pattern => pattern.test(lowerRequest))) {
    return false;
  }

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
 *
 * RELIABILITY FEATURES:
 * - Global 4-minute timeout to prevent Vercel function timeout
 * - Keepalive heartbeat every 20s during long operations
 * - Graceful error handling with user-friendly messages
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

  // Configuration for reliability
  const GLOBAL_TIMEOUT_MS = 240000; // 4 minutes (under Vercel's 5min limit)
  const KEEPALIVE_INTERVAL_MS = 20000; // Send keepalive every 20s

  return new ReadableStream({
    async start(controller) {
      let keepaliveInterval: NodeJS.Timeout | null = null;
      let globalTimeout: NodeJS.Timeout | null = null;
      let lastActivity = Date.now();
      let isComplete = false;

      // Keepalive function
      const startKeepalive = () => {
        keepaliveInterval = setInterval(() => {
          if (isComplete) return;
          const timeSinceActivity = Date.now() - lastActivity;
          if (timeSinceActivity > KEEPALIVE_INTERVAL_MS - 2000) {
            try {
              controller.enqueue(encoder.encode(' ')); // Invisible keepalive
              log.info('Sent keepalive heartbeat');
            } catch {
              // Controller might be closed
            }
          }
        }, KEEPALIVE_INTERVAL_MS);
      };

      const cleanup = () => {
        isComplete = true;
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
          keepaliveInterval = null;
        }
        if (globalTimeout) {
          clearTimeout(globalTimeout);
          globalTimeout = null;
        }
      };

      try {
        // Set global timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          globalTimeout = setTimeout(() => {
            reject(new Error('Research timeout: Operation took too long'));
          }, GLOBAL_TIMEOUT_MS);
        });

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

        // Stream professional header
        controller.enqueue(encoder.encode(`# 🔬 JCIL Research Intelligence\n\n`));
        controller.enqueue(encoder.encode(`**Query:** ${query.substring(0, 150)}${query.length > 150 ? '...' : ''}\n\n`));
        controller.enqueue(encoder.encode(`---\n\n`));
        controller.enqueue(encoder.encode(`### Analysis Pipeline\n\n`));

        // Start keepalive
        startKeepalive();

        // Execute with streaming progress (race against timeout)
        const executePromise = researchAgent.execute(
          input,
          context,
          (event: AgentStreamEvent) => {
            lastActivity = Date.now();
            const progressLine = formatProgressEvent(event);
            controller.enqueue(encoder.encode(progressLine));
          }
        );

        const result = await Promise.race([executePromise, timeoutPromise]);

        if (result.success && result.data) {
          // Stream the final report
          controller.enqueue(encoder.encode('\n---\n\n'));
          const markdown = synthesizer.formatAsMarkdown(result.data);
          controller.enqueue(encoder.encode(markdown));
        } else {
          controller.enqueue(encoder.encode(`\n\n❌ **Research Failed**\n\n${result.error || 'Unknown error'}\n`));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error('Research execution error', { message: errorMessage });

        const userMessage = errorMessage.includes('timeout')
          ? `\n\n⏱️ **Research Timeout**\n\nThe research is taking longer than expected. Please try:\n- A more specific query\n- Using "quick" depth for faster results\n- Breaking your question into smaller parts\n`
          : `\n\n❌ **Research Error**\n\n${errorMessage}\n`;

        controller.enqueue(encoder.encode(userMessage));
      } finally {
        cleanup();
        controller.close();
      }
    },
  });
}

/**
 * Format a progress event for streaming output - Professional styling
 */
function formatProgressEvent(event: AgentStreamEvent): string {
  const typeConfig: Record<string, { icon: string; prefix: string }> = {
    thinking: { icon: '◉', prefix: 'ANALYZING' },
    searching: { icon: '◎', prefix: 'SEARCHING' },
    evaluating: { icon: '◈', prefix: 'EVALUATING' },
    pivoting: { icon: '◇', prefix: 'ADAPTING' },
    synthesizing: { icon: '◆', prefix: 'SYNTHESIZING' },
    complete: { icon: '●', prefix: 'COMPLETE' },
    error: { icon: '✕', prefix: 'ERROR' },
  };

  const config = typeConfig[event.type] || { icon: '○', prefix: 'PROCESSING' };

  // Skip heartbeat messages from cluttering the output
  const details = event.details as Record<string, unknown> | undefined;
  if (details?.heartbeat) {
    return ''; // Don't show "Still working..." messages
  }

  // Format progress bar if available
  let progressBar = '';
  if (event.progress !== undefined && event.progress > 0) {
    const filled = Math.round(event.progress / 10);
    progressBar = ` [${'\u2588'.repeat(filled)}${'\u2591'.repeat(10 - filled)}]`;
  }

  return `${config.icon} **${config.prefix}**${progressBar} ${event.message}\n`;
}

/**
 * Feature flag for Research Agent
 */
export function isResearchAgentEnabled(): boolean {
  // Default to true - this is our competitive advantage
  return process.env.DISABLE_RESEARCH_AGENT !== 'true';
}
