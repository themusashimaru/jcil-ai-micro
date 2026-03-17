import { test, expect } from '@playwright/test';

/**
 * Chat API Contract E2E Tests
 *
 * Verifies the chat API endpoint contract, error handling,
 * and security enforcement without requiring real authentication.
 * These tests validate the API responds correctly to various inputs.
 */

test.describe('Chat API Contract', () => {
  test.describe('Authentication Enforcement', () => {
    test('POST /api/chat requires authentication', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: {
          messages: [{ role: 'user', content: 'hello' }],
        },
        headers: { 'Content-Type': 'application/json' },
      });

      // Should reject unauthenticated requests (401 or 403)
      expect([401, 403]).toContain(response.status());

      const body = await response.json();
      expect(body.error || body.message).toBeTruthy();
    });

    test('POST /api/chat rejects empty body', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: {},
        headers: { 'Content-Type': 'application/json' },
      });

      // Should reject with 400 or 401/403
      expect([400, 401, 403]).toContain(response.status());
    });

    test('GET /api/chat is not allowed', async ({ request }) => {
      const response = await request.get('/api/chat');

      // Should return 405 Method Not Allowed or redirect
      expect([405, 404, 301, 302, 307, 308]).toContain(response.status());
    });
  });

  test.describe('Protected Route Enforcement', () => {
    const protectedRoutes = [
      '/api/conversations',
      '/api/user/settings',
      '/api/user/memory',
      '/api/code-lab/sessions',
    ];

    for (const route of protectedRoutes) {
      test(`GET ${route} requires auth`, async ({ request }) => {
        const response = await request.get(route);

        // Should be 401/403 or redirect, never 200 with data
        expect([401, 403, 404, 307, 308]).toContain(response.status());
      });
    }

    const protectedPostRoutes = ['/api/conversations', '/api/chat/generate-title'];

    for (const route of protectedPostRoutes) {
      test(`POST ${route} requires auth`, async ({ request }) => {
        const response = await request.post(route, {
          data: {},
          headers: { 'Content-Type': 'application/json' },
        });

        expect([401, 403, 404, 405]).toContain(response.status());
      });
    }
  });

  test.describe('Response Format Consistency', () => {
    test('error responses are JSON with error field', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: { messages: [] },
        headers: { 'Content-Type': 'application/json' },
      });

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');

      const body = await response.json();
      // Should have error or message field
      expect(body.error || body.message || body.code).toBeTruthy();
    });

    test('health endpoint returns consistent format', async ({ request }) => {
      const response = await request.get('/api/health');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThan(0);
    });
  });

  test.describe('Input Validation', () => {
    test('rejects oversized request body', async ({ request }) => {
      // Create a very large message (should be rejected)
      const largeContent = 'x'.repeat(500_000);

      const response = await request.post('/api/chat', {
        data: {
          messages: [{ role: 'user', content: largeContent }],
        },
        headers: { 'Content-Type': 'application/json' },
      });

      // Should reject (auth first, then size) - either 401/403 or 413
      expect([401, 403, 413]).toContain(response.status());
    });

    test('rejects non-JSON content type', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: 'not json',
        headers: { 'Content-Type': 'text/plain' },
      });

      // Should reject with 400, 401, or 415
      expect([400, 401, 403, 415]).toContain(response.status());
    });
  });
});
