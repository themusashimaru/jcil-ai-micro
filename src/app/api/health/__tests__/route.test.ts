// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockSelect = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
mockSelect.mockReturnValue({ limit: mockLimit });

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { GET } from '../route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string) {
  return { url } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [{ id: '1' }], error: null });
  });

  // =========================================================================
  // Quick health check
  // =========================================================================

  describe('quick health check', () => {
    it('should return 200 for basic health check', async () => {
      const res = await GET(makeRequest('http://localhost/api/health'));
      expect(res.status).toBe(200);
    });

    it('should return healthy status', async () => {
      const res = await GET(makeRequest('http://localhost/api/health'));
      const body = await res.json();
      expect(body.status).toBe('healthy');
    });

    it('should return a timestamp', async () => {
      const res = await GET(makeRequest('http://localhost/api/health'));
      const body = await res.json();
      expect(body.timestamp).toBeTruthy();
      expect(new Date(body.timestamp).getTime()).not.toBeNaN();
    });

    it('should return uptime >= 0', async () => {
      const res = await GET(makeRequest('http://localhost/api/health'));
      const body = await res.json();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return version string', async () => {
      const res = await GET(makeRequest('http://localhost/api/health'));
      const body = await res.json();
      expect(typeof body.version).toBe('string');
    });

    it('should NOT include services for quick check', async () => {
      const res = await GET(makeRequest('http://localhost/api/health'));
      const body = await res.json();
      expect(body.services).toBeUndefined();
    });

    it('should include no-cache headers', async () => {
      const res = await GET(makeRequest('http://localhost/api/health'));
      expect(res.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
    });
  });

  // =========================================================================
  // Detailed health check
  // =========================================================================

  describe('detailed health check', () => {
    it('should include services when detailed=true', async () => {
      const res = await GET(makeRequest('http://localhost/api/health?detailed=true'));
      const body = await res.json();
      expect(body.services).toBeDefined();
      expect(body.services.database).toBeDefined();
      expect(body.services.anthropic).toBeDefined();
    });

    it('should return healthy when all services ok', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      mockLimit.mockResolvedValue({ data: [{ id: '1' }], error: null });

      const res = await GET(makeRequest('http://localhost/api/health?detailed=true'));
      const body = await res.json();
      expect(body.status).toBe('healthy');
      expect(res.status).toBe(200);
    });

    it('should return database ok when query succeeds', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      mockLimit.mockResolvedValue({ data: [{ id: '1' }], error: null });

      const res = await GET(makeRequest('http://localhost/api/health?detailed=true'));
      const body = await res.json();
      expect(body.services.database.status).toBe('ok');
    });

    it('should return database degraded for missing table error', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      mockLimit.mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      });

      const res = await GET(makeRequest('http://localhost/api/health?detailed=true'));
      const body = await res.json();
      expect(body.services.database.status).toBe('degraded');
      expect(body.services.database.message).toContain('schema incomplete');
    });

    it('should return database error for query failure', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      mockLimit.mockResolvedValue({
        data: null,
        error: { code: 'PGRST', message: 'connection refused' },
      });

      const res = await GET(makeRequest('http://localhost/api/health?detailed=true'));
      const body = await res.json();
      expect(body.services.database.status).toBe('error');
    });

    it('should return database error when not configured', async () => {
      const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const res = await GET(makeRequest('http://localhost/api/health?detailed=true'));
      const body = await res.json();
      expect(body.services.database.status).toBe('error');
      expect(body.services.database.message).toContain('not configured');

      // Restore
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
    });

    it('should return database error on exception', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      mockLimit.mockRejectedValue(new Error('Network failure'));

      const res = await GET(makeRequest('http://localhost/api/health?detailed=true'));
      const body = await res.json();
      expect(body.services.database.status).toBe('error');
      expect(body.services.database.message).toContain('Network failure');
    });

    it('should return anthropic ok when API key is set', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      mockLimit.mockResolvedValue({ data: [], error: null });

      const res = await GET(makeRequest('http://localhost/api/health?detailed=true'));
      const body = await res.json();
      expect(body.services.anthropic.status).toBe('ok');
    });

    it('should return anthropic error when no key', async () => {
      const origKey = process.env.ANTHROPIC_API_KEY;
      const origKey1 = process.env.ANTHROPIC_API_KEY_1;
      const origKeyFb = process.env.ANTHROPIC_API_KEY_FALLBACK_1;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY_1;
      delete process.env.ANTHROPIC_API_KEY_FALLBACK_1;
      mockLimit.mockResolvedValue({ data: [], error: null });

      const res = await GET(makeRequest('http://localhost/api/health?detailed=true'));
      const body = await res.json();
      expect(body.services.anthropic.status).toBe('error');
      expect(body.services.anthropic.message).toContain('not configured');

      // Restore
      if (origKey) process.env.ANTHROPIC_API_KEY = origKey;
      if (origKey1) process.env.ANTHROPIC_API_KEY_1 = origKey1;
      if (origKeyFb) process.env.ANTHROPIC_API_KEY_FALLBACK_1 = origKeyFb;
    });

    it('should include e2b service when E2B_API_KEY is set', async () => {
      process.env.E2B_API_KEY = 'test-e2b-key';
      mockLimit.mockResolvedValue({ data: [], error: null });

      const res = await GET(makeRequest('http://localhost/api/health?detailed=true'));
      const body = await res.json();
      expect(body.services.e2b).toBeDefined();
      expect(body.services.e2b.status).toBe('ok');

      delete process.env.E2B_API_KEY;
    });

    it('should return unhealthy status and 503 when a service has error', async () => {
      const origKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY_1;
      delete process.env.ANTHROPIC_API_KEY_FALLBACK_1;
      mockLimit.mockResolvedValue({ data: [], error: null });

      const res = await GET(makeRequest('http://localhost/api/health?detailed=true'));
      const body = await res.json();
      expect(body.status).toBe('unhealthy');
      expect(res.status).toBe(503);

      if (origKey) process.env.ANTHROPIC_API_KEY = origKey;
    });

    it('should return degraded when a service is degraded', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.ANTHROPIC_API_KEY = 'test-key';
      mockLimit.mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'missing table' },
      });

      const res = await GET(makeRequest('http://localhost/api/health?detailed=true'));
      const body = await res.json();
      expect(body.status).toBe('degraded');
      expect(res.status).toBe(200);
    });
  });
});
