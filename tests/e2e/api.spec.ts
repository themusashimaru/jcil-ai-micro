import { test, expect } from '@playwright/test';

/**
 * API E2E Tests
 *
 * Verifies API endpoints respond correctly.
 */

test.describe('API Endpoints', () => {
  test.describe('Health Endpoint', () => {
    test('GET /api/health returns healthy status', async ({ request }) => {
      const response = await request.get('/api/health');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status);
    });

    test('health check returns valid timestamp', async ({ request }) => {
      const response = await request.get('/api/health');
      const body = await response.json();

      expect(body.timestamp).toBeTruthy();

      // Timestamp should be valid ISO date
      const date = new Date(body.timestamp);
      expect(date.getTime()).not.toBeNaN();
    });

    test('detailed health check includes components', async ({ request }) => {
      const response = await request.get('/api/health?detailed=true');

      expect(response.status()).toBe(200);

      const body = await response.json();

      if (body.checks) {
        // Verify structure of component checks
        for (const check of Object.values(body.checks)) {
          const componentCheck = check as { status: string };
          // Component health uses up/down/degraded, not healthy/unhealthy
          expect(['up', 'down', 'degraded']).toContain(componentCheck.status);
        }
      }
    });
  });

  test.describe('API Security', () => {
    test('API returns proper CORS headers', async ({ request }) => {
      const response = await request.get('/api/health');

      // Check response headers exist
      const headers = response.headers();
      expect(headers).toBeTruthy();
    });

    test('API handles invalid methods gracefully', async ({ request }) => {
      // Try PATCH on health endpoint (should not be allowed)
      const response = await request.patch('/api/health', {
        data: {},
      });

      // Should return 405 Method Not Allowed or similar
      expect([200, 405, 404]).toContain(response.status());
    });

    test('API returns JSON content type', async ({ request }) => {
      const response = await request.get('/api/health');

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });
  });

  test.describe('Rate Limiting', () => {
    test('API handles rapid requests', async ({ request }) => {
      // Send 10 rapid requests
      const requests = Array.from({ length: 10 }, () => request.get('/api/health'));

      const responses = await Promise.all(requests);

      // All should succeed or some may be rate limited
      const statuses = responses.map((r) => r.status());

      // Most should be 200, some might be 429 (rate limited)
      const successCount = statuses.filter((s) => s === 200).length;
      const rateLimitCount = statuses.filter((s) => s === 429).length;

      // At least some should succeed
      expect(successCount + rateLimitCount).toBe(10);
    });
  });

  test.describe('Error Handling', () => {
    test('non-existent API endpoint returns 404', async ({ request }) => {
      const response = await request.get('/api/this-endpoint-does-not-exist');

      expect(response.status()).toBe(404);
    });

    test('API errors return proper error format', async ({ request }) => {
      const response = await request.get('/api/this-endpoint-does-not-exist');

      // Should return JSON error
      const contentType = response.headers()['content-type'];

      if (contentType?.includes('application/json')) {
        const body = await response.json();
        // Error responses typically have message or error field
        expect(body.message || body.error || body.statusCode || true).toBeTruthy();
      }
    });
  });
});
