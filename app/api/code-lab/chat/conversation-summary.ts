/**
 * Conversation Auto-Summarization for Code Lab Chat
 *
 * Generates concise summaries of long conversations to manage
 * context window limits while preserving important technical details.
 */

import Anthropic from '@anthropic-ai/sdk';

// Auto-summarization configuration
export const SUMMARY_THRESHOLD = 15; // Summarize when message count exceeds this
export const RECENT_MESSAGES_AFTER_SUMMARY = 5; // Keep this many recent messages after summary

// Shared Anthropic client for summarization
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Generate a summary of conversation history
 * Called when message count exceeds threshold
 */
export async function generateConversationSummary(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6', // Use Sonnet for efficient summarization
    max_tokens: 1024,
    system: `You are summarizing a developer conversation for context continuation.
Create a concise technical summary that captures:
1. Main topics and goals discussed
2. Key decisions made
3. Code/technical context established
4. Current state of any projects
5. Open questions or next steps

Format as bullet points. Be specific about file names, technologies, and code patterns mentioned.
Keep it under 500 words but include all important technical details.`,
    messages: [
      {
        role: 'user',
        content: `Summarize this conversation for context continuation:\n\n${conversationText}`,
      },
    ],
  });

  let summary = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      summary += block.text;
    }
  }
  return summary;
}

/**
 * Get the shared Anthropic client (for search fallback, etc.)
 */
export function getAnthropicClient(): Anthropic {
  return anthropic;
}
