/**
 * Context Compaction System
 *
 * Automatically summarizes older messages when context fills up.
 * Features:
 * - Auto-detect when context is 80% full
 * - Summarize older messages preserving key information
 * - Keep recent messages and important context intact
 * - Manual trigger via /compact command
 *
 * @version 1.0.0
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('context-compaction');

// Message for compaction
export interface CompactableMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  important?: boolean; // Marked as important, should be preserved
  toolUse?: boolean; // Contains tool use
}

// Compaction result
export interface CompactionResult {
  success: boolean;
  summary: string;
  originalMessageCount: number;
  compactedMessageCount: number;
  tokensSaved: number;
  preservedMessages: CompactableMessage[];
}

// Compaction settings
export interface CompactionSettings {
  autoCompact: boolean;
  threshold: number; // Percentage of context window (0-100)
  preserveRecentCount: number; // Number of recent messages to always keep
  maxSummaryTokens: number;
}

// Default settings
export const DEFAULT_COMPACTION_SETTINGS: CompactionSettings = {
  autoCompact: true,
  threshold: 80,
  preserveRecentCount: 10,
  maxSummaryTokens: 2000,
};

/**
 * Context Compaction Manager
 *
 * Manages context compaction for sessions.
 */
export class ContextCompactionManager {
  private anthropic: Anthropic;
  private sessionSettings: Map<string, CompactionSettings> = new Map();
  private compactionHistory: Map<string, CompactionResult[]> = new Map();

  constructor() {
    this.anthropic = new Anthropic();
    log.info('ContextCompactionManager initialized');
  }

  /**
   * Get settings for a session
   */
  getSettings(sessionId: string): CompactionSettings {
    return this.sessionSettings.get(sessionId) || { ...DEFAULT_COMPACTION_SETTINGS };
  }

  /**
   * Update settings for a session
   */
  setSettings(sessionId: string, settings: Partial<CompactionSettings>): void {
    const current = this.getSettings(sessionId);
    const updated = { ...current, ...settings };
    this.sessionSettings.set(sessionId, updated);
    log.info('Compaction settings updated', { sessionId, settings: updated });
  }

  /**
   * Check if compaction is needed based on context usage
   */
  shouldCompact(sessionId: string, contextUsagePercent: number): boolean {
    const settings = this.getSettings(sessionId);
    if (!settings.autoCompact) {
      return false;
    }
    return contextUsagePercent >= settings.threshold;
  }

  /**
   * Estimate token count for messages (rough approximation)
   */
  estimateTokens(messages: CompactableMessage[]): number {
    // Rough estimate: ~4 characters per token
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Compact messages by summarizing older ones
   */
  async compactMessages(
    sessionId: string,
    messages: CompactableMessage[],
    forceCompact: boolean = false
  ): Promise<CompactionResult> {
    const settings = this.getSettings(sessionId);

    // If not forcing and not enough messages, skip
    if (!forceCompact && messages.length <= settings.preserveRecentCount + 5) {
      return {
        success: false,
        summary: '',
        originalMessageCount: messages.length,
        compactedMessageCount: messages.length,
        tokensSaved: 0,
        preservedMessages: messages,
      };
    }

    try {
      // Separate messages to preserve and messages to summarize
      const preserveCount = settings.preserveRecentCount;
      const importantMessages = messages.filter((m) => m.important);
      const recentMessages = messages.slice(-preserveCount);
      const messagesToSummarize = messages.slice(0, -preserveCount).filter((m) => !m.important);

      // If nothing to summarize, return
      if (messagesToSummarize.length === 0) {
        return {
          success: true,
          summary: '',
          originalMessageCount: messages.length,
          compactedMessageCount: messages.length,
          tokensSaved: 0,
          preservedMessages: messages,
        };
      }

      // Generate summary using Claude
      const summary = await this.generateSummary(messagesToSummarize, settings.maxSummaryTokens);

      // Calculate tokens saved
      const originalTokens = this.estimateTokens(messagesToSummarize);
      const summaryTokens = Math.ceil(summary.length / 4);
      const tokensSaved = Math.max(0, originalTokens - summaryTokens);

      // Build result
      const result: CompactionResult = {
        success: true,
        summary,
        originalMessageCount: messages.length,
        compactedMessageCount: 1 + importantMessages.length + recentMessages.length,
        tokensSaved,
        preservedMessages: [
          // Summary as first message
          {
            role: 'assistant',
            content: `**[Conversation Summary]**\n\n${summary}\n\n---\n*Previous messages have been summarized to preserve context.*`,
            important: true,
          },
          ...importantMessages,
          ...recentMessages,
        ],
      };

      // Store in history
      const history = this.compactionHistory.get(sessionId) || [];
      history.push(result);
      this.compactionHistory.set(sessionId, history);

      log.info('Messages compacted', {
        sessionId,
        originalCount: messages.length,
        compactedCount: result.compactedMessageCount,
        tokensSaved,
      });

      return result;
    } catch (error) {
      log.error('Compaction failed', error as Error);
      return {
        success: false,
        summary: '',
        originalMessageCount: messages.length,
        compactedMessageCount: messages.length,
        tokensSaved: 0,
        preservedMessages: messages,
      };
    }
  }

  /**
   * Generate a summary of messages using Claude
   */
  private async generateSummary(
    messages: CompactableMessage[],
    maxTokens: number
  ): Promise<string> {
    // Format messages for summarization
    const conversationText = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Use Haiku for fast, cheap summaries
      max_tokens: maxTokens,
      system: `You are a conversation summarizer. Create a concise but comprehensive summary of the conversation.
Preserve:
- Key decisions made
- Important code changes or technical details
- User requirements and preferences
- Any errors encountered and how they were resolved
- Current state of the task

Be concise but don't lose important context. Format with bullet points for clarity.`,
      messages: [
        {
          role: 'user',
          content: `Summarize this conversation:\n\n${conversationText}`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    return textContent?.type === 'text' ? textContent.text : 'Summary unavailable.';
  }

  /**
   * Get compaction history for a session
   */
  getHistory(sessionId: string): CompactionResult[] {
    return this.compactionHistory.get(sessionId) || [];
  }

  /**
   * Clear session data
   */
  clearSession(sessionId: string): void {
    this.sessionSettings.delete(sessionId);
    this.compactionHistory.delete(sessionId);
    log.info('Session cleared', { sessionId });
  }
}

// Singleton instance
let compactionManager: ContextCompactionManager | null = null;

export function getContextCompactionManager(): ContextCompactionManager {
  if (!compactionManager) {
    compactionManager = new ContextCompactionManager();
  }
  return compactionManager;
}

/**
 * Context compaction tools for the workspace agent
 */
export function getContextCompactionTools() {
  return [
    {
      name: 'context_compact',
      description: 'Summarize older messages to free up context window space',
      input_schema: {
        type: 'object' as const,
        properties: {
          force: {
            type: 'boolean',
            description: 'Force compaction even if threshold not reached',
          },
        },
        required: [],
      },
    },
    {
      name: 'context_settings',
      description: 'Get or update context compaction settings',
      input_schema: {
        type: 'object' as const,
        properties: {
          autoCompact: {
            type: 'boolean',
            description: 'Enable/disable auto-compaction',
          },
          threshold: {
            type: 'number',
            description: 'Context usage threshold for auto-compaction (0-100)',
          },
          preserveRecentCount: {
            type: 'number',
            description: 'Number of recent messages to always preserve',
          },
        },
        required: [],
      },
    },
  ];
}

/**
 * Check if a tool name is a context compaction tool
 */
export function isContextCompactionTool(toolName: string): boolean {
  return ['context_compact', 'context_settings'].includes(toolName);
}
