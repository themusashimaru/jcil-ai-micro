/**
 * GITHUB API ROUTE
 *
 * Admin-only API for GitHub operations
 * Used by CodeCommand for file editing, commits, and PRs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  isGitHubConfigured,
  getAuthenticatedUser,
  listRepositories,
  listContents,
  getFileContent,
  createOrUpdateFile,
  deleteFile,
  listBranches,
  createBranch,
  createPullRequest,
  searchCode,
} from '@/lib/github/client';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('GitHubAPI');

export const runtime = 'nodejs';

/**
 * Check if user is admin
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function requireAdmin(
  _request: NextRequest
): Promise<{ isAdmin: boolean; userId?: string; error?: NextResponse }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore errors in read-only contexts
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      isAdmin: false,
      error: errors.unauthorized(),
    };
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) {
    return {
      isAdmin: false,
      error: errors.forbidden('Admin access required'),
    };
  }

  return { isAdmin: true, userId: user.id };
}

/**
 * GET - Read operations
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.isAdmin) return auth.error;

  if (!isGitHubConfigured()) {
    return errors.serviceUnavailable('GitHub not configured. Set GITHUB_PAT in environment.');
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'status': {
        const user = await getAuthenticatedUser();
        return successResponse({
          configured: true,
          user: user?.login,
          name: user?.name,
        });
      }

      case 'repos': {
        const repos = await listRepositories();
        return successResponse({ repos });
      }

      case 'contents': {
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');
        const path = searchParams.get('path') || '';
        const ref = searchParams.get('ref') || undefined;

        if (!owner || !repo) {
          return errors.badRequest('owner and repo required');
        }

        const contents = await listContents(owner, repo, path, ref);
        return successResponse({ contents });
      }

      case 'file': {
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');
        const path = searchParams.get('path');
        const ref = searchParams.get('ref') || undefined;

        if (!owner || !repo || !path) {
          return errors.badRequest('owner, repo, and path required');
        }

        const file = await getFileContent(owner, repo, path, ref);
        if (!file) {
          return errors.notFound('File');
        }

        return successResponse({ file });
      }

      case 'branches': {
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');

        if (!owner || !repo) {
          return errors.badRequest('owner and repo required');
        }

        const branches = await listBranches(owner, repo);
        return successResponse({ branches });
      }

      case 'search': {
        const query = searchParams.get('q');
        const owner = searchParams.get('owner') || undefined;
        const repo = searchParams.get('repo') || undefined;

        if (!query) {
          return errors.badRequest('query (q) required');
        }

        const results = await searchCode(query, owner, repo);
        return successResponse({ results });
      }

      default:
        return errors.badRequest('Invalid action');
    }
  } catch (error) {
    log.error('[GitHub API] Error:', error instanceof Error ? error : { error });
    return errors.serverError('GitHub API error');
  }
}

/**
 * POST - Write operations
 */
export async function POST(request: NextRequest) {
  // CSRF Protection for state-changing operations
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  const auth = await requireAdmin(request);
  if (!auth.isAdmin) return auth.error;

  if (!isGitHubConfigured()) {
    return errors.serviceUnavailable('GitHub not configured. Set GITHUB_PAT in environment.');
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'createOrUpdate': {
        const { owner, repo, path, content, message, sha, branch } = body;

        if (!owner || !repo || !path || content === undefined || !message) {
          return errors.badRequest('owner, repo, path, content, and message required');
        }

        const result = await createOrUpdateFile(owner, repo, path, content, message, sha, branch);
        if (!result) {
          return errors.serverError('Failed to create/update file');
        }

        return successResponse({ success: true, ...result });
      }

      case 'delete': {
        const { owner, repo, path, sha, message, branch } = body;

        if (!owner || !repo || !path || !sha || !message) {
          return errors.badRequest('owner, repo, path, sha, and message required');
        }

        const success = await deleteFile(owner, repo, path, sha, message, branch);
        return successResponse({ success });
      }

      case 'createBranch': {
        const { owner, repo, branchName, fromSha } = body;

        if (!owner || !repo || !branchName || !fromSha) {
          return errors.badRequest('owner, repo, branchName, and fromSha required');
        }

        const success = await createBranch(owner, repo, branchName, fromSha);
        return successResponse({ success });
      }

      case 'createPR': {
        const { owner, repo, title, body: prBody, head, base } = body;

        if (!owner || !repo || !title || !head || !base) {
          return errors.badRequest('owner, repo, title, head, and base required');
        }

        const pr = await createPullRequest(owner, repo, title, prBody || '', head, base);
        if (!pr) {
          return errors.serverError('Failed to create pull request');
        }

        return successResponse({ success: true, ...pr });
      }

      default:
        return errors.badRequest('Invalid action');
    }
  } catch (error) {
    log.error('[GitHub API] Error:', error instanceof Error ? error : { error });
    return errors.serverError('GitHub API error');
  }
}
