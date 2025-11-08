import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const VALID_TIERS = ['all', 'free', 'basic', 'pro', 'executive'];

export async function POST(request: Request) {
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

  // Create service role client to bypass RLS for admin operations
  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    const body = await request.json();
    const { title, message, tierFilter } = body;

    // Validate input
    if (!title || !message) {
      return NextResponse.json({ error: 'Missing title or message' }, { status: 400 });
    }

    if (title.length > 100) {
      return NextResponse.json({ error: 'Title must be 100 characters or less' }, { status: 400 });
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Message must be 500 characters or less' }, { status: 400 });
    }

    if (!VALID_TIERS.includes(tierFilter)) {
      return NextResponse.json({ error: 'Invalid tier filter' }, { status: 400 });
    }

    // Get target users based on tier filter
    let query = supabaseAdmin
      .from('user_profiles')
      .select('id');

    if (tierFilter !== 'all') {
      query = query.eq('subscription_tier', tierFilter);
    }

    const { data: targetUsers, error: usersError } = await query;

    if (usersError) {
      console.error('Error fetching target users:', usersError);
      throw usersError;
    }

    if (!targetUsers || targetUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users found matching the tier filter',
        sentCount: 0,
      });
    }

    // Create notification records for each target user
    const notifications = targetUsers.map(user => ({
      user_id: user.id,
      title,
      message,
      tier_filter: tierFilter,
      created_at: new Date().toISOString(),
      is_read: false,
    }));

    const { data: insertedNotifications, error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notifications)
      .select();

    if (insertError) {
      console.error('Error inserting notifications:', insertError);
      throw insertError;
    }

    console.log('✅ Notifications sent:', {
      count: targetUsers.length,
      tierFilter,
      title,
    });

    return NextResponse.json({
      success: true,
      message: `Notifications sent successfully`,
      sentCount: targetUsers.length,
      data: insertedNotifications,
    });
  } catch (error: any) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send notifications',
        details: error.message,
        fullError: JSON.stringify(error),
        code: error.code,
        hint: error.hint
      },
      { status: 500 }
    );
  }
}
