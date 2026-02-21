/**
 * PROVIDER SETTINGS HELPER
 *
 * PURPOSE:
 * - Provide type-safe access to provider configuration
 * - Claude-exclusive mode for all AI tasks
 * - Perplexity for web search/research
 */

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// CLAUDE + PERPLEXITY ONLY
// All text generation uses Anthropic Claude (Haiku/Sonnet hybrid routing)
// Web search uses Perplexity
// =============================================================================

export type Provider = 'anthropic';

// Claude models for different use cases
// Must match IDs in anthropic/client.ts
const CLAUDE_MODELS = {
  fast: 'claude-haiku-4-5-20251001', // Quick responses, simple tasks
  smart: 'claude-sonnet-4-6', // Complex reasoning, code
} as const;

/**
 * Get Supabase admin client for reading settings
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get the active provider - always Claude
 */
export async function getActiveProvider(): Promise<Provider> {
  return 'anthropic';
}

/**
 * Get the model for quick tasks
 * Returns Claude Haiku
 */
export async function getActiveModel(): Promise<string> {
  return CLAUDE_MODELS.fast;
}

/**
 * Get the reasoning model for complex tasks
 * Returns Claude Sonnet
 */
export async function getReasoningModel(): Promise<string> {
  return CLAUDE_MODELS.smart;
}

/**
 * Check if Anthropic is configured
 */
export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY || !!process.env.ANTHROPIC_API_KEY_1;
}

/**
 * Get the model for a user tier
 * All tiers use Claude - Haiku for standard, Sonnet for complex
 */
export async function getModelForTier(_tier: string): Promise<string> {
  return CLAUDE_MODELS.fast;
}

/**
 * Get the Perplexity model to use for search
 */
export async function getPerplexityModel(): Promise<string> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return 'sonar-pro';
  }

  try {
    const { data } = await supabase.from('provider_settings').select('perplexity_model').single();

    return data?.perplexity_model || 'sonar-pro';
  } catch {
    return 'sonar-pro';
  }
}

/**
 * Get the Code Command model
 * Returns Claude Sonnet for code tasks
 */
export async function getCodeCommandModel(): Promise<string> {
  return CLAUDE_MODELS.smart;
}

// Legacy exports for backwards compatibility
export const clearProviderSettingsCache = () => {};
export const getProviderSettings = async () => ({
  activeProvider: 'anthropic' as const,
  providerConfig: { anthropic: { model: CLAUDE_MODELS.fast } },
});
