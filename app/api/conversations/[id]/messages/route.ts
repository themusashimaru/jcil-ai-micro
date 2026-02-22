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

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import {
  successResponse,
  errors,
  validateBody,
  checkRequestRateLimit,
  rateLimits,
} from '@/lib/api/utils';
import { createMessageSchema } from '@/lib/validation/schemas';

const log = logger('MessagesAPI');

// Force Node runtime for file Buffer support
export const runtime = 'nodejs';
// Avoid static optimization; we accept uploads
export const dynamic = 'force-dynamic';

/**
 * Structured error response helper
 */
function errorResponse(status: number, code: string, message: string, extra?: unknown) {
  return NextResponse.json({ ok: false, error: { code, message, extra } }, { status });
}

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
    const rateLimitResult = await checkRequestRateLimit(`messages:${auth.user.id}`, rateLimits.standard);
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const contentType = request.headers.get('content-type') || '';

    // Variables to hold parsed data
    let role = 'user';
    let content = '';
    let content_type_field = 'text';
    let model_used: string | null = null;
    let temperature: number | null = null;
    let tokens_used: number | null = null;
    let attachment_urls: string[] = [];
    let image_url: string | null = null;
    let prompt: string | null = null;
    let type = 'text';
    let metadata: Record<string, unknown> | null = null;

    // Handle multipart/form-data (file uploads)
    if (contentType.includes('multipart/form-data')) {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch (e) {
        log.error('[API] FormData parse error', e instanceof Error ? e : { error: e });
        return errorResponse(400, 'BAD_FORMDATA', 'Failed to parse form data');
      }

      // Extract text content from multiple possible field names
      const textValue =
        (formData.get('text') as string | null) ??
        (formData.get('message') as string | null) ??
        (formData.get('content') as string | null) ??
        '';
      content = textValue;

      // Extract role
      const roleValue = (formData.get('role') as string | null) ?? 'user';
      if (['user', 'system', 'assistant'].includes(roleValue)) {
        role = roleValue;
      }

      // Process file uploads
      const fileKeys = ['files', 'file', 'attachment', 'attachments[]'];
      for (const key of fileKeys) {
        const files = formData.getAll(key);
        for (const file of files) {
          if (file instanceof File && file.size > 0) {
            try {
              // Convert file to base64 data URL for storage
              const arrayBuffer = await file.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const base64 = buffer.toString('base64');
              const mimeType = file.type || 'application/octet-stream';
              const dataUrl = `data:${mimeType};base64,${base64}`;
              attachment_urls.push(dataUrl);
            } catch (fileError) {
              log.error(
                '[API] File processing error',
                fileError instanceof Error ? fileError : { error: fileError }
              );
              // Continue with other files
            }
          }
        }
      }

      // Also support JSON attachments in a field (for base64 uploads via form)
      const attachmentsJson = formData.get('attachments_json') as string | null;
      if (attachmentsJson) {
        try {
          const arr = JSON.parse(attachmentsJson) as Array<{
            name?: string;
            mime?: string;
            base64: string;
            url?: string;
          }>;
          for (const att of arr) {
            if (att.base64) {
              const mime = att.mime || 'application/octet-stream';
              attachment_urls.push(`data:${mime};base64,${att.base64}`);
            } else if (att.url) {
              attachment_urls.push(att.url);
            }
          }
        } catch (jsonError) {
          log.error(
            '[API] attachments_json parse error',
            jsonError instanceof Error ? jsonError : { error: jsonError }
          );
          return errorResponse(400, 'BAD_ATTACHMENTS_JSON', 'attachments_json is not valid JSON');
        }
      }
    } else {
      // Handle JSON request
      // Make content optional to allow messages with only attachments or prompts
      const messageSchema = createMessageSchema.partial({ content: true });
      const validation = await validateBody(request, messageSchema);

      if (!validation.success) {
        return validation.response;
      }

      const body = validation.data;

      // Extract validated fields
      role = body.role;
      content = body.content || '';
      content_type_field = body.content_type;
      model_used = body.model_used || null;
      temperature = body.temperature || null;
      tokens_used = body.tokens_used || null;
      image_url = body.image_url || null;
      prompt = body.prompt || null;
      type = body.type;
      attachment_urls = body.attachment_urls || [];
      metadata = body.metadata || null;
    }

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
      return errorResponse(400, 'EMPTY_MESSAGE', 'Provide text or at least one file');
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

    // Calculate retention date (30 days from now by default)
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + 30);

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
        content_type: type === 'image' ? 'image' : content_type_field,
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
    // We only update last_message_at here to avoid duplicate counting
    const { error: updateError } = await auth.supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
      return errorResponse(400, 'BAD_JSON', 'Invalid JSON body');
    }

    const { messageId, content } = body;

    if (!messageId || typeof messageId !== 'string') {
      return errorResponse(400, 'MISSING_MESSAGE_ID', 'messageId is required');
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return errorResponse(400, 'EMPTY_CONTENT', 'content cannot be empty');
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
      return errorResponse(403, 'CANNOT_EDIT_ROLE', 'Only user messages can be edited');
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
      return errorResponse(400, 'BAD_JSON', 'Invalid JSON body');
    }

    const { messageId } = body;

    if (!messageId || typeof messageId !== 'string') {
      return errorResponse(400, 'MISSING_MESSAGE_ID', 'messageId is required');
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
