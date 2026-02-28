/**
 * CONNECTORS API ROUTE
 * ====================
 *
 * Manages user's external service connections.
 * GET: Get connection status for all connectors
 * POST: Perform connector operations (list repos, push code, etc.)
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';
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
    return errors.serviceUnavailable('Connectors not enabled');
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  const { token, userId, username, error: tokenError } = await getGitHubToken();

  if (!userId) {
    return errors.unauthorized();
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
        return successResponse({ connectors });
      }

      case 'github-status': {
        if (!token) {
          return successResponse({
            connected: false,
            error: tokenError || 'GitHub not connected',
          });
        }

        return successResponse({
          connected: true,
          username,
        });
      }

      case 'github-repos': {
        if (!token) {
          return errors.badRequest(tokenError || 'GitHub not connected');
        }

        const repos = await listUserRepos(token);
        return successResponse({ repos });
      }

      default:
        return errors.badRequest('Invalid action');
    }
  } catch (err) {
    log.error('[Connectors API] Error:', err instanceof Error ? err : { err });
    return errors.serverError('Connector operation failed');
  }
}

/**
 * POST - Perform connector operations
 */
export async function POST(request: NextRequest) {
  if (!isConnectorsEnabled()) {
    return errors.serviceUnavailable('Connectors not enabled');
  }

  const { token, userId, error: tokenError } = await getGitHubToken();

  if (!userId) {
    return errors.unauthorized();
  }

  if (!token) {
    return errors.badRequest(
      tokenError || 'GitHub not connected. Add your Personal Access Token in Connectors.'
    );
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'listRepos': {
        const repos = await listUserRepos(token);
        return successResponse({ repos });
      }

      case 'pushFiles':
      case 'push-files': {
        const { owner, repo, branch, message, files } = body;

        if (!owner || !repo || !message || !files || files.length === 0) {
          return errors.badRequest('owner, repo, message, and files required');
        }

        const result = await pushFiles(token, {
          owner,
          repo,
          branch,
          message,
          files,
        });

        if (!result.success) {
          return errors.serverError(result.error || 'Push failed');
        }

        return successResponse({
          success: true,
          commitSha: result.commitSha,
          repoUrl: result.repoUrl,
        });
      }

      case 'create-repo': {
        const { name, description, isPrivate } = body;

        if (!name) {
          return errors.badRequest('Repository name required');
        }

        const repo = await createRepository(token, {
          name,
          description,
          private: isPrivate,
          autoInit: true,
        });

        if (!repo) {
          return errors.serverError('Failed to create repository');
        }

        return successResponse({ success: true, repo });
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
            return errors.badRequest('Invalid GitHub URL');
          }
          owner = parsed.owner;
          repo = parsed.repo;
        }

        if (!owner || !repo) {
          return errors.badRequest('owner and repo required (or url)');
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
          return errors.serverError(cloneResult.error || 'Clone failed');
        }

        return successResponse(cloneResult);
      }

      case 'get-tree':
      case 'getTree': {
        // Get repository tree (directory structure)
        const { branch, recursive } = body;
        let { owner, repo } = body;

        if (body.url && !owner) {
          const parsed = parseGitHubUrl(body.url);
          if (!parsed) {
            return errors.badRequest('Invalid GitHub URL');
          }
          owner = parsed.owner;
          repo = parsed.repo;
        }

        if (!owner || !repo) {
          return errors.badRequest('owner and repo required (or url)');
        }

        const tree = await getRepoTree(token, owner, repo, branch, recursive !== false);
        if (!tree) {
          return errors.serverError('Failed to fetch repository tree');
        }

        return successResponse(tree);
      }

      case 'get-file':
      case 'getFile': {
        // Get single file content
        const { owner, repo, path: filePath, branch } = body;

        if (!owner || !repo || !filePath) {
          return errors.badRequest('owner, repo, and path required');
        }

        const file = await getFileContent(token, owner, repo, filePath, branch);
        if (!file) {
          return errors.notFound('File');
        }

        return successResponse(file);
      }

      case 'get-repo-info':
      case 'getRepoInfo': {
        // Get repository metadata
        let { owner, repo } = body;

        if (body.url && !owner) {
          const parsed = parseGitHubUrl(body.url);
          if (!parsed) {
            return errors.badRequest('Invalid GitHub URL');
          }
          owner = parsed.owner;
          repo = parsed.repo;
        }

        if (!owner || !repo) {
          return errors.badRequest('owner and repo required (or url)');
        }

        const repoInfo = await getRepoInfo(token, owner, repo);
        if (!repoInfo) {
          return errors.notFound('Repository');
        }

        return successResponse(repoInfo);
      }

      case 'get-branches':
      case 'getBranches': {
        const { owner, repo } = body;

        if (!owner || !repo) {
          return errors.badRequest('owner and repo required');
        }

        const branches = await getBranches(token, owner, repo);
        return successResponse({ branches });
      }

      case 'get-commits':
      case 'getCommits': {
        const { owner, repo, branch, limit } = body;

        if (!owner || !repo) {
          return errors.badRequest('owner and repo required');
        }

        const commits = await getCommits(token, owner, repo, branch, limit || 20);
        return successResponse({ commits });
      }

      // ========================================================================
      // Pull Request Operations
      // ========================================================================

      case 'create-branch':
      case 'createBranch': {
        const { owner, repo, branchName, fromBranch } = body;

        if (!owner || !repo || !branchName) {
          return errors.badRequest('owner, repo, and branchName required');
        }

        const branchResult = await createBranch(token, owner, repo, branchName, fromBranch);
        if (!branchResult.success) {
          return errors.serverError(branchResult.error || 'Failed to create branch');
        }

        return successResponse(branchResult);
      }

      case 'create-pr':
      case 'createPR': {
        const { owner, repo, title, body: prBody, head, base, draft } = body;

        if (!owner || !repo || !title || !head || !base) {
          return errors.badRequest('owner, repo, title, head, and base required');
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
          return errors.serverError(prResult.error || 'Failed to create pull request');
        }

        return successResponse(prResult);
      }

      case 'compare-branches':
      case 'compareBranches': {
        const { owner, repo, base, head } = body;

        if (!owner || !repo || !base || !head) {
          return errors.badRequest('owner, repo, base, and head required');
        }

        const comparison = await compareBranches(token, owner, repo, base, head);
        if (!comparison) {
          return errors.serverError('Failed to compare branches');
        }

        return successResponse(comparison);
      }

      default:
        return errors.badRequest('Invalid action');
    }
  } catch (err) {
    log.error('[Connectors API] Error:', err instanceof Error ? err : { err });
    return errors.serverError('Connector operation failed');
  }
}
