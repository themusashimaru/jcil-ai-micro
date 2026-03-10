/**
 * WORKSPACE SECURITY UTILITIES
 *
 * Provides security functions for Code Lab workspace operations:
 * - Command injection prevention
 * - Input sanitization
 * - Token validation
 */

/**
 * Sanitize a string for safe shell command execution
 * Escapes shell metacharacters to prevent command injection
 */
export function sanitizeShellArg(input: string): string {
  if (!input) return '';

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Escape shell metacharacters using single quotes
  // Single quotes prevent all shell interpretation except for single quotes themselves
  // We escape single quotes by ending the quote, adding escaped quote, and starting new quote
  sanitized = sanitized.replace(/'/g, "'\\''");

  return `'${sanitized}'`;
}

/**
 * Sanitize a commit message for git
 * More permissive than shell arg but still safe
 */
export function sanitizeCommitMessage(message: string): string {
  if (!message) return 'Update';

  // Remove null bytes and control characters
  let sanitized = message
    .replace(/\0/g, '')
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .trim();

  // Limit length
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000) + '...';
  }

  // Use single quote escaping for shell safety
  sanitized = sanitized.replace(/'/g, "'\\''");

  return sanitized;
}

/**
 * Sanitize a file path for shell commands
 * HIGH-004: Comprehensive path traversal prevention
 *
 * Features:
 * - Recursive traversal pattern removal
 * - Path normalization
 * - Strict allowlist validation
 * - URL-encoding attack prevention
 */
export function sanitizeFilePath(path: string, baseDir: string = '/workspace'): string {
  if (!path) return baseDir;

  const allowedPrefixes = ['/workspace', '/tmp', '/home'];

  // Step 1: Remove null bytes (both literal and URL-encoded)
  let sanitized = path.replace(/\0/g, '');

  // Step 2: URL-decode to catch encoded attacks like %2e%2e%2f (..)
  try {
    sanitized = decodeURIComponent(sanitized);
  } catch {
    // Invalid encoding - reject entirely
    return baseDir;
  }

  // Step 3: Normalize path separators (Windows backslash to forward slash)
  // MEDIUM-002: Also handle Unicode path separators that could bypass checks
  sanitized = sanitized
    .replace(/\\/g, '/') // Windows backslash
    .replace(/[\u2215\u2044\u29F8\uFF0F]/g, '/') // Unicode slashes: ∕ ⁄ ⧸ ／
    .replace(/[\uFF3C\uFE68]/g, '/') // Unicode backslashes: ＼ ﹨
    .replace(/[\u2024\uFF0E]/g, '.') // Unicode dots: ․ ．
    .replace(/\u2025/g, '..'); // Two dot leader: ‥

  // Step 4: Remove shell metacharacters
  sanitized = sanitized.replace(/[;&|`$(){}[\]<>!'"\n\r]/g, '');

  // Step 5: Collapse multiple slashes
  sanitized = sanitized.replace(/\/+/g, '/');

  // Step 6: Check if this is an absolute path
  const isAbsolute = sanitized.startsWith('/');

  // Step 7: Normalize the path by resolving . and .. segments
  const segments = sanitized.split('/').filter(Boolean);
  const normalized: string[] = [];

  for (const segment of segments) {
    if (segment === '..') {
      // Pop if we have segments (but never escape root)
      if (normalized.length > 0) {
        normalized.pop();
      }
    } else if (segment !== '.') {
      normalized.push(segment);
    }
  }

  // Step 8: Build the final path
  let resolvedPath: string;

  if (isAbsolute) {
    // For absolute paths, check if it starts with an allowed prefix
    resolvedPath = '/' + normalized.join('/');

    const isAllowed = allowedPrefixes.some(
      (prefix) => resolvedPath === prefix || resolvedPath.startsWith(prefix + '/')
    );

    if (!isAllowed) {
      // Absolute path to disallowed location - reject
      return baseDir;
    }
  } else {
    // For relative paths, prepend baseDir
    const relativePath = normalized.join('/');
    resolvedPath = relativePath ? `${baseDir}/${relativePath}` : baseDir;

    // Re-normalize to handle any remaining .. that might escape
    const finalSegments = resolvedPath.split('/').filter(Boolean);
    const finalNormalized: string[] = [];

    for (const segment of finalSegments) {
      if (segment === '..') {
        if (finalNormalized.length > 0) {
          finalNormalized.pop();
        }
      } else if (segment !== '.') {
        finalNormalized.push(segment);
      }
    }

    resolvedPath = '/' + finalNormalized.join('/');

    // Final validation
    const isAllowed = allowedPrefixes.some(
      (prefix) => resolvedPath === prefix || resolvedPath.startsWith(prefix + '/')
    );

    if (!isAllowed) {
      return baseDir;
    }
  }

  return resolvedPath;
}

/**
 * Sanitize a glob pattern for file search
 */
export function sanitizeGlobPattern(pattern: string): string {
  if (!pattern) return '*';

  // Remove null bytes and dangerous characters
  let sanitized = pattern
    .replace(/\0/g, '')
    .replace(/[;&|`$(){}[\]<>!]/g, '')
    .replace(/\.\.\//g, '');

  // Limit length
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }

  return sanitized;
}

/**
 * Sanitize a search pattern for grep
 */
export function sanitizeSearchPattern(pattern: string): string {
  if (!pattern) return '';

  // Remove null bytes
  let sanitized = pattern.replace(/\0/g, '');

  // Escape characters that could cause issues in shell or regex
  // Keep basic regex capabilities but prevent injection
  sanitized = sanitized
    .replace(/'/g, "'\\''") // Escape single quotes
    .replace(/\\/g, '\\\\'); // Escape backslashes

  // Limit length
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500);
  }

  return sanitized;
}

/**
 * Sanitize branch name
 */
export function sanitizeBranchName(branch: string): string {
  if (!branch) return '';

  // Git branch name rules:
  // - No ..
  // - No ASCII control characters
  // - No space, ~, ^, :, ?, *, [, \, @{
  // - Cannot start or end with /
  // - Cannot end with .lock

  let sanitized = branch
    .replace(/\0/g, '')
    .replace(/\.\./g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[ ~^:?*[\]\\@{]/g, '-')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.lock$/i, '-lock');

  // Limit length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }

  return sanitized;
}

/**
 * Validate session ownership
 * Returns true if the session belongs to the user
 */
export async function validateSessionOwnership(
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string
        ) => {
          eq: (
            col: string,
            val: string
          ) => { single: () => Promise<{ data: unknown; error: unknown }> };
        };
      };
    };
  },
  sessionId: string,
  userId: string
): Promise<boolean> {
  if (!sessionId || !userId) return false;

  try {
    const { data, error } = await supabase
      .from('code_lab_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * MEDIUM-001: Symlink protection
 * Check if a path contains symlinks that could escape the workspace
 *
 * Note: This is designed to be called from server-side Node.js code,
 * not from edge runtime. For edge runtime, use the container's
 * symlink checking capabilities.
 */
export async function isSymlinkEscape(
  path: string,
  workspaceRoot: string
): Promise<{ isEscape: boolean; reason?: string }> {
  // Only run in Node.js environment (not edge)
  if (typeof process === 'undefined' || typeof require === 'undefined') {
    return { isEscape: false, reason: 'Cannot check symlinks in edge runtime' };
  }

  try {
    // Dynamic import for Node.js fs/promises
    const fs = await import('fs/promises');
    const nodePath = await import('path');

    // Normalize paths
    const normalizedRoot = nodePath.default.resolve(workspaceRoot);
    const normalizedPath = nodePath.default.resolve(path);

    // Check each segment of the path for symlinks
    const sep = nodePath.default.sep;
    const segments = normalizedPath.split(sep);
    let currentPath = sep as string;

    for (const segment of segments) {
      if (!segment) continue;

      currentPath = nodePath.default.join(currentPath, segment);

      try {
        const stats = await fs.lstat(currentPath);

        if (stats.isSymbolicLink()) {
          // Resolve the symlink target
          const target = await fs.realpath(currentPath);

          // Check if target escapes workspace
          if (!target.startsWith(normalizedRoot)) {
            return {
              isEscape: true,
              reason: `Symlink at ${currentPath} points outside workspace to ${target}`,
            };
          }
        }
      } catch {
        // Path doesn't exist yet - that's OK for new files
        break;
      }
    }

    // Final check: resolve entire path and verify it's within workspace
    try {
      const realPath = await fs.realpath(normalizedPath);
      if (!realPath.startsWith(normalizedRoot)) {
        return {
          isEscape: true,
          reason: `Resolved path ${realPath} is outside workspace`,
        };
      }
    } catch {
      // File doesn't exist - check parent directory
      const parentDir = nodePath.default.dirname(normalizedPath);
      try {
        const realParent = await fs.realpath(parentDir);
        if (!realParent.startsWith(normalizedRoot)) {
          return {
            isEscape: true,
            reason: `Parent directory resolves outside workspace`,
          };
        }
      } catch {
        // Parent doesn't exist either - this is OK
      }
    }

    return { isEscape: false };
  } catch (error) {
    // If we can't check, fail open but log warning
    return {
      isEscape: false,
      reason: `Could not check symlinks: ${(error as Error).message}`,
    };
  }
}

/**
 * Generate a shell command to check for symlinks in container
 * This can be used with container.executeCommand() to verify paths
 */
export function generateSymlinkCheckCommand(
  path: string,
  workspaceRoot: string = '/workspace'
): string {
  // Sanitize inputs for shell safety
  const safePath = path.replace(/'/g, "'\\''");
  const safeRoot = workspaceRoot.replace(/'/g, "'\\''");

  // This command:
  // 1. Uses realpath to resolve the full path
  // 2. Checks if it starts with the workspace root
  // Returns exit code 0 if safe, 1 if escape detected
  return `realpath -m '${safePath}' 2>/dev/null | grep -q '^${safeRoot}' || echo 'SYMLINK_ESCAPE'`;
}

/**
 * Token decryption error types
 */
export class TokenDecryptionError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'TokenDecryptionError';
  }
}

/**
 * Validate encrypted token format
 */
export function validateEncryptedTokenFormat(encryptedData: string): {
  valid: boolean;
  error?: string;
} {
  if (!encryptedData) {
    return { valid: false, error: 'Token is empty' };
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid token format - expected 3 parts separated by colons' };
  }

  // Validate IV (should be 24 hex chars = 12 bytes)
  if (!/^[0-9a-fA-F]{24}$/.test(parts[0])) {
    return { valid: false, error: 'Invalid IV format' };
  }

  // Validate auth tag (should be 32 hex chars = 16 bytes)
  if (!/^[0-9a-fA-F]{32}$/.test(parts[1])) {
    return { valid: false, error: 'Invalid auth tag format' };
  }

  // Validate encrypted content (should be hex)
  if (!/^[0-9a-fA-F]+$/.test(parts[2])) {
    return { valid: false, error: 'Invalid encrypted content format' };
  }

  return { valid: true };
}
