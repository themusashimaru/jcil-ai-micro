import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const searchQuery = searchParams.get('search') || '';

    // First, get all users with emails for lookup
    const { data: allUsers, error: usersError } = await supabase
      .rpc('get_all_users_for_admin');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    // Create user lookup map
    const userLookup = new Map(
      (allUsers || []).map((u: any) => [u.id, { email: u.email, tier: u.subscription_tier }])
    );

    // Get all conversations with user details
    let conversationsQuery = supabase
      .from('conversations')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        user_id
      `)
      .order('updated_at', { ascending: false })
      .limit(100);

    // Filter by specific user if provided
    if (userId) {
      conversationsQuery = conversationsQuery.eq('user_id', userId);
    }

    const { data: conversations, error: convsError } = await conversationsQuery;

    if (convsError) {
      console.error('Error fetching conversations:', convsError);
      throw convsError;
    }

    // For each conversation, get message count and latest message
    const conversationsWithDetails = await Promise.all(
      (conversations || []).map(async (conv) => {
        // Get user details from lookup map
        const userDetails = userLookup.get(conv.user_id) || { email: 'Unknown', tier: 'free' };

        // Get message count
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        // Get latest message
        const { data: latestMessage } = await supabase
          .from('messages')
          .select('content, created_at, role')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          id: conv.id,
          title: conv.title,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          user_id: conv.user_id,
          user_email: userDetails.email,
          user_tier: userDetails.tier,
          message_count: count || 0,
          latest_message: latestMessage ? {
            content: latestMessage.content?.substring(0, 150) + (latestMessage.content?.length > 150 ? '...' : ''),
            created_at: latestMessage.created_at,
            role: latestMessage.role,
          } : null,
        };
      })
    );

    // Apply search filter if provided
    let filteredConversations = conversationsWithDetails;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredConversations = conversationsWithDetails.filter(conv =>
        conv.user_email.toLowerCase().includes(query) ||
        conv.title?.toLowerCase().includes(query) ||
        conv.latest_message?.content?.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({
      conversations: filteredConversations,
      total: filteredConversations.length,
    });
  } catch (error: any) {
    console.error('Conversations fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations', details: error.message },
      { status: 500 }
    );
  }
}
