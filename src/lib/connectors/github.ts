/**
 * GITHUB CONNECTOR
 * Tools for interacting with GitHub repositories
 */

interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  sha?: string;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  default_branch: string;
  html_url: string;
}

interface GitHubError {
  error: string;
  status?: number;
}

type GitHubResult<T> = T | GitHubError;

function isError<T>(result: GitHubResult<T>): result is GitHubError {
  return (result as GitHubError).error !== undefined;
}

/**
 * Make authenticated request to GitHub API
 */
async function githubFetch(token: string, endpoint: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'JCIL-AI-App',
      ...options.headers,
    },
  });
}

/**
 * List user's repositories
 */
export async function listRepos(token: string): Promise<GitHubResult<GitHubRepo[]>> {
  try {
    const response = await githubFetch(token, '/user/repos?sort=updated&per_page=30');
    if (!response.ok) {
      return { error: `Failed to list repos: ${response.status}`, status: response.status };
    }
    const repos = await response.json();
    return repos.map((r: Record<string, unknown>) => ({
      name: r.name,
      full_name: r.full_name,
      description: r.description || '',
      private: r.private,
      default_branch: r.default_branch,
      html_url: r.html_url,
    }));
  } catch (error) {
    return { error: `GitHub API error: ${error}` };
  }
}

/**
 * List files in a directory
 */
export async function listFiles(
  token: string,
  owner: string,
  repo: string,
  path: string = ''
): Promise<GitHubResult<GitHubFile[]>> {
  try {
    const endpoint = `/repos/${owner}/${repo}/contents/${path}`;
    const response = await githubFetch(token, endpoint);
    if (!response.ok) {
      return { error: `Failed to list files: ${response.status}`, status: response.status };
    }
    const files = await response.json();

    // Handle single file response
    if (!Array.isArray(files)) {
      return [{ name: files.name, path: files.path, type: files.type, size: files.size, sha: files.sha }];
    }

    return files.map((f: Record<string, unknown>) => ({
      name: f.name as string,
      path: f.path as string,
      type: f.type as 'file' | 'dir',
      size: f.size as number | undefined,
      sha: f.sha as string | undefined,
    }));
  } catch (error) {
    return { error: `GitHub API error: ${error}` };
  }
}

/**
 * Read file contents
 */
export async function readFile(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<GitHubResult<{ content: string; sha: string }>> {
  try {
    const endpoint = `/repos/${owner}/${repo}/contents/${path}`;
    const response = await githubFetch(token, endpoint);
    if (!response.ok) {
      return { error: `Failed to read file: ${response.status}`, status: response.status };
    }
    const data = await response.json();

    if (data.type !== 'file') {
      return { error: 'Path is not a file' };
    }

    // Decode base64 content
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, sha: data.sha };
  } catch (error) {
    return { error: `GitHub API error: ${error}` };
  }
}

/**
 * Create or update a file
 */
export async function writeFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string // Required for updates, optional for new files
): Promise<GitHubResult<{ sha: string; html_url: string }>> {
  try {
    const endpoint = `/repos/${owner}/${repo}/contents/${path}`;
    const body: Record<string, string> = {
      message,
      content: Buffer.from(content).toString('base64'),
    };

    if (sha) {
      body.sha = sha;
    }

    const response = await githubFetch(token, endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || `Failed to write file: ${response.status}`, status: response.status };
    }

    const data = await response.json();
    return { sha: data.content.sha, html_url: data.content.html_url };
  } catch (error) {
    return { error: `GitHub API error: ${error}` };
  }
}

/**
 * Create a new branch
 */
export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  branchName: string,
  fromBranch: string = 'main'
): Promise<GitHubResult<{ ref: string }>> {
  try {
    // Get the SHA of the source branch
    const refResponse = await githubFetch(token, `/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`);
    if (!refResponse.ok) {
      return { error: `Source branch '${fromBranch}' not found`, status: refResponse.status };
    }
    const refData = await refResponse.json();
    const sha = refData.object.sha;

    // Create the new branch
    const response = await githubFetch(token, `/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || `Failed to create branch: ${response.status}`, status: response.status };
    }

    const data = await response.json();
    return { ref: data.ref };
  } catch (error) {
    return { error: `GitHub API error: ${error}` };
  }
}

/**
 * Create a pull request
 */
export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string, // Source branch
  base: string = 'main' // Target branch
): Promise<GitHubResult<{ number: number; html_url: string }>> {
  try {
    const response = await githubFetch(token, `/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, head, base }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || `Failed to create PR: ${response.status}`, status: response.status };
    }

    const data = await response.json();
    return { number: data.number, html_url: data.html_url };
  } catch (error) {
    return { error: `GitHub API error: ${error}` };
  }
}

/**
 * List issues
 */
export async function listIssues(
  token: string,
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open'
): Promise<GitHubResult<Array<{ number: number; title: string; state: string; html_url: string }>>> {
  try {
    const response = await githubFetch(token, `/repos/${owner}/${repo}/issues?state=${state}&per_page=20`);
    if (!response.ok) {
      return { error: `Failed to list issues: ${response.status}`, status: response.status };
    }
    const issues = await response.json();
    return issues
      .filter((i: Record<string, unknown>) => !i.pull_request) // Filter out PRs
      .map((i: Record<string, unknown>) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        html_url: i.html_url,
      }));
  } catch (error) {
    return { error: `GitHub API error: ${error}` };
  }
}

/**
 * Create an issue
 */
export async function createIssue(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body: string
): Promise<GitHubResult<{ number: number; html_url: string }>> {
  try {
    const response = await githubFetch(token, `/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || `Failed to create issue: ${response.status}`, status: response.status };
    }

    const data = await response.json();
    return { number: data.number, html_url: data.html_url };
  } catch (error) {
    return { error: `GitHub API error: ${error}` };
  }
}

// Export types and helpers
export { isError };
export type { GitHubFile, GitHubRepo, GitHubError, GitHubResult };
