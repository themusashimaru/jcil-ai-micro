/**
 * CODE LAB FILES API
 *
 * Workspace file operations - read, write, create, delete files
 * Integrates with E2B sandbox for isolated execution
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getContainerManager } from '@/lib/workspace/container';
import { sanitizeFilePath } from '@/lib/workspace/security';
import { rateLimiters } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { successResponse, errors } from '@/lib/api/utils';

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
    return errors.unauthorized();
  }

  // Rate limiting
  const rateLimitResult = await rateLimiters.codeLabFiles(user.id);
  if (!rateLimitResult.allowed) {
    return errors.rateLimited(rateLimitResult.retryAfter);
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const path = searchParams.get('path');

  if (!sessionId) {
    return errors.badRequest('Session ID required');
  }

  // Verify session ownership
  const hasAccess = await verifySessionOwnership(supabase, sessionId, user.id);
  if (!hasAccess) {
    return errors.sessionAccessDenied();
  }

  try {
    const container = getContainerManager();

    if (path) {
      // Sanitize and read specific file
      const safePath = sanitizeFilePath(path);
      const content = await container.readFile(sessionId, safePath);
      return successResponse({ content, path: safePath });
    } else {
      // List all files recursively
      const files = await container.listDirectory(sessionId, '/workspace');
      return successResponse({ files });
    }
  } catch (error) {
    log.error('[Files API] Error:', error instanceof Error ? error : { error });
    return errors.serverError('Failed to access files');
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
    return errors.unauthorized();
  }

  // Rate limiting
  const rateLimitResult = await rateLimiters.codeLabFiles(user.id);
  if (!rateLimitResult.allowed) {
    return errors.rateLimited(rateLimitResult.retryAfter);
  }

  try {
    const { sessionId, path, content = '' } = await request.json();

    if (!sessionId || !path) {
      return errors.badRequest('Session ID and path required');
    }

    // Verify session ownership
    const hasAccess = await verifySessionOwnership(supabase, sessionId, user.id);
    if (!hasAccess) {
      return errors.sessionAccessDenied();
    }

    // Sanitize path
    const safePath = sanitizeFilePath(path);

    const container = getContainerManager();
    await container.writeFile(sessionId, safePath, content);

    return successResponse({ success: true, path: safePath });
  } catch (error) {
    log.error('[Files API] Error creating file:', error instanceof Error ? error : { error });
    return errors.serverError('Failed to create file');
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
    return errors.unauthorized();
  }

  // Rate limiting
  const rateLimitResult = await rateLimiters.codeLabFiles(user.id);
  if (!rateLimitResult.allowed) {
    return errors.rateLimited(rateLimitResult.retryAfter);
  }

  try {
    const { sessionId, path, content } = await request.json();

    if (!sessionId || !path) {
      return errors.badRequest('Session ID and path required');
    }

    // Verify session ownership
    const hasAccess = await verifySessionOwnership(supabase, sessionId, user.id);
    if (!hasAccess) {
      return errors.sessionAccessDenied();
    }

    // Sanitize path
    const safePath = sanitizeFilePath(path);

    const container = getContainerManager();
    await container.writeFile(sessionId, safePath, content);

    return successResponse({ success: true, path: safePath });
  } catch (error) {
    log.error('[Files API] Error updating file:', error instanceof Error ? error : { error });
    return errors.serverError('Failed to update file');
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
    return errors.unauthorized();
  }

  // Rate limiting
  const rateLimitResult = await rateLimiters.codeLabFiles(user.id);
  if (!rateLimitResult.allowed) {
    return errors.rateLimited(rateLimitResult.retryAfter);
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const path = searchParams.get('path');

  if (!sessionId || !path) {
    return errors.badRequest('Session ID and path required');
  }

  // Verify session ownership
  const hasAccess = await verifySessionOwnership(supabase, sessionId, user.id);
  if (!hasAccess) {
    return errors.sessionAccessDenied();
  }

  try {
    // Sanitize path
    const safePath = sanitizeFilePath(path);

    const container = getContainerManager();
    await container.deleteFile(sessionId, safePath);

    return successResponse({ success: true });
  } catch (error) {
    log.error('[Files API] Error deleting file:', error instanceof Error ? error : { error });
    return errors.serverError('Failed to delete file');
  }
}
