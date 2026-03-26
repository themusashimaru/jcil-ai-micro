/**
 * CONVERSATION HISTORY API
 *
 * GET - Fetch recent conversations with their messages for context
 * Used to provide AI with access to previous conversation history
 */

import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const log = logger('ConversationHistoryAPI');

/**
 * GET /api/conversations/history
 * Fetch recent conversations with messages for AI context
 * Query params:
 *  - limit: number of recent conversations to fetch (default: 10, max: 20)
 *  - exclude: conversation ID to exclude (usually current conversation)
 */
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;
    const { user, supabase } = auth;

    const { searchParams } = new URL(request.url);

    // Parse query params
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);
    const excludeId = searchParams.get('exclude');

    // Fetch recent conversations
    let query = supabase
      .from('conversations')
      .select('id, title, tool_context, created_at, last_message_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    // Exclude current conversation if specified
    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: conversations, error: convError } = await query;

    if (convError) {
      log.error('Error fetching conversations:', { error: convError ?? 'Unknown error' });
      return errors.serverError('Failed to fetch conversations');
    }

    // Fetch messages for each conversation (limit to last 10 messages per conversation)
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conv) => {
        const { data: messages, error: msgError } = await supabase
          .from('messages')
          .select('role, content, content_type, created_at')
          .eq('conversation_id', conv.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .limit(10);

        if (msgError) {
          log.error('Error fetching messages for conversation:', {
            error: msgError ?? 'Unknown error',
          });
          return {
            ...conv,
            messages: [],
          };
        }

        return {
          ...conv,
          messages: messages || [],
        };
      })
    );

    return successResponse({
      conversations: conversationsWithMessages,
      count: conversationsWithMessages.length,
    });
  } catch (error) {
    log.error(
      'Error in GET /api/conversations/history:',
      error instanceof Error ? error : { error }
    );
    return errors.serverError();
  }
}
