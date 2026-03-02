/**
 * STALE QUEUE CLEANUP CRON JOB
 *
 * Runs every 5 minutes to clean up stale queue entries.
 * Removes stuck requests that exceeded TTL and frees up queue slots.
 *
 * SCHEDULE: *\/5 * * * * (every 5 minutes)
 * SECURITY: Requires CRON_SECRET in Authorization header
 */

import { cleanupStaleRequests, getQueueStatus } from '@/lib/queue';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('CronCleanupQueue');

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
    // Get queue status before cleanup
    const statusBefore = await getQueueStatus();

    // Clean up stale requests
    const cleanedCount = await cleanupStaleRequests();

    // Get queue status after cleanup
    const statusAfter = await getQueueStatus();

    const duration = Date.now() - startTime;

    log.info('Queue cleanup completed', {
      cleanedCount,
      activeBeforeCleanup: statusBefore.activeRequests,
      activeAfterCleanup: statusAfter.activeRequests,
      availableSlots: statusAfter.available,
      maxConcurrent: statusAfter.maxConcurrent,
      durationMs: duration,
    });

    return successResponse({
      success: true,
      cleaned: cleanedCount,
      queue: {
        active: statusAfter.activeRequests,
        available: statusAfter.available,
        max: statusAfter.maxConcurrent,
        utilizationPercent: Math.round(
          (statusAfter.activeRequests / statusAfter.maxConcurrent) * 100
        ),
      },
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Queue cleanup cron error', error as Error);
    return errors.serverError('Internal error');
  }
}

// Also support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}
