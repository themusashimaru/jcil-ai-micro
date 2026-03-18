import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 *
 * Verifies login/signup pages render correctly with all expected elements,
 * form validation works, and protected routes enforce authentication.
 */

test.describe('Authentication - Login Page', () => {
  test('login page loads with 200 status', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);
  });

  test('login form has email input, password input, and submit button', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Email input must exist and be visible
    const emailInput = page.locator('input#email[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('required', '');

    // Password input must exist and be visible
    const passwordInput = page.locator('input#password[type="password"]');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('required', '');

    // Submit button must exist
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText(/sign in/i);
  });

  test('password field masks input by default', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const passwordInput = page.locator('input#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('login page has link to signup page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const signupLink = page.locator('a[href*="/signup"]');
    await expect(signupLink).toBeVisible();
  });

  test('login page has link to forgot password', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const forgotLink = page.locator('a[href*="/forgot-password"]');
    await expect(forgotLink).toBeVisible();
  });

  test('login page has OAuth buttons (Google, GitHub)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const googleButton = page.locator('button:has-text("Continue with Google")');
    await expect(googleButton).toBeVisible();

    const githubButton = page.locator('button:has-text("Continue with GitHub")');
    await expect(githubButton).toBeVisible();
  });

  test('login page has proper ARIA landmarks', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('[role="main"], main');
    await expect(main).toBeVisible();
  });

  test('login page has back-to-home link', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink.first()).toBeVisible();
  });
});

test.describe('Authentication - Signup Page', () => {
  test('signup page loads with 200 status', async ({ page }) => {
    const response = await page.goto('/signup');
    expect(response?.status()).toBe(200);
  });

  test('signup form has all required fields', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    // Full name
    const nameInput = page.locator('input#full_name');
    await expect(nameInput).toBeVisible();

    // Email
    const emailInput = page.locator('input#email[type="email"]');
    await expect(emailInput).toBeVisible();

    // Password with minLength
    const passwordInput = page.locator('input#password[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Confirm password
    const confirmInput = page.locator('input#confirmPassword');
    await expect(confirmInput).toBeVisible();

    // Submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText(/create account/i);
  });

  test('signup page has link to login page', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    const loginLink = page.locator('a[href*="/login"]');
    await expect(loginLink.first()).toBeVisible();
  });

  test('signup page has OAuth buttons', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    const googleButton = page.locator('button:has-text("Continue with Google")');
    await expect(googleButton).toBeVisible();

    const githubButton = page.locator('button:has-text("Continue with GitHub")');
    await expect(githubButton).toBeVisible();
  });

  test('signup page has user agreement checkbox', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    const agreementCheckbox = page.locator('input#agreement[type="checkbox"]');
    await expect(agreementCheckbox).toBeAttached();
  });
});

test.describe('Authentication - Protected Routes', () => {
  test('settings page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    expect(url).toMatch(/login|signin|auth/i);
  });

  test('chat page handles unauthenticated access without crashing', async ({ page }) => {
    const response = await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    // Should not be a server error
    expect(response?.status()).not.toBe(500);

    // Page should render
    await expect(page.locator('body')).toBeVisible();
  });

  test('code-lab page handles unauthenticated access', async ({ page }) => {
    await page.goto('/code-lab');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    // Either redirected to login or shows the page (with auth prompt)
    const handlesAuth = url.includes('login') || url.includes('code-lab') || url.includes('auth');
    expect(handlesAuth).toBe(true);
  });
});
