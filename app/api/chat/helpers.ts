/**
 * Chat Route Helpers
 *
 * Pure utility functions for message processing, content extraction,
 * and error sanitization. No side effects, no external dependencies.
 */

import { CoreMessage } from 'ai';

// Token limits
export const MAX_RESPONSE_TOKENS = 4096;
export const DEFAULT_RESPONSE_TOKENS = 2048;
export const MAX_CONTEXT_MESSAGES = 60;

/**
 * Extract key points from older messages for summarization
 */
export function extractKeyPoints(messages: CoreMessage[]): string[] {
  const keyPoints: string[] = [];

  for (const msg of messages) {
    let content = '';

    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      // Extract text from content parts
      for (const part of msg.content) {
        if (part.type === 'text' && 'text' in part) {
          content += (part as { type: 'text'; text: string }).text + ' ';
        }
      }
      content = content.trim();
    }

    if (content.length < 20) continue;

    const summary = content.length > 150 ? content.substring(0, 150) + '...' : content;

    if (msg.role === 'user') {
      keyPoints.push(`User asked: ${summary}`);
    } else if (msg.role === 'assistant') {
      keyPoints.push(`Assistant responded: ${summary}`);
    }
  }

  return keyPoints.slice(0, 10); // Keep max 10 key points
}

/**
 * Truncate messages with intelligent summarization
 * Instead of just dropping old messages, creates a summary of them
 */
export function truncateMessages(
  messages: CoreMessage[],
  maxMessages: number = MAX_CONTEXT_MESSAGES
): CoreMessage[] {
  if (!messages || messages.length === 0) return [];
  if (messages.length <= maxMessages) return messages;

  // Keep the first message (usually system context) and last (maxMessages - 2) messages
  // Use one slot for the summary
  const keepFirst = messages[0];
  const toSummarize = messages.slice(1, -(maxMessages - 2));
  const keepLast = messages.slice(-(maxMessages - 2));

  // If there are messages to summarize, create a summary
  if (toSummarize.length > 0) {
    const keyPoints = extractKeyPoints(toSummarize);

    let summaryText = `[CONVERSATION CONTEXT: The following summarizes ${toSummarize.length} earlier messages]\n`;
    summaryText += keyPoints.map((point) => `• ${point}`).join('\n');
    summaryText += `\n[END OF SUMMARY - Continue the conversation naturally]\n`;

    // CHAT-013: Use 'user' role instead of 'system' for conversation summaries
    const summaryMessage: CoreMessage = {
      role: 'user',
      content: `[Context from earlier in our conversation]\n${summaryText}`,
    };

    return [keepFirst, summaryMessage, ...keepLast];
  }

  return [keepFirst, ...keepLast];
}

export function clampMaxTokens(requestedTokens?: number): number {
  if (!requestedTokens) return DEFAULT_RESPONSE_TOKENS;
  return Math.min(Math.max(requestedTokens, 256), MAX_RESPONSE_TOKENS);
}

export function getLastUserContent(messages: CoreMessage[]): string {
  if (!messages || messages.length === 0) return '';
  const lastUserMessage = messages[messages.length - 1];
  if (!lastUserMessage) return '';
  if (typeof lastUserMessage.content === 'string') {
    return lastUserMessage.content;
  }
  if (Array.isArray(lastUserMessage.content)) {
    return lastUserMessage.content
      .filter((part: { type: string }) => part.type === 'text')
      .map((part: { type: string; text?: string }) => part.text || '')
      .join(' ');
  }
  return '';
}

/**
 * Extract image attachments from the last user message
 * Returns base64 encoded images ready for FLUX edit API
 */
export function getImageAttachments(messages: CoreMessage[]): string[] {
  if (!messages || messages.length === 0) return [];
  const lastUserMessage = messages[messages.length - 1];
  if (!lastUserMessage) return [];
  const images: string[] = [];

  if (Array.isArray(lastUserMessage?.content)) {
    for (const part of lastUserMessage.content) {
      // Use type assertion to handle both Vercel AI SDK and OpenAI formats
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyPart = part as any;

      // Handle Vercel AI SDK image format: { type: 'image', image: base64String }
      if (anyPart.type === 'image' && anyPart.image) {
        images.push(anyPart.image);
      }
      // Handle file type which might contain images
      else if (anyPart.type === 'file' && anyPart.data) {
        // Check if it's an image file by mimeType
        if (anyPart.mimeType?.startsWith('image/')) {
          images.push(anyPart.data);
        }
      }
      // Handle OpenAI format: { type: 'image_url', image_url: { url: 'data:...' } }
      else if (anyPart.type === 'image_url' && anyPart.image_url?.url) {
        const url = anyPart.image_url.url;
        // Extract base64 from data URL if needed
        if (url.startsWith('data:image')) {
          const base64 = url.split(',')[1];
          if (base64) images.push(base64);
        } else {
          // It's a regular URL - we'd need to fetch it
          images.push(url);
        }
      }
    }
  }

  return images;
}

/**
 * Find the most recent generated image URL in conversation history
 * Looks for image URLs in assistant messages (from previous generations)
 */
export function findPreviousGeneratedImage(messages: CoreMessage[]): string | null {
  // Search backwards through messages to find the most recent generated image
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];

    // Only look at assistant messages
    if (message.role !== 'assistant') continue;

    const content = message.content;

    // Handle string content - look for image URLs
    if (typeof content === 'string') {
      // Look for our hidden ref format first: [ref:url]
      const refMatch = content.match(/\[ref:(https:\/\/[^\]]+)\]/);
      if (refMatch) {
        return refMatch[1];
      }

      // Look for markdown image links: ![...](url)
      const markdownImageMatch = content.match(/!\[[^\]]*\]\((https:\/\/[^)]+)\)/);
      if (markdownImageMatch) {
        return markdownImageMatch[1];
      }

      // Look for Supabase storage URLs (our generated images)
      const supabaseUrlMatch = content.match(
        /https:\/\/[^\/]+\.supabase\.co\/storage\/v1\/object\/public\/generations\/[^\s"')\]]+/
      );
      if (supabaseUrlMatch) {
        return supabaseUrlMatch[0];
      }

      // Look for any image URL pattern
      const imageUrlMatch = content.match(
        /https?:\/\/[^\s"')]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s"')]*)?/i
      );
      if (imageUrlMatch) {
        return imageUrlMatch[0];
      }
    }

    // Handle array content (structured messages)
    if (Array.isArray(content)) {
      for (const part of content) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyPart = part as any;

        // Check for image parts
        if (anyPart.type === 'image' && anyPart.image) {
          // If it's a URL, return it
          if (anyPart.image.startsWith('http')) {
            return anyPart.image;
          }
        }

        // Check for text parts containing image URLs
        if (anyPart.type === 'text' && anyPart.text) {
          const supabaseUrlMatch = anyPart.text.match(
            /https:\/\/[^\/]+\.supabase\.co\/storage\/v1\/object\/public\/generations\/[^\s"')]+/
          );
          if (supabaseUrlMatch) {
            return supabaseUrlMatch[0];
          }
        }
      }
    }
  }

  return null;
}

/**
 * Sanitize error messages before including them in tool results.
 * Strips sensitive details (stack traces, connection strings, DB schema)
 * while keeping enough context for the model to understand the failure.
 */
export function sanitizeToolError(toolName: string, rawMessage: string): string {
  // Remove stack traces
  let msg = rawMessage.split('\n')[0] || rawMessage;
  // Remove file paths
  msg = msg.replace(/(?:\/[\w.-]+)+/g, '[path]');
  // Remove connection strings and URLs
  msg = msg.replace(/https?:\/\/[^\s]+/g, '[url]');
  // Remove potential SQL or DB references
  msg = msg.replace(/(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN)\b[^.]*\./gi, '[query]');
  // Truncate to reasonable length
  if (msg.length > 200) {
    msg = msg.slice(0, 200) + '...';
  }
  return `Tool "${toolName}" encountered an error. ${msg}`;
}
