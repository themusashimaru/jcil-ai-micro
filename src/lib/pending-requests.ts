/**
 * Pending Requests Module
 *
 * Handles saving chat requests as "pending" so background workers can complete them
 * if the user leaves mid-request.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-init Supabase client with service role (bypasses RLS)
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.log('[PendingRequests] Supabase not configured');
    return null;
  }

  supabaseAdmin = createClient(url, serviceKey, {
    auth: { persistSession: false }
  });
  return supabaseAdmin;
}

export interface PendingRequest {
  id: string;
  user_id: string;
  conversation_id: string;
  messages: unknown[];
  tool?: string;
  model?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  response_content?: string;
  response_model?: string;
  error_message?: string;
}

/**
 * Create a pending request before starting AI processing
 * Returns the request ID so it can be marked as completed later
 */
export async function createPendingRequest(params: {
  userId: string;
  conversationId: string;
  messages: unknown[];
  tool?: string;
  model?: string;
}): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.log('[PendingRequests] Supabase not configured');
      return null;
    }

    const { data, error } = await supabase
      .from('pending_requests')
      .insert({
        user_id: params.userId,
        conversation_id: params.conversationId,
        messages: params.messages,
        tool: params.tool,
        model: params.model,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[PendingRequests] Failed to create:', error.message);
      return null;
    }

    console.log('[PendingRequests] Created pending request:', data.id);
    return data.id;
  } catch (e) {
    console.error('[PendingRequests] Error creating:', (e as Error).message);
    return null;
  }
}

/**
 * Mark a pending request as completed (normal flow finished successfully)
 * This removes it from the queue so the background worker won't process it
 */
export async function completePendingRequest(requestId: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase || !requestId) return;

    // Just delete it - we don't need to keep completed requests around
    const { error } = await supabase
      .from('pending_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      console.error('[PendingRequests] Failed to complete:', error.message);
    } else {
      console.log('[PendingRequests] Completed and removed:', requestId);
    }
  } catch (e) {
    console.error('[PendingRequests] Error completing:', (e as Error).message);
  }
}

/**
 * Mark a pending request as failed
 */
export async function failPendingRequest(requestId: string, errorMessage: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase || !requestId) return;

    const { error } = await supabase
      .from('pending_requests')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      })
      .eq('id', requestId);

    if (error) {
      console.error('[PendingRequests] Failed to mark as failed:', error.message);
    }
  } catch (e) {
    console.error('[PendingRequests] Error marking as failed:', (e as Error).message);
  }
}

/**
 * Get pending requests that need processing
 * Only returns requests that:
 * - Are in 'pending' status
 * - Were created more than 10 seconds ago (gives normal flow time to complete)
 * - Were created less than 5 minutes ago (don't process stale requests)
 */
export async function getPendingRequestsToProcess(limit = 5): Promise<PendingRequest[]> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    const tenSecondsAgo = new Date(Date.now() - 10 * 1000).toISOString();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('pending_requests')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', tenSecondsAgo)  // Give normal flow 10 seconds
      .gt('created_at', fiveMinutesAgo) // Don't process requests older than 5 minutes
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[PendingRequests] Failed to fetch:', error.message);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('[PendingRequests] Error fetching:', (e as Error).message);
    return [];
  }
}

/**
 * Mark a request as being processed (prevents other workers from picking it up)
 */
export async function markRequestProcessing(requestId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;

    // Use a conditional update to prevent race conditions
    const { data, error } = await supabase
      .from('pending_requests')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('status', 'pending') // Only update if still pending
      .select('id')
      .single();

    if (error || !data) {
      // Another worker probably got it first
      return false;
    }

    console.log('[PendingRequests] Marked as processing:', requestId);
    return true;
  } catch (e) {
    console.error('[PendingRequests] Error marking as processing:', (e as Error).message);
    return false;
  }
}

/**
 * Save the completed response from background processing
 *
 * DEDUPLICATION: Checks if a similar message was saved in the last 2 minutes
 * to prevent duplicates when onFinish and cron job race.
 */
export async function saveBackgroundResponse(
  requestId: string,
  conversationId: string,
  userId: string,
  content: string,
  model?: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;

    // DEDUPLICATION: Check if a similar assistant message already exists
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: existingMessages } = await supabase
      .from('messages')
      .select('id, content')
      .eq('conversation_id', conversationId)
      .eq('role', 'assistant')
      .gte('created_at', twoMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(5);

    // Check if any recent message has substantially similar content
    if (existingMessages && existingMessages.length > 0) {
      const contentStart = content.slice(0, 200);
      const isDuplicate = existingMessages.some(msg =>
        msg.content && msg.content.slice(0, 200) === contentStart
      );

      if (isDuplicate) {
        console.log('[PendingRequests] Skipping duplicate - message already exists for:', requestId);
        // Still mark as completed so it's cleaned up
        await supabase
          .from('pending_requests')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            response_content: '[DEDUPLICATED]',
          })
          .eq('id', requestId);
        return;
      }
    }

    // Save the message to the messages table
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: content,
        content_type: 'text',
      });

    if (msgError) {
      console.error('[PendingRequests] Failed to save message:', msgError.message);
      throw msgError;
    }

    // Mark the pending request as completed
    const { error: updateError } = await supabase
      .from('pending_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        response_content: content.substring(0, 1000), // Store truncated for debugging
        response_model: model,
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('[PendingRequests] Failed to update status:', updateError.message);
    }

    console.log('[PendingRequests] Background response saved for:', requestId);
  } catch (e) {
    console.error('[PendingRequests] Error saving response:', (e as Error).message);
    await failPendingRequest(requestId, (e as Error).message);
  }
}

/**
 * Clean up old completed/failed requests
 */
export async function cleanupOldRequests(): Promise<number> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return 0;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('pending_requests')
      .delete()
      .in('status', ['completed', 'failed'])
      .lt('created_at', oneHourAgo)
      .select('id');

    if (error) {
      console.error('[PendingRequests] Cleanup failed:', error.message);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log('[PendingRequests] Cleaned up', count, 'old requests');
    }
    return count;
  } catch (e) {
    console.error('[PendingRequests] Cleanup error:', (e as Error).message);
    return 0;
  }
}
