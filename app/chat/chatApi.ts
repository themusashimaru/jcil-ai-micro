/**
 * CHAT API HELPERS
 *
 * Database operations for conversations and messages.
 * Shared across multiple hooks.
 */

import { logger } from '@/lib/logger';
import { fetchWithRetry } from '@/lib/api/retry';
import type { Message } from './types';

const log = logger('ChatClient');

/**
 * Helper to safely parse JSON response
 */
export const safeJsonParse = async (
  res: Response
): Promise<{
  ok: boolean;
  data?: unknown;
  error?: { code?: string; message?: string };
} | null> => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

/**
 * Fetch and format messages from the API
 */
export const fetchMessages = async (chatId: string): Promise<Message[] | null> => {
  try {
    const response = await fetchWithRetry(`/api/conversations/${chatId}/messages`, {
      maxRetries: 2,
    });
    if (response.ok) {
      const responseData = await response.json();
      const data = responseData.data || responseData;
      return (data.messages || []).map(
        (msg: {
          id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          content_type: string;
          attachment_urls: string[] | null;
          created_at: string;
          metadata?: Record<string, unknown> | null;
        }) => {
          const imageUrl =
            msg.attachment_urls && msg.attachment_urls.length > 0
              ? msg.attachment_urls[0]
              : undefined;
          const docDl = msg.metadata?.documentDownload as
            | { filename: string; mimeType: string; dataUrl: string; canPreview: boolean }
            | undefined;
          return {
            id: msg.id,
            role: msg.role,
            content: msg.content ?? '',
            imageUrl,
            documentDownload: docDl || undefined,
            timestamp: new Date(msg.created_at),
          };
        }
      );
    }
  } catch (error) {
    log.error('Error fetching messages:', error as Error);
  }
  return null;
};

/**
 * Save a message to the database
 */
export const saveMessageToDatabase = async (
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  contentType: 'text' | 'image' | 'code' | 'error' = 'text',
  imageUrl?: string,
  attachmentUrls?: string[],
  metadata?: Record<string, unknown> | null
) => {
  const hasContent = content && content.trim().length > 0;
  const hasAttachments = (attachmentUrls && attachmentUrls.length > 0) || imageUrl;

  if (!hasContent && !hasAttachments) {
    log.debug('Skipping save - no content or attachments');
    return null;
  }

  try {
    const response = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        content,
        content_type: contentType,
        image_url: imageUrl,
        attachment_urls: attachmentUrls,
        metadata: metadata || undefined,
      }),
    });

    const data = await safeJsonParse(response);

    if (!response.ok || data?.ok === false) {
      const errorMsg = data?.error?.message || `HTTP ${response.status}`;
      const errorCode = data?.error?.code || 'UNKNOWN';
      log.error(`Save message failed: ${errorCode}: ${errorMsg}`);
      throw new Error(`${errorCode}: ${errorMsg}`);
    }

    return data;
  } catch (error) {
    log.error('Error saving message to database:', error as Error);
  }
};

/**
 * Create a conversation in the database
 */
export const createConversationInDatabase = async (title: string, toolContext?: string) => {
  try {
    log.debug('Creating conversation in DB:', { title, toolContext });
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        tool_context: toolContext || 'general',
      }),
    });

    log.debug('Conversation API response status:', { status: response.status });

    if (!response.ok) {
      const errorData = await response.json();
      log.error('Conversation creation failed:', errorData);
      throw new Error(`Failed to create conversation: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    log.debug('Conversation API result:', result);

    const conversation = result.data?.conversation || result.conversation;
    if (conversation && conversation.id) {
      log.debug('Returning conversation ID:', conversation.id);
      return conversation.id;
    }

    throw new Error('No conversation ID returned from API');
  } catch (error) {
    log.error('Error creating conversation in database:', error as Error);
    throw error;
  }
};
