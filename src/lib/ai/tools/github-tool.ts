/**
 * GITHUB TOOL
 *
 * Allows AI to interact with GitHub - search code, read files, browse repos.
 * Uses GitHub's REST API directly (no gh CLI needed in serverless).
 *
 * Features:
 * - Search code across GitHub
 * - Read file contents from repos
 * - Get repo information
 * - List directory contents
 * - Search issues and PRs
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('GitHubTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const GITHUB_API_BASE = 'https://api.github.com';
const MAX_OUTPUT_LENGTH = 50000;
const FETCH_TIMEOUT_MS = 15000;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const githubTool: UnifiedTool = {
  name: 'github',
  description: `Search and browse GitHub repositories, code, and issues. Use this when:
- User asks about code in a specific GitHub repo
- You need to find code examples or implementations
- User wants to explore a repository's structure
- Looking for how something is implemented in open source
- Searching for libraries or solutions on GitHub

Actions available:
- search_code: Search for code across all of GitHub
- search_repos: Search for repositories
- get_file: Get contents of a specific file in a repo
- list_dir: List files in a repository directory
- get_repo: Get repository information
- search_issues: Search issues and pull requests`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The GitHub action to perform',
        enum: ['search_code', 'search_repos', 'get_file', 'list_dir', 'get_repo', 'search_issues'],
      },
      query: {
        type: 'string',
        description:
          'Search query (for search_code, search_repos, search_issues). Use GitHub search syntax.',
      },
      owner: {
        type: 'string',
        description: 'Repository owner/organization (for get_file, list_dir, get_repo)',
      },
      repo: {
        type: 'string',
        description: 'Repository name (for get_file, list_dir, get_repo)',
      },
      path: {
        type: 'string',
        description: 'File or directory path within the repo (for get_file, list_dir)',
      },
      branch: {
        type: 'string',
        description: 'Branch name. Defaults to default branch.',
      },
    },
    required: ['action'],
  },
};

// ============================================================================
// GITHUB API HELPERS
// ============================================================================

async function githubFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'JCIL-AI-Assistant',
    'X-GitHub-Api-Version': '2022-11-28',
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add auth token if available (increases rate limit from 60 to 5000/hour)
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Not found. Check the repository/file path.' };
      }
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        if (rateLimitRemaining === '0') {
          return { success: false, error: 'GitHub API rate limit exceeded. Try again later.' };
        }
        return { success: false, error: 'Access forbidden. Repository may be private.' };
      }
      return { success: false, error: `GitHub API error: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    clearTimeout(timeout);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('aborted')) {
      return { success: false, error: 'Request timed out' };
    }

    return { success: false, error: `GitHub request failed: ${errorMessage}` };
  }
}

// ============================================================================
// GITHUB ACTIONS
// ============================================================================

async function searchCode(query: string): Promise<string> {
  const result = await githubFetch(`/search/code?q=${encodeURIComponent(query)}&per_page=10`);

  if (!result.success) {
    return `Error: ${result.error}`;
  }

  const data = result.data as {
    total_count: number;
    items: Array<{
      name: string;
      path: string;
      repository: { full_name: string; html_url: string };
      html_url: string;
    }>;
  };

  if (data.total_count === 0) {
    return 'No code matches found for this query.';
  }

  let output = `Found ${data.total_count} code matches:\n\n`;
  for (const item of data.items) {
    output += `**${item.repository.full_name}**\n`;
    output += `  File: \`${item.path}\`\n`;
    output += `  URL: ${item.html_url}\n\n`;
  }

  return output;
}

async function searchRepos(query: string): Promise<string> {
  const result = await githubFetch(
    `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=10`
  );

  if (!result.success) {
    return `Error: ${result.error}`;
  }

  const data = result.data as {
    total_count: number;
    items: Array<{
      full_name: string;
      description: string;
      html_url: string;
      stargazers_count: number;
      language: string;
      updated_at: string;
    }>;
  };

  if (data.total_count === 0) {
    return 'No repositories found for this query.';
  }

  let output = `Found ${data.total_count} repositories:\n\n`;
  for (const repo of data.items) {
    output += `**${repo.full_name}** (${repo.stargazers_count} stars)\n`;
    if (repo.description) {
      output += `  ${repo.description}\n`;
    }
    output += `  Language: ${repo.language || 'N/A'}\n`;
    output += `  URL: ${repo.html_url}\n\n`;
  }

  return output;
}

async function getFile(
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<string> {
  let endpoint = `/repos/${owner}/${repo}/contents/${path}`;
  if (branch) {
    endpoint += `?ref=${branch}`;
  }

  const result = await githubFetch(endpoint);

  if (!result.success) {
    return `Error: ${result.error}`;
  }

  const data = result.data as {
    type: string;
    content?: string;
    encoding?: string;
    size: number;
    html_url: string;
  };

  if (data.type !== 'file') {
    return `Error: Path is a ${data.type}, not a file. Use list_dir to browse directories.`;
  }

  if (!data.content) {
    return 'Error: Could not retrieve file content.';
  }

  // Decode base64 content
  const content = Buffer.from(data.content, 'base64').toString('utf-8');

  let output = `**File:** ${owner}/${repo}/${path}\n`;
  output += `**URL:** ${data.html_url}\n`;
  output += `**Size:** ${data.size} bytes\n\n`;
  output += '```\n';
  output += content.slice(0, MAX_OUTPUT_LENGTH - 500);
  if (content.length > MAX_OUTPUT_LENGTH - 500) {
    output += '\n... [truncated]';
  }
  output += '\n```';

  return output;
}

async function listDir(
  owner: string,
  repo: string,
  path: string = '',
  branch?: string
): Promise<string> {
  let endpoint = `/repos/${owner}/${repo}/contents/${path}`;
  if (branch) {
    endpoint += `?ref=${branch}`;
  }

  const result = await githubFetch(endpoint);

  if (!result.success) {
    return `Error: ${result.error}`;
  }

  const data = result.data as Array<{
    name: string;
    type: string;
    size: number;
    path: string;
  }>;

  if (!Array.isArray(data)) {
    return 'Error: Path is a file, not a directory. Use get_file to read files.';
  }

  // Sort: directories first, then files
  data.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });

  let output = `**Directory:** ${owner}/${repo}/${path || '(root)'}\n\n`;
  output += '```\n';
  for (const item of data) {
    const icon = item.type === 'dir' ? '📁' : '📄';
    const size = item.type === 'file' ? ` (${item.size} bytes)` : '';
    output += `${icon} ${item.name}${size}\n`;
  }
  output += '```';

  return output;
}

async function getRepo(owner: string, repo: string): Promise<string> {
  const result = await githubFetch(`/repos/${owner}/${repo}`);

  if (!result.success) {
    return `Error: ${result.error}`;
  }

  const data = result.data as {
    full_name: string;
    description: string;
    html_url: string;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    language: string;
    default_branch: string;
    created_at: string;
    updated_at: string;
    topics: string[];
    license?: { name: string };
  };

  let output = `# ${data.full_name}\n\n`;
  if (data.description) {
    output += `${data.description}\n\n`;
  }
  output += `**URL:** ${data.html_url}\n`;
  output += `**Stars:** ${data.stargazers_count} | **Forks:** ${data.forks_count} | **Issues:** ${data.open_issues_count}\n`;
  output += `**Language:** ${data.language || 'N/A'}\n`;
  output += `**Default Branch:** ${data.default_branch}\n`;
  if (data.license) {
    output += `**License:** ${data.license.name}\n`;
  }
  if (data.topics && data.topics.length > 0) {
    output += `**Topics:** ${data.topics.join(', ')}\n`;
  }
  output += `**Created:** ${new Date(data.created_at).toLocaleDateString()}\n`;
  output += `**Updated:** ${new Date(data.updated_at).toLocaleDateString()}\n`;

  return output;
}

async function searchIssues(query: string): Promise<string> {
  const result = await githubFetch(
    `/search/issues?q=${encodeURIComponent(query)}&sort=updated&per_page=10`
  );

  if (!result.success) {
    return `Error: ${result.error}`;
  }

  const data = result.data as {
    total_count: number;
    items: Array<{
      title: string;
      number: number;
      state: string;
      html_url: string;
      user: { login: string };
      created_at: string;
      repository_url: string;
      pull_request?: unknown;
    }>;
  };

  if (data.total_count === 0) {
    return 'No issues or pull requests found for this query.';
  }

  let output = `Found ${data.total_count} issues/PRs:\n\n`;
  for (const item of data.items) {
    const type = item.pull_request ? 'PR' : 'Issue';
    const repoName = item.repository_url.split('/').slice(-2).join('/');
    output += `**[${type}] ${item.title}** (#${item.number})\n`;
    output += `  Repo: ${repoName} | State: ${item.state} | By: ${item.user.login}\n`;
    output += `  URL: ${item.html_url}\n\n`;
  }

  return output;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeGitHub(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'github') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
  const action = args.action as string;
  const query = args.query as string;
  const owner = args.owner as string;
  const repo = args.repo as string;
  const path = args.path as string;
  const branch = args.branch as string | undefined;

  log.info('Executing GitHub action', { action, query, owner, repo, path });

  let content: string;

  try {
    switch (action) {
      case 'search_code':
        if (!query) {
          return { toolCallId: id, content: 'Query required for code search', isError: true };
        }
        content = await searchCode(query);
        break;

      case 'search_repos':
        if (!query) {
          return { toolCallId: id, content: 'Query required for repo search', isError: true };
        }
        content = await searchRepos(query);
        break;

      case 'get_file':
        if (!owner || !repo || !path) {
          return {
            toolCallId: id,
            content: 'Owner, repo, and path required to get file',
            isError: true,
          };
        }
        content = await getFile(owner, repo, path, branch);
        break;

      case 'list_dir':
        if (!owner || !repo) {
          return {
            toolCallId: id,
            content: 'Owner and repo required to list directory',
            isError: true,
          };
        }
        content = await listDir(owner, repo, path || '', branch);
        break;

      case 'get_repo':
        if (!owner || !repo) {
          return { toolCallId: id, content: 'Owner and repo required', isError: true };
        }
        content = await getRepo(owner, repo);
        break;

      case 'search_issues':
        if (!query) {
          return { toolCallId: id, content: 'Query required for issue search', isError: true };
        }
        content = await searchIssues(query);
        break;

      default:
        return { toolCallId: id, content: `Unknown action: ${action}`, isError: true };
    }

    log.info('GitHub action completed', { action, contentLength: content.length });

    return {
      toolCallId: id,
      content,
      isError: content.startsWith('Error:'),
    };
  } catch (error) {
    log.error('GitHub action failed', { action, error: (error as Error).message });
    return {
      toolCallId: id,
      content: `GitHub action failed: ${(error as Error).message}`,
      isError: true,
    };
  }
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isGitHubAvailable(): boolean {
  // Always available - works without token (60 req/hour), better with token (5000 req/hour)
  return true;
}
