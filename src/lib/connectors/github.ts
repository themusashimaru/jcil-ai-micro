/**
 * GITHUB CONNECTOR
 * =================
 *
 * Uses Supabase OAuth token for GitHub operations.
 * When users login with GitHub, we can use their token to push code.
 */

import { createClient } from '@supabase/supabase-js';
import { Octokit } from 'octokit';
import type {
  GitHubConnector,
  GitHubRepo,
  GitHubCreateRepoOptions,
  GitHubPushOptions,
  GitHubPushResult,
} from './types';

// ============================================================================
// Token Management
// ============================================================================

/**
 * Get GitHub token from Supabase session (OAuth login)
 * This only works if user logged in with GitHub
 */
export async function getGitHubTokenFromSession(
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string
): Promise<string | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      console.error('[GitHub Connector] Failed to get user:', error);
      return null;
    }

    // Check if user has GitHub identity
    const githubIdentity = data.user.identities?.find(
      (identity) => identity.provider === 'github'
    );

    if (!githubIdentity) {
      console.log('[GitHub Connector] User did not login with GitHub');
      return null;
    }

    // The provider_token is stored in the session, not user
    // We need to get it from the session
    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData?.session?.provider_token) {
      return sessionData.session.provider_token;
    }

    // Fallback: check if we stored it in user metadata
    if (data.user.user_metadata?.github_token) {
      return data.user.user_metadata.github_token as string;
    }

    console.log('[GitHub Connector] No provider token available');
    return null;
  } catch (error) {
    console.error('[GitHub Connector] Error getting token:', error);
    return null;
  }
}

/**
 * Create Octokit instance with user's GitHub token
 */
function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

// ============================================================================
// Connection Status
// ============================================================================

/**
 * Check if GitHub is connected and get user info
 */
export async function getGitHubConnectionStatus(
  token: string
): Promise<GitHubConnector> {
  const baseConnector: GitHubConnector = {
    type: 'github',
    status: 'disconnected',
    displayName: 'GitHub',
    icon: '🐙',
    description: 'Push code to repositories, create PRs',
  };

  if (!token) {
    return baseConnector;
  }

  try {
    const octokit = createOctokit(token);
    const { data: user } = await octokit.rest.users.getAuthenticated();

    return {
      ...baseConnector,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      metadata: {
        username: user.login,
        email: user.email || undefined,
        avatarUrl: user.avatar_url,
      },
    };
  } catch (error) {
    console.error('[GitHub Connector] Connection check failed:', error);
    return {
      ...baseConnector,
      status: 'error',
    };
  }
}

/**
 * Validate if a token is still valid
 */
export async function validateGitHubToken(token: string): Promise<boolean> {
  try {
    const octokit = createOctokit(token);
    await octokit.rest.users.getAuthenticated();
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Repository Operations
// ============================================================================

/**
 * List user's repositories
 */
export async function listUserRepos(token: string): Promise<GitHubRepo[]> {
  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 50,
    });

    return data.map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
      owner: repo.owner.login,
    }));
  } catch (error) {
    console.error('[GitHub Connector] Failed to list repos:', error);
    return [];
  }
}

/**
 * Create a new repository
 */
export async function createRepository(
  token: string,
  options: GitHubCreateRepoOptions
): Promise<GitHubRepo | null> {
  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description,
      private: options.private ?? false,
      auto_init: options.autoInit ?? true,
    });

    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      private: data.private,
      defaultBranch: data.default_branch,
      htmlUrl: data.html_url,
      owner: data.owner.login,
    };
  } catch (error) {
    console.error('[GitHub Connector] Failed to create repo:', error);
    return null;
  }
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Push multiple files to a repository
 * Creates a single commit with all files
 */
export async function pushFiles(
  token: string,
  options: GitHubPushOptions
): Promise<GitHubPushResult> {
  const { owner, repo, branch = 'main', message, files } = options;

  try {
    const octokit = createOctokit(token);

    // Get the current commit SHA for the branch
    let branchRef;
    try {
      const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      branchRef = refData;
    } catch {
      // Branch doesn't exist, try to create it from default branch
      const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
      const defaultBranch = repoData.default_branch;

      const { data: defaultRef } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`,
      });

      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: defaultRef.object.sha,
      });

      branchRef = { object: { sha: defaultRef.object.sha } };
    }

    const currentCommitSha = branchRef.object.sha;

    // Get the tree SHA from the current commit
    const { data: currentCommit } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: currentCommitSha,
    });

    // Create blobs for each file
    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data: blob } = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        });
        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha,
        };
      })
    );

    // Create a new tree with the files
    const { data: newTree } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: currentCommit.tree.sha,
      tree: blobs,
    });

    // Create a new commit
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message,
      tree: newTree.sha,
      parents: [currentCommitSha],
    });

    // Update the branch reference
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return {
      success: true,
      commitSha: newCommit.sha,
      repoUrl: `https://github.com/${owner}/${repo}`,
    };
  } catch (error) {
    console.error('[GitHub Connector] Push failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Push failed',
    };
  }
}

/**
 * Push a single file to a repository (simpler API)
 */
export async function pushSingleFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch?: string
): Promise<GitHubPushResult> {
  return pushFiles(token, {
    owner,
    repo,
    branch,
    message,
    files: [{ path, content }],
  });
}

// ============================================================================
// Helper: Check Required Scopes
// ============================================================================

/**
 * Check if token has required scopes for full functionality
 */
export async function checkTokenScopes(token: string): Promise<{
  hasRepoScope: boolean;
  hasUserScope: boolean;
  scopes: string[];
}> {
  try {
    const octokit = createOctokit(token);

    // Make a request and check the X-OAuth-Scopes header
    const response = await octokit.request('GET /user');
    const scopesHeader = response.headers['x-oauth-scopes'] || '';
    const scopes = scopesHeader.split(',').map((s: string) => s.trim()).filter(Boolean);

    return {
      hasRepoScope: scopes.includes('repo') || scopes.includes('public_repo'),
      hasUserScope: scopes.includes('user') || scopes.includes('user:email'),
      scopes,
    };
  } catch {
    return {
      hasRepoScope: false,
      hasUserScope: false,
      scopes: [],
    };
  }
}
