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

    // Save the message to the database
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
