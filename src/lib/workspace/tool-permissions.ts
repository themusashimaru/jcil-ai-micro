/**
 * Tool Permission Patterns
 *
 * Implements Claude Code-style tool permission patterns like:
 * - Bash(git push:*) - Allow git push commands
 * - Edit(src/**\/*.ts) - Allow editing TypeScript files in src/
 * - Read(*) - Allow reading all files
 *
 * This matches Claude Code's .claude/settings.json allowedTools format.
 */

import { minimatch } from 'minimatch';
import { logger } from '@/lib/logger';

const log = logger('tool-permissions');

// ============================================================================
// TYPES
// ============================================================================

export type ToolName =
  | 'Bash'
  | 'Edit'
  | 'Write'
  | 'Read'
  | 'WebFetch'
  | 'WebSearch'
  | 'Task'
  | 'mcp';

export interface ToolPermissionPattern {
  /** Original pattern string (e.g., "Bash(git push:*)") */
  pattern: string;

  /** Parsed tool name */
  tool: ToolName | string;

  /** Inner pattern (e.g., "git push:*" or "src/**\/*.ts") */
  innerPattern?: string;

  /** Whether this is an MCP tool pattern */
  isMcp?: boolean;

  /** MCP server name (if applicable) */
  mcpServer?: string;
}

export interface ToolPermissionConfig {
  /** Allowed tool patterns (always allowed without confirmation) */
  allowedTools: string[];

  /** Denied tool patterns (always denied) */
  deniedTools?: string[];

  /** Whether to auto-allow in sandbox environments */
  autoAllowInSandbox?: boolean;

  /** Whether to prompt for unknown tools */
  promptForUnknown?: boolean;
}

export interface ToolPermissionCheck {
  /** Tool being checked */
  tool: string;

  /** Input parameters */
  input: Record<string, unknown>;

  /** Specific field to check (e.g., "command" for Bash) */
  checkField?: string;

  /** Value to check against patterns */
  checkValue?: string;
}

export interface ToolPermissionResult {
  /** Whether the tool use is allowed */
  allowed: boolean;

  /** Whether user confirmation is required */
  requiresConfirmation: boolean;

  /** Matched pattern (if allowed) */
  matchedPattern?: string;

  /** Reason for decision */
  reason: string;
}

// ============================================================================
// PATTERN PARSING
// ============================================================================

/**
 * Parse a tool permission pattern string
 * Examples:
 * - "Bash" -> { tool: "Bash" }
 * - "Bash(git push:*)" -> { tool: "Bash", innerPattern: "git push:*" }
 * - "Edit(src/**\/*.ts)" -> { tool: "Edit", innerPattern: "src/**\/*.ts" }
 * - "mcp__server__tool" -> { tool: "tool", isMcp: true, mcpServer: "server" }
 */
export function parseToolPattern(pattern: string): ToolPermissionPattern | null {
  // Check for MCP pattern: mcp__server__tool
  if (pattern.startsWith('mcp__')) {
    const parts = pattern.split('__');
    if (parts.length >= 3) {
      return {
        pattern,
        tool: parts.slice(2).join('__'),
        isMcp: true,
        mcpServer: parts[1],
      };
    }
  }

  // Check for tool(pattern) format
  const toolPatternMatch = pattern.match(/^(\w+)(?:\((.+)\))?$/);
  if (!toolPatternMatch) {
    return null;
  }

  const [, toolName, innerPattern] = toolPatternMatch;

  return {
    pattern,
    tool: toolName as ToolName,
    innerPattern,
  };
}

/**
 * Check if a value matches an inner pattern
 * Supports:
 * - Exact match: "git push"
 * - Prefix match: "git push:*" matches "git push origin main"
 * - Glob patterns: "*.ts", "src/**\/*.ts"
 */
export function matchInnerPattern(pattern: string, value: string): boolean {
  // Exact match
  if (pattern === value) {
    return true;
  }

  // Colon prefix pattern: "git push:*" matches "git push origin main"
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -2);
    if (value.startsWith(prefix)) {
      return true;
    }
  }

  // Glob pattern matching
  try {
    return minimatch(value, pattern, {
      nocase: false,
      dot: true,
      matchBase: true,
    });
  } catch {
    // Invalid pattern, try string contains
    return value.includes(pattern);
  }
}

// ============================================================================
// TOOL PERMISSION MANAGER
// ============================================================================

export class ToolPermissionManager {
  private config: ToolPermissionConfig;
  private parsedPatterns: ToolPermissionPattern[] = [];
  private deniedPatterns: ToolPermissionPattern[] = [];

  constructor(config: ToolPermissionConfig = { allowedTools: [] }) {
    this.config = config;
    this.parsePatterns();
  }

  /**
   * Parse all patterns from config
   */
  private parsePatterns(): void {
    this.parsedPatterns = [];
    this.deniedPatterns = [];

    for (const pattern of this.config.allowedTools) {
      const parsed = parseToolPattern(pattern);
      if (parsed) {
        this.parsedPatterns.push(parsed);
      } else {
        log.warn('Invalid tool pattern', { pattern });
      }
    }

    for (const pattern of this.config.deniedTools || []) {
      const parsed = parseToolPattern(pattern);
      if (parsed) {
        this.deniedPatterns.push(parsed);
      }
    }

    log.info('Parsed tool patterns', {
      allowed: this.parsedPatterns.length,
      denied: this.deniedPatterns.length,
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ToolPermissionConfig>): void {
    this.config = { ...this.config, ...config };
    this.parsePatterns();
  }

  /**
   * Add an allowed tool pattern
   */
  addAllowedPattern(pattern: string): void {
    if (!this.config.allowedTools.includes(pattern)) {
      this.config.allowedTools.push(pattern);
      this.parsePatterns();
    }
  }

  /**
   * Remove an allowed tool pattern
   */
  removeAllowedPattern(pattern: string): void {
    this.config.allowedTools = this.config.allowedTools.filter((p) => p !== pattern);
    this.parsePatterns();
  }

  /**
   * Check if a tool use is allowed
   */
  check(check: ToolPermissionCheck): ToolPermissionResult {
    const { tool, input, checkField, checkValue } = check;

    // Normalize tool name (handle internal tool names)
    const normalizedTool = this.normalizeToolName(tool);

    // Get the value to check against patterns
    const valueToCheck = checkValue || this.getCheckValue(normalizedTool, input, checkField);

    // First check denied patterns
    for (const pattern of this.deniedPatterns) {
      if (this.matchesPattern(normalizedTool, valueToCheck, pattern)) {
        return {
          allowed: false,
          requiresConfirmation: false,
          matchedPattern: pattern.pattern,
          reason: `Denied by pattern: ${pattern.pattern}`,
        };
      }
    }

    // Check allowed patterns
    for (const pattern of this.parsedPatterns) {
      if (this.matchesPattern(normalizedTool, valueToCheck, pattern)) {
        return {
          allowed: true,
          requiresConfirmation: false,
          matchedPattern: pattern.pattern,
          reason: `Allowed by pattern: ${pattern.pattern}`,
        };
      }
    }

    // Auto-allow in sandbox mode
    if (this.config.autoAllowInSandbox) {
      return {
        allowed: true,
        requiresConfirmation: false,
        reason: 'Auto-allowed in sandbox environment',
      };
    }

    // Default: requires confirmation
    return {
      allowed: false,
      requiresConfirmation: this.config.promptForUnknown !== false,
      reason: 'No matching permission pattern',
    };
  }

  /**
   * Normalize internal tool names to user-facing names
   */
  private normalizeToolName(tool: string): string {
    const mapping: Record<string, string> = {
      execute_shell: 'Bash',
      edit_file: 'Edit',
      write_file: 'Write',
      read_file: 'Read',
      web_fetch: 'WebFetch',
      web_search: 'WebSearch',
      task: 'Task',
      search_files: 'Glob',
      search_code: 'Grep',
    };

    return mapping[tool] || tool;
  }

  /**
   * Get the value to check from tool input
   */
  private getCheckValue(
    tool: string,
    input: Record<string, unknown>,
    checkField?: string
  ): string | undefined {
    if (checkField && input[checkField]) {
      return String(input[checkField]);
    }

    // Tool-specific value extraction
    switch (tool) {
      case 'Bash':
      case 'execute_shell':
        return input.command as string | undefined;

      case 'Edit':
      case 'Write':
      case 'Read':
      case 'edit_file':
      case 'write_file':
      case 'read_file':
        return (input.file_path || input.path) as string | undefined;

      case 'WebFetch':
      case 'web_fetch':
        return input.url as string | undefined;

      case 'WebSearch':
      case 'web_search':
        return input.query as string | undefined;

      default:
        return undefined;
    }
  }

  /**
   * Check if a tool use matches a permission pattern
   */
  private matchesPattern(
    tool: string,
    value: string | undefined,
    pattern: ToolPermissionPattern
  ): boolean {
    // MCP pattern matching
    if (pattern.isMcp) {
      if (!tool.startsWith('mcp__')) {
        return false;
      }
      const parts = tool.split('__');
      if (parts.length < 3) return false;

      const mcpServer = parts[1];
      const mcpTool = parts.slice(2).join('__');

      // Check server matches
      if (pattern.mcpServer && pattern.mcpServer !== mcpServer) {
        return false;
      }

      // Check tool matches
      return pattern.tool === mcpTool || pattern.tool === '*';
    }

    // Standard tool matching
    const normalizedPatternTool = pattern.tool.toLowerCase();
    const normalizedTool = tool.toLowerCase();

    // Tool name must match
    if (normalizedPatternTool !== normalizedTool && normalizedPatternTool !== '*') {
      return false;
    }

    // If no inner pattern, tool match is sufficient
    if (!pattern.innerPattern) {
      return true;
    }

    // Need a value to match inner pattern
    if (!value) {
      return false;
    }

    return matchInnerPattern(pattern.innerPattern, value);
  }

  /**
   * Get all current patterns
   */
  getPatterns(): { allowed: string[]; denied: string[] } {
    return {
      allowed: this.config.allowedTools,
      denied: this.config.deniedTools || [],
    };
  }

  /**
   * Check multiple tools at once
   */
  checkMultiple(checks: ToolPermissionCheck[]): Map<string, ToolPermissionResult> {
    const results = new Map<string, ToolPermissionResult>();
    for (const check of checks) {
      results.set(check.tool, this.check(check));
    }
    return results;
  }
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

let toolPermissionManagerInstance: ToolPermissionManager | null = null;

/**
 * Get the singleton tool permission manager
 */
export function getToolPermissionManager(): ToolPermissionManager {
  if (!toolPermissionManagerInstance) {
    toolPermissionManagerInstance = new ToolPermissionManager({
      allowedTools: [],
      autoAllowInSandbox: true, // Default for web sandbox environment
      promptForUnknown: true,
    });
  }
  return toolPermissionManagerInstance;
}

/**
 * Load tool permissions from .claude/settings.json
 */
export function loadToolPermissionsFromSettings(settings: {
  allowedTools?: string[];
  deniedTools?: string[];
}): void {
  const manager = getToolPermissionManager();
  manager.updateConfig({
    allowedTools: settings.allowedTools || [],
    deniedTools: settings.deniedTools || [],
  });
  log.info('Loaded tool permissions from settings', {
    allowed: settings.allowedTools?.length || 0,
    denied: settings.deniedTools?.length || 0,
  });
}

/**
 * Create common permission patterns
 */
export const CommonPatterns = {
  // Bash patterns
  allBash: 'Bash',
  gitPush: 'Bash(git push:*)',
  gitCommit: 'Bash(git commit:*)',
  gitStatus: 'Bash(git status)',
  gitDiff: 'Bash(git diff:*)',
  npm: 'Bash(npm:*)',
  pnpm: 'Bash(pnpm:*)',
  yarn: 'Bash(yarn:*)',

  // File patterns
  allRead: 'Read',
  allEdit: 'Edit',
  allWrite: 'Write',
  editTypeScript: 'Edit(*.ts)',
  editTypeScriptSrc: 'Edit(src/**/*.ts)',
  editTests: 'Edit(**/*.test.ts)',
  readMarkdown: 'Read(*.md)',
  readJson: 'Read(*.json)',

  // Web patterns
  allWebFetch: 'WebFetch',
  webFetchDocs: 'WebFetch(https://docs.*)',

  // Task patterns
  allTask: 'Task',
};

/**
 * Check if a tool use should be auto-allowed based on common safe patterns
 */
export function isSafeToolUse(tool: string, input: Record<string, unknown>): boolean {
  const safePatterns: Array<{ tool: string; patterns?: string[] }> = [
    { tool: 'Read' }, // Reading is always safe
    { tool: 'search_files' }, // File search is safe
    { tool: 'search_code' }, // Code search is safe
    { tool: 'list_files' }, // Listing is safe
    {
      tool: 'Bash',
      patterns: [
        'ls',
        'pwd',
        'cat',
        'head',
        'tail',
        'echo',
        'git status',
        'git log',
        'git diff',
        'git branch',
        'npm list',
        'npm outdated',
        'node --version',
        'npm --version',
        'which',
        'type',
      ],
    },
  ];

  const normalizedTool = tool
    .toLowerCase()
    .replace('execute_shell', 'bash')
    .replace('read_file', 'read');

  for (const safe of safePatterns) {
    if (safe.tool.toLowerCase() === normalizedTool) {
      if (!safe.patterns) {
        return true; // All uses of this tool are safe
      }

      const command = (input.command as string) || '';
      const trimmedCommand = command.trim().toLowerCase();

      for (const pattern of safe.patterns) {
        if (trimmedCommand.startsWith(pattern.toLowerCase())) {
          return true;
        }
      }
    }
  }

  return false;
}
