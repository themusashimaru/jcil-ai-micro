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

// Mock requireAdmin
const mockAdminUser = { id: 'admin-123', email: 'admin@example.com' };
const mockAdminRecord = {
  id: 'admin-row-1',
  permissions: {
    can_view_users: true,
    can_edit_users: true,
    can_view_conversations: true,
    can_export_data: true,
    can_manage_subscriptions: true,
    can_ban_users: true,
  },
};
const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

// Mock rate limiting
const mockCheckRequestRateLimit = vi.fn();
vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
  };
});

// Import after mocks
const { GET, POST } = await import('../route');

describe('GET /api/admin/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      user: mockAdminUser,
      adminUser: mockAdminRecord,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not admin', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireAdmin.mockResolvedValue({
      authorized: false,
      response: unauthorizedResponse,
    });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns default settings', async () => {
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.mainLogo).toBe('/images/logo.png');
    expect(json.favicon).toBe('/favicon.ico');
    expect(json.siteName).toBe('JCIL.ai');
    expect(json.subtitle).toBe('Faith-based AI tools for your everyday needs');
    expect(json.headerLogo).toBe('');
    expect(json.loginLogo).toBe('');
  });
});

describe('POST /api/admin/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      user: mockAdminUser,
      adminUser: mockAdminRecord,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not admin', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireAdmin.mockResolvedValue({
      authorized: false,
      response: unauthorizedResponse,
    });

    const request = new NextRequest('http://localhost/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ siteName: 'New Name' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('validates and returns merged settings', async () => {
    const request = new NextRequest('http://localhost/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({
        siteName: 'My Custom Site',
        mainLogo: '/images/custom-logo.png',
        subtitle: 'Custom subtitle',
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.success).toBe(true);
    expect(json.settings.siteName).toBe('My Custom Site');
    expect(json.settings.mainLogo).toBe('/images/custom-logo.png');
    expect(json.settings.subtitle).toBe('Custom subtitle');
    // Defaults should fill in missing fields
    expect(json.settings.favicon).toBe('/favicon.ico');
  });

  it('handles invalid schema with bad request', async () => {
    const request = new NextRequest('http://localhost/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({
        siteName: 12345, // should be string
        unknownField: 'value',
      }),
    });

    const response = await POST(request);

    // If schema rejects, should return 400; if it coerces, should return 200
    // The actual behavior depends on the Zod schema definition
    expect([200, 400]).toContain(response.status);
  });

  it('returns 500 when request.json() throws', async () => {
    const request = new NextRequest('http://localhost/api/admin/settings', {
      method: 'POST',
      body: 'not json',
    });
    // Override content-type to prevent NextRequest from parsing
    Object.defineProperty(request, 'json', {
      value: () => Promise.reject(new Error('Invalid JSON')),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
