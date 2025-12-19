/**
 * CONVERSATIONS API
 *
 * GET - List all conversations for the authenticated user
 * POST - Create or update a conversation
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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
      console.error('[API] GET /api/conversations - No authenticated user:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[API] GET /api/conversations - User ID:', user.id, 'Email:', user.email);

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
      console.error('[API] Error fetching conversations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[API] GET /api/conversations - Found', conversations?.length || 0, 'conversations for user', user.id);
    console.log('[API] Conversations:', conversations);

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('[API] Error in GET /api/conversations:', error);
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
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[API] POST /api/conversations - No authenticated user:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, tool_context, summary } = body;

    console.log('[API] POST /api/conversations - User ID:', user.id, 'Email:', user.email);
    console.log('[API] Request body:', { id, title, tool_context, summary });

    // Calculate retention date (30 days from now by default)
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + 30);

    if (id) {
      // Update existing conversation
      console.log('[API] Updating conversation with ID:', id);
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
        console.error('[API] Error updating conversation:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[API] Updated conversation:', conversation);
      return NextResponse.json({ conversation });
    } else {
      // Create new conversation
      console.log('[API] Creating new conversation for user:', user.id);
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
        console.error('[API] Error creating conversation:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
        });
        return NextResponse.json({ error: error.message, details: error.details }, { status: 500 });
      }

      console.log('[API] Created new conversation:', conversation);
      return NextResponse.json({ conversation });
    }
  } catch (error) {
    console.error('[API] Error in POST /api/conversations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
