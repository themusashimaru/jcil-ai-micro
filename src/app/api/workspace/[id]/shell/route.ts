/**
 * WORKSPACE SHELL API
 *
 * Execute shell commands in the workspace container
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager } from '@/lib/workspace/container';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for long-running commands

/**
 * POST - Execute a shell command
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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

    const body = await request.json();
    const { command, cwd, timeout = 30000 } = body;

    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    // Execute command
    const container = new ContainerManager();
    const result = await container.executeCommand(workspaceId, command, {
      cwd: cwd || '/workspace',
      timeout,
    });

    // Log the command (table created by workspace schema)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('shell_commands').insert({
      workspace_id: workspaceId,
      command,
      output: result.stdout + (result.stderr ? `\n${result.stderr}` : ''),
      exit_code: result.exitCode,
      duration_ms: result.executionTime,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTime: result.executionTime,
    });

  } catch (error) {
    console.error('Shell execution failed:', error);
    return NextResponse.json(
      { error: 'Command execution failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get command history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const { data: commands, error } = await supabase
      .from('shell_commands')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ commands });

  } catch (error) {
    console.error('Failed to get command history:', error);
    return NextResponse.json({ error: 'Failed to get command history' }, { status: 500 });
  }
}
