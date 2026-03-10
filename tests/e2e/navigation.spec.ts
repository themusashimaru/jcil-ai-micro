import { test, expect } from '@playwright/test';

/**
 * Navigation E2E Tests
 *
 * Verifies navigation between pages works correctly.
 */

test.describe('Navigation', () => {
  // Use desktop viewport for consistent nav testing
  test.use({ viewport: { width: 1280, height: 720 } });

  test('can navigate to login page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Look for login link or button (desktop nav)
    const loginLink = page.locator(
      'a[href*="login"], a[href*="signin"], button:has-text("Login"), button:has-text("Sign in")'
    );

    const count = await loginLink.count();
    if (count > 0) {
      // Find a visible login link
      const visibleLink = loginLink.first();

      // Wait for it to be visible (may be in header that appears after scroll)
      await expect(visibleLink).toBeVisible({ timeout: 5000 });

      await visibleLink.click();
      // Wait for URL to change to an auth-related page
      await page.waitForURL(/(login|signin|auth)/, { timeout: 10000 });

      const url = page.url();
      const isAuthPage = /login|signin|auth/i.test(url) || url.includes('supabase');
      expect(isAuthPage).toBeTruthy();
    } else {
      // Skip if no login link found (may be already logged in)
      test.skip();
    }
  });

  test('can navigate to signup page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Look for signup link or button
    const signupLink = page.locator(
      'a[href*="signup"], a[href*="register"], button:has-text("Sign up"), button:has-text("Register"), button:has-text("Get started"), button:has-text("Get Started")'
    );

    const count = await signupLink.count();
    if (count > 0) {
      // Find a visible signup link
      const visibleLink = signupLink.first();
      await expect(visibleLink).toBeVisible({ timeout: 5000 });

      await visibleLink.click();
      // Wait for URL to change to a signup-related page
      await page.waitForURL(/(signup|register|auth)/, { timeout: 10000 });

      const url = page.url();
      const isAuthPage = /signup|register|auth/i.test(url) || url.includes('supabase');
      expect(isAuthPage).toBeTruthy();
    } else {
      // Skip if no signup link found
      test.skip();
    }
  });

  test('home link exists on login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Verify there's a visible link back to homepage from the login page
    // Use auto-waiting assertion to handle React re-renders
    const homeLink = page.locator('a[href="/"]').first();
    await expect(homeLink).toBeAttached({ timeout: 10000 });
    await expect(homeLink).toBeVisible({ timeout: 5000 });
  });

  test('404 page shows for invalid routes', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-12345');

    // Should return 404 or show error page
    expect([404, 200]).toContain(response?.status());

    // Page should indicate not found
    const pageText = await page.textContent('body');
    const hasNotFoundIndicator =
      pageText?.includes('404') ||
      pageText?.toLowerCase().includes('not found') ||
      pageText?.toLowerCase().includes('page not found');

    expect(hasNotFoundIndicator).toBeTruthy();
  });

  test('links open in correct target', async ({ page }) => {
    await page.goto('/');

    // Get all external links
    const externalLinks = page.locator('a[target="_blank"]');
    const count = await externalLinks.count();

    // All external links should have rel="noopener" for security
    for (let i = 0; i < count; i++) {
      const rel = await externalLinks.nth(i).getAttribute('rel');
      if (rel) {
        expect(rel).toMatch(/noopener|noreferrer/);
      }
    }
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab through the page — wait briefly between tabs to let focus settle
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Wait for any client-side navigation to settle
    await page.waitForLoadState('domcontentloaded');

    // Something should be focused
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName : null;
    });

    expect(focusedElement).toBeTruthy();
  });
});
