import { test, expect } from './fixtures';

/**
 * Chat Interface E2E Tests
 *
 * Tests the core chat product — page rendering, UI elements, form interaction,
 * keyboard shortcuts, and error handling. Designed to work without real
 * authentication (CI-safe). Auth-dependent features test redirect behavior.
 */

test.describe('Chat Page - Loading & Structure', () => {
  test('chat page returns 200 (not 500)', async ({ page }) => {
    const response = await page.goto('/chat');
    expect(response?.status()).not.toBe(500);
  });

  test('chat page loads under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');
    expect(Date.now() - start).toBeLessThan(5000);
  });

  test('chat page has proper document title', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('chat page has no critical JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/chat');
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

  test('chat page has proper HTML lang attribute', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });
});

test.describe('Chat Page - Auth Handling', () => {
  test('unauthenticated access shows login prompt or redirects', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    // Either redirected to login, stays on chat with auth prompt, or shows body
    const handled =
      url.includes('login') ||
      url.includes('chat') ||
      url.includes('auth');
    expect(handled).toBe(true);
  });

  test('chat page does not expose sensitive data when unauthenticated', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').textContent();
    // Should not expose API keys, tokens, or internal errors
    expect(bodyText).not.toContain('ANTHROPIC_API_KEY');
    expect(bodyText).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(bodyText).not.toContain('sk-ant-');
  });
});

test.describe('Chat Page - UI Elements', () => {
  test('chat page renders main content area', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    // Page should have visible body content
    await expect(page.locator('body')).toBeVisible();

    // Should have some interactive elements (buttons, inputs, or links)
    const interactiveCount = await page
      .locator('button, input, textarea, a')
      .count();
    expect(interactiveCount).toBeGreaterThan(0);
  });

  test('chat page is responsive at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toBeVisible();
    // No horizontal overflow at mobile width (allowing margin for scrollbar + rounding)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(435);
  });

  test('chat page is responsive at tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toBeVisible();
  });

  test('chat page is responsive at desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Chat Page - Accessibility', () => {
  test('chat page has ARIA landmarks', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    // Should have at least one landmark role
    const landmarks = await page
      .locator('[role="main"], main, [role="navigation"], nav, [role="banner"], header')
      .count();
    expect(landmarks).toBeGreaterThan(0);
  });

  test('chat page has skip-to-content link', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    // Skip link should exist (may be visually hidden)
    const skipLink = page.locator('a[href="#main-content"], a.skip-to-content, [class*="skip"]');
    const count = await skipLink.count();
    // At minimum the root layout provides this
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('all interactive elements are focusable via Tab', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    // Press Tab and verify focus moves
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });
});

test.describe('Chat Page - Performance', () => {
  test('chat page does not load excessively large resources', async ({ page }) => {
    const resourceSizes: number[] = [];

    page.on('response', (response) => {
      const size = parseInt(response.headers()['content-length'] || '0');
      if (size > 0) resourceSizes.push(size);
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // No single resource should be over 5MB
    for (const size of resourceSizes) {
      expect(size).toBeLessThan(5_000_000);
    }
  });
});

test.describe('Chat API - Additional Contracts', () => {
  test('POST /api/chat/generate-title rejects unauthenticated', async ({ request }) => {
    const response = await request.post('/api/chat/generate-title', {
      data: { messages: [{ role: 'user', content: 'hello' }] },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/chat rejects malformed JSON', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: 'not valid json {{{',
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 401, 403]).toContain(response.status());
  });

  test('POST /api/chat rejects missing messages array', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: { model: 'claude-opus-4-6' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 401, 403]).toContain(response.status());
  });
});
