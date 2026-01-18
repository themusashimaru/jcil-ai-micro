/**
 * MESSAGE REGENERATION API
 *
 * POST /api/conversations/[id]/messages/regenerate
 *
 * Regenerates an assistant message by:
 * 1. Deleting the original assistant message and all messages after it
 * 2. Returning the previous user message to regenerate context
 *
 * The client should then call /api/chat to generate a new response.
 * This approach keeps the chat logic in one place and maintains streaming support.
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

const log = logger('RegenerateAPI');

export const runtime = 'nodejs';

async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently handle cookie errors
          }
        },
      },
    }
  );
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

/**
 * POST /api/conversations/[id]/messages/regenerate
 *
 * Body: { messageId: string }
 *
 * Regenerates an assistant message by removing it and subsequent messages,
 * returning the context needed to generate a fresh response.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await getSupabaseClient();
    const { id: conversationId } = await params;

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errors.unauthorized();
    }

    // Rate limiting - use strict limit for regeneration
    const rateLimitResult = await checkRequestRateLimit(`regenerate:${user.id}`, rateLimits.strict);
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
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return errors.notFound('Conversation');
    }

    // Get the message to regenerate
    const { data: targetMessage, error: msgError } = await supabase
      .from('messages')
      .select('id, role, created_at, content')
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .single();

    if (msgError || !targetMessage) {
      return errors.notFound('Message');
    }

    // Only allow regenerating assistant messages
    if (targetMessage.role !== 'assistant') {
      return errorResponse(403, 'NOT_ASSISTANT', 'Only assistant messages can be regenerated');
    }

    // Get all messages in the conversation to find context
    const { data: allMessages, error: allMsgError } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (allMsgError || !allMessages) {
      log.error('Error fetching messages', { error: allMsgError });
      return errors.serverError();
    }

    // Find the target message index
    const targetIndex = allMessages.findIndex((m) => m.id === messageId);
    if (targetIndex === -1) {
      return errors.notFound('Message not found in conversation');
    }

    // Get the user message that prompted this response (the one right before)
    const previousUserMessage = allMessages
      .slice(0, targetIndex)
      .reverse()
      .find((m) => m.role === 'user');

    if (!previousUserMessage) {
      return errorResponse(
        400,
        'NO_USER_MESSAGE',
        'Cannot find the original user message to regenerate from'
      );
    }

    // Get conversation history up to (but not including) the target assistant message
    const historyMessages = allMessages.slice(0, targetIndex);

    // Soft delete the target message and all messages after it
    const messagesToDelete = allMessages.slice(targetIndex).map((m) => m.id);

    if (messagesToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('messages')
        .update({
          deleted_at: new Date().toISOString(),
          is_regenerated: true,
        })
        .in('id', messagesToDelete);

      if (deleteError) {
        log.error('Error deleting messages for regeneration', { error: deleteError });
        return errors.serverError();
      }
    }

    log.info(`Regenerating from message ${messageId}`, {
      conversationId,
      deletedCount: messagesToDelete.length,
      userId: user.id,
    });

    // Return the context needed for regeneration
    // The client should use this to call /api/chat with the user message
    return successResponse({
      regenerate: true,
      previousUserMessage: {
        id: previousUserMessage.id,
        content: previousUserMessage.content,
        role: previousUserMessage.role,
      },
      history: historyMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      deletedMessageIds: messagesToDelete,
      instructions:
        'Call /api/chat with the previousUserMessage.content and history to generate a new response',
    });
  } catch (error) {
    log.error('Unexpected error in regenerate', error as Error);
    return errors.serverError();
  }
}
