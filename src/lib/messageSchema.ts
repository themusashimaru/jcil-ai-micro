/**
 * Shared Message Schema
 *
 * Zod schema for validating message payloads
 * Used by both client and server to ensure type safety
 */

import { z } from 'zod';

// Base message fields shared by all types
export const BaseMessage = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']).default('user'),
  metadata: z.record(z.any()).optional(),
});

// Text message: regular chat
export const TextMessage = BaseMessage.extend({
  type: z.literal('text'),
  content: z.string().min(1, 'Message cannot be empty'),
});

// Image message: DALL-E generation
export const ImageMessage = BaseMessage.extend({
  type: z.literal('image'),
  prompt: z.string().min(1, 'Prompt required'),
  size: z.enum(['256x256', '512x512', '1024x1024']).default('1024x1024'),
  content: z.string().optional(), // Optional text content
});

// Tool message: connector/tool calls
export const ToolMessage = BaseMessage.extend({
  type: z.literal('tool'),
  tool: z.string().min(1, 'Tool name required'),
  args: z.record(z.any()).optional(),
  content: z.string().optional(),
});

// Discriminated union of all message types
export const MessageSchema = z.discriminatedUnion('type', [
  TextMessage,
  ImageMessage,
  ToolMessage,
]);

export type MessagePayload = z.infer<typeof MessageSchema>;
export type TextMessagePayload = z.infer<typeof TextMessage>;
export type ImageMessagePayload = z.infer<typeof ImageMessage>;
export type ToolMessagePayload = z.infer<typeof ToolMessage>;

/**
 * Normalize content from any message type
 * Returns a string suitable for logging/preview
 */
export function normalizeContent(payload: MessagePayload): string {
  switch (payload.type) {
    case 'text':
      return payload.content;
    case 'image':
      return payload.content || payload.prompt;
    case 'tool':
      return payload.content || JSON.stringify(payload.args || {});
    default:
      return '';
  }
}

/**
 * Validate and parse a message payload
 * Returns the parsed payload or throws a ZodError
 */
export function parseMessage(data: unknown): MessagePayload {
  return MessageSchema.parse(data);
}

/**
 * Safe parse that returns result object instead of throwing
 */
export function safeParseMessage(data: unknown): z.SafeParseReturnType<unknown, MessagePayload> {
  return MessageSchema.safeParse(data);
}
