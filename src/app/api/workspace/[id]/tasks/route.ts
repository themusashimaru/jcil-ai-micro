/**
 * WORKSPACE TASKS API
 *
 * Long-running background tasks (builds, tests, deploys)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { untypedFrom } from '@/lib/supabase/workspace-client';
import { getContainerManager } from '@/lib/workspace/container';
import { validateCSRF } from '@/lib/security/csrf';
import { validateQueryLimit, safeParseJSON } from '@/lib/security/validation';
import { logger } from '@/lib/logger';

const log = logger('TasksAPI');

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * GET - List background tasks
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    // SECURITY: Validate limit parameter
    const limit = validateQueryLimit(url.searchParams.get('limit'), { default: 20, max: 100 });

    let query = supabase
      .from('background_tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: tasks, error } = await query;

    if (error) throw error;

    return NextResponse.json({ tasks });
  } catch (error) {
    log.error('Failed to list tasks', error as Error);
    return NextResponse.json({ error: 'Failed to list tasks' }, { status: 500 });
  }
}

/**
 * POST - Start a background task
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify workspace ownership
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const jsonResult = await safeParseJSON<{ type?: string; command?: string }>(request);
    if (!jsonResult.success) {
      return NextResponse.json({ error: jsonResult.error }, { status: 400 });
    }
    const { type, command } = jsonResult.data;

    if (!type || !command) {
      return NextResponse.json({ error: 'Type and command are required' }, { status: 400 });
    }

    // Create task record (table created by workspace schema)
    const taskId = crypto.randomUUID();
    const { error: insertError } = await untypedFrom(supabase, 'background_tasks').insert({
      id: taskId,
      workspace_id: workspaceId,
      user_id: user.id,
      type,
      command,
      status: 'pending',
      output: [],
      progress: 0,
      created_at: new Date().toISOString(),
    });

    if (insertError) throw insertError;

    // Start task execution in background (non-blocking)
    executeTaskInBackground(taskId, workspaceId, command, supabase);

    return NextResponse.json(
      {
        task: {
          id: taskId,
          status: 'pending',
          type,
          command,
        },
      },
      { status: 202 }
    ); // 202 Accepted
  } catch (error) {
    log.error('Failed to start task', error as Error);
    return NextResponse.json({ error: 'Failed to start task' }, { status: 500 });
  }
}

/**
 * Execute task in background
 */
async function executeTaskInBackground(
  taskId: string,
  workspaceId: string,
  command: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  try {
    // Update to running
    await supabase
      .from('background_tasks')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    const container = getContainerManager();
    const outputChunks: string[] = [];

    const result = await container.executeCommand(workspaceId, command, {
      timeout: 600000, // 10 minutes
      stream: {
        onStdout: async (data: string) => {
          outputChunks.push(data);
          // Update output periodically
          if (outputChunks.length % 10 === 0) {
            await supabase
              .from('background_tasks')
              .update({ output: outputChunks })
              .eq('id', taskId);
          }
        },
        onStderr: async (data: string) => {
          outputChunks.push(`[stderr] ${data}`);
        },
      },
    });

    // Final update
    await supabase
      .from('background_tasks')
      .update({
        status: result.exitCode === 0 ? 'completed' : 'failed',
        output: outputChunks,
        progress: 100,
        completed_at: new Date().toISOString(),
        error: result.exitCode !== 0 ? result.stderr : null,
      })
      .eq('id', taskId);
  } catch (error) {
    await supabase
      .from('background_tasks')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);
  }
}

/**
 * Quick task shortcuts
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify workspace ownership before executing commands
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const jsonResult = await safeParseJSON<{ preset?: string }>(request);
    if (!jsonResult.success) {
      return NextResponse.json({ error: jsonResult.error }, { status: 400 });
    }
    const { preset } = jsonResult.data; // 'install', 'build', 'test', 'lint'

    const container = getContainerManager();

    let result;
    switch (preset) {
      case 'install':
        result = await container.installDependencies(workspaceId);
        break;
      case 'build':
        result = await container.runBuild(workspaceId);
        break;
      case 'test':
        result = await container.runTests(workspaceId);
        break;
      case 'lint':
        result = await container.executeCommand(workspaceId, 'npm run lint');
        break;
      default:
        return NextResponse.json({ error: 'Invalid preset' }, { status: 400 });
    }

    return NextResponse.json({
      success: result.exitCode === 0,
      output: result.stdout,
      error: result.stderr,
      executionTime: result.executionTime,
    });
  } catch (error) {
    log.error('Task execution failed', error as Error);
    return NextResponse.json({ error: 'Task execution failed' }, { status: 500 });
  }
}
