/**
 * Action Commands for Code Lab Chat
 *
 * Handles immediate-execution slash commands like /clear, /reset, /compact
 * that modify session state rather than generating AI responses.
 */

import { logger } from '@/lib/logger';
import { generateConversationSummary } from './conversation-summary';
import crypto from 'crypto';

const log = logger('CodeLabChat:ActionCommands');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Execute an action command and return the response text.
 * Returns null if the action response doesn't match a known command.
 */
export async function executeActionCommand(
  actionResponse: string,
  sessionId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<Response> {
  const encoder = new TextEncoder();

  if (actionResponse.includes('History cleared')) {
    // Delete all messages for this session
    await (supabase.from('code_lab_messages') as AnySupabase).delete().eq('session_id', sessionId);
    // Reset message count
    await (supabase.from('code_lab_sessions') as AnySupabase)
      .update({ message_count: 0 })
      .eq('id', sessionId);
    log.info('Session history cleared', { sessionId });
  } else if (actionResponse.includes('Session reset')) {
    // Delete all messages and reset session
    await (supabase.from('code_lab_messages') as AnySupabase).delete().eq('session_id', sessionId);
    await (supabase.from('code_lab_sessions') as AnySupabase)
      .update({
        message_count: 0,
        has_summary: false,
        last_summary_at: null,
      })
      .eq('id', sessionId);
    log.info('Session reset', { sessionId });
  } else if (actionResponse.includes('Context compacted')) {
    // Trigger summarization of older messages
    const { data: allMessages } = await (supabase.from('code_lab_messages') as AnySupabase)
      .select('id, role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (allMessages && allMessages.length > 5) {
      // Summarize older messages (keep last 5)
      const toSummarize = allMessages.slice(0, -5);
      const summary = await generateConversationSummary(
        toSummarize.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        }))
      );

      // SAFETY FIX: Insert summary FIRST, then delete old messages
      // This ensures we never lose data - if insert fails, we keep old messages
      const summaryId = generateId();
      const { error: insertError } = await (
        supabase.from('code_lab_messages') as AnySupabase
      ).insert({
        id: summaryId,
        session_id: sessionId,
        role: 'system',
        content: summary,
        created_at: new Date().toISOString(),
        type: 'summary',
      });

      if (insertError) {
        log.error('Failed to insert summary, keeping original messages', {
          error: insertError.message,
        });
      } else {
        // Only delete old messages if summary was successfully saved
        const idsToDelete = toSummarize.map((m: { id: string }) => m.id);
        const { error: deleteError } = await (supabase.from('code_lab_messages') as AnySupabase)
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          log.warn('Failed to delete old messages after summarization', {
            error: deleteError.message,
          });
        }

        await (supabase.from('code_lab_sessions') as AnySupabase)
          .update({ has_summary: true, last_summary_at: new Date().toISOString() })
          .eq('id', sessionId);

        log.info('Context compacted', { sessionId, summarizedCount: toSummarize.length });
      }
    }
  }

  // Return success response
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(actionResponse));
        controller.close();
      },
    }),
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Action-Command': 'true',
      },
    }
  );
}
