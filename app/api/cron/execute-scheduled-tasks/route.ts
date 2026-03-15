/**
 * SCHEDULED TASKS EXECUTOR CRON
 *
 * Polls the scheduled_tasks table for due tasks and executes them.
 * Should be called every minute via Vercel Cron or external cron service.
 *
 * SCHEDULE: * * * * * (every minute)
 * SECURITY: Requires CRON_SECRET in Authorization header
 *
 * Flow:
 * 1. Query tasks where scheduled_for <= NOW and status = 'pending'
 * 2. Mark each as 'running'
 * 3. Execute the tool (via Composio or internal tool)
 * 4. Update with result/error
 * 5. For recurring tasks, compute next run and reset to 'pending'
 */

import { createServerClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

import type { SupabaseClient } from '@supabase/supabase-js';

const log = logger('CronScheduledTasks');

export const runtime = 'nodejs';
export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scheduledTasksTable = (supabase: SupabaseClient) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase as any).from('scheduled_tasks');

// Verify cron secret
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    log.warn('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Compute next run time for recurring tasks
 */
function computeNextRun(currentSchedule: string, recurring: string): string | null {
  const date = new Date(currentSchedule);
  switch (recurring) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      return date.toISOString();
    case 'weekly':
      date.setDate(date.getDate() + 7);
      return date.toISOString();
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      return date.toISOString();
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      return date.toISOString();
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      return date.toISOString();
    default:
      return null;
  }
}

/**
 * Execute a single scheduled task
 */
async function executeTask(
  _supabase: SupabaseClient,
  task: {
    id: string;
    tool_name: string;
    tool_params: Record<string, unknown>;
    scheduled_for: string;
    recurring: string | null;
    run_count: number;
    fail_count: number;
  }
): Promise<{ success: boolean; result?: string; error?: string }> {
  const toolName = task.tool_name;
  const isComposioTool = toolName.startsWith('composio_');

  try {
    if (isComposioTool) {
      // Execute via Composio
      const actionName = toolName.replace(/^composio_/, '');
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || '';
      const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;

      const response = await fetch(`${url}/api/composio/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionName,
          params: task.tool_params,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        return {
          success: true,
          result: JSON.stringify(result.data || result).slice(0, 500),
        };
      } else {
        return {
          success: false,
          error: result.error || `HTTP ${response.status}`,
        };
      }
    } else {
      // For internal tools, we'd need to dynamically import and execute
      // For now, return an error for non-Composio tools
      return {
        success: false,
        error: `Internal tool execution not yet supported for: ${toolName}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return errors.unauthorized();
  }

  const startTime = Date.now();
  const supabase = createServerClient();

  try {
    // 1. Fetch due tasks
    const { data: dueTasks, error: fetchError } = await scheduledTasksTable(supabase)
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(20); // Process max 20 per run to stay within timeout

    if (fetchError) {
      log.error('Error fetching due tasks', { error: fetchError.message });
      return errors.serverError('Failed to fetch due tasks');
    }

    if (!dueTasks || dueTasks.length === 0) {
      return successResponse({ executed: 0, duration: Date.now() - startTime });
    }

    log.info(`Found ${dueTasks.length} due tasks`);

    const results: Array<{ taskId: string; success: boolean; error?: string }> = [];

    for (const task of dueTasks) {
      // 2. Mark as running
      await scheduledTasksTable(supabase).update({ status: 'running' }).eq('id', task.id);

      // 3. Execute
      const result = await executeTask(supabase, task);

      // 4. Update with result
      if (result.success) {
        const nextRun =
          task.recurring && task.recurring !== 'once'
            ? computeNextRun(task.scheduled_for, task.recurring)
            : null;

        if (nextRun) {
          // Recurring: reset to pending with next run time
          await scheduledTasksTable(supabase)
            .update({
              status: 'pending',
              scheduled_for: nextRun,
              last_run_at: new Date().toISOString(),
              last_result: result.result || 'Success',
              run_count: task.run_count + 1,
            })
            .eq('id', task.id);
        } else {
          // One-time: mark completed
          await scheduledTasksTable(supabase)
            .update({
              status: 'completed',
              last_run_at: new Date().toISOString(),
              last_result: result.result || 'Success',
              run_count: task.run_count + 1,
            })
            .eq('id', task.id);
        }

        results.push({ taskId: task.id, success: true });
      } else {
        // Failed
        await scheduledTasksTable(supabase)
          .update({
            status: task.fail_count >= 2 ? 'failed' : 'pending', // Retry up to 3 times
            last_run_at: new Date().toISOString(),
            last_error: result.error || 'Unknown error',
            fail_count: task.fail_count + 1,
          })
          .eq('id', task.id);

        results.push({ taskId: task.id, success: false, error: result.error });
      }

      log.info('Task executed', {
        taskId: task.id,
        name: task.name,
        success: result.success,
        error: result.error,
      });
    }

    const duration = Date.now() - startTime;
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    log.info('Scheduled tasks cron complete', {
      executed: dueTasks.length,
      succeeded,
      failed,
      duration,
    });

    return successResponse({
      executed: dueTasks.length,
      succeeded,
      failed,
      duration,
    });
  } catch (error) {
    log.error('Cron execution failed', error as Error);
    return errors.serverError('Cron execution failed');
  }
}
