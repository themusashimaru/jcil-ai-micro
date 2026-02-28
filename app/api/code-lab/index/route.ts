/**
 * CODEBASE INDEX API
 *
 * Note: Semantic codebase indexing has been disabled (required Google embeddings).
 * Use Code Lab grep/find tools for code search instead.
 */

import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('CodeLabIndex');

/**
 * GET - Check index status for a repo
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errors.unauthorized();
    }

    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return errors.badRequest('Missing owner or repo');
    }

    // RAG indexing disabled - return not indexed status
    return successResponse({
      indexed: false,
      message: 'Semantic indexing disabled. Use Code Lab grep/find tools for code search.',
    });
  } catch (error) {
    log.error('[Codebase Index API] GET error:', error instanceof Error ? error : { error });
    return errors.serverError('Index check failed');
  }
}

/**
 * POST - Index a repository (disabled)
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errors.unauthorized();
    }

    const body = await request.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return errors.badRequest('Missing owner or repo');
    }

    // RAG indexing disabled
    return successResponse({
      success: false,
      message: 'Semantic indexing disabled. Use Code Lab grep/find tools for code search.',
    });
  } catch (error) {
    log.error('[Codebase Index API] POST error:', error instanceof Error ? error : { error });
    return errors.serverError('Index creation failed');
  }
}

/**
 * DELETE - Remove an index (disabled)
 */
export async function DELETE(request: NextRequest) {
  // CSRF protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errors.unauthorized();
    }

    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return errors.badRequest('Missing owner or repo');
    }

    // RAG indexing disabled - nothing to delete
    return successResponse({
      success: true,
      message: 'Semantic indexing disabled. Nothing to delete.',
    });
  } catch (error) {
    log.error('[Codebase Index API] DELETE error:', error instanceof Error ? error : { error });
    return errors.serverError('Index deletion failed');
  }
}
