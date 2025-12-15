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

export interface ProviderConfig {
  model: string;
}

export interface ProviderSettings {
  activeProvider: Provider;
  providerConfig: {
    openai: ProviderConfig;
    anthropic: ProviderConfig;
  };
}

// Default settings (used when database is not available or no settings exist)
const DEFAULT_SETTINGS: ProviderSettings = {
  activeProvider: 'openai',
  providerConfig: {
    openai: { model: 'gpt-5-mini' },
    anthropic: { model: 'claude-sonnet-4-5-20250929' },
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
    const settings: ProviderSettings = {
      activeProvider: data.active_provider === 'anthropic' ? 'anthropic' : 'openai',
      providerConfig: {
        openai: data.provider_config?.openai || DEFAULT_SETTINGS.providerConfig.openai,
        anthropic: data.provider_config?.anthropic || DEFAULT_SETTINGS.providerConfig.anthropic,
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
