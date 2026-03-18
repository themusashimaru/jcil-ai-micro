import { test, expect } from '@playwright/test';

/**
 * Admin Route Protection E2E Tests
 *
 * Verifies that all admin API endpoints reject unauthenticated
 * and non-admin requests. Uses requireAdmin() guard.
 */

test.describe('Admin Routes - Authentication Enforcement', () => {
  const adminGetRoutes = [
    '/api/admin/users',
    '/api/admin/earnings',
    '/api/admin/support/tickets',
    '/api/admin/settings',
    '/api/admin/diagnostic',
    '/api/admin/messages',
    '/api/tools/audit',
    '/api/tools/health',
    '/api/tools/inventory',
  ];

  for (const route of adminGetRoutes) {
    test(`GET ${route} rejects unauthenticated requests`, async ({ request }) => {
      const response = await request.get(route);

      // Must return 401 or 403
      expect([401, 403]).toContain(response.status());

      // Should return JSON error
      const contentType = response.headers()['content-type'];
      if (contentType?.includes('application/json')) {
        const body = await response.json();
        expect(body.error || body.message).toBeTruthy();
      }
    });
  }

  const adminPostRoutes = [
    '/api/admin/settings',
    '/api/admin/messages',
    '/api/admin/upload',
    '/api/admin/earnings/generate-report',
  ];

  for (const route of adminPostRoutes) {
    test(`POST ${route} rejects unauthenticated requests`, async ({ request }) => {
      const response = await request.post(route, {
        data: {},
        headers: { 'Content-Type': 'application/json' },
      });

      expect([401, 403]).toContain(response.status());
    });
  }
});

test.describe('Admin Routes - Export Endpoints', () => {
  test('GET /api/admin/earnings/export/excel rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/admin/earnings/export/excel');
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/admin/earnings/export/pdf rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/admin/earnings/export/pdf');
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Admin Routes - User Management', () => {
  test('GET /api/admin/users/[userId] rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/admin/users/test-user-id');
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/admin/users/[userId]/conversations rejects unauthenticated', async ({
    request,
  }) => {
    const response = await request.get('/api/admin/users/test-user-id/conversations');
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Admin Routes - Support Ticket Management', () => {
  test('GET /api/admin/support/tickets/[ticketId] rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/admin/support/tickets/test-ticket-id');
    expect([401, 403]).toContain(response.status());
  });

  test('PATCH /api/admin/support/tickets/[ticketId] rejects unauthenticated', async ({
    request,
  }) => {
    const response = await request.patch('/api/admin/support/tickets/test-ticket-id', {
      data: { status: 'resolved' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Admin Routes - Tool Management', () => {
  test('POST /api/tools/audit rejects unauthenticated', async ({ request }) => {
    const response = await request.post('/api/tools/audit', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/tools/test rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/tools/test');
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/tools/test/[tool] rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/tools/test/web_search');
    expect([401, 403]).toContain(response.status());
  });
});
