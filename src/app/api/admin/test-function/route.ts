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
    // Test the RPC function
    const { data: allUsers, error: usersError } = await supabase
      .rpc('get_all_users_for_admin');

    if (usersError) {
      return NextResponse.json({
        status: 'FAILED',
        error: {
          message: usersError.message,
          details: usersError.details,
          hint: usersError.hint,
          code: usersError.code,
        },
        suggestion: 'Run the SQL script in Supabase SQL Editor to fix this'
      }, { status: 200 });
    }

    return NextResponse.json({
      status: 'SUCCESS',
      userCount: allUsers?.length || 0,
      sampleUser: allUsers?.[0] || null,
      message: 'Database function is working correctly!'
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'EXCEPTION',
      error: error.message,
      stack: error.stack,
    }, { status: 200 });
  }
}
