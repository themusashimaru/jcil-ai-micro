/**
 * WORKSPACE API - Main Endpoint
 *
 * Handles workspace CRUD operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WorkspaceManager } from '@/lib/workspace';
import { ContainerManager, getContainerManager } from '@/lib/workspace/container';
import { validateCSRF } from '@/lib/security/csrf';
import { safeParseJSON } from '@/lib/security/validation';
import { logger } from '@/lib/logger';

const log = logger('WorkspaceAPI');

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

    // N+1 FIX: Batch container status checks
    // Instead of N sequential calls, get status for up to 10 workspaces in parallel
    // For larger lists, return "unknown" status to avoid performance issues
    const container = getContainerManager();
    const MAX_STATUS_CHECKS = 10;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workspacesWithStatus = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (workspaces || []).map(async (ws: any, index: number) => {
        // Only check status for first MAX_STATUS_CHECKS workspaces
        if (index < MAX_STATUS_CHECKS) {
          try {
            const status = await container.getStatus(ws.id);
            return { ...ws, containerStatus: status };
          } catch {
            return { ...ws, containerStatus: 'unknown' };
          }
        }
        // For remaining workspaces, return unknown status (lazy load on demand)
        return { ...ws, containerStatus: 'unknown' };
      })
    );

    return NextResponse.json({ workspaces: workspacesWithStatus });

  } catch (error) {
    log.error('Failed to list workspaces', error as Error);
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

    type WorkspaceType = 'sandbox' | 'github' | 'project';
    const jsonResult = await safeParseJSON<{ name?: string; type?: WorkspaceType; githubRepo?: string; config?: Record<string, unknown> }>(request);
    if (!jsonResult.success) {
      return NextResponse.json({ error: jsonResult.error }, { status: 400 });
    }
    const { name, type = 'sandbox' as WorkspaceType, githubRepo, config = {} } = jsonResult.data;

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
    log.error('Failed to create workspace', error as Error);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }
}
