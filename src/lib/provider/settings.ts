/**
 * PROVIDER SETTINGS HELPER
 *
 * PURPOSE:
 * - Fetch current provider settings from database
 * - Cache settings for performance
 * - Provide type-safe access to provider configuration
 */

import { createClient } from '@supabase/supabase-js';

export type Provider = 'openai' | 'anthropic';
export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'executive';

export interface TierModels {
  basic: string;
  pro: string;
  executive: string;
}

export interface ProviderConfig {
  model: string; // Legacy/default model (used as fallback)
  models?: TierModels; // Per-tier model configuration
  imageModel?: string; // For OpenAI only - DALL-E model
}

export interface ProviderSettings {
  activeProvider: Provider;
  providerConfig: {
    openai: ProviderConfig;
    anthropic: ProviderConfig;
  };
  codeCommandModel?: string; // Model for Code Command (admin coding assistant)
  perplexityModel?: string; // Model for Perplexity searches (sonar, sonar-pro)
}

// Default Code Command model (admin coding assistant)
const DEFAULT_CODE_COMMAND_MODEL = 'claude-opus-4-5-20251101';

// Default Perplexity model (sonar-pro for better quality)
const DEFAULT_PERPLEXITY_MODEL = 'sonar-pro';

// Default settings (used when database is not available or no settings exist)
const DEFAULT_SETTINGS: ProviderSettings = {
  activeProvider: 'openai',
  providerConfig: {
    openai: {
      model: 'gpt-4o-mini', // Legacy fallback
      models: {
        basic: 'gpt-4o-mini',
        pro: 'gpt-4o',
        executive: 'gpt-4o',
      },
      imageModel: 'dall-e-3',
    },
    anthropic: {
      model: 'claude-sonnet-4-5-20250929', // Legacy fallback
      models: {
        basic: 'claude-3-5-haiku-20241022',
        pro: 'claude-sonnet-4-5-20250929',
        executive: 'claude-sonnet-4-5-20250929',
      },
    },
  },
  codeCommandModel: DEFAULT_CODE_COMMAND_MODEL,
  perplexityModel: DEFAULT_PERPLEXITY_MODEL,
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
    const settings: ProviderSettings = {
      activeProvider: data.active_provider === 'anthropic' ? 'anthropic' : 'openai',
      providerConfig: {
        openai: data.provider_config?.openai || DEFAULT_SETTINGS.providerConfig.openai,
        anthropic: data.provider_config?.anthropic || DEFAULT_SETTINGS.providerConfig.anthropic,
      },
      codeCommandModel: data.code_command_model || DEFAULT_CODE_COMMAND_MODEL,
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
 * Check if a provider is configured (has necessary environment variables)
 */
export function isProviderConfigured(provider: Provider): boolean {
  if (provider === 'openai') {
    return !!process.env.OPENAI_API_KEY;
  }
  if (provider === 'anthropic') {
    return !!process.env.ANTHROPIC_API_KEY;
  }
  return false;
}

/**
 * Get the model for a specific subscription tier
 * Falls back to the default model if tier-specific model is not configured
 */
export async function getModelForTier(tier: string): Promise<string> {
  const settings = await getProviderSettings();
  const provider = settings.activeProvider;
  const config = settings.providerConfig[provider];

  // Map tier to our tier keys (handle 'free' as 'basic')
  const tierKey = tier === 'free' ? 'basic' : tier as keyof TierModels;

  // Try to get tier-specific model, fall back to default model
  if (config.models && config.models[tierKey]) {
    return config.models[tierKey];
  }

  return config.model;
}

/**
 * Get the image model (for OpenAI only)
 * Returns null if image generation is not available
 */
export async function getImageModel(): Promise<string | null> {
  const settings = await getProviderSettings();

  // Image generation only available with OpenAI
  if (settings.activeProvider !== 'openai') {
    return null;
  }

  return settings.providerConfig.openai.imageModel || 'dall-e-3';
}

/**
 * Check if image generation is available with current provider
 */
export async function isImageGenerationAvailable(): Promise<boolean> {
  const settings = await getProviderSettings();
  return settings.activeProvider === 'openai';
}

/**
 * Get the Code Command model (for admin coding assistant)
 * Returns the configured model or default (Claude Opus 4)
 */
export async function getCodeCommandModel(): Promise<string> {
  const settings = await getProviderSettings();
  return settings.codeCommandModel || DEFAULT_CODE_COMMAND_MODEL;
}

/**
 * Get the Perplexity model (for web search and fact checking)
 * Returns the configured model or default (sonar-pro)
 */
export async function getPerplexityModel(): Promise<string> {
  const settings = await getProviderSettings();
  return settings.perplexityModel || DEFAULT_PERPLEXITY_MODEL;
}
