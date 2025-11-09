import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check authentication and admin status
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'all';
    const status = searchParams.get('status');
    const messageType = searchParams.get('type');
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('admin_messages')
      .select(`
        *,
        from_user:user_profiles!from_user_id(
          id,
          subscription_tier
        ),
        replied_by_user:user_profiles!replied_by(
          id
        ),
        parent_message:admin_messages!parent_message_id(
          id,
          subject
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (folder !== 'all') {
      query = query.eq('folder', folder);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (messageType) {
      query = query.eq('message_type', messageType);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: messages, error, count } = await query;

    if (error) {
      console.error('Error fetching admin messages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get folder counts
    const { data: folderCounts } = await supabase
      .from('admin_messages')
      .select('folder, status')
      .eq('status', 'unread');

    const counts = {
      all_unread: 0,
      user_inquiries: 0,
      cyber_emergencies: 0,
      admin_emergencies: 0,
      external_inquiries: 0,
    };

    folderCounts?.forEach((item) => {
      counts.all_unread++;
      if (item.folder === 'user_inquiries') counts.user_inquiries++;
      if (item.folder === 'cyber_emergencies') counts.cyber_emergencies++;
      if (item.folder === 'admin_emergencies') counts.admin_emergencies++;
      if (item.folder === 'external_inquiries') counts.external_inquiries++;
    });

    return NextResponse.json({
      messages,
      total: count,
      counts,
      pagination: {
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error: any) {
    console.error('Admin inbox messages error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { messageId, updates } = body;

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID required' }, { status: 400 });
    }

    // Update message
    const updateData: any = {};
    if (updates.status) updateData.status = updates.status;
    if (updates.status === 'read' && !updates.read_at) {
      updateData.read_at = new Date().toISOString();
    }
    if (updates.folder) updateData.folder = updates.folder;

    const { data, error } = await supabase
      .from('admin_messages')
      .update(updateData)
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: data });
  } catch (error: any) {
    console.error('Update message error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
