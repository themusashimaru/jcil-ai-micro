import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { conversationId } = await params;

    // Create service role client
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get conversation
    const { data: conversation, error: convError } = await admin
      .from('conversations')
      .select('id, title, created_at, user_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get user email
    const { data: authData } = await admin.auth.admin.listUsers();
    const user = authData?.users?.find(u => u.id === conversation.user_id);
    const userEmail = user?.email || 'Unknown';

    // Get all messages
    const { data: messages } = await admin
      .from('messages')
      .select('id, role, content, created_at, file_url, file_type, file_size')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    // Extract attachments from messages
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
        user_id: conversation.user_id,
        user_email: userEmail,
        user_tier: 'free',
      },
      messages: messages || [],
      attachments,
      stats: {
        total_messages: messages?.length || 0,
        user_messages: messages?.filter(m => m.role === 'user').length || 0,
        assistant_messages: messages?.filter(m => m.role === 'assistant').length || 0,
        total_attachments: attachments.length,
      },
    });

  } catch (error: any) {
    console.error('[CONVERSATION_DETAIL] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch conversation',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
