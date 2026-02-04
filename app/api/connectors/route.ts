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
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import {
  listUserRepos,
  createRepository,
  pushFiles,
  isConnectorsEnabled,
  cloneRepo,
  getRepoTree,
  getFileContent,
  getRepoInfo,
  getBranches,
  getCommits,
  createBranch,
  createPullRequest,
  compareBranches,
  parseGitHubUrl,
} from '@/lib/connectors';
// SECURITY FIX: Use centralized crypto module which requires dedicated ENCRYPTION_KEY
// (no fallback to SERVICE_ROLE_KEY for separation of concerns)
import { decrypt as decryptToken, EncryptionError, DecryptionError } from '@/lib/security/crypto';

const log = logger('ConnectorsAPI');

export const runtime = 'nodejs';

/**
 * Get GitHub token from database (stored via Personal Access Token)
 */
async function getGitHubToken(): Promise<{
  token: string | null;
  userId: string | null;
  username: string | null;
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

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { token: null, userId: null, username: null, error: 'Not authenticated' };
  }

  // Get token from database
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: userData } = await adminClient
    .from('users')
    .select('github_token, github_username')
    .eq('id', user.id)
    .single();

  if (!userData?.github_token) {
    return {
      token: null,
      userId: user.id,
      username: null,
      error: 'GitHub not connected. Add your Personal Access Token in Connectors.',
    };
  }

  try {
    const decryptedToken = decryptToken(userData.github_token);
    return {
      token: decryptedToken,
      userId: user.id,
      username: userData.github_username,
    };
  } catch (err) {
    // Handle different error types differently
    if (err instanceof EncryptionError && err.code === 'NO_KEY') {
      // Server configuration issue - ENCRYPTION_KEY not set
      // DON'T clear the token - this is a server problem, not a token problem
      log.error('[Connectors] ENCRYPTION_KEY not configured - cannot decrypt GitHub token');
      return {
        token: null,
        userId: user.id,
        username: null,
        error: 'Server encryption not configured. Please contact support.',
      };
    }

    if (err instanceof DecryptionError) {
      // Token was encrypted with different key or is corrupted
      log.warn('[Connectors] Clearing invalid GitHub token due to decryption failure', {
        code: err.code,
      });
      await adminClient
        .from('users')
        .update({ github_token: null, github_username: null })
        .eq('id', user.id);
      return {
        token: null,
        userId: user.id,
        username: null,
        error: 'GitHub session expired. Please reconnect your GitHub account in Settings.',
      };
    }

    // Unknown error - log but don't clear token
    log.error('[Connectors] Unexpected error decrypting GitHub token', {
      error: err instanceof Error ? err.message : err,
    });
    return {
      token: null,
      userId: user.id,
      username: null,
      error: 'Failed to access GitHub token. Please try again.',
    };
  }
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

  const { token, userId, username, error } = await getGitHubToken();

  if (!userId) {
    return NextResponse.json({ error: error || 'Not authenticated' }, { status: 401 });
  }

  try {
    switch (action) {
      case 'status': {
        // Return GitHub connection status
        const connectors = [
          {
            type: 'github',
            status: token ? 'connected' : 'disconnected',
            displayName: 'GitHub',
            icon: '🐙',
            description: 'Push code to repositories',
            metadata: token ? { username } : undefined,
          },
        ];
        return NextResponse.json({ connectors });
      }

      case 'github-status': {
        if (!token) {
          return NextResponse.json({
            connected: false,
            error: error || 'GitHub not connected',
          });
        }

        return NextResponse.json({
          connected: true,
          username,
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
    log.error('[Connectors API] Error:', err instanceof Error ? err : { err });
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
    return NextResponse.json(
      {
        error: error || 'GitHub not connected. Add your Personal Access Token in Connectors.',
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'listRepos': {
        const repos = await listUserRepos(token);
        return NextResponse.json({ repos });
      }

      case 'pushFiles':
      case 'push-files': {
        const { owner, repo, branch, message, files } = body;

        if (!owner || !repo || !message || !files || files.length === 0) {
          return NextResponse.json(
            {
              error: 'owner, repo, message, and files required',
            },
            { status: 400 }
          );
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

      // ========================================================================
      // Repository Read Operations (for AI code review)
      // ========================================================================

      case 'clone-repo':
      case 'cloneRepo': {
        // Smart clone - fetch repository files with filters
        const { branch, path, maxFiles, maxFileSize, includePatterns, excludePatterns } = body;
        let { owner, repo } = body;

        // Support URL input (e.g., "https://github.com/owner/repo")
        if (body.url && !owner) {
          const parsed = parseGitHubUrl(body.url);
          if (!parsed) {
            return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });
          }
          owner = parsed.owner;
          repo = parsed.repo;
        }

        if (!owner || !repo) {
          return NextResponse.json({ error: 'owner and repo required (or url)' }, { status: 400 });
        }

        const cloneResult = await cloneRepo(token, {
          owner,
          repo,
          branch,
          path,
          maxFiles: maxFiles || 100,
          maxFileSize: maxFileSize || 100 * 1024,
          includePatterns,
          excludePatterns,
        });

        if (!cloneResult.success) {
          return NextResponse.json({ error: cloneResult.error || 'Clone failed' }, { status: 500 });
        }

        return NextResponse.json(cloneResult);
      }

      case 'get-tree':
      case 'getTree': {
        // Get repository tree (directory structure)
        const { branch, recursive } = body;
        let { owner, repo } = body;

        if (body.url && !owner) {
          const parsed = parseGitHubUrl(body.url);
          if (!parsed) {
            return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });
          }
          owner = parsed.owner;
          repo = parsed.repo;
        }

        if (!owner || !repo) {
          return NextResponse.json({ error: 'owner and repo required (or url)' }, { status: 400 });
        }

        const tree = await getRepoTree(token, owner, repo, branch, recursive !== false);
        if (!tree) {
          return NextResponse.json({ error: 'Failed to fetch repository tree' }, { status: 500 });
        }

        return NextResponse.json(tree);
      }

      case 'get-file':
      case 'getFile': {
        // Get single file content
        const { owner, repo, path: filePath, branch } = body;

        if (!owner || !repo || !filePath) {
          return NextResponse.json({ error: 'owner, repo, and path required' }, { status: 400 });
        }

        const file = await getFileContent(token, owner, repo, filePath, branch);
        if (!file) {
          return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        return NextResponse.json(file);
      }

      case 'get-repo-info':
      case 'getRepoInfo': {
        // Get repository metadata
        let { owner, repo } = body;

        if (body.url && !owner) {
          const parsed = parseGitHubUrl(body.url);
          if (!parsed) {
            return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });
          }
          owner = parsed.owner;
          repo = parsed.repo;
        }

        if (!owner || !repo) {
          return NextResponse.json({ error: 'owner and repo required (or url)' }, { status: 400 });
        }

        const repoInfo = await getRepoInfo(token, owner, repo);
        if (!repoInfo) {
          return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
        }

        return NextResponse.json(repoInfo);
      }

      case 'get-branches':
      case 'getBranches': {
        const { owner, repo } = body;

        if (!owner || !repo) {
          return NextResponse.json({ error: 'owner and repo required' }, { status: 400 });
        }

        const branches = await getBranches(token, owner, repo);
        return NextResponse.json({ branches });
      }

      case 'get-commits':
      case 'getCommits': {
        const { owner, repo, branch, limit } = body;

        if (!owner || !repo) {
          return NextResponse.json({ error: 'owner and repo required' }, { status: 400 });
        }

        const commits = await getCommits(token, owner, repo, branch, limit || 20);
        return NextResponse.json({ commits });
      }

      // ========================================================================
      // Pull Request Operations
      // ========================================================================

      case 'create-branch':
      case 'createBranch': {
        const { owner, repo, branchName, fromBranch } = body;

        if (!owner || !repo || !branchName) {
          return NextResponse.json(
            { error: 'owner, repo, and branchName required' },
            { status: 400 }
          );
        }

        const branchResult = await createBranch(token, owner, repo, branchName, fromBranch);
        if (!branchResult.success) {
          return NextResponse.json(
            { error: branchResult.error || 'Failed to create branch' },
            { status: 500 }
          );
        }

        return NextResponse.json(branchResult);
      }

      case 'create-pr':
      case 'createPR': {
        const { owner, repo, title, body: prBody, head, base, draft } = body;

        if (!owner || !repo || !title || !head || !base) {
          return NextResponse.json(
            { error: 'owner, repo, title, head, and base required' },
            { status: 400 }
          );
        }

        const prResult = await createPullRequest(token, {
          owner,
          repo,
          title,
          body: prBody || '',
          head,
          base,
          draft,
        });

        if (!prResult.success) {
          return NextResponse.json(
            { error: prResult.error || 'Failed to create pull request' },
            { status: 500 }
          );
        }

        return NextResponse.json(prResult);
      }

      case 'compare-branches':
      case 'compareBranches': {
        const { owner, repo, base, head } = body;

        if (!owner || !repo || !base || !head) {
          return NextResponse.json(
            { error: 'owner, repo, base, and head required' },
            { status: 400 }
          );
        }

        const comparison = await compareBranches(token, owner, repo, base, head);
        if (!comparison) {
          return NextResponse.json({ error: 'Failed to compare branches' }, { status: 500 });
        }

        return NextResponse.json(comparison);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err) {
    log.error('[Connectors API] Error:', err instanceof Error ? err : { err });
    return NextResponse.json({ error: 'Connector operation failed' }, { status: 500 });
  }
}
