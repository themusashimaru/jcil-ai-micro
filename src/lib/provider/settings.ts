/**
 * PROVIDER SETTINGS HELPER
 *
 * PURPOSE:
 * - Fetch current provider settings from database
 * - Cache settings for performance
 * - Provide type-safe access to provider configuration
 */

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// CLAUDE-EXCLUSIVE MODE
// All text generation uses Anthropic Claude (Haiku/Sonnet hybrid routing)
// =============================================================================

export type Provider = 'openai' | 'anthropic' | 'xai' | 'deepseek' | 'gemini';

export interface ProviderConfig {
  model: string;
  reasoningModel?: string;
  imageModel?: string;
}

export interface ProviderSettings {
  activeProvider: Provider;
  providerConfig: {
    openai: ProviderConfig;
    anthropic: ProviderConfig;
    xai: ProviderConfig;
    deepseek: ProviderConfig;
    gemini: ProviderConfig;
  };
}

// Claude models for different use cases
// Must match IDs in anthropic/client.ts
const CLAUDE_MODELS = {
  fast: 'claude-3-5-haiku-20241022',    // Quick responses, simple tasks
  smart: 'claude-3-5-sonnet-20241022',  // Complex reasoning, code
} as const;

// Default settings - Uses Claude for all text generation
const DEFAULT_SETTINGS: ProviderSettings = {
  activeProvider: 'anthropic', // CLAUDE-EXCLUSIVE
  providerConfig: {
    openai: { model: CLAUDE_MODELS.fast },
    anthropic: { model: CLAUDE_MODELS.fast },
    xai: { model: CLAUDE_MODELS.fast },
    deepseek: { model: CLAUDE_MODELS.fast },
    gemini: { model: CLAUDE_MODELS.fast },
  },
};

/**
 * Get Supabase admin client for reading settings
 * Used for Perplexity model lookup
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
 * Get current provider settings
 * Always returns Claude/Anthropic settings
 */
export async function getProviderSettings(): Promise<ProviderSettings> {
  return DEFAULT_SETTINGS;
}

/**
 * Clear the settings cache (call after updating settings)
 * No-op since settings are static
 */
export function clearProviderSettingsCache(): void {
  // No-op - settings are hardcoded to Anthropic
}

/**
 * Get the active provider
 * Always returns 'anthropic' - Claude exclusive
 */
export async function getActiveProvider(): Promise<Provider> {
  return 'anthropic'; // CLAUDE-EXCLUSIVE
}

/**
 * Get the model for the active provider
 * Returns Claude Haiku for quick tasks
 */
export async function getActiveModel(): Promise<string> {
  return CLAUDE_MODELS.fast; // Claude Haiku
}

/**
 * Get the reasoning model
 * Returns Claude Sonnet for complex reasoning
 */
export async function getDeepSeekReasoningModel(): Promise<string> {
  return CLAUDE_MODELS.smart; // Claude Sonnet for reasoning
}

/**
 * Check if a provider is configured (has necessary environment variables)
 */
export function isProviderConfigured(provider: Provider): boolean {
  if (provider === 'openai') {
    return !!process.env.OPENAI_API_KEY || !!process.env.OPENAI_API_KEY_1;
  }
  if (provider === 'anthropic') {
    return !!process.env.ANTHROPIC_API_KEY || !!process.env.ANTHROPIC_API_KEY_1;
  }
  if (provider === 'xai') {
    return !!process.env.XAI_API_KEY || !!process.env.XAI_API_KEY_1;
  }
  if (provider === 'deepseek') {
    return !!process.env.DEEPSEEK_API_KEY || !!process.env.DEEPSEEK_API_KEY_1;
  }
  if (provider === 'gemini') {
    return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY || !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_GENERATIVE_AI_API_KEY_1 || !!process.env.GEMINI_API_KEY_1;
  }
  return false;
}

/**
 * Get the model for a user tier
 * All tiers use Claude - Haiku for standard, Sonnet for complex
 */
export async function getModelForTier(_tier: string, _provider?: Provider): Promise<string> {
  return CLAUDE_MODELS.fast; // Claude Haiku for most tasks
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
    const { data } = await supabase
      .from('provider_settings')
      .select('perplexity_model')
      .single();

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
  return CLAUDE_MODELS.smart; // Claude Sonnet for code
}

/**
 * Get the Video model (Sora) from database
 * Falls back to sora-2-pro if not configured
 */
export async function getVideoModel(): Promise<string> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return 'sora-2-pro';
  }

  try {
    const { data } = await supabase
      .from('provider_settings')
      .select('video_model')
      .single();

    return data?.video_model || 'sora-2-pro';
  } catch {
    return 'sora-2-pro';
  }
}

/**
 * Get the image model
 * Returns empty string - image generation handled separately
 */
export async function getGeminiImageModel(): Promise<string> {
  return ''; // Image generation handled by dedicated image routes
}
