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

import { createServerClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('CronCleanupRateLimits');

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    log.warn('CRON_SECRET not configured — cron jobs will be rejected');
    return false;
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    log.warn('Cron secret mismatch', {
      hasAuthHeader: !!authHeader,
      headerFormat: authHeader ? (authHeader.startsWith('Bearer ') ? 'Bearer' : 'other') : 'none',
      source: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    });
    return false;
  }

  return true;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  // Security check
  if (!verifyCronSecret(request)) {
    log.warn('Unauthorized cron access attempt');
    return errors.unauthorized();
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
      return errors.serverError('Cleanup failed');
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

    return successResponse({
      success: true,
      deleted: deletedCount,
      remaining: remainingCount,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Cleanup cron error', error as Error);
    return errors.serverError('Internal error');
  }
}

// Also support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}
