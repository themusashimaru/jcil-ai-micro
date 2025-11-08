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
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get current date boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch aggregated statistics
    const stats = {
      total_events: 0,
      critical_events: 0,
      high_events: 0,
      failed_logins: 0,
      rate_violations: 0,
      prompt_injections: 0,
      suspicious_ips: 0,
      blocked_ips: 0,
      events_today: 0,
      events_this_week: 0,
    };

    // Total security events
    const { count: totalEvents } = await supabase
      .from('security_events')
      .select('*', { count: 'exact', head: true });
    stats.total_events = totalEvents || 0;

    // Critical severity events
    const { count: criticalEvents } = await supabase
      .from('security_events')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'critical');
    stats.critical_events = criticalEvents || 0;

    // High severity events
    const { count: highEvents } = await supabase
      .from('security_events')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'high');
    stats.high_events = highEvents || 0;

    // Failed logins
    const { count: failedLogins } = await supabase
      .from('failed_logins')
      .select('*', { count: 'exact', head: true });
    stats.failed_logins = failedLogins || 0;

    // Rate limit violations
    const { count: rateViolations } = await supabase
      .from('rate_limit_violations')
      .select('*', { count: 'exact', head: true });
    stats.rate_violations = rateViolations || 0;

    // Prompt injections
    const { count: promptInjections } = await supabase
      .from('prompt_injections')
      .select('*', { count: 'exact', head: true });
    stats.prompt_injections = promptInjections || 0;

    // Suspicious IPs
    const { count: suspiciousIps } = await supabase
      .from('suspicious_ips')
      .select('*', { count: 'exact', head: true });
    stats.suspicious_ips = suspiciousIps || 0;

    // Blocked IPs
    const { count: blockedIps } = await supabase
      .from('suspicious_ips')
      .select('*', { count: 'exact', head: true })
      .eq('is_blocked', true);
    stats.blocked_ips = blockedIps || 0;

    // Events today
    const { count: eventsToday } = await supabase
      .from('security_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());
    stats.events_today = eventsToday || 0;

    // Events this week
    const { count: eventsThisWeek } = await supabase
      .from('security_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());
    stats.events_this_week = eventsThisWeek || 0;

    return NextResponse.json(stats);

  } catch (error: any) {
    console.error('[SECURITY STATS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
