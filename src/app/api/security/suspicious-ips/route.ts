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
    const blocked = searchParams.get('blocked');

    // Build query
    let query = supabase
      .from('suspicious_ips')
      .select('*')
      .order('threat_score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (blocked === 'true') {
      query = query.eq('is_blocked', true);
    } else if (blocked === 'false') {
      query = query.eq('is_blocked', false);
    }

    const { data: ips, error } = await query;

    if (error) {
      console.error('[SUSPICIOUS IPS] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch suspicious IPs', details: error.message },
        { status: 500 }
      );
    }

    // Get total count
    let countQuery = supabase
      .from('suspicious_ips')
      .select('*', { count: 'exact', head: true });

    if (blocked === 'true') {
      countQuery = countQuery.eq('is_blocked', true);
    } else if (blocked === 'false') {
      countQuery = countQuery.eq('is_blocked', false);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      ips: ips || [],
      total: count || 0,
      limit,
      offset,
    });

  } catch (error: any) {
    console.error('[SUSPICIOUS IPS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST endpoint for adding suspicious IPs
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      ip_address,
      threat_score = 0,
      is_blocked = false,
      block_reason,
      detected_by,
      country,
      city,
      isp,
      abuse_confidence_score,
      is_tor = false,
      is_vpn = false,
      is_proxy = false,
      auto_block = false,
    } = body;

    // Validate required fields
    if (!ip_address) {
      return NextResponse.json(
        { error: 'Missing required field: ip_address' },
        { status: 400 }
      );
    }

    // Check if IP already exists
    const { data: existing } = await supabase
      .from('suspicious_ips')
      .select('*')
      .eq('ip_address', ip_address)
      .single();

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('suspicious_ips')
        .update({
          detection_count: existing.detection_count + 1,
          threat_score: Math.max(existing.threat_score, threat_score),
          last_seen: new Date().toISOString(),
          detected_by: detected_by || existing.detected_by,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[SUSPICIOUS IPS] Update error:', error);
        return NextResponse.json(
          { error: 'Failed to update IP', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, ip: data });
    } else {
      // Insert new suspicious IP
      const { data, error } = await supabase
        .from('suspicious_ips')
        .insert({
          ip_address,
          threat_score,
          is_blocked,
          block_reason,
          detected_by,
          country,
          city,
          isp,
          abuse_confidence_score,
          is_tor,
          is_vpn,
          is_proxy,
          auto_block,
          blocked_at: is_blocked ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) {
        console.error('[SUSPICIOUS IPS] Insert error:', error);
        return NextResponse.json(
          { error: 'Failed to add suspicious IP', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, ip: data });
    }

  } catch (error: any) {
    console.error('[SUSPICIOUS IPS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH endpoint for blocking/unblocking IPs
export async function PATCH(request: Request) {
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

    const body = await request.json();
    const { id, action, block_reason, block_duration, admin_notes } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: id, action' },
        { status: 400 }
      );
    }

    const updateData: any = {
      reviewed: true,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
    };

    if (action === 'block') {
      updateData.is_blocked = true;
      updateData.block_reason = block_reason || 'Blocked by admin';
      updateData.blocked_at = new Date().toISOString();

      if (block_duration) {
        const duration = parseInt(block_duration);
        updateData.blocked_until = new Date(Date.now() + duration * 1000).toISOString();
      }
    } else if (action === 'unblock') {
      updateData.is_blocked = false;
      updateData.block_reason = null;
      updateData.blocked_at = null;
      updateData.blocked_until = null;
    }

    if (admin_notes) {
      updateData.admin_notes = admin_notes;
    }

    const { data, error } = await supabase
      .from('suspicious_ips')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[SUSPICIOUS IPS] Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update IP', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, ip: data });

  } catch (error: any) {
    console.error('[SUSPICIOUS IPS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
