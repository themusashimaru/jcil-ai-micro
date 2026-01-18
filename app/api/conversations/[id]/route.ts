/**
 * SINGLE CONVERSATION API
 *
 * GET - Get a single conversation by ID
 * DELETE - Soft-delete a conversation (sets deleted_at)
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

const log = logger('ConversationAPI');

export const runtime = 'nodejs';
export const maxDuration = 30;

// Get authenticated Supabase client
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

/**
 * GET /api/conversations/[id]
 * Get a single conversation by ID
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await getSupabaseClient();

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return errors.badRequest('Invalid conversation ID format');
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errors.unauthorized();
    }

    // Rate limiting
    const rateLimitResult = await checkRequestRateLimit(`conv-get:${user.id}`, rateLimits.standard);
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Fetch conversation
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (error || !conversation) {
      return errors.notFound('Conversation not found');
    }

    return successResponse({ conversation });
  } catch (error) {
    log.error('Unexpected error in GET', error as Error);
    return errors.serverError();
  }
}

/**
 * DELETE /api/conversations/[id]
 * Soft-delete a conversation (sets deleted_at timestamp)
 * Also soft-deletes all associated messages
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { id } = await params;
    const supabase = await getSupabaseClient();

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return errors.badRequest('Invalid conversation ID format');
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errors.unauthorized();
    }

    // Rate limiting (stricter for delete operations)
    const rateLimitResult = await checkRequestRateLimit(
      `conv-delete:${user.id}`,
      rateLimits.strict
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // First verify the conversation belongs to this user and isn't already deleted
    const { data: existingConv, error: fetchError } = await supabase
      .from('conversations')
      .select('id, user_id, deleted_at')
      .eq('id', id)
      .single();

    if (fetchError || !existingConv) {
      return errors.notFound('Conversation not found');
    }

    if (existingConv.user_id !== user.id) {
      log.warn('Unauthorized delete attempt', { userId: user.id, conversationId: id });
      return errors.forbidden('You do not have permission to delete this conversation');
    }

    if (existingConv.deleted_at) {
      return errors.badRequest('Conversation already deleted');
    }

    const deletedAt = new Date().toISOString();

    // Soft-delete all messages in this conversation
    const { error: messagesError } = await supabase
      .from('messages')
      .update({ deleted_at: deletedAt })
      .eq('conversation_id', id)
      .is('deleted_at', null);

    if (messagesError) {
      log.error(
        'Error soft-deleting messages',
        messagesError instanceof Error ? messagesError : { error: messagesError }
      );
      // Continue anyway - we still want to delete the conversation
    }

    // Soft-delete the conversation
    const { error: deleteError } = await supabase
      .from('conversations')
      .update({ deleted_at: deletedAt })
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      log.error(
        'Error soft-deleting conversation',
        deleteError instanceof Error ? deleteError : { error: deleteError }
      );
      return errors.serverError();
    }

    log.info('Conversation soft-deleted', { conversationId: id, userId: user.id });

    return successResponse({
      deleted: true,
      conversationId: id,
      deletedAt,
    });
  } catch (error) {
    log.error('Unexpected error in DELETE', error as Error);
    return errors.serverError();
  }
}
