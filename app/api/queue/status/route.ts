/**
 * QUEUE STATUS API
 *
 * Returns current queue statistics for monitoring.
 * Used by health checks and admin dashboards.
 */

import { successResponse, errors } from '@/lib/api/utils';
import { getQueueStatus } from '@/lib/queue';
import { getChatQueueStats, isBullMQAvailable } from '@/lib/queue/bull-queue';
import { getWorkerStats } from '@/lib/queue/workers';
import { getAllBreakerStatus } from '@/lib/circuit-breaker';
import { getAnthropicKeyStats } from '@/lib/anthropic/client';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';

export async function GET(_request: Request) {
  // Check if user is admin (simple check, doesn't block non-admins)
  let isAdmin = false;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .single();
      isAdmin = !!adminUser;
    }
  } catch {
    // Not admin, continue with limited info
  }

  try {
    // Simple queue status (always available)
    const simpleQueue = await getQueueStatus();

    // BullMQ status (if available)
    const bullMQAvailable = isBullMQAvailable();
    const bullMQStats = bullMQAvailable ? await getChatQueueStats() : null;

    // Worker stats (if available)
    const workerStats = bullMQAvailable ? getWorkerStats() : null;

    // Circuit breaker status
    const circuitBreakers = getAllBreakerStatus();

    // API key stats (admin only)
    const apiKeyStats = isAdmin ? getAnthropicKeyStats() : null;

    const status = {
      timestamp: new Date().toISOString(),
      simpleQueue: {
        active: simpleQueue.activeRequests,
        available: simpleQueue.available,
        max: simpleQueue.maxConcurrent,
        utilizationPercent: Math.round(
          (simpleQueue.activeRequests / simpleQueue.maxConcurrent) * 100
        ),
      },
      bullMQ: bullMQAvailable
        ? {
            enabled: true,
            stats: bullMQStats,
            workers: workerStats,
          }
        : {
            enabled: false,
            reason: 'REDIS_HOST not configured',
          },
      circuitBreakers,
      ...(apiKeyStats && {
        apiKeys: {
          total: apiKeyStats.totalKeys,
          available: apiKeyStats.totalAvailable,
          primaryAvailable: apiKeyStats.primaryAvailable,
          fallbackAvailable: apiKeyStats.fallbackAvailable,
        },
      }),
    };

    return successResponse(status);
  } catch (_error) {
    return errors.serverError('Failed to get queue status');
  }
}
