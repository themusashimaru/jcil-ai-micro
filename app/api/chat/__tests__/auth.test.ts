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

// Mock Redis cache
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
vi.mock('@/lib/redis/client', () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}));

// Mock Supabase
const mockGetUser = vi.fn();
const mockSelectSingle = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return {
                single: () => mockSelectSingle(),
              };
            },
          };
        },
      };
    },
  }),
}));

// Mock cookies
const mockCookieGetAll = vi.fn().mockReturnValue([]);
const mockCookieSet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => mockCookieGetAll(),
      set: (...args: unknown[]) => mockCookieSet(...args),
    }),
}));

// Import after mocks
const { authenticateRequest } = await import('../auth');

describe('authenticateRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no cached data
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
  });

  describe('unauthenticated requests', () => {
    it('returns 401 when no user session exists', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const result = await authenticateRequest();

      expect(result.authenticated).toBe(false);
      if (!result.authenticated) {
        expect(result.status).toBe(401);
        expect(result.body.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns 401 when auth check throws', async () => {
      mockGetUser.mockRejectedValue(new Error('Supabase down'));

      const result = await authenticateRequest();

      expect(result.authenticated).toBe(false);
      if (!result.authenticated) {
        expect(result.status).toBe(401);
        expect(result.body.error).toBe('Authentication required');
      }
    });
  });

  describe('authenticated requests', () => {
    const mockUser = { id: 'user-123' };

    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } });
      // Default: no custom instructions
      mockSelectSingle.mockResolvedValue({ data: null });
    });

    it('returns authenticated result with user ID', async () => {
      mockSelectSingle
        .mockResolvedValueOnce({
          data: { is_admin: false, subscription_tier: 'free' },
        })
        .mockResolvedValueOnce({ data: null });

      const result = await authenticateRequest();

      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.userId).toBe('user-123');
        expect(result.isAdmin).toBe(false);
        expect(result.userPlanKey).toBe('free');
      }
    });

    it('returns admin status from DB when not cached', async () => {
      mockCacheGet.mockResolvedValue(null);
      mockSelectSingle
        .mockResolvedValueOnce({
          data: { is_admin: true, subscription_tier: 'pro' },
        })
        .mockResolvedValueOnce({ data: null });

      const result = await authenticateRequest();

      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.isAdmin).toBe(true);
        expect(result.userPlanKey).toBe('pro');
      }
      // Should cache the result
      expect(mockCacheSet).toHaveBeenCalledWith(
        'chat:admin:user-123',
        { isAdmin: true, tier: 'pro' },
        300
      );
    });

    it('uses cached admin data when available', async () => {
      mockCacheGet.mockResolvedValue({ isAdmin: true, tier: 'enterprise' });
      // Only need to mock user_settings query
      mockSelectSingle.mockResolvedValueOnce({ data: null });

      const result = await authenticateRequest();

      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.isAdmin).toBe(true);
        expect(result.userPlanKey).toBe('enterprise');
      }
      // Should NOT query DB for admin status
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it('defaults isAdmin to false when DB returns null', async () => {
      mockCacheGet.mockResolvedValue(null);
      mockSelectSingle
        .mockResolvedValueOnce({ data: null }) // users table
        .mockResolvedValueOnce({ data: null }); // user_settings

      const result = await authenticateRequest();

      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.isAdmin).toBe(false);
        expect(result.userPlanKey).toBe('free');
      }
    });

    it('loads custom instructions from user_settings', async () => {
      mockCacheGet.mockResolvedValue({ isAdmin: false, tier: 'free' });
      mockSelectSingle.mockResolvedValueOnce({
        data: { custom_instructions: 'Always respond in Spanish' },
      });

      const result = await authenticateRequest();

      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.customInstructions).toBe('Always respond in Spanish');
      }
    });

    it('handles empty custom instructions', async () => {
      mockCacheGet.mockResolvedValue({ isAdmin: false, tier: 'free' });
      mockSelectSingle.mockResolvedValueOnce({
        data: { custom_instructions: '' },
      });

      const result = await authenticateRequest();

      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.customInstructions).toBe('');
      }
    });

    it('defaults subscription_tier to free when null', async () => {
      mockCacheGet.mockResolvedValue(null);
      mockSelectSingle
        .mockResolvedValueOnce({
          data: { is_admin: false, subscription_tier: null },
        })
        .mockResolvedValueOnce({ data: null });

      const result = await authenticateRequest();

      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.userPlanKey).toBe('free');
      }
    });
  });
});
