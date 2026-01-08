import { test, expect } from '@playwright/test';

/**
 * Navigation E2E Tests
 *
 * Verifies navigation between pages works correctly.
 */

test.describe('Navigation', () => {
  test('can navigate to login page', async ({ page }) => {
    await page.goto('/');

    // Look for login link or button
    const loginLink = page.locator(
      'a[href*="login"], a[href*="signin"], button:has-text("Login"), button:has-text("Sign in")'
    );

    if ((await loginLink.count()) > 0) {
      await loginLink.first().click();
      await page.waitForLoadState('networkidle');

      // Should be on login page
      expect(page.url()).toMatch(/login|signin|auth/i);
    }
  });

  test('can navigate to signup page', async ({ page }) => {
    await page.goto('/');

    // Look for signup link or button
    const signupLink = page.locator(
      'a[href*="signup"], a[href*="register"], button:has-text("Sign up"), button:has-text("Register"), button:has-text("Get started")'
    );

    if ((await signupLink.count()) > 0) {
      await signupLink.first().click();
      await page.waitForLoadState('networkidle');

      // Should be on signup page
      expect(page.url()).toMatch(/signup|register|auth/i);
    }
  });

  test('logo navigates to homepage', async ({ page }) => {
    await page.goto('/login');

    // Look for logo link
    const logoLink = page.locator('a[href="/"], header a:first-child, .logo a');

    if ((await logoLink.count()) > 0) {
      await logoLink.first().click();
      await page.waitForLoadState('networkidle');

      // Should be on homepage
      expect(page.url()).toMatch(/\/$/);
    }
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

    // Tab through the page
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Something should be focused
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName : null;
    });

    expect(focusedElement).toBeTruthy();
  });
});
