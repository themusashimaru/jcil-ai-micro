/**
 * ADMIN CONVERSATION MESSAGES API
 * PURPOSE: Fetch all messages for a specific conversation (admin only)
 * SECURITY: Admin authentication required, uses service role key
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

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

    const { conversationId } = params;
    const supabase = getSupabaseAdmin();

    // Fetch conversation details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, users(id, email, full_name)')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        {
          error: 'Conversation not found',
          message: 'The requested conversation does not exist',
          code: 'NOT_FOUND'
        },
        { status: 404 }
      );
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
      return NextResponse.json(
        {
          error: 'Failed to fetch messages',
          message: 'Unable to load conversation messages',
          code: 'DATABASE_ERROR',
          details: msgError.message
        },
        { status: 500 }
      );
    }

    // Log admin access for audit trail
    log.info(`[Admin Audit] Admin viewed conversation: ${conversationId} (User: ${conversation.user_id})`);

    return NextResponse.json({
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
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
