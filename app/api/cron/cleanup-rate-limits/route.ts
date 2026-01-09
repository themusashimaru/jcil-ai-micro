/**
 * RATE LIMIT CLEANUP CRON JOB
 *
 * Runs hourly to clean up expired rate limit entries from the database.
 * This prevents the rate_limits table from growing unbounded and
 * maintains database performance at scale.
 *
 * SCHEDULE: 0 * * * * (every hour at minute 0)
 * SECURITY: Requires CRON_SECRET in Authorization header
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

const log = logger('CronCleanupRateLimits');

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    log.warn('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  // Security check
  if (!verifyCronSecret(request)) {
    log.warn('Unauthorized cron access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServerClient();

    // Delete rate limit entries older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: deletedEntries, error: deleteError } = await supabase
      .from('rate_limits')
      .delete()
      .lt('created_at', twoHoursAgo)
      .select('id');

    if (deleteError) {
      log.error('Failed to delete old rate limits', deleteError);
      return NextResponse.json(
        { error: 'Cleanup failed', details: deleteError.message },
        { status: 500 }
      );
    }

    const deletedCount = deletedEntries?.length || 0;

    // Get current table size for monitoring
    const { count: remainingCount } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true });

    const duration = Date.now() - startTime;

    log.info('Rate limit cleanup completed', {
      deletedCount,
      remainingCount,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      remaining: remainingCount,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Cleanup cron error', error as Error);
    return NextResponse.json(
      { error: 'Internal error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}
