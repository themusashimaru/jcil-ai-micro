/**
 * GitHub Tools for Gemini Function Calling
 * ==========================================
 *
 * Defines GitHub-related tools that Gemini can invoke to:
 * - Clone/review repositories
 * - Read files
 * - Create branches
 * - Create pull requests
 *
 * Uses @google/genai FunctionDeclaration format.
 */

import { Type } from '@google/genai';
import {
  cloneRepo,
  getFileContent,
  getRepoInfo,
  getBranches,
  createBranch,
  createPullRequest,
  pushFiles,
  parseGitHubUrl,
} from '@/lib/connectors';

// ============================================================================
// Tool Declarations (for Gemini config.tools)
// ============================================================================

/**
 * Clone/review a GitHub repository
 */
export const cloneRepoDeclaration = {
  name: 'github_clone_repo',
  description: `Fetch and review code from a GitHub repository. Use this when the user wants to:
- Review their code or project
- Analyze a GitHub repository
- Look at code from a GitHub URL
- Understand how a codebase works

This fetches the repository's source files and returns them for analysis.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      repo_url: {
        type: Type.STRING,
        description: 'GitHub repository URL (e.g., "https://github.com/owner/repo") or short form "owner/repo"',
      },
      branch: {
        type: Type.STRING,
        description: 'Branch to fetch (optional, defaults to default branch)',
      },
      path: {
        type: Type.STRING,
        description: 'Specific directory path to focus on (optional)',
      },
      max_files: {
        type: Type.NUMBER,
        description: 'Maximum number of files to fetch (default: 50, max: 100)',
      },
    },
    required: ['repo_url'],
  },
};

/**
 * Get a specific file from a repository
 */
export const getFileDeclaration = {
  name: 'github_get_file',
  description: `Get the content of a specific file from a GitHub repository. Use this when:
- User asks about a specific file
- You need to see the full content of a file that was truncated
- User wants to read a particular configuration or source file`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      owner: {
        type: Type.STRING,
        description: 'Repository owner (username or organization)',
      },
      repo: {
        type: Type.STRING,
        description: 'Repository name',
      },
      path: {
        type: Type.STRING,
        description: 'Path to the file (e.g., "src/index.ts")',
      },
      branch: {
        type: Type.STRING,
        description: 'Branch name (optional, defaults to default branch)',
      },
    },
    required: ['owner', 'repo', 'path'],
  },
};

/**
 * Get repository information
 */
export const getRepoInfoDeclaration = {
  name: 'github_get_repo_info',
  description: 'Get metadata about a GitHub repository including description, default branch, and visibility.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      repo_url: {
        type: Type.STRING,
        description: 'GitHub repository URL or "owner/repo"',
      },
    },
    required: ['repo_url'],
  },
};

/**
 * List branches in a repository
 */
export const listBranchesDeclaration = {
  name: 'github_list_branches',
  description: 'List all branches in a GitHub repository.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      owner: {
        type: Type.STRING,
        description: 'Repository owner',
      },
      repo: {
        type: Type.STRING,
        description: 'Repository name',
      },
    },
    required: ['owner', 'repo'],
  },
};

/**
 * Create a new branch
 */
export const createBranchDeclaration = {
  name: 'github_create_branch',
  description: `Create a new branch in a GitHub repository. Use this when:
- User wants to make changes to their code
- You need to create a feature branch for a PR
- Preparing to push code changes`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      owner: {
        type: Type.STRING,
        description: 'Repository owner',
      },
      repo: {
        type: Type.STRING,
        description: 'Repository name',
      },
      branch_name: {
        type: Type.STRING,
        description: 'Name for the new branch',
      },
      from_branch: {
        type: Type.STRING,
        description: 'Branch to create from (optional, defaults to default branch)',
      },
    },
    required: ['owner', 'repo', 'branch_name'],
  },
};

/**
 * Push files to a repository
 */
export const pushFilesDeclaration = {
  name: 'github_push_files',
  description: `Push code changes to a GitHub repository. Use this when:
- User asks you to fix or improve their code
- You've generated code that should be committed
- User wants to save changes to their repo`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      owner: {
        type: Type.STRING,
        description: 'Repository owner',
      },
      repo: {
        type: Type.STRING,
        description: 'Repository name',
      },
      branch: {
        type: Type.STRING,
        description: 'Branch to push to',
      },
      commit_message: {
        type: Type.STRING,
        description: 'Commit message describing the changes',
      },
      files: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: 'File path in the repository' },
            content: { type: Type.STRING, description: 'New file content' },
          },
          required: ['path', 'content'],
        },
        description: 'Array of files to push',
      },
    },
    required: ['owner', 'repo', 'branch', 'commit_message', 'files'],
  },
};

/**
 * Create a pull request
 */
export const createPullRequestDeclaration = {
  name: 'github_create_pr',
  description: `Create a pull request in a GitHub repository. Use this when:
- User wants to submit code changes for review
- You've pushed changes to a branch and want to merge them
- User explicitly asks for a PR`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      owner: {
        type: Type.STRING,
        description: 'Repository owner',
      },
      repo: {
        type: Type.STRING,
        description: 'Repository name',
      },
      title: {
        type: Type.STRING,
        description: 'Pull request title',
      },
      body: {
        type: Type.STRING,
        description: 'Pull request description/body',
      },
      head: {
        type: Type.STRING,
        description: 'Branch with the changes',
      },
      base: {
        type: Type.STRING,
        description: 'Target branch (usually main or master)',
      },
    },
    required: ['owner', 'repo', 'title', 'head', 'base'],
  },
};

// ============================================================================
// All GitHub Tool Declarations
// ============================================================================

export const githubFunctionDeclarations = [
  cloneRepoDeclaration,
  getFileDeclaration,
  getRepoInfoDeclaration,
  listBranchesDeclaration,
  createBranchDeclaration,
  pushFilesDeclaration,
  createPullRequestDeclaration,
];

// ============================================================================
// Tool Execution Handler
// ============================================================================

export interface GitHubToolContext {
  githubToken: string;
}

/**
 * Execute a GitHub tool function call
 * Returns the result to be sent back to Gemini
 */
export async function executeGitHubTool(
  functionName: string,
  args: Record<string, unknown>,
  context: GitHubToolContext
): Promise<{ success: boolean; result: unknown; error?: string }> {
  const { githubToken } = context;

  if (!githubToken) {
    return {
      success: false,
      result: null,
      error: 'GitHub not connected. Please connect your GitHub account in Settings > Connectors.',
    };
  }

  try {
    switch (functionName) {
      case 'github_clone_repo': {
        const repoUrl = args.repo_url as string;
        const parsed = parseGitHubUrl(repoUrl);
        if (!parsed) {
          return { success: false, result: null, error: 'Invalid GitHub URL' };
        }

        const result = await cloneRepo(githubToken, {
          owner: parsed.owner,
          repo: parsed.repo,
          branch: args.branch as string | undefined,
          path: args.path as string | undefined,
          maxFiles: Math.min((args.max_files as number) || 50, 100),
          maxFileSize: 50 * 1024, // 50KB per file
        });

        if (!result.success) {
          return { success: false, result: null, error: result.error };
        }

        // Format the result nicely for Gemini
        return {
          success: true,
          result: {
            repository: `${parsed.owner}/${parsed.repo}`,
            totalFiles: result.totalFiles,
            fetchedFiles: result.fetchedFiles,
            truncated: result.truncated,
            files: result.files.map(f => ({
              path: f.path,
              language: f.language,
              size: f.size,
              content: f.content,
            })),
          },
        };
      }

      case 'github_get_file': {
        const result = await getFileContent(
          githubToken,
          args.owner as string,
          args.repo as string,
          args.path as string,
          args.branch as string | undefined
        );

        if (!result) {
          return { success: false, result: null, error: 'File not found' };
        }

        return {
          success: true,
          result: {
            path: args.path,
            content: result.content,
            sha: result.sha,
          },
        };
      }

      case 'github_get_repo_info': {
        const repoUrl = args.repo_url as string;
        const parsed = parseGitHubUrl(repoUrl);
        if (!parsed) {
          return { success: false, result: null, error: 'Invalid GitHub URL' };
        }

        const result = await getRepoInfo(githubToken, parsed.owner, parsed.repo);
        if (!result) {
          return { success: false, result: null, error: 'Repository not found' };
        }

        return { success: true, result };
      }

      case 'github_list_branches': {
        const result = await getBranches(
          githubToken,
          args.owner as string,
          args.repo as string
        );
        return { success: true, result: { branches: result } };
      }

      case 'github_create_branch': {
        const result = await createBranch(
          githubToken,
          args.owner as string,
          args.repo as string,
          args.branch_name as string,
          args.from_branch as string | undefined
        );

        if (!result.success) {
          return { success: false, result: null, error: result.error };
        }

        return {
          success: true,
          result: { branch: args.branch_name, sha: result.sha },
        };
      }

      case 'github_push_files': {
        const files = (args.files as Array<{ path: string; content: string }>) || [];
        const result = await pushFiles(githubToken, {
          owner: args.owner as string,
          repo: args.repo as string,
          branch: args.branch as string,
          message: args.commit_message as string,
          files,
        });

        if (!result.success) {
          return { success: false, result: null, error: result.error };
        }

        return {
          success: true,
          result: {
            commitSha: result.commitSha,
            repoUrl: result.repoUrl,
            filesCommitted: files.length,
          },
        };
      }

      case 'github_create_pr': {
        const result = await createPullRequest(githubToken, {
          owner: args.owner as string,
          repo: args.repo as string,
          title: args.title as string,
          body: (args.body as string) || '',
          head: args.head as string,
          base: args.base as string,
        });

        if (!result.success) {
          return { success: false, result: null, error: result.error };
        }

        return {
          success: true,
          result: {
            prNumber: result.prNumber,
            prUrl: result.prUrl,
          },
        };
      }

      default:
        return { success: false, result: null, error: `Unknown function: ${functionName}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    console.error(`[GitHub Tools] Error executing ${functionName}:`, error);
    return { success: false, result: null, error: message };
  }
}

// ============================================================================
// Helper to check if a function call is a GitHub tool
// ============================================================================

const GITHUB_TOOL_NAMES = new Set([
  'github_clone_repo',
  'github_get_file',
  'github_get_repo_info',
  'github_list_branches',
  'github_create_branch',
  'github_push_files',
  'github_create_pr',
]);

export function isGitHubTool(functionName: string): boolean {
  return GITHUB_TOOL_NAMES.has(functionName);
}
