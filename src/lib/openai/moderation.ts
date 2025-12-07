/**
 * OpenAI Moderation Utility
 *
 * PURPOSE:
 * - Protect our API keys from policy violations
 * - Use OpenAI moderation as middleware before forwarding to AI providers
 * - Return professional responses for flagged content
 *
 * FEATURES:
 * - Dynamic multi-key support (unlimited keys)
 * - Round-robin load distribution
 * - Automatic failover on rate limits
 * - Works with Anthropic, OpenAI, or any provider
 */

import OpenAI from 'openai';

// ========================================
// DYNAMIC MULTI-KEY SYSTEM FOR MODERATION
// ========================================
// Supports: OPENAI_MODERATION_KEY_1, _2, _3, ... (unlimited)
// Fallback: Uses OPENAI_API_KEY if no dedicated moderation keys

interface ModerationKeyState {
  key: string;
  client: OpenAI;
  rateLimitedUntil: number;
  index: number;
}

const moderationKeys: ModerationKeyState[] = [];
let currentKeyIndex = 0;
let initialized = false;

/**
 * Initialize all available moderation API keys
 * FULLY DYNAMIC: Automatically detects ALL configured keys - no limits!
 */
function initializeModerationKeys(): void {
  if (initialized) return;
  initialized = true;

  // First, check for dedicated moderation keys (OPENAI_MODERATION_KEY_1, _2, _3, ...)
  let i = 1;
  while (true) {
    const key = process.env[`OPENAI_MODERATION_KEY_${i}`];
    if (!key) break;

    moderationKeys.push({
      key,
      client: new OpenAI({ apiKey: key }),
      rateLimitedUntil: 0,
      index: i,
    });
    i++;
  }

  // If no dedicated moderation keys, check for numbered OpenAI keys
  if (moderationKeys.length === 0) {
    let j = 1;
    while (true) {
      const key = process.env[`OPENAI_API_KEY_${j}`];
      if (!key) break;

      moderationKeys.push({
        key,
        client: new OpenAI({ apiKey: key }),
        rateLimitedUntil: 0,
        index: j,
      });
      j++;
    }
  }

  // If still no keys, fall back to single OPENAI_API_KEY
  if (moderationKeys.length === 0) {
    const singleKey = process.env.OPENAI_API_KEY;
    if (singleKey) {
      moderationKeys.push({
        key: singleKey,
        client: new OpenAI({ apiKey: singleKey }),
        rateLimitedUntil: 0,
        index: 0,
      });
    }
  }

  if (moderationKeys.length > 0) {
    console.log(`[Moderation] Initialized with ${moderationKeys.length} API key(s) (round-robin)`);
  }
}

/**
 * Get the next available moderation client (round-robin)
 */
function getModerationClient(): OpenAI | null {
  initializeModerationKeys();

  if (moderationKeys.length === 0) {
    return null;
  }

  const now = Date.now();

  // Round-robin through available keys
  for (let i = 0; i < moderationKeys.length; i++) {
    const keyIndex = (currentKeyIndex + i) % moderationKeys.length;
    const keyState = moderationKeys[keyIndex];

    if (keyState.rateLimitedUntil <= now) {
      // Advance round-robin for next request
      currentKeyIndex = (keyIndex + 1) % moderationKeys.length;
      return keyState.client;
    }
  }

  // All keys rate limited - use the one available soonest
  let soonestKey = moderationKeys[0];
  for (const key of moderationKeys) {
    if (key.rateLimitedUntil < soonestKey.rateLimitedUntil) {
      soonestKey = key;
    }
  }

  return soonestKey.client;
}

/**
 * Mark a moderation key as rate limited
 */
function markKeyRateLimited(client: OpenAI, seconds: number = 60): void {
  const keyState = moderationKeys.find(k => k.client === client);
  if (keyState) {
    keyState.rateLimitedUntil = Date.now() + (seconds * 1000);
    console.log(`[Moderation] Key ${keyState.index} rate limited for ${seconds}s`);
  }
}

/**
 * Get moderation key stats
 */
export function getModerationKeyStats(): {
  totalKeys: number;
  availableKeys: number;
} {
  initializeModerationKeys();
  const now = Date.now();
  const availableKeys = moderationKeys.filter(k => k.rateLimitedUntil <= now).length;

  return {
    totalKeys: moderationKeys.length,
    availableKeys,
  };
}

// ========================================
// MODERATION FUNCTIONS
// ========================================

interface ModerationResult {
  flagged: boolean;
  categories?: string[];
  message?: string;
}

/**
 * Check content against OpenAI moderation API
 * Uses round-robin across all configured moderation keys
 */
export async function moderateContent(content: string): Promise<ModerationResult> {
  const maxRetries = Math.max(1, moderationKeys.length);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const client = getModerationClient();

    if (!client) {
      console.error('[Moderation] No API keys configured, skipping moderation');
      return { flagged: false };
    }

    try {
      // Call moderation API with latest model
      const moderation = await client.moderations.create({
        model: 'omni-moderation-latest',
        input: content,
      });

      const result = moderation.results[0];

      if (result.flagged) {
        // Collect flagged categories
        const flaggedCategories = Object.entries(result.categories)
          .filter(([, isFlagged]) => isFlagged)
          .map(([category]) => category);

        return {
          flagged: true,
          categories: flaggedCategories,
          message: 'Your message violates our content policy. Please rephrase your request in a respectful and appropriate manner.',
        };
      }

      return { flagged: false };
    } catch (error) {
      // Check for rate limit error
      if (error instanceof OpenAI.RateLimitError) {
        markKeyRateLimited(client, 60);
        if (attempt < maxRetries - 1) {
          console.log(`[Moderation] Rate limited on attempt ${attempt + 1}, trying next key...`);
          continue;
        }
      }

      console.error('[Moderation] API error:', error);
      // On error, allow content through to avoid blocking legitimate users
      return { flagged: false };
    }
  }

  // All retries exhausted
  return { flagged: false };
}

/**
 * Moderate multiple messages in a conversation
 * Returns the first violation found, or null if all pass
 */
export async function moderateMessages(messages: Array<{ role: string; content: string }>): Promise<ModerationResult> {
  // Only moderate user messages
  const userMessages = messages.filter((msg) => msg.role === 'user');

  for (const message of userMessages) {
    const result = await moderateContent(message.content);
    if (result.flagged) {
      return result;
    }
  }

  return { flagged: false };
}
