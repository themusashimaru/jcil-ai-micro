import { createClient } from '@/lib/supabase/server';
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
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch failed login attempts
    const { data: logins, error } = await supabase
      .from('failed_logins')
      .select('*')
      .order('last_attempt_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[FAILED LOGINS] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch login attempts', details: error.message },
        { status: 500 }
      );
    }

    // Get total count
    const { count } = await supabase
      .from('failed_logins')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      logins: logins || [],
      total: count || 0,
      limit,
      offset,
    });

  } catch (error: any) {
    console.error('[FAILED LOGINS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST endpoint for logging failed login attempts
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      email,
      ip_address,
      user_agent,
      failure_reason,
      country,
      city,
    } = body;

    // Validate required fields
    if (!email || !ip_address) {
      return NextResponse.json(
        { error: 'Missing required fields: email, ip_address' },
        { status: 400 }
      );
    }

    // Check if there's a recent failed attempt from same IP/email (last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const { data: existing } = await supabase
      .from('failed_logins')
      .select('*')
      .eq('email', email)
      .eq('ip_address', ip_address)
      .gte('last_attempt_at', fifteenMinutesAgo.toISOString())
      .order('last_attempt_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('failed_logins')
        .update({
          attempt_count: existing.attempt_count + 1,
          last_attempt_at: new Date().toISOString(),
          failure_reason: failure_reason || existing.failure_reason,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[FAILED LOGINS] Update error:', error);
        return NextResponse.json(
          { error: 'Failed to update login attempt', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, login: data });
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('failed_logins')
        .insert({
          email,
          ip_address,
          user_agent,
          failure_reason,
          country,
          city,
          attempt_count: 1,
        })
        .select()
        .single();

      if (error) {
        console.error('[FAILED LOGINS] Insert error:', error);
        return NextResponse.json(
          { error: 'Failed to log login attempt', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, login: data });
    }

  } catch (error: any) {
    console.error('[FAILED LOGINS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
