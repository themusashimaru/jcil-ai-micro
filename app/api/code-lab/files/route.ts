/**
 * CODE LAB FILES API
 *
 * Workspace file operations - read, write, create, delete files
 * Integrates with E2B sandbox for isolated execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager, getContainerManager, getContainerManager } from '@/lib/workspace/container';
import { sanitizeFilePath } from '@/lib/workspace/security';
import { rateLimiters } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';

const log = logger('CodeLabFiles');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// Helper to verify session ownership
async function verifySessionOwnership(
  supabase: AnySupabase,
  sessionId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await (supabase.from('code_lab_sessions') as AnySupabase)
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  return !error && !!data;
}

// GET - List files or read file content
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting
  const rateLimitResult = await rateLimiters.codeLabFiles(user.id);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const path = searchParams.get('path');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  // Verify session ownership
  const hasAccess = await verifySessionOwnership(supabase, sessionId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 });
  }

  try {
    const container = getContainerManager();

    if (path) {
      // Sanitize and read specific file
      const safePath = sanitizeFilePath(path);
      const content = await container.readFile(sessionId, safePath);
      return NextResponse.json({ content, path: safePath });
    } else {
      // List all files recursively
      const files = await container.listDirectory(sessionId, '/workspace');
      return NextResponse.json({ files });
    }
  } catch (error) {
    log.error('[Files API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Failed to access files' }, { status: 500 });
  }
}

// POST - Create new file
export async function POST(request: NextRequest) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting
  const rateLimitResult = await rateLimiters.codeLabFiles(user.id);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        },
      }
    );
  }

  try {
    const { sessionId, path, content = '' } = await request.json();

    if (!sessionId || !path) {
      return NextResponse.json({ error: 'Session ID and path required' }, { status: 400 });
    }

    // Verify session ownership
    const hasAccess = await verifySessionOwnership(supabase, sessionId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 });
    }

    // Sanitize path
    const safePath = sanitizeFilePath(path);

    const container = getContainerManager();
    await container.writeFile(sessionId, safePath, content);

    return NextResponse.json({ success: true, path: safePath });
  } catch (error) {
    log.error('[Files API] Error creating file:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Failed to create file' }, { status: 500 });
  }
}

// PUT - Update existing file
export async function PUT(request: NextRequest) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting
  const rateLimitResult = await rateLimiters.codeLabFiles(user.id);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        },
      }
    );
  }

  try {
    const { sessionId, path, content } = await request.json();

    if (!sessionId || !path) {
      return NextResponse.json({ error: 'Session ID and path required' }, { status: 400 });
    }

    // Verify session ownership
    const hasAccess = await verifySessionOwnership(supabase, sessionId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 });
    }

    // Sanitize path
    const safePath = sanitizeFilePath(path);

    const container = getContainerManager();
    await container.writeFile(sessionId, safePath, content);

    return NextResponse.json({ success: true, path: safePath });
  } catch (error) {
    log.error('[Files API] Error updating file:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}

// DELETE - Delete file
export async function DELETE(request: NextRequest) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting
  const rateLimitResult = await rateLimiters.codeLabFiles(user.id);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const path = searchParams.get('path');

  if (!sessionId || !path) {
    return NextResponse.json({ error: 'Session ID and path required' }, { status: 400 });
  }

  // Verify session ownership
  const hasAccess = await verifySessionOwnership(supabase, sessionId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 });
  }

  try {
    // Sanitize path
    const safePath = sanitizeFilePath(path);

    const container = getContainerManager();
    await container.deleteFile(sessionId, safePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[Files API] Error deleting file:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
