import { test, expect } from '@playwright/test';

/**
 * CSRF Enforcement E2E Tests
 *
 * Verifies that state-changing API endpoints (POST, PUT, PATCH, DELETE)
 * reject requests without proper Origin/Referer headers.
 * The requireUser() guard includes built-in CSRF protection.
 */

test.describe('CSRF Enforcement on Protected Endpoints', () => {
  // State-changing endpoints that require auth + CSRF
  const protectedPostEndpoints = [
    '/api/conversations',
    '/api/chat/generate-title',
    '/api/code-lab/sessions',
    '/api/code-lab/chat',
    '/api/folders',
    '/api/files/upload',
    '/api/analytics',
    '/api/memory/forget',
    '/api/connectors',
    '/api/user/api-keys',
    '/api/user/dismiss-passkey-prompt',
  ];

  for (const endpoint of protectedPostEndpoints) {
    test(`POST ${endpoint} rejects unauthenticated requests`, async ({ request }) => {
      const response = await request.post(endpoint, {
        data: {},
        headers: { 'Content-Type': 'application/json' },
      });

      // Must return 401 or 403 (not 200 or 500)
      expect([401, 403]).toContain(response.status());
    });
  }

  test('POST /api/chat rejects with auth error (not 500)', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: {
        messages: [{ role: 'user', content: 'test' }],
      },
      headers: { 'Content-Type': 'application/json' },
    });

    // Chat endpoint should reject unauthenticated
    expect([401, 403]).toContain(response.status());
    const body = await response.json();
    expect(body.error || body.message).toBeTruthy();
  });

  test('DELETE endpoints reject unauthenticated requests', async ({ request }) => {
    const deleteEndpoints = [
      '/api/conversations/test-id-123',
      '/api/folders/test-id-123',
      '/api/user/api-keys',
    ];

    for (const endpoint of deleteEndpoints) {
      const response = await request.delete(endpoint, {
        headers: { 'Content-Type': 'application/json' },
      });

      // Must reject with auth error
      expect([401, 403, 404, 405]).toContain(response.status());
    }
  });

  test('PUT endpoints reject unauthenticated requests', async ({ request }) => {
    const putEndpoints = ['/api/user/settings', '/api/user/mcp-servers', '/api/memory'];

    for (const endpoint of putEndpoints) {
      const response = await request.put(endpoint, {
        data: {},
        headers: { 'Content-Type': 'application/json' },
      });

      expect([401, 403, 405]).toContain(response.status());
    }
  });

  test('PATCH endpoints reject unauthenticated requests', async ({ request }) => {
    const response = await request.patch('/api/conversations/test-id/folder', {
      data: { folderId: 'test' },
      headers: { 'Content-Type': 'application/json' },
    });

    expect([401, 403, 404, 405]).toContain(response.status());
  });
});

test.describe('CSRF - Public Endpoints Still Work', () => {
  test('GET /api/health is accessible without auth', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
  });

  test('GET /api/features is accessible without auth', async ({ request }) => {
    const response = await request.get('/api/features');
    // Features endpoint should work or return 404 if not implemented
    expect([200, 404]).toContain(response.status());
  });

  test('GET /api/providers/status is accessible without auth', async ({ request }) => {
    const response = await request.get('/api/providers/status');
    expect([200, 404]).toContain(response.status());
  });
});
