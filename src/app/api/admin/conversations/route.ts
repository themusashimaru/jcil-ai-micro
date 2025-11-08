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
    const emailMap = new Map(users.map(u => [u.id, u.email || 'Unknown']));

    // Fetch conversations
    let query = admin
      .from('conversations')
      .select('id, title, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(100);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: conversations } = await query;

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ conversations: [], total: 0 });
    }

    // Enrich conversations
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const { count } = await admin
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        const { data: latest } = await admin
          .from('messages')
          .select('content, created_at, role')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Count attachments
        const { count: attachmentCount } = await admin
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .not('file_url', 'is', null);

        return {
          id: conv.id,
          title: conv.title,
          created_at: new Date(conv.created_at).toISOString(),
          updated_at: new Date(conv.created_at).toISOString(), // Use created_at as updated_at
          user_id: conv.user_id,
          user_email: emailMap.get(conv.user_id) || 'Unknown',
          user_tier: 'free',
          message_count: count || 0,
          attachment_count: attachmentCount || 0,
          latest_message: latest ? {
            content: latest.content?.substring(0, 150) || '',
            created_at: new Date(latest.created_at).toISOString(),
            role: latest.role,
          } : null,
        };
      })
    );

    // Sort by user email alphabetically
    enriched.sort((a, b) => a.user_email.localeCompare(b.user_email));

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
      },
      { status: 500 }
    );
  }
}
