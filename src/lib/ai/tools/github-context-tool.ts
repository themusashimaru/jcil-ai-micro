/**
 * GITHUB CONTEXT TOOL (Enhancement #4)
 *
 * Fetches GitHub repository context for understanding user codebases.
 * Enables "understand my codebase" queries in Chat.
 *
 * Features:
 * - List user repositories
 * - Fetch repository structure (file tree)
 * - Read key files (README, package.json, etc.)
 * - Get recent commits and changes
 * - Understand project architecture
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('GitHubContextTool');

// ============================================================================
// TYPES
// ============================================================================

interface RepoInfo {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  defaultBranch: string;
  private: boolean;
  updatedAt: string;
}

interface FileTreeNode {
  path: string;
  type: 'file' | 'dir';
  size?: number;
  sha?: string;
}

interface RepoContext {
  readme?: string;
  packageJson?: Record<string, unknown>;
  structure: FileTreeNode[];
  languages: Record<string, number>;
  recentCommits: Array<{
    sha: string;
    message: string;
    author: string;
    date: string;
  }>;
}

// ============================================================================
// GITHUB CONTEXT TOOL
// ============================================================================

export const githubContextTool: UnifiedTool = {
  name: 'github_context',
  description: `Fetch and understand GitHub repository context. Operations:
- list_repos: List user's repositories
- get_structure: Get file tree structure of a repository
- get_context: Get comprehensive repo context (README, package.json, languages, commits)
- read_file: Read a specific file from a repository
- search_code: Search for code patterns in a repository

Use this when user wants to:
- Understand their codebase
- Get an overview of a project
- Find specific code or files
- See recent changes`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['list_repos', 'get_structure', 'get_context', 'read_file', 'search_code'],
        description: 'The operation to perform',
      },
      owner: {
        type: 'string',
        description: 'Repository owner (username or org)',
      },
      repo: {
        type: 'string',
        description: 'Repository name',
      },
      path: {
        type: 'string',
        description: 'File path for read_file operation',
      },
      query: {
        type: 'string',
        description: 'Search query for search_code operation',
      },
      branch: {
        type: 'string',
        description: 'Branch name (default: default branch)',
      },
      accessToken: {
        type: 'string',
        description: 'GitHub access token (auto-provided by system)',
      },
    },
    required: ['operation'],
  },
};

export async function executeGitHubContext(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, owner, repo, path, query, branch, accessToken } = args;

    if (!accessToken) {
      return {
        toolCallId: id,
        content: 'GitHub access token required. Please connect your GitHub account.',
        isError: true,
      };
    }

    // Dynamic import Octokit to avoid bundling issues
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: accessToken });

    let result: string;

    switch (operation) {
      case 'list_repos': {
        const { data: repos } = await octokit.repos.listForAuthenticatedUser({
          sort: 'updated',
          per_page: 30,
        });

        const repoInfos: RepoInfo[] = repos.map(r => ({
          name: r.name,
          fullName: r.full_name,
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          forks: r.forks_count,
          defaultBranch: r.default_branch,
          private: r.private,
          updatedAt: r.updated_at || '',
        }));

        result = JSON.stringify({ repos: repoInfos }, null, 2);
        break;
      }

      case 'get_structure': {
        if (!owner || !repo) {
          return { toolCallId: id, content: 'Owner and repo required for get_structure', isError: true };
        }

        const { data: repoData } = await octokit.repos.get({ owner, repo });
        const targetBranch = branch || repoData.default_branch;

        // Get tree recursively
        const { data: treeData } = await octokit.git.getTree({
          owner,
          repo,
          tree_sha: targetBranch,
          recursive: 'true',
        });

        const structure: FileTreeNode[] = (treeData.tree || [])
          .filter(item => item.path && item.type)
          .slice(0, 500) // Limit to 500 items
          .map(item => ({
            path: item.path!,
            type: item.type === 'blob' ? 'file' : 'dir',
            size: item.size,
            sha: item.sha,
          }));

        result = JSON.stringify({ structure, truncated: treeData.truncated }, null, 2);
        break;
      }

      case 'get_context': {
        if (!owner || !repo) {
          return { toolCallId: id, content: 'Owner and repo required for get_context', isError: true };
        }

        const context: RepoContext = {
          structure: [],
          languages: {},
          recentCommits: [],
        };

        // Get repo info
        const { data: repoData } = await octokit.repos.get({ owner, repo });
        const targetBranch = branch || repoData.default_branch;

        // Get README
        try {
          const { data: readmeData } = await octokit.repos.getReadme({ owner, repo });
          context.readme = Buffer.from(readmeData.content, 'base64').toString('utf8');
        } catch {
          // No README
        }

        // Get package.json for Node.js projects
        try {
          const { data: pkgData } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'package.json',
          });
          if ('content' in pkgData) {
            context.packageJson = JSON.parse(Buffer.from(pkgData.content, 'base64').toString('utf8'));
          }
        } catch {
          // No package.json
        }

        // Get languages
        try {
          const { data: langData } = await octokit.repos.listLanguages({ owner, repo });
          context.languages = langData;
        } catch {
          // Language detection failed
        }

        // Get recent commits
        try {
          const { data: commits } = await octokit.repos.listCommits({
            owner,
            repo,
            sha: targetBranch,
            per_page: 10,
          });
          context.recentCommits = commits.map(c => ({
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split('\n')[0],
            author: c.commit.author?.name || 'Unknown',
            date: c.commit.author?.date || '',
          }));
        } catch {
          // Commits fetch failed
        }

        // Get file structure (limited)
        try {
          const { data: treeData } = await octokit.git.getTree({
            owner,
            repo,
            tree_sha: targetBranch,
            recursive: 'true',
          });
          context.structure = (treeData.tree || [])
            .filter(item => item.path && item.type)
            .slice(0, 100)
            .map(item => ({
              path: item.path!,
              type: item.type === 'blob' ? 'file' : 'dir',
            }));
        } catch {
          // Tree fetch failed
        }

        result = JSON.stringify(context, null, 2);
        break;
      }

      case 'read_file': {
        if (!owner || !repo || !path) {
          return { toolCallId: id, content: 'Owner, repo, and path required for read_file', isError: true };
        }

        const { data: repoData } = await octokit.repos.get({ owner, repo });
        const targetBranch = branch || repoData.default_branch;

        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: targetBranch,
        });

        if (Array.isArray(fileData)) {
          result = JSON.stringify({ type: 'directory', contents: fileData.map(f => f.name) });
        } else if ('content' in fileData) {
          const content = Buffer.from(fileData.content, 'base64').toString('utf8');
          // Truncate very large files
          result = content.length > 50000 ? content.slice(0, 50000) + '\n...(truncated)' : content;
        } else {
          result = 'Unable to read file content';
        }
        break;
      }

      case 'search_code': {
        if (!query) {
          return { toolCallId: id, content: 'Query required for search_code', isError: true };
        }

        let searchQuery = query;
        if (owner && repo) {
          searchQuery = `${query} repo:${owner}/${repo}`;
        } else if (owner) {
          searchQuery = `${query} user:${owner}`;
        }

        const { data: searchResults } = await octokit.search.code({
          q: searchQuery,
          per_page: 20,
        });

        const results = searchResults.items.map(item => ({
          path: item.path,
          repo: item.repository.full_name,
          sha: item.sha,
          url: item.html_url,
        }));

        result = JSON.stringify({
          totalCount: searchResults.total_count,
          results,
        }, null, 2);
        break;
      }

      default:
        return { toolCallId: id, content: `Unknown operation: ${operation}`, isError: true };
    }

    return { toolCallId: id, content: result };
  } catch (error) {
    log.error('GitHub context error', { error: (error as Error).message });
    return { toolCallId: id, content: `GitHub error: ${(error as Error).message}`, isError: true };
  }
}

export function isGitHubContextAvailable(): boolean {
  return true; // Always available, but requires access token at runtime
}

/**
 * Get a summary of a repository for system prompt injection
 */
export async function getRepoSummaryForPrompt(
  accessToken: string,
  owner: string,
  repo: string
): Promise<string> {
  try {
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: accessToken });

    const { data: repoData } = await octokit.repos.get({ owner, repo });

    // Get languages
    const { data: languages } = await octokit.repos.listLanguages({ owner, repo });
    const topLanguages = Object.entries(languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([lang]) => lang);

    // Get key files list
    const { data: rootContents } = await octokit.repos.getContent({ owner, repo, path: '' });
    const keyFiles = Array.isArray(rootContents)
      ? rootContents
          .filter(f => ['package.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 'README.md'].includes(f.name))
          .map(f => f.name)
      : [];

    return `
**Repository**: ${repoData.full_name}
**Description**: ${repoData.description || 'No description'}
**Languages**: ${topLanguages.join(', ')}
**Default Branch**: ${repoData.default_branch}
**Key Files**: ${keyFiles.join(', ') || 'None detected'}
**Last Updated**: ${repoData.updated_at}
`.trim();
  } catch (error) {
    log.error('Failed to get repo summary', { error: (error as Error).message });
    return '';
  }
}
