/**
 * ADMIN PERMISSIONS DEFAULT-TO-FALSE TESTS (Task 1.5.1)
 *
 * Critical security test: admin permissions must default to FALSE
 * when the database returns null/undefined for permission columns.
 * This prevents a fail-open scenario where missing DB data
 * accidentally grants admin permissions.
 */

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

// Mock CSRF validation
const mockValidateCSRF = vi.fn();
vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: (...args: unknown[]) => mockValidateCSRF(...args),
}));

// Mock Supabase — return admin record with null/undefined permissions
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server-auth', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

describe('Admin Permissions Default to FALSE (Task 1.5.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCSRF.mockReturnValue({ valid: true });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-user-id', email: 'admin@test.com' } },
      error: null,
    });
  });

  it('should default ALL permissions to false when DB returns null values', async () => {
    // Simulate DB returning null for every permission column
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'admin-record-id',
              can_view_users: null,
              can_edit_users: null,
              can_view_conversations: null,
              can_export_data: null,
              can_manage_subscriptions: null,
              can_ban_users: null,
            },
            error: null,
          }),
        }),
      }),
    });

    const { requireAdmin } = await import('./admin-guard');
    const result = await requireAdmin();

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      // CRITICAL: All permissions must be FALSE, not null/undefined/true
      expect(result.adminUser.permissions.can_view_users).toBe(false);
      expect(result.adminUser.permissions.can_edit_users).toBe(false);
      expect(result.adminUser.permissions.can_view_conversations).toBe(false);
      expect(result.adminUser.permissions.can_export_data).toBe(false);
      expect(result.adminUser.permissions.can_manage_subscriptions).toBe(false);
      expect(result.adminUser.permissions.can_ban_users).toBe(false);
    }
  });

  it('should default permissions to false when DB returns undefined values', async () => {
    // Simulate DB returning a record with missing permission columns
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'admin-record-id',
              // All permission columns missing — simulates a schema mismatch
            },
            error: null,
          }),
        }),
      }),
    });

    const { requireAdmin } = await import('./admin-guard');
    const result = await requireAdmin();

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      // CRITICAL: undefined ?? false should produce false
      expect(result.adminUser.permissions.can_view_users).toBe(false);
      expect(result.adminUser.permissions.can_edit_users).toBe(false);
      expect(result.adminUser.permissions.can_view_conversations).toBe(false);
      expect(result.adminUser.permissions.can_export_data).toBe(false);
      expect(result.adminUser.permissions.can_manage_subscriptions).toBe(false);
      expect(result.adminUser.permissions.can_ban_users).toBe(false);
    }
  });

  it('should preserve true permissions when DB explicitly sets them', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'admin-record-id',
              can_view_users: true,
              can_edit_users: false,
              can_view_conversations: true,
              can_export_data: false,
              can_manage_subscriptions: null,
              can_ban_users: undefined,
            },
            error: null,
          }),
        }),
      }),
    });

    const { requireAdmin } = await import('./admin-guard');
    const result = await requireAdmin();

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.adminUser.permissions.can_view_users).toBe(true);
      expect(result.adminUser.permissions.can_edit_users).toBe(false);
      expect(result.adminUser.permissions.can_view_conversations).toBe(true);
      expect(result.adminUser.permissions.can_export_data).toBe(false);
      // These should default to false, not null/undefined
      expect(result.adminUser.permissions.can_manage_subscriptions).toBe(false);
      expect(result.adminUser.permissions.can_ban_users).toBe(false);
    }
  });

  it('should deny access when admin record is not found (not in admin_users table)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'Row not found' },
          }),
        }),
      }),
    });

    const { requireAdmin } = await import('./admin-guard');
    const result = await requireAdmin();

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.code).toBe('FORBIDDEN');
    }
  });

  describe('checkPermission granular RBAC', () => {
    it('should deny access for missing permission', async () => {
      // Import checkPermission directly
      const { checkPermission } = await import('./admin-guard');

      const auth = {
        authorized: true as const,
        user: { id: 'user-123', email: 'admin@test.com' },
        adminUser: {
          id: 'admin-123',
          permissions: {
            can_view_users: true,
            can_edit_users: false,
            can_view_conversations: false,
            can_export_data: false,
            can_manage_subscriptions: false,
            can_ban_users: false,
          },
        },
      };

      const allowed = checkPermission(auth, 'can_view_users');
      expect(allowed.allowed).toBe(true);

      const denied = checkPermission(auth, 'can_edit_users');
      expect(denied.allowed).toBe(false);
      if (!denied.allowed) {
        expect(denied.response.status).toBe(403);
      }
    });
  });
});
