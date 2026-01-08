/**
 * WORKSPACE API - Individual Workspace Operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager } from '@/lib/workspace/container';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';

const log = logger('WorkspaceAPI');

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET - Get workspace details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Table created by workspace schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workspace, error } = await (supabase as any)
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get container status
    const container = new ContainerManager();
    const containerStatus = await container.getStatus(id);

    // Get workspace stats (custom RPC function from workspace schema)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stats } = await (supabase as any).rpc('get_workspace_stats', { p_workspace_id: id });

    return NextResponse.json({
      workspace: { ...workspace, containerStatus, stats }
    });

  } catch (error) {
    log.error('Failed to get workspace', error as Error);
    return NextResponse.json({ error: 'Failed to get workspace' }, { status: 500 });
  }
}

/**
 * PATCH - Update workspace
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, config, status } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name) updates.name = name;
    if (config) updates.config = config;
    if (status) updates.status = status;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workspace, error } = await (supabase as any)
      .from('workspaces')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ workspace });

  } catch (error) {
    log.error('Failed to update workspace', error as Error);
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
  }
}

/**
 * DELETE - Delete workspace and terminate container
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Terminate container first
    const container = new ContainerManager();
    await container.terminateContainer(id);

    // Delete from database
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error) {
    log.error('Failed to delete workspace', error as Error);
    return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
  }
}
