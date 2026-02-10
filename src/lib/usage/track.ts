/**
 * CENTRALIZED TOKEN USAGE TRACKING
 *
 * Tracks token usage and costs to the `usage_tracking` table for all routes.
 * Used by: main chat, Code Lab, strategy agents, and any future routes.
 *
 * The admin earnings dashboard reads from this table for billing and analytics.
 */

import { createServerClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

const log = logger('usage-tracking');

// Model pricing (per 1M tokens, in USD)
// Keep in sync with provider registry and Anthropic pricing
const MODEL_PRICING: Record<
  string,
  { input: number; output: number; cacheRead?: number; cacheWrite?: number }
> = {
  // Claude Opus 4.6
  'claude-opus-4-6-20260205': {
    input: 5.0,
    output: 25.0,
    cacheRead: 0.5,
    cacheWrite: 6.25,
  },
  // Claude Sonnet 4.5
  'claude-sonnet-4-5-20250929': {
    input: 3.0,
    output: 15.0,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  // Claude Sonnet 4 (older)
  'claude-sonnet-4-20250514': {
    input: 3.0,
    output: 15.0,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  // Claude Haiku 4.5
  'claude-haiku-4-5-20251001': {
    input: 0.8,
    output: 4.0,
    cacheRead: 0.08,
    cacheWrite: 1.0,
  },
  'claude-haiku-4-5-20251101': {
    input: 0.8,
    output: 4.0,
    cacheRead: 0.08,
    cacheWrite: 1.0,
  },
  // OpenAI GPT-5.2
  'gpt-5.2': {
    input: 5.0,
    output: 15.0,
  },
  // Deepseek
  'deepseek-chat': {
    input: 0.2,
    output: 0.5,
  },
  'deepseek-reasoner': {
    input: 0.2,
    output: 1.5,
  },
};

export interface UsageRecord {
  userId: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  liveSearchCalls?: number;
  source?: string; // 'chat', 'code-lab', 'strategy', etc.
  conversationId?: string;
}

/**
 * Calculate cost for a given model and token counts.
 * Returns cost in USD.
 */
export function calculateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens?: number
): number {
  const pricing = MODEL_PRICING[modelName];

  if (!pricing) {
    log.warn('Unknown model for pricing, using Sonnet defaults', { modelName });
    // Default to Sonnet pricing as conservative estimate
    return (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0;
  }

  let cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;

  // Cached input tokens are cheaper than regular input tokens
  if (cachedInputTokens && cachedInputTokens > 0 && pricing.cacheRead) {
    // Subtract full-price input for cached tokens, add discounted cache-read price
    cost -= (cachedInputTokens / 1_000_000) * pricing.input;
    cost += (cachedInputTokens / 1_000_000) * pricing.cacheRead;
  }

  return Math.max(0, cost);
}

/**
 * Track token usage to the usage_tracking table.
 * Fire-and-forget — does not throw on failure.
 */
export async function trackTokenUsage(record: UsageRecord): Promise<void> {
  // Skip if no tokens to track
  if (record.inputTokens === 0 && record.outputTokens === 0) {
    return;
  }

  try {
    const cost = calculateCost(
      record.modelName,
      record.inputTokens,
      record.outputTokens,
      record.cachedInputTokens
    );

    const supabase = createServerClient();

    const { error } = await supabase.from('usage_tracking').insert({
      user_id: record.userId,
      model_name: record.modelName,
      input_tokens: record.inputTokens,
      cached_input_tokens: record.cachedInputTokens || 0,
      output_tokens: record.outputTokens,
      live_search_calls: record.liveSearchCalls || 0,
      total_cost: cost,
    });

    if (error) {
      log.warn('Failed to track usage', { error: error.message, userId: record.userId.substring(0, 8) });
    } else {
      log.debug('Usage tracked', {
        userId: record.userId.substring(0, 8),
        model: record.modelName,
        input: record.inputTokens,
        output: record.outputTokens,
        cached: record.cachedInputTokens || 0,
        cost: cost.toFixed(6),
        source: record.source,
      });
    }
  } catch (err) {
    log.warn('Usage tracking error', { error: (err as Error).message });
  }
}
