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
    const injectionType = searchParams.get('injection_type');

    // Build query
    let query = supabase
      .from('prompt_injections')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (injectionType) {
      query = query.eq('injection_type', injectionType);
    }

    const { data: injections, error } = await query;

    if (error) {
      console.error('[PROMPT INJECTIONS] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch injections', details: error.message },
        { status: 500 }
      );
    }

    // Get total count
    let countQuery = supabase
      .from('prompt_injections')
      .select('*', { count: 'exact', head: true });

    if (injectionType) {
      countQuery = countQuery.eq('injection_type', injectionType);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      injections: injections || [],
      total: count || 0,
      limit,
      offset,
    });

  } catch (error: any) {
    console.error('[PROMPT INJECTIONS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST endpoint for logging prompt injection attempts
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      user_id,
      user_email,
      ip_address,
      prompt_text,
      injection_type,
      confidence_score = 0,
      detected_by = 'pattern_match',
      matched_patterns = [],
      was_blocked = true,
      user_notified = false,
    } = body;

    // Validate required fields
    if (!ip_address || !prompt_text) {
      return NextResponse.json(
        { error: 'Missing required fields: ip_address, prompt_text' },
        { status: 400 }
      );
    }

    // Insert prompt injection record
    const { data, error } = await supabase
      .from('prompt_injections')
      .insert({
        user_id,
        user_email,
        ip_address,
        prompt_text,
        injection_type,
        confidence_score,
        detected_by,
        matched_patterns,
        was_blocked,
        user_notified,
      })
      .select()
      .single();

    if (error) {
      console.error('[PROMPT INJECTIONS] Insert error:', error);
      return NextResponse.json(
        { error: 'Failed to log injection attempt', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, injection: data });

  } catch (error: any) {
    console.error('[PROMPT INJECTIONS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH endpoint for reviewing/updating injection records
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
    const { id, reviewed, is_false_positive, admin_notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // Update injection record
    const updateData: any = {};
    if (reviewed !== undefined) {
      updateData.reviewed = reviewed;
      updateData.reviewed_by = session.user.id;
      updateData.reviewed_at = new Date().toISOString();
    }
    if (is_false_positive !== undefined) {
      updateData.is_false_positive = is_false_positive;
    }
    if (admin_notes !== undefined) {
      updateData.admin_notes = admin_notes;
    }

    const { data, error } = await supabase
      .from('prompt_injections')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[PROMPT INJECTIONS] Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update injection', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, injection: data });

  } catch (error: any) {
    console.error('[PROMPT INJECTIONS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
