/**
 * ADMIN EARNINGS EXCEL/CSV EXPORT API TESTS
 *
 * Tests for /api/admin/earnings/export/excel endpoint:
 * - GET: Export earnings report as CSV (admin only)
 * - Auth guard rejection
 * - Permission check (can_export_data)
 * - Query validation
 * - Happy path CSV generation with various data
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    authorized: true,
    user: { id: 'admin-user-id', email: 'admin@test.com' },
    adminUser: {
      id: 'admin-id',
      permissions: {
        can_view_users: true,
        can_edit_users: true,
        can_view_conversations: true,
        can_export_data: true,
        can_manage_subscriptions: true,
        can_ban_users: true,
      },
    },
  }),
  checkPermission: vi.fn().mockReturnValue({ allowed: true }),
}));

vi.mock('@/lib/api/utils', () => ({
  errors: {
    badRequest: vi.fn(
      (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 })
    ),
    serverError: vi.fn(
      (msg: string) =>
        new Response(JSON.stringify({ error: msg || 'Internal server error' }), { status: 500 })
    ),
  },
  captureAPIError: vi.fn(),
}));

vi.mock('@/lib/validation/schemas', () => ({
  adminEarningsQuerySchema: {},
  validateQuery: vi.fn().mockReturnValue({
    success: true,
    data: {},
  }),
  validationErrorResponse: vi.fn((_error: string, _details: unknown[]) => ({
    message: 'Validation failed',
    error: _error,
    details: _details,
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Build a chainable mock for Supabase query builder
function createChainableMock(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.then = vi.fn((resolve: (val: unknown) => void) => resolve(resolvedValue));

  // Make the chain thenable so `await` works
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => Promise.resolve(resolvedValue).then(resolve),
    enumerable: false,
    configurable: true,
  });

  return chain;
}

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// ============================================================================
// HELPERS
// ============================================================================

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/earnings/export/excel');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString());
}

// ============================================================================
// TESTS
// ============================================================================

describe('Admin Earnings Excel/CSV Export API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  // --------------------------------------------------------------------------
  // Module exports
  // --------------------------------------------------------------------------

  it('should export GET handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.GET).toBeDefined();
    expect(typeof routeModule.GET).toBe('function');
  });

  it('should export dynamic, runtime, and maxDuration constants', async () => {
    const routeModule = await import('./route');
    expect(routeModule.dynamic).toBe('force-dynamic');
    expect(routeModule.runtime).toBe('nodejs');
    expect(routeModule.maxDuration).toBe(60);
  });

  // --------------------------------------------------------------------------
  // Auth guard rejection
  // --------------------------------------------------------------------------

  it('should reject unauthenticated requests', async () => {
    const { requireAdmin } = await import('@/lib/auth/admin-guard');
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    } as never);

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it('should reject requests without export permission', async () => {
    const { checkPermission } = await import('@/lib/auth/admin-guard');
    vi.mocked(checkPermission).mockReturnValueOnce({
      allowed: false,
      response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    } as never);

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    expect(response.status).toBe(403);
  });

  it('should call checkPermission with can_export_data', async () => {
    const { checkPermission } = await import('@/lib/auth/admin-guard');

    // Set up supabase mocks for the full flow
    const usersChain = createChainableMock({ data: [], error: null });
    const usageChain = createChainableMock({ data: [], error: null });
    const newsChain = createChainableMock({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    await GET(makeRequest());

    expect(checkPermission).toHaveBeenCalledWith(
      expect.objectContaining({ authorized: true }),
      'can_export_data'
    );
  });

  // --------------------------------------------------------------------------
  // Validation errors
  // --------------------------------------------------------------------------

  it('should reject invalid query parameters', async () => {
    const { validateQuery } = await import('@/lib/validation/schemas');
    vi.mocked(validateQuery).mockReturnValueOnce({
      success: false,
      error: 'Invalid date format',
      details: [{ path: ['startDate'], message: 'Date must be in YYYY-MM-DD format' }],
    } as never);

    const { GET } = await import('./route');
    const response = await GET(makeRequest({ startDate: 'bad-date' }));
    expect(response.status).toBe(400);
  });

  it('should call validationErrorResponse when validation fails', async () => {
    const { validateQuery, validationErrorResponse } = await import('@/lib/validation/schemas');
    const mockDetails = [{ path: ['startDate'], message: 'Invalid' }];
    vi.mocked(validateQuery).mockReturnValueOnce({
      success: false,
      error: 'Validation failed',
      details: mockDetails,
    } as never);

    const { GET } = await import('./route');
    await GET(makeRequest({ startDate: 'invalid' }));

    expect(validationErrorResponse).toHaveBeenCalledWith('Validation failed', mockDetails);
  });

  // --------------------------------------------------------------------------
  // Missing Supabase configuration
  // --------------------------------------------------------------------------

  it('should return 500 when Supabase env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
  });

  // --------------------------------------------------------------------------
  // Happy path - CSV generation
  // --------------------------------------------------------------------------

  it('should return CSV with correct content type and disposition headers', async () => {
    const usersChain = createChainableMock({ data: [], error: null });
    const usageChain = createChainableMock({ data: [], error: null });
    const newsChain = createChainableMock({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv');
    expect(response.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="earnings-report-\d{4}-\d{2}-\d{2}\.csv"$/
    );
  });

  it('should include report title and date range in CSV', async () => {
    const { validateQuery } = await import('@/lib/validation/schemas');
    vi.mocked(validateQuery).mockReturnValueOnce({
      success: true,
      data: { startDate: '2026-01-01', endDate: '2026-01-31' },
    } as never);

    const usersChain = createChainableMock({ data: [], error: null });
    const usageChain = createChainableMock({ data: [], error: null });
    const newsChain = createChainableMock({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest({ startDate: '2026-01-01', endDate: '2026-01-31' }));

    const csv = await response.text();
    expect(csv).toContain('JCIL.ai Financial Report');
    expect(csv).toContain('Date Range: 2026-01-01 to 2026-01-31');
  });

  it('should show "All Time" and "Present" when no date range provided', async () => {
    const { validateQuery } = await import('@/lib/validation/schemas');
    vi.mocked(validateQuery).mockReturnValueOnce({
      success: true,
      data: {},
    } as never);

    const usersChain = createChainableMock({ data: [], error: null });
    const usageChain = createChainableMock({ data: [], error: null });
    const newsChain = createChainableMock({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());

    const csv = await response.text();
    expect(csv).toContain('Date Range: All Time to Present');
  });

  it('should correctly calculate revenue by tier', async () => {
    const mockUsers = [
      { id: 'u1', email: 'free@test.com', full_name: 'Free User', subscription_tier: 'free' },
      { id: 'u2', email: 'plus@test.com', full_name: 'Plus User', subscription_tier: 'plus' },
      { id: 'u3', email: 'pro@test.com', full_name: 'Pro User', subscription_tier: 'pro' },
      {
        id: 'u4',
        email: 'exec@test.com',
        full_name: 'Exec User',
        subscription_tier: 'executive',
      },
    ];

    const usersChain = createChainableMock({ data: mockUsers, error: null });
    const usageChain = createChainableMock({ data: [], error: null });
    const newsChain = createChainableMock({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const csv = await response.text();

    // Check revenue by tier section
    expect(csv).toContain('REVENUE BY SUBSCRIPTION TIER');
    expect(csv).toContain('Free,1,$0.00,$0.00');
    expect(csv).toContain('Plus,1,$18.00,$18.00');
    expect(csv).toContain('Pro,1,$30.00,$30.00');
    expect(csv).toContain('Executive,1,$99.00,$99.00');
    // Total revenue = 0 + 18 + 30 + 99 = 147
    expect(csv).toContain('Total Revenue,$147.00');
    expect(csv).toContain('TOTAL,4,,$147.00');
  });

  it('should map "basic" tier to "plus" for backwards compatibility', async () => {
    const mockUsers = [
      { id: 'u1', email: 'basic@test.com', full_name: 'Basic User', subscription_tier: 'basic' },
    ];

    const usersChain = createChainableMock({ data: mockUsers, error: null });
    const usageChain = createChainableMock({ data: [], error: null });
    const newsChain = createChainableMock({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const csv = await response.text();

    // basic mapped to plus, so Plus count = 1, revenue = $18
    expect(csv).toContain('Plus,1,$18.00,$18.00');
    expect(csv).toContain('Free,0,$0.00,$0.00');
  });

  it('should aggregate API costs by model', async () => {
    const mockUsageData = [
      {
        user_id: 'u1',
        model_name: 'claude-sonnet-4',
        input_tokens: 100,
        cached_input_tokens: 10,
        output_tokens: 50,
        live_search_calls: 1,
        total_cost: 0.005,
      },
      {
        user_id: 'u2',
        model_name: 'claude-sonnet-4',
        input_tokens: 200,
        cached_input_tokens: 20,
        output_tokens: 100,
        live_search_calls: 0,
        total_cost: 0.01,
      },
      {
        user_id: 'u1',
        model_name: 'gpt-4',
        input_tokens: 300,
        cached_input_tokens: 0,
        output_tokens: 150,
        live_search_calls: 2,
        total_cost: 0.03,
      },
    ];

    const usersChain = createChainableMock({ data: [], error: null });
    const usageChain = createChainableMock({ data: mockUsageData, error: null });
    const newsChain = createChainableMock({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const csv = await response.text();

    expect(csv).toContain('API COSTS BY MODEL');
    // claude-sonnet-4: count=2, input=300, cached=30, output=150, search=1, cost=0.015
    expect(csv).toContain('claude-sonnet-4,2,300,30,150,1,$0.01500000');
    // gpt-4: count=1, input=300, cached=0, output=150, search=2, cost=0.03
    expect(csv).toContain('gpt-4,1,300,0,150,2,$0.03000000');
  });

  it('should calculate net profit correctly', async () => {
    const mockUsers = [
      { id: 'u1', email: 'pro@test.com', full_name: 'Pro User', subscription_tier: 'pro' },
    ];
    const mockUsageData = [
      {
        user_id: 'u1',
        model_name: 'test',
        input_tokens: 0,
        cached_input_tokens: 0,
        output_tokens: 0,
        live_search_calls: 0,
        total_cost: 5.0,
      },
    ];
    const mockNewsData = [{ tokens_used: 100, cost: 2.0 }];

    const usersChain = createChainableMock({ data: mockUsers, error: null });
    const usageChain = createChainableMock({ data: mockUsageData, error: null });
    const newsChain = createChainableMock({ data: mockNewsData, error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const csv = await response.text();

    // Revenue: 1 pro user * $30 = $30
    // API costs: $5, News costs: $2, total costs: $7
    // Net profit: $30 - $5 - $2 = $23
    expect(csv).toContain('Total Revenue,$30.00');
    expect(csv).toContain('Total Costs,$7.00');
    expect(csv).toContain('Net Profit,$23.00');
    // Margin: (23/30)*100 = 76.67%
    expect(csv).toContain('Profit Margin,76.67%');
  });

  it('should show 0 profit margin when revenue is zero', async () => {
    const usersChain = createChainableMock({ data: [], error: null });
    const usageChain = createChainableMock({ data: [], error: null });
    const newsChain = createChainableMock({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const csv = await response.text();

    expect(csv).toContain('Profit Margin,0%');
  });

  it('should include news page costs section', async () => {
    const mockNewsData = [
      { tokens_used: 500, cost: 0.01 },
      { tokens_used: 300, cost: 0.008 },
    ];

    const usersChain = createChainableMock({ data: [], error: null });
    const usageChain = createChainableMock({ data: [], error: null });
    const newsChain = createChainableMock({ data: mockNewsData, error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const csv = await response.text();

    expect(csv).toContain('NEWS PAGE COSTS');
    expect(csv).toContain('Total API Calls,2');
    expect(csv).toContain('Total Tokens,800');
  });

  it('should include detailed usage by user section', async () => {
    const mockUsers = [
      { id: 'u1', email: 'alice@test.com', full_name: 'Alice', subscription_tier: 'pro' },
      { id: 'u2', email: 'bob@test.com', full_name: null, subscription_tier: 'free' },
    ];
    const mockUsageData = [
      {
        user_id: 'u1',
        model_name: 'test',
        input_tokens: 0,
        cached_input_tokens: 0,
        output_tokens: 0,
        live_search_calls: 0,
        total_cost: 0.5,
      },
      {
        user_id: 'u1',
        model_name: 'test',
        input_tokens: 0,
        cached_input_tokens: 0,
        output_tokens: 0,
        live_search_calls: 0,
        total_cost: 0.3,
      },
    ];

    const usersChain = createChainableMock({ data: mockUsers, error: null });
    const usageChain = createChainableMock({ data: mockUsageData, error: null });
    const newsChain = createChainableMock({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const csv = await response.text();

    expect(csv).toContain('DETAILED USAGE BY USER');
    // Alice: 2 uses, $0.80 total
    expect(csv).toContain('alice@test.com,"Alice",pro,2,$0.80000000');
    // Bob: no usage, null full_name shown as N/A
    expect(csv).toContain('bob@test.com,"N/A",free,0,$0.00000000');
  });

  it('should apply date filters to usage and news queries', async () => {
    const { validateQuery } = await import('@/lib/validation/schemas');
    vi.mocked(validateQuery).mockReturnValueOnce({
      success: true,
      data: { startDate: '2026-01-01', endDate: '2026-01-31' },
    } as never);

    const usageChain = createChainableMock({ data: [], error: null });
    const newsChain = createChainableMock({ data: [], error: null });
    const usersChain = createChainableMock({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    await GET(makeRequest({ startDate: '2026-01-01', endDate: '2026-01-31' }));

    // Verify gte/lte were called on usage and news chains for date filtering
    expect(usageChain.gte).toHaveBeenCalledWith('created_at', '2026-01-01');
    expect(usageChain.lte).toHaveBeenCalledWith('created_at', '2026-01-31');
    expect(newsChain.gte).toHaveBeenCalledWith('created_at', '2026-01-01');
    expect(newsChain.lte).toHaveBeenCalledWith('created_at', '2026-01-31');
  });

  it('should handle null data from supabase gracefully', async () => {
    const usersChain = createChainableMock({ data: null, error: null });
    const usageChain = createChainableMock({ data: null, error: null });
    const newsChain = createChainableMock({ data: null, error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain('Total Users,0');
    expect(csv).toContain('Total Revenue,$0.00');
    expect(csv).toContain('Total Costs,$0.00');
  });

  // --------------------------------------------------------------------------
  // Error handling
  // --------------------------------------------------------------------------

  it('should return 500 and call captureAPIError on unexpected errors', async () => {
    const { requireAdmin } = await import('@/lib/auth/admin-guard');
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error('DB connection failed'));

    const { captureAPIError } = await import('@/lib/api/utils');
    const { GET } = await import('./route');
    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(captureAPIError).toHaveBeenCalledWith(
      expect.any(Error),
      '/api/admin/earnings/export/excel'
    );
  });

  it('should query correct supabase tables', async () => {
    const usersChain = createChainableMock({ data: [], error: null });
    const usageChain = createChainableMock({ data: [], error: null });
    const newsChain = createChainableMock({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    await GET(makeRequest());

    expect(mockSupabase.from).toHaveBeenCalledWith('users');
    expect(mockSupabase.from).toHaveBeenCalledWith('usage_tracking');
    expect(mockSupabase.from).toHaveBeenCalledWith('news_costs');
  });

  it('should filter users by is_active = true', async () => {
    const usersChain = createChainableMock({ data: [], error: null });
    const usageChain = createChainableMock({ data: [], error: null });
    const newsChain = createChainableMock({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'usage_tracking') return usageChain;
      if (table === 'news_costs') return newsChain;
      return usersChain;
    });

    const { GET } = await import('./route');
    await GET(makeRequest());

    expect(usersChain.eq).toHaveBeenCalledWith('is_active', true);
  });
});
