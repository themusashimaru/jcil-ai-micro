/**
 * PROVIDER SETTINGS HELPER
 *
 * PURPOSE:
 * - Fetch current provider settings from database
 * - Cache settings for performance
 * - Provide type-safe access to provider configuration
 */

import { createClient } from '@supabase/supabase-js';

export type Provider = 'openai' | 'anthropic' | 'xai' | 'deepseek' | 'gemini';

export interface ProviderConfig {
  model: string;
  reasoningModel?: string; // DeepSeek only
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

// Default settings (used when database is not available or no settings exist)
const DEFAULT_SETTINGS: ProviderSettings = {
  activeProvider: 'openai',
  providerConfig: {
    openai: { model: 'gpt-5-mini' },
    anthropic: { model: 'claude-sonnet-4-5-20250929' },
    xai: { model: 'grok-3-mini' },
    deepseek: { model: 'deepseek-chat', reasoningModel: 'deepseek-reasoner' },
    gemini: { model: 'gemini-2.0-flash', imageModel: 'gemini-2.0-flash-exp-image-generation' },
  },
};

// Simple cache to avoid repeated database calls
let cachedSettings: ProviderSettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30000; // 30 seconds cache

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
 * Get current provider settings
 * Returns cached settings if still valid, otherwise fetches from database
 */
export async function getProviderSettings(): Promise<ProviderSettings> {
  // Check cache first
  if (cachedSettings && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    console.log('[Provider] No Supabase admin client, using defaults');
    return DEFAULT_SETTINGS;
  }

  try {
    const { data, error } = await supabase
      .from('provider_settings')
      .select('*')
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // Not "no rows found"
        console.error('[Provider] Error fetching settings:', error);
      }
      return DEFAULT_SETTINGS;
    }

    // Parse and validate settings
    const activeProvider: Provider =
      data.active_provider === 'anthropic' ? 'anthropic' :
      data.active_provider === 'xai' ? 'xai' :
      data.active_provider === 'deepseek' ? 'deepseek' :
      data.active_provider === 'gemini' ? 'gemini' : 'openai';

    const settings: ProviderSettings = {
      activeProvider,
      providerConfig: {
        openai: data.provider_config?.openai || DEFAULT_SETTINGS.providerConfig.openai,
        anthropic: data.provider_config?.anthropic || DEFAULT_SETTINGS.providerConfig.anthropic,
        xai: data.provider_config?.xai || DEFAULT_SETTINGS.providerConfig.xai,
        deepseek: data.provider_config?.deepseek || DEFAULT_SETTINGS.providerConfig.deepseek,
        gemini: data.provider_config?.gemini || DEFAULT_SETTINGS.providerConfig.gemini,
      },
    };

    // Update cache
    cachedSettings = settings;
    cacheTimestamp = Date.now();

    return settings;
  } catch (error) {
    console.error('[Provider] Unexpected error:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Clear the settings cache (call after updating settings)
 */
export function clearProviderSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}

/**
 * Get the active provider
 */
export async function getActiveProvider(): Promise<Provider> {
  const settings = await getProviderSettings();
  return settings.activeProvider;
}

/**
 * Get the model for the active provider
 */
export async function getActiveModel(): Promise<string> {
  const settings = await getProviderSettings();
  return settings.providerConfig[settings.activeProvider].model;
}

/**
 * Get the reasoning model for DeepSeek
 * Returns the reasoning model if available, falls back to 'deepseek-reasoner'
 */
export async function getDeepSeekReasoningModel(): Promise<string> {
  const settings = await getProviderSettings();
  return settings.providerConfig.deepseek.reasoningModel || 'deepseek-reasoner';
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
 * Premium users get the best model, free users get a lighter model
 */
export async function getModelForTier(_tier: string, provider?: Provider): Promise<string> {
  const settings = await getProviderSettings();
  const activeProvider = provider || settings.activeProvider;

  // For now, all tiers use the same model from settings
  // This can be expanded to use different models per tier
  return settings.providerConfig[activeProvider].model;
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
 * Get the Code Command model from database
 * Falls back to claude-opus if not configured
 */
export async function getCodeCommandModel(): Promise<string> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return 'claude-opus-4-5-20251101';
  }

  try {
    const { data } = await supabase
      .from('provider_settings')
      .select('code_command_model')
      .single();

    return data?.code_command_model || 'claude-opus-4-5-20251101';
  } catch {
    return 'claude-opus-4-5-20251101';
  }
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
 * Returns the image model if available, falls back to default
 */
export async function getGeminiImageModel(): Promise<string> {
  const settings = await getProviderSettings();
  return settings.providerConfig.gemini.imageModel || 'gemini-2.0-flash-exp-image-generation';
}
