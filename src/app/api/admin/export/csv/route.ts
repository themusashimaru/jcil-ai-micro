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
    // Get all users with their details
    const { data: users, error: usersError } = await supabase
      .rpc('get_all_users_for_admin');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    if (!users || users.length === 0) {
      return new NextResponse('No users found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // Create CSV content
    const headers = [
      'Email',
      'Subscription Tier',
      'Daily Messages',
      'Daily Limit',
      'Total Messages',
      'Tokens Used',
      'Join Date',
      'Last Active',
    ];

    const csvRows = [
      headers.join(','),
      ...users.map((user: any) => {
        const joinDate = user.created_at
          ? new Date(user.created_at).toLocaleDateString()
          : 'N/A';
        const lastActive = user.last_activity_at
          ? new Date(user.last_activity_at).toLocaleDateString()
          : 'Never';

        return [
          `"${user.email || 'N/A'}"`,
          `"${user.subscription_tier || 'free'}"`,
          user.daily_message_count || 0,
          user.daily_message_limit || 10,
          user.total_messages_sent || 0,
          user.total_tokens_used || 0,
          `"${joinDate}"`,
          `"${lastActive}"`,
        ].join(',');
      }),
    ];

    const csvContent = csvRows.join('\n');

    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0];
    const filename = `users-export-${date}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('CSV export error:', error);
    return NextResponse.json(
      { error: 'Failed to export CSV', details: error.message },
      { status: 500 }
    );
  }
}
