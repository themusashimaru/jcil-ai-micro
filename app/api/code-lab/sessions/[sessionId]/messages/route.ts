/**
 * CODE LAB SESSION MESSAGES API
 *
 * Get messages for a session
 */

import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { logger } from '@/lib/logger';
// HIGH-006: Add rate limiting
import { rateLimiters } from '@/lib/security/rate-limit';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('CodeLabMessages');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errors.unauthorized();
    }

    // HIGH-006: Rate limiting for GET
    const rateLimit = await rateLimiters.codeLabRead(user.id);
    if (!rateLimit.allowed) {
      return errors.rateLimited(rateLimit.retryAfter);
    }

    // Verify session belongs to user
    const { data: session } = await (supabase.from('code_lab_sessions') as AnySupabase)
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (!session) {
      return errors.sessionNotFound();
    }

    // Get messages
    const { data: messages, error } = await (supabase.from('code_lab_messages') as AnySupabase)
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      log.error(
        '[CodeLab API] Error fetching messages:',
        error instanceof Error ? error : { error }
      );
      return successResponse({ messages: [] });
    }

    // Transform to expected format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedMessages = (messages || []).map((m: any) => ({
      id: m.id,
      sessionId: m.session_id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      type: m.type,
      codeOutput: m.code_output,
      searchOutput: m.search_output,
      summaryOutput: m.summary_output,
    }));

    return successResponse({ messages: formattedMessages });
  } catch (error) {
    log.error('[CodeLab API] Error:', error instanceof Error ? error : { error });
    return successResponse({ messages: [] });
  }
}
