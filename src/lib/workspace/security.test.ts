import { describe, it, expect } from 'vitest';
import {
  sanitizeShellArg,
  sanitizeCommitMessage,
  sanitizeFilePath,
  sanitizeGlobPattern,
  sanitizeSearchPattern,
  sanitizeBranchName,
  validateEncryptedTokenFormat,
  generateSymlinkCheckCommand,
  TokenDecryptionError,
  validateSessionOwnership,
} from './security';

// -------------------------------------------------------------------
// sanitizeShellArg
// -------------------------------------------------------------------
describe('sanitizeShellArg', () => {
  it('should return empty string for empty input', () => {
    expect(sanitizeShellArg('')).toBe('');
  });

  it('should wrap safe input in single quotes', () => {
    expect(sanitizeShellArg('hello')).toBe("'hello'");
  });

  it('should escape single quotes', () => {
    expect(sanitizeShellArg("it's")).toBe("'it'\\''s'");
  });

  it('should remove null bytes', () => {
    expect(sanitizeShellArg('test\0null')).toBe("'testnull'");
  });

  it('should neutralize shell metacharacters via quoting', () => {
    const dangerous = 'hello; rm -rf /';
    const result = sanitizeShellArg(dangerous);
    expect(result).toBe("'hello; rm -rf /'");
  });

  it('should handle backtick command substitution', () => {
    const result = sanitizeShellArg('`whoami`');
    expect(result).toBe("'`whoami`'");
  });

  it('should handle dollar sign expansion', () => {
    const result = sanitizeShellArg('$HOME');
    expect(result).toBe("'$HOME'");
  });
});

// -------------------------------------------------------------------
// sanitizeCommitMessage
// -------------------------------------------------------------------
describe('sanitizeCommitMessage', () => {
  it('should return "Update" for empty input', () => {
    expect(sanitizeCommitMessage('')).toBe('Update');
  });

  it('should pass through normal messages', () => {
    expect(sanitizeCommitMessage('Fix bug in login')).toBe('Fix bug in login');
  });

  it('should remove null bytes', () => {
    expect(sanitizeCommitMessage('test\0msg')).toBe('testmsg');
  });

  it('should replace control characters with spaces', () => {
    expect(sanitizeCommitMessage('line1\nline2\ttab')).toBe('line1 line2 tab');
  });

  it('should truncate long messages', () => {
    const longMsg = 'a'.repeat(2000);
    const result = sanitizeCommitMessage(longMsg);
    expect(result.length).toBeLessThanOrEqual(1003); // 1000 + '...'
  });

  it('should escape single quotes', () => {
    expect(sanitizeCommitMessage("can't stop")).toBe("can'\\''t stop");
  });

  it('should trim whitespace', () => {
    expect(sanitizeCommitMessage('  hello  ')).toBe('hello');
  });
});

// -------------------------------------------------------------------
// sanitizeFilePath
// -------------------------------------------------------------------
describe('sanitizeFilePath', () => {
  it('should return baseDir for empty input', () => {
    expect(sanitizeFilePath('')).toBe('/workspace');
  });

  it('should allow paths under /workspace', () => {
    expect(sanitizeFilePath('/workspace/file.ts')).toBe('/workspace/file.ts');
  });

  it('should allow paths under /tmp', () => {
    expect(sanitizeFilePath('/tmp/test.txt')).toBe('/tmp/test.txt');
  });

  it('should allow paths under /home', () => {
    expect(sanitizeFilePath('/home/user/file')).toBe('/home/user/file');
  });

  it('should reject paths to /etc', () => {
    expect(sanitizeFilePath('/etc/passwd')).toBe('/workspace');
  });

  it('should prevent path traversal with ..', () => {
    expect(sanitizeFilePath('/workspace/../etc/passwd')).toBe('/workspace');
  });

  it('should prevent deep path traversal', () => {
    expect(sanitizeFilePath('/workspace/../../../../etc/shadow')).toBe('/workspace');
  });

  it('should handle relative paths by prepending baseDir', () => {
    expect(sanitizeFilePath('src/file.ts')).toBe('/workspace/src/file.ts');
  });

  it('should prevent relative path traversal', () => {
    // ../../etc/passwd resolves to /workspace/etc/passwd (.. can't escape past root)
    const result = sanitizeFilePath('../../etc/passwd');
    expect(result).toBe('/workspace/etc/passwd');
  });

  it('should remove shell metacharacters', () => {
    expect(sanitizeFilePath('/workspace/$(whoami)/file')).toBe('/workspace/whoami/file');
  });

  it('should remove backticks', () => {
    expect(sanitizeFilePath('/workspace/`id`/file')).toBe('/workspace/id/file');
  });

  it('should collapse multiple slashes', () => {
    expect(sanitizeFilePath('/workspace///file')).toBe('/workspace/file');
  });

  it('should normalize Windows backslashes', () => {
    expect(sanitizeFilePath('/workspace\\file\\test')).toBe('/workspace/file/test');
  });

  it('should handle URL-encoded traversal attacks', () => {
    // %2e%2e = ..
    const result = sanitizeFilePath('/workspace/%2e%2e/etc/passwd');
    expect(result).toBe('/workspace');
  });

  it('should handle Unicode path separator attacks', () => {
    // Unicode slash ／ (U+FF0F) should be normalized
    const result = sanitizeFilePath('/workspace\uFF0F..\uFF0Fetc');
    expect(result).not.toContain('etc');
  });

  it('should handle Unicode dot attacks', () => {
    // Unicode dots should be normalized
    const result = sanitizeFilePath('/workspace/\uFF0E\uFF0E/etc');
    expect(result).toBe('/workspace');
  });

  it('should use custom baseDir', () => {
    expect(sanitizeFilePath('file.ts', '/tmp')).toBe('/tmp/file.ts');
  });

  it('should remove null bytes', () => {
    expect(sanitizeFilePath('/workspace/file\0.ts')).toBe('/workspace/file.ts');
  });

  it('should handle . (current directory) segments', () => {
    expect(sanitizeFilePath('/workspace/./file.ts')).toBe('/workspace/file.ts');
  });
});

// -------------------------------------------------------------------
// sanitizeGlobPattern
// -------------------------------------------------------------------
describe('sanitizeGlobPattern', () => {
  it('should return * for empty input', () => {
    expect(sanitizeGlobPattern('')).toBe('*');
  });

  it('should pass through safe glob patterns', () => {
    expect(sanitizeGlobPattern('*.ts')).toBe('*.ts');
    expect(sanitizeGlobPattern('**/*.tsx')).toBe('**/*.tsx');
  });

  it('should remove shell injection characters', () => {
    expect(sanitizeGlobPattern('*.ts; rm -rf /')).toBe('*.ts rm -rf /');
  });

  it('should remove path traversal', () => {
    expect(sanitizeGlobPattern('../*.ts')).toBe('*.ts');
  });

  it('should truncate long patterns', () => {
    const longPattern = 'a'.repeat(300);
    expect(sanitizeGlobPattern(longPattern)).toHaveLength(200);
  });

  it('should remove null bytes', () => {
    expect(sanitizeGlobPattern('*.ts\0')).toBe('*.ts');
  });
});

// -------------------------------------------------------------------
// sanitizeSearchPattern
// -------------------------------------------------------------------
describe('sanitizeSearchPattern', () => {
  it('should return empty string for empty input', () => {
    expect(sanitizeSearchPattern('')).toBe('');
  });

  it('should pass through safe patterns', () => {
    expect(sanitizeSearchPattern('hello')).toBe('hello');
  });

  it('should escape single quotes', () => {
    // The function replaces ' with '\'' (shell quote escaping)
    // then replaces \ with \\ (backslash escaping)
    // So the result is: it'\''s → it'\\''s
    const result = sanitizeSearchPattern("it's");
    expect(result).toContain('it');
    expect(result).toContain('s');
    // Verify dangerous single quote is escaped
    expect(result).not.toBe("it's");
  });

  it('should escape backslashes', () => {
    expect(sanitizeSearchPattern('path\\to')).toBe('path\\\\to');
  });

  it('should remove null bytes', () => {
    expect(sanitizeSearchPattern('test\0null')).toBe('testnull');
  });

  it('should truncate long patterns', () => {
    const longPattern = 'a'.repeat(600);
    expect(sanitizeSearchPattern(longPattern)).toHaveLength(500);
  });
});

// -------------------------------------------------------------------
// sanitizeBranchName
// -------------------------------------------------------------------
describe('sanitizeBranchName', () => {
  it('should return empty string for empty input', () => {
    expect(sanitizeBranchName('')).toBe('');
  });

  it('should pass through valid branch names', () => {
    expect(sanitizeBranchName('feature/login')).toBe('feature/login');
    expect(sanitizeBranchName('main')).toBe('main');
  });

  it('should remove double dots', () => {
    expect(sanitizeBranchName('branch..name')).toBe('branchname');
  });

  it('should replace spaces with hyphens', () => {
    expect(sanitizeBranchName('my branch')).toBe('my-branch');
  });

  it('should replace tilde, caret, colon', () => {
    expect(sanitizeBranchName('branch~1')).toBe('branch-1');
    expect(sanitizeBranchName('branch^2')).toBe('branch-2');
    expect(sanitizeBranchName('branch:name')).toBe('branch-name');
  });

  it('should replace question mark and asterisk', () => {
    expect(sanitizeBranchName('branch?')).toBe('branch-');
    expect(sanitizeBranchName('branch*')).toBe('branch-');
  });

  it('should remove leading/trailing slashes', () => {
    expect(sanitizeBranchName('/branch/')).toBe('branch');
  });

  it('should replace .lock suffix', () => {
    expect(sanitizeBranchName('branch.lock')).toBe('branch-lock');
  });

  it('should truncate long names', () => {
    const longName = 'a'.repeat(200);
    expect(sanitizeBranchName(longName)).toHaveLength(100);
  });

  it('should remove control characters', () => {
    expect(sanitizeBranchName('branch\x01name')).toBe('branchname');
  });

  it('should remove null bytes', () => {
    expect(sanitizeBranchName('branch\0name')).toBe('branchname');
  });
});

// -------------------------------------------------------------------
// validateEncryptedTokenFormat
// -------------------------------------------------------------------
describe('validateEncryptedTokenFormat', () => {
  it('should reject empty token', () => {
    const result = validateEncryptedTokenFormat('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('should accept valid format', () => {
    const validIV = 'a'.repeat(24);
    const validAuthTag = 'b'.repeat(32);
    const validContent = 'c'.repeat(64);
    const result = validateEncryptedTokenFormat(`${validIV}:${validAuthTag}:${validContent}`);
    expect(result.valid).toBe(true);
  });

  it('should reject format with wrong number of parts', () => {
    const result = validateEncryptedTokenFormat('part1:part2');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('3 parts');
  });

  it('should reject format with 4 parts', () => {
    const result = validateEncryptedTokenFormat('a:b:c:d');
    expect(result.valid).toBe(false);
  });

  it('should reject invalid IV length', () => {
    const result = validateEncryptedTokenFormat('abc:' + 'b'.repeat(32) + ':' + 'c'.repeat(64));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('IV');
  });

  it('should reject invalid auth tag length', () => {
    const result = validateEncryptedTokenFormat('a'.repeat(24) + ':abc:' + 'c'.repeat(64));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('auth tag');
  });

  it('should reject non-hex IV', () => {
    const result = validateEncryptedTokenFormat(
      'zzzzzzzzzzzzzzzzzzzzzzzz:' + 'b'.repeat(32) + ':' + 'c'.repeat(64)
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('IV');
  });

  it('should reject non-hex content', () => {
    const result = validateEncryptedTokenFormat(
      'a'.repeat(24) + ':' + 'b'.repeat(32) + ':not-hex!'
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('content');
  });

  it('should accept mixed case hex', () => {
    const result = validateEncryptedTokenFormat(
      'aAbBcCdDeEfF112233445566:' + 'aAbBcCdDeEfF11223344556677889900:' + 'ff00'
    );
    expect(result.valid).toBe(true);
  });
});

// -------------------------------------------------------------------
// generateSymlinkCheckCommand
// -------------------------------------------------------------------
describe('generateSymlinkCheckCommand', () => {
  it('should generate a valid check command', () => {
    const cmd = generateSymlinkCheckCommand('/workspace/file.ts');
    expect(cmd).toContain('realpath');
    expect(cmd).toContain('/workspace/file.ts');
    expect(cmd).toContain('SYMLINK_ESCAPE');
  });

  it('should use custom workspace root', () => {
    const cmd = generateSymlinkCheckCommand('/tmp/file.ts', '/tmp');
    expect(cmd).toContain('/tmp');
  });

  it('should escape single quotes in path', () => {
    const cmd = generateSymlinkCheckCommand("/workspace/it's a file");
    expect(cmd).toContain("\\'");
  });
});

// -------------------------------------------------------------------
// TokenDecryptionError
// -------------------------------------------------------------------
describe('TokenDecryptionError', () => {
  it('should create error with message and code', () => {
    const err = new TokenDecryptionError('Token expired', 'EXPIRED');
    expect(err.message).toBe('Token expired');
    expect(err.code).toBe('EXPIRED');
    expect(err.name).toBe('TokenDecryptionError');
  });

  it('should be instanceof Error', () => {
    const err = new TokenDecryptionError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });
});

// -------------------------------------------------------------------
// validateSessionOwnership
// -------------------------------------------------------------------
describe('validateSessionOwnership', () => {
  it('should return false for empty sessionId', async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ single: async () => ({ data: {}, error: null }) }) }),
        }),
      }),
    };
    expect(await validateSessionOwnership(mockSupabase, '', 'user-1')).toBe(false);
  });

  it('should return false for empty userId', async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ single: async () => ({ data: {}, error: null }) }) }),
        }),
      }),
    };
    expect(await validateSessionOwnership(mockSupabase, 'session-1', '')).toBe(false);
  });

  it('should return true when session belongs to user', async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({ data: { id: 'session-1' }, error: null }),
            }),
          }),
        }),
      }),
    };
    expect(await validateSessionOwnership(mockSupabase, 'session-1', 'user-1')).toBe(true);
  });

  it('should return false when query returns error', async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      }),
    };
    expect(await validateSessionOwnership(mockSupabase, 'session-1', 'user-1')).toBe(false);
  });

  it('should return false when query throws', async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => {
                throw new Error('DB error');
              },
            }),
          }),
        }),
      }),
    };
    expect(await validateSessionOwnership(mockSupabase, 'session-1', 'user-1')).toBe(false);
  });
});
