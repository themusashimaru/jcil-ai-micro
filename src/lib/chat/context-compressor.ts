/**
 * AI-POWERED CONTEXT COMPRESSION
 *
 * Intelligently compresses conversation history to fit within context windows
 * while preserving important information. Uses Haiku for fast, cheap summarization.
 *
 * Benefits:
 * - Maintains longer effective context than simple truncation
 * - Preserves key decisions, code snippets, and action items
 * - Cost-effective: ~$0.0004 per compression
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('ContextCompressor');

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Maximum messages before considering compression */
const COMPRESSION_THRESHOLD = 15;

/** Number of recent messages to always keep uncompressed */
const KEEP_RECENT_COUNT = 5;

/** Maximum tokens for the summary */
const SUMMARY_MAX_TOKENS = 500;

/** Model to use for summarization (Haiku = cheap & fast) */
const SUMMARIZATION_MODEL = 'claude-haiku-4-5-20251001';

// ============================================================================
// TYPES
// ============================================================================

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CompressedContext {
  /** Summary of older messages */
  summary: string;
  /** Recent messages kept in full */
  recentMessages: Message[];
  /** Stats about the compression */
  stats: {
    originalCount: number;
    summarizedCount: number;
    keptCount: number;
    estimatedTokensSaved: number;
  };
}

export interface CompressionOptions {
  /** Threshold before compression (default: 15) */
  threshold?: number;
  /** Recent messages to keep (default: 5) */
  keepRecent?: number;
  /** Custom Anthropic client */
  client?: Anthropic;
  /** Skip AI summarization, use basic extraction */
  useBasicFallback?: boolean;
}

// ============================================================================
// SUMMARIZATION PROMPT
// ============================================================================

const SUMMARIZATION_PROMPT = `You are summarizing a conversation for context continuation.

Create a concise technical summary that captures:
1. Main topics and goals discussed
2. Key decisions made
3. Important code/technical details (language, framework, file names)
4. Current state of any tasks or projects
5. Open questions or next steps
6. Any user preferences or constraints mentioned

FORMAT:
- Use bullet points
- Be specific about names, technologies, and code patterns
- Keep it under 400 words
- Prioritize actionable information over pleasantries

Do NOT include:
- Greetings or small talk
- Redundant information
- Speculation about future conversations`;

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Compress conversation context if it exceeds the threshold
 * Returns original messages if no compression needed
 */
export async function compressContext(
  messages: Message[],
  options: CompressionOptions = {}
): Promise<Message[]> {
  const {
    threshold = COMPRESSION_THRESHOLD,
    keepRecent = KEEP_RECENT_COUNT,
    useBasicFallback = false,
  } = options;

  // No compression needed
  if (messages.length <= threshold) {
    return messages;
  }

  log.info('Compressing context', {
    messageCount: messages.length,
    threshold,
    keepRecent,
  });

  try {
    const compressed = useBasicFallback
      ? await basicCompress(messages, keepRecent)
      : await aiCompress(messages, keepRecent, options.client);

    // Build the compressed message array
    const result: Message[] = [];

    // Add summary as system message
    if (compressed.summary) {
      result.push({
        role: 'system',
        content: `[CONVERSATION CONTEXT - Summary of ${compressed.stats.summarizedCount} earlier messages]\n\n${compressed.summary}\n\n[END OF SUMMARY - Continue naturally from the recent messages below]`,
      });
    }

    // Add recent messages
    result.push(...compressed.recentMessages);

    log.info('Context compressed', {
      originalCount: compressed.stats.originalCount,
      newCount: result.length,
      tokensSaved: compressed.stats.estimatedTokensSaved,
    });

    return result;
  } catch (error) {
    log.error('Compression failed, using basic fallback', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    // Fallback to basic compression on error
    const basic = await basicCompress(messages, keepRecent);
    return [
      {
        role: 'system',
        content: `[Earlier conversation context]\n${basic.summary}\n[End of context]`,
      },
      ...basic.recentMessages,
    ];
  }
}

/**
 * AI-powered compression using Haiku
 */
async function aiCompress(
  messages: Message[],
  keepRecent: number,
  client?: Anthropic
): Promise<CompressedContext> {
  const anthropic = client || new Anthropic();

  // Split messages
  const toSummarize = messages.slice(0, -keepRecent);
  const toKeep = messages.slice(-keepRecent);

  // Build conversation text for summarization
  const conversationText = toSummarize
    .map((m) => {
      const role = m.role.toUpperCase();
      const content = m.content.length > 1000 ? m.content.substring(0, 1000) + '...' : m.content;
      return `${role}: ${content}`;
    })
    .join('\n\n');

  // Call Haiku for summarization
  const response = await anthropic.messages.create({
    model: SUMMARIZATION_MODEL,
    max_tokens: SUMMARY_MAX_TOKENS,
    system: SUMMARIZATION_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Summarize this conversation:\n\n${conversationText}`,
      },
    ],
  });

  // Extract summary text
  let summary = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      summary += block.text;
    }
  }

  // Estimate tokens saved (rough: 4 chars per token)
  const originalChars = toSummarize.reduce((sum, m) => sum + m.content.length, 0);
  const summaryChars = summary.length;
  const estimatedTokensSaved = Math.floor((originalChars - summaryChars) / 4);

  return {
    summary,
    recentMessages: toKeep,
    stats: {
      originalCount: messages.length,
      summarizedCount: toSummarize.length,
      keptCount: toKeep.length,
      estimatedTokensSaved: Math.max(0, estimatedTokensSaved),
    },
  };
}

/**
 * Basic compression without AI (fallback)
 * Extracts key points using simple heuristics
 */
async function basicCompress(messages: Message[], keepRecent: number): Promise<CompressedContext> {
  const toSummarize = messages.slice(0, -keepRecent);
  const toKeep = messages.slice(-keepRecent);

  // Extract key points using heuristics
  const keyPoints: string[] = [];

  for (const msg of toSummarize) {
    const content = msg.content;

    // Extract questions
    const questions = content.match(/[^.!?]*\?/g);
    if (questions) {
      keyPoints.push(...questions.slice(0, 2).map((q) => `Question: ${q.trim()}`));
    }

    // Extract code references
    const codeRefs = content.match(/`[^`]+`/g);
    if (codeRefs) {
      keyPoints.push(`Code mentioned: ${codeRefs.slice(0, 3).join(', ')}`);
    }

    // Extract file/path references
    const fileRefs = content.match(/[\w-]+\.(ts|js|tsx|jsx|py|json|md|css|html)/gi);
    if (fileRefs) {
      keyPoints.push(`Files: ${[...new Set(fileRefs)].slice(0, 5).join(', ')}`);
    }

    // Extract action items (sentences with "should", "need to", "will", etc.)
    const actionPattern = /[^.!?]*\b(should|need to|will|must|want to|going to)\b[^.!?]*[.!?]/gi;
    const actions = content.match(actionPattern);
    if (actions) {
      keyPoints.push(...actions.slice(0, 2).map((a) => `Action: ${a.trim()}`));
    }
  }

  // Deduplicate and limit
  const uniquePoints = [...new Set(keyPoints)].slice(0, 15);

  const summary =
    uniquePoints.length > 0
      ? `Key points from earlier conversation:\n${uniquePoints.map((p) => `• ${p}`).join('\n')}`
      : 'Earlier conversation covered general discussion.';

  // Estimate tokens saved
  const originalChars = toSummarize.reduce((sum, m) => sum + m.content.length, 0);
  const summaryChars = summary.length;
  const estimatedTokensSaved = Math.floor((originalChars - summaryChars) / 4);

  return {
    summary,
    recentMessages: toKeep,
    stats: {
      originalCount: messages.length,
      summarizedCount: toSummarize.length,
      keptCount: toKeep.length,
      estimatedTokensSaved: Math.max(0, estimatedTokensSaved),
    },
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if context needs compression
 */
export function needsCompression(
  messages: Message[],
  threshold: number = COMPRESSION_THRESHOLD
): boolean {
  return messages.length > threshold;
}

/**
 * Estimate token count for messages (rough: 4 chars per token)
 */
export function estimateTokens(messages: Message[]): number {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(totalChars / 4);
}

/**
 * Check if messages would exceed a token limit
 */
export function wouldExceedLimit(messages: Message[], maxTokens: number): boolean {
  return estimateTokens(messages) > maxTokens;
}
