/**
 * CONVERSATIONS API
 *
 * GET - List all conversations for the authenticated user
 * POST - Create or update a conversation
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';
import {
  successResponse,
  errors,
  validateBody,
  checkRequestRateLimit,
  rateLimits,
} from '@/lib/api/utils';
import { createConversationSchema } from '@/lib/validation/schemas';
import { z } from 'zod';

const log = logger('ConversationsAPI');

export const runtime = 'nodejs';
export const maxDuration = 30;

// Schema for create/update conversation body
const conversationBodySchema = createConversationSchema.extend({
  id: z.string().uuid().optional(),
  summary: z.string().max(5000).optional().nullable(),
});

// Get authenticated Supabase client
async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently handle cookie errors
          }
        },
      },
    }
  );
}

/**
 * GET /api/conversations
 * List all conversations for authenticated user
 */
export async function GET() {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) {
      log.error('Auth error getting user', { error: authError.message, code: authError.code });
      return errors.unauthorized();
    }
    if (!user) {
      log.warn('No user in session - not authenticated');
      return errors.unauthorized();
    }
    log.debug('User authenticated for conversation list', { userId: user.id.slice(0, 8) + '...' });

    // Rate limiting
    const rateLimitResult = await checkRequestRateLimit(
      `conv-list:${user.id}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // User authenticated successfully - logging minimized for privacy

    // Fetch conversations with folder info
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(
        `
        *,
        folder:chat_folders(id, name, color)
      `
      )
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false });

    if (error) {
      log.error('Error fetching conversations', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return errors.serverError();
    }

    log.debug('Fetched conversations successfully', { count: conversations?.length || 0 });

    return successResponse({ conversations });
  } catch (error) {
    log.error('Unexpected error in GET', error as Error);
    return errors.serverError();
  }
}

/**
 * POST /api/conversations
 * Create or update a conversation
 */
export async function POST(request: NextRequest) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errors.unauthorized();
    }

    // Rate limiting
    const rateLimitResult = await checkRequestRateLimit(
      `conv-create:${user.id}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Validate request body
    const validation = await validateBody(request, conversationBodySchema);
    if (!validation.success) return validation.response;

    const { id, title, tool_context, summary } = validation.data;

    // User authenticated - processing conversation request

    // Calculate retention date (30 days from now by default)
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + 30);

    if (id) {
      // Update existing conversation
      // Updating existing conversation
      const { data: conversation, error } = await supabase
        .from('conversations')
        .update({
          title,
          tool_context,
          summary,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        log.error('Error updating conversation', error instanceof Error ? error : { error });
        return errors.serverError();
      }

      // Conversation updated successfully
      return successResponse({ conversation });
    } else {
      // Create new conversation
      // Creating new conversation
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: title || 'New Chat',
          tool_context: tool_context || 'general',
          summary: summary || null,
          has_memory: true,
          message_count: 0,
          last_message_at: new Date().toISOString(),
          retention_until: retentionDate.toISOString(),
        })
        .select()
        .single();

      if (error) {
        log.error('Error creating conversation', error instanceof Error ? error : { error });
        return errors.serverError();
      }

      // Conversation created successfully
      return successResponse({ conversation });
    }
  } catch (error) {
    log.error('Unexpected error in POST', error as Error);
    return errors.serverError();
  }
}
