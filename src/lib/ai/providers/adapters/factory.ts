/**
 * ADAPTER FACTORY
 *
 * Creates the appropriate adapter instance for a given provider.
 * Handles caching of adapter instances for reuse.
 */

import type { ProviderId, AIAdapter } from '../types';
import { createAnthropicAdapter } from './anthropic';
import { createOpenAIAdapter, createXAIAdapter, createDeepSeekAdapter } from './openai-compatible';

// ============================================================================
// ADAPTER CACHE
// ============================================================================

/**
 * Cached adapter instances by provider ID
 * This prevents creating multiple adapter instances for the same provider
 */
const adapterCache = new Map<ProviderId, AIAdapter>();

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create or retrieve an adapter for a given provider
 *
 * @param providerId - The provider to create an adapter for
 * @param forceNew - Force creation of a new adapter (bypass cache)
 * @returns An AIAdapter instance for the specified provider
 * @throws Error if the provider is not supported
 */
export function createAdapter(providerId: ProviderId, forceNew: boolean = false): AIAdapter {
  // Check cache first
  if (!forceNew) {
    const cached = adapterCache.get(providerId);
    if (cached) {
      return cached;
    }
  }

  // Create new adapter based on provider
  let adapter: AIAdapter;

  switch (providerId) {
    case 'claude':
      adapter = createAnthropicAdapter();
      break;

    case 'openai':
      adapter = createOpenAIAdapter();
      break;

    case 'xai':
      adapter = createXAIAdapter();
      break;

    case 'deepseek':
      adapter = createDeepSeekAdapter();
      break;

    default:
      throw new Error(`Unsupported provider: ${providerId}`);
  }

  // Cache the adapter
  adapterCache.set(providerId, adapter);

  return adapter;
}

/**
 * Get an adapter for a provider (alias for createAdapter)
 */
export function getAdapter(providerId: ProviderId): AIAdapter {
  return createAdapter(providerId, false);
}

/**
 * Clear the adapter cache
 * Useful for testing or when API keys change
 */
export function clearAdapterCache(): void {
  adapterCache.clear();
}

/**
 * Check if an adapter is cached for a provider
 */
export function hasAdapterCached(providerId: ProviderId): boolean {
  return adapterCache.has(providerId);
}

// ============================================================================
// PROVIDER TYPE DETECTION
// ============================================================================

/**
 * Determine if a provider uses the OpenAI-compatible API
 */
export function isOpenAICompatible(providerId: ProviderId): boolean {
  return providerId === 'openai' || providerId === 'xai' || providerId === 'deepseek';
}

/**
 * Determine if a provider uses the Anthropic API
 */
export function isAnthropicProvider(providerId: ProviderId): boolean {
  return providerId === 'claude';
}
