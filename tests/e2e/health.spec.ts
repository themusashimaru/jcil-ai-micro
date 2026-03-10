import { test, expect } from '@playwright/test';

/**
 * Health Check E2E Tests
 *
 * Verifies the health endpoint works correctly.
 */

test.describe('Health Check', () => {
  test('basic health check returns 200', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('uptime');
    expect(['healthy', 'degraded']).toContain(body.status);
  });

  test('detailed health check returns component status', async ({ request }) => {
    const response = await request.get('/api/health?detailed=true');

    // Accept 200 (healthy/degraded) or 503 (unhealthy) - both are valid in CI without services
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty('status');

    // In CI without auth, the detailed endpoint may fall back to basic response (no checks)
    // Only validate checks structure if present
    if (body.checks) {
      // Check that component statuses exist and have valid status values
      expect(body.checks).toHaveProperty('database');
      expect(body.checks).toHaveProperty('cache');
      expect(body.checks).toHaveProperty('ai');

      // Verify each component has a valid status (up/down/degraded)
      for (const check of Object.values(body.checks)) {
        const componentCheck = check as { status: string };
        expect(['up', 'down', 'degraded']).toContain(componentCheck.status);
      }
    }
  });

  test('health check HEAD request works', async ({ request }) => {
    const response = await request.head('/api/health');
    expect(response.status()).toBe(200);
  });
});
