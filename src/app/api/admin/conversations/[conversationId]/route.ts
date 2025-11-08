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

    // STEP 1: Fetch all users to get email (user_profiles doesn't have email column)
    const { data: allUsers, error: usersError } = await supabase
      .rpc('get_all_users_for_admin');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    // Create lookup map for user details
    const userLookup = new Map(
      (allUsers || []).map((u: any) => [u.id, {
        email: u.email,
        tier: u.subscription_tier,
        created_at: u.created_at
      }])
    );

    // STEP 2: Get conversation details (without trying to join email from user_profiles)
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        user_id
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

    // Get user details from lookup map
    const userDetails = (userLookup.get(conversation.user_id) || {
      email: 'Unknown',
      tier: 'free',
      created_at: null
    }) as { email: string; tier: string; created_at: string | null };

    // STEP 3: Get all messages for this conversation
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    // STEP 4: Extract attachments from messages (attachments are stored in messages table)
    const attachments = (messages || [])
      .filter(m => m.file_url)
      .map(m => ({
        id: m.id,
        message_id: m.id,
        conversation_id: conversationId,
        file_url: m.file_url,
        file_type: m.file_type,
        file_size: m.file_size,
        created_at: m.created_at,
        role: m.role,
      }));

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        user_id: conversation.user_id,
        user_email: userDetails.email,
        user_tier: userDetails.tier,
        user_joined: userDetails.created_at,
      },
      messages: messages || [],
      attachments: attachments,
      stats: {
        total_messages: messages?.length || 0,
        user_messages: messages?.filter(m => m.role === 'user').length || 0,
        assistant_messages: messages?.filter(m => m.role === 'assistant').length || 0,
        total_attachments: attachments.length,
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
