import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
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

    // Create service role client
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Parse query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Fetch all users
    const { data: authData } = await admin.auth.admin.listUsers();
    const users = authData?.users || [];

    // If no userId specified, return list of users with conversation counts
    if (!userId) {
      // Get all conversations
      const { data: allConversations } = await admin
        .from('conversations')
        .select('user_id');

      // Count conversations per user
      const conversationCounts = new Map<string, number>();
      (allConversations || []).forEach(conv => {
        conversationCounts.set(
          conv.user_id,
          (conversationCounts.get(conv.user_id) || 0) + 1
        );
      });

      // Build user list with conversation counts
      const userList = users
        .map(u => ({
          user_id: u.id,
          user_email: u.email || 'Unknown',
          conversation_count: conversationCounts.get(u.id) || 0,
          created_at: u.created_at,
        }))
        .filter(u => u.conversation_count > 0) // Only show users with conversations
        .sort((a, b) => a.user_email.localeCompare(b.user_email)); // Alphabetical

      return NextResponse.json({
        users: userList,
        total: userList.length,
      });
    }

    // If userId specified, return that user's conversations
    const { data: conversations } = await admin
      .from('conversations')
      .select('id, title, created_at, user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        user_email: users.find(u => u.id === userId)?.email || 'Unknown',
        conversations: [],
        total: 0
      });
    }

    // Enrich conversations with message info
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        // Get message count
        const { count } = await admin
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        // Get latest message
        const { data: latest } = await admin
          .from('messages')
          .select('content, created_at, role')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: conv.id,
          title: conv.title,
          created_at: new Date(conv.created_at).toISOString(),
          message_count: count || 0,
          latest_message: latest ? {
            content: latest.content?.substring(0, 150) || '',
            created_at: new Date(latest.created_at).toISOString(),
            role: latest.role,
          } : null,
        };
      })
    );

    return NextResponse.json({
      user_email: users.find(u => u.id === userId)?.email || 'Unknown',
      conversations: enriched,
      total: enriched.length,
    });

  } catch (error: any) {
    console.error('[CONVERSATIONS] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch conversations',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
