import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
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
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Fetch moderation logs (admin-only access via RLS)
    const { data: logs, error } = await supabase
      .from('moderation_logs')
      .select(`
        *,
        user:user_id(email),
        reviewed_by_user:reviewed_by(email)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SAFETY-LOGS] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch safety logs', details: error.message },
        { status: 500 }
      );
    }

    // Calculate severity using the categorize_threat_severity function
    const logsWithSeverity = (logs || []).map(log => ({
      ...log,
      severity: log.severity || calculateSeverity(log.categories),
      user_email: log.user?.email || 'Unknown',
      reviewed_by_email: log.reviewed_by_user?.email || null
    }));

    return NextResponse.json({
      logs: logsWithSeverity,
      total: logsWithSeverity.length,
      critical: logsWithSeverity.filter(l => l.severity === 'critical').length,
      high: logsWithSeverity.filter(l => l.severity === 'high').length,
      unreviewed: logsWithSeverity.filter(l => !l.reviewed).length
    });

  } catch (error: any) {
    console.error('[SAFETY-LOGS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to calculate severity (mirrors SQL function)
function calculateSeverity(categories: string[]): string {
  if (!categories || categories.length === 0) return 'low';

  const catSet = new Set(categories.map(c => c.toLowerCase()));

  // Critical threats
  if (catSet.has('self-harm') || catSet.has('suicide') || catSet.has('violence') ||
      catSet.has('terrorism') || catSet.has('extremism') || catSet.has('weapons')) {
    return 'critical';
  }

  // High threats
  if (catSet.has('hate') || catSet.has('hate/threats') ||
      catSet.has('harassment/threats') || catSet.has('sexual/minors')) {
    return 'high';
  }

  // Medium threats
  if (catSet.has('harassment') || catSet.has('sexual') || catSet.has('illicit')) {
    return 'medium';
  }

  return 'low';
}
