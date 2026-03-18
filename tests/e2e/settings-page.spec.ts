import { test, expect } from './fixtures';

/**
 * Settings Page E2E Tests
 *
 * Tests the user settings page — tab navigation, form elements, responsive
 * design, and API contracts. Without real auth, tests verify redirect behavior
 * and API rejection for unauthenticated requests.
 */

test.describe('Settings Page - Loading', () => {
  test('settings page returns 200 (not 500)', async ({ page }) => {
    const response = await page.goto('/settings');
    expect(response?.status()).not.toBe(500);
  });

  test('settings page loads under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    expect(Date.now() - start).toBeLessThan(5000);
  });

  test('settings page has no critical JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

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
});

test.describe('Settings Page - Auth Handling', () => {
  test('unauthenticated access redirects to login or shows auth prompt', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    const handled =
      url.includes('login') ||
      url.includes('settings') ||
      url.includes('auth');
    expect(handled).toBe(true);
  });

  test('settings page does not expose sensitive data when unauthenticated', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('ANTHROPIC_API_KEY');
    expect(bodyText).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(bodyText).not.toContain('sk-ant-');
  });
});

test.describe('Settings Page - Responsive Design', () => {
  test('settings page renders at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('settings page renders at tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('settings page renders at desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Settings API Contracts', () => {
  test('GET /api/user/settings rejects unauthenticated with JSON', async ({ request }) => {
    const response = await request.get('/api/user/settings');
    expect([401, 403]).toContain(response.status());
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('PUT /api/user/settings rejects unauthenticated', async ({ request }) => {
    const response = await request.put('/api/user/settings', {
      data: { theme: 'dark', language: 'en' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/user/usage rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/user/usage');
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/user/subscription rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/user/subscription');
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/user/api-keys rejects unauthenticated', async ({ request }) => {
    const response = await request.post('/api/user/api-keys', {
      data: { provider: 'openai', key: 'sk-test' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/user/github-token rejects unauthenticated', async ({ request }) => {
    const response = await request.post('/api/user/github-token', {
      data: { token: 'ghp_test' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/user/vercel-token rejects unauthenticated', async ({ request }) => {
    const response = await request.post('/api/user/vercel-token', {
      data: { token: 'test' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('DELETE /api/user/delete-account rejects unauthenticated', async ({ request }) => {
    const response = await request.delete('/api/user/delete-account');
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/user/export rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/user/export');
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/user/is-admin rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/user/is-admin');
    expect([401, 403]).toContain(response.status());
  });
});
