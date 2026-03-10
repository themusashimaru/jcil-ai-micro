/**
 * BYOK (Bring Your Own Key) Support for Code Lab Chat
 *
 * Handles retrieval and decryption of user-provided API keys
 * for multi-provider support (Claude, OpenAI, xAI, DeepSeek, Google).
 */

import { logger } from '@/lib/logger';
import { safeDecrypt as decryptToken } from '@/lib/security/crypto';

const log = logger('CodeLabChat:BYOK');

/**
 * Map provider IDs to the keys used in user_provider_preferences.provider_api_keys
 * Some providers have different naming in BYOK vs internal (e.g., 'google' vs 'gemini')
 */
export const BYOK_PROVIDER_MAP: Record<string, string> = {
  claude: 'claude',
  openai: 'openai',
  xai: 'xai',
  deepseek: 'deepseek',
  google: 'gemini', // Users configure 'gemini' in settings, but provider is 'google'
};

/**
 * BYOK configuration returned from user preferences
 */
export interface BYOKConfig {
  apiKey: string;
  model?: string; // Optional custom model name
}

/**
 * Get user's BYOK configuration for a provider (API key + optional custom model)
 * Returns null if not configured. Throws if key exists but decryption fails.
 */
export async function getUserBYOKConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  providerId: string
): Promise<BYOKConfig | null> {
  // Map provider ID to BYOK key name
  const byokKey = BYOK_PROVIDER_MAP[providerId];
  if (!byokKey) {
    return null; // Provider doesn't support BYOK
  }

  try {
    // Get user's provider preferences
    const { data: prefs } = await supabase
      .from('user_provider_preferences')
      .select('provider_api_keys')
      .eq('user_id', userId)
      .single();

    if (!prefs?.provider_api_keys) {
      return null;
    }

    const stored = prefs.provider_api_keys[byokKey];
    if (!stored) {
      return null;
    }

    // Handle both old format (string) and new format ({ key, model })
    let encryptedKey: string;
    let customModel: string | undefined;

    if (typeof stored === 'string') {
      // Old format: just the encrypted key
      encryptedKey = stored;
    } else if (stored && typeof stored === 'object' && stored.key) {
      // New format: { key, model }
      encryptedKey = stored.key;
      customModel = stored.model;
    } else {
      return null;
    }

    // Decrypt the key
    const decryptedKey = decryptToken(encryptedKey);
    if (!decryptedKey) {
      // CRITICAL: Do NOT return null — the caller would silently fall back
      // to the platform API key, meaning the user's key is ignored without notice.
      log.error('Failed to decrypt BYOK key — user has a key configured but decryption failed', {
        userId,
        provider: providerId,
      });
      throw new Error(
        `Your ${providerId} API key could not be decrypted. Please re-enter it in Settings → API Keys.`
      );
    }

    log.info('Using BYOK for provider', {
      userId,
      provider: providerId,
      hasCustomModel: !!customModel,
    });

    return {
      apiKey: decryptedKey,
      model: customModel,
    };
  } catch (error) {
    log.warn('Error fetching BYOK config', {
      userId,
      provider: providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
