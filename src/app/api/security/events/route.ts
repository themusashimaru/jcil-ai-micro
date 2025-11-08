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

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const eventType = searchParams.get('event_type');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('[SECURITY EVENTS] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch events', details: error.message },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('security_events')
      .select('*', { count: 'exact', head: true });

    if (severity) {
      countQuery = countQuery.eq('severity', severity);
    }
    if (eventType) {
      countQuery = countQuery.eq('event_type', eventType);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      events: events || [],
      total: count || 0,
      limit,
      offset,
    });

  } catch (error: any) {
    console.error('[SECURITY EVENTS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST endpoint for creating security events (used by system)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      event_type,
      severity = 'medium',
      user_id,
      user_email,
      ip_address,
      user_agent,
      country,
      city,
      latitude,
      longitude,
      description,
      details,
      endpoint,
      method,
      status_code,
      risk_score = 0,
      is_blocked = false,
      auto_blocked = false,
      action_taken,
    } = body;

    // Validate required fields
    if (!event_type || !ip_address || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: event_type, ip_address, description' },
        { status: 400 }
      );
    }

    // Insert security event
    const { data, error } = await supabase
      .from('security_events')
      .insert({
        event_type,
        severity,
        user_id,
        user_email,
        ip_address,
        user_agent,
        country,
        city,
        latitude,
        longitude,
        description,
        details,
        endpoint,
        method,
        status_code,
        risk_score,
        is_blocked,
        auto_blocked,
        action_taken,
      })
      .select()
      .single();

    if (error) {
      console.error('[SECURITY EVENTS] Insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create security event', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, event: data });

  } catch (error: any) {
    console.error('[SECURITY EVENTS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
