/**
 * USER MESSAGES API
 * GET - Get authenticated user's messages
 */

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function getAuthenticatedClient() {
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
 * GET - Get user's messages
 */
export async function GET() {
  try {
    // Verify authentication
    const authClient = await getAuthenticatedClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get user's subscription tier for broadcast matching
    const { data: userData } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const userTier = userData?.subscription_tier || 'free';

    // Get messages - direct messages + broadcasts matching user's tier
    const { data: messages, error: messagesError } = await supabase
      .from('user_messages')
      .select(`
        id,
        subject,
        message,
        message_type,
        priority,
        sender_admin_email,
        is_broadcast,
        is_pinned,
        created_at,
        expires_at
      `)
      .or(`recipient_user_id.eq.${user.id},and(is_broadcast.eq.true,or(recipient_tier.eq.all,recipient_tier.eq.${userTier}))`)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('[Messages API] Error fetching messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Get status for each message (read/deleted/starred)
    const messageIds = messages?.map(m => m.id) || [];
    let statusMap: Record<string, { is_read: boolean; is_deleted: boolean; is_starred: boolean }> = {};

    if (messageIds.length > 0) {
      const { data: statuses } = await supabase
        .from('user_message_status')
        .select('message_id, is_read, is_deleted, is_starred')
        .eq('user_id', user.id)
        .in('message_id', messageIds);

      if (statuses) {
        statusMap = statuses.reduce((acc, s) => {
          acc[s.message_id] = {
            is_read: s.is_read,
            is_deleted: s.is_deleted,
            is_starred: s.is_starred,
          };
          return acc;
        }, {} as typeof statusMap);
      }
    }

    // Combine messages with status, filter out deleted
    const messagesWithStatus = messages
      ?.map(m => ({
        ...m,
        is_read: statusMap[m.id]?.is_read || false,
        is_starred: statusMap[m.id]?.is_starred || false,
        is_deleted: statusMap[m.id]?.is_deleted || false,
      }))
      .filter(m => !m.is_deleted) || [];

    // Calculate counts
    const unreadCount = messagesWithStatus.filter(m => !m.is_read).length;
    const starredCount = messagesWithStatus.filter(m => m.is_starred).length;

    return NextResponse.json({
      messages: messagesWithStatus,
      counts: {
        total: messagesWithStatus.length,
        unread: unreadCount,
        starred: starredCount,
      },
    });
  } catch (error) {
    console.error('[Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
