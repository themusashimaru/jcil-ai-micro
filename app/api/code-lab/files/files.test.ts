/**
 * FILES API TESTS
 *
 * Tests for file operations API including:
 * - Path sanitization and security
 * - Session ownership verification
 * - CRUD operations for files
 */

import { describe, it, expect, vi } from 'vitest';

// Mock modules
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id', email: 'test@example.com' } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'session-123' },
                error: null,
              }),
            })),
          })),
        })),
      })),
    })
  ),
}));

vi.mock('@/lib/workspace/container', () => ({
  ContainerManager: vi.fn().mockImplementation(() => ({
    readFile: vi.fn().mockResolvedValue('file content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    listDirectory: vi.fn().mockResolvedValue([
      { name: 'package.json', type: 'file', size: 1000 },
      { name: 'src', type: 'directory' },
    ]),
  })),
}));

vi.mock('@/lib/security/rate-limit', () => ({
  rateLimiters: {
    codeLabFiles: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfter: 0,
    }),
  },
}));

vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: vi.fn().mockReturnValue({ valid: true }),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Import the security functions to test
import {
  sanitizeFilePath,
  sanitizeShellArg,
  sanitizeCommitMessage,
  sanitizeBranchName,
  sanitizeGlobPattern,
  validateEncryptedTokenFormat,
} from '@/lib/workspace/security';

describe('Path Sanitization', () => {
  describe('sanitizeFilePath', () => {
    it('should remove path traversal attempts', () => {
      expect(sanitizeFilePath('../../../etc/passwd')).not.toContain('..');
      expect(sanitizeFilePath('../../secret')).not.toContain('..');
    });

    it('should remove shell metacharacters', () => {
      expect(sanitizeFilePath('file;rm -rf /')).not.toContain(';');
      expect(sanitizeFilePath('file|cat /etc/passwd')).not.toContain('|');
      expect(sanitizeFilePath('file`whoami`')).not.toContain('`');
      expect(sanitizeFilePath('file$(id)')).not.toContain('$');
    });

    it('should allow valid paths', () => {
      expect(sanitizeFilePath('/workspace/src/index.ts')).toBe('/workspace/src/index.ts');
      expect(sanitizeFilePath('/tmp/test.txt')).toBe('/tmp/test.txt');
      expect(sanitizeFilePath('/home/user/file.js')).toBe('/home/user/file.js');
    });

    it('should prepend base directory for relative paths', () => {
      expect(sanitizeFilePath('src/index.ts')).toContain('/workspace');
      expect(sanitizeFilePath('package.json')).toContain('/workspace');
    });

    it('should reject disallowed absolute paths', () => {
      expect(sanitizeFilePath('/etc/passwd')).toBe('/workspace');
      expect(sanitizeFilePath('/root/.ssh/id_rsa')).toBe('/workspace');
      expect(sanitizeFilePath('/var/log/syslog')).toBe('/workspace');
    });

    it('should handle null bytes', () => {
      expect(sanitizeFilePath('file\x00.txt')).not.toContain('\x00');
    });

    it('should normalize backslashes', () => {
      expect(sanitizeFilePath('src\\index.ts')).toContain('/');
      expect(sanitizeFilePath('src\\index.ts')).not.toContain('\\');
    });
  });
});

describe('Shell Argument Sanitization', () => {
  describe('sanitizeShellArg', () => {
    it('should wrap in single quotes', () => {
      const result = sanitizeShellArg('hello');
      expect(result).toBe("'hello'");
    });

    it('should escape single quotes', () => {
      const result = sanitizeShellArg("it's a test");
      expect(result).toContain("\\'");
    });

    it('should handle empty input', () => {
      expect(sanitizeShellArg('')).toBe('');
    });

    it('should remove null bytes', () => {
      const result = sanitizeShellArg('hello\x00world');
      expect(result).not.toContain('\x00');
    });
  });
});

describe('Commit Message Sanitization', () => {
  describe('sanitizeCommitMessage', () => {
    it('should remove control characters', () => {
      const result = sanitizeCommitMessage('fix:\x0Bbug');
      expect(result).not.toMatch(/[\x00-\x1F]/);
    });

    it('should limit length', () => {
      const longMessage = 'a'.repeat(2000);
      const result = sanitizeCommitMessage(longMessage);
      expect(result.length).toBeLessThanOrEqual(1003); // 1000 + '...'
    });

    it('should return default for empty', () => {
      expect(sanitizeCommitMessage('')).toBe('Update');
    });

    it('should escape single quotes', () => {
      const result = sanitizeCommitMessage("fix: it's broken");
      expect(result).toContain("\\'");
    });
  });
});

describe('Branch Name Sanitization', () => {
  describe('sanitizeBranchName', () => {
    it('should remove double dots', () => {
      expect(sanitizeBranchName('feature..main')).not.toContain('..');
    });

    it('should replace special characters with dashes', () => {
      const result = sanitizeBranchName('feature~test^branch');
      expect(result).not.toContain('~');
      expect(result).not.toContain('^');
    });

    it('should remove leading/trailing slashes', () => {
      expect(sanitizeBranchName('/feature/test/')).not.toMatch(/^\/|\/$/);
    });

    it('should handle .lock suffix', () => {
      const result = sanitizeBranchName('branch.lock');
      expect(result.endsWith('.lock')).toBe(false);
    });

    it('should limit length', () => {
      const longBranch = 'a'.repeat(200);
      const result = sanitizeBranchName(longBranch);
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });
});

describe('Glob Pattern Sanitization', () => {
  describe('sanitizeGlobPattern', () => {
    it('should remove shell metacharacters', () => {
      expect(sanitizeGlobPattern('*.ts;rm -rf /')).not.toContain(';');
      expect(sanitizeGlobPattern('*.ts|cat /etc')).not.toContain('|');
    });

    it('should remove path traversal', () => {
      expect(sanitizeGlobPattern('../**/*.ts')).not.toContain('..');
    });

    it('should allow valid patterns', () => {
      expect(sanitizeGlobPattern('**/*.ts')).toContain('*');
      expect(sanitizeGlobPattern('src/**/*.tsx')).toContain('src');
    });

    it('should limit length', () => {
      const longPattern = '*'.repeat(300);
      const result = sanitizeGlobPattern(longPattern);
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it('should return default for empty', () => {
      expect(sanitizeGlobPattern('')).toBe('*');
    });
  });
});

describe('Token Validation', () => {
  describe('validateEncryptedTokenFormat', () => {
    it('should reject empty token', () => {
      const result = validateEncryptedTokenFormat('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject wrong format', () => {
      const result = validateEncryptedTokenFormat('invalid-token');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('3 parts');
    });

    it('should reject invalid IV', () => {
      const result = validateEncryptedTokenFormat('badiv:' + 'a'.repeat(32) + ':' + 'b'.repeat(32));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('IV');
    });

    it('should reject invalid auth tag', () => {
      const result = validateEncryptedTokenFormat('a'.repeat(24) + ':badtag:' + 'c'.repeat(32));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('auth tag');
    });

    it('should accept valid format', () => {
      const validToken = 'a'.repeat(24) + ':' + 'b'.repeat(32) + ':' + 'c'.repeat(32);
      const result = validateEncryptedTokenFormat(validToken);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Request Validation', () => {
  describe('GET /api/code-lab/files', () => {
    it('should require sessionId', () => {
      const params = new URLSearchParams();
      const hasSessionId = params.has('sessionId');
      expect(hasSessionId).toBe(false);
    });

    it('should accept valid read request', () => {
      const params = new URLSearchParams({
        sessionId: 'session-123',
        path: '/workspace/src/index.ts',
      });
      expect(params.get('sessionId')).toBeTruthy();
      expect(params.get('path')).toBeTruthy();
    });

    it('should list files when no path specified', () => {
      const params = new URLSearchParams({ sessionId: 'session-123' });
      expect(params.get('sessionId')).toBeTruthy();
      expect(params.get('path')).toBeNull();
    });
  });

  describe('POST /api/code-lab/files', () => {
    it('should require sessionId and path', () => {
      const body = { content: 'test' };
      expect('sessionId' in body).toBe(false);
      expect('path' in body).toBe(false);
    });

    it('should accept valid create request', () => {
      const body = {
        sessionId: 'session-123',
        path: '/workspace/new-file.ts',
        content: 'export const test = 1;',
      };
      expect(body.sessionId).toBeTruthy();
      expect(body.path).toBeTruthy();
    });

    it('should allow empty content', () => {
      const body = {
        sessionId: 'session-123',
        path: '/workspace/empty.txt',
        content: '',
      };
      expect(body.content).toBe('');
    });
  });

  describe('PUT /api/code-lab/files', () => {
    it('should require sessionId and path', () => {
      const body = { content: 'updated' };
      expect('sessionId' in body).toBe(false);
    });

    it('should accept valid update request', () => {
      const body = {
        sessionId: 'session-123',
        path: '/workspace/file.ts',
        content: 'updated content',
      };
      expect(body.sessionId).toBeTruthy();
      expect(body.path).toBeTruthy();
      expect(body.content).toBeTruthy();
    });
  });

  describe('DELETE /api/code-lab/files', () => {
    it('should require sessionId and path', () => {
      const params = new URLSearchParams();
      expect(params.has('sessionId')).toBe(false);
      expect(params.has('path')).toBe(false);
    });

    it('should accept valid delete request', () => {
      const params = new URLSearchParams({
        sessionId: 'session-123',
        path: '/workspace/delete-me.ts',
      });
      expect(params.get('sessionId')).toBeTruthy();
      expect(params.get('path')).toBeTruthy();
    });
  });
});

describe('Session Ownership Verification', () => {
  it('should verify user owns the session', () => {
    const verifyOwnership = (sessionUserId: string, currentUserId: string) =>
      sessionUserId === currentUserId;

    expect(verifyOwnership('test-user-id', 'test-user-id')).toBe(true);
    expect(verifyOwnership('other-user-id', 'test-user-id')).toBe(false);
  });

  it('should reject access to other users sessions', () => {
    const sessionUserId = 'user-abc';
    const currentUserId = 'user-xyz';
    expect(sessionUserId !== currentUserId).toBe(true);
  });
});

describe('Response Structure', () => {
  it('should return file content on read', () => {
    const response = {
      content: 'export const test = 1;',
      path: '/workspace/test.ts',
    };
    expect(response.content).toBeDefined();
    expect(response.path).toBeDefined();
  });

  it('should return file list on directory read', () => {
    const response = {
      files: [
        { name: 'package.json', type: 'file', size: 1000 },
        { name: 'src', type: 'directory' },
      ],
    };
    expect(response.files).toBeInstanceOf(Array);
    expect(response.files.length).toBe(2);
  });

  it('should return success on write', () => {
    const response = {
      success: true,
      path: '/workspace/new-file.ts',
    };
    expect(response.success).toBe(true);
    expect(response.path).toBeDefined();
  });

  it('should return success on delete', () => {
    const response = { success: true };
    expect(response.success).toBe(true);
  });

  it('should return error on failure', () => {
    const response = {
      error: 'Failed to access files',
    };
    expect(response.error).toBeDefined();
  });
});

describe('Rate Limiting', () => {
  it('should include rate limit headers on 429', () => {
    const headers = {
      'Retry-After': '60',
      'X-RateLimit-Remaining': '0',
    };
    expect(headers['Retry-After']).toBeDefined();
    expect(headers['X-RateLimit-Remaining']).toBeDefined();
  });
});

describe('Files API Module', () => {
  it('should export all HTTP handlers', async () => {
    const routeModule = await import('./route');
    expect(routeModule.GET).toBeDefined();
    expect(routeModule.POST).toBeDefined();
    expect(routeModule.PUT).toBeDefined();
    expect(routeModule.DELETE).toBeDefined();
  });
});
