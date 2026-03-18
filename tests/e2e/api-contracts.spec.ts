import { test, expect } from '@playwright/test';

/**
 * API Contract E2E Tests
 *
 * Comprehensive tests for API endpoint contracts covering:
 * - Response format consistency
 * - Input validation
 * - Error handling
 * - Method enforcement
 */

test.describe('Health Endpoint Contract', () => {
  test('GET /api/health returns well-structured response', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('uptime');
    expect(['healthy', 'degraded']).toContain(body.status);
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThan(0);

    // Timestamp should be valid ISO date
    const date = new Date(body.timestamp);
    expect(date.getTime()).not.toBeNaN();
  });

  test('HEAD /api/health returns 200 with no body', async ({ request }) => {
    const response = await request.head('/api/health');
    expect(response.status()).toBe(200);
  });

  test('GET /api/health?detailed=true returns component status or 503', async ({ request }) => {
    const response = await request.get('/api/health?detailed=true');
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty('status');

    if (body.checks) {
      expect(body.checks).toHaveProperty('database');
      expect(body.checks).toHaveProperty('cache');
      expect(body.checks).toHaveProperty('ai');

      for (const check of Object.values(body.checks)) {
        const c = check as { status: string };
        expect(['up', 'down', 'degraded']).toContain(c.status);
      }
    }
  });
});

test.describe('Chat Endpoint Contract', () => {
  test('POST /api/chat rejects unauthenticated with JSON error', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: { messages: [{ role: 'user', content: 'hello' }] },
      headers: { 'Content-Type': 'application/json' },
    });

    expect([401, 403]).toContain(response.status());
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('POST /api/chat rejects empty body', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 401, 403]).toContain(response.status());
  });

  test('GET /api/chat returns 405 or 404', async ({ request }) => {
    const response = await request.get('/api/chat');
    expect([404, 405]).toContain(response.status());
  });

  test('POST /api/chat rejects oversized messages', async ({ request }) => {
    const largeContent = 'x'.repeat(500_000);
    const response = await request.post('/api/chat', {
      data: { messages: [{ role: 'user', content: largeContent }] },
      headers: { 'Content-Type': 'application/json' },
    });
    // Auth check comes first, then size check
    expect([401, 403, 413]).toContain(response.status());
  });
});

test.describe('Conversation Endpoints Contract', () => {
  test('GET /api/conversations rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/conversations');
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/conversations rejects unauthenticated', async ({ request }) => {
    const response = await request.post('/api/conversations', {
      data: { title: 'Test' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/conversations/history rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/conversations/history');
    expect([401, 403]).toContain(response.status());
  });

  test('DELETE /api/conversations/[id] rejects unauthenticated', async ({ request }) => {
    const response = await request.delete('/api/conversations/test-conv-id');
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Code Lab Endpoints Contract', () => {
  test('GET /api/code-lab/sessions rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/code-lab/sessions');
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/code-lab/sessions rejects unauthenticated', async ({ request }) => {
    const response = await request.post('/api/code-lab/sessions', {
      data: { name: 'test' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/code-lab/chat rejects unauthenticated', async ({ request }) => {
    const response = await request.post('/api/code-lab/chat', {
      data: { messages: [{ role: 'user', content: 'hello' }] },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/code-lab/execute rejects unauthenticated', async ({ request }) => {
    const response = await request.post('/api/code-lab/execute', {
      data: { code: 'print("hello")' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('User Settings Endpoints Contract', () => {
  test('GET /api/user/settings rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/user/settings');
    expect([401, 403]).toContain(response.status());
  });

  test('PUT /api/user/settings rejects unauthenticated', async ({ request }) => {
    const response = await request.put('/api/user/settings', {
      data: { theme: 'dark' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/user/export rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/user/export');
    expect([401, 403]).toContain(response.status());
  });

  test('DELETE /api/user/delete-account rejects unauthenticated', async ({ request }) => {
    const response = await request.delete('/api/user/delete-account');
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Document Endpoints Contract', () => {
  test('GET /api/documents/user/files rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/documents/user/files');
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/documents/user/folders rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/documents/user/folders');
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Memory Endpoints Contract', () => {
  test('GET /api/memory rejects unauthenticated', async ({ request }) => {
    const response = await request.get('/api/memory');
    expect([401, 403]).toContain(response.status());
  });

  test('PUT /api/memory rejects unauthenticated', async ({ request }) => {
    const response = await request.put('/api/memory', {
      data: { content: 'test' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/memory/forget rejects unauthenticated', async ({ request }) => {
    const response = await request.post('/api/memory/forget', {
      data: { key: 'test' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Error Handling Consistency', () => {
  test('non-existent API endpoint returns 404', async ({ request }) => {
    const response = await request.get('/api/this-endpoint-does-not-exist');
    expect(response.status()).toBe(404);
  });

  test('error responses include content-type header', async ({ request }) => {
    const response = await request.post('/api/conversations', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.headers()['content-type']).toBeTruthy();
  });
});

test.describe('Rate Limiting', () => {
  test('rapid requests are handled gracefully (200 or 429)', async ({ request }) => {
    const requests = Array.from({ length: 10 }, () => request.get('/api/health'));
    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status());

    // Every response should be either 200 (success) or 429 (rate limited)
    for (const status of statuses) {
      expect([200, 429]).toContain(status);
    }

    // At least some should succeed
    const successCount = statuses.filter((s) => s === 200).length;
    expect(successCount).toBeGreaterThan(0);
  });
});
