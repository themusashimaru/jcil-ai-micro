/**
 * CONNECTORS API ROUTE
 * ====================
 *
 * Manages user's external service connections.
 * GET: Get connection status for all connectors
 * POST: Perform connector operations (list repos, push code, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  getAllConnectorStatuses,
  getGitHubConnectionStatus,
  listUserRepos,
  createRepository,
  pushFiles,
  checkTokenScopes,
  isConnectorsEnabled,
} from '@/lib/connectors';

export const runtime = 'nodejs';

/**
 * Get GitHub token from Supabase session
 */
async function getGitHubToken(): Promise<{
  token: string | null;
  userId: string | null;
  error?: string;
}> {
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

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { token: null, userId: null, error: 'Not authenticated' };
  }

  // Check if user logged in with GitHub
  const githubIdentity = user.identities?.find(
    (identity) => identity.provider === 'github'
  );

  if (!githubIdentity) {
    return { token: null, userId: user.id, error: 'Not connected via GitHub' };
  }

  // Get the session to access provider_token
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.provider_token) {
    return { token: session.provider_token, userId: user.id };
  }

  // Provider token might have expired - user needs to re-authenticate
  return { token: null, userId: user.id, error: 'GitHub token expired. Please login again with GitHub.' };
}

/**
 * GET - Get connector statuses
 */
export async function GET(request: NextRequest) {
  if (!isConnectorsEnabled()) {
    return NextResponse.json({ error: 'Connectors not enabled' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  const { token, userId, error } = await getGitHubToken();

  if (!userId) {
    return NextResponse.json({ error: error || 'Not authenticated' }, { status: 401 });
  }

  try {
    switch (action) {
      case 'status': {
        const connectors = await getAllConnectorStatuses(token);
        return NextResponse.json({ connectors });
      }

      case 'github-status': {
        if (!token) {
          return NextResponse.json({
            connected: false,
            error: error || 'GitHub not connected',
            needsReauth: error?.includes('expired'),
          });
        }

        const status = await getGitHubConnectionStatus(token);
        const scopes = await checkTokenScopes(token);

        return NextResponse.json({
          connected: status.status === 'connected',
          username: status.metadata?.username,
          email: status.metadata?.email,
          avatarUrl: status.metadata?.avatarUrl,
          scopes: scopes.scopes,
          hasRepoScope: scopes.hasRepoScope,
        });
      }

      case 'github-repos': {
        if (!token) {
          return NextResponse.json({ error: error || 'GitHub not connected' }, { status: 400 });
        }

        const repos = await listUserRepos(token);
        return NextResponse.json({ repos });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[Connectors API] Error:', err);
    return NextResponse.json({ error: 'Connector operation failed' }, { status: 500 });
  }
}

/**
 * POST - Perform connector operations
 */
export async function POST(request: NextRequest) {
  if (!isConnectorsEnabled()) {
    return NextResponse.json({ error: 'Connectors not enabled' }, { status: 503 });
  }

  const { token, userId, error } = await getGitHubToken();

  if (!userId) {
    return NextResponse.json({ error: error || 'Not authenticated' }, { status: 401 });
  }

  if (!token) {
    return NextResponse.json({
      error: error || 'GitHub not connected',
      needsReauth: error?.includes('expired'),
    }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create-repo': {
        const { name, description, isPrivate } = body;

        if (!name) {
          return NextResponse.json({ error: 'Repository name required' }, { status: 400 });
        }

        const repo = await createRepository(token, {
          name,
          description,
          private: isPrivate,
          autoInit: true,
        });

        if (!repo) {
          return NextResponse.json({ error: 'Failed to create repository' }, { status: 500 });
        }

        return NextResponse.json({ success: true, repo });
      }

      case 'push-files': {
        const { owner, repo, branch, message, files } = body;

        if (!owner || !repo || !message || !files || files.length === 0) {
          return NextResponse.json({
            error: 'owner, repo, message, and files required',
          }, { status: 400 });
        }

        const result = await pushFiles(token, {
          owner,
          repo,
          branch,
          message,
          files,
        });

        if (!result.success) {
          return NextResponse.json({ error: result.error || 'Push failed' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          commitSha: result.commitSha,
          repoUrl: result.repoUrl,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[Connectors API] Error:', err);
    return NextResponse.json({ error: 'Connector operation failed' }, { status: 500 });
  }
}
