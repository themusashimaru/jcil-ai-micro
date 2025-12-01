/**
 * XAI API KEY MANAGER
 *
 * Manages multiple xAI API keys for load distribution.
 * Users are permanently assigned to an API key index for consistency.
 *
 * Environment Variables:
 * - XAI_API_KEY (or XAI_API_KEY_1) - First key
 * - XAI_API_KEY_2 - Second key
 * - XAI_API_KEY_3 - Third key
 * ... up to XAI_API_KEY_N
 *
 * Benefits:
 * - Consistent API key per user (better for chat memory/context)
 * - Easy to add more keys (just add env vars)
 * - Round-robin assignment for new users
 * - Load distributed across all available keys
 */

interface ApiKeyInfo {
  index: number;
  key: string;
}

// Cache discovered keys (they don't change during runtime)
let cachedKeys: ApiKeyInfo[] | null = null;

/**
 * Discover all XAI API keys from environment variables
 * Looks for: XAI_API_KEY, XAI_API_KEY_1, XAI_API_KEY_2, ... XAI_API_KEY_N
 */
export function discoverApiKeys(): ApiKeyInfo[] {
  if (cachedKeys !== null) {
    return cachedKeys;
  }

  const keys: ApiKeyInfo[] = [];

  // Check for XAI_API_KEY (treated as index 1)
  if (process.env.XAI_API_KEY) {
    keys.push({ index: 1, key: process.env.XAI_API_KEY });
  }

  // Check for XAI_API_KEY_1 (if XAI_API_KEY wasn't set, or as explicit index 1)
  if (process.env.XAI_API_KEY_1 && !keys.find(k => k.index === 1)) {
    keys.push({ index: 1, key: process.env.XAI_API_KEY_1 });
  }

  // Check for XAI_API_KEY_2 through XAI_API_KEY_100
  for (let i = 2; i <= 100; i++) {
    const envKey = `XAI_API_KEY_${i}`;
    const value = process.env[envKey];
    if (value) {
      keys.push({ index: i, key: value });
    }
  }

  // Sort by index
  keys.sort((a, b) => a.index - b.index);

  // Cache the result
  cachedKeys = keys;

  console.log(`[API Key Manager] Discovered ${keys.length} XAI API keys`);

  return keys;
}

/**
 * Get the total number of available API keys
 */
export function getApiKeyCount(): number {
  return discoverApiKeys().length;
}

/**
 * Get an API key by its index (1-based)
 * Returns null if the index doesn't exist
 */
export function getApiKeyByIndex(index: number): string | null {
  const keys = discoverApiKeys();
  const keyInfo = keys.find(k => k.index === index);
  return keyInfo?.key || null;
}

/**
 * Get the next API key index for round-robin assignment
 * Uses modulo to wrap around when we exceed available keys
 *
 * @param currentMaxIndex - The highest currently assigned index in the database
 * @returns The next index to assign (1-based)
 */
export function getNextApiKeyIndex(currentMaxIndex: number): number {
  const keyCount = getApiKeyCount();

  if (keyCount === 0) {
    throw new Error('No XAI API keys configured');
  }

  // Round-robin: next index wraps around to 1 after reaching max
  const nextIndex = (currentMaxIndex % keyCount) + 1;

  return nextIndex;
}

/**
 * Get API key for a user based on their assigned index
 * Falls back to first available key if assignment is invalid
 */
export function getApiKeyForUser(assignedIndex: number | null): string {
  const keys = discoverApiKeys();

  if (keys.length === 0) {
    throw new Error('No XAI API keys configured. Set XAI_API_KEY environment variable.');
  }

  // If user has an assigned index, try to use it
  if (assignedIndex !== null) {
    const key = getApiKeyByIndex(assignedIndex);
    if (key) {
      return key;
    }
    // If assigned key doesn't exist anymore (was removed), fall back to first key
    console.warn(`[API Key Manager] User's assigned key index ${assignedIndex} not found, using fallback`);
  }

  // Fall back to first available key
  return keys[0].key;
}

/**
 * Get statistics about API key distribution
 * Useful for monitoring and debugging
 */
export function getApiKeyStats(): {
  totalKeys: number;
  keyIndexes: number[];
} {
  const keys = discoverApiKeys();
  return {
    totalKeys: keys.length,
    keyIndexes: keys.map(k => k.index),
  };
}

/**
 * Validate that at least one API key is configured
 * Call this at startup to fail fast if misconfigured
 */
export function validateApiKeyConfiguration(): void {
  const keys = discoverApiKeys();

  if (keys.length === 0) {
    throw new Error(
      'No XAI API keys configured. ' +
      'Please set XAI_API_KEY (or XAI_API_KEY_1, XAI_API_KEY_2, etc.) in your environment variables.'
    );
  }

  console.log(`[API Key Manager] Configuration valid: ${keys.length} API keys available`);
}
