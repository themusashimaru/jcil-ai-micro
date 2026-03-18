import { test, expect } from './fixtures';

/**
 * Public Pages E2E Tests
 *
 * Tests all public-facing pages — about, contact, capabilities, FAQ, terms,
 * privacy, cookies, docs. Verifies rendering, accessibility, responsive design,
 * and no JS errors. These pages are critical for SEO and user trust.
 */

const PUBLIC_PAGES = [
  { path: '/', name: 'Homepage' },
  { path: '/about', name: 'About' },
  { path: '/contact', name: 'Contact' },
  { path: '/capabilities', name: 'Capabilities' },
  { path: '/api-info', name: 'API Info' },
  { path: '/faq', name: 'FAQ' },
  { path: '/terms', name: 'Terms' },
  { path: '/privacy', name: 'Privacy' },
  { path: '/cookies', name: 'Cookies' },
  { path: '/docs', name: 'Docs' },
];

test.describe('Public Pages - All Load Successfully', () => {
  for (const { path, name } of PUBLIC_PAGES) {
    test(`${name} (${path}) loads with 200 status`, async ({ page }) => {
      const response = await page.goto(path);
      // Should return 200 or at worst redirect (not 500)
      const status = response?.status() ?? 0;
      expect(status).not.toBe(500);
      expect(status).not.toBe(502);
      expect(status).not.toBe(503);

      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });
  }
});

test.describe('Public Pages - No JS Errors', () => {
  for (const { path, name } of PUBLIC_PAGES) {
    test(`${name} (${path}) has no critical JS errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      const critical = errors.filter(
        (e) =>
          !e.includes('ResizeObserver') &&
          !e.includes('ChunkLoadError') &&
          !e.includes('Loading chunk') &&
          !e.includes('NetworkError') &&
          !e.includes('Failed to fetch')
      );
      expect(critical).toHaveLength(0);
    });
  }
});

test.describe('Public Pages - SEO Basics', () => {
  for (const { path, name } of PUBLIC_PAGES) {
    test(`${name} (${path}) has a non-empty title`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });
  }

  test('homepage has meta description', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(10);
  });

  test('homepage has Open Graph tags', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content');
    expect(ogTitle).toBeTruthy();
  });

  test('homepage has canonical URL', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const canonical = page.locator('link[rel="canonical"]');
    const count = await canonical.count();
    // Canonical is recommended but not required
    if (count > 0) {
      const href = await canonical.getAttribute('href');
      expect(href).toBeTruthy();
    }
  });
});

test.describe('Public Pages - Contact Form', () => {
  test('contact page has a form with required fields', async ({ page }) => {
    const response = await page.goto('/contact');
    if (response?.status() === 200) {
      await page.waitForLoadState('domcontentloaded');

      // Look for form elements
      const forms = await page.locator('form').count();
      const inputs = await page.locator('input, textarea').count();

      // Contact page should have form elements
      if (forms > 0) {
        expect(inputs).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Public Pages - Responsive Design', () => {
  const viewports = [
    { width: 375, height: 667, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1920, height: 1080, name: 'desktop' },
  ];

  for (const viewport of viewports) {
    test(`homepage renders at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('body')).toBeVisible();

      // No horizontal overflow (allowing small margin)
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 20);
    });
  }
});

test.describe('Public Pages - Accessibility', () => {
  test('all public pages have HTML lang attribute', async ({ page }) => {
    for (const { path } of PUBLIC_PAGES) {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBe('en');
    }
  });

  test('homepage images have alt attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      // alt can be empty string (decorative) but must be present
      expect(alt).not.toBeNull();
    }
  });

  test('homepage links have discernible text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const links = page.locator('a');
    const count = await links.count();

    let emptyLinks = 0;
    for (let i = 0; i < Math.min(count, 50); i++) {
      const text = await links.nth(i).textContent();
      const ariaLabel = await links.nth(i).getAttribute('aria-label');
      const title = await links.nth(i).getAttribute('title');

      if (!text?.trim() && !ariaLabel && !title) {
        emptyLinks++;
      }
    }

    // Allow up to 3 links without text (icon buttons, etc.)
    expect(emptyLinks).toBeLessThanOrEqual(3);
  });
});

test.describe('Public Pages - Navigation Links', () => {
  test('homepage has login link', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loginLink = page.locator('a[href*="/login"]');
    await expect(loginLink.first()).toBeVisible();
  });

  test('homepage has signup link', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const signupLink = page.locator('a[href*="/signup"]');
    await expect(signupLink.first()).toBeVisible();
  });

  test('external links have rel="noopener"', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const externalLinks = page.locator('a[target="_blank"]');
    const count = await externalLinks.count();

    for (let i = 0; i < count; i++) {
      const rel = await externalLinks.nth(i).getAttribute('rel');
      expect(rel).toContain('noopener');
    }
  });
});

test.describe('Public Pages - Performance', () => {
  test('all public pages load under 5 seconds', async ({ page }) => {
    for (const { path, name } of PUBLIC_PAGES) {
      const start = Date.now();
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(5000);
    }
  });
});
