/**
 * USER AUTHENTICATION GUARD TESTS
 *
 * Critical P0 tests for authentication security:
 * - CSRF protection on state-changing requests
 * - Session validation
 * - Unauthorized access prevention
 * - Error handling for auth failures
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock CSRF validation
const mockValidateCSRF = vi.fn();
vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: (...args: unknown[]) => mockValidateCSRF(...args),
}));

// Mock Supabase server auth
const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server-auth', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn(),
  })),
}));

describe('User Authentication Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCSRF.mockReturnValue({ valid: true });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });
  });

  describe('requireUser Function', () => {
    it('should return authorized=true for authenticated user', async () => {
      const { requireUser } = await import('@/lib/auth/user-guard');

      const result = await requireUser();

      expect(result.authorized).toBe(true);
      if (result.authorized) {
        expect(result.user.id).toBe('user-123');
        expect(result.user.email).toBe('test@example.com');
      }
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const { requireUser } = await import('@/lib/auth/user-guard');
      const result = await requireUser();

      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.response.status).toBe(401);
      }
    });

    it('should validate CSRF when request is provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
      });

      const { requireUser } = await import('@/lib/auth/user-guard');
      await requireUser(request);

      expect(mockValidateCSRF).toHaveBeenCalledWith(request);
    });

    it('should return CSRF error when validation fails', async () => {
      mockValidateCSRF.mockReturnValue({
        valid: false,
        response: NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 }),
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
      });

      const { requireUser } = await import('@/lib/auth/user-guard');
      const result = await requireUser(request);

      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.response.status).toBe(403);
      }
    });

    it('should not validate CSRF for GET requests (no request provided)', async () => {
      const { requireUser } = await import('@/lib/auth/user-guard');
      await requireUser(); // No request = GET request, no CSRF check

      expect(mockValidateCSRF).not.toHaveBeenCalled();
    });

    it('should return 500 on unexpected error', async () => {
      mockGetUser.mockRejectedValue(new Error('Database connection failed'));

      const { requireUser } = await import('@/lib/auth/user-guard');
      const result = await requireUser();

      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.response.status).toBe(500);
      }
    });
  });

  describe('optionalUser Function', () => {
    it('should return user if authenticated', async () => {
      const { optionalUser } = await import('@/lib/auth/user-guard');
      const result = await optionalUser();

      expect(result.user).not.toBeNull();
      expect(result.user?.id).toBe('user-123');
    });

    it('should return null user if not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { optionalUser } = await import('@/lib/auth/user-guard');
      const result = await optionalUser();

      expect(result.user).toBeNull();
      expect(result.supabase).toBeDefined();
    });

    it('should return null user on error', async () => {
      mockGetUser.mockRejectedValue(new Error('Auth error'));

      const { optionalUser } = await import('@/lib/auth/user-guard');
      const result = await optionalUser();

      expect(result.user).toBeNull();
    });
  });
});

describe('Authentication Error Responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCSRF.mockReturnValue({ valid: true });
  });

  describe('401 Unauthorized', () => {
    it('should include correct error structure', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const { requireUser } = await import('@/lib/auth/user-guard');
      const result = await requireUser();

      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        const body = await result.response.json();
        expect(body.error).toBe('Authentication required');
        expect(body.code).toBe('UNAUTHORIZED');
        expect(body.message).toBeDefined();
      }
    });
  });

  describe('500 Auth Error', () => {
    it('should include correct error structure', async () => {
      mockGetUser.mockRejectedValue(new Error('Unexpected error'));

      const { requireUser } = await import('@/lib/auth/user-guard');
      const result = await requireUser();

      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        const body = await result.response.json();
        expect(body.error).toBe('Authentication error');
        expect(body.code).toBe('AUTH_ERROR');
      }
    });
  });
});

describe('Authentication Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCSRF.mockReturnValue({ valid: true });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });
  });

  describe('Session Validation', () => {
    it('should verify session via getUser', async () => {
      const { requireUser } = await import('@/lib/auth/user-guard');
      await requireUser();

      expect(mockGetUser).toHaveBeenCalled();
    });

    it('should reject expired sessions', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Session expired' },
      });

      const { requireUser } = await import('@/lib/auth/user-guard');
      const result = await requireUser();

      expect(result.authorized).toBe(false);
    });
  });

  describe('CSRF Protection', () => {
    it('should require CSRF for POST requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
      });

      const { requireUser } = await import('@/lib/auth/user-guard');
      await requireUser(request);

      expect(mockValidateCSRF).toHaveBeenCalled();
    });

    it('should reject invalid CSRF token', async () => {
      mockValidateCSRF.mockReturnValue({
        valid: false,
        response: NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }),
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
      });

      const { requireUser } = await import('@/lib/auth/user-guard');
      const result = await requireUser(request);

      expect(result.authorized).toBe(false);
    });
  });

  describe('User Context', () => {
    it('should return supabase client with user context', async () => {
      const { requireUser } = await import('@/lib/auth/user-guard');
      const result = await requireUser();

      if (result.authorized) {
        expect(result.supabase).toBeDefined();
      }
    });

    it('should handle users without email', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: undefined } },
        error: null,
      });

      const { requireUser } = await import('@/lib/auth/user-guard');
      const result = await requireUser();

      expect(result.authorized).toBe(true);
      if (result.authorized) {
        expect(result.user.id).toBe('user-123');
        expect(result.user.email).toBeUndefined();
      }
    });
  });
});
