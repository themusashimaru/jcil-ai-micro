/**
 * VALIDATION UTILITY TESTS
 *
 * Critical path tests for input validation functions
 * These protect against injection attacks and DoS
 */

import { describe, it, expect } from 'vitest';
import {
  safeParseInt,
  validatePositiveInt,
  isPathSafe,
  validateQueryLimit,
} from './validation';

describe('safeParseInt', () => {
  it('returns default for null/undefined/empty', () => {
    expect(safeParseInt(null, { default: 10 })).toBe(10);
    expect(safeParseInt(undefined, { default: 10 })).toBe(10);
    expect(safeParseInt('', { default: 10 })).toBe(10);
  });

  it('parses valid integers', () => {
    expect(safeParseInt('42', { default: 10 })).toBe(42);
    expect(safeParseInt('0', { default: 10 })).toBe(0);
    expect(safeParseInt('-5', { default: 10 })).toBe(-5);
  });

  it('returns default for non-numeric strings', () => {
    expect(safeParseInt('abc', { default: 10 })).toBe(10);
    expect(safeParseInt('10; DROP TABLE users;', { default: 10 })).toBe(10);
    expect(safeParseInt('NaN', { default: 10 })).toBe(10);
    expect(safeParseInt('Infinity', { default: 10 })).toBe(10);
  });

  it('respects min/max bounds', () => {
    expect(safeParseInt('5', { default: 10, min: 10 })).toBe(10);
    expect(safeParseInt('200', { default: 10, max: 100 })).toBe(100);
    expect(safeParseInt('50', { default: 10, min: 1, max: 100 })).toBe(50);
  });

  it('prevents command injection via numeric strings', () => {
    // These should all return default because they're not valid integers
    expect(safeParseInt('10`rm -rf`', { default: 10 })).toBe(10);
    expect(safeParseInt('10$(whoami)', { default: 10 })).toBe(10);
    expect(safeParseInt('10|cat /etc/passwd', { default: 10 })).toBe(10);
  });
});

describe('validatePositiveInt', () => {
  it('returns valid for proper positive integers', () => {
    const result = validatePositiveInt('25', { name: 'count', default: 10 });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(25);
  });

  it('returns default for null/undefined/empty', () => {
    const result = validatePositiveInt(null, { name: 'count', default: 10 });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(10);
  });

  it('rejects non-numeric strings', () => {
    const result = validatePositiveInt('abc', { name: 'count', default: 10 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('must be a positive integer');
  });

  it('rejects negative numbers', () => {
    const result = validatePositiveInt('-5', { name: 'count', default: 10 });
    expect(result.valid).toBe(false);
  });

  it('rejects values exceeding max', () => {
    const result = validatePositiveInt('200', { name: 'count', default: 10, max: 100 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('exceeds maximum');
  });

  it('rejects injection attempts', () => {
    // SQL injection
    expect(validatePositiveInt("10' OR '1'='1", { name: 'count', default: 10 }).valid).toBe(false);
    // Command injection
    expect(validatePositiveInt('10; ls', { name: 'count', default: 10 }).valid).toBe(false);
    // LDAP injection
    expect(validatePositiveInt('10)(|(', { name: 'count', default: 10 }).valid).toBe(false);
  });
});

describe('isPathSafe', () => {
  it('allows safe paths', () => {
    expect(isPathSafe('/workspace/src/index.ts')).toBe(true);
    expect(isPathSafe('/home/user/project/file.js')).toBe(true);
    expect(isPathSafe('relative/path/file.txt')).toBe(true);
  });

  it('blocks path traversal', () => {
    expect(isPathSafe('../../../etc/passwd')).toBe(false);
    expect(isPathSafe('/workspace/../../../etc/shadow')).toBe(false);
    expect(isPathSafe('..\\..\\windows\\system32')).toBe(false);
  });

  it('blocks null bytes', () => {
    expect(isPathSafe('/workspace/file.txt\0.jpg')).toBe(false);
  });

  it('blocks shell metacharacters', () => {
    expect(isPathSafe('/workspace/$(whoami)')).toBe(false);
    expect(isPathSafe('/workspace/`id`')).toBe(false);
    expect(isPathSafe('/workspace/file;rm -rf /')).toBe(false);
    expect(isPathSafe('/workspace/file|cat /etc/passwd')).toBe(false);
  });

  it('returns false for empty paths', () => {
    expect(isPathSafe('')).toBe(false);
  });
});

describe('validateQueryLimit', () => {
  it('returns default for null/undefined', () => {
    expect(validateQueryLimit(null)).toBe(50);
    expect(validateQueryLimit(undefined)).toBe(50);
  });

  it('respects custom defaults', () => {
    expect(validateQueryLimit(null, { default: 20 })).toBe(20);
  });

  it('clamps to max', () => {
    expect(validateQueryLimit('500', { max: 100 })).toBe(100);
  });

  it('ensures minimum of 1', () => {
    expect(validateQueryLimit('0')).toBe(1);
    expect(validateQueryLimit('-10')).toBe(1);
  });

  it('prevents DoS via large limits', () => {
    // Even with injection attempts, should clamp to reasonable max
    expect(validateQueryLimit('999999999', { max: 200 })).toBe(200);
  });
});
