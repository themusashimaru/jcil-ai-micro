import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock Supabase (for webhook event tracking and user updates)
const mockSupabaseSelect = vi.fn();
const mockSupabaseInsert = vi.fn();
const mockSupabaseUpdate = vi.fn();
const mockSupabaseEq = vi.fn();

const mockSupabaseAdmin = {
  from: (table: string) => {
    return {
      select: (...args: unknown[]) => {
        mockSupabaseSelect(table, ...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockSupabaseEq(table, ...eqArgs);
            return {
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
              eq: () => ({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            };
          },
        };
      },
      insert: (data: unknown) => {
        mockSupabaseInsert(table, data);
        return Promise.resolve({ error: null });
      },
      update: (data: unknown) => {
        mockSupabaseUpdate(table, data);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockSupabaseEq(table, ...eqArgs);
            return Promise.resolve({ error: null });
          },
        };
      },
    };
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseAdmin,
}));

// Mock Stripe
const mockConstructEvent = vi.fn();
vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
  },
}));

// Mock headers
const mockHeadersGet = vi.fn();
vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve({
      get: (name: string) => mockHeadersGet(name),
    }),
}));

const { POST } = await import('../route');

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: valid signature header
    mockHeadersGet.mockImplementation((name: string) => {
      if (name === 'stripe-signature') return 'whsec_test_signature';
      return null;
    });
  });

  it('returns 400 when no signature header', async () => {
    mockHeadersGet.mockReturnValue(null);

    const req = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: '{}',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('No signature');
  });

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const req = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: 'invalid payload',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid signature');
  });

  it('processes valid events and marks them', async () => {
    // Event not yet processed
    mockSupabaseEq.mockImplementation(() => ({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    mockConstructEvent.mockReturnValue({
      id: 'evt_new_123',
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'inv_123' } },
    });

    const req = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: '{}',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    // Should mark event as processed
    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      'stripe_webhook_events',
      expect.objectContaining({
        event_id: 'evt_new_123',
        event_type: 'invoice.payment_succeeded',
      })
    );
  });

  it('handles checkout.session.completed event', async () => {
    // Not already processed
    mockSupabaseEq.mockImplementation((table: string) => {
      if (table === 'stripe_webhook_events') {
        return {
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'users') {
        return {
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-123', stripe_customer_id: null },
            error: null,
          }),
          eq: () => Promise.resolve({ error: null }),
        };
      }
      return {
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    mockConstructEvent.mockReturnValue({
      id: 'evt_checkout_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { user_id: 'user-123', tier: 'pro' },
          customer: 'cus_abc',
        },
      },
    });

    const req = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: '{}',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      'stripe_webhook_events',
      expect.objectContaining({ event_id: 'evt_checkout_123' })
    );
  });

  it('handles unhandled event types gracefully', async () => {
    mockSupabaseEq.mockImplementation(() => ({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    mockConstructEvent.mockReturnValue({
      id: 'evt_unknown_123',
      type: 'some.unknown.event',
      data: { object: {} },
    });

    const req = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: '{}',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });

  it('returns 500 when event processing throws', async () => {
    mockSupabaseEq.mockImplementation(() => ({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    mockConstructEvent.mockReturnValue({
      id: 'evt_error_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { user_id: 'user-123', tier: 'pro' },
          customer: 'cus_abc',
        },
      },
    });

    // Make the user lookup throw
    mockSupabaseSelect.mockImplementation((table: string) => {
      if (table === 'users') throw new Error('DB connection lost');
    });

    const req = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: '{}',
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
