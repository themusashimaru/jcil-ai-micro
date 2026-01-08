/**
 * ADMIN CONVERSATION MESSAGES API
 * PURPOSE: Fetch all messages for a specific conversation (admin only)
 * SECURITY: Admin authentication required, uses service role key
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

const log = logger('AdminConversation');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    // Rate limit by admin
    const rateLimitResult = checkRequestRateLimit(`admin:conversation:${auth.user.id}`, rateLimits.admin);
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const { conversationId } = params;
    const supabase = getSupabaseAdmin();

    // Fetch conversation details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, users(id, email, full_name)')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return errors.notFound('Conversation');
    }

    // Fetch all messages in chronological order
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (msgError) {
      log.error('[Admin API] Error fetching messages:', { error: msgError ?? 'Unknown error' });
      return errors.serverError();
    }

    // Log admin access for audit trail
    log.info(`[Admin Audit] Admin viewed conversation: ${conversationId} (User: ${conversation.user_id})`);

    return successResponse({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        tool_context: conversation.tool_context,
        created_at: conversation.created_at,
        last_message_at: conversation.last_message_at,
        message_count: conversation.message_count,
        user: conversation.users,
      },
      messages: messages || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('[Admin API] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
