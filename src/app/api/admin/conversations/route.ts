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

    // Create service role client (bypasses RLS)
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Parse query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Fetch all users with auth.admin
    const { data: authData } = await admin.auth.admin.listUsers();
    const users = authData?.users || [];

    // Create email lookup
    const emailMap = new Map(users.map(u => [u.id, u.email || 'Unknown']));

    // Fetch conversations
    let query = admin
      .from('conversations')
      .select('id, title, created_at, updated_at, user_id')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: conversations, error: convError } = await query;

    console.log('[CONVERSATIONS] Query result:', {
      count: conversations?.length,
      error: convError,
      hasData: !!conversations
    });

    if (convError) {
      console.error('[CONVERSATIONS] Query error:', convError);
      return NextResponse.json({
        error: 'Failed to fetch conversations',
        details: convError.message
      }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      console.log('[CONVERSATIONS] No conversations found');
      return NextResponse.json({ conversations: [], total: 0 });
    }

    // Enrich conversations
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
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          user_id: conv.user_id,
          user_email: emailMap.get(conv.user_id) || 'Unknown',
          user_tier: 'free',
          message_count: count || 0,
          latest_message: latest ? {
            content: latest.content?.substring(0, 150) || '',
            created_at: latest.created_at,
            role: latest.role,
          } : null,
        };
      })
    );

    return NextResponse.json({
      conversations: enriched,
      total: enriched.length,
    });

  } catch (error: any) {
    console.error('[CONVERSATIONS] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch conversations',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
