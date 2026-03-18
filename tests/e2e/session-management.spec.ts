import { test, expect } from './fixtures';

/**
 * Session Management E2E Tests
 *
 * Tests user session flow — navigation between protected routes, logout behavior,
 * cookie handling, and session persistence. CI-safe (works without real auth).
 */

test.describe('Session - Protected Route Navigation', () => {
  test('navigating between protected routes does not crash', async ({ page }) => {
    // Navigate through all protected routes in sequence
    const protectedRoutes = ['/chat', '/code-lab', '/settings'];

    for (const route of protectedRoutes) {
      const response = await page.goto(route);
      expect(response?.status()).not.toBe(500);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('rapid navigation between routes does not cause errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.goto('/chat');
    await page.goto('/settings');
    await page.goto('/code-lab');
    await page.goto('/login');
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const critical = errors.filter(
      (e) =>
        !e.includes('ResizeObserver') &&
        !e.includes('ChunkLoadError') &&
        !e.includes('Loading chunk') &&
        !e.includes('NetworkError') &&
        !e.includes('Failed to fetch') &&
        !e.includes('NEXT_NOT_FOUND')
    );
    expect(critical).toHaveLength(0);
  });

  test('browser back/forward through protected routes works', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();

    await page.goForward();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Session - Logout Flow', () => {
  test('POST /api/auth/signout handles unauthenticated gracefully', async ({ request }) => {
    const response = await request.post('/api/auth/signout', {
      headers: { 'Content-Type': 'application/json' },
    });
    // Should not crash — returns redirect, 200, or auth error
    expect([200, 302, 303, 401, 403]).toContain(response.status());
  });
});

test.describe('Session - Cookie & Header Security', () => {
  test('responses include security headers', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    // Critical security headers
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('API responses include proper content-type', async ({ request }) => {
    const response = await request.get('/api/health');
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('static assets have cache headers', async ({ page }) => {
    const cacheHeaders: { url: string; cacheControl: string }[] = [];

    page.on('response', (response) => {
      const url = response.url();
      const cc = response.headers()['cache-control'];
      if (url.includes('/_next/static/') && cc) {
        cacheHeaders.push({ url, cacheControl: cc });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Static assets should have long cache
    for (const { cacheControl } of cacheHeaders) {
      expect(cacheControl).toContain('max-age');
    }
  });
});

test.describe('Session - Auth Redirect Consistency', () => {
  test('all protected routes handle unauth consistently (no 500s)', async ({ page }) => {
    const protectedRoutes = [
      '/chat',
      '/code-lab',
      '/settings',
      '/admin',
    ];

    for (const route of protectedRoutes) {
      const response = await page.goto(route);
      const status = response?.status() ?? 0;

      // Should never get a server error
      expect(status).not.toBe(500);
      expect(status).not.toBe(502);
      expect(status).not.toBe(503);

      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('protected API routes all reject unauth with 401 or 403', async ({ request }) => {
    const protectedApis = [
      { method: 'GET', path: '/api/conversations' },
      { method: 'GET', path: '/api/memory' },
      { method: 'GET', path: '/api/user/settings' },
      { method: 'GET', path: '/api/code-lab/sessions' },
      { method: 'GET', path: '/api/documents/user/files' },
      { method: 'GET', path: '/api/user/usage' },
    ];

    for (const { method, path } of protectedApis) {
      const response =
        method === 'GET'
          ? await request.get(path)
          : await request.post(path, {
              data: {},
              headers: { 'Content-Type': 'application/json' },
            });

      expect([401, 403]).toContain(response.status());
    }
  });
});

test.describe('Session - Error Recovery', () => {
  test('app recovers after hitting a protected route unauthenticated', async ({ page }) => {
    // Hit a protected route
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to public route — should still work fine
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).toBeVisible();
  });

  test('app handles deep-link to nonexistent conversation', async ({ page }) => {
    const response = await page.goto('/chat?conversation=nonexistent-id-12345');
    expect(response?.status()).not.toBe(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('app handles deep-link to nonexistent code-lab session', async ({ page }) => {
    const response = await page.goto('/code-lab?session=nonexistent-id-12345');
    expect(response?.status()).not.toBe(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});
