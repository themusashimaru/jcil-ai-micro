import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock supabase client
const mockUpsert = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      upsert: (...args: unknown[]) => mockUpsert(...args),
    }),
  }),
}));

// Import after mocks
const { POST } = await import('../route');

describe('POST /api/waitlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set env vars for supabase
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  it('returns 400 when email is missing', async () => {
    const request = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('valid email');
  });

  it('returns 400 when email is invalid', async () => {
    const request = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it('returns 400 for empty string email', async () => {
    const request = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: '' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it('stores valid email and returns success', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const request = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com' }),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('normalizes email to lowercase', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const request = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'User@EXAMPLE.com' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' }),
      expect.any(Object)
    );
  });

  it('includes source in upsert when provided', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const request = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', source: 'blog_post' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'blog_post' }),
      expect.any(Object)
    );
  });

  it('still returns success when supabase upsert fails (graceful degradation)', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'Table not found' } });

    const request = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });

  it('returns success even without supabase configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const request = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(200);
  });

  it('returns 500 when request body is not JSON', async () => {
    const request = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      body: 'not json',
    });
    const response = await POST(request as never);
    expect(response.status).toBe(500);
  });
});
