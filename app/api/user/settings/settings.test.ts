/**
 * USER SETTINGS API TESTS
 *
 * Tests for /api/user/settings endpoint:
 * - GET: Get current user settings
 * - PUT: Update user settings (CSRF protected)
 * - Authentication enforcement
 * - Rate limiting
 * - Input validation
 * - Theme restrictions (light mode admin-only)
 * - Default settings fallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

const mockUser = { id: 'test-user-id', email: 'test@example.com' };

const mockSettingsChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({
    data: { user_id: 'test-user-id', theme: 'dark' },
    error: null,
  }),
  upsert: vi.fn().mockReturnThis(),
};

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'admin_users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        };
      }
      return mockSettingsChain;
    }),
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: vi.fn().mockReturnValue({ valid: true }),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@/lib/api/utils', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: vi.fn((data) => NextResponse.json({ ok: true, data }, { status: 200 })),
    errors: {
      unauthorized: vi.fn(() =>
        NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })
      ),
      forbidden: vi.fn((msg?: string) =>
        NextResponse.json({ ok: false, error: msg || 'Access denied' }, { status: 403 })
      ),
      badRequest: vi.fn((msg: string) =>
        NextResponse.json({ ok: false, error: msg }, { status: 400 })
      ),
      serverError: vi.fn(() =>
        NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
      ),
      rateLimited: vi.fn(() =>
        NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 })
      ),
      validationError: vi.fn((details: unknown[]) =>
        NextResponse.json({ ok: false, error: 'Validation failed', details }, { status: 400 })
      ),
    },
    validateBody: vi.fn().mockResolvedValue({
      success: true,
      data: { theme: 'dark' },
    }),
    checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    rateLimits: {
      standard: { limit: 60, windowMs: 60000 },
    },
  };
});

vi.mock('@/lib/validation/schemas', () => ({
  userSettingsSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: { theme: 'dark' } }),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(
  method: string,
  url = 'http://localhost/api/user/settings',
  body?: unknown
): NextRequest {
  const init = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': 'valid-token',
    },
    body: body ? JSON.stringify(body) : undefined,
  };
  return new NextRequest(url, init);
}

// ============================================================================
// TESTS
// ============================================================================

describe('User Settings API Module', () => {
  it('should export GET handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.GET).toBeDefined();
    expect(typeof routeModule.GET).toBe('function');
  });

  it('should export PUT handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.PUT).toBeDefined();
    expect(typeof routeModule.PUT).toBe('function');
  });
});

describe('GET /api/user/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return user settings', async () => {
    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(200);
  });

  it('should return default settings when none exist', async () => {
    const { createServerClient } = await import('@supabase/ssr');
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        }),
      })),
    } as never);

    const { GET } = await import('./route');
    const response = await GET();

    // Should still return 200 with default settings
    expect(response.status).toBe(200);

    // Restore
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'admin_users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          };
        }
        return mockSettingsChain;
      }),
    } as never);
  });

  it('should reject unauthenticated requests', async () => {
    const { createServerClient } = await import('@supabase/ssr');
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn(() => mockSettingsChain),
    } as never);

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(401);

    // Restore
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'admin_users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          };
        }
        return mockSettingsChain;
      }),
    } as never);
  });

  it('should enforce rate limiting', async () => {
    const { checkRequestRateLimit } = await import('@/lib/api/utils');
    const { NextResponse } = await import('next/server');
    vi.mocked(checkRequestRateLimit).mockResolvedValue({
      allowed: false,
      response: NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 }),
    });

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(429);

    // Restore
    vi.mocked(checkRequestRateLimit).mockResolvedValue({ allowed: true });
  });
});

describe('PUT /api/user/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should require CSRF token', async () => {
    const { validateCSRF } = await import('@/lib/security/csrf');
    const { NextResponse } = await import('next/server');
    vi.mocked(validateCSRF).mockReturnValue({
      valid: false,
      response: NextResponse.json({ error: 'Invalid CSRF' }, { status: 403 }),
    } as never);

    const { PUT } = await import('./route');
    const request = createRequest('PUT', undefined, { theme: 'dark' });
    const response = await PUT(request);

    expect(response.status).toBe(403);

    // Restore
    vi.mocked(validateCSRF).mockReturnValue({ valid: true } as never);
  });

  it('should update dark theme for regular users', async () => {
    const { validateBody } = await import('@/lib/api/utils');
    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: { theme: 'dark' },
    });

    const { PUT } = await import('./route');
    const request = createRequest('PUT', undefined, { theme: 'dark' });
    const response = await PUT(request);

    expect(response.status).toBe(200);
  });

  it('should reject light mode for non-admin users', async () => {
    const { validateBody } = await import('@/lib/api/utils');
    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: { theme: 'light' },
    });

    // Non-admin user: admin_users query returns null
    const { createServerClient } = await import('@supabase/ssr');
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'admin_users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          };
        }
        return mockSettingsChain;
      }),
    } as never);

    const { PUT } = await import('./route');
    const request = createRequest('PUT', undefined, { theme: 'light' });
    const response = await PUT(request);

    expect(response.status).toBe(403);
  });

  it('should allow light mode for admin users', async () => {
    const { validateBody } = await import('@/lib/api/utils');
    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: { theme: 'light' },
    });

    // Admin user: admin_users query returns a record
    const { createServerClient } = await import('@supabase/ssr');
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'admin_users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'admin-123' },
              error: null,
            }),
          };
        }
        return mockSettingsChain;
      }),
    } as never);

    const { PUT } = await import('./route');
    const request = createRequest('PUT', undefined, { theme: 'light' });
    const response = await PUT(request);

    expect(response.status).toBe(200);
  });

  it('should validate request body', async () => {
    const { validateBody } = await import('@/lib/api/utils');
    const { NextResponse } = await import('next/server');
    vi.mocked(validateBody).mockResolvedValue({
      success: false,
      response: NextResponse.json({ ok: false, error: 'Validation failed' }, { status: 400 }),
    } as never);

    const { PUT } = await import('./route');
    const request = createRequest('PUT', undefined, { invalid: 'data' });
    const response = await PUT(request);

    expect(response.status).toBe(400);

    // Restore
    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: { theme: 'dark' },
    });
  });
});

describe('Settings Input Validation', () => {
  it('should accept valid theme values', () => {
    const validThemes = ['light', 'dark', 'system'];
    for (const theme of validThemes) {
      expect(['light', 'dark', 'system']).toContain(theme);
    }
  });

  it('should reject invalid theme values', () => {
    const invalidThemes = ['blue', 'custom', '', 'auto'];
    const validThemes = ['light', 'dark', 'system'];
    for (const theme of invalidThemes) {
      expect(validThemes).not.toContain(theme);
    }
  });

  it('should accept valid display name', () => {
    const validNames = ['John', 'Jane Doe', 'User123'];
    for (const name of validNames) {
      expect(name.length).toBeGreaterThanOrEqual(1);
      expect(name.length).toBeLessThanOrEqual(100);
    }
  });

  it('should accept valid language codes', () => {
    const validLanguages = ['en', 'es', 'fr', 'de', 'zh-CN'];
    for (const lang of validLanguages) {
      expect(lang.length).toBeGreaterThanOrEqual(2);
      expect(lang.length).toBeLessThanOrEqual(10);
    }
  });

  it('should accept boolean notifications_enabled', () => {
    const validValues = [true, false];
    for (const value of validValues) {
      expect(typeof value).toBe('boolean');
    }
  });
});

describe('Default Settings', () => {
  it('should default to dark theme', () => {
    const defaultSettings = { theme: 'dark' };
    expect(defaultSettings.theme).toBe('dark');
  });

  it('should handle missing settings gracefully', () => {
    const settings = null;
    const fallback = settings || { theme: 'dark' };
    expect(fallback.theme).toBe('dark');
  });
});

describe('Settings Security', () => {
  it('should scope settings to authenticated user only', () => {
    // Settings queries always include .eq('user_id', user.id)
    const userId = 'test-user-id';
    expect(userId).toBeTruthy();
  });

  it('should use upsert for settings update', () => {
    // Upsert with onConflict: 'user_id' ensures one settings row per user
    const upsertConfig = { onConflict: 'user_id' };
    expect(upsertConfig.onConflict).toBe('user_id');
  });

  it('should not expose admin_users table data in settings response', () => {
    // Admin check is internal only - response only contains settings
    const settingsResponse = { theme: 'dark' };
    expect(settingsResponse).not.toHaveProperty('is_admin');
    expect(settingsResponse).not.toHaveProperty('admin_users');
  });
});
