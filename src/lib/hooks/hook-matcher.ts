/**
 * Hook Matcher
 *
 * Matches hook definitions against tool execution context.
 * Supports glob patterns for flexible matching.
 */

import { minimatch } from 'minimatch';
import type { HookContext, HookDefinition, HookMatcher } from './types';

/**
 * Check if a hook matches the current context
 */
export function matchesHook(hook: HookDefinition, context: HookContext): boolean {
  const matcher = hook.matcher;

  // No matcher means match everything
  if (!matcher) {
    return true;
  }

  // Match all flag
  if (matcher.all) {
    return true;
  }

  // Tool matching
  if (matcher.tool && context.tool) {
    if (!matchPattern(matcher.tool, context.tool)) {
      return false;
    }
  } else if (matcher.tool && !context.tool) {
    // Matcher requires a tool but context has none
    return false;
  }

  // Command matching (for Bash tool)
  if (matcher.command && context.tool === 'execute_shell') {
    const command = context.toolInput?.command as string | undefined;
    if (!command || !matchPattern(matcher.command, command)) {
      return false;
    }
  } else if (matcher.command && context.tool !== 'execute_shell') {
    // Command matcher only applies to shell commands
    return false;
  }

  // Path matching (for file operations)
  if (matcher.path) {
    const path = context.filePath || (context.toolInput?.path as string | undefined);
    if (!path || !matchPattern(matcher.path, path)) {
      return false;
    }
  }

  return true;
}

/**
 * Match a pattern against a value
 * Supports:
 * - Exact match: "git push"
 * - Glob patterns: "git *", "*.ts"
 * - Prefix match: "git push:*" matches "git push origin main"
 */
export function matchPattern(pattern: string, value: string): boolean {
  // Check for Claude Code style pattern: "tool(pattern)"
  const toolPatternMatch = pattern.match(/^(\w+)\((.+)\)$/);
  if (toolPatternMatch) {
    // This is handled at a higher level, just match the inner pattern
    pattern = toolPatternMatch[2];
  }

  // Check for colon-separated pattern: "git push:*"
  if (pattern.includes(':')) {
    const [prefix, suffix] = pattern.split(':', 2);
    if (suffix === '*') {
      return value.startsWith(prefix);
    }
    // Try exact match first
    if (value === pattern) {
      return true;
    }
    // Fall through to glob matching
  }

  // Exact match
  if (pattern === value) {
    return true;
  }

  // Glob matching
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

/**
 * Parse Claude Code style permission pattern
 * e.g., "Bash(git push:*)" -> { tool: "Bash", pattern: "git push:*" }
 */
export function parsePermissionPattern(pattern: string): { tool: string; pattern?: string } | null {
  const match = pattern.match(/^(\w+)(?:\((.+)\))?$/);
  if (!match) {
    return null;
  }

  return {
    tool: match[1],
    pattern: match[2],
  };
}

/**
 * Filter hooks that match the current context
 */
export function filterMatchingHooks(
  hooks: HookDefinition[],
  context: HookContext
): HookDefinition[] {
  return hooks.filter((hook) => {
    // Skip disabled hooks
    if (hook.enabled === false) {
      return false;
    }

    return matchesHook(hook, context);
  });
}

/**
 * Create a matcher from a simple pattern
 */
export function createMatcher(pattern: string): HookMatcher {
  const parsed = parsePermissionPattern(pattern);

  if (parsed) {
    if (parsed.tool === 'Bash' && parsed.pattern) {
      return { tool: 'execute_shell', command: parsed.pattern };
    }
    if (parsed.tool === 'Edit' && parsed.pattern) {
      return { tool: 'edit_file', path: parsed.pattern };
    }
    if (parsed.tool === 'Write' && parsed.pattern) {
      return { tool: 'write_file', path: parsed.pattern };
    }
    if (parsed.tool === 'Read' && parsed.pattern) {
      return { tool: 'read_file', path: parsed.pattern };
    }
    return { tool: parsed.tool.toLowerCase() };
  }

  // Treat as tool name
  return { tool: pattern };
}
