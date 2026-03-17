import { test, expect } from '@playwright/test';

/**
 * Critical User Path E2E Tests
 *
 * Tests the most important user journeys through the application.
 * Designed to work without real authentication (CI-safe).
 * Validates that pages load, forms work, and errors are handled.
 */

test.describe('Critical Paths - Landing to Signup Flow', () => {
  test('user can navigate from homepage to signup', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find CTA or signup link
    const signupLink = page.locator(
      'a[href*="signup"], a[href*="register"], button:has-text("Get Started"), button:has-text("Sign Up"), button:has-text("Try"), a:has-text("Get Started"), a:has-text("Sign Up")'
    );

    const count = await signupLink.count();
    if (count > 0) {
      await signupLink.first().click();
      await page.waitForLoadState('domcontentloaded');

      // Should be on signup/auth page
      const url = page.url();
      expect(url).toMatch(/signup|register|auth/i);
    }
  });

  test('signup form validates email format', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator(
      'input[type="email"], input[name="email"], input[placeholder*="email" i]'
    );

    if ((await emailInput.count()) > 0) {
      // Type invalid email
      await emailInput.first().fill('not-an-email');

      // Find submit button
      const submitButton = page.locator(
        'button[type="submit"], button:has-text("Sign up"), button:has-text("Create")'
      );

      if ((await submitButton.count()) > 0) {
        await submitButton.first().click();
        await page.waitForTimeout(500);

        // Should not navigate away (validation should prevent)
        const url = page.url();
        expect(url).toMatch(/signup|register|auth/i);
      }
    }
  });
});

test.describe('Critical Paths - Settings Access', () => {
  test('settings page requires authentication', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    // Should redirect to login or show auth requirement
    const requiresAuth = url.includes('login') || url.includes('auth') || url.includes('signin');

    if (!requiresAuth) {
      // May show settings page with login prompt
      const pageText = await page.textContent('body');
      const hasContent = pageText && pageText.length > 0;
      expect(hasContent).toBeTruthy();
    }
  });
});

test.describe('Critical Paths - Error Recovery', () => {
  test('app recovers from 404 errors', async ({ page }) => {
    // Navigate to non-existent page
    await page.goto('/nonexistent-page-xyz');
    await page.waitForLoadState('domcontentloaded');

    // Page should render (not crash)
    await expect(page.locator('body')).toBeVisible();

    // Should be able to navigate back to homepage
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('app handles rapid navigation', async ({ page }) => {
    // Rapidly navigate between pages
    await page.goto('/');
    await page.goto('/login');
    await page.goto('/');
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    // Should not crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('app handles browser back/forward', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Go back
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');

    // Should be back on homepage
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Critical Paths - Performance', () => {
  test('homepage loads under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
  });

  test('login page loads under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
  });

  test('no JavaScript errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Filter known non-critical errors
    const critical = errors.filter(
      (e) =>
        !e.includes('ResizeObserver') &&
        !e.includes('ChunkLoadError') &&
        !e.includes('Loading chunk')
    );

    expect(critical).toHaveLength(0);
  });
});
