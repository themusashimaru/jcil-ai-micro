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
    const limitType = searchParams.get('limit_type');

    // Build query
    let query = supabase
      .from('rate_limit_violations')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (limitType) {
      query = query.eq('limit_type', limitType);
    }

    const { data: violations, error } = await query;

    if (error) {
      console.error('[RATE VIOLATIONS] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch violations', details: error.message },
        { status: 500 }
      );
    }

    // Get total count
    let countQuery = supabase
      .from('rate_limit_violations')
      .select('*', { count: 'exact', head: true });

    if (limitType) {
      countQuery = countQuery.eq('limit_type', limitType);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      violations: violations || [],
      total: count || 0,
      limit,
      offset,
    });

  } catch (error: any) {
    console.error('[RATE VIOLATIONS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST endpoint for logging rate limit violations
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      user_id,
      user_email,
      ip_address,
      limit_type,
      endpoint,
      request_count,
      limit_threshold,
      user_agent,
      is_bot = false,
      was_blocked = true,
      block_duration_seconds,
      violation_start,
      violation_end,
    } = body;

    // Validate required fields
    if (!ip_address || !limit_type || !request_count || !limit_threshold) {
      return NextResponse.json(
        { error: 'Missing required fields: ip_address, limit_type, request_count, limit_threshold' },
        { status: 400 }
      );
    }

    // Insert rate violation record
    const { data, error } = await supabase
      .from('rate_limit_violations')
      .insert({
        user_id,
        user_email,
        ip_address,
        limit_type,
        endpoint,
        request_count,
        limit_threshold,
        user_agent,
        is_bot,
        was_blocked,
        block_duration_seconds,
        violation_start: violation_start || new Date().toISOString(),
        violation_end: violation_end || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[RATE VIOLATIONS] Insert error:', error);
      return NextResponse.json(
        { error: 'Failed to log violation', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, violation: data });

  } catch (error: any) {
    console.error('[RATE VIOLATIONS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
