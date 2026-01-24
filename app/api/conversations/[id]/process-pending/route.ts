/**
 * Process Pending Request API
 *
 * Called when user returns to a chat - immediately processes any pending request
 * instead of waiting for the cron job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createAnthropicCompletion } from '@/lib/anthropic/client';
import type { CoreMessage } from 'ai';
import { logger } from '@/lib/logger';

const log = logger('ProcessPendingAPI');

export const maxDuration = 120; // Allow up to 2 minutes for processing

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  // Get authenticated user
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    // Check for pending request for this conversation
    const { data: pendingRequest, error: fetchError } = await supabaseAdmin
      .from('pending_requests')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !pendingRequest) {
      // No pending request - that's fine, maybe it was already processed
      return NextResponse.json({ status: 'no_pending_request' });
    }

    log.info('[ProcessPending] Found pending request:', pendingRequest.id);

    // Mark as processing
    await supabaseAdmin
      .from('pending_requests')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', pendingRequest.id);

    // Process the request with Claude
    const result = await createAnthropicCompletion({
      messages: pendingRequest.messages as CoreMessage[],
      userId: user.id,
    });

    const responseText = result.text || '';

    if (!responseText) {
      // Mark as failed
      await supabaseAdmin
        .from('pending_requests')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: 'Empty response from AI'
        })
        .eq('id', pendingRequest.id);

      return NextResponse.json({ status: 'failed', error: 'Empty response' });
    }

    // Check if there's already a recent assistant message (partial content from interrupted stream)
    // If so, update it instead of creating a duplicate
    const { data: lastMessages } = await supabaseAdmin
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(2);

    let shouldUpdate = false;
    let existingMessageId: string | null = null;

    if (lastMessages && lastMessages.length > 0) {
      const lastMessage = lastMessages[0];
      // If last message is from assistant, check if it's incomplete (shorter than full response)
      // or if it was created around the same time as the pending request
      if (lastMessage.role === 'assistant') {
        const pendingCreatedAt = new Date(pendingRequest.created_at).getTime();
        const messageCreatedAt = new Date(lastMessage.created_at).getTime();
        // If message was created within 30 seconds of pending request, it's likely a partial save
        const timeDiff = Math.abs(messageCreatedAt - pendingCreatedAt);
        if (timeDiff < 30000 && responseText.length > (lastMessage.content?.length || 0)) {
          // This looks like a partial message - update it instead of creating new
          shouldUpdate = true;
          existingMessageId = lastMessage.id;
          log.info('[ProcessPending] Found partial message to update:', {
            messageId: existingMessageId,
            oldLength: lastMessage.content?.length || 0,
            newLength: responseText.length,
          });
        }
      }
    }

    // Save or update the message in the database
    if (shouldUpdate && existingMessageId) {
      // Update existing partial message
      const { error: updateError } = await supabaseAdmin
        .from('messages')
        .update({
          content: responseText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMessageId);

      if (updateError) {
        log.error('[ProcessPending] Failed to update message:', { error: updateError ?? 'Unknown error' });
      }
    } else {
      // Create new message
      const { error: msgError } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          content: responseText,
          content_type: 'text',
        });

      if (msgError) {
        log.error('[ProcessPending] Failed to save message:', { error: msgError ?? 'Unknown error' });
      }
    }

    // Mark the pending request as completed and delete it
    await supabaseAdmin
      .from('pending_requests')
      .delete()
      .eq('id', pendingRequest.id);

    log.info('[ProcessPending] Successfully processed request:', pendingRequest.id);

    return NextResponse.json({
      status: 'completed',
      content: responseText,
    });

  } catch (error) {
    log.error('[ProcessPending] Error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { status: 'error', error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
