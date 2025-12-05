/**
 * Token Usage Tracking
 *
 * Tracks token usage per user for billing/limits.
 * Inserts to Supabase token_usage table using service role.
 *
 * Features:
 * - Feature flag (ENABLE_USAGE_TRACKING)
 * - Silent failure (won't break chat if tracking fails)
 * - Guards against invalid values
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const TRACKING_ENABLED = process.env.ENABLE_USAGE_TRACKING === 'true';

// Lazy-init Supabase client with service role (bypasses RLS for inserts)
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.log('[usage] Supabase not configured for token tracking');
    return null;
  }

  supabaseAdmin = createClient(url, serviceKey, {
    auth: { persistSession: false }
  });

  return supabaseAdmin;
}

export interface UsagePayload {
  userId: string;
  conversationId?: string;
  model: string;
  route: 'chat' | 'search' | 'image' | 'analysis';
  tool: 'streamText' | 'generateText' | 'responses' | 'responses.stream' | 'dall-e';
  inputTokens: number;
  outputTokens: number;
}

/**
 * Track token usage to database
 * Silent on failure - never breaks the chat flow
 */
export async function trackTokenUsage(payload: UsagePayload): Promise<void> {
  try {
    // Skip if tracking disabled
    if (!TRACKING_ENABLED) return;

    const supabase = getSupabaseAdmin();
    if (!supabase) return;

    // Guard against invalid values
    const record = {
      user_id: payload.userId,
      conversation_id: payload.conversationId ?? null,
      model: payload.model || 'unknown',
      route: payload.route || 'chat',
      tool: payload.tool || 'unknown',
      input_tokens: Math.max(0, Math.floor(payload.inputTokens || 0)),
      output_tokens: Math.max(0, Math.floor(payload.outputTokens || 0)),
    };

    const { error } = await supabase.from('token_usage').insert(record);

    if (error) {
      console.log('[usage] Insert error:', error.message);
    }
  } catch (e) {
    // Silent failure - log but don't throw
    console.log('[usage] Tracking failed:', (e as Error).message);
  }
}

/**
 * Save assistant message to database
 * Used by onFinish callback to ensure messages are saved even if client disconnects
 * Silent on failure - never breaks the chat flow
 */
export async function saveAssistantMessage(payload: {
  conversationId: string;
  userId: string;
  content: string;
  model?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.log('[usage] Supabase not configured for message saving');
      return;
    }

    // Skip if no content
    if (!payload.content || payload.content.trim().length === 0) {
      console.log('[usage] Skipping empty message save');
      return;
    }

    // Calculate retention date (30 days from now)
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + 30);

    const { error } = await supabase.from('messages').insert({
      conversation_id: payload.conversationId,
      user_id: payload.userId,
      role: 'assistant',
      content: payload.content,
      content_type: 'text',
      model_used: payload.model || null,
      retention_until: retentionDate.toISOString(),
    });

    if (error) {
      console.log('[usage] Message save error:', error.message);
    } else {
      console.log('[usage] Assistant message saved to DB successfully');
    }
  } catch (e) {
    // Silent failure - log but don't throw
    console.log('[usage] Message save failed:', (e as Error).message);
  }
}

/**
 * Get total token usage for a user in a time period
 * Useful for billing/limits dashboard
 */
export async function getUserTokenUsage(
  userId: string,
  since?: Date
): Promise<{ inputTokens: number; outputTokens: number } | null> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;

    let query = supabase
      .from('token_usage')
      .select('input_tokens, output_tokens')
      .eq('user_id', userId);

    if (since) {
      query = query.gte('created_at', since.toISOString());
    }

    const { data, error } = await query;

    if (error || !data) return null;

    return data.reduce(
      (acc, row) => ({
        inputTokens: acc.inputTokens + (row.input_tokens || 0),
        outputTokens: acc.outputTokens + (row.output_tokens || 0),
      }),
      { inputTokens: 0, outputTokens: 0 }
    );
  } catch {
    return null;
  }
}
