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
 * Prevents path traversal and command injection
 */
export function sanitizeFilePath(path: string, baseDir: string = '/workspace'): string {
  if (!path) return baseDir;

  // Remove null bytes
  let sanitized = path.replace(/\0/g, '');

  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, '/');

  // Remove dangerous patterns
  sanitized = sanitized
    .replace(/\.\.\//g, '')  // Path traversal
    .replace(/\.\.$/g, '')   // Trailing ..
    .replace(/^\.\./, '')    // Leading ..
    .replace(/[;&|`$(){}[\]<>!]/g, ''); // Shell metacharacters

  // Ensure path is within base directory
  if (!sanitized.startsWith('/')) {
    sanitized = `${baseDir}/${sanitized}`;
  }

  // Must start with allowed directories
  const allowedPrefixes = ['/workspace', '/tmp', '/home'];
  const isAllowed = allowedPrefixes.some(prefix => sanitized.startsWith(prefix));

  if (!isAllowed) {
    return baseDir;
  }

  return sanitized;
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
    .replace(/'/g, "'\\''")  // Escape single quotes
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
  supabase: { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { eq: (col: string, val: string) => { single: () => Promise<{ data: unknown; error: unknown }> } } } } },
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
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'TokenDecryptionError';
  }
}

/**
 * Validate encrypted token format
 */
export function validateEncryptedTokenFormat(encryptedData: string): { valid: boolean; error?: string } {
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
