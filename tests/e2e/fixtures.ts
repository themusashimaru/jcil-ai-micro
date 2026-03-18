/* eslint-disable react-hooks/rules-of-hooks */
import { test as base } from '@playwright/test';

/**
 * Custom test fixture that blocks external network requests.
 *
 * In CI/test environments, external services (Google Fonts, analytics, etc.)
 * are unreachable and cause render-blocking timeouts. This fixture intercepts
 * and aborts requests to known external domains so pages load instantly.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Block external requests that cause render-blocking timeouts in CI
    await page.route(
      (url) => {
        const blocked = [
          'fonts.googleapis.com',
          'fonts.gstatic.com',
          'www.googletagmanager.com',
          'www.google-analytics.com',
          'analytics.google.com',
          'cdn.vercel-insights.com',
          'vitals.vercel-insights.com',
          'sentry.io',
        ];
        return blocked.some((domain) => url.hostname.includes(domain));
      },
      (route) => route.abort()
    );

    await use(page);
  },
});

export { expect } from '@playwright/test';
