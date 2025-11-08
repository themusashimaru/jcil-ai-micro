import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
  }

  try {
    const { conversationId } = await params;

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        user_id,
        user_profiles!inner(email, subscription_tier, created_at)
      `)
      .eq('id', conversationId)
      .single();

    if (convError) {
      console.error('Error fetching conversation:', convError);
      throw convError;
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get all messages for this conversation
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    // Get all attachments for this conversation
    const { data: attachments, error: attachmentsError } = await supabase
      .from('attachments')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (attachmentsError) {
      console.error('Error fetching attachments:', attachmentsError);
      throw attachmentsError;
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        user_id: conversation.user_id,
        user_email: conversation.user_profiles?.email || 'Unknown',
        user_tier: conversation.user_profiles?.subscription_tier || 'free',
        user_joined: conversation.user_profiles?.created_at,
      },
      messages: messages || [],
      attachments: attachments || [],
      stats: {
        total_messages: messages?.length || 0,
        user_messages: messages?.filter(m => m.role === 'user').length || 0,
        assistant_messages: messages?.filter(m => m.role === 'assistant').length || 0,
        total_attachments: attachments?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('Conversation detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation details', details: error.message },
      { status: 500 }
    );
  }
}
