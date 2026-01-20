/**
 * CONTEXT SUMMARIZER
 *
 * Summarizes long conversations to fit within provider context windows.
 * Uses intelligent chunking and summarization strategies.
 */

import type { ProviderId, UnifiedMessage, UnifiedContentBlock } from '../types';

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Estimate token count for a string (rough approximation)
 * Uses ~4 characters per token as a reasonable estimate
 */
export function estimateStringTokens(text: string): number {
  // Count words and characters
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;

  // Use average of word-based and char-based estimates
  // ~0.75 tokens per word, ~0.25 tokens per character
  return Math.ceil((wordCount * 0.75 + charCount * 0.25) / 2);
}

/**
 * Estimate token count for a content block
 */
function estimateBlockTokens(block: UnifiedContentBlock): number {
  switch (block.type) {
    case 'text':
      return estimateStringTokens((block as { text: string }).text);

    case 'image':
      // Images use roughly 1000-2000 tokens depending on size
      return 1500;

    case 'tool_use': {
      const toolBlock = block as { name: string; arguments: Record<string, unknown> };
      const argsStr = JSON.stringify(toolBlock.arguments);
      return estimateStringTokens(toolBlock.name) + estimateStringTokens(argsStr) + 50;
    }

    case 'tool_result': {
      const resultBlock = block as { content: string };
      return estimateStringTokens(resultBlock.content) + 20;
    }

    default:
      return 50;
  }
}

/**
 * Estimate token count for a single message
 */
export function estimateMessageTokens(message: UnifiedMessage): number {
  // Base tokens for message structure
  let tokens = 10;

  if (typeof message.content === 'string') {
    tokens += estimateStringTokens(message.content);
  } else {
    for (const block of message.content) {
      tokens += estimateBlockTokens(block);
    }
  }

  return tokens;
}

/**
 * Estimate total token count for a conversation
 */
export function estimateTokenCount(messages: UnifiedMessage[]): number {
  return messages.reduce((total, msg) => total + estimateMessageTokens(msg), 0);
}

// ============================================================================
// SUMMARIZATION OPTIONS
// ============================================================================

/**
 * Options for context summarization
 */
export interface SummarizationOptions {
  /** Target token count after summarization */
  targetTokens: number;
  /** Number of recent messages to preserve unchanged */
  preserveRecentMessages: number;
  /** Preserve tool call history in summary */
  preserveToolHistory: boolean;
  /** Include timestamps in summary */
  includeTimestamps?: boolean;
}

/**
 * Default summarization options
 */
export const DEFAULT_SUMMARIZATION_OPTIONS: SummarizationOptions = {
  targetTokens: 50000,
  preserveRecentMessages: 5,
  preserveToolHistory: true,
  includeTimestamps: false,
};

/**
 * Result of summarization
 */
export interface SummarizationResult {
  /** Summarized messages */
  messages: UnifiedMessage[];
  /** Original message count */
  originalCount: number;
  /** Summarized message count */
  summarizedCount: number;
  /** Estimated tokens before */
  tokensBefore: number;
  /** Estimated tokens after */
  tokensAfter: number;
  /** Summary text that was generated */
  summaryText: string;
}

// ============================================================================
// MESSAGE ANALYSIS
// ============================================================================

/**
 * Extract key information from messages for summarization
 */
function extractKeyPoints(messages: UnifiedMessage[]): string[] {
  const keyPoints: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      // Extract user requests/questions
      const text = getMessageText(msg);
      if (text.length > 20) {
        // Only significant messages
        const summary = text.length > 200 ? text.substring(0, 200) + '...' : text;
        keyPoints.push(`User: ${summary}`);
      }
    } else if (msg.role === 'assistant') {
      // Extract assistant key actions
      const text = getMessageText(msg);
      const toolCalls = extractToolCalls(msg);

      if (toolCalls.length > 0) {
        keyPoints.push(`Assistant used tools: ${toolCalls.join(', ')}`);
      } else if (text.length > 50) {
        // Only include substantial responses
        const summary = text.length > 200 ? text.substring(0, 200) + '...' : text;
        keyPoints.push(`Assistant: ${summary}`);
      }
    }
  }

  return keyPoints;
}

/**
 * Get plain text from a message
 */
function getMessageText(msg: UnifiedMessage): string {
  if (typeof msg.content === 'string') {
    return msg.content;
  }

  return msg.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { text: string }).text)
    .join('\n');
}

/**
 * Extract tool call names from a message
 */
function extractToolCalls(msg: UnifiedMessage): string[] {
  if (typeof msg.content === 'string') {
    return [];
  }

  return msg.content
    .filter((block) => block.type === 'tool_use')
    .map((block) => (block as { name: string }).name);
}

// ============================================================================
// SUMMARIZATION STRATEGIES
// ============================================================================

/**
 * Create a summary message from older messages
 */
function createSummaryMessage(
  messages: UnifiedMessage[],
  options: SummarizationOptions
): UnifiedMessage {
  const keyPoints = extractKeyPoints(messages);

  // Build summary text
  let summaryText = '## Conversation Summary\n\n';
  summaryText += 'The following is a summary of the earlier conversation:\n\n';

  // Group by themes if possible
  if (keyPoints.length <= 10) {
    summaryText += keyPoints.map((point) => `- ${point}`).join('\n');
  } else {
    // Chunk into sections for longer conversations
    summaryText += '### Key Points\n';
    summaryText += keyPoints
      .slice(0, 5)
      .map((point) => `- ${point}`)
      .join('\n');

    if (options.preserveToolHistory) {
      const toolPoints = keyPoints.filter((p) => p.includes('used tools'));
      if (toolPoints.length > 0) {
        summaryText += '\n\n### Tool Usage\n';
        summaryText += toolPoints.map((point) => `- ${point}`).join('\n');
      }
    }

    // Add note about truncation
    summaryText += `\n\n*[${messages.length} messages summarized]*`;
  }

  return {
    role: 'system',
    content: summaryText,
    metadata: {
      isSummary: true,
      summarizedMessageCount: messages.length,
    },
  };
}

/**
 * Simple summarization: keep recent messages, summarize older ones
 */
function simpleSummarize(
  messages: UnifiedMessage[],
  options: SummarizationOptions
): { summary: UnifiedMessage; preserved: UnifiedMessage[] } {
  const { preserveRecentMessages } = options;

  // Split messages
  const toSummarize = messages.slice(0, -preserveRecentMessages);
  const toPreserve = messages.slice(-preserveRecentMessages);

  // Create summary of older messages
  const summary = createSummaryMessage(toSummarize, options);

  return { summary, preserved: toPreserve };
}

/**
 * Aggressive summarization: heavily compress all but most recent
 */
function aggressiveSummarize(
  messages: UnifiedMessage[],
  _targetTokens: number
): { summary: UnifiedMessage; preserved: UnifiedMessage[] } {
  // Keep only last 2-3 messages unchanged
  const toPreserve = messages.slice(-3);
  const toSummarize = messages.slice(0, -3);

  // Create very compressed summary
  const keyActions: string[] = [];

  for (const msg of toSummarize) {
    const tools = extractToolCalls(msg);
    if (tools.length > 0) {
      keyActions.push(`Used: ${tools.join(', ')}`);
    }
  }

  let summaryText = `## Prior Context (${toSummarize.length} messages)\n`;
  summaryText += 'Previous conversation involved:\n';
  summaryText += [...new Set(keyActions)]
    .slice(0, 10)
    .map((a) => `- ${a}`)
    .join('\n');
  summaryText += '\n\n*Continue the conversation naturally.*';

  const summary: UnifiedMessage = {
    role: 'system',
    content: summaryText,
    metadata: { isSummary: true, aggressive: true },
  };

  return { summary, preserved: toPreserve };
}

// ============================================================================
// MAIN SUMMARIZATION FUNCTION
// ============================================================================

/**
 * Summarize a conversation to fit within target token count
 *
 * @param messages - The conversation messages to summarize
 * @param toProvider - The target provider (used for context limits)
 * @param options - Summarization options
 * @returns SummarizationResult with summarized messages
 */
export async function summarizeContext(
  messages: UnifiedMessage[],
  _toProvider: ProviderId,
  options: Partial<SummarizationOptions> = {}
): Promise<SummarizationResult> {
  const config = { ...DEFAULT_SUMMARIZATION_OPTIONS, ...options };
  const tokensBefore = estimateTokenCount(messages);

  // If already under limit, return unchanged
  if (tokensBefore <= config.targetTokens) {
    return {
      messages,
      originalCount: messages.length,
      summarizedCount: messages.length,
      tokensBefore,
      tokensAfter: tokensBefore,
      summaryText: '',
    };
  }

  // Try simple summarization first
  let { summary, preserved } = simpleSummarize(messages, config);
  let newMessages = [summary, ...preserved];
  let tokensAfter = estimateTokenCount(newMessages);

  // If still over limit, use aggressive summarization
  if (tokensAfter > config.targetTokens) {
    ({ summary, preserved } = aggressiveSummarize(messages, config.targetTokens));
    newMessages = [summary, ...preserved];
    tokensAfter = estimateTokenCount(newMessages);
  }

  // Final fallback: just keep the last few messages
  if (tokensAfter > config.targetTokens) {
    const lastMessages = messages.slice(-3);
    newMessages = [
      {
        role: 'system',
        content: `[Prior conversation of ${messages.length - 3} messages truncated due to length]`,
        metadata: { isSummary: true, truncated: true },
      },
      ...lastMessages,
    ];
    tokensAfter = estimateTokenCount(newMessages);
  }

  return {
    messages: newMessages,
    originalCount: messages.length,
    summarizedCount: newMessages.length,
    tokensBefore,
    tokensAfter,
    summaryText: typeof summary.content === 'string' ? summary.content : '',
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if a message is a summary message
 */
export function isSummaryMessage(msg: UnifiedMessage): boolean {
  return msg.metadata?.isSummary === true;
}

/**
 * Get compression ratio achieved
 */
export function getCompressionRatio(result: SummarizationResult): number {
  if (result.tokensBefore === 0) return 1;
  return result.tokensAfter / result.tokensBefore;
}
