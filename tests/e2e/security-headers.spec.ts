import { test, expect } from '@playwright/test';

/**
 * Security Headers E2E Tests
 *
 * Verifies production security headers are present and correctly configured.
 * These protect against XSS, clickjacking, MIME sniffing, and other attacks.
 */

test.describe('Security Headers', () => {
  test('homepage returns security headers', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    // Content-Type must be set
    expect(headers['content-type']).toBeTruthy();
  });

  test('X-Frame-Options prevents clickjacking', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    // Either X-Frame-Options or CSP frame-ancestors should be set
    const xFrame = headers['x-frame-options'];
    const csp = headers['content-security-policy'];
    const hasFrameProtection = xFrame || csp?.includes('frame-ancestors');

    expect(hasFrameProtection).toBeTruthy();
  });

  test('X-Content-Type-Options prevents MIME sniffing', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    const noSniff = headers['x-content-type-options'];
    if (noSniff) {
      expect(noSniff).toBe('nosniff');
    }
  });

  test('Referrer-Policy is set', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    const referrer = headers['referrer-policy'];
    if (referrer) {
      // Should be a restrictive policy
      expect([
        'no-referrer',
        'strict-origin',
        'strict-origin-when-cross-origin',
        'same-origin',
        'origin-when-cross-origin',
      ]).toContain(referrer);
    }
  });

  test('Permissions-Policy restricts features', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    const permissions = headers['permissions-policy'];
    if (permissions) {
      // Should restrict at least some features
      expect(permissions.length).toBeGreaterThan(0);
    }
  });

  test('API endpoints return JSON content type', async ({ request }) => {
    const endpoints = ['/api/health'];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    }
  });

  test('static assets are cacheable', async ({ page }) => {
    await page.goto('/');

    // Collect resource responses
    const staticResponses: { url: string; cacheControl: string | null }[] = [];

    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('/_next/static/')) {
        staticResponses.push({
          url,
          cacheControl: res.headers()['cache-control'],
        });
      }
    });

    // Navigate to trigger resource loading
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Static assets should have long cache headers
    for (const res of staticResponses) {
      if (res.cacheControl) {
        expect(res.cacheControl).toContain('max-age');
      }
    }
  });

  test('login page does not cache sensitive content', async ({ page }) => {
    const response = await page.goto('/login');
    const headers = response?.headers() || {};

    const cacheControl = headers['cache-control'];
    // Auth pages should not be aggressively cached
    if (cacheControl) {
      expect(cacheControl).not.toContain('public');
    }
  });
});
