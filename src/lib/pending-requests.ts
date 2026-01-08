/**
 * Pending Requests Module
 *
 * Handles saving chat requests as "pending" so background workers can complete them
 * if the user leaves mid-request.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const log = logger('PendingRequests');

// Lazy-init Supabase client with service role (bypasses RLS)
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    log.debug('Supabase not configured');
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
      log.debug('Supabase not configured');
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
      log.error('Failed to create pending request', { error: error.message });
      return null;
    }

    log.debug('Created pending request', { requestId: data.id });
    return data.id;
  } catch (e) {
    log.error('Error creating pending request', e as Error);
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
      log.error('Failed to complete pending request', { error: error.message });
    } else {
      log.debug('Completed and removed pending request', { requestId });
    }
  } catch (e) {
    log.error('Error completing pending request', e as Error);
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
      log.error('Failed to mark request as failed', { error: error.message });
    }
  } catch (e) {
    log.error('Error marking request as failed', e as Error);
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
      log.error('Failed to fetch pending requests', { error: error.message });
      return [];
    }

    return data || [];
  } catch (e) {
    log.error('Error fetching pending requests', e as Error);
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

    log.debug('Marked request as processing', { requestId });
    return true;
  } catch (e) {
    log.error('Error marking request as processing', e as Error);
    return false;
  }
}

/**
 * Save the completed response from background processing
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
      log.error('Failed to save message', { error: msgError.message });
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
      log.error('Failed to update status', { error: updateError.message });
    }

    log.info('Background response saved', { requestId });
  } catch (e) {
    log.error('Error saving background response', e as Error);
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
      log.error('Cleanup failed', { error: error.message });
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      log.info('Cleaned up old requests', { count });
    }
    return count;
  } catch (e) {
    log.error('Cleanup error', e as Error);
    return 0;
  }
}
