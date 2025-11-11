/**
 * OpenAI Moderation Utility
 *
 * PURPOSE:
 * - Protect our xAI API keys from policy violations
 * - Use OpenAI moderation as middleware before forwarding to xAI
 * - Return professional responses for flagged content
 */

import OpenAI from 'openai';

interface ModerationResult {
  flagged: boolean;
  categories?: string[];
  message?: string;
}

/**
 * Check content against OpenAI moderation API
 */
export async function moderateContent(content: string): Promise<ModerationResult> {
  try {
    // Initialize OpenAI client
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured, skipping moderation');
      // Allow content through if moderation is not configured
      return { flagged: false };
    }

    const openai = new OpenAI({ apiKey });

    // Call moderation API with latest model
    const moderation = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: content,
    });

    const result = moderation.results[0];

    if (result.flagged) {
      // Collect flagged categories
      const flaggedCategories = Object.entries(result.categories)
        .filter(([_, isFlagged]) => isFlagged)
        .map(([category]) => category);

      return {
        flagged: true,
        categories: flaggedCategories,
        message: 'Your message violates our content policy. Please rephrase your request in a respectful and appropriate manner.',
      };
    }

    return { flagged: false };
  } catch (error) {
    console.error('Moderation API error:', error);
    // On error, allow content through to avoid blocking legitimate users
    // Log the error for monitoring
    return { flagged: false };
  }
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
