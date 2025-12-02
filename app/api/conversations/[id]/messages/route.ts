/**
 * CONVERSATION MESSAGES API
 *
 * GET - Load all messages for a conversation
 * POST - Save a new message to a conversation
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
 * GET /api/conversations/[id]/messages
 * Load all messages for a conversation
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseClient();
    const { id } = await params;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Fetch messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error in GET /api/conversations/[id]/messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/[id]/messages
 * Save a new message to a conversation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseClient();
    const { id: conversationId } = await params;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      role,
      content,
      content_type = 'text',
      model_used = null,
      temperature = null,
      tokens_used = null,
      attachment_urls = null,
      image_url = null, // For AI-generated images
      prompt = null, // For image generation requests
      type = 'text', // Message type: text, image, tool
    } = body;

    // Normalize content: handle different message types
    // For image messages, content might be undefined but prompt exists
    const normalizedContent = typeof content === 'string'
      ? content
      : (typeof prompt === 'string' ? prompt : '');

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Calculate retention date (30 days from now by default)
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + 30);

    // Handle attachment URLs (include image_url if present)
    const allAttachments = attachment_urls ? [...attachment_urls] : [];
    if (image_url) {
      allAttachments.push(image_url);
    }

    // Safe preview for logging (never call slice on undefined)
    const contentPreview = normalizedContent.slice(0, 50) || '[no content]';

    console.log('[API] Attempting to save message:', {
      conversation_id: conversationId,
      user_id: user.id,
      role,
      type,
      content_preview: contentPreview,
    });

    // Save message with normalized content
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role,
        content: normalizedContent,
        content_type: type === 'image' ? 'image' : content_type,
        model_used,
        temperature,
        tokens_used,
        has_attachments: allAttachments.length > 0,
        attachment_urls: allAttachments.length > 0 ? allAttachments : null,
        retention_until: retentionDate.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Error saving message:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[API] Message saved successfully:', message.id);

    // Note: message_count is incremented by database trigger (increment_conversation_message_count)
    // We only update last_message_at here to avoid duplicate counting
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Error updating conversation timestamp:', updateError);
      // Don't fail the request if this fails
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error in POST /api/conversations/[id]/messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
