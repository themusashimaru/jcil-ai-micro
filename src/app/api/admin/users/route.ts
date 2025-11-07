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
    // Use database function to get user details with emails
    // This function uses SECURITY DEFINER to access auth.users
    const { data: users, error: usersError } = await supabase
      .rpc('get_all_users_for_admin');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    return NextResponse.json({
      users: users || [],
      total: users?.length || 0,
    });
  } catch (error: any) {
    console.error('Admin users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    );
  }
}
