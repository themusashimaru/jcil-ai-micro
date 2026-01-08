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

export const runtime = 'nodejs';

/**
 * Check if user is admin
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function requireAdmin(_request: NextRequest): Promise<{ isAdmin: boolean; userId?: string; error?: NextResponse }> {
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

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      isAdmin: false,
      error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
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
      error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
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
    return NextResponse.json({ error: 'GitHub not configured. Set GITHUB_PAT in environment.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'status': {
        const user = await getAuthenticatedUser();
        return NextResponse.json({
          configured: true,
          user: user?.login,
          name: user?.name,
        });
      }

      case 'repos': {
        const repos = await listRepositories();
        return NextResponse.json({ repos });
      }

      case 'contents': {
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');
        const path = searchParams.get('path') || '';
        const ref = searchParams.get('ref') || undefined;

        if (!owner || !repo) {
          return NextResponse.json({ error: 'owner and repo required' }, { status: 400 });
        }

        const contents = await listContents(owner, repo, path, ref);
        return NextResponse.json({ contents });
      }

      case 'file': {
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');
        const path = searchParams.get('path');
        const ref = searchParams.get('ref') || undefined;

        if (!owner || !repo || !path) {
          return NextResponse.json({ error: 'owner, repo, and path required' }, { status: 400 });
        }

        const file = await getFileContent(owner, repo, path, ref);
        if (!file) {
          return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        return NextResponse.json({ file });
      }

      case 'branches': {
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');

        if (!owner || !repo) {
          return NextResponse.json({ error: 'owner and repo required' }, { status: 400 });
        }

        const branches = await listBranches(owner, repo);
        return NextResponse.json({ branches });
      }

      case 'search': {
        const query = searchParams.get('q');
        const owner = searchParams.get('owner') || undefined;
        const repo = searchParams.get('repo') || undefined;

        if (!query) {
          return NextResponse.json({ error: 'query (q) required' }, { status: 400 });
        }

        const results = await searchCode(query, owner, repo);
        return NextResponse.json({ results });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[GitHub API] Error:', error);
    return NextResponse.json({ error: 'GitHub API error' }, { status: 500 });
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
    return NextResponse.json({ error: 'GitHub not configured. Set GITHUB_PAT in environment.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'createOrUpdate': {
        const { owner, repo, path, content, message, sha, branch } = body;

        if (!owner || !repo || !path || content === undefined || !message) {
          return NextResponse.json({ error: 'owner, repo, path, content, and message required' }, { status: 400 });
        }

        const result = await createOrUpdateFile(owner, repo, path, content, message, sha, branch);
        if (!result) {
          return NextResponse.json({ error: 'Failed to create/update file' }, { status: 500 });
        }

        return NextResponse.json({ success: true, ...result });
      }

      case 'delete': {
        const { owner, repo, path, sha, message, branch } = body;

        if (!owner || !repo || !path || !sha || !message) {
          return NextResponse.json({ error: 'owner, repo, path, sha, and message required' }, { status: 400 });
        }

        const success = await deleteFile(owner, repo, path, sha, message, branch);
        return NextResponse.json({ success });
      }

      case 'createBranch': {
        const { owner, repo, branchName, fromSha } = body;

        if (!owner || !repo || !branchName || !fromSha) {
          return NextResponse.json({ error: 'owner, repo, branchName, and fromSha required' }, { status: 400 });
        }

        const success = await createBranch(owner, repo, branchName, fromSha);
        return NextResponse.json({ success });
      }

      case 'createPR': {
        const { owner, repo, title, body: prBody, head, base } = body;

        if (!owner || !repo || !title || !head || !base) {
          return NextResponse.json({ error: 'owner, repo, title, head, and base required' }, { status: 400 });
        }

        const pr = await createPullRequest(owner, repo, title, prBody || '', head, base);
        if (!pr) {
          return NextResponse.json({ error: 'Failed to create pull request' }, { status: 500 });
        }

        return NextResponse.json({ success: true, ...pr });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[GitHub API] Error:', error);
    return NextResponse.json({ error: 'GitHub API error' }, { status: 500 });
  }
}
