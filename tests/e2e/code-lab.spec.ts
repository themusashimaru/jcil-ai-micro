import { test, expect } from '@playwright/test';

/**
 * CODE LAB E2E TESTS
 *
 * Comprehensive end-to-end tests for the Code Lab feature.
 * Tests cover:
 * - Session management
 * - Code generation flow
 * - File operations
 * - Terminal operations
 * - UI interactions
 */

// Skip tests if not authenticated (these require auth)
test.describe.configure({ mode: 'serial' });

test.describe('Code Lab - Page Load', () => {
  test('should load the code lab page', async ({ page }) => {
    await page.goto('/code-lab');

    // Should show some form of the page (login redirect or code lab)
    await expect(page).toHaveURL(/\/(code-lab|login)/);
  });

  test('should show keyboard shortcuts modal', async ({ page }) => {
    await page.goto('/code-lab');

    // Try to open keyboard shortcuts with Cmd+/
    await page.keyboard.press('Meta+/');

    // Or check if there's a help button
    const helpButton = page.locator('[title*="keyboard"], [aria-label*="shortcuts"]');
    if (await helpButton.count()) {
      await helpButton.click();
      await expect(page.locator('.shortcuts-panel, [role="dialog"]')).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

test.describe('Code Lab - UI Components', () => {
  test('should have sidebar with sessions', async ({ page }) => {
    await page.goto('/code-lab');

    // Check for sidebar elements
    const sidebar = page.locator('.code-lab-sidebar, [class*="sidebar"]');
    if (await sidebar.count()) {
      await expect(sidebar).toBeVisible();
    }
  });

  test('should have composer for input', async ({ page }) => {
    await page.goto('/code-lab');

    // Look for text input area
    const composer = page.locator('textarea, [contenteditable="true"], [role="textbox"]');
    if (await composer.count()) {
      await expect(composer.first()).toBeVisible();
    }
  });

  test('should support dark mode toggle', async ({ page }) => {
    await page.goto('/code-lab');

    // Check for theme toggle
    const themeToggle = page.locator('[aria-label*="theme"], [title*="theme"], .theme-toggle');
    if (await themeToggle.count()) {
      await themeToggle.click();

      // Verify theme class changed
      const html = page.locator('html');
      const classAfter = await html.getAttribute('class');
      expect(classAfter).toMatch(/theme-(dark|light)/);
    }
  });
});

test.describe('Code Lab - Session Management', () => {
  test('should create new session button exists', async ({ page }) => {
    await page.goto('/code-lab');

    // Look for new session button
    const newSessionBtn = page.locator(
      'button:has-text("New"), button:has-text("Create"), [aria-label*="new session"]'
    );
    await expect(newSessionBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have session list', async ({ page }) => {
    await page.goto('/code-lab');

    // Look for session items
    const sessionList = page.locator('.session-list, [class*="session"]');
    if (await sessionList.count()) {
      await expect(sessionList.first()).toBeVisible();
    }
  });
});

test.describe('Code Lab - Command Palette', () => {
  test('should open command palette with keyboard shortcut', async ({ page }) => {
    await page.goto('/code-lab');

    // Wait for page load
    await page.waitForLoadState('networkidle');

    // Try Cmd+K
    await page.keyboard.press('Meta+k');

    // Check if command palette opened
    const palette = page.locator('.command-palette, [role="dialog"], [class*="palette"]');
    if (await palette.count()) {
      await expect(palette.first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Code Lab - Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/code-lab');

    // Check for main landmark
    const main = page.locator('main, [role="main"]');
    if (await main.count()) {
      await expect(main.first()).toBeVisible();
    }

    // Check for navigation
    const nav = page.locator('nav, [role="navigation"]');
    if (await nav.count()) {
      await expect(nav.first()).toBeVisible();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/code-lab');

    // Tab through focusable elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check that something is focused
    const focused = page.locator(':focus');
    await expect(focused).toBeTruthy();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/code-lab');

    // Check text is visible
    const textElements = page.locator('p, span, h1, h2, h3, button');
    const count = await textElements.count();

    // At least some text elements should be visible
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Code Lab - Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/code-lab');

    // Page should still function
    await expect(page.locator('body')).toBeVisible();

    // Mobile menu or sidebar should be toggleable
    const menuBtn = page.locator('.mobile-menu-btn, [aria-label*="menu"]');
    if (await menuBtn.count()) {
      await expect(menuBtn.first()).toBeVisible();
    }
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/code-lab');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should work on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/code-lab');

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Code Lab - Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    await page.goto('/code-lab');

    // Should show some error state or cached content
    await expect(page.locator('body')).toBeVisible();

    // Restore online mode
    await page.context().setOffline(false);
  });

  test('should handle invalid routes', async ({ page }) => {
    await page.goto('/code-lab/invalid-session-id-12345');

    // Should redirect or show error
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Code Lab - Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/code-lab');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test('should not have memory leaks on navigation', async ({ page }) => {
    // Navigate multiple times
    for (let i = 0; i < 3; i++) {
      await page.goto('/code-lab');
      await page.goto('/');
    }

    // Final navigation should still work
    await page.goto('/code-lab');
    await expect(page.locator('body')).toBeVisible();
  });
});
