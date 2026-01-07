/**
 * WORKSPACE API - Main Endpoint
 *
 * Handles workspace CRUD operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WorkspaceManager } from '@/lib/workspace';
import { ContainerManager } from '@/lib/workspace/container';
import { validateCSRF } from '@/lib/security/csrf';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET - List user's workspaces
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workspaces, error } = await (supabase as any)
      .from('workspaces')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Get container status for each workspace
    const container = new ContainerManager();
    const workspacesWithStatus = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (workspaces || []).map(async (ws: any) => {
        const status = await container.getStatus(ws.id);
        return { ...ws, containerStatus: status };
      })
    );

    return NextResponse.json({ workspaces: workspacesWithStatus });

  } catch (error) {
    console.error('Failed to list workspaces:', error);
    return NextResponse.json(
      { error: 'Failed to list workspaces' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new workspace
 */
export async function POST(request: NextRequest) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type = 'sandbox', githubRepo, config = {} } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const manager = new WorkspaceManager();

    let workspace;
    if (type === 'github' && githubRepo) {
      workspace = await manager.cloneFromGitHub(user.id, githubRepo);
    } else {
      workspace = await manager.createWorkspace(user.id, name, type, config);
    }

    return NextResponse.json({ workspace }, { status: 201 });

  } catch (error) {
    console.error('Failed to create workspace:', error);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }
}
