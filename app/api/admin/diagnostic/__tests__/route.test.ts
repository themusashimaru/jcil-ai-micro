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

// Mock Supabase createClient
const mockFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));

// Import after mocks
const { GET } = await import('../route');

describe('GET /api/admin/diagnostic', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      user: mockAdminUser,
      adminUser: mockAdminRecord,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });

    // Set env vars
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.STRIPE_SECRET_KEY = 'test-stripe-key';
    process.env.CRON_SECRET = 'test-cron-secret';
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

  it('returns environment variable status as SET when all configured', async () => {
    // Mock successful DB queries
    mockFrom.mockImplementation((table: string) => ({
      select: vi.fn().mockResolvedValue({
        data: table === 'users' ? [{ id: '1' }, { id: '2' }] : [{ id: 'a1' }],
        error: null,
      }),
    }));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.environment.supabaseUrl.value).toBe('SET');
    expect(json.environment.supabaseUrl.exists).toBe(true);
    expect(json.environment.supabaseAnonKey.value).toBe('SET');
    expect(json.environment.supabaseServiceKey.value).toBe('SET');
    expect(json.environment.anthropicApiKey.value).toBe('SET');
    expect(json.environment.stripeSecretKey.value).toBe('SET');
    expect(json.environment.cronSecret.value).toBe('SET');
  });

  it('returns MISSING for unset environment variables', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.CRON_SECRET;

    // Mock successful DB queries
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.environment.anthropicApiKey.value).toBe('MISSING');
    expect(json.environment.anthropicApiKey.exists).toBe(false);
    expect(json.environment.stripeSecretKey.value).toBe('MISSING');
    expect(json.environment.cronSecret.value).toBe('MISSING');
  });

  it('returns database check results', async () => {
    mockFrom.mockImplementation((table: string) => ({
      select: vi.fn().mockResolvedValue({
        data: table === 'users' ? [{ id: '1' }, { id: '2' }, { id: '3' }] : [{ id: 'a1' }],
        error: null,
      }),
    }));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.checks.canCreateClient).toBe(true);
    expect(json.checks.canQueryDatabase).toBe(true);
    expect(json.checks.userCount).toBe(3);
    expect(json.checks.adminUserCount).toBe(1);
    expect(json.checks.error).toBeNull();
  });

  it('handles database errors gracefully', async () => {
    mockFrom.mockImplementation((_table: string) => ({
      select: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST500', message: 'Connection failed' },
      }),
    }));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.checks.canCreateClient).toBe(true);
    expect(json.checks.canQueryDatabase).toBe(false);
    expect(json.checks.error).toBeTruthy();
  });
});
