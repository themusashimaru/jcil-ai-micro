/**
 * CODEBASE INDEX API
 *
 * Note: Semantic codebase indexing has been disabled (required Google embeddings).
 * Use Code Lab grep/find tools for code search instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing owner or repo' }, { status: 400 });
    }

    // RAG indexing disabled - return not indexed status
    return NextResponse.json({
      indexed: false,
      message: 'Semantic indexing disabled. Use Code Lab grep/find tools for code search.',
    });
  } catch (error) {
    log.error('[Codebase Index API] GET error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Index check failed', code: 'INDEX_CHECK_FAILED' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing owner or repo' }, { status: 400 });
    }

    // RAG indexing disabled
    return NextResponse.json({
      success: false,
      message: 'Semantic indexing disabled. Use Code Lab grep/find tools for code search.',
    });
  } catch (error) {
    log.error('[Codebase Index API] POST error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Index creation failed', code: 'INDEX_CREATE_FAILED' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing owner or repo' }, { status: 400 });
    }

    // RAG indexing disabled - nothing to delete
    return NextResponse.json({
      success: true,
      message: 'Semantic indexing disabled. Nothing to delete.',
    });
  } catch (error) {
    log.error('[Codebase Index API] DELETE error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Index deletion failed', code: 'INDEX_DELETE_FAILED' },
      { status: 500 }
    );
  }
}
