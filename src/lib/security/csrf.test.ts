/**
 * CSRF PROTECTION TESTS
 *
 * Tests for cross-site request forgery prevention
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateCSRF, isSameOrigin } from './csrf';
import { NextRequest } from 'next/server';

// Mock logger to prevent actual logging during tests
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Helper to create mock NextRequest
function createMockRequest(
  url: string,
  options: {
    method?: string;
    origin?: string;
    referer?: string;
  } = {}
): NextRequest {
  const headers = new Headers();
  if (options.origin) headers.set('origin', options.origin);
  if (options.referer) headers.set('referer', options.referer);

  return new NextRequest(url, {
    method: options.method || 'POST',
    headers,
  });
}

describe('validateCSRF', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('HTTP method handling', () => {
    it('allows GET requests without origin check', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'GET',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(true);
    });

    it('allows HEAD requests without origin check', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'HEAD',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(true);
    });

    it('allows OPTIONS requests without origin check', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'OPTIONS',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(true);
    });

    it('validates POST requests', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'POST',
        origin: 'https://example.com',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(true);
    });

    it('validates PUT requests', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'PUT',
        origin: 'https://example.com',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(true);
    });

    it('validates DELETE requests', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'DELETE',
        origin: 'https://example.com',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(true);
    });

    it('validates PATCH requests', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'PATCH',
        origin: 'https://example.com',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(true);
    });
  });

  describe('origin validation', () => {
    it('accepts same-origin requests', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'POST',
        origin: 'https://example.com',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(true);
    });

    it('blocks requests with missing origin header', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'POST',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(false);
      expect(result.response?.status).toBe(403);
    });

    it('blocks cross-origin requests', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'POST',
        origin: 'https://attacker.com',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(false);
      expect(result.response?.status).toBe(403);
    });

    it('accepts referer header when origin is missing', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'POST',
        referer: 'https://example.com/some-page',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(true);
    });

    it('blocks cross-origin referer', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'POST',
        referer: 'https://attacker.com/page',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(false);
    });
  });

  describe('options', () => {
    it('skips check when skipCheck is true', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'POST',
        origin: 'https://attacker.com',
      });
      const result = validateCSRF(request, { skipCheck: true });
      expect(result.valid).toBe(true);
    });

    it('accepts custom allowed origins', () => {
      const request = createMockRequest('https://example.com/api/data', {
        method: 'POST',
        origin: 'https://trusted-partner.com',
      });
      const result = validateCSRF(request, {
        allowedOrigins: ['https://trusted-partner.com'],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('development mode', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    it('allows localhost in development', () => {
      const request = createMockRequest('http://localhost:3000/api/data', {
        method: 'POST',
        origin: 'http://localhost:3000',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(true);
    });

    it('allows 127.0.0.1 in development', () => {
      const request = createMockRequest('http://127.0.0.1:3000/api/data', {
        method: 'POST',
        origin: 'http://127.0.0.1:3000',
      });
      const result = validateCSRF(request);
      expect(result.valid).toBe(true);
    });
  });
});

describe('isSameOrigin', () => {
  it('returns true for same origin', () => {
    const request = createMockRequest('https://example.com/api/data', {
      origin: 'https://example.com',
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it('returns false for different origin', () => {
    const request = createMockRequest('https://example.com/api/data', {
      origin: 'https://other.com',
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it('returns false when no origin header', () => {
    const request = createMockRequest('https://example.com/api/data', {});
    expect(isSameOrigin(request)).toBe(false);
  });

  it('checks referer when origin is missing', () => {
    const request = createMockRequest('https://example.com/api/data', {
      referer: 'https://example.com/page',
    });
    expect(isSameOrigin(request)).toBe(true);
  });
});
