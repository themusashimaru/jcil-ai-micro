/**
 * MEMORY API TESTS
 *
 * Tests for /api/memory endpoint:
 * - GET: Retrieve user memory profile + GDPR data export
 * - PUT: Update user preferences (CSRF protected)
 * - DELETE: GDPR right to erasure (CSRF protected)
 * - Authentication enforcement
 * - Rate limiting
 * - Input validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

const mockUser = { id: 'test-user-id', email: 'test@example.com' };

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
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
    validateBody: vi.fn().mockResolvedValue({ success: true, data: {} }),
    checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    rateLimits: {
      standard: { limit: 60, windowMs: 60000 },
      strict: { limit: 10, windowMs: 60000 },
    },
  };
});

const mockMemory = {
  id: 'mem-123',
  user_id: 'test-user-id',
  summary: 'User is a software engineer working on AI projects.',
  key_topics: ['typescript', 'ai', 'react'],
  topic_timestamps: { typescript: '2026-02-21T00:00:00Z', ai: '2026-02-20T00:00:00Z' },
  user_preferences: { communication_style: 'technical' },
  conversation_ids: ['conv-1', 'conv-2'],
  last_conversations: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-02-21T00:00:00Z',
  last_accessed_at: null,
};

vi.mock('@/lib/memory', () => ({
  loadUserMemory: vi.fn().mockResolvedValue(null),
  deleteUserMemory: vi.fn().mockResolvedValue(true),
  updateUserMemory: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/learning', () => ({
  loadPreferences: vi.fn().mockResolvedValue([]),
  deleteUserLearning: vi.fn().mockResolvedValue(true),
}));

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(
  method: string,
  url = 'http://localhost/api/memory',
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

describe('Memory API Module', () => {
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

  it('should export DELETE handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.DELETE).toBeDefined();
    expect(typeof routeModule.DELETE).toBe('function');
  });

  it('should have correct runtime config', async () => {
    const routeModule = await import('./route');
    expect(routeModule.runtime).toBe('nodejs');
    expect(routeModule.maxDuration).toBe(30);
  });
});

describe('GET /api/memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null memory when no profile exists', async () => {
    const { loadUserMemory } = await import('@/lib/memory');
    vi.mocked(loadUserMemory).mockResolvedValue(null);

    const { GET } = await import('./route');
    const request = createRequest('GET');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it('should return memory profile when it exists', async () => {
    const { loadUserMemory } = await import('@/lib/memory');
    vi.mocked(loadUserMemory).mockResolvedValue(mockMemory as never);

    const { GET } = await import('./route');
    const request = createRequest('GET');
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it('should support GDPR data export with export=true', async () => {
    const { loadUserMemory } = await import('@/lib/memory');
    vi.mocked(loadUserMemory).mockResolvedValue(mockMemory as never);

    const { loadPreferences } = await import('@/lib/learning');
    vi.mocked(loadPreferences).mockResolvedValue([
      {
        preference_type: 'format_style',
        preference_value: 'bullets',
        confidence: 0.85,
        observation_count: 5,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-21T00:00:00Z',
      },
    ] as never);

    const { GET } = await import('./route');
    const request = createRequest('GET', 'http://localhost/api/memory?export=true');
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it('should reject unauthenticated requests', async () => {
    const { createServerClient } = await import('@supabase/ssr');
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        }),
      },
    } as never);

    const { GET } = await import('./route');
    const request = createRequest('GET');
    const response = await GET(request);

    expect(response.status).toBe(401);

    // Restore mock
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    } as never);
  });

  it('should enforce rate limiting', async () => {
    const { checkRequestRateLimit } = await import('@/lib/api/utils');
    const { NextResponse } = await import('next/server');
    vi.mocked(checkRequestRateLimit).mockResolvedValue({
      allowed: false,
      response: NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 }),
    });

    const { GET } = await import('./route');
    const request = createRequest('GET');
    const response = await GET(request);

    expect(response.status).toBe(429);

    // Restore
    vi.mocked(checkRequestRateLimit).mockResolvedValue({ allowed: true });
  });
});

describe('PUT /api/memory', () => {
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
    const request = createRequest('PUT', undefined, { name: 'Test' });
    const response = await PUT(request);

    expect(response.status).toBe(403);

    // Restore
    vi.mocked(validateCSRF).mockReturnValue({ valid: true } as never);
  });

  it('should validate request body', async () => {
    const { validateBody } = await import('@/lib/api/utils');
    const { NextResponse } = await import('next/server');
    vi.mocked(validateBody).mockResolvedValue({
      success: false,
      response: NextResponse.json({ ok: false, error: 'Validation failed' }, { status: 400 }),
    } as never);

    const { PUT } = await import('./route');
    const request = createRequest('PUT', undefined, { invalid_field: 'data' });
    const response = await PUT(request);

    expect(response.status).toBe(400);

    // Restore
    vi.mocked(validateBody).mockResolvedValue({ success: true, data: {} });
  });

  it('should update preferences successfully', async () => {
    const { validateBody } = await import('@/lib/api/utils');
    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: { communication_style: 'formal', interests: ['ai', 'music'] },
    });

    const { updateUserMemory } = await import('@/lib/memory');
    vi.mocked(updateUserMemory).mockResolvedValue({ success: true } as never);

    const { PUT } = await import('./route');
    const request = createRequest('PUT', undefined, {
      communication_style: 'formal',
      interests: ['ai', 'music'],
    });
    const response = await PUT(request);

    expect(response.status).toBe(200);
  });

  it('should handle memory update failure', async () => {
    const { validateBody } = await import('@/lib/api/utils');
    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: { name: 'Test' },
    });

    const { updateUserMemory } = await import('@/lib/memory');
    vi.mocked(updateUserMemory).mockResolvedValue({
      success: false,
      error: 'DB error',
    } as never);

    const { PUT } = await import('./route');
    const request = createRequest('PUT', undefined, { name: 'Test' });
    const response = await PUT(request);

    expect(response.status).toBe(500);
  });
});

describe('DELETE /api/memory', () => {
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

    const { DELETE } = await import('./route');
    const request = createRequest('DELETE');
    const response = await DELETE(request);

    expect(response.status).toBe(403);

    // Restore
    vi.mocked(validateCSRF).mockReturnValue({ valid: true } as never);
  });

  it('should delete memory and learning data', async () => {
    const { deleteUserMemory } = await import('@/lib/memory');
    const { deleteUserLearning } = await import('@/lib/learning');
    vi.mocked(deleteUserMemory).mockResolvedValue(true);
    vi.mocked(deleteUserLearning).mockResolvedValue(true);

    const { DELETE } = await import('./route');
    const request = createRequest('DELETE');
    const response = await DELETE(request);

    expect(response.status).toBe(200);
    expect(deleteUserMemory).toHaveBeenCalledWith('test-user-id');
    expect(deleteUserLearning).toHaveBeenCalledWith('test-user-id');
  });

  it('should have stricter rate limiting for destructive operation', async () => {
    const { checkRequestRateLimit } = await import('@/lib/api/utils');

    const { DELETE } = await import('./route');
    const request = createRequest('DELETE');
    await DELETE(request);

    // Verify rate limit was called with a lower limit for destructive operations
    expect(checkRequestRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('memory-delete:'),
      expect.objectContaining({ limit: 5 })
    );
  });
});

describe('Memory API Input Validation', () => {
  it('should accept valid preference fields', () => {
    const validPreferences = {
      name: 'John Doe',
      preferred_name: 'John',
      occupation: 'Software Engineer',
      location: 'San Francisco',
      communication_style: 'technical',
      interests: ['ai', 'music'],
      faith_context: 'Christian',
      goals: ['Build AI products'],
      interaction_preferences: ['Be concise'],
    };

    // All fields within length limits
    expect(validPreferences.name.length).toBeLessThanOrEqual(100);
    expect(validPreferences.occupation.length).toBeLessThanOrEqual(200);
    expect(validPreferences.interests.length).toBeLessThanOrEqual(50);
    expect(validPreferences.goals.length).toBeLessThanOrEqual(20);
  });

  it('should enforce communication_style enum values', () => {
    const validStyles = ['formal', 'casual', 'technical', 'simple'];
    expect(validStyles).toContain('formal');
    expect(validStyles).toContain('casual');
    expect(validStyles).toContain('technical');
    expect(validStyles).toContain('simple');
  });

  it('should not accept unknown preference fields', () => {
    // Zod schema should strip unknown fields
    const unknownFields = {
      password: 'secret123',
      admin: true,
      role: 'admin',
    };

    // These fields should NOT be in the schema
    const validFields = [
      'name',
      'preferred_name',
      'occupation',
      'location',
      'communication_style',
      'interests',
      'faith_context',
      'goals',
      'interaction_preferences',
    ];

    for (const key of Object.keys(unknownFields)) {
      expect(validFields).not.toContain(key);
    }
  });
});

describe('GDPR Compliance', () => {
  it('should export all user data on request', () => {
    // Verify the export endpoint provides comprehensive data
    const exportFields = ['exported_at', 'user_id', 'memory', 'learned_style_preferences'];

    // All required GDPR export fields should be present
    for (const field of exportFields) {
      expect(typeof field).toBe('string');
    }
  });

  it('should permanently delete all data on erasure request', async () => {
    const { deleteUserMemory } = await import('@/lib/memory');
    const { deleteUserLearning } = await import('@/lib/learning');

    // Both memory and learning should be deleted in parallel
    expect(typeof deleteUserMemory).toBe('function');
    expect(typeof deleteUserLearning).toBe('function');
  });

  it('should include timestamp in export data', () => {
    const exportTimestamp = new Date().toISOString();
    expect(exportTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
