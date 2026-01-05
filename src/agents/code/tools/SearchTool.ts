/**
 * SEARCH TOOL
 *
 * Searches codebases for:
 * - Pattern matching (regex)
 * - File name patterns (glob)
 * - Symbol definitions (functions, classes)
 * - References and usages
 *
 * Works with:
 * - GitHub Code Search API
 * - Local file system (development)
 */

import { BaseTool, ToolInput, ToolOutput, ToolDefinition } from './BaseTool';

interface SearchInput extends ToolInput {
  query: string;
  type: 'content' | 'filename' | 'symbol';
  path?: string;  // Limit to specific directory
  filePattern?: string;  // e.g., "*.ts", "*.py"
  maxResults?: number;
  caseSensitive?: boolean;
}

interface SearchMatch {
  path: string;
  line: number;
  column: number;
  content: string;
  context: {
    before: string;
    after: string;
  };
}

interface SearchOutput extends ToolOutput {
  result?: {
    matches: SearchMatch[];
    totalCount: number;
    truncated: boolean;
    searchTime: number;
  };
}

export class SearchTool extends BaseTool {
  name = 'search';
  description = 'Search the codebase for patterns, filenames, or symbol definitions.';

  private githubToken?: string;
  private owner?: string;
  private repo?: string;

  /**
   * Initialize with GitHub context
   */
  initialize(config: {
    githubToken?: string;
    owner?: string;
    repo?: string;
  }): void {
    this.githubToken = config.githubToken;
    this.owner = config.owner;
    this.repo = config.repo;
  }

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (text, regex, or glob pattern)',
            required: true,
          },
          type: {
            type: 'string',
            description: 'Type of search',
            enum: ['content', 'filename', 'symbol'],
            required: true,
          },
          path: {
            type: 'string',
            description: 'Limit search to specific directory path',
          },
          filePattern: {
            type: 'string',
            description: 'File pattern filter (e.g., "*.ts", "*.py")',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum results to return (default: 20)',
          },
        },
        required: ['query', 'type'],
      },
    };
  }

  async execute(input: SearchInput): Promise<SearchOutput> {
    const startTime = Date.now();

    const validationError = this.validateInput(input, ['query', 'type']);
    if (validationError) {
      return { success: false, error: validationError };
    }

    try {
      const maxResults = input.maxResults || 20;

      if (!this.githubToken || !this.owner || !this.repo) {
        return {
          success: false,
          error: 'GitHub not configured. Please connect a repository.',
        };
      }

      let matches: SearchMatch[];
      let totalCount: number;

      switch (input.type) {
        case 'content':
          ({ matches, totalCount } = await this.searchContent(input.query, input.path, input.filePattern, maxResults));
          break;
        case 'filename':
          ({ matches, totalCount } = await this.searchFilenames(input.query, input.path, maxResults));
          break;
        case 'symbol':
          ({ matches, totalCount } = await this.searchSymbols(input.query, input.path, input.filePattern, maxResults));
          break;
        default:
          return { success: false, error: `Unknown search type: ${input.type}` };
      }

      return {
        success: true,
        result: {
          matches,
          totalCount,
          truncated: totalCount > maxResults,
          searchTime: Date.now() - startTime,
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Search file contents using GitHub Code Search API
   */
  private async searchContent(
    query: string,
    path?: string,
    filePattern?: string,
    maxResults: number = 20
  ): Promise<{ matches: SearchMatch[]; totalCount: number }> {
    // Build GitHub code search query
    let searchQuery = `${query} repo:${this.owner}/${this.repo}`;

    if (path) {
      searchQuery += ` path:${path}`;
    }

    if (filePattern) {
      // Convert glob to GitHub extension filter
      const ext = filePattern.replace('*.', '');
      if (ext && !ext.includes('*')) {
        searchQuery += ` extension:${ext}`;
      }
    }

    const url = `https://api.github.com/search/code?q=${encodeURIComponent(searchQuery)}&per_page=${maxResults}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.githubToken}`,
        Accept: 'application/vnd.github.v3.text-match+json',
        'User-Agent': 'JCIL-Code-Agent',
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Try again later.');
      }
      throw new Error(`GitHub search failed: ${response.status}`);
    }

    const data = await response.json();

    const matches: SearchMatch[] = data.items?.map((item: {
      path: string;
      text_matches?: Array<{
        fragment: string;
        matches: Array<{ indices: number[] }>;
      }>;
    }) => {
      const textMatch = item.text_matches?.[0];
      return {
        path: item.path,
        line: 1, // GitHub doesn't give exact line numbers
        column: textMatch?.matches?.[0]?.indices?.[0] || 0,
        content: textMatch?.fragment || '',
        context: {
          before: '',
          after: '',
        },
      };
    }) || [];

    return {
      matches,
      totalCount: data.total_count || 0,
    };
  }

  /**
   * Search for files by name
   */
  private async searchFilenames(
    query: string,
    path?: string,
    maxResults: number = 20
  ): Promise<{ matches: SearchMatch[]; totalCount: number }> {
    // Use GitHub's file finder via tree API
    const treeUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/HEAD?recursive=1`;

    const response = await fetch(treeUrl, {
      headers: {
        Authorization: `Bearer ${this.githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'JCIL-Code-Agent',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    // Filter files matching the query
    const queryLower = query.toLowerCase();
    const queryRegex = this.globToRegex(query);

    const matchingFiles = data.tree
      ?.filter((item: { type: string; path: string }) => {
        if (item.type !== 'blob') return false;

        // Apply path filter
        if (path && !item.path.startsWith(path)) return false;

        // Check filename match
        const filename = item.path.split('/').pop() || '';
        return (
          filename.toLowerCase().includes(queryLower) ||
          queryRegex.test(filename)
        );
      })
      .slice(0, maxResults) || [];

    const matches: SearchMatch[] = matchingFiles.map((item: { path: string }) => ({
      path: item.path,
      line: 0,
      column: 0,
      content: item.path,
      context: { before: '', after: '' },
    }));

    return {
      matches,
      totalCount: matchingFiles.length,
    };
  }

  /**
   * Search for symbol definitions (functions, classes, etc.)
   */
  private async searchSymbols(
    query: string,
    path?: string,
    filePattern?: string,
    maxResults: number = 20
  ): Promise<{ matches: SearchMatch[]; totalCount: number }> {
    // Build patterns for common symbol definitions
    const symbolPatterns = [
      `function ${query}`,
      `const ${query}`,
      `let ${query}`,
      `class ${query}`,
      `interface ${query}`,
      `type ${query}`,
      `def ${query}`,  // Python
      `fn ${query}`,   // Rust
      `func ${query}`, // Go
    ];

    // Search for each pattern and combine results
    const allMatches: SearchMatch[] = [];

    for (const pattern of symbolPatterns.slice(0, 3)) {  // Limit API calls
      try {
        const { matches } = await this.searchContent(pattern, path, filePattern, 5);
        allMatches.push(...matches);
      } catch {
        // Ignore individual search failures
      }
    }

    // Deduplicate by path
    const seen = new Set<string>();
    const uniqueMatches = allMatches.filter(m => {
      if (seen.has(m.path)) return false;
      seen.add(m.path);
      return true;
    }).slice(0, maxResults);

    return {
      matches: uniqueMatches,
      totalCount: uniqueMatches.length,
    };
  }

  /**
   * Convert glob pattern to regex
   */
  private globToRegex(glob: string): RegExp {
    const escaped = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
  }

  /**
   * Get file tree structure
   */
  async getFileTree(path?: string): Promise<string[]> {
    if (!this.githubToken || !this.owner || !this.repo) {
      throw new Error('GitHub not configured');
    }

    const treeUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/HEAD?recursive=1`;

    const response = await fetch(treeUrl, {
      headers: {
        Authorization: `Bearer ${this.githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'JCIL-Code-Agent',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    return data.tree
      ?.filter((item: { type: string; path: string }) => {
        if (item.type !== 'blob') return false;
        if (path && !item.path.startsWith(path)) return false;
        return true;
      })
      .map((item: { path: string }) => item.path) || [];
  }
}

export const searchTool = new SearchTool();
