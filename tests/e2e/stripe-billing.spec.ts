import { test, expect } from '@playwright/test';

/**
 * Stripe / Billing E2E Tests
 *
 * Verifies Stripe-related API endpoint contracts.
 * Tests webhook security, checkout auth, and portal auth.
 */

test.describe('Stripe Webhook Endpoint', () => {
  test('POST /api/stripe/webhook rejects unsigned requests', async ({ request }) => {
    const response = await request.post('/api/stripe/webhook', {
      data: JSON.stringify({
        id: 'evt_test',
        type: 'checkout.session.completed',
        data: { object: {} },
      }),
      headers: {
        'Content-Type': 'application/json',
        // No stripe-signature header
      },
    });

    // Should reject without valid Stripe signature (400 or 401)
    expect([400, 401, 403, 500]).toContain(response.status());
  });

  test('POST /api/stripe/webhook rejects invalid signature', async ({ request }) => {
    const response = await request.post('/api/stripe/webhook', {
      data: JSON.stringify({
        id: 'evt_test',
        type: 'checkout.session.completed',
        data: { object: {} },
      }),
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=1234567890,v1=invalid_signature_value',
      },
    });

    // Should reject with invalid signature
    expect([400, 401, 403, 500]).toContain(response.status());
  });

  test('GET /api/stripe/webhook returns 405 Method Not Allowed', async ({ request }) => {
    const response = await request.get('/api/stripe/webhook');
    // Webhook only accepts POST
    expect([404, 405]).toContain(response.status());
  });
});

test.describe('Stripe Checkout Endpoint', () => {
  test('POST /api/stripe/checkout rejects unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/stripe/checkout', {
      data: { tier: 'plus' },
      headers: { 'Content-Type': 'application/json' },
    });

    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/stripe/checkout rejects empty body', async ({ request }) => {
    const response = await request.post('/api/stripe/checkout', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });

    // Should fail auth first
    expect([400, 401, 403]).toContain(response.status());
  });
});

test.describe('Stripe Portal Endpoint', () => {
  test('POST /api/stripe/portal rejects unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/stripe/portal', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });

    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Subscription Endpoint', () => {
  test('GET /api/user/subscription rejects unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/user/subscription');
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/user/usage rejects unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/user/usage');
    expect([401, 403]).toContain(response.status());
  });
});
