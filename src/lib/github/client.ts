/**
 * GITHUB API CLIENT
 *
 * Provides file operations for the admin CodeCommand interface
 * Uses a Personal Access Token for authentication
 *
 * Features:
 * - List repositories
 * - Browse files and directories
 * - Read file contents
 * - Create/update files
 * - Commit and push changes
 * - Create pull requests
 */

import { Octokit } from 'octokit';
import { logger } from '@/lib/logger';

const log = logger('GitHub');

// Initialize Octokit with PAT from environment
function getOctokit(): Octokit | null {
  const token = process.env.GITHUB_PAT;
  if (!token) {
    log.warn('No GITHUB_PAT configured');
    return null;
  }
  return new Octokit({ auth: token });
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  html_url: string;
}

export interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  sha: string;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  content: string;
  sha: string;
  encoding: string;
}

/**
 * Check if GitHub is configured
 */
export function isGitHubConfigured(): boolean {
  return !!process.env.GITHUB_PAT;
}

/**
 * Get authenticated user info
 */
export async function getAuthenticatedUser(): Promise<{ login: string; name: string | null } | null> {
  const octokit = getOctokit();
  if (!octokit) return null;

  try {
    const { data } = await octokit.rest.users.getAuthenticated();
    return { login: data.login, name: data.name };
  } catch (error) {
    log.error('Error getting authenticated user', error as Error);
    return null;
  }
}

/**
 * List repositories for the authenticated user
 */
export async function listRepositories(options?: {
  type?: 'all' | 'owner' | 'public' | 'private';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  per_page?: number;
}): Promise<GitHubRepo[]> {
  const octokit = getOctokit();
  if (!octokit) return [];

  try {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      type: options?.type || 'owner',
      sort: options?.sort || 'updated',
      per_page: options?.per_page || 30,
    });

    return data.map(repo => ({
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      default_branch: repo.default_branch,
      html_url: repo.html_url,
    }));
  } catch (error) {
    log.error('Error listing repositories', error as Error);
    return [];
  }
}

/**
 * List contents of a directory in a repository
 */
export async function listContents(
  owner: string,
  repo: string,
  path: string = '',
  ref?: string
): Promise<GitHubFile[]> {
  const octokit = getOctokit();
  if (!octokit) return [];

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if (Array.isArray(data)) {
      return data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type as 'file' | 'dir',
        size: item.size,
        sha: item.sha,
      }));
    }

    // Single file
    return [{
      name: data.name,
      path: data.path,
      type: data.type as 'file' | 'dir',
      size: data.size,
      sha: data.sha,
    }];
  } catch (error) {
    log.error('Error listing contents', error as Error);
    return [];
  }
}

/**
 * Get contents of a file
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<GitHubFileContent | null> {
  const octokit = getOctokit();
  if (!octokit) return null;

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if (Array.isArray(data) || data.type !== 'file') {
      log.error('Path is not a file', { path });
      return null;
    }

    // Decode base64 content
    const content = data.encoding === 'base64'
      ? Buffer.from(data.content, 'base64').toString('utf-8')
      : data.content;

    return {
      name: data.name,
      path: data.path,
      content,
      sha: data.sha,
      encoding: data.encoding,
    };
  } catch (error) {
    log.error('Error getting file content', error as Error);
    return null;
  }
}

/**
 * Create or update a file in a repository
 */
export async function createOrUpdateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string, // Required for updates, omit for new files
  branch?: string
): Promise<{ sha: string; commit: string } | null> {
  const octokit = getOctokit();
  if (!octokit) return null;

  try {
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
      branch,
    });

    return {
      sha: data.content?.sha || '',
      commit: data.commit.sha || '',
    };
  } catch (error) {
    log.error('Error creating/updating file', error as Error);
    return null;
  }
}

/**
 * Delete a file from a repository
 */
export async function deleteFile(
  owner: string,
  repo: string,
  path: string,
  sha: string,
  message: string,
  branch?: string
): Promise<boolean> {
  const octokit = getOctokit();
  if (!octokit) return false;

  try {
    await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path,
      message,
      sha,
      branch,
    });
    return true;
  } catch (error) {
    log.error('Error deleting file', error as Error);
    return false;
  }
}

/**
 * List branches for a repository
 */
export async function listBranches(
  owner: string,
  repo: string
): Promise<{ name: string; sha: string; protected: boolean }[]> {
  const octokit = getOctokit();
  if (!octokit) return [];

  try {
    const { data } = await octokit.rest.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });

    return data.map(branch => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected,
    }));
  } catch (error) {
    log.error('Error listing branches', error as Error);
    return [];
  }
}

/**
 * Create a new branch
 */
export async function createBranch(
  owner: string,
  repo: string,
  branchName: string,
  fromSha: string
): Promise<boolean> {
  const octokit = getOctokit();
  if (!octokit) return false;

  try {
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: fromSha,
    });
    return true;
  } catch (error) {
    log.error('Error creating branch', error as Error);
    return false;
  }
}

/**
 * Create a pull request
 */
export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string
): Promise<{ number: number; html_url: string } | null> {
  const octokit = getOctokit();
  if (!octokit) return null;

  try {
    const { data } = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });

    return {
      number: data.number,
      html_url: data.html_url,
    };
  } catch (error) {
    log.error('Error creating pull request', error as Error);
    return null;
  }
}

/**
 * Search code in a repository
 */
export async function searchCode(
  query: string,
  owner?: string,
  repo?: string
): Promise<{ path: string; repository: string; html_url: string }[]> {
  const octokit = getOctokit();
  if (!octokit) return [];

  try {
    let searchQuery = query;
    if (owner && repo) {
      searchQuery += ` repo:${owner}/${repo}`;
    } else if (owner) {
      searchQuery += ` user:${owner}`;
    }

    const { data } = await octokit.rest.search.code({
      q: searchQuery,
      per_page: 20,
    });

    return data.items.map(item => ({
      path: item.path,
      repository: item.repository.full_name,
      html_url: item.html_url,
    }));
  } catch (error) {
    log.error('Error searching code', error as Error);
    return [];
  }
}
