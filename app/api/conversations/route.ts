/**
 * CONVERSATIONS API
 *
 * GET - List all conversations for the authenticated user
 * POST - Create or update a conversation
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';

const log = logger('ConversationsAPI');

export const runtime = 'nodejs';
export const maxDuration = 30;

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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // User authenticated successfully - logging minimized for privacy

    // Fetch conversations with folder info
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        folder:chat_folders(id, name, color)
      `)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false });

    if (error) {
      log.error('Error fetching conversations', error instanceof Error ? error : { error });
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    // Successfully fetched conversations

    return NextResponse.json({ conversations });
  } catch (error) {
    log.error('Unexpected error in GET', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, tool_context, summary } = body;

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
        return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
      }

      // Conversation updated successfully
      return NextResponse.json({ conversation });
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
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
      }

      // Conversation created successfully
      return NextResponse.json({ conversation });
    }
  } catch (error) {
    log.error('Unexpected error in POST', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
