/**
 * POSTGREST SECURITY TESTS
 *
 * Tests for PostgREST filter injection prevention
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizePostgrestInput,
  isValidColumnName,
  sanitizeSortOrder,
  buildSearchPattern,
} from './postgrest';

describe('sanitizePostgrestInput', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(sanitizePostgrestInput('')).toBe('');
    expect(sanitizePostgrestInput(null as unknown as string)).toBe('');
    expect(sanitizePostgrestInput(undefined as unknown as string)).toBe('');
  });

  it('passes through safe alphanumeric input', () => {
    expect(sanitizePostgrestInput('hello')).toBe('hello');
    expect(sanitizePostgrestInput('Hello World 123')).toBe('Hello World 123');
    expect(sanitizePostgrestInput('test-search')).toBe('test-search');
  });

  it('removes dots (column access injection)', () => {
    expect(sanitizePostgrestInput('user.admin')).toBe('useradmin');
    expect(sanitizePostgrestInput('table.column.nested')).toBe('tablecolumnnested');
  });

  it('removes commas (OR condition injection)', () => {
    expect(sanitizePostgrestInput('a,b,c')).toBe('abc');
    expect(sanitizePostgrestInput('term1,term2')).toBe('term1term2');
  });

  it('removes parentheses (grouping injection)', () => {
    expect(sanitizePostgrestInput('test(admin)')).toBe('testadmin');
    expect(sanitizePostgrestInput(')(drop table')).toBe('drop table');
  });

  it('removes colons (operator injection)', () => {
    expect(sanitizePostgrestInput('column:eq:value')).toBe('columneqvalue');
    expect(sanitizePostgrestInput('or:and:not')).toBe('orandnot');
  });

  it('removes LIKE wildcards', () => {
    expect(sanitizePostgrestInput('%admin%')).toBe('admin');
    expect(sanitizePostgrestInput('test_value')).toBe('testvalue');
  });

  it('removes boolean operators', () => {
    expect(sanitizePostgrestInput('a&b')).toBe('ab');
    expect(sanitizePostgrestInput('a|b')).toBe('ab');
    expect(sanitizePostgrestInput('!admin')).toBe('admin');
  });

  it('removes comparison operators', () => {
    expect(sanitizePostgrestInput('a=b')).toBe('ab');
    expect(sanitizePostgrestInput('a<b')).toBe('ab');
    expect(sanitizePostgrestInput('a>b')).toBe('ab');
  });

  it('escapes single quotes (SQL injection)', () => {
    expect(sanitizePostgrestInput("O'Brien")).toBe("O''Brien");
    // Semicolons are removed as they're dangerous in PostgREST
    expect(sanitizePostgrestInput("'; DROP TABLE users;--")).toBe("'' DROP TABLE users--");
  });

  it('removes null bytes', () => {
    expect(sanitizePostgrestInput('test\0injection')).toBe('testinjection');
  });

  it('respects maxLength option', () => {
    const longString = 'a'.repeat(200);
    expect(sanitizePostgrestInput(longString).length).toBe(100);
    expect(sanitizePostgrestInput(longString, { maxLength: 50 }).length).toBe(50);
  });

  it('trims whitespace', () => {
    expect(sanitizePostgrestInput('  hello  ')).toBe('hello');
    expect(sanitizePostgrestInput('\n\ttest\n\t')).toBe('test');
  });

  it('removes additional custom characters', () => {
    expect(sanitizePostgrestInput('hello#world', { additionalChars: '#' })).toBe('helloworld');
    expect(sanitizePostgrestInput('test$value', { additionalChars: '$' })).toBe('testvalue');
  });

  it('prevents complex injection attempts', () => {
    // Attempt to break out of filter and add new conditions
    // Underscores are removed as they're LIKE wildcards
    expect(sanitizePostgrestInput('test),is_admin.eq.true,(')).toBe('testisadmineqtrue');

    // Attempt to access other columns
    expect(sanitizePostgrestInput('name.ilike.*,password.neq.')).toBe('nameilikepasswordneq');

    // SQL injection through PostgREST - quotes escaped, equals removed
    expect(sanitizePostgrestInput("' OR '1'='1")).toBe("'' OR ''1''''1");
  });
});

describe('isValidColumnName', () => {
  it('returns false for null/undefined/empty', () => {
    expect(isValidColumnName('')).toBe(false);
    expect(isValidColumnName(null as unknown as string)).toBe(false);
    expect(isValidColumnName(undefined as unknown as string)).toBe(false);
  });

  it('accepts valid column names', () => {
    expect(isValidColumnName('id')).toBe(true);
    expect(isValidColumnName('user_name')).toBe(true);
    expect(isValidColumnName('createdAt')).toBe(true);
    expect(isValidColumnName('column123')).toBe(true);
  });

  it('rejects names starting with numbers', () => {
    expect(isValidColumnName('123column')).toBe(false);
    expect(isValidColumnName('1st_column')).toBe(false);
  });

  it('rejects names with special characters', () => {
    expect(isValidColumnName('column-name')).toBe(false);
    expect(isValidColumnName('column.name')).toBe(false);
    expect(isValidColumnName('column name')).toBe(false);
    expect(isValidColumnName("column'name")).toBe(false);
  });

  it('rejects injection attempts', () => {
    expect(isValidColumnName('column; DROP TABLE')).toBe(false);
    expect(isValidColumnName('column/**/name')).toBe(false);
    expect(isValidColumnName('column->password')).toBe(false);
  });
});

describe('sanitizeSortOrder', () => {
  it('returns default for null/undefined', () => {
    expect(sanitizeSortOrder(null)).toBe('desc');
    expect(sanitizeSortOrder(undefined)).toBe('desc');
    expect(sanitizeSortOrder(null, 'asc')).toBe('asc');
  });

  it('accepts valid sort orders', () => {
    expect(sanitizeSortOrder('asc')).toBe('asc');
    expect(sanitizeSortOrder('desc')).toBe('desc');
  });

  it('normalizes case', () => {
    expect(sanitizeSortOrder('ASC')).toBe('asc');
    expect(sanitizeSortOrder('DESC')).toBe('desc');
    expect(sanitizeSortOrder('Asc')).toBe('asc');
  });

  it('trims whitespace', () => {
    expect(sanitizeSortOrder('  asc  ')).toBe('asc');
    expect(sanitizeSortOrder('\ndesc\n')).toBe('desc');
  });

  it('returns default for invalid values', () => {
    expect(sanitizeSortOrder('ascending')).toBe('desc');
    expect(sanitizeSortOrder('up')).toBe('desc');
    expect(sanitizeSortOrder("'; DROP TABLE")).toBe('desc');
  });
});

describe('buildSearchPattern', () => {
  it('returns empty string for empty input', () => {
    expect(buildSearchPattern('')).toBe('');
    expect(buildSearchPattern('  ')).toBe('');
  });

  it('adds wildcards by default', () => {
    expect(buildSearchPattern('test')).toBe('%test%');
    expect(buildSearchPattern('hello world')).toBe('%hello world%');
  });

  it('respects prefixOnly option', () => {
    expect(buildSearchPattern('test', { prefixOnly: true })).toBe('%test');
  });

  it('respects suffixOnly option', () => {
    expect(buildSearchPattern('test', { suffixOnly: true })).toBe('test%');
  });

  it('sanitizes input before building pattern', () => {
    expect(buildSearchPattern('test.injection')).toBe('%testinjection%');
    expect(buildSearchPattern('test%hack%')).toBe('%testhack%');
  });

  it('respects maxLength', () => {
    const longSearch = 'a'.repeat(200);
    const result = buildSearchPattern(longSearch, { maxLength: 10 });
    expect(result).toBe('%aaaaaaaaaa%');
  });
});
