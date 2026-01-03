/**
 * GitHub Repository Context Provider
 * ===================================
 *
 * Detects GitHub repository references in user messages and fetches
 * code context for the AI to analyze.
 *
 * Usage:
 * 1. Call `detectRepoRequest()` to check if user wants to review a repo
 * 2. Call `fetchRepoContext()` to get the code as context string
 * 3. Inject the context into the AI conversation
 */

import {
  cloneRepo,
  getRepoInfo,
  type GitHubCloneResult,
} from '@/lib/connectors';

// ============================================================================
// Types
// ============================================================================

export interface RepoRequest {
  detected: boolean;
  owner?: string;
  repo?: string;
  branch?: string;
  path?: string;
  action: 'review' | 'analyze' | 'explain' | 'improve' | 'none';
}

export interface RepoContext {
  success: boolean;
  contextString: string;
  repoInfo?: {
    name: string;
    fullName: string;
    description: string | null;
    defaultBranch: string;
  };
  stats?: {
    totalFiles: number;
    fetchedFiles: number;
    truncated: boolean;
  };
  error?: string;
}

// ============================================================================
// Detection
// ============================================================================

/**
 * Patterns that indicate a code review request
 */
const REVIEW_PATTERNS = [
  /review\s+(?:my\s+)?(?:code|repo|repository|project)/i,
  /analyze\s+(?:my\s+)?(?:code|repo|repository|project|codebase)/i,
  /look\s+at\s+(?:my\s+)?(?:code|repo|repository|project)/i,
  /check\s+(?:my\s+)?(?:code|repo|repository|project)/i,
  /explain\s+(?:my\s+)?(?:code|repo|repository|project)/i,
  /what(?:'s|\s+is)\s+wrong\s+with/i,
  /improve\s+(?:my\s+)?(?:code|repo|repository|project)/i,
  /refactor/i,
  /code\s+review/i,
  /help\s+me\s+with\s+(?:my\s+)?(?:code|repo|project)/i,
  /debug\s+(?:my\s+)?(?:code|repo|project)/i,
];

/**
 * Detect if the user message contains a GitHub repo request
 */
export function detectRepoRequest(message: string): RepoRequest {
  // Try to find a GitHub URL
  const urlMatch = message.match(/(?:https?:\/\/)?github\.com\/([^/\s]+)\/([^/\s]+)/i);
  const shortMatch = message.match(/\b([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\b/);

  // Determine if it's a review/analyze request
  let action: RepoRequest['action'] = 'none';
  for (const pattern of REVIEW_PATTERNS) {
    if (pattern.test(message)) {
      if (/review|check/i.test(message)) action = 'review';
      else if (/analyze|look/i.test(message)) action = 'analyze';
      else if (/explain/i.test(message)) action = 'explain';
      else if (/improve|refactor/i.test(message)) action = 'improve';
      else action = 'review';
      break;
    }
  }

  // If no action pattern found but has URL, assume analyze
  if (urlMatch) {
    return {
      detected: true,
      owner: urlMatch[1],
      repo: urlMatch[2],
      action: action === 'none' ? 'analyze' : action,
    };
  }

  // Check short format only if there's an action keyword
  if (shortMatch && action !== 'none') {
    // Validate it looks like a repo (not just random text)
    const potentialOwner = shortMatch[1];
    const potentialRepo = shortMatch[2];

    // Skip common false positives
    const skipPatterns = ['node_modules', 'src', 'dist', 'build', 'public'];
    if (skipPatterns.includes(potentialOwner) || skipPatterns.includes(potentialRepo)) {
      return { detected: false, action: 'none' };
    }

    return {
      detected: true,
      owner: potentialOwner,
      repo: potentialRepo,
      action,
    };
  }

  return { detected: false, action };
}

// ============================================================================
// Context Fetching
// ============================================================================

/**
 * Fetch repository contents and format as context for AI
 */
export async function fetchRepoContext(
  githubToken: string,
  owner: string,
  repo: string,
  options?: {
    branch?: string;
    path?: string;
    maxFiles?: number;
    focusOnSource?: boolean; // If true, prioritize source code files
  }
): Promise<RepoContext> {
  try {
    // Get repo info first
    const repoInfo = await getRepoInfo(githubToken, owner, repo);
    if (!repoInfo) {
      return {
        success: false,
        contextString: '',
        error: `Repository not found: ${owner}/${repo}`,
      };
    }

    // Smart include patterns for source code
    const sourcePatterns = options?.focusOnSource
      ? [
          '*.ts', '*.tsx', '*.js', '*.jsx',
          '*.py', '*.go', '*.rs', '*.java',
          '*.rb', '*.php', '*.swift', '*.kt',
          '*.c', '*.cpp', '*.h', '*.cs',
          '*.vue', '*.svelte',
          'package.json', 'tsconfig.json', 'pyproject.toml',
          'Cargo.toml', 'go.mod', 'pom.xml',
          '*.md', // Keep READMEs
        ]
      : [];

    // Clone the repo
    const cloneResult = await cloneRepo(githubToken, {
      owner,
      repo,
      branch: options?.branch,
      path: options?.path,
      maxFiles: options?.maxFiles || 50,
      maxFileSize: 50 * 1024, // 50KB per file
      includePatterns: sourcePatterns,
    });

    if (!cloneResult.success) {
      return {
        success: false,
        contextString: '',
        error: cloneResult.error || 'Failed to fetch repository',
      };
    }

    // Format the context string
    const contextString = formatRepoContext(repoInfo, cloneResult);

    return {
      success: true,
      contextString,
      repoInfo: {
        name: repoInfo.name,
        fullName: repoInfo.fullName,
        description: repoInfo.description,
        defaultBranch: repoInfo.defaultBranch,
      },
      stats: {
        totalFiles: cloneResult.totalFiles,
        fetchedFiles: cloneResult.fetchedFiles,
        truncated: cloneResult.truncated,
      },
    };
  } catch (error) {
    return {
      success: false,
      contextString: '',
      error: error instanceof Error ? error.message : 'Failed to fetch repository',
    };
  }
}

/**
 * Format repository contents as a context string for AI
 */
function formatRepoContext(
  repoInfo: { name: string; fullName: string; description: string | null; defaultBranch: string },
  cloneResult: GitHubCloneResult
): string {
  const lines: string[] = [];

  // Header
  lines.push('# GitHub Repository Context');
  lines.push('');
  lines.push(`**Repository:** ${repoInfo.fullName}`);
  if (repoInfo.description) {
    lines.push(`**Description:** ${repoInfo.description}`);
  }
  lines.push(`**Default Branch:** ${repoInfo.defaultBranch}`);
  lines.push(`**Files Analyzed:** ${cloneResult.fetchedFiles} of ${cloneResult.totalFiles}`);
  if (cloneResult.truncated) {
    lines.push('*(Note: Repository contains more files than shown)*');
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Directory structure
  const dirs = new Set<string>();
  for (const item of cloneResult.tree) {
    if (item.type === 'tree') {
      dirs.add(item.path);
    }
  }
  if (dirs.size > 0) {
    lines.push('## Directory Structure');
    lines.push('```');
    const sortedDirs = Array.from(dirs).sort();
    for (const dir of sortedDirs.slice(0, 20)) {
      lines.push(`${dir}/`);
    }
    if (sortedDirs.length > 20) {
      lines.push(`... and ${sortedDirs.length - 20} more directories`);
    }
    lines.push('```');
    lines.push('');
  }

  // File contents
  lines.push('## File Contents');
  lines.push('');

  // Sort files: configs first, then by path
  const sortedFiles = [...cloneResult.files].sort((a, b) => {
    const aIsConfig = /package\.json|tsconfig|\.config\.|Cargo\.toml|go\.mod/.test(a.path);
    const bIsConfig = /package\.json|tsconfig|\.config\.|Cargo\.toml|go\.mod/.test(b.path);
    if (aIsConfig && !bIsConfig) return -1;
    if (!aIsConfig && bIsConfig) return 1;
    return a.path.localeCompare(b.path);
  });

  for (const file of sortedFiles) {
    lines.push(`### ${file.path}`);
    const lang = file.language || getLanguageFromPath(file.path);
    lines.push(`\`\`\`${lang}`);
    // Truncate very long files
    const maxLines = 150;
    const fileLines = file.content.split('\n');
    if (fileLines.length > maxLines) {
      lines.push(fileLines.slice(0, maxLines).join('\n'));
      lines.push(`\n... (${fileLines.length - maxLines} more lines)`);
    } else {
      lines.push(file.content);
    }
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get language identifier from file path
 */
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
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
    sh: 'bash',
    dockerfile: 'dockerfile',
    toml: 'toml',
  };
  return langMap[ext] || '';
}

// ============================================================================
// Integration Helper
// ============================================================================

/**
 * Full integration helper - detect, fetch, and format in one call
 * Use this from the chat route
 */
export async function getGitHubContextForMessage(
  message: string,
  githubToken: string | null
): Promise<{ hasContext: boolean; context: string; error?: string }> {
  // Detect if this is a repo request
  const request = detectRepoRequest(message);

  if (!request.detected || !request.owner || !request.repo) {
    return { hasContext: false, context: '' };
  }

  // Check if GitHub is connected
  if (!githubToken) {
    return {
      hasContext: false,
      context: '',
      error: 'GitHub not connected. Please connect your GitHub account in Settings > Connectors to review repositories.',
    };
  }

  // Fetch the repo context
  const result = await fetchRepoContext(githubToken, request.owner, request.repo, {
    focusOnSource: true,
    maxFiles: 50,
  });

  if (!result.success) {
    return {
      hasContext: false,
      context: '',
      error: result.error,
    };
  }

  // Add action context
  const actionPrompts: Record<string, string> = {
    review: '\n\n**Task:** Please review this code. Look for bugs, security issues, performance problems, and suggest improvements.',
    analyze: '\n\n**Task:** Please analyze this codebase and explain its architecture, key components, and how it works.',
    explain: '\n\n**Task:** Please explain what this code does and how the different parts work together.',
    improve: '\n\n**Task:** Please suggest improvements to this code, including refactoring opportunities and best practices.',
  };

  const actionPrompt = actionPrompts[request.action] || '';

  return {
    hasContext: true,
    context: result.contextString + actionPrompt,
  };
}
