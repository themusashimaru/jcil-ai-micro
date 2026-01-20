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
  sanitized = sanitized.replace(/\\/g, '/');

  // Step 4: Remove shell metacharacters
  sanitized = sanitized.replace(/[;&|`$(){}[\]<>!'"\n\r]/g, '');

  // Step 5: Recursively remove path traversal patterns until none remain
  // This handles patterns like "....//", "./..", "...", etc.
  let prevLength = 0;
  while (sanitized.length !== prevLength) {
    prevLength = sanitized.length;
    sanitized = sanitized
      .replace(/\.{2,}\//g, '') // Two or more dots followed by slash
      .replace(/\/\.{2,}/g, '/') // Slash followed by two or more dots
      .replace(/^\.{2,}/g, '') // Leading dots
      .replace(/\.{2,}$/g, '') // Trailing dots
      .replace(/\/\.\//g, '/') // /./ -> /
      .replace(/\/+/g, '/'); // Collapse multiple slashes
  }

  // Step 6: Remove leading slashes and dots
  sanitized = sanitized.replace(/^[.\/]+/, '');

  // Step 7: Construct full path within base directory
  const fullPath = sanitized ? `${baseDir}/${sanitized}`.replace(/\/+/g, '/') : baseDir;

  // Step 8: Normalize the path by resolving . and .. segments
  // Use a simple algorithm since we can't use path.resolve in edge runtime
  const segments = fullPath.split('/').filter(Boolean);
  const normalized: string[] = [];

  for (const segment of segments) {
    if (segment === '..') {
      // Only pop if we have something and it's not the base
      if (normalized.length > 0) {
        normalized.pop();
      }
    } else if (segment !== '.') {
      normalized.push(segment);
    }
  }

  const resolvedPath = '/' + normalized.join('/');

  // Step 9: Final validation - must start with allowed prefix
  const allowedPrefixes = ['/workspace', '/tmp', '/home'];
  const isAllowed = allowedPrefixes.some(
    (prefix) => resolvedPath === prefix || resolvedPath.startsWith(prefix + '/')
  );

  if (!isAllowed) {
    return baseDir;
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
