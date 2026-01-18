import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  successResponse,
  errorResponse,
  errors,
  validateQuery,
  validateParams,
  checkRequestRateLimit,
  rateLimits,
  safeJsonParse,
  getClientIP,
  getUserAgent,
  isBot,
} from './utils';
import { NextRequest } from 'next/server';
import { HTTP_STATUS, ERROR_CODES } from '@/lib/constants';

// Mock dependencies
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn((id, config) => {
    if (id.includes('blocked')) {
      return { allowed: false, remaining: 0, resetAt: Date.now() + 60000, retryAfter: 60 };
    }
    return { allowed: true, remaining: config.limit - 1, resetAt: Date.now() + 60000 };
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Helper to create mock NextRequest
function createMockRequest(
  options: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): NextRequest {
  const url = options.url || 'http://localhost:3000/api/test';
  const request = new NextRequest(url, {
    method: options.method || 'GET',
    headers: new Headers(options.headers || {}),
  });
  return request;
}

describe('API Utils', () => {
  describe('successResponse', () => {
    it('should create success response with data', async () => {
      const data = { id: 1, name: 'Test' };
      const response = successResponse(data);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data).toEqual(data);
    });

    it('should use custom status code', async () => {
      const response = successResponse({ created: true }, 201);
      expect(response.status).toBe(201);
    });

    it('should handle null data', async () => {
      const response = successResponse(null);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data).toBeNull();
    });

    it('should handle array data', async () => {
      const data = [1, 2, 3];
      const response = successResponse(data);
      const body = await response.json();
      expect(body.data).toEqual(data);
    });
  });

  describe('errorResponse', () => {
    it('should create error response', async () => {
      const response = errorResponse(400, 'BAD_REQUEST', 'Invalid input');

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toBe('Invalid input');
      expect(body.code).toBe('BAD_REQUEST');
    });

    it('should include validation details', async () => {
      const details = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' },
      ];
      const response = errorResponse(400, 'VALIDATION', 'Validation failed', details);

      const body = await response.json();
      expect(body.details).toEqual(details);
    });

    it('should not include details when empty', async () => {
      const response = errorResponse(400, 'ERROR', 'Message');
      const body = await response.json();
      expect(body.details).toBeUndefined();
    });
  });

  describe('errors helpers', () => {
    it('should create unauthorized error', async () => {
      const response = errors.unauthorized();
      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = await response.json();
      expect(body.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should create forbidden error', async () => {
      const response = errors.forbidden();
      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
    });

    it('should create not found error with custom resource', async () => {
      const response = errors.notFound('User');
      const body = await response.json();
      expect(body.error).toBe('User not found');
    });

    it('should create bad request error', async () => {
      const response = errors.badRequest('Custom message');
      const body = await response.json();
      expect(body.error).toBe('Custom message');
    });

    it('should create rate limited error with retry header', async () => {
      const response = errors.rateLimited(30);
      expect(response.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
      expect(response.headers.get('Retry-After')).toBe('30');
    });

    it('should create server error', async () => {
      const response = errors.serverError();
      expect(response.status).toBe(HTTP_STATUS.INTERNAL_ERROR);
    });

    it('should create validation error with details', async () => {
      const details = [{ field: 'email', message: 'Invalid' }];
      const response = errors.validationError(details);
      const body = await response.json();
      expect(body.details).toEqual(details);
    });
  });

  describe('validateQuery', () => {
    const schema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
    });

    it('should validate valid query params', () => {
      const request = createMockRequest({ url: 'http://localhost/api?page=2&limit=50' });
      const result = validateQuery(request, schema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should use defaults for missing params', () => {
      const request = createMockRequest({ url: 'http://localhost/api' });
      const result = validateQuery(request, schema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should return error for invalid params', () => {
      const request = createMockRequest({ url: 'http://localhost/api?page=-1' });
      const result = validateQuery(request, schema);

      expect(result.success).toBe(false);
    });
  });

  describe('validateParams', () => {
    const schema = z.object({
      id: z.string().uuid(),
    });

    it('should validate valid params', () => {
      const params = { id: '550e8400-e29b-41d4-a716-446655440000' };
      const result = validateParams(params, schema);

      expect(result.success).toBe(true);
    });

    it('should return error for invalid params', () => {
      const params = { id: 'not-a-uuid' };
      const result = validateParams(params, schema);

      expect(result.success).toBe(false);
    });
  });

  describe('checkRequestRateLimit', () => {
    it('should allow requests within limit', async () => {
      const result = await checkRequestRateLimit('user-123', rateLimits.standard);
      expect(result.allowed).toBe(true);
    });

    it('should block requests when limit exceeded', async () => {
      // Exhaust the rate limit first
      for (let i = 0; i < 60; i++) {
        await checkRequestRateLimit('blocked-user', rateLimits.standard);
      }
      const result = await checkRequestRateLimit('blocked-user', rateLimits.standard);
      expect(result.allowed).toBe(false);
    });
  });

  describe('rateLimits presets', () => {
    it('should have standard preset', () => {
      expect(rateLimits.standard.limit).toBe(60);
      expect(rateLimits.standard.windowMs).toBe(60_000);
    });

    it('should have strict preset', () => {
      expect(rateLimits.strict.limit).toBe(10);
    });

    it('should have auth preset', () => {
      expect(rateLimits.auth.limit).toBe(5);
    });

    it('should have all required presets', () => {
      expect(rateLimits).toHaveProperty('standard');
      expect(rateLimits).toHaveProperty('strict');
      expect(rateLimits).toHaveProperty('auth');
      expect(rateLimits).toHaveProperty('search');
      expect(rateLimits).toHaveProperty('upload');
      expect(rateLimits).toHaveProperty('ai');
    });
  });

  describe('safeJsonParse', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"name":"John","age":30}', schema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John');
        expect(result.data.age).toBe(30);
      }
    });

    it('should fail on invalid JSON', () => {
      const result = safeJsonParse('not json', schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid JSON');
      }
    });

    it('should fail on schema mismatch', () => {
      const result = safeJsonParse('{"name":"John"}', schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Validation failed');
      }
    });
  });

  describe('getClientIP', () => {
    it('should get IP from x-forwarded-for header', () => {
      const request = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      });
      expect(getClientIP(request)).toBe('192.168.1.1');
    });

    it('should get IP from x-real-ip header', () => {
      const request = createMockRequest({
        headers: { 'x-real-ip': '10.0.0.1' },
      });
      expect(getClientIP(request)).toBe('10.0.0.1');
    });

    it('should return unknown when no IP headers', () => {
      const request = createMockRequest();
      expect(getClientIP(request)).toBe('unknown');
    });

    it('should prefer x-forwarded-for over x-real-ip', () => {
      const request = createMockRequest({
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '10.0.0.1',
        },
      });
      expect(getClientIP(request)).toBe('192.168.1.1');
    });
  });

  describe('getUserAgent', () => {
    it('should get user agent from header', () => {
      const request = createMockRequest({
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      expect(getUserAgent(request)).toBe('Mozilla/5.0');
    });

    it('should return unknown when no user agent', () => {
      const request = createMockRequest();
      expect(getUserAgent(request)).toBe('unknown');
    });
  });

  describe('isBot', () => {
    it('should detect bot user agents', () => {
      const botAgents = [
        'Googlebot/2.1',
        'Mozilla/5.0 (compatible; bingbot/2.0)',
        'Mozilla/5.0 crawler',
        'curl/7.68.0',
        'wget/1.20',
        'spider bot scraper',
      ];

      botAgents.forEach((ua) => {
        const request = createMockRequest({ headers: { 'user-agent': ua } });
        expect(isBot(request)).toBe(true);
      });
    });

    it('should not flag normal browsers as bots', () => {
      const normalAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0) Safari/604.1',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Firefox/89.0',
      ];

      normalAgents.forEach((ua) => {
        const request = createMockRequest({ headers: { 'user-agent': ua } });
        expect(isBot(request)).toBe(false);
      });
    });

    it('should handle missing user agent', () => {
      const request = createMockRequest();
      expect(isBot(request)).toBe(false);
    });
  });
});
