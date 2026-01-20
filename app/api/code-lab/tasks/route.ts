/**
 * AUTONOMOUS TASKS API
 *
 * Endpoints for creating and managing autonomous tasks.
 * - POST: Create and start a new task
 * - GET: Get task status or list tasks
 * - DELETE: Cancel a task
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { createClient } from '@supabase/supabase-js';
import {
  createTask,
  executeTask,
  cancelTask,
  getTaskStatus,
  getUserTasks,
} from '@/lib/autonomous-task';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';
// SECURITY FIX: Use centralized crypto module which requires dedicated ENCRYPTION_KEY
// (no fallback to SERVICE_ROLE_KEY for separation of concerns)
import { safeDecrypt } from '@/lib/security/crypto';

const log = logger('CodeLabTasks');

// Decrypt token - wrapper for backward compatibility (returns empty string on failure)
function decryptToken(encryptedData: string): string {
  return safeDecrypt(encryptedData) || '';
}

/**
 * GET - Get task status or list tasks
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('id');

    if (taskId) {
      // Get specific task
      const task = await getTaskStatus(taskId);
      if (!task || task.userId !== user.id) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json({ task });
    } else {
      // List user's tasks
      const limit = parseInt(searchParams.get('limit') || '10');
      const tasks = await getUserTasks(user.id, limit);
      return NextResponse.json({ tasks });
    }
  } catch (error) {
    log.error('[Tasks API] GET error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST - Create and start a new autonomous task
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimit = await rateLimiters.codeLabEdit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { request: taskRequest, sessionId, repo, conversationHistory, autoStart = true } = body;

    if (!taskRequest || !sessionId) {
      return NextResponse.json({ error: 'Missing request or sessionId' }, { status: 400 });
    }

    // Verify session ownership
    const { data: sessionData, error: sessionError } = await supabase
      .from('code_lab_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 });
    }

    // Get GitHub token if needed
    let githubToken: string | undefined;
    if (repo) {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data: userData } = await adminClient
        .from('users')
        .select('github_token')
        .eq('id', user.id)
        .single();

      if (userData?.github_token) {
        githubToken = decryptToken(userData.github_token);
      }
    }

    // Create task context
    const context = {
      userId: user.id,
      sessionId,
      repo,
      conversationHistory,
      githubToken,
    };

    // Create the task
    const task = await createTask(taskRequest, context);

    // Auto-start execution in background if requested
    if (autoStart) {
      // Execute asynchronously (don't await)
      executeTask(task.id, context).catch((err) => {
        log.error(`[Tasks API] Background execution error for ${task.id}:`, err);
      });
    }

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        steps: task.steps,
        totalSteps: task.totalSteps,
        progress: task.progress,
        estimatedDuration: task.estimatedDuration,
      },
    });
  } catch (error) {
    log.error('[Tasks API] POST error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE - Cancel a task
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('id');

    if (!taskId) {
      return NextResponse.json({ error: 'Missing task ID' }, { status: 400 });
    }

    // Verify ownership
    const task = await getTaskStatus(taskId);
    if (!task || task.userId !== user.id) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const success = await cancelTask(taskId);

    return NextResponse.json({ success });
  } catch (error) {
    log.error('[Tasks API] DELETE error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
