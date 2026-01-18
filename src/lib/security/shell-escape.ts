/**
 * Shell Escape Utilities
 *
 * Provides secure shell argument escaping to prevent command injection attacks.
 * These functions should be used whenever user input is passed to shell commands.
 *
 * @module security/shell-escape
 */

/**
 * Escapes a string for safe use as a shell argument.
 * Uses single quotes and escapes any internal single quotes.
 *
 * @example
 * escapeShellArg("hello world") // Returns: 'hello world'
 * escapeShellArg("it's here") // Returns: 'it'\''s here'
 * escapeShellArg('test"; rm -rf /') // Returns: 'test"; rm -rf /'
 */
export function escapeShellArg(arg: string): string {
  if (arg === '') {
    return "''";
  }

  // Use single quotes and escape any internal single quotes
  // The pattern 'text'\''more' works because:
  // 1. End the single-quoted string: '
  // 2. Add an escaped single quote: \'
  // 3. Start a new single-quoted string: '
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Escapes multiple arguments for shell use.
 *
 * @example
 * escapeShellArgs(["git", "commit", "-m", "user's message"])
 * // Returns: "'git' 'commit' '-m' 'user'\\''s message'"
 */
export function escapeShellArgs(args: string[]): string {
  return args.map(escapeShellArg).join(' ');
}

/**
 * Sanitizes a git commit message by removing dangerous characters.
 * This is a defense-in-depth measure - escapeShellArg should be the primary protection.
 *
 * Removes:
 * - Backticks (command substitution)
 * - $() and ${} (command/variable substitution)
 * - Shell metacharacters (|, &, ;, <, >, etc.)
 * - Control characters
 *
 * @example
 * sanitizeCommitMessage('Fix bug `whoami`') // Returns: 'Fix bug whoami'
 * sanitizeCommitMessage('Test $(rm -rf /)') // Returns: 'Test rm -rf /'
 */
export function sanitizeCommitMessage(message: string): string {
  return (
    message
      // Remove command substitution patterns
      .replace(/`[^`]*`/g, '') // backticks
      .replace(/\$\([^)]*\)/g, '') // $(...)
      .replace(/\$\{[^}]*\}/g, '') // ${...}
      // Remove shell metacharacters
      .replace(/[|&;<>\\]/g, '')
      // Remove control characters except newlines and tabs
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
      // Limit length
      .slice(0, 1000)
  );
}

/**
 * Sanitizes a git branch name according to git's rules.
 * See: https://git-scm.com/docs/git-check-ref-format
 *
 * Valid branch names:
 * - Cannot start with . or -
 * - Cannot contain .., @{, or consecutive slashes
 * - Cannot end with .lock or /
 * - Cannot contain control characters, space, ~, ^, :, ?, *, [, \
 *
 * @example
 * sanitizeBranchName('feature/my-branch') // Returns: 'feature/my-branch'
 * sanitizeBranchName('../../../etc/passwd') // Returns: 'etc/passwd'
 * sanitizeBranchName('branch; rm -rf /') // Returns: 'branch-rm-rf'
 */
export function sanitizeBranchName(branch: string): string {
  let sanitized = branch
    // Remove dangerous characters
    .replace(/[~^:?*[\]\\@{}\s]/g, '-')
    // Remove shell metacharacters
    .replace(/[|&;<>`$()!]/g, '-')
    // Remove consecutive dots (path traversal)
    .replace(/\.{2,}/g, '.')
    // Remove consecutive slashes
    .replace(/\/{2,}/g, '/')
    // Remove consecutive dashes
    .replace(/-{2,}/g, '-')
    // Remove leading dots, dashes, or slashes
    .replace(/^[.\-/]+/, '')
    // Remove trailing .lock, dots, dashes, or slashes
    .replace(/\.lock$/i, '')
    .replace(/[.\-/]+$/, '');

  // Ensure it's not empty
  if (!sanitized) {
    sanitized = 'branch';
  }

  // Limit length (git has a 255 byte limit for ref names)
  return sanitized.slice(0, 200);
}

/**
 * Sanitizes a file path to prevent path traversal attacks.
 * Removes .. sequences and ensures the path stays within bounds.
 *
 * @example
 * sanitizeFilePath('/workspace/file.txt') // Returns: '/workspace/file.txt'
 * sanitizeFilePath('../../../etc/passwd') // Returns: 'etc/passwd'
 * sanitizeFilePath('/workspace/../../../etc/passwd') // Returns: '/workspace/etc/passwd'
 */
export function sanitizeFilePath(path: string): string {
  // Remove null bytes (can bypass security checks)
  let sanitized = path.replace(/\x00/g, '');

  // Remove shell metacharacters that could be dangerous
  sanitized = sanitized.replace(/[|&;<>`$()!]/g, '');

  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, '/');

  // Remove .. path traversal sequences
  // This is done repeatedly to handle cases like ....//
  let previous = '';
  while (previous !== sanitized) {
    previous = sanitized;
    sanitized = sanitized
      .replace(/\/\.\.\//g, '/') // /../ -> /
      .replace(/\/\.\.$/, '') // trailing /..
      .replace(/^\.\.\//g, '') // leading ../
      .replace(/^\.\.$/g, ''); // just ..
  }

  // Remove consecutive slashes
  sanitized = sanitized.replace(/\/{2,}/g, '/');

  return sanitized;
}

/**
 * Validates that a command is in the allowed list.
 * Used as an additional layer of defense.
 *
 * @example
 * isAllowedCommand('git', ['git', 'npm', 'node']) // Returns: true
 * isAllowedCommand('rm', ['git', 'npm', 'node']) // Returns: false
 */
export function isAllowedCommand(command: string, allowedCommands: string[]): boolean {
  // Extract the base command (first word, handle paths)
  const baseCommand = command.trim().split(/\s+/)[0];
  const commandName = baseCommand.split('/').pop() || baseCommand;

  return allowedCommands.includes(commandName.toLowerCase());
}

/**
 * Validates an environment variable name.
 * Only allows alphanumeric characters and underscores.
 *
 * @example
 * isValidEnvName('NODE_ENV') // Returns: true
 * isValidEnvName('LD_PRELOAD') // Returns: true (but should be blocked separately)
 * isValidEnvName('FOO=bar') // Returns: false
 */
export function isValidEnvName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

/**
 * List of dangerous environment variables that should never be set by users.
 */
export const DANGEROUS_ENV_VARS = [
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'DYLD_INSERT_LIBRARIES',
  'DYLD_LIBRARY_PATH',
  'PATH', // Could redirect to malicious binaries
  'HOME', // Could affect config file loading
  'SHELL', // Could change shell behavior
  'IFS', // Internal Field Separator - can break scripts
  'ENV', // Executed by shells on startup
  'BASH_ENV', // Executed by bash on startup
  'CDPATH', // Can redirect cd commands
  'GLOBIGNORE', // Can affect glob behavior
  'PROMPT_COMMAND', // Executed before each prompt
  'PS1', // Can contain command substitution
  'PS2',
  'PS3',
  'PS4',
];

/**
 * Validates that an environment variable is safe to set.
 */
export function isSafeEnvVar(name: string, value: string): boolean {
  // Check name validity
  if (!isValidEnvName(name)) {
    return false;
  }

  // Check against dangerous list
  if (DANGEROUS_ENV_VARS.includes(name.toUpperCase())) {
    return false;
  }

  // Check value doesn't contain command substitution
  if (/`|\$\(|\$\{/.test(value)) {
    return false;
  }

  return true;
}

/**
 * Filters environment variables to only include safe ones.
 */
export function filterSafeEnvVars(envVars: Record<string, string>): Record<string, string> {
  const safe: Record<string, string> = {};

  for (const [name, value] of Object.entries(envVars)) {
    if (isSafeEnvVar(name, value)) {
      safe[name] = value;
    }
  }

  return safe;
}
