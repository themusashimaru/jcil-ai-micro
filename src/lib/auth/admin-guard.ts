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

interface AdminAuthResult {
  authorized: true;
  user: {
    id: string;
    email?: string;
  };
  adminUser: {
    id: string;
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Check if user is authenticated
    if (authError || !user) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: 'Authentication required',
            message: 'You must be signed in to access this resource.',
            code: 'UNAUTHORIZED'
          },
          { status: 401 }
        ),
      };
    }

    // Check if user has admin privileges (by user_id, not email)
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
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
            code: 'FORBIDDEN'
          },
          { status: 403 }
        ),
      };
    }

    // Type assertion needed due to TypeScript's discriminated union limitation
    // At this point, we know adminData is not null, but TS can't infer it properly
    const adminUserId = (adminData as { id: string }).id;

    // User is authenticated AND is an admin
    return {
      authorized: true,
      user: {
        id: user.id,
        email: user.email,
      },
      adminUser: {
        id: adminUserId,
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
          code: 'AUTH_ERROR'
        },
        { status: 500 }
      ),
    };
  }
}
