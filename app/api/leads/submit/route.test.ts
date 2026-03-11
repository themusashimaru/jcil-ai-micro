/**
 * Tests for POST /api/leads/submit and OPTIONS /api/leads/submit
 *
 * This endpoint is PUBLIC (no auth guard) — it receives contact form
 * submissions from generated websites. CORS is restricted to known
 * hosting platforms.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Supabase mock helpers — implementations are set up in beforeEach
// because vi.clearAllMocks() wipes implementation details.
const mockSessionSingle = vi.fn();
const mockEq = vi.fn();
const mockSelectFrom = vi.fn();
const mockInsertSingle = vi.fn();
const mockInsertSelect = vi.fn();
const mockInsert = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();

function setupSupabaseMockChain() {
  mockEq.mockReturnValue({ single: mockSessionSingle });
  mockSelectFrom.mockReturnValue({ eq: mockEq });
  mockInsertSelect.mockReturnValue({ single: mockInsertSingle });
  mockInsert.mockReturnValue({ select: mockInsertSelect });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'website_sessions') {
      return { select: mockSelectFrom };
    }
    return { insert: mockInsert };
  });
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  body: Record<string, unknown>,
  options: { origin?: string; ip?: string } = {}
) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.origin) headers.set('origin', options.origin);
  if (options.ip) headers.set('x-forwarded-for', options.ip);

  return new NextRequest('http://localhost:3000/api/leads/submit', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  sessionId: 'abc-123',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1-555-1234',
  message: 'I am interested in your services, please contact me.',
  source: 'landing_page',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/leads/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set env vars for supabase client
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    // Re-establish mock chain (vi.clearAllMocks wipes implementations)
    setupSupabaseMockChain();

    // Default: session lookup succeeds
    mockSessionSingle.mockResolvedValue({
      data: { id: 'abc-123', user_id: 'user-1', business_name: 'Acme' },
      error: null,
    });

    // Default: insert succeeds
    mockInsertSingle.mockResolvedValue({
      data: { id: 'lead-1' },
      error: null,
    });

    // Need to reimport the module fresh to reset in-memory rate limit map
    vi.resetModules();
  });

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it('returns 201 with success on valid submission', async () => {
    const { POST } = await import('./route');
    const req = makeRequest(VALID_BODY, { ip: '10.0.0.1' });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toContain('Thank you');
    expect(json.leadId).toBe('lead-1');
  });

  it('inserts sanitized data into website_leads', async () => {
    const { POST } = await import('./route');
    const body = {
      ...VALID_BODY,
      name: '<script>alert("x")</script>',
    };
    const req = makeRequest(body, { ip: '10.0.0.2' });
    await POST(req);

    // The insert call should have been made with sanitized name
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_name: expect.not.stringContaining('<script>'),
        session_id: 'abc-123',
        user_id: 'user-1',
        status: 'new',
      })
    );
  });

  it('defaults source to contact_form when not provided', async () => {
    const { POST } = await import('./route');
    const { source: _source, ...bodyNoSource } = VALID_BODY;
    const req = makeRequest(bodyNoSource, { ip: '10.0.0.3' });
    await POST(req);

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ source: 'contact_form' }));
  });

  it('sets lead_phone to null when phone is omitted', async () => {
    const { POST } = await import('./route');
    const { phone: _phone, ...bodyNoPhone } = VALID_BODY;
    const req = makeRequest(bodyNoPhone, { ip: '10.0.0.4' });
    await POST(req);

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ lead_phone: null }));
  });

  // -----------------------------------------------------------------------
  // CORS
  // -----------------------------------------------------------------------

  it('sets CORS headers for allowed origin (vercel.app)', async () => {
    const { POST } = await import('./route');
    const req = makeRequest(VALID_BODY, {
      origin: 'https://my-site.vercel.app',
      ip: '10.0.0.5',
    });
    const res = await POST(req);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://my-site.vercel.app');
    expect(res.headers.get('Vary')).toBe('Origin');
  });

  it('sets CORS origin to null for disallowed origin', async () => {
    const { POST } = await import('./route');
    const req = makeRequest(VALID_BODY, {
      origin: 'https://evil.com',
      ip: '10.0.0.6',
    });
    const res = await POST(req);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('null');
  });

  // -----------------------------------------------------------------------
  // Validation errors
  // -----------------------------------------------------------------------

  it('returns 400 when sessionId is missing', async () => {
    const { POST } = await import('./route');
    const { sessionId: _, ...body } = VALID_BODY;
    const res = await POST(makeRequest(body, { ip: '10.0.0.7' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/session/i);
  });

  it('returns 400 when name is too short', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeRequest({ ...VALID_BODY, name: 'X' }, { ip: '10.0.0.8' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/name/i);
  });

  it('returns 400 when name is empty string', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeRequest({ ...VALID_BODY, name: '' }, { ip: '10.0.0.9' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/name/i);
  });

  it('returns 400 when email is invalid', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      makeRequest({ ...VALID_BODY, email: 'not-an-email' }, { ip: '10.0.0.10' })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it('returns 400 when email is missing', async () => {
    const { POST } = await import('./route');
    const { email: _, ...body } = VALID_BODY;
    const res = await POST(makeRequest(body, { ip: '10.0.0.11' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it('returns 400 when message is too short', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeRequest({ ...VALID_BODY, message: 'Hi' }, { ip: '10.0.0.12' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/message/i);
  });

  it('returns 400 when message is missing', async () => {
    const { POST } = await import('./route');
    const { message: _, ...body } = VALID_BODY;
    const res = await POST(makeRequest(body, { ip: '10.0.0.13' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/message/i);
  });

  // -----------------------------------------------------------------------
  // Session lookup failures
  // -----------------------------------------------------------------------

  it('returns 400 when session is not found', async () => {
    mockSessionSingle.mockReset();
    mockSessionSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const { POST } = await import('./route');
    const res = await POST(makeRequest(VALID_BODY, { ip: '10.0.0.14' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid website/i);
  });

  // -----------------------------------------------------------------------
  // Supabase not configured
  // -----------------------------------------------------------------------

  it('returns 503 when supabase env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { POST } = await import('./route');
    const res = await POST(makeRequest(VALID_BODY, { ip: '10.0.0.15' }));

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/unavailable/i);
  });

  // -----------------------------------------------------------------------
  // Insert errors
  // -----------------------------------------------------------------------

  it('returns 500 when insert fails with non-table-missing error', async () => {
    // Insert fails with duplicate key
    mockInsertSingle.mockReset();
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'Duplicate key' },
    });

    const { POST } = await import('./route');
    const res = await POST(makeRequest(VALID_BODY, { ip: '10.0.0.16' }));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/failed to save/i);
  });

  it('returns 500 when table does not exist (42P01)', async () => {
    // Insert fails with table not found — no dynamic table creation
    mockInsertSingle.mockReset();
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    });

    const { POST } = await import('./route');
    const res = await POST(makeRequest(VALID_BODY, { ip: '10.0.0.17' }));

    // Should NOT call exec_sql (removed for security)
    expect(mockRpc).not.toHaveBeenCalled();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/failed to save/i);
  });

  // -----------------------------------------------------------------------
  // Rate limiting
  // -----------------------------------------------------------------------

  it('returns 429 after exceeding rate limit (5 per hour per IP)', async () => {
    const { POST } = await import('./route');
    const ip = '10.99.99.99';

    // Defaults from beforeEach are already set (session + insert succeed)

    // Make 5 successful requests
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest(VALID_BODY, { ip }));
      expect(res.status).toBe(201);
    }

    // 6th request should be rate limited
    const res = await POST(makeRequest(VALID_BODY, { ip }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/too many/i);
  });

  // -----------------------------------------------------------------------
  // Unexpected errors
  // -----------------------------------------------------------------------

  it('returns 500 when request.json() throws', async () => {
    const { POST } = await import('./route');

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('x-forwarded-for', '10.0.0.19');
    const req = new NextRequest('http://localhost:3000/api/leads/submit', {
      method: 'POST',
      headers,
      body: 'not json{{{',
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/something went wrong/i);
  });
});

// ---------------------------------------------------------------------------
// OPTIONS (CORS preflight)
// ---------------------------------------------------------------------------

describe('OPTIONS /api/leads/submit', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  it('returns 200 with CORS headers for allowed origin', async () => {
    const { OPTIONS } = await import('./route');
    const req = new NextRequest('http://localhost:3000/api/leads/submit', {
      method: 'OPTIONS',
      headers: { origin: 'https://myapp.vercel.app' },
    });
    const res = await OPTIONS(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://myapp.vercel.app');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
  });

  it('returns CORS origin as null for disallowed origin', async () => {
    const { OPTIONS } = await import('./route');
    const req = new NextRequest('http://localhost:3000/api/leads/submit', {
      method: 'OPTIONS',
      headers: { origin: 'https://attacker.com' },
    });
    const res = await OPTIONS(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('null');
  });

  it('allows netlify.app origins', async () => {
    const { OPTIONS } = await import('./route');
    const req = new NextRequest('http://localhost:3000/api/leads/submit', {
      method: 'OPTIONS',
      headers: { origin: 'https://my-site.netlify.app' },
    });
    const res = await OPTIONS(req);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://my-site.netlify.app');
  });

  it('allows pages.dev (Cloudflare) origins', async () => {
    const { OPTIONS } = await import('./route');
    const req = new NextRequest('http://localhost:3000/api/leads/submit', {
      method: 'OPTIONS',
      headers: { origin: 'https://project.pages.dev' },
    });
    const res = await OPTIONS(req);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://project.pages.dev');
  });

  it('allows github.io origins', async () => {
    const { OPTIONS } = await import('./route');
    const req = new NextRequest('http://localhost:3000/api/leads/submit', {
      method: 'OPTIONS',
      headers: { origin: 'https://user.github.io' },
    });
    const res = await OPTIONS(req);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://user.github.io');
  });

  it('allows localhost origins', async () => {
    const { OPTIONS } = await import('./route');
    const req = new NextRequest('http://localhost:3000/api/leads/submit', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
    });
    const res = await OPTIONS(req);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });
});
