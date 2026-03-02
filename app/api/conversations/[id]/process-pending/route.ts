/**
 * Process Pending Request API
 *
 * Called when user returns to a chat - immediately processes any pending request
 * instead of waiting for the cron job.
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { completeChat } from '@/lib/ai/chat-router';
import { getMainChatSystemPrompt } from '@/lib/prompts/main-chat';
import type { CoreMessage } from 'ai';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const log = logger('ProcessPendingAPI');

export const maxDuration = 120; // Allow up to 2 minutes for processing

function getSupabaseAdmin() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createServiceRoleClient() as any;
  } catch {
    return null;
  }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // CSRF Protection
  const csrfCheck = validateCSRF(_request);
  if (!csrfCheck.valid) return csrfCheck.response!;

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errors.unauthorized();
  }

  // Rate limiting - strict since this triggers AI completion
  const rateLimitResult = await checkRequestRateLimit(
    `process-pending:${user.id}`,
    rateLimits.strict
  );
  if (!rateLimitResult.allowed) return rateLimitResult.response;

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return errors.serverError('Server configuration error');
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
      return successResponse({ status: 'no_pending_request' });
    }

    log.info('[ProcessPending] Found pending request:', pendingRequest.id);

    // Mark as processing
    await supabaseAdmin
      .from('pending_requests')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', pendingRequest.id);

    // Process the request with multi-provider support (Claude primary, xAI fallback)
    const systemPrompt = getMainChatSystemPrompt();
    const result = await completeChat(pendingRequest.messages as CoreMessage[], {
      systemPrompt,
      maxTokens: 4096,
    });

    log.info('[ProcessPending] AI response received', {
      provider: result.providerId,
      model: result.model,
      usedFallback: result.usedFallback,
    });

    const responseText = result.text || '';

    if (!responseText) {
      // Mark as failed
      await supabaseAdmin
        .from('pending_requests')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: 'Empty response from AI',
        })
        .eq('id', pendingRequest.id);

      return successResponse({ status: 'failed', error: 'Empty response' });
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
        log.error('[ProcessPending] Failed to update message:', {
          error: updateError ?? 'Unknown error',
        });
      }
    } else {
      // Create new message
      const { error: msgError } = await supabaseAdmin.from('messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: responseText,
        content_type: 'text',
      });

      if (msgError) {
        log.error('[ProcessPending] Failed to save message:', {
          error: msgError ?? 'Unknown error',
        });
      }
    }

    // Mark the pending request as completed and delete it
    await supabaseAdmin.from('pending_requests').delete().eq('id', pendingRequest.id);

    log.info('[ProcessPending] Successfully processed request:', pendingRequest.id);

    return successResponse({
      status: 'completed',
      content: responseText,
    });
  } catch (error) {
    log.error('[ProcessPending] Error:', error instanceof Error ? error : { error });
    return errors.serverError('Failed to process message');
  }
}
