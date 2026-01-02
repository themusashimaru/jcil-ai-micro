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
  GitHubFileContent,
  GitHubRepoTree,
  GitHubTreeItem,
  GitHubBranch,
  GitHubCommit,
  GitHubPROptions,
  GitHubPRResult,
  GitHubCompareResult,
  GitHubCloneOptions,
  GitHubCloneResult,
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

// ============================================================================
// Repository Read Operations
// ============================================================================

/**
 * Get contents of a file or directory in a repository
 */
export async function getRepoContents(
  token: string,
  owner: string,
  repo: string,
  path: string = '',
  branch?: string
): Promise<GitHubFileContent | GitHubFileContent[] | null> {
  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    // Handle single file
    if (!Array.isArray(data)) {
      const file = data as {
        name: string;
        path: string;
        sha: string;
        size: number;
        type: 'file' | 'dir' | 'symlink' | 'submodule';
        content?: string;
        encoding?: string;
        html_url: string;
        download_url?: string | null;
      };

      return {
        name: file.name,
        path: file.path,
        sha: file.sha,
        size: file.size,
        type: file.type,
        content: file.content
          ? Buffer.from(file.content, 'base64').toString('utf-8')
          : undefined,
        encoding: file.encoding,
        htmlUrl: file.html_url,
        downloadUrl: file.download_url || undefined,
      };
    }

    // Handle directory listing
    return data.map((item) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      size: item.size ?? 0,
      type: item.type as 'file' | 'dir' | 'symlink' | 'submodule',
      htmlUrl: item.html_url ?? '',
      downloadUrl: item.download_url || undefined,
    }));
  } catch (error) {
    console.error('[GitHub Connector] Failed to get contents:', error);
    return null;
  }
}

/**
 * Get a single file's content (convenience wrapper)
 */
export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<{ content: string; sha: string } | null> {
  const result = await getRepoContents(token, owner, repo, path, branch);

  if (!result || Array.isArray(result)) {
    return null;
  }

  if (result.type !== 'file' || !result.content) {
    return null;
  }

  return {
    content: result.content,
    sha: result.sha,
  };
}

/**
 * Get the full tree of a repository (all files and directories)
 */
export async function getRepoTree(
  token: string,
  owner: string,
  repo: string,
  branch?: string,
  recursive: boolean = true
): Promise<GitHubRepoTree | null> {
  try {
    const octokit = createOctokit(token);

    // Get the branch SHA first
    let treeSha: string;
    if (branch) {
      const { data: branchData } = await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch,
      });
      treeSha = branchData.commit.sha;
    } else {
      const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
      const { data: branchData } = await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: repoData.default_branch,
      });
      treeSha = branchData.commit.sha;
    }

    const { data } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: recursive ? 'true' : undefined,
    });

    return {
      sha: data.sha,
      tree: data.tree.map((item) => ({
        path: item.path || '',
        mode: item.mode || '',
        type: item.type as 'blob' | 'tree',
        sha: item.sha || '',
        size: item.size,
        url: item.url || '',
      })),
      truncated: data.truncated ?? false,
    };
  } catch (error) {
    console.error('[GitHub Connector] Failed to get tree:', error);
    return null;
  }
}

/**
 * List branches in a repository
 */
export async function getBranches(
  token: string,
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.rest.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });

    return data.map((branch) => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected,
    }));
  } catch (error) {
    console.error('[GitHub Connector] Failed to list branches:', error);
    return [];
  }
}

/**
 * Get recent commits for a branch
 */
export async function getCommits(
  token: string,
  owner: string,
  repo: string,
  branch?: string,
  limit: number = 20
): Promise<GitHubCommit[]> {
  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      sha: branch,
      per_page: limit,
    });

    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author?.name || 'Unknown',
        email: commit.commit.author?.email || '',
        date: commit.commit.author?.date || '',
      },
      htmlUrl: commit.html_url,
    }));
  } catch (error) {
    console.error('[GitHub Connector] Failed to list commits:', error);
    return [];
  }
}

// ============================================================================
// Smart Clone - Fetch Repository Contents
// ============================================================================

/**
 * Detect language from file extension
 */
function detectLanguage(path: string): string | undefined {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    php: 'php',
    sql: 'sql',
    md: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    dockerfile: 'dockerfile',
  };
  return ext ? langMap[ext] : undefined;
}

/**
 * Check if a path matches any of the patterns
 */
function matchesPattern(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Simple glob matching
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(path);
  });
}

/**
 * Smart clone - fetch repository files with filters
 * This is the main function for "reviewing" a repository
 */
export async function cloneRepo(
  token: string,
  options: GitHubCloneOptions
): Promise<GitHubCloneResult> {
  const {
    owner,
    repo,
    branch,
    path: basePath = '',
    maxFiles = 100,
    maxFileSize = 100 * 1024, // 100KB default
    includePatterns = [],
    excludePatterns = [
      'node_modules/*',
      '.git/*',
      'dist/*',
      'build/*',
      '.next/*',
      'coverage/*',
      '*.lock',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      '*.min.js',
      '*.min.css',
      '*.map',
      '.env*',
    ],
  } = options;

  try {
    // Get the full tree first
    const tree = await getRepoTree(token, owner, repo, branch);
    if (!tree) {
      return {
        success: false,
        files: [],
        tree: [],
        truncated: false,
        totalFiles: 0,
        fetchedFiles: 0,
        error: 'Failed to fetch repository tree',
      };
    }

    // Filter to only blobs (files) in the target path
    const fileItems = tree.tree.filter((item) => {
      if (item.type !== 'blob') return false;
      if (basePath && !item.path.startsWith(basePath)) return false;
      if (item.size && item.size > maxFileSize) return false;
      if (excludePatterns.length && matchesPattern(item.path, excludePatterns)) return false;
      if (includePatterns.length && !matchesPattern(item.path, includePatterns)) return false;
      return true;
    });

    const totalFiles = fileItems.length;
    const filesToFetch = fileItems.slice(0, maxFiles);

    // Fetch file contents in parallel (with concurrency limit)
    const octokit = createOctokit(token);
    const files: GitHubCloneResult['files'] = [];
    const batchSize = 10;

    for (let i = 0; i < filesToFetch.length; i += batchSize) {
      const batch = filesToFetch.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            const { data } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: item.path,
              ref: branch,
            });

            if (!Array.isArray(data) && 'content' in data && data.content) {
              return {
                path: item.path,
                content: Buffer.from(data.content, 'base64').toString('utf-8'),
                size: item.size || 0,
                language: detectLanguage(item.path),
              };
            }
            return null;
          } catch {
            // Skip files that fail to fetch
            return null;
          }
        })
      );

      files.push(...batchResults.filter((f): f is NonNullable<typeof f> => f !== null));
    }

    return {
      success: true,
      files,
      tree: tree.tree as GitHubTreeItem[],
      truncated: totalFiles > maxFiles,
      totalFiles,
      fetchedFiles: files.length,
    };
  } catch (error) {
    console.error('[GitHub Connector] Clone failed:', error);
    return {
      success: false,
      files: [],
      tree: [],
      truncated: false,
      totalFiles: 0,
      fetchedFiles: 0,
      error: error instanceof Error ? error.message : 'Clone failed',
    };
  }
}

// ============================================================================
// Pull Request Operations
// ============================================================================

/**
 * Create a new branch from another branch
 */
export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  branchName: string,
  fromBranch?: string
): Promise<{ success: boolean; sha?: string; error?: string }> {
  try {
    const octokit = createOctokit(token);

    // Get the SHA of the source branch
    let sourceSha: string;
    if (fromBranch) {
      const { data: branchData } = await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: fromBranch,
      });
      sourceSha = branchData.commit.sha;
    } else {
      const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
      const { data: branchData } = await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: repoData.default_branch,
      });
      sourceSha = branchData.commit.sha;
    }

    // Create the new branch
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: sourceSha,
    });

    return { success: true, sha: sourceSha };
  } catch (error) {
    console.error('[GitHub Connector] Create branch failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create branch',
    };
  }
}

/**
 * Create a pull request
 */
export async function createPullRequest(
  token: string,
  options: GitHubPROptions
): Promise<GitHubPRResult> {
  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.rest.pulls.create({
      owner: options.owner,
      repo: options.repo,
      title: options.title,
      body: options.body,
      head: options.head,
      base: options.base,
      draft: options.draft,
    });

    return {
      success: true,
      prNumber: data.number,
      prUrl: data.html_url,
    };
  } catch (error) {
    console.error('[GitHub Connector] Create PR failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create pull request',
    };
  }
}

/**
 * Compare two branches
 */
export async function compareBranches(
  token: string,
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<GitHubCompareResult | null> {
  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base,
      head,
    });

    return {
      ahead: data.ahead_by,
      behind: data.behind_by,
      status: data.status as 'ahead' | 'behind' | 'identical' | 'diverged',
      files: (data.files || []).map((file) => ({
        filename: file.filename,
        status: file.status as 'added' | 'removed' | 'modified' | 'renamed',
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
      })),
      commits: data.commits.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name || 'Unknown',
          email: commit.commit.author?.email || '',
          date: commit.commit.author?.date || '',
        },
        htmlUrl: commit.html_url,
      })),
    };
  } catch (error) {
    console.error('[GitHub Connector] Compare failed:', error);
    return null;
  }
}

/**
 * Get repository info (for parsing URLs)
 */
export async function getRepoInfo(
  token: string,
  owner: string,
  repo: string
): Promise<GitHubRepo | null> {
  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.rest.repos.get({ owner, repo });

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
    console.error('[GitHub Connector] Get repo info failed:', error);
    return null;
  }
}

/**
 * Parse a GitHub URL into owner and repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Handle various GitHub URL formats:
  // https://github.com/owner/repo
  // https://github.com/owner/repo.git
  // git@github.com:owner/repo.git
  // github.com/owner/repo

  const patterns = [
    /github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?/,
    /^([^/]+)\/([^/]+)$/,  // Just "owner/repo"
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }

  return null;
}
