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
// PHASE 1: GOOGLE-ONLY MODE
// All providers are locked to Gemini. Other providers kept for backwards compat
// but are never used. This simplifies the codebase significantly.
// =============================================================================

export type Provider = 'openai' | 'anthropic' | 'xai' | 'deepseek' | 'gemini';

export interface ProviderConfig {
  model: string;
  reasoningModel?: string; // Legacy - not used
  imageModel?: string; // Gemini only - Nano Banana image generation
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

// LOCKED TO GOOGLE - These are the ONLY models used
const GOOGLE_MODELS = {
  text: 'gemini-3-pro-preview',        // All text/chat/code
  image: 'gemini-3-pro-image-preview', // Nano Banana for images
} as const;

// Default settings - ALWAYS uses Gemini regardless of database
const DEFAULT_SETTINGS: ProviderSettings = {
  activeProvider: 'gemini', // LOCKED
  providerConfig: {
    openai: { model: GOOGLE_MODELS.text },      // Redirects to Gemini
    anthropic: { model: GOOGLE_MODELS.text },   // Redirects to Gemini
    xai: { model: GOOGLE_MODELS.text },         // Redirects to Gemini
    deepseek: { model: GOOGLE_MODELS.text },    // Redirects to Gemini
    gemini: { model: GOOGLE_MODELS.text, imageModel: GOOGLE_MODELS.image },
  },
};

/**
 * Get Supabase admin client for reading settings
 * PHASE 1: Only used for Perplexity model lookup
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
 * PHASE 1: Always returns Google-locked settings - ignores database
 */
export async function getProviderSettings(): Promise<ProviderSettings> {
  // PHASE 1: Always return Google-locked settings
  // Database settings are IGNORED - everything goes through Gemini
  return DEFAULT_SETTINGS;
}

/**
 * Clear the settings cache (call after updating settings)
 * PHASE 1: No-op since we don't cache anymore
 */
export function clearProviderSettingsCache(): void {
  // No-op in PHASE 1 - settings are hardcoded to Google
}

/**
 * Get the active provider
 * PHASE 1: Always returns 'gemini' - locked to Google
 */
export async function getActiveProvider(): Promise<Provider> {
  return 'gemini'; // LOCKED TO GOOGLE
}

/**
 * Get the model for the active provider
 * PHASE 1: Always returns Gemini model - locked to Google
 */
export async function getActiveModel(): Promise<string> {
  return GOOGLE_MODELS.text; // LOCKED TO GOOGLE
}

/**
 * Get the reasoning model
 * PHASE 1: Returns Gemini - no DeepSeek reasoning
 */
export async function getDeepSeekReasoningModel(): Promise<string> {
  return GOOGLE_MODELS.text; // LOCKED TO GOOGLE - use Gemini for reasoning too
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
 * PHASE 1: All tiers use Gemini - locked to Google
 */
export async function getModelForTier(_tier: string, _provider?: Provider): Promise<string> {
  return GOOGLE_MODELS.text; // LOCKED TO GOOGLE - all tiers use same model
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
 * PHASE 1: Returns Gemini - locked to Google
 */
export async function getCodeCommandModel(): Promise<string> {
  return GOOGLE_MODELS.text; // LOCKED TO GOOGLE
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
 * Get the Gemini image model (Nano Banana)
 * PHASE 1: Always returns the locked image model
 */
export async function getGeminiImageModel(): Promise<string> {
  return GOOGLE_MODELS.image; // LOCKED TO GOOGLE - Nano Banana
}
