/**
 * CODE LAB FILES API
 *
 * Workspace file operations - read, write, create, delete files
 * Integrates with E2B sandbox for isolated execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager } from '@/lib/workspace/container';

// GET - List files or read file content
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const path = searchParams.get('path');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  try {
    const container = new ContainerManager();

    if (path) {
      // Read specific file
      const content = await container.readFile(sessionId, path);
      return NextResponse.json({ content, path });
    } else {
      // List all files recursively
      const files = await container.listDirectory(sessionId, '/workspace');
      return NextResponse.json({ files });
    }
  } catch (error) {
    console.error('[Files API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to access files' },
      { status: 500 }
    );
  }
}

// POST - Create new file
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId, path, content = '' } = await request.json();

    if (!sessionId || !path) {
      return NextResponse.json(
        { error: 'Session ID and path required' },
        { status: 400 }
      );
    }

    const container = new ContainerManager();
    await container.writeFile(sessionId, path, content);

    return NextResponse.json({ success: true, path });
  } catch (error) {
    console.error('[Files API] Error creating file:', error);
    return NextResponse.json(
      { error: 'Failed to create file' },
      { status: 500 }
    );
  }
}

// PUT - Update existing file
export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId, path, content } = await request.json();

    if (!sessionId || !path) {
      return NextResponse.json(
        { error: 'Session ID and path required' },
        { status: 400 }
      );
    }

    const container = new ContainerManager();
    await container.writeFile(sessionId, path, content);

    return NextResponse.json({ success: true, path });
  } catch (error) {
    console.error('[Files API] Error updating file:', error);
    return NextResponse.json(
      { error: 'Failed to update file' },
      { status: 500 }
    );
  }
}

// DELETE - Delete file
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const path = searchParams.get('path');

  if (!sessionId || !path) {
    return NextResponse.json(
      { error: 'Session ID and path required' },
      { status: 400 }
    );
  }

  try {
    const container = new ContainerManager();
    await container.deleteFile(sessionId, path);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Files API] Error deleting file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
