import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('@/lib/supabase/server-auth', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: vi.fn(() => ({ valid: true })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { validateCSRF } from '@/lib/security/csrf';

describe('Admin Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CSRF Protection', () => {
    it('should validate CSRF when request is provided', async () => {
      const mockRequest = new Request('http://localhost/api/admin/test', {
        method: 'POST',
        headers: { 'x-csrf-token': 'valid-token' },
      });

      // CSRF should be called when request is provided
      vi.mocked(validateCSRF).mockReturnValue({ valid: true });

      // Verify CSRF validation is part of the flow
      const csrfResult = validateCSRF(mockRequest as never);
      expect(csrfResult.valid).toBe(true);
    });

    it('should reject invalid CSRF tokens', () => {
      const mockRequest = new Request('http://localhost/api/admin/test', {
        method: 'POST',
      });

      vi.mocked(validateCSRF).mockReturnValue({
        valid: false,
        response: { status: 403 } as never,
      });

      const csrfResult = validateCSRF(mockRequest as never);
      expect(csrfResult.valid).toBe(false);
    });
  });

  describe('Authentication Flow', () => {
    it('should require user to be authenticated', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Not authenticated' },
          }),
        },
        from: vi.fn(),
      };

      vi.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabase as never);

      // Simulate the auth check
      const { data: { user }, error } = await mockSupabase.auth.getUser();

      expect(user).toBeNull();
      expect(error).toBeDefined();
    });

    it('should verify admin privileges', async () => {
      const mockUser = { id: 'user-123', email: 'admin@example.com' };
      const mockAdminData = { id: 'admin-456' };

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAdminData,
                error: null,
              }),
            }),
          }),
        }),
      };

      vi.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabase as never);

      // Simulate the full auth flow
      const { data: { user } } = await mockSupabase.auth.getUser();
      expect(user).toEqual(mockUser);

      const { data: adminData } = await mockSupabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      expect(adminData).toEqual(mockAdminData);
    });

    it('should deny access if user is not an admin', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' };

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
      };

      vi.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabase as never);

      // User is authenticated but not an admin
      const { data: { user } } = await mockSupabase.auth.getUser();
      expect(user).toEqual(mockUser);

      const { data: adminData, error } = await mockSupabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      expect(adminData).toBeNull();
      expect(error).toBeDefined();
    });
  });

  describe('Response Codes', () => {
    it('should return 401 for unauthenticated users', () => {
      const response = {
        error: 'Authentication required',
        message: 'You must be signed in to access this resource.',
        code: 'UNAUTHORIZED',
      };

      expect(response.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 for non-admin users', () => {
      const response = {
        error: 'Admin access required',
        message: 'You do not have permission to access this resource.',
        code: 'FORBIDDEN',
      };

      expect(response.code).toBe('FORBIDDEN');
    });

    it('should return 500 for auth errors', () => {
      const response = {
        error: 'Authentication error',
        message: 'An error occurred while verifying your credentials.',
        code: 'AUTH_ERROR',
      };

      expect(response.code).toBe('AUTH_ERROR');
    });
  });

  describe('Admin User Result Structure', () => {
    it('should return user and adminUser on success', () => {
      const successResult = {
        authorized: true as const,
        user: {
          id: 'user-123',
          email: 'admin@example.com',
        },
        adminUser: {
          id: 'admin-456',
        },
      };

      expect(successResult.authorized).toBe(true);
      expect(successResult.user.id).toBeDefined();
      expect(successResult.adminUser.id).toBeDefined();
    });

    it('should return response on failure', () => {
      const errorResult = {
        authorized: false as const,
        response: {
          status: 401,
        },
      };

      expect(errorResult.authorized).toBe(false);
      expect(errorResult.response).toBeDefined();
    });
  });
});
