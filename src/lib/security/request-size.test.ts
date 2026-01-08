/**
 * REQUEST SIZE VALIDATION TESTS
 *
 * Tests for DoS protection via request size limits
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateRequestSize, SIZE_LIMITS, checkContentLength } from './request-size';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('validateRequestSize', () => {
  it('accepts small payloads', () => {
    const body = { message: 'hello' };
    const result = validateRequestSize(body);
    expect(result.valid).toBe(true);
    expect(result.size).toBeGreaterThan(0);
  });

  it('accepts payloads at the limit', () => {
    // Create a payload just under 100KB
    const smallLimit = 100;
    const body = { data: 'x'.repeat(50) };
    const result = validateRequestSize(body, smallLimit);
    expect(result.valid).toBe(true);
  });

  it('rejects oversized payloads', () => {
    // Create a payload over 100 bytes
    const body = { data: 'x'.repeat(200) };
    const result = validateRequestSize(body, 100);
    expect(result.valid).toBe(false);
    expect(result.response?.status).toBe(413);
  });

  it('includes size details in error response', async () => {
    const body = { data: 'x'.repeat(200) };
    const result = validateRequestSize(body, 100);
    expect(result.valid).toBe(false);

    if (result.response) {
      const json = await result.response.json();
      expect(json.error).toBe('Request too large');
      expect(json.code).toBe('REQUEST_TOO_LARGE');
      expect(json.details).toBeDefined();
      expect(json.details.size).toBeGreaterThan(100);
      expect(json.details.limit).toBe(100);
    }
  });

  it('handles empty objects', () => {
    const result = validateRequestSize({});
    expect(result.valid).toBe(true);
    expect(result.size).toBe(2); // "{}" = 2 bytes
  });

  it('handles arrays', () => {
    const result = validateRequestSize([1, 2, 3]);
    expect(result.valid).toBe(true);
  });

  it('handles nested objects', () => {
    const body = {
      level1: {
        level2: {
          level3: 'deep'
        }
      }
    };
    const result = validateRequestSize(body);
    expect(result.valid).toBe(true);
  });

  it('handles null values', () => {
    const body = { value: null };
    const result = validateRequestSize(body);
    expect(result.valid).toBe(true);
  });
});

describe('SIZE_LIMITS', () => {
  it('has correct small limit (100KB)', () => {
    expect(SIZE_LIMITS.SMALL).toBe(100 * 1024);
  });

  it('has correct medium limit (500KB)', () => {
    expect(SIZE_LIMITS.MEDIUM).toBe(500 * 1024);
  });

  it('has correct large limit (1MB)', () => {
    expect(SIZE_LIMITS.LARGE).toBe(1 * 1024 * 1024);
  });

  it('has correct xlarge limit (5MB)', () => {
    expect(SIZE_LIMITS.XLARGE).toBe(5 * 1024 * 1024);
  });

  it('has correct file upload limit (10MB)', () => {
    expect(SIZE_LIMITS.FILE_UPLOAD).toBe(10 * 1024 * 1024);
  });
});

describe('checkContentLength', () => {
  it('accepts requests with no content-length header', () => {
    const request = new Request('https://example.com', {
      method: 'POST',
    });
    const result = checkContentLength(request, 1024);
    expect(result.valid).toBe(true);
  });

  it('accepts requests within limit', () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'content-length': '500',
      },
    });
    const result = checkContentLength(request, 1024);
    expect(result.valid).toBe(true);
    expect(result.size).toBe(500);
  });

  it('rejects requests over limit', () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'content-length': '2000',
      },
    });
    const result = checkContentLength(request, 1024);
    expect(result.valid).toBe(false);
    expect(result.response?.status).toBe(413);
  });

  it('handles invalid content-length header', () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'content-length': 'invalid',
      },
    });
    const result = checkContentLength(request, 1024);
    expect(result.valid).toBe(true);
  });
});
