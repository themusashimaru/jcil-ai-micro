import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

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
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const promptType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('system_prompt_audit')
      .select('*, changed_by_user:user_profiles!changed_by(id, full_name)')
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (promptType) {
      query = query.eq('prompt_type', promptType);
    }

    const { data: auditLog, error } = await query;

    if (error) {
      console.error('Error fetching audit log:', error);
      return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
    }

    return NextResponse.json({ auditLog });
  } catch (error: any) {
    console.error('Audit log error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
