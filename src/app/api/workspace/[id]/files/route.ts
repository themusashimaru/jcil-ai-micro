/**
 * WORKSPACE FILES API
 *
 * File system operations in the workspace container
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager } from '@/lib/workspace/container';
import { validateCSRF } from '@/lib/security/csrf';
import { sanitizeFilePath } from '@/lib/workspace/security';
import { logger } from '@/lib/logger';

const log = logger('FilesAPI');

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET - Read file or list directory
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

    const url = new URL(request.url);
    // SECURITY: Sanitize path to prevent traversal attacks
    const rawPath = url.searchParams.get('path') || '/workspace';
    const path = sanitizeFilePath(rawPath, '/workspace');
    const action = url.searchParams.get('action') || 'read'; // 'read' or 'list'

    const container = new ContainerManager();

    if (action === 'list') {
      const files = await container.listDirectory(workspaceId, path);
      return NextResponse.json({ files, path });
    } else {
      const content = await container.readFile(workspaceId, path);
      return NextResponse.json({ content, path });
    }

  } catch (error) {
    log.error('File operation failed', error as Error);
    return NextResponse.json(
      { error: 'File operation failed' },
      { status: 500 }
    );
  }
}

/**
 * POST - Write or create file
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

    const body = await request.json();
    const { path: rawPath, content } = body;

    if (!rawPath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // SECURITY: Sanitize path
    const path = sanitizeFilePath(rawPath, '/workspace');

    const container = new ContainerManager();
    await container.writeFile(workspaceId, path, content || '');

    return NextResponse.json({ success: true, path });

  } catch (error) {
    log.error('File write failed', error as Error);
    return NextResponse.json(
      { error: 'File write failed' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update file (batch operations)
 */
export async function PUT(
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

    const body = await request.json();
    const { operations } = body; // Array of { path, content, action: 'write' | 'delete' }

    if (!Array.isArray(operations)) {
      return NextResponse.json({ error: 'Operations array is required' }, { status: 400 });
    }

    const container = new ContainerManager();
    const results: Array<{ path: string; success: boolean; error?: string }> = [];

    for (const op of operations) {
      try {
        // SECURITY: Sanitize each path
        const safePath = sanitizeFilePath(op.path, '/workspace');
        if (op.action === 'delete') {
          await container.deleteFile(workspaceId, safePath);
        } else {
          await container.writeFile(workspaceId, safePath, op.content || '');
        }
        results.push({ path: safePath, success: true });
      } catch (error) {
        results.push({
          path: op.path,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const allSucceeded = results.every(r => r.success);

    return NextResponse.json({
      success: allSucceeded,
      results,
    });

  } catch (error) {
    log.error('Batch file operation failed', error as Error);
    return NextResponse.json(
      { error: 'Batch operation failed' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete file
 */
export async function DELETE(
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

    const url = new URL(request.url);
    const rawPath = url.searchParams.get('path');

    if (!rawPath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // SECURITY: Sanitize path
    const path = sanitizeFilePath(rawPath, '/workspace');

    const container = new ContainerManager();
    await container.deleteFile(workspaceId, path);

    return NextResponse.json({ success: true, path });

  } catch (error) {
    log.error('File delete failed', error as Error);
    return NextResponse.json(
      { error: 'File delete failed' },
      { status: 500 }
    );
  }
}
