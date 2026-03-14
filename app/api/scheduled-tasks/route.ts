/**
 * SCHEDULED TASKS API
 *
 * CRUD operations for user-scheduled automated tasks.
 * Tasks execute tools at specified times (e.g., "send weekly report email").
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';

const log = logger('ScheduledTasksAPI');

// The scheduled_tasks table is new and not yet in the generated Supabase types.
// Use a typed helper to access it safely until types are regenerated.
const scheduledTasksTable = (supabase: SupabaseClient) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase as any).from('scheduled_tasks');

export const runtime = 'nodejs';
export const maxDuration = 15;

// ── Validation Schemas ──

const createTaskSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  platform: z.string().min(1).max(50),
  action: z.string().min(1).max(100),
  toolName: z.string().min(1).max(200),
  toolParams: z.record(z.unknown()).default({}),
  scheduledFor: z.string().datetime(),
  timezone: z.string().default('UTC'),
  recurring: z
    .enum(['once', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly'])
    .default('once'),
  conversationId: z.string().uuid().optional(),
});

const updateTaskSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  scheduledFor: z.string().datetime().optional(),
  timezone: z.string().optional(),
  recurring: z.enum(['once', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly']).optional(),
  status: z.enum(['pending', 'paused', 'cancelled']).optional(),
  toolParams: z.record(z.unknown()).optional(),
});

/**
 * GET /api/scheduled-tasks
 * List all scheduled tasks for the authenticated user
 */
export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;

    const { data: tasks, error } = await scheduledTasksTable(auth.supabase)
      .select('*')
      .eq('user_id', auth.user.id)
      .not('status', 'eq', 'cancelled')
      .order('scheduled_for', { ascending: true });

    if (error) {
      log.error('Error fetching scheduled tasks', { error: error.message });
      return Response.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    return Response.json({ tasks: tasks || [] });
  } catch (error) {
    log.error('Unexpected error in GET', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/scheduled-tasks
 * Create a new scheduled task
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data } = parsed;

    const { data: task, error } = await scheduledTasksTable(auth.supabase)
      .insert({
        user_id: auth.user.id,
        name: data.name,
        description: data.description || null,
        platform: data.platform,
        action: data.action,
        tool_name: data.toolName,
        tool_params: data.toolParams,
        scheduled_for: data.scheduledFor,
        timezone: data.timezone,
        recurring: data.recurring,
        conversation_id: data.conversationId || null,
        created_from: 'chat',
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating scheduled task', { error: error.message });
      return Response.json({ error: 'Failed to create task' }, { status: 500 });
    }

    log.info('Scheduled task created', {
      taskId: task.id,
      userId: auth.user.id,
      platform: data.platform,
      scheduledFor: data.scheduledFor,
      recurring: data.recurring,
    });

    return Response.json({ task }, { status: 201 });
  } catch (error) {
    log.error('Unexpected error in POST', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/scheduled-tasks
 * Update an existing scheduled task
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parsed.data;

    // Build update object with snake_case keys
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.scheduledFor !== undefined) dbUpdates.scheduled_for = updates.scheduledFor;
    if (updates.timezone !== undefined) dbUpdates.timezone = updates.timezone;
    if (updates.recurring !== undefined) dbUpdates.recurring = updates.recurring;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.toolParams !== undefined) dbUpdates.tool_params = updates.toolParams;

    const { data: task, error } = await scheduledTasksTable(auth.supabase)
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (error) {
      log.error('Error updating scheduled task', { error: error.message, taskId: id });
      return Response.json({ error: 'Failed to update task' }, { status: 500 });
    }

    log.info('Scheduled task updated', { taskId: id, updates: Object.keys(dbUpdates) });

    return Response.json({ task });
  } catch (error) {
    log.error('Unexpected error in PATCH', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/scheduled-tasks
 * Delete (cancel) a scheduled task
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return Response.json({ error: 'Missing task ID' }, { status: 400 });
    }

    const { error } = await scheduledTasksTable(auth.supabase)
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('user_id', auth.user.id);

    if (error) {
      log.error('Error cancelling scheduled task', { error: error.message, taskId: id });
      return Response.json({ error: 'Failed to cancel task' }, { status: 500 });
    }

    log.info('Scheduled task cancelled', { taskId: id });

    return Response.json({ success: true });
  } catch (error) {
    log.error('Unexpected error in DELETE', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
