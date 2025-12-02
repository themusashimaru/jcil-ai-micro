/**
 * Safe Message Sending Helper
 *
 * Validates payloads before sending to prevent server errors
 * Handles all message types: text, image, tool
 */

import { MessageSchema, normalizeContent, type MessagePayload } from './messageSchema';

export interface SendMessageResult {
  ok: boolean;
  message?: Record<string, unknown>;
  error?: string;
}

/**
 * Send a validated message to the conversations API
 *
 * @param conversationId - The conversation UUID
 * @param draft - The message payload (will be validated)
 * @returns Promise with the result
 */
export async function sendMessage(
  conversationId: string,
  draft: unknown
): Promise<SendMessageResult> {
  // Validate on the client before sending
  const parseResult = MessageSchema.safeParse(draft);

  if (!parseResult.success) {
    const errorMessage = parseResult.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    return {
      ok: false,
      error: `Validation error: ${errorMessage}`,
    };
  }

  const payload = parseResult.data;

  // Normalize content for preview/logging
  const contentForPreview = normalizeContent(payload);

  try {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        // Include normalized content for server-side logging
        _preview: contentForPreview.slice(0, 100),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: err?.error ?? `Failed to send message (${res.status})`,
      };
    }

    const data = await res.json();
    return {
      ok: true,
      message: data.message,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Helper to create a text message payload
 */
export function createTextMessage(content: string, role: 'user' | 'assistant' = 'user'): MessagePayload {
  return {
    type: 'text',
    role,
    content,
  };
}

/**
 * Helper to create an image message payload
 */
export function createImageMessage(
  prompt: string,
  size: '256x256' | '512x512' | '1024x1024' = '1024x1024'
): MessagePayload {
  return {
    type: 'image',
    role: 'user',
    prompt,
    size,
  };
}

/**
 * Helper to create a tool message payload
 */
export function createToolMessage(
  tool: string,
  args?: Record<string, unknown>,
  content?: string
): MessagePayload {
  return {
    type: 'tool',
    role: 'user',
    tool,
    args,
    content,
  };
}
