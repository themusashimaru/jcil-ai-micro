/**
 * API KEY POOL MANAGER
 *
 * Manages load balancing across multiple XAI API keys to handle massive scale.
 * Auto-detects available keys from environment variables.
 *
 * Supported keys:
 * - XAI_API_KEY (key group 1)
 * - XAI_API_KEY_2 (key group 2)
 * - XAI_API_KEY_3 (key group 3)
 * - ...
 * - XAI_API_KEY_100 (key group 100)
 *
 * Features:
 * - Auto-detection of available keys
 * - Round-robin load balancing
 * - Automatic failover to key #1 if assigned key is missing
 * - Health monitoring and statistics
 */

// Cache for detected API keys
let detectedKeys: Map<number, string> | null = null;
let detectionTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Detects all available XAI API keys from environment variables
 * Returns a Map of key_group -> api_key
 */
export function detectAvailableKeys(): Map<number, string> {
  const now = Date.now();

  // Return cached keys if still valid (5 min cache)
  if (detectedKeys && (now - detectionTimestamp) < CACHE_DURATION) {
    return detectedKeys;
  }

  const keys = new Map<number, string>();

  // Check for primary key (XAI_API_KEY = key group 1)
  const primaryKey = process.env.XAI_API_KEY;
  if (primaryKey) {
    keys.set(1, primaryKey);
  }

  // Check for additional keys (XAI_API_KEY_2 through XAI_API_KEY_100)
  for (let i = 2; i <= 100; i++) {
    const key = process.env[`XAI_API_KEY_${i}`];
    if (key) {
      keys.set(i, key);
    }
  }

  // Cache the detected keys
  detectedKeys = keys;
  detectionTimestamp = now;

  console.log(`🔑 API Key Pool: Detected ${keys.size} available keys`);

  return keys;
}

/**
 * Gets the API key for a specific key group
 * Falls back to key #1 if the assigned key is not available
 */
export function getApiKeyForGroup(keyGroup: number): string {
  const availableKeys = detectAvailableKeys();

  // Try to get the assigned key
  let apiKey = availableKeys.get(keyGroup);

  if (!apiKey) {
    // Fallback to primary key (key group 1)
    apiKey = availableKeys.get(1);

    if (!apiKey) {
      throw new Error(
        'No XAI API keys found! Please set at least XAI_API_KEY in environment variables.'
      );
    }

    console.warn(
      `⚠️ API key group ${keyGroup} not found, falling back to primary key (group 1)`
    );
  }

  return apiKey;
}

/**
 * Gets statistics about the API key pool
 */
export function getKeyPoolStats() {
  const availableKeys = detectAvailableKeys();

  return {
    totalKeys: availableKeys.size,
    keyGroups: Array.from(availableKeys.keys()).sort((a, b) => a - b),
    estimatedCapacity: {
      dailyUsers: availableKeys.size * 30000, // ~30K users per key per day
      concurrentUsers: availableKeys.size * 1000, // ~1K concurrent per key
      requestsPerDay: availableKeys.size * 384000, // 384K requests per day per key
    },
    detectedAt: new Date(detectionTimestamp).toISOString(),
  };
}

/**
 * Validates that the required minimum number of keys are available
 * Throws an error if not enough keys are found
 */
export function validateMinimumKeys(minimumRequired: number = 1): void {
  const availableKeys = detectAvailableKeys();

  if (availableKeys.size < minimumRequired) {
    throw new Error(
      `Insufficient API keys! Found ${availableKeys.size}, need at least ${minimumRequired}. ` +
      `Please add more XAI_API_KEY_N environment variables.`
    );
  }

  console.log(`✅ API Key Pool: ${availableKeys.size} keys available (minimum: ${minimumRequired})`);
}

/**
 * Clears the key detection cache (useful for testing or dynamic key updates)
 */
export function clearKeyCache(): void {
  detectedKeys = null;
  detectionTimestamp = 0;
  console.log('🔄 API Key Pool: Cache cleared');
}

/**
 * Health check - returns status of API key pool
 */
export function getHealthStatus() {
  try {
    const availableKeys = detectAvailableKeys();
    const stats = getKeyPoolStats();

    return {
      healthy: availableKeys.size > 0,
      totalKeys: availableKeys.size,
      estimatedCapacity: stats.estimatedCapacity,
      status: availableKeys.size === 0 ? 'ERROR' :
              availableKeys.size < 10 ? 'WARNING' :
              availableKeys.size < 50 ? 'GOOD' :
              'EXCELLENT',
      message: availableKeys.size === 0 ? 'No API keys detected!' :
               availableKeys.size < 10 ? 'Low key count - consider adding more for scale' :
               availableKeys.size < 50 ? 'Good capacity for moderate traffic' :
               'Excellent capacity - ready for viral scale!',
    };
  } catch (error) {
    return {
      healthy: false,
      totalKeys: 0,
      status: 'ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
