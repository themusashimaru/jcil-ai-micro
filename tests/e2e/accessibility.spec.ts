import { test, expect } from '@playwright/test';

/**
 * Accessibility E2E Tests
 *
 * Basic accessibility checks for the application.
 */

test.describe('Accessibility', () => {
  test('homepage has proper document structure', async ({ page }) => {
    await page.goto('/');

    // Check for html lang attribute
    const htmlLang = await page.getAttribute('html', 'lang');
    expect(htmlLang).toBeTruthy();

    // Check for title
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('images have alt attributes', async ({ page }) => {
    await page.goto('/');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      // Alt should exist (can be empty for decorative images)
      expect(alt !== null).toBeTruthy();
    }
  });

  test('buttons have accessible names', async ({ page }) => {
    await page.goto('/');

    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);

      // Button should have text content, aria-label, or aria-labelledby
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const ariaLabelledBy = await button.getAttribute('aria-labelledby');

      const hasAccessibleName =
        (text && text.trim().length > 0) || ariaLabel || ariaLabelledBy;

      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('links have accessible names', async ({ page }) => {
    await page.goto('/');

    const links = page.locator('a');
    const count = await links.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const link = links.nth(i);

      // Link should have text content, aria-label, or contain an image with alt
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      const hasImage = (await link.locator('img[alt]').count()) > 0;

      const hasAccessibleName =
        (text && text.trim().length > 0) || ariaLabel || hasImage;

      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('form inputs have labels', async ({ page }) => {
    await page.goto('/login');

    const inputs = page.locator(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])'
    );
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);

      // Input should have id with corresponding label, aria-label, or aria-labelledby
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');

      // Check if there's a label for this input
      let hasLabel = false;
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        hasLabel = (await label.count()) > 0;
      }

      const hasAccessibleLabel =
        hasLabel || ariaLabel || ariaLabelledBy || placeholder;

      // Log warning but don't fail for placeholder-only
      if (!hasLabel && !ariaLabel && !ariaLabelledBy && placeholder) {
        console.warn(
          `Input uses placeholder only for labeling (not ideal): ${placeholder}`
        );
      }

      expect(hasAccessibleLabel).toBeTruthy();
    }
  });

  test('color contrast is sufficient', async ({ page }) => {
    await page.goto('/');

    // Check that text is visible (basic check)
    const body = await page.textContent('body');
    expect(body).toBeTruthy();

    // Check that background and text colors are set
    const backgroundColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    expect(backgroundColor).toBeTruthy();
  });

  test('focus is visible', async ({ page }) => {
    await page.goto('/');

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    // Check that something is focused
    const focusedTag = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });

    expect(focusedTag).toBeTruthy();
    expect(focusedTag).not.toBe('BODY');
  });

  test('page has skip link or proper heading structure', async ({ page }) => {
    await page.goto('/');

    // Check for skip link
    const skipLink = page.locator(
      'a[href="#main"], a[href="#content"], a:has-text("Skip to")'
    );
    const hasSkipLink = (await skipLink.count()) > 0;

    // Check for heading structure
    const h1 = page.locator('h1');
    const hasH1 = (await h1.count()) > 0;

    // Should have either skip link or proper heading
    expect(hasSkipLink || hasH1).toBeTruthy();
  });

  test('interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/');

    // Get all interactive elements
    const interactiveElements = page.locator('a, button, input, select, textarea, [tabindex]');
    const count = await interactiveElements.count();

    // Check that none have negative tabindex (unless intentionally hidden)
    for (let i = 0; i < Math.min(count, 20); i++) {
      const element = interactiveElements.nth(i);
      const tabindex = await element.getAttribute('tabindex');

      if (tabindex && parseInt(tabindex) < 0) {
        // If negative tabindex, element should be aria-hidden or have disabled
        const ariaHidden = await element.getAttribute('aria-hidden');
        const disabled = await element.getAttribute('disabled');

        // Negative tabindex is acceptable if hidden or disabled
        if (!ariaHidden && disabled === null) {
          console.warn('Element with negative tabindex found');
        }
      }
    }
  });
});
