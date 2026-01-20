/**
 * WORKSPACE SHELL API
 *
 * Execute shell commands in the workspace container
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager, getContainerManager } from '@/lib/workspace/container';
import { validateCSRF } from '@/lib/security/csrf';
import { validateQueryLimit, safeParseJSON } from '@/lib/security/validation';
import { logger } from '@/lib/logger';

const log = logger('ShellAPI');

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for long-running commands

/**
 * POST - Execute a shell command
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

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

    const jsonResult = await safeParseJSON<{ command?: string; cwd?: string; timeout?: number }>(request);
    if (!jsonResult.success) {
      return NextResponse.json({ error: jsonResult.error }, { status: 400 });
    }
    const { command, cwd, timeout = 30000 } = jsonResult.data;

    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    // Execute command
    const container = getContainerManager();
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
    log.error('Shell execution failed', error as Error);
    return NextResponse.json(
      { error: 'Command execution failed' },
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
    // SECURITY: Validate limit parameter
    const limit = validateQueryLimit(url.searchParams.get('limit'), { default: 50, max: 200 });

    const { data: commands, error } = await supabase
      .from('shell_commands')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ commands });

  } catch (error) {
    log.error('Failed to get command history', error as Error);
    return NextResponse.json({ error: 'Failed to get command history' }, { status: 500 });
  }
}
