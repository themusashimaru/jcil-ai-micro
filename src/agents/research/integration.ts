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
  if (exclusionPatterns.some((pattern) => pattern.test(lowerRequest))) {
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
  const hasResearchPattern = researchPatterns.some((pattern) => pattern.test(lowerRequest));

  // Also check for keyword combinations
  const researchKeywords = [
    'research',
    'investigate',
    'analyze',
    'deep dive',
    'competitor',
    'market',
    'industry',
  ];
  const actionKeywords = ['find', 'discover', 'learn', 'understand', 'explore'];

  const hasResearchKeyword = researchKeywords.some((k) => lowerRequest.includes(k));
  const hasActionKeyword = actionKeywords.some((k) => lowerRequest.includes(k));
  const hasContextKeyword = ['competitor', 'market', 'industry', 'business', 'company'].some((k) =>
    lowerRequest.includes(k)
  );

  return (
    hasResearchPattern ||
    (hasActionKeyword && hasContextKeyword) ||
    (hasResearchKeyword && lowerRequest.length > 30)
  );
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

        // Reset task state for new research session
        resetTaskState();

        // Stream clean header
        controller.enqueue(encoder.encode(`**Research Agent**\n\n`));

        // Start keepalive
        startKeepalive();

        // Execute with streaming progress (race against timeout)
        const executePromise = researchAgent.execute(input, context, (event: AgentStreamEvent) => {
          lastActivity = Date.now();
          const progressLine = formatProgressEvent(event);
          controller.enqueue(encoder.encode(progressLine));
        });

        const result = await Promise.race([executePromise, timeoutPromise]);

        if (result.success && result.data) {
          // Stream the final report with clean separator
          controller.enqueue(encoder.encode('\n'));
          const markdown = synthesizer.formatAsMarkdown(result.data);
          controller.enqueue(encoder.encode(markdown));
        } else {
          controller.enqueue(
            encoder.encode(`\n✗ Research failed: ${result.error || 'Unknown error'}\n`)
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error('Research execution error', { message: errorMessage });

        const userMessage = errorMessage.includes('timeout')
          ? `\n✗ Research timeout. Try a more specific query or use quick depth.\n`
          : `\n✗ Research error: ${errorMessage}\n`;

        controller.enqueue(encoder.encode(userMessage));
      } finally {
        cleanup();
        controller.close();
      }
    },
  });
}

/**
 * Research task tracking for professional checklist-style progress
 * Shows all steps upfront and updates as they complete
 */
interface ResearchTask {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

// Define the research workflow steps
const RESEARCH_TASKS: ResearchTask[] = [
  { id: 'intent', label: 'Analyze research request', status: 'pending' },
  { id: 'strategy', label: 'Generate research strategy', status: 'pending' },
  { id: 'search', label: 'Execute searches', status: 'pending' },
  { id: 'evaluate', label: 'Evaluate findings', status: 'pending' },
  { id: 'synthesize', label: 'Synthesize report', status: 'pending' },
];

// Track current task state across the stream
let currentTasks: ResearchTask[] = [];
let hasShownInitialList = false;
let lastRenderedOutput = '';

/**
 * Reset task state for a new research session
 */
function resetTaskState(): void {
  currentTasks = RESEARCH_TASKS.map(t => ({ ...t }));
  hasShownInitialList = false;
  lastRenderedOutput = '';
}

/**
 * Render the current task list as a checklist
 */
function renderTaskList(): string {
  return currentTasks.map(task => {
    const icon = task.status === 'completed' ? '☑' :
                 task.status === 'active' ? '◉' : '☐';
    return `${icon} ${task.label}`;
  }).join('\n');
}

/**
 * Map event types/phases to task IDs
 */
function getTaskIdFromEvent(event: AgentStreamEvent): string | null {
  const phase = (event.details as Record<string, unknown> | undefined)?.phase as string | undefined;
  const type = event.type;

  // Map phases and types to task IDs
  if (phase === 'Intent Analysis' || type === 'thinking' && event.message.includes('Analyzing')) {
    return 'intent';
  }
  if (phase === 'Strategy Generation' || event.message.includes('strategy')) {
    return 'strategy';
  }
  if (type === 'searching' || phase?.includes('Iteration')) {
    return 'search';
  }
  if (type === 'evaluating') {
    return 'evaluate';
  }
  if (type === 'synthesizing' || phase === 'Synthesis') {
    return 'synthesize';
  }
  if (type === 'complete') {
    return 'complete';
  }

  return null;
}

/**
 * Format a progress event for streaming output - Professional checklist style
 * Shows all tasks upfront and updates with checkboxes as they complete
 */
function formatProgressEvent(event: AgentStreamEvent): string {
  // Skip heartbeat messages
  const details = event.details as Record<string, unknown> | undefined;
  if (details?.heartbeat) {
    return '';
  }

  // Handle errors
  if (event.type === 'error') {
    return `\n✗ ${event.message}\n`;
  }

  // Initialize task list on first event
  if (!hasShownInitialList) {
    resetTaskState();
    hasShownInitialList = true;
    // Mark first task as active
    currentTasks[0].status = 'active';
    lastRenderedOutput = renderTaskList();
    return lastRenderedOutput + '\n';
  }

  // Get which task this event relates to
  const taskId = getTaskIdFromEvent(event);

  if (!taskId) {
    return ''; // Skip events that don't map to tasks
  }

  // Handle completion
  if (taskId === 'complete') {
    // Mark all tasks as completed
    currentTasks.forEach(t => t.status = 'completed');
    const newOutput = renderTaskList();
    // Only output if changed
    if (newOutput !== lastRenderedOutput) {
      lastRenderedOutput = newOutput;
      return '\n' + newOutput + '\n';
    }
    return '';
  }

  // Find current and target task indices
  const taskIndex = currentTasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return '';

  // Mark all previous tasks as completed
  for (let i = 0; i < taskIndex; i++) {
    currentTasks[i].status = 'completed';
  }

  // Mark current task as active
  currentTasks[taskIndex].status = 'active';

  // Render updated list
  const newOutput = renderTaskList();

  // Only output if the state actually changed
  if (newOutput !== lastRenderedOutput) {
    lastRenderedOutput = newOutput;
    return '\n' + newOutput + '\n';
  }

  return '';
}

/**
 * Feature flag for Research Agent
 */
export function isResearchAgentEnabled(): boolean {
  // Default to true - this is our competitive advantage
  return process.env.DISABLE_RESEARCH_AGENT !== 'true';
}
