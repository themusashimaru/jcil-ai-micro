/**
 * WORKSPACE FILES API
 *
 * File system operations in the workspace container
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager } from '@/lib/workspace/container';

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
    const path = url.searchParams.get('path') || '/workspace';
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
    console.error('File operation failed:', error);
    return NextResponse.json(
      { error: 'File operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const { path, content } = body;

    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    const container = new ContainerManager();
    await container.writeFile(workspaceId, path, content || '');

    return NextResponse.json({ success: true, path });

  } catch (error) {
    console.error('File write failed:', error);
    return NextResponse.json(
      { error: 'File write failed', details: error instanceof Error ? error.message : 'Unknown error' },
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
        if (op.action === 'delete') {
          await container.deleteFile(workspaceId, op.path);
        } else {
          await container.writeFile(workspaceId, op.path, op.content || '');
        }
        results.push({ path: op.path, success: true });
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
    console.error('Batch file operation failed:', error);
    return NextResponse.json(
      { error: 'Batch operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const path = url.searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    const container = new ContainerManager();
    await container.deleteFile(workspaceId, path);

    return NextResponse.json({ success: true, path });

  } catch (error) {
    console.error('File delete failed:', error);
    return NextResponse.json(
      { error: 'File delete failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
