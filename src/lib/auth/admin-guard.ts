/**
 * ADMIN AUTHENTICATION GUARD
 *
 * PURPOSE:
 * - Protect admin routes with authentication checks
 * - Verify user is authenticated AND has admin privileges
 * - CSRF protection for state-changing operations
 * - Return standardized error responses
 *
 * USAGE:
 * import { requireAdmin } from '@/lib/auth/admin-guard';
 *
 * // For GET requests (no CSRF check needed):
 * export async function GET() {
 *   const auth = await requireAdmin();
 *   if (!auth.authorized) return auth.response;
 *   // Continue with admin logic...
 * }
 *
 * // For POST/PUT/DELETE (with CSRF protection):
 * export async function POST(request: NextRequest) {
 *   const auth = await requireAdmin(request);
 *   if (!auth.authorized) return auth.response;
 *   // Continue with admin logic...
 * }
 */

import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';

const log = logger('AdminGuard');

/** Admin permission flags from the admin_users table */
export interface AdminPermissions {
  can_view_users: boolean;
  can_edit_users: boolean;
  can_view_conversations: boolean;
  can_export_data: boolean;
  can_manage_subscriptions: boolean;
  can_ban_users: boolean;
}

/** Permission keys for type-safe checking */
export type AdminPermission = keyof AdminPermissions;

interface AdminAuthResult {
  authorized: true;
  user: {
    id: string;
    email?: string;
  };
  adminUser: {
    id: string;
    permissions: AdminPermissions;
  };
}

interface AdminAuthError {
  authorized: false;
  response: NextResponse;
}

type AdminAuthResponse = AdminAuthResult | AdminAuthError;

/**
 * Require admin authentication for a route
 * @param request - Optional request object for CSRF validation on state-changing operations
 * @returns Either authorized user data or error response
 */
export async function requireAdmin(request?: NextRequest): Promise<AdminAuthResponse> {
  try {
    // CSRF PROTECTION: Validate for state-changing requests (POST, PUT, DELETE, PATCH)
    if (request) {
      const csrfCheck = validateCSRF(request);
      if (!csrfCheck.valid) {
        return {
          authorized: false,
          response: csrfCheck.response!,
        };
      }
    }

    // Get authenticated user from session cookies
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Check if user is authenticated
    if (authError || !user) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: 'Authentication required',
            message: 'You must be signed in to access this resource.',
            code: 'UNAUTHORIZED',
          },
          { status: 401 }
        ),
      };
    }

    // Check if user has admin privileges and fetch permissions (by user_id, not email)
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select(
        'id, can_view_users, can_edit_users, can_view_conversations, can_export_data, can_manage_subscriptions, can_ban_users'
      )
      .eq('user_id', user.id)
      .single();

    // Check both error and data for proper TypeScript type narrowing
    if (adminError || !adminData) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: 'Admin access required',
            message: 'You do not have permission to access this resource.',
            code: 'FORBIDDEN',
          },
          { status: 403 }
        ),
      };
    }

    // Type assertion needed due to TypeScript's discriminated union limitation
    const admin = adminData as { id: string } & AdminPermissions;

    // User is authenticated AND is an admin
    return {
      authorized: true,
      user: {
        id: user.id,
        email: user.email,
      },
      adminUser: {
        id: admin.id,
        permissions: {
          can_view_users: admin.can_view_users ?? true,
          can_edit_users: admin.can_edit_users ?? true,
          can_view_conversations: admin.can_view_conversations ?? true,
          can_export_data: admin.can_export_data ?? true,
          can_manage_subscriptions: admin.can_manage_subscriptions ?? true,
          can_ban_users: admin.can_ban_users ?? true,
        },
      },
    };
  } catch (error) {
    // Unexpected error during auth check
    log.error('Unexpected error during authentication', error as Error);

    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Authentication error',
          message: 'An error occurred while verifying your credentials.',
          code: 'AUTH_ERROR',
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Check if an authenticated admin has a specific permission.
 * Use after requireAdmin() succeeds to enforce granular RBAC.
 *
 * @example
 * const auth = await requireAdmin();
 * if (!auth.authorized) return auth.response;
 * const permCheck = checkPermission(auth, 'can_export_data');
 * if (!permCheck.allowed) return permCheck.response;
 */
export function checkPermission(
  auth: AdminAuthResult,
  permission: AdminPermission
): { allowed: true } | { allowed: false; response: NextResponse } {
  if (!auth.adminUser.permissions[permission]) {
    log.warn(`Admin ${auth.user.email} denied: missing permission ${permission}`);
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: 'Insufficient permissions',
          message: `You do not have the "${permission.replace('can_', '').replace(/_/g, ' ')}" permission.`,
          code: 'FORBIDDEN',
        },
        { status: 403 }
      ),
    };
  }
  return { allowed: true };
}
