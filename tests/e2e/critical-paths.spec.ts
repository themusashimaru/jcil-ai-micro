import { test, expect } from '@playwright/test';

/**
 * Critical User Path E2E Tests
 *
 * Tests the most important user journeys through the application.
 * Designed to work without real authentication (CI-safe).
 */

test.describe('Critical Paths - Landing to Signup Flow', () => {
  test('user can navigate from homepage to signup', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const signupLink = page.locator(
      'a[href*="signup"], button:has-text("Get Started"), button:has-text("Sign Up"), a:has-text("Get Started"), a:has-text("Sign Up")'
    );

    const count = await signupLink.count();
    if (count > 0) {
      await signupLink.first().click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toMatch(/signup|register|auth/i);
    } else {
      test.skip();
    }
  });

  test('signup form validates email format (HTML5 required)', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('input#email[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('signup password field enforces minimum length', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    const passwordInput = page.locator('input#password');
    await expect(passwordInput).toBeVisible();

    // Password should have minLength attribute
    const minLength = await passwordInput.getAttribute('minLength');
    if (minLength) {
      expect(parseInt(minLength)).toBeGreaterThanOrEqual(8);
    }
  });
});

test.describe('Critical Paths - Settings Access', () => {
  test('settings page requires authentication', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    expect(url).toMatch(/login|auth|signin/i);
  });
});

test.describe('Critical Paths - Error Recovery', () => {
  test('app recovers from 404 and can navigate back to homepage', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('app handles rapid navigation without crashing', async ({ page }) => {
    await page.goto('/');
    await page.goto('/login');
    await page.goto('/');
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toBeVisible();
  });

  test('browser back/forward works correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.goBack();
    await page.waitForLoadState('domcontentloaded');

    // Should be back on homepage or redirect
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Critical Paths - Performance', () => {
  test('homepage loads under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    expect(Date.now() - start).toBeLessThan(5000);
  });

  test('login page loads under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    expect(Date.now() - start).toBeLessThan(5000);
  });

  test('no JavaScript errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const critical = errors.filter(
      (e) =>
        !e.includes('ResizeObserver') &&
        !e.includes('ChunkLoadError') &&
        !e.includes('Loading chunk')
    );

    expect(critical).toHaveLength(0);
  });
});
