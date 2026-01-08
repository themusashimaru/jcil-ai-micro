import { test, expect } from '@playwright/test';

/**
 * Homepage E2E Tests
 *
 * Verifies the homepage loads correctly and key elements are present.
 */

test.describe('Homepage', () => {
  test('homepage loads successfully', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.status()).toBe(200);
  });

  test('homepage has correct title', async ({ page }) => {
    await page.goto('/');

    // Check page has a title
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('homepage has main navigation', async ({ page }) => {
    await page.goto('/');

    // Check for navigation elements
    const nav = page.locator('nav, header, [role="navigation"]');
    await expect(nav.first()).toBeVisible();
  });

  test('homepage has main content area', async ({ page }) => {
    await page.goto('/');

    // Check for main content
    const main = page.locator('main, [role="main"], .main-content');
    await expect(main.first()).toBeVisible();
  });

  test('homepage is responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const response = await page.reload();
    expect(response?.status()).toBe(200);

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();
  });

  test('homepage has no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    // Use domcontentloaded instead of networkidle for faster, more reliable tests
    await page.waitForLoadState('domcontentloaded');
    // Give a short time for any immediate JS errors to surface
    await page.waitForTimeout(1000);

    // Filter out expected errors (like third-party scripts, hydration warnings)
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('third-party') &&
        !error.includes('analytics') &&
        !error.includes('hydrat') &&
        !error.includes('Warning:')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
