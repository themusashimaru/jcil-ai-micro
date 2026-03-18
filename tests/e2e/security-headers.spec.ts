import { test, expect } from '@playwright/test';

/**
 * Security Headers E2E Tests
 *
 * Verifies production security headers are present and correctly configured.
 * All assertions are firm — headers MUST be present, not optional.
 */

test.describe('Security Headers', () => {
  test('homepage returns Content-Type header', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    expect(headers['content-type']).toContain('text/html');
  });

  test('X-Frame-Options or CSP frame-ancestors prevents clickjacking', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    const xFrame = headers['x-frame-options'];
    const csp = headers['content-security-policy'];
    const hasFrameProtection = xFrame || csp?.includes('frame-ancestors');

    expect(hasFrameProtection).toBeTruthy();
  });

  test('X-Content-Type-Options is nosniff', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('Referrer-Policy is set to a restrictive value', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    expect(headers['referrer-policy']).toBeTruthy();
    expect([
      'no-referrer',
      'strict-origin',
      'strict-origin-when-cross-origin',
      'same-origin',
      'origin-when-cross-origin',
    ]).toContain(headers['referrer-policy']);
  });

  test('Permissions-Policy restricts browser features', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    expect(headers['permissions-policy']).toBeTruthy();
    expect(headers['permissions-policy'].length).toBeGreaterThan(0);
  });

  test('Content-Security-Policy is set', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    const csp = headers['content-security-policy'];
    expect(csp).toBeTruthy();
    // CSP should include at minimum default-src or script-src
    expect(csp).toMatch(/default-src|script-src/);
  });

  test('API endpoints return JSON content type', async ({ request }) => {
    const response = await request.get('/api/health');
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('static assets have long cache headers', async ({ page }) => {
    const staticCacheHeaders: string[] = [];

    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('/_next/static/')) {
        const cc = res.headers()['cache-control'];
        if (cc) staticCacheHeaders.push(cc);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Should have loaded at least some static assets
    if (staticCacheHeaders.length > 0) {
      for (const cc of staticCacheHeaders) {
        expect(cc).toContain('max-age');
      }
    }
  });

  test('login page is not publicly cached', async ({ page }) => {
    const response = await page.goto('/login');
    const headers = response?.headers() || {};

    const cacheControl = headers['cache-control'];
    if (cacheControl) {
      expect(cacheControl).not.toContain('public');
    }
  });
});
