import { test, expect } from '@playwright/test';

/**
 * Navigation E2E Tests
 *
 * Verifies navigation between pages works correctly.
 */

test.describe('Navigation', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('can navigate from homepage to login page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loginLink = page.locator(
      'a[href*="login"], a[href*="signin"], button:has-text("Login"), button:has-text("Sign in")'
    );

    const count = await loginLink.count();
    if (count > 0) {
      await loginLink.first().click();
      await page.waitForURL(/(login|signin|auth)/, { timeout: 10000 });
      expect(page.url()).toMatch(/login|signin|auth/i);
    } else {
      test.skip();
    }
  });

  test('can navigate from homepage to signup page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const signupLink = page.locator(
      'a[href*="signup"], a[href*="register"], button:has-text("Sign up"), button:has-text("Get started"), button:has-text("Get Started")'
    );

    const count = await signupLink.count();
    if (count > 0) {
      await signupLink.first().click();
      await page.waitForURL(/(signup|register|auth)/, { timeout: 10000 });
      expect(page.url()).toMatch(/signup|register|auth/i);
    } else {
      test.skip();
    }
  });

  test('login page has link back to homepage', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const homeLink = page.locator('a[href="/"]').first();
    await expect(homeLink).toBeVisible();
  });

  test('404 page shows for invalid routes', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-12345');
    expect([404, 200]).toContain(response?.status());

    const pageText = await page.textContent('body');
    const hasNotFoundIndicator =
      pageText?.includes('404') ||
      pageText?.toLowerCase().includes('not found') ||
      pageText?.toLowerCase().includes('page not found');

    expect(hasNotFoundIndicator).toBeTruthy();
  });

  test('external links have rel="noopener" or "noreferrer"', async ({ page }) => {
    await page.goto('/');

    const externalLinks = page.locator('a[target="_blank"]');
    const count = await externalLinks.count();

    for (let i = 0; i < count; i++) {
      const rel = await externalLinks.nth(i).getAttribute('rel');
      expect(rel).toMatch(/noopener|noreferrer/);
    }
  });

  test('keyboard Tab navigation focuses elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');

    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    expect(focusedElement).not.toBe('BODY');
  });
});
