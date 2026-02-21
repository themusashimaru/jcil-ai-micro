/**
 * Token & Cost Tracking System
 *
 * Tracks token usage and calculates costs for AI interactions.
 * Features:
 * - Real-time token counting
 * - Cost estimation per model
 * - Session totals
 * - Context window usage indicator
 *
 * @version 1.0.0
 */

import { logger } from '@/lib/logger';

const log = logger('token-tracker');

// Token usage for a single message/interaction
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  timestamp: number;
}

// Cost breakdown
export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cacheCost: number;
  totalCost: number;
  currency: string;
}

// Session statistics
export interface SessionStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalCost: CostBreakdown;
  messageCount: number;
  startedAt: number;
  contextUsagePercent: number;
}

// Model pricing (per 1K tokens, in USD cents)
interface ModelPricing {
  inputPer1k: number;
  outputPer1k: number;
  cacheReadPer1k?: number;
  cacheWritePer1k?: number;
  contextWindow: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-6': {
    inputPer1k: 0.3,
    outputPer1k: 1.5,
    cacheReadPer1k: 0.03,
    cacheWritePer1k: 0.375,
    contextWindow: 200000,
  },
  'claude-opus-4-6': {
    inputPer1k: 1.5,
    outputPer1k: 7.5,
    cacheReadPer1k: 0.15,
    cacheWritePer1k: 1.875,
    contextWindow: 200000,
  },
  'claude-haiku-4-5-20251001': {
    inputPer1k: 0.08,
    outputPer1k: 0.4,
    cacheReadPer1k: 0.008,
    cacheWritePer1k: 0.1,
    contextWindow: 200000,
  },
};

/**
 * Token Tracker
 *
 * Tracks token usage and costs for a session.
 */
export class TokenTracker {
  private sessionId: string;
  private modelId: string;
  private usageHistory: TokenUsage[] = [];
  private startedAt: number;

  constructor(sessionId: string, modelId: string = 'claude-sonnet-4-6') {
    this.sessionId = sessionId;
    this.modelId = modelId;
    this.startedAt = Date.now();
    log.info('TokenTracker initialized', { sessionId, modelId });
  }

  /**
   * Set the current model
   */
  setModel(modelId: string): void {
    this.modelId = modelId;
    log.info('Model updated', { modelId });
  }

  /**
   * Record token usage for an interaction
   */
  recordUsage(usage: Omit<TokenUsage, 'timestamp'>): void {
    const record: TokenUsage = {
      ...usage,
      timestamp: Date.now(),
    };
    this.usageHistory.push(record);
    log.debug('Token usage recorded', { usage: record });
  }

  /**
   * Get the last recorded usage
   */
  getLastUsage(): TokenUsage | undefined {
    return this.usageHistory[this.usageHistory.length - 1];
  }

  /**
   * Calculate cost for token usage
   */
  calculateCost(usage: TokenUsage, modelId?: string): CostBreakdown {
    const model = modelId || this.modelId;
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-sonnet-4-6'];

    const inputCost = (usage.inputTokens / 1000) * pricing.inputPer1k;
    const outputCost = (usage.outputTokens / 1000) * pricing.outputPer1k;

    let cacheCost = 0;
    if (usage.cacheReadTokens && pricing.cacheReadPer1k) {
      cacheCost += (usage.cacheReadTokens / 1000) * pricing.cacheReadPer1k;
    }
    if (usage.cacheWriteTokens && pricing.cacheWritePer1k) {
      cacheCost += (usage.cacheWriteTokens / 1000) * pricing.cacheWritePer1k;
    }

    return {
      inputCost: Math.round(inputCost * 10000) / 10000, // 4 decimal places
      outputCost: Math.round(outputCost * 10000) / 10000,
      cacheCost: Math.round(cacheCost * 10000) / 10000,
      totalCost: Math.round((inputCost + outputCost + cacheCost) * 10000) / 10000,
      currency: 'USD',
    };
  }

  /**
   * Get session statistics
   */
  getSessionStats(): SessionStats {
    const totals = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
    };

    for (const usage of this.usageHistory) {
      totals.totalInputTokens += usage.inputTokens;
      totals.totalOutputTokens += usage.outputTokens;
      totals.totalCacheReadTokens += usage.cacheReadTokens || 0;
      totals.totalCacheWriteTokens += usage.cacheWriteTokens || 0;
    }

    // Calculate total cost
    const totalCost = this.calculateCost({
      inputTokens: totals.totalInputTokens,
      outputTokens: totals.totalOutputTokens,
      cacheReadTokens: totals.totalCacheReadTokens,
      cacheWriteTokens: totals.totalCacheWriteTokens,
      timestamp: Date.now(),
    });

    // Calculate context usage
    const pricing = MODEL_PRICING[this.modelId] || MODEL_PRICING['claude-sonnet-4-6'];
    const totalTokensInContext = totals.totalInputTokens + totals.totalOutputTokens;
    const contextUsagePercent = Math.min(100, (totalTokensInContext / pricing.contextWindow) * 100);

    return {
      ...totals,
      totalCost,
      messageCount: this.usageHistory.length,
      startedAt: this.startedAt,
      contextUsagePercent: Math.round(contextUsagePercent * 10) / 10,
    };
  }

  /**
   * Get context window information
   */
  getContextInfo(): {
    used: number;
    total: number;
    percentUsed: number;
    remaining: number;
  } {
    const stats = this.getSessionStats();
    const pricing = MODEL_PRICING[this.modelId] || MODEL_PRICING['claude-sonnet-4-6'];
    const used = stats.totalInputTokens + stats.totalOutputTokens;

    return {
      used,
      total: pricing.contextWindow,
      percentUsed: stats.contextUsagePercent,
      remaining: pricing.contextWindow - used,
    };
  }

  /**
   * Format cost for display
   */
  static formatCost(cost: number): string {
    if (cost < 0.01) {
      return `$${(cost * 100).toFixed(2)}¢`;
    }
    return `$${cost.toFixed(4)}`;
  }

  /**
   * Format tokens for display
   */
  static formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  }

  /**
   * Get usage history
   */
  getHistory(): TokenUsage[] {
    return [...this.usageHistory];
  }

  /**
   * Clear usage history (for session reset)
   */
  clearHistory(): void {
    this.usageHistory = [];
    this.startedAt = Date.now();
    log.info('Token history cleared', { sessionId: this.sessionId });
  }

  /**
   * Export session data
   */
  exportSession(): {
    sessionId: string;
    modelId: string;
    stats: SessionStats;
    history: TokenUsage[];
  } {
    return {
      sessionId: this.sessionId,
      modelId: this.modelId,
      stats: this.getSessionStats(),
      history: this.usageHistory,
    };
  }
}

// Session tracker instances
const trackers: Map<string, TokenTracker> = new Map();

/**
 * Get or create a token tracker for a session
 */
export function getTokenTracker(sessionId: string, modelId?: string): TokenTracker {
  let tracker = trackers.get(sessionId);
  if (!tracker) {
    tracker = new TokenTracker(sessionId, modelId);
    trackers.set(sessionId, tracker);
  } else if (modelId) {
    tracker.setModel(modelId);
  }
  return tracker;
}

/**
 * Remove a session tracker
 */
export function removeTokenTracker(sessionId: string): void {
  trackers.delete(sessionId);
}

/**
 * Token tracking tools for the workspace agent
 */
export function getTokenTrackingTools() {
  return [
    {
      name: 'tokens_usage',
      description: 'Get current token usage and cost information for this session',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'tokens_context',
      description: 'Get context window usage information',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ];
}

/**
 * Execute a token tracking tool
 */
export function executeTokenTrackingTool(
  toolName: string,
  _input: Record<string, unknown>,
  sessionId: string
): string {
  const tracker = getTokenTracker(sessionId);

  switch (toolName) {
    case 'tokens_usage': {
      const stats = tracker.getSessionStats();
      const lines = [
        '**Session Token Usage**',
        '',
        `Input Tokens: ${TokenTracker.formatTokens(stats.totalInputTokens)}`,
        `Output Tokens: ${TokenTracker.formatTokens(stats.totalOutputTokens)}`,
        `Cache Read: ${TokenTracker.formatTokens(stats.totalCacheReadTokens)}`,
        `Cache Write: ${TokenTracker.formatTokens(stats.totalCacheWriteTokens)}`,
        '',
        '**Estimated Cost**',
        `Input: ${TokenTracker.formatCost(stats.totalCost.inputCost)}`,
        `Output: ${TokenTracker.formatCost(stats.totalCost.outputCost)}`,
        `Cache: ${TokenTracker.formatCost(stats.totalCost.cacheCost)}`,
        `**Total: ${TokenTracker.formatCost(stats.totalCost.totalCost)}**`,
        '',
        `Messages: ${stats.messageCount}`,
        `Context Usage: ${stats.contextUsagePercent}%`,
      ];
      return lines.join('\n');
    }

    case 'tokens_context': {
      const context = tracker.getContextInfo();
      const bars = Math.round(context.percentUsed / 5);
      const progressBar = '█'.repeat(bars) + '░'.repeat(20 - bars);

      const lines = [
        '**Context Window**',
        '',
        `[${progressBar}] ${context.percentUsed}%`,
        '',
        `Used: ${TokenTracker.formatTokens(context.used)}`,
        `Total: ${TokenTracker.formatTokens(context.total)}`,
        `Remaining: ${TokenTracker.formatTokens(context.remaining)}`,
      ];

      if (context.percentUsed > 80) {
        lines.push('');
        lines.push('⚠️ Context is getting full. Consider using /compact to summarize.');
      }

      return lines.join('\n');
    }

    default:
      return `Unknown token tracking tool: ${toolName}`;
  }
}

/**
 * Check if a tool name is a token tracking tool
 */
export function isTokenTrackingTool(toolName: string): boolean {
  return ['tokens_usage', 'tokens_context'].includes(toolName);
}
