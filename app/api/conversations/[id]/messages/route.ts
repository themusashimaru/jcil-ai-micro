/**
 * CONVERSATION MESSAGES API
 *
 * GET - Load all messages for a conversation
 * POST - Save a new message to a conversation
 * PATCH - Edit an existing message (user messages only)
 * DELETE - Delete a message (soft delete)
 *
 * Supports both JSON and multipart/form-data for file uploads
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';
import { parseMessageInput } from './parse-message-input';

const log = logger('MessagesAPI');

// Force Node runtime for file Buffer support
export const runtime = 'nodejs';
// Avoid static optimization; we accept uploads
export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/[id]/messages
 * Load all messages for a conversation
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;
    const { id } = await params;

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await auth.supabase
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .single();

    if (convError || !conversation) {
      return errors.notFound('Conversation');
    }

    // Fetch messages
    const { data: messages, error } = await auth.supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      log.error('Error fetching messages', error instanceof Error ? error : { error });
      return errors.serverError();
    }

    return successResponse({ messages });
  } catch (error) {
    log.error('Unexpected error in GET', error as Error);
    return errors.serverError();
  }
}

/**
 * POST /api/conversations/[id]/messages
 * Save a new message to a conversation
 *
 * Supports both JSON and multipart/form-data:
 * - JSON: { role, content, content_type, attachment_urls, ... }
 * - FormData: text, role, files[], attachments_json
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;
    const { id: conversationId } = await params;

    // Rate limiting
    const rateLimitResult = await checkRequestRateLimit(
      `messages:${auth.user.id}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const parsed = await parseMessageInput(request);
    if (!parsed.success) return parsed.response;

    const {
      role,
      content,
      content_type_field,
      model_used,
      temperature,
      tokens_used,
      attachment_urls,
      image_url,
      prompt,
      type,
      metadata,
    } = parsed;

    // Normalize content: handle different message types
    // For image messages, content might be empty but prompt exists
    const normalizedContent =
      content && content.trim() ? content : prompt && typeof prompt === 'string' ? prompt : '';

    // Include image_url in attachments if present
    if (image_url) {
      attachment_urls.push(image_url);
    }

    // Validate: require at least text or attachments
    if (!normalizedContent && attachment_urls.length === 0) {
      return errors.badRequest('Provide text or at least one file');
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await auth.supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', auth.user.id)
      .single();

    if (convError || !conversation) {
      return errors.notFound('Conversation');
    }

    // Calculate retention date (1 year from now — extends on activity)
    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() + 1);

    // Safe preview for logging
    const contentPreview =
      normalizedContent.length > 0 ? normalizedContent.slice(0, 50) : '[no text content]';

    log.info('[API] Attempting to save message:', {
      conversation_id: conversationId,
      user_id: auth.user.id,
      role,
      type,
      content_preview: contentPreview,
      attachment_count: attachment_urls.length,
    });

    // Save message with normalized content
    const { data: message, error } = await auth.supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: auth.user.id,
        role,
        content: normalizedContent,
        content_type: (type === 'image' ? 'image' : content_type_field) as
          | 'text'
          | 'image'
          | 'code'
          | 'error',
        model_used,
        temperature,
        tokens_used,
        has_attachments: attachment_urls.length > 0,
        attachment_urls: attachment_urls.length > 0 ? attachment_urls : null,
        metadata: metadata,
        retention_until: retentionDate.toISOString(),
      })
      .select()
      .single();

    if (error) {
      log.error('Error saving message', error instanceof Error ? error : { error });
      return errors.serverError();
    }

    log.info(`Message saved: ${message.id}`);

    // Note: message_count is incremented by database trigger (increment_conversation_message_count)
    // Update timestamps AND extend retention on every message to prevent expiry
    const conversationRetention = new Date();
    conversationRetention.setFullYear(conversationRetention.getFullYear() + 1);
    const { error: updateError } = await auth.supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retention_until: conversationRetention.toISOString(),
      })
      .eq('id', conversationId);

    if (updateError) {
      log.error('Error updating conversation timestamp', { error: updateError });
      // Don't fail the request if this fails
    }

    // Return structured success response
    return successResponse({
      message,
      conversationId,
      role,
      content: normalizedContent || null,
      attachments: attachment_urls.map((url, i) => ({
        index: i,
        hasData: url.startsWith('data:'),
      })),
    });
  } catch (error) {
    log.error('Unexpected error in POST', error as Error);
    return errors.serverError();
  }
}

/**
 * PATCH /api/conversations/[id]/messages
 * Edit an existing message
 *
 * Body: { messageId: string, content: string }
 *
 * Note: Only user messages can be edited. Editing updates the content
 * and marks the message as edited with a timestamp.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;
    const { id: conversationId } = await params;

    // Rate limiting
    const rateLimitResult = await checkRequestRateLimit(
      `messages:edit:${auth.user.id}`,
      rateLimits.strict
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Parse request body
    let body: { messageId: string; content: string };
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON body');
    }

    const { messageId, content } = body;

    if (!messageId || typeof messageId !== 'string') {
      return errors.badRequest('messageId is required');
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return errors.badRequest('content cannot be empty');
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await auth.supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', auth.user.id)
      .single();

    if (convError || !conversation) {
      return errors.notFound('Conversation');
    }

    // Get the message and verify ownership
    const { data: existingMessage, error: msgError } = await auth.supabase
      .from('messages')
      .select('id, role, user_id, content')
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .single();

    if (msgError || !existingMessage) {
      return errors.notFound('Message');
    }

    // Only allow editing own messages
    if (existingMessage.user_id !== auth.user.id) {
      return errors.forbidden('You can only edit your own messages');
    }

    // Only allow editing user messages (not assistant messages)
    if (existingMessage.role !== 'user') {
      return errors.forbidden('Only user messages can be edited');
    }

    // Store the original content for audit purposes
    const originalContent = existingMessage.content;

    // Update the message
    const { data: updatedMessage, error: updateError } = await auth.supabase
      .from('messages')
      .update({
        content: content.trim(),
        edited_at: new Date().toISOString(),
        original_content: originalContent, // Store original for reference
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select()
      .single();

    if (updateError) {
      log.error('Error updating message', { error: updateError });
      return errors.serverError();
    }

    log.info(`Message edited: ${messageId} by user ${auth.user.id}`);

    return successResponse({
      message: updatedMessage,
      edited: true,
      previousContent: originalContent,
    });
  } catch (error) {
    log.error('Unexpected error in PATCH', error as Error);
    return errors.serverError();
  }
}

/**
 * DELETE /api/conversations/[id]/messages
 * Soft delete a message
 *
 * Body: { messageId: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;
    const { id: conversationId } = await params;

    // Rate limiting
    const rateLimitResult = await checkRequestRateLimit(
      `messages:delete:${auth.user.id}`,
      rateLimits.strict
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Parse request body
    let body: { messageId: string };
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON body');
    }

    const { messageId } = body;

    if (!messageId || typeof messageId !== 'string') {
      return errors.badRequest('messageId is required');
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await auth.supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', auth.user.id)
      .single();

    if (convError || !conversation) {
      return errors.notFound('Conversation');
    }

    // Get the message and verify ownership
    const { data: existingMessage, error: msgError } = await auth.supabase
      .from('messages')
      .select('id, user_id')
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .single();

    if (msgError || !existingMessage) {
      return errors.notFound('Message');
    }

    // Only allow deleting own messages
    if (existingMessage.user_id !== auth.user.id) {
      return errors.forbidden('You can only delete your own messages');
    }

    // Soft delete the message
    const { error: deleteError } = await auth.supabase
      .from('messages')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (deleteError) {
      log.error('Error deleting message', { error: deleteError });
      return errors.serverError();
    }

    log.info(`Message deleted: ${messageId} by user ${auth.user.id}`);

    return successResponse({
      deleted: true,
      messageId,
    });
  } catch (error) {
    log.error('Unexpected error in DELETE', error as Error);
    return errors.serverError();
  }
}
