/**
 * CONVERSATIONS API
 *
 * GET - List all conversations for the authenticated user
 * POST - Create or update a conversation
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import { auditLog } from '@/lib/audit';
import {
  successResponse,
  errors,
  validateBody,
  checkRequestRateLimit,
  rateLimits,
} from '@/lib/api/utils';
import { createConversationSchema } from '@/lib/validation/schemas';
import { z } from 'zod';

const log = logger('ConversationsAPI');

export const runtime = 'nodejs';
export const maxDuration = 30;

// Schema for create/update conversation body
const conversationBodySchema = createConversationSchema.extend({
  id: z.string().uuid().optional(),
  summary: z.string().max(5000).optional().nullable(),
});

/**
 * GET /api/conversations
 * List all conversations for authenticated user
 */
export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;

    // Rate limiting
    const rateLimitResult = await checkRequestRateLimit(
      `conv-list:${auth.user.id}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Fetch conversations with folder info
    const { data: conversations, error } = await auth.supabase
      .from('conversations')
      .select(
        `
        *,
        folder:chat_folders(id, name, color)
      `
      )
      .eq('user_id', auth.user.id)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false });

    if (error) {
      log.error('Error fetching conversations', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return errors.serverError();
    }

    return successResponse({ conversations });
  } catch (error) {
    log.error('Unexpected error in GET', error as Error);
    return errors.serverError();
  }
}

/**
 * POST /api/conversations
 * Create or update a conversation
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    // Rate limiting
    const rateLimitResult = await checkRequestRateLimit(
      `conv-create:${auth.user.id}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Validate request body
    const validation = await validateBody(request, conversationBodySchema);
    if (!validation.success) return validation.response;

    const { id, title, tool_context, summary } = validation.data;

    // Calculate retention date (1 year from now — extends on activity)
    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() + 1);

    if (id) {
      // Update existing conversation
      type ToolContext =
        | 'general'
        | 'email'
        | 'study'
        | 'research'
        | 'code'
        | 'image'
        | 'video'
        | 'sms'
        | 'scripture'
        | null;
      const { data: conversation, error } = await auth.supabase
        .from('conversations')
        .update({
          title,
          tool_context: (tool_context as ToolContext) ?? undefined,
          summary,
          updated_at: new Date().toISOString(),
          retention_until: retentionDate.toISOString(),
        })
        .eq('id', id)
        .eq('user_id', auth.user.id)
        .select()
        .single();

      if (error) {
        log.error('Error updating conversation', error instanceof Error ? error : { error });
        return errors.serverError();
      }

      return successResponse({ conversation });
    } else {
      // Create new conversation
      type ToolCtx =
        | 'general'
        | 'email'
        | 'study'
        | 'research'
        | 'code'
        | 'image'
        | 'video'
        | 'sms'
        | 'scripture';
      const { data: conversation, error } = await auth.supabase
        .from('conversations')
        .insert({
          user_id: auth.user.id,
          title: title || 'New Chat',
          tool_context: (tool_context as ToolCtx) || 'general',
          summary: summary || null,
          has_memory: true,
          message_count: 0,
          last_message_at: new Date().toISOString(),
          retention_until: retentionDate.toISOString(),
        })
        .select()
        .single();

      if (error) {
        log.error('Error creating conversation', error instanceof Error ? error : { error });
        return errors.serverError();
      }

      // CHAT-015: Audit log
      auditLog({
        userId: auth.user.id,
        action: 'conversation.create',
        resourceType: 'conversation',
        resourceId: conversation?.id,
      }).catch((err: unknown) =>
        log.error('auditLog failed', err instanceof Error ? err : undefined)
      );

      return successResponse({ conversation });
    }
  } catch (error) {
    log.error('Unexpected error in POST', error as Error);
    return errors.serverError();
  }
}
